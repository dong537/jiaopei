"""Append-only request evidence and site-wide budgets."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class BudgetExceeded(RuntimeError):
    pass


class IncompleteCapture(RuntimeError):
    pass


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _write_new(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as file:
        file.write(data)
        file.flush()
        os.fsync(file.fileno())


class Store:
    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        for name in ("raw", "receipts", "exports", "locks"):
            (self.root / name).mkdir(exist_ok=True)
        self.db_path = self.root / "ledger.sqlite3"
        with self._db() as db:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS runs (
                    run_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, host TEXT NOT NULL,
                    started_at_utc TEXT NOT NULL, ended_at_utc TEXT, state TEXT NOT NULL,
                    max_pages INTEGER NOT NULL, max_ids INTEGER NOT NULL, max_requests INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS attempts (
                    attempt_id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(run_id),
                    purpose TEXT NOT NULL, url TEXT NOT NULL, started_at_utc TEXT NOT NULL,
                    ended_at_utc TEXT, state TEXT NOT NULL, http_status INTEGER,
                    business_status TEXT, duration_ms REAL, retry_after TEXT,
                    raw_path TEXT, sha256 TEXT, error TEXT
                );
                CREATE INDEX IF NOT EXISTS attempts_run ON attempts(run_id);
                CREATE INDEX IF NOT EXISTS runs_host ON runs(host);
                CREATE TABLE IF NOT EXISTS events (
                    event_id TEXT PRIMARY KEY, run_id TEXT, attempt_id TEXT,
                    at_utc TEXT NOT NULL, event_type TEXT NOT NULL, detail TEXT NOT NULL
                );
                """
            )

    @contextmanager
    def _db(self):
        db = sqlite3.connect(self.db_path, timeout=20)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def new_run(self, source_id: str, host: str, *, max_pages: int, max_ids: int, max_requests: int) -> str:
        if min(max_pages, max_ids, max_requests) < 1:
            raise ValueError("all network limits must be positive")
        run_id = uuid.uuid4().hex
        with self._db() as db:
            db.execute(
                "INSERT INTO runs VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)",
                (run_id, source_id, host, utc_now(), "running", max_pages, max_ids, max_requests),
            )
        return run_id

    def get_run(self, run_id: str) -> dict[str, Any]:
        with self._db() as db:
            row = db.execute("SELECT * FROM runs WHERE run_id=?", (run_id,)).fetchone()
        if row is None:
            raise KeyError(run_id)
        return dict(row)

    def begin_attempt(self, run_id: str, purpose: str, url: str) -> str:
        attempt_id = uuid.uuid4().hex
        with self._db() as db:
            db.execute("BEGIN IMMEDIATE")
            run = db.execute("SELECT max_requests,state FROM runs WHERE run_id=?", (run_id,)).fetchone()
            if run is None:
                raise KeyError(run_id)
            if run["state"] not in ("running", "captured"):
                raise IncompleteCapture(f"run state {run['state']} needs review")
            used = db.execute("SELECT COUNT(*) FROM attempts WHERE run_id=?", (run_id,)).fetchone()[0]
            if used >= run["max_requests"]:
                db.execute("UPDATE runs SET state='stopped_budget', ended_at_utc=? WHERE run_id=?", (utc_now(), run_id))
                db.commit()
                raise BudgetExceeded(f"request budget exhausted: {used}/{run['max_requests']}")
            db.execute(
                "INSERT INTO attempts (attempt_id,run_id,purpose,url,started_at_utc,state) VALUES (?,?,?,?,?,?)",
                (attempt_id, run_id, purpose, url, utc_now(), "started"),
            )
        return attempt_id

    def record_http(self, attempt_id: str, status_code: int, headers: dict[str, str], body: bytes, duration_ms: float) -> Path:
        attempt = self.get_attempt(attempt_id)
        if attempt["state"] != "started":
            raise IncompleteCapture("attempt already finalized")
        now = utc_now()
        sha256 = hashlib.sha256(body).hexdigest()
        relative = Path("raw") / f"{attempt_id}.bin"
        raw_path = self.root / relative
        _write_new(raw_path, body)  # Save bytes before HTTP/business validation.
        safe_headers = {k.lower(): v for k, v in headers.items() if k.lower() in {"content-type", "content-length", "retry-after"}}
        sidecar = {
            "attempt_id": attempt_id, "run_id": attempt["run_id"],
            "purpose": attempt["purpose"], "url": attempt["url"],
            "started_at_utc": attempt["started_at_utc"], "ended_at_utc": now,
            "http_status": status_code, "duration_ms": duration_ms,
            "sha256": sha256, "headers": safe_headers,
        }
        _write_new(raw_path.with_suffix(".json"), json.dumps(sidecar, ensure_ascii=False, sort_keys=True).encode("utf-8"))
        with self._db() as db:
            db.execute(
                "UPDATE attempts SET ended_at_utc=?,state='captured',http_status=?,business_status='unverified',duration_ms=?,retry_after=?,raw_path=?,sha256=? WHERE attempt_id=?",
                (now, status_code, duration_ms, safe_headers.get("retry-after"), os.fspath(relative), sha256, attempt_id),
            )
        return raw_path

    def record_error(self, attempt_id: str, error: str, duration_ms: float, *, retryable: bool = False) -> None:
        state = "retryable" if retryable else "failed"
        business_status = "network_retryable" if retryable else "network_error"
        with self._db() as db:
            db.execute(
                "UPDATE attempts SET ended_at_utc=?,state=?,business_status=?,duration_ms=?,error=? WHERE attempt_id=? AND state='started'",
                (utc_now(), state, business_status, duration_ms, error, attempt_id),
            )
            if not retryable:
                db.execute("UPDATE runs SET state='failed',ended_at_utc=? WHERE run_id=(SELECT run_id FROM attempts WHERE attempt_id=?)", (utc_now(), attempt_id))
        self.event("attempt_error", error, attempt_id=attempt_id, run_id=self.get_attempt(attempt_id)["run_id"])

    def review_retry(self, attempt_id: str, reason: str) -> None:
        """Mark only a transient incomplete attempt eligible for a new bounded run."""
        reason = reason.strip()
        if len(reason) < 8:
            raise ValueError("a specific review reason of at least 8 characters is required")
        attempt = self.get_attempt(attempt_id)
        transient_errors = {"ConnectTimeout", "ReadTimeout", "WriteTimeout", "PoolTimeout", "ConnectError"}
        transient_http = attempt["http_status"] in {502, 503, 504}
        interrupted_without_response = attempt["state"] == "started" and attempt["raw_path"] is None
        if attempt["state"] not in {"started", "failed", "retryable"} or not (
            transient_http or attempt["error"] in transient_errors or interrupted_without_response
        ):
            raise ValueError("only reviewed transient failures can be retried; access blocks remain blocked")
        raw_path = self.root / "raw" / f"{attempt_id}.bin"
        sidecar_path = raw_path.with_suffix(".json")
        if interrupted_without_response and (raw_path.exists() or sidecar_path.exists()):
            raise ValueError("orphaned response exists; reconcile and inspect it before retry")
        if attempt["raw_path"]:
            if not raw_path.is_file() or hashlib.sha256(raw_path.read_bytes()).hexdigest() != attempt["sha256"]:
                raise ValueError("failed response raw bytes are missing or changed")
            if not sidecar_path.is_file():
                raise ValueError("failed response sidecar is missing")
            sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
            if sidecar.get("attempt_id") != attempt_id or sidecar.get("url") != attempt["url"] or sidecar.get("sha256") != attempt["sha256"]:
                raise ValueError("failed response sidecar identity changed")
        with self._db() as db:
            db.execute("UPDATE attempts SET state='reviewed' WHERE attempt_id=? AND state=?", (attempt_id, attempt["state"]))
            db.execute("UPDATE runs SET state='reviewed',ended_at_utc=? WHERE run_id=?", (utc_now(), attempt["run_id"]))
        self.event("retry_reviewed", reason, attempt_id=attempt_id, run_id=attempt["run_id"])

    def review_reverify(self, attempt_id: str, reason: str) -> None:
        """Approve offline revalidation of a preserved HTTP 200 identity false negative."""
        reason = reason.strip()
        if len(reason) < 8:
            raise ValueError("a specific review reason of at least 8 characters is required")
        attempt = self.get_attempt(attempt_id)
        if not (attempt["state"] == "blocked" and attempt["http_status"] == 200
                and attempt["business_status"] == "identity_mismatch"):
            raise ValueError("only blocked HTTP 200 identity mismatches can be reverified")
        relative = Path("raw") / f"{attempt_id}.bin"
        if attempt["raw_path"] != os.fspath(relative):
            raise ValueError("raw path differs from attempt identity")
        raw_path = self.root / relative
        sidecar_path = raw_path.with_suffix(".json")
        if not raw_path.is_file() or not sidecar_path.is_file():
            raise ValueError("preserved raw response or sidecar is missing")
        digest = hashlib.sha256(raw_path.read_bytes()).hexdigest()
        meta = json.loads(sidecar_path.read_text(encoding="utf-8"))
        if (digest != attempt["sha256"] or meta.get("sha256") != digest
                or meta.get("attempt_id") != attempt_id or meta.get("run_id") != attempt["run_id"]
                or meta.get("url") != attempt["url"] or meta.get("http_status") != 200):
            raise ValueError("preserved raw response does not match request ledger")
        if (self.root / "receipts" / f"{attempt_id}.json").exists():
            raise ValueError("an existing receipt requires separate integrity investigation")
        with self._db() as db:
            db.execute("UPDATE attempts SET state='recheck_approved' WHERE attempt_id=? AND state='blocked'", (attempt_id,))
        self.event("offline_reverify_approved", reason, run_id=attempt["run_id"], attempt_id=attempt_id)

    def set_attempt_state(self, attempt_id: str, state: str, business_status: str, error: str | None = None) -> None:
        if state not in {"captured", "retryable", "failed", "blocked"}:
            raise ValueError(state)
        with self._db() as db:
            db.execute("UPDATE attempts SET state=?,business_status=?,error=? WHERE attempt_id=?", (state, business_status, error, attempt_id))
            if state in {"failed", "blocked"}:
                db.execute("UPDATE runs SET state=?,ended_at_utc=? WHERE run_id=(SELECT run_id FROM attempts WHERE attempt_id=?)", (state, utc_now(), attempt_id))
        if state in {"retryable", "failed", "blocked"}:
            self.event("attempt_status", f"{state}: {business_status}: {error or ''}",
                       attempt_id=attempt_id, run_id=self.get_attempt(attempt_id)["run_id"])

    def set_run_state(self, run_id: str, state: str) -> None:
        with self._db() as db:
            db.execute("UPDATE runs SET state=?,ended_at_utc=? WHERE run_id=?", (state, utc_now(), run_id))

    def get_attempt(self, attempt_id: str) -> dict[str, Any]:
        with self._db() as db:
            row = db.execute("SELECT * FROM attempts WHERE attempt_id=?", (attempt_id,)).fetchone()
        if row is None:
            raise KeyError(attempt_id)
        return dict(row)

    def attempts(self, run_id: str) -> list[dict[str, Any]]:
        with self._db() as db:
            rows = db.execute("SELECT * FROM attempts WHERE run_id=? ORDER BY started_at_utc, attempt_id", (run_id,)).fetchall()
        return [dict(row) for row in rows]

    def all_attempts(self) -> list[dict[str, Any]]:
        with self._db() as db:
            rows = db.execute("SELECT attempts.*,runs.source_id,runs.host FROM attempts JOIN runs USING(run_id) ORDER BY started_at_utc,attempt_id").fetchall()
        return [dict(row) for row in rows]

    def raw_bytes(self, attempt_id: str) -> bytes:
        attempt = self.get_attempt(attempt_id)
        if not attempt["raw_path"]:
            raise FileNotFoundError(f"no response bytes for {attempt_id}")
        return (self.root / attempt["raw_path"]).read_bytes()

    def reconcile_orphaned(self) -> list[str]:
        """Attach intact raw+sidecar left by a crash before the ledger update.

        Incomplete or changed files remain started and block further site requests.
        This operation never downloads or treats a list as a verified detail.
        """
        with self._db() as db:
            rows = db.execute("SELECT * FROM attempts WHERE state='started' ORDER BY started_at_utc").fetchall()
        repaired: list[str] = []
        for row in rows:
            attempt = dict(row)
            raw_path = self.root / "raw" / f"{attempt['attempt_id']}.bin"
            sidecar_path = raw_path.with_suffix(".json")
            if not raw_path.is_file() or not sidecar_path.is_file():
                continue
            try:
                meta = json.loads(sidecar_path.read_text(encoding="utf-8"))
                digest = hashlib.sha256(raw_path.read_bytes()).hexdigest()
                if (meta.get("attempt_id") != attempt["attempt_id"]
                    or meta.get("run_id") != attempt["run_id"]
                    or meta.get("url") != attempt["url"]
                    or meta.get("started_at_utc") != attempt["started_at_utc"]
                    or meta.get("sha256") != digest
                    or not isinstance(meta.get("http_status"), int)):
                    continue
            except (OSError, ValueError, TypeError):
                continue
            status = meta["http_status"]
            state = "captured" if status == 200 else ("failed" if status in {502, 503, 504} else "blocked")
            with self._db() as db:
                db.execute(
                    "UPDATE attempts SET ended_at_utc=?,state=?,http_status=?,business_status=?,duration_ms=?,retry_after=?,raw_path=?,sha256=? WHERE attempt_id=? AND state='started'",
                    (meta["ended_at_utc"], state, status, "reconciled_unverified", meta["duration_ms"],
                     meta.get("headers", {}).get("retry-after"),
                     os.fspath(Path("raw") / raw_path.name), digest, attempt["attempt_id"]),
                )
                if state != "captured":
                    db.execute("UPDATE runs SET state=?,ended_at_utc=? WHERE run_id=?", (state, utc_now(), attempt["run_id"]))
            self.event("reconciled_orphan", f"HTTP {status}", run_id=attempt["run_id"], attempt_id=attempt["attempt_id"])
            repaired.append(attempt["attempt_id"])
        return repaired

    def ensure_site_ready(self, host: str) -> None:
        with self._db() as db:
            row = db.execute(
                "SELECT attempts.attempt_id,attempts.state FROM attempts JOIN runs USING(run_id) WHERE runs.host=? AND attempts.state IN ('started','blocked','failed','recheck_approved') LIMIT 1",
                (host,),
            ).fetchone()
            budget = db.execute("SELECT run_id FROM runs WHERE host=? AND state='stopped_budget' LIMIT 1", (host,)).fetchone()
        if row is not None:
            raise IncompleteCapture(f"site has {row['state']} attempt {row['attempt_id']}; review offline before another request")
        if budget is not None:
            raise IncompleteCapture(f"site has stopped-budget run {budget['run_id']}; review offline before another request")

    def last_request_started(self, host: str) -> str | None:
        with self._db() as db:
            value = db.execute("SELECT MAX(attempts.started_at_utc) FROM attempts JOIN runs USING(run_id) WHERE runs.host=?", (host,)).fetchone()[0]
        return value

    def event(self, event_type: str, detail: str, *, run_id: str | None = None, attempt_id: str | None = None) -> None:
        with self._db() as db:
            db.execute("INSERT INTO events VALUES (?,?,?,?,?,?)", (uuid.uuid4().hex, run_id, attempt_id, utc_now(), event_type, detail))
