"""Offline checks for a complete, immutable Longyan list observation."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

from .sources import longyan, jinan
from .store import Store


class SourceIdentityError(ValueError):
    """The captured response is not the configured Longyan list source."""


def _receipt_path(store: Store, attempt_id: str) -> Path:
    return store.root / "receipts" / f"{attempt_id}.json"


def _block(store: Store, attempt_id: str, reason: str, detail: str) -> None:
    store.set_attempt_state(attempt_id, "blocked", reason, detail)
    store.event("receipt_blocked", detail, attempt_id=attempt_id,
                run_id=store.get_attempt(attempt_id)["run_id"])


def _check_sidecar(store: Store, attempt: dict[str, Any]) -> bytes:
    attempt_id = attempt["attempt_id"]
    expected_relative = Path("raw") / f"{attempt_id}.bin"
    if attempt["raw_path"] != os.fspath(expected_relative):
        raise ValueError("raw path does not match attempt identity")
    raw_path = store.root / expected_relative
    sidecar_path = raw_path.with_suffix(".json")
    try:
        raw = raw_path.read_bytes()
        sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("raw or sidecar is missing or unreadable") from exc
    if not isinstance(sidecar, dict):
        raise ValueError("sidecar must be a JSON object")
    expected = {
        "attempt_id": attempt_id,
        "run_id": attempt["run_id"],
        "purpose": attempt["purpose"],
        "url": attempt["url"],
        "started_at_utc": attempt["started_at_utc"],
        "ended_at_utc": attempt["ended_at_utc"],
        "http_status": attempt["http_status"],
        "duration_ms": attempt["duration_ms"],
        "sha256": attempt["sha256"],
    }
    for key, expected_value in expected.items():
        if sidecar.get(key) != expected_value:
            raise ValueError(f"sidecar {key} differs from request ledger")
    digest = hashlib.sha256(raw).hexdigest()
    if digest != attempt["sha256"] or digest != sidecar["sha256"]:
        raise ValueError("raw SHA-256 hash differs from ledger or sidecar")
    return raw


def _read_existing_receipt(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("existing receipt is missing or unreadable") from exc
    if not isinstance(value, dict):
        raise ValueError("existing receipt must be a JSON object")
    return value


def _save_immutable_receipt(store: Store, attempt_id: str, receipt: dict[str, Any]) -> None:
    path = _receipt_path(store, attempt_id)
    if path.exists():
        if _read_existing_receipt(path) != receipt:
            raise RuntimeError("existing receipt differs from recomputed content")
        return
    data = json.dumps(receipt, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    try:
        with path.open("xb") as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
    except FileExistsError:
        if _read_existing_receipt(path) != receipt:
            raise RuntimeError("concurrent receipt differs from recomputed content")


def verify_list(store: Store, attempt_id: str) -> dict[str, Any]:
    """Recompute completeness from ledger, sidecar, raw bytes and parser.

    An existing receipt is never replaced; it must match the new computation.
    All verification failures block the attempt and leave any original bytes
    and prior receipt untouched for investigation.
    """
    attempt = store.get_attempt(attempt_id)
    run = store.get_run(attempt["run_id"])
    if attempt["state"] == "blocked":
        raise ValueError("blocked attempt requires explicit offline review before revalidation")
    try:
        if run["source_id"] != longyan.SOURCE_ID or attempt["purpose"] != "list" or attempt["url"] != longyan.SOURCE_URL:
            raise SourceIdentityError("Longyan source identity mismatch")
        if attempt["state"] not in {"captured", "recheck_approved"} or attempt["http_status"] != 200:
            raise RuntimeError("list attempt is not a captured HTTP 200 response")
        raw = _check_sidecar(store, attempt)
        try:
            records = longyan.parse_xlsx(raw)
        except ValueError as exc:
            raise SourceIdentityError(f"Longyan XLSX identity or header mismatch: {exc}") from exc
        if len({record["source_record_id"] for record in records}) > run["max_ids"]:
            raise ValueError("source row ID count exceeds the run's max-ids acceptance budget")
        receipt: dict[str, Any] = {
            "state": "complete",
            "attempt_id": attempt_id,
            "source_id": longyan.SOURCE_ID,
            "source_url": longyan.SOURCE_URL,
            "published_at": longyan.PUBLISHED_AT,
            "collected_at_utc": attempt["ended_at_utc"],
            "raw_sha256": attempt["sha256"],
            "row_count": len(records),
            "distinct_source_ids": len({record["source_record_id"] for record in records}),
            "records": records,
        }
        _save_immutable_receipt(store, attempt_id, receipt)
        if attempt["state"] == "recheck_approved":
            store.event("offline_revalidated_after_block", f"prior status: {attempt['business_status']}",
                        run_id=attempt["run_id"], attempt_id=attempt_id)
        store.set_attempt_state(attempt_id, "captured", "verified")
        if run["state"] != "verified":
            store.set_run_state(attempt["run_id"], "verified")
        return receipt
    except SourceIdentityError as exc:
        _block(store, attempt_id, "identity_mismatch", str(exc))
        raise
    except (ValueError, RuntimeError, OSError) as exc:
        _block(store, attempt_id, "receipt_error", str(exc))
        if isinstance(exc, ValueError):
            raise
        raise ValueError(str(exc)) from exc


def latest_valid_receipt(store: Store, source_id: str) -> tuple[str, dict[str, Any]] | None:
    """Only the newest list observation may justify skipping a network request."""
    for attempt in reversed(store.all_attempts()):
        if attempt["source_id"] != source_id or attempt["purpose"] != "list":
            continue
        attempt_id = attempt["attempt_id"]
        if not _receipt_path(store, attempt_id).exists():
            return None
        receipt = verify_list(store, attempt_id)
        return attempt_id, receipt
    return None


def verify_jinan_list(store: Store, attempt_id: str) -> dict[str, Any]:
    """Verify the single Jinan HTML list without treating its scope as courses."""
    attempt = store.get_attempt(attempt_id)
    run = store.get_run(attempt["run_id"])
    if attempt["state"] == "blocked":
        raise ValueError("blocked attempt requires explicit offline review before revalidation")
    try:
        if run["source_id"] != jinan.SOURCE_ID or attempt["purpose"] != "list" or attempt["url"] != jinan.SOURCE_URL:
            raise SourceIdentityError("Jinan source identity mismatch")
        if attempt["state"] not in {"captured", "recheck_approved"} or attempt["http_status"] != 200:
            raise RuntimeError("Jinan list attempt is not a captured HTTP 200 response")
        raw = _check_sidecar(store, attempt)
        try:
            records = jinan.parse_html(raw)
        except ValueError as exc:
            raise SourceIdentityError(f"Jinan HTML identity or table mismatch: {exc}") from exc
        ids = {record["source_record_id"] for record in records}
        if len(ids) > run["max_ids"]:
            raise ValueError("Jinan source row ID count exceeds the run's max-ids acceptance budget")
        licenses: dict[str, int] = {}
        for record in records:
            number = record.get("license_number")
            if number:
                licenses[str(number)] = licenses.get(str(number), 0) + 1
        duplicate_numbers = sorted(number for number, count in licenses.items() if count > 1)
        receipt: dict[str, Any] = {
            "state": "complete", "attempt_id": attempt_id, "source_id": jinan.SOURCE_ID,
            "source_url": jinan.SOURCE_URL, "published_at": jinan.PUBLISHED_AT,
            "as_of": jinan.AS_OF, "collected_at_utc": attempt["ended_at_utc"],
            "raw_sha256": attempt["sha256"], "row_count": len(records),
            "distinct_source_ids": len(ids),
            "license_number_present_rows": sum(bool(record.get("license_number")) for record in records),
            "duplicate_license_numbers": duplicate_numbers,
            "records": records,
        }
        _save_immutable_receipt(store, attempt_id, receipt)
        if attempt["state"] == "recheck_approved":
            store.event("offline_revalidated_after_block", f"prior status: {attempt['business_status']}",
                        run_id=attempt["run_id"], attempt_id=attempt_id)
        store.set_attempt_state(attempt_id, "captured", "verified")
        if run["state"] != "verified":
            store.set_run_state(attempt["run_id"], "verified")
        return receipt
    except SourceIdentityError as exc:
        _block(store, attempt_id, "identity_mismatch", str(exc))
        raise
    except (ValueError, RuntimeError, OSError) as exc:
        _block(store, attempt_id, "receipt_error", str(exc))
        if isinstance(exc, ValueError):
            raise
        raise ValueError(str(exc)) from exc


def latest_valid_jinan_receipt(store: Store) -> tuple[str, dict[str, Any]] | None:
    for attempt in reversed(store.all_attempts()):
        if attempt["source_id"] != jinan.SOURCE_ID or attempt["purpose"] != "list":
            continue
        attempt_id = attempt["attempt_id"]
        if not _receipt_path(store, attempt_id).exists():
            return None
        return attempt_id, verify_jinan_list(store, attempt_id)
    return None
