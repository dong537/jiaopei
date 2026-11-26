"""Bounded CLI for one official, publicly downloadable research attachment."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import tomllib
from pathlib import Path

from .network import CaptureBlocked, CaptureFailed, capture
from .sources.longyan import SOURCE_ID, SOURCE_URL, list_url
from .store import BudgetExceeded, IncompleteCapture, Store


HOST = "jyj.longyan.gov.cn"
JINAN_HOST = "innovation.jinan.gov.cn"
JINAN_SOURCE_ID = "jinan-hightech-2026-whitelist"
JINAN_SOURCE_URL = "https://innovation.jinan.gov.cn/col/col89688/art/2026/art_2bc8258b48a24493b521b44a3cb760fc.html"
DEFAULT_CONFIG = Path(__file__).resolve().parents[2] / "config.example.toml"
DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "var"


def positive_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be a positive integer") from exc
    if number < 1:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return number


def _json(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="edu-collect", description="Private official-list research; no public publishing command.")
    sub = parser.add_subparsers(dest="command", required=True)
    inspect = sub.add_parser("inspect", help="Offline read-only ledger inspection; never accesses the website")
    inspect.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    fetch = sub.add_parser("fetch-list", help="NETWORK: one bounded official XLSX request; raw stays private")
    fetch.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR,
                       help="Must resolve to this installation's collector/var so one site uses one ledger")
    fetch.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    fetch.add_argument("--max-pages", type=positive_int, required=True)
    fetch.add_argument("--max-ids", type=positive_int, required=True)
    fetch.add_argument("--max-requests", type=positive_int, required=True)
    fetch.add_argument("--ack-internal-research", action="store_true", required=True, help="Acknowledge one private research sample; not a republication license")
    fetch.add_argument("--resume-reviewed", action="store_true", help="Only after review-retry marked the prior transient failure")
    jinan = sub.add_parser("fetch-jinan", help="NETWORK: one bounded official Jinan HTML research request")
    jinan.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    jinan.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    jinan.add_argument("--max-pages", type=positive_int, required=True)
    jinan.add_argument("--max-ids", type=positive_int, required=True)
    jinan.add_argument("--max-requests", type=positive_int, required=True)
    jinan.add_argument("--ack-internal-research", action="store_true", required=True)
    detail = sub.add_parser("fetch-detail", help="NETWORK if supported; this source has no confirmed detail endpoint")
    detail.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    detail.add_argument("--max-pages", type=positive_int, required=True)
    detail.add_argument("--max-ids", type=positive_int, required=True)
    detail.add_argument("--max-requests", type=positive_int, required=True)
    verify = sub.add_parser("verify", help="Offline raw/hash/receipt verification and orphan reconciliation")
    verify.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    verify_jinan = sub.add_parser("verify-jinan", help="Offline Jinan raw/HTML/receipt verification")
    verify_jinan.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    export = sub.add_parser("export-candidates", help="Offline private JSONL; never writes the website directory")
    export.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    export.add_argument("--max-ids", type=positive_int, required=True)
    jinan_export = sub.add_parser("export-jinan-candidates", help="Offline private Jinan JSONL; never publishes")
    jinan_export.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    jinan_export.add_argument("--max-ids", type=positive_int, required=True)
    review = sub.add_parser("review-retry", help="Offline human acknowledgement of a transient incomplete attempt")
    review.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    review.add_argument("--attempt", required=True)
    review.add_argument("--reason", required=True)
    reverify = sub.add_parser("review-reverify", help="Offline human review of preserved HTTP 200 identity false negative")
    reverify.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    reverify.add_argument("--attempt", required=True)
    reverify.add_argument("--reason", required=True)
    return parser


def _inspect(root: Path) -> int:
    path = root.resolve() / "ledger.sqlite3"
    if not path.is_file():
        _json({"status": "no ledger", "network_request_attempts": 0})
        return 0
    with sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True) as db:
        runs = db.execute("SELECT state,COUNT(*) FROM runs GROUP BY state").fetchall()
        attempts = db.execute("SELECT state,COUNT(*) FROM attempts GROUP BY state").fetchall()
        count = db.execute("SELECT COUNT(*) FROM attempts").fetchone()[0]
        sources = db.execute("SELECT runs.source_id,COUNT(attempts.attempt_id) FROM runs LEFT JOIN attempts USING(run_id) GROUP BY runs.source_id").fetchall()
    _json({
        "policy": "private-research-only",
        "network_request_attempts": count, "attempts_by_source": dict(sources),
        "run_states": dict(runs),
        "attempt_states": dict(attempts),
        "receipt_files": len(list((root / "receipts").glob("*.json"))),
    })
    return 0


def _config(path: Path, section: str = "longyan") -> dict:
    with path.open("rb") as file:
        data = tomllib.load(file)[section]
    if data.get("research_only") is not True or data.get("production_schedule_enabled") is not False:
        raise ValueError("this source must remain research-only with schedule disabled")
    interval = float(data["min_interval_seconds"])
    timeout = float(data["timeout_seconds"])
    retries = int(data["max_retries"])
    if interval < 0 or timeout <= 0 or retries not in (0, 1):
        raise ValueError("invalid bounded source settings")
    return {"interval": interval, "timeout": timeout, "retries": retries}


def _fetch_jinan(args: argparse.Namespace) -> int:
    if args.data_dir.resolve() != DEFAULT_DATA_DIR.resolve():
        raise ValueError("network capture must use this installation's collector/var site ledger")
    if args.max_pages != 1 or args.max_requests != 1:
        raise ValueError("Jinan sample is one HTML page and one request; both limits must be 1")
    settings = _config(args.config, "jinan")
    store = Store(args.data_dir)
    from .receipts import latest_valid_jinan_receipt
    try:
        complete = latest_valid_jinan_receipt(store)
    except (RuntimeError, ValueError, OSError) as exc:
        print(f"Jinan receipt check failed: {exc}", file=sys.stderr)
        return 2
    if complete is not None:
        attempt_id, receipt = complete
        _json({"status": "skipped_verified_receipt", "source_id": JINAN_SOURCE_ID,
               "attempt_id": attempt_id, "network_requests": 0, "raw_list_rows": receipt["row_count"]})
        return 0
    if any(attempt["source_id"] == JINAN_SOURCE_ID for attempt in store.all_attempts()):
        print("Jinan observation already exists; inspect and verify offline, no automatic refetch", file=sys.stderr)
        return 2
    run_id = store.new_run(JINAN_SOURCE_ID, JINAN_HOST, max_pages=1,
                           max_ids=args.max_ids, max_requests=1)
    try:
        attempt_id = capture(store, run_id, JINAN_HOST, "list", JINAN_SOURCE_URL,
                             min_interval_seconds=settings["interval"],
                             max_retries=0, timeout_seconds=settings["timeout"])
    except (CaptureBlocked, CaptureFailed, BudgetExceeded, IncompleteCapture) as exc:
        if not store.attempts(run_id):
            store.set_run_state(run_id, "stopped_before_request")
        print(f"Jinan capture stopped: {exc}; run_id={run_id}", file=sys.stderr)
        return 2
    attempt = store.get_attempt(attempt_id)
    _json({"status": "captured_unverified", "source_id": JINAN_SOURCE_ID,
           "run_id": run_id, "attempt_id": attempt_id, "network_requests": 1,
           "raw_path": str(store.root / attempt["raw_path"]),
           "next": "offline source-specific parsing and receipt verification"})
    return 0


def _fetch_list(args: argparse.Namespace) -> int:
    from .receipts import latest_valid_receipt

    if args.data_dir.resolve() != DEFAULT_DATA_DIR.resolve():
        raise ValueError("network capture must use this installation's collector/var site ledger")
    if args.max_pages != 1:
        raise ValueError("this source is one XLSX file; max-pages must be 1")
    settings = _config(args.config)
    store = Store(args.data_dir)
    prior = [a for a in store.all_attempts() if a["source_id"] == SOURCE_ID]
    try:
        complete = latest_valid_receipt(store, SOURCE_ID)
    except (RuntimeError, ValueError, OSError) as exc:
        print(f"receipt check failed: {exc}", file=sys.stderr)
        return 2
    if complete is not None:
        attempt_id, receipt = complete
        _json({"status": "skipped_verified_receipt", "network_requests": 0, "attempt_id": attempt_id, "raw_list_rows": receipt["row_count"]})
        return 0
    if prior and not (args.resume_reviewed and prior[-1]["state"] == "reviewed"):
        print("prior unverified/blocked attempt exists; run verify or review-retry; no automatic refetch", file=sys.stderr)
        return 2
    run_id = store.new_run(SOURCE_ID, HOST, max_pages=args.max_pages, max_ids=args.max_ids, max_requests=args.max_requests)
    try:
        attempt_id = capture(
            store, run_id, HOST, "list", list_url(1),
            min_interval_seconds=settings["interval"], max_retries=settings["retries"],
            timeout_seconds=settings["timeout"],
        )
    except (CaptureBlocked, CaptureFailed, BudgetExceeded, IncompleteCapture) as exc:
        if not store.attempts(run_id):
            store.set_run_state(run_id, "stopped_before_request")
        print(f"capture stopped: {exc}; run_id={run_id}", file=sys.stderr)
        return 2
    attempt = store.get_attempt(attempt_id)
    _json({"status": "captured_unverified", "run_id": run_id, "attempt_id": attempt_id, "network_requests": len(store.attempts(run_id)), "raw_path": str(store.root / attempt["raw_path"]), "next": "verify offline before any skip/export"})
    return 0


def _verify(args: argparse.Namespace) -> int:
    from .receipts import verify_list

    if not (args.data_dir / "ledger.sqlite3").exists():
        print("no ledger to verify", file=sys.stderr)
        return 2
    store = Store(args.data_dir)
    reconciled = store.reconcile_orphaned()
    attempts = [a for a in store.all_attempts() if a["source_id"] == SOURCE_ID]
    verified = []
    errors = []
    for attempt in attempts:
        if attempt["http_status"] != 200:
            continue
        try:
            receipt = verify_list(store, attempt["attempt_id"])
            verified.append({"attempt_id": attempt["attempt_id"], "row_count": receipt["row_count"], "distinct_source_ids": receipt["distinct_source_ids"]})
        except (RuntimeError, ValueError, FileNotFoundError, OSError) as exc:
            errors.append({"attempt_id": attempt["attempt_id"], "error": str(exc)})
    failed = sum(a["state"] in {"failed", "blocked", "started"} for a in store.all_attempts())
    summary = {
        "source_id": SOURCE_ID, "network_requests": len(attempts),
        "reconciled_attempts": reconciled, "verified_lists": verified,
        "raw_list_rows": verified[-1]["row_count"] if verified else 0,
        "distinct_source_ids": verified[-1]["distinct_source_ids"] if verified else 0,
        "detail_complete": 0, "detail_pending": verified[-1]["distinct_source_ids"] if verified else 0,
        "failed_or_unresolved_attempts": failed, "errors": errors,
    }
    _json(summary)
    return 0 if verified and not errors and failed == 0 else 2


def _verify_jinan(args: argparse.Namespace) -> int:
    from .receipts import verify_jinan_list

    if not (args.data_dir / "ledger.sqlite3").exists():
        print("no ledger to verify", file=sys.stderr)
        return 2
    store = Store(args.data_dir)
    reconciled = store.reconcile_orphaned()
    attempts = [a for a in store.all_attempts() if a["source_id"] == JINAN_SOURCE_ID]
    verified = []
    errors = []
    for attempt in attempts:
        if attempt["http_status"] != 200:
            continue
        try:
            receipt = verify_jinan_list(store, attempt["attempt_id"])
            verified.append({"attempt_id": attempt["attempt_id"],
                             "row_count": receipt["row_count"],
                             "distinct_source_ids": receipt["distinct_source_ids"],
                             "license_number_present_rows": receipt["license_number_present_rows"],
                             "duplicate_license_numbers": receipt["duplicate_license_numbers"]})
        except (RuntimeError, ValueError, FileNotFoundError, OSError) as exc:
            errors.append({"attempt_id": attempt["attempt_id"], "error": str(exc)})
    failed = sum(a["state"] in {"failed", "blocked", "started", "recheck_approved"}
                 for a in store.all_attempts() if a["source_id"] == JINAN_SOURCE_ID)
    _json({"source_id": JINAN_SOURCE_ID, "network_request_attempts": len(attempts),
           "reconciled_attempts": reconciled, "verified_lists": verified,
           "raw_list_rows": verified[-1]["row_count"] if verified else 0,
           "distinct_source_ids": verified[-1]["distinct_source_ids"] if verified else 0,
           "failed_or_unresolved_attempts": failed, "errors": errors})
    return 0 if verified and not errors and failed == 0 else 2


def _export(args: argparse.Namespace) -> int:
    from .receipts import latest_valid_receipt
    from .export import export_candidates

    if not (args.data_dir / "ledger.sqlite3").exists():
        print("no ledger to export", file=sys.stderr)
        return 2
    store = Store(args.data_dir)
    try:
        complete = latest_valid_receipt(store, SOURCE_ID)
        if complete is None:
            print("no valid complete offline receipt", file=sys.stderr)
            return 2
        path, summary = export_candidates(store, complete[0], args.max_ids)
    except (RuntimeError, ValueError, FileNotFoundError, OSError) as exc:
        print(f"export stopped: {exc}", file=sys.stderr)
        return 2
    _json({"status": "private_candidates", "path": str(path), **summary})
    return 0


def _export_jinan(args: argparse.Namespace) -> int:
    from .receipts import latest_valid_jinan_receipt
    from .export import export_jinan_candidates

    if not (args.data_dir / "ledger.sqlite3").exists():
        print("no ledger to export", file=sys.stderr)
        return 2
    store = Store(args.data_dir)
    try:
        complete = latest_valid_jinan_receipt(store)
        if complete is None:
            print("no valid complete Jinan receipt", file=sys.stderr)
            return 2
        path, summary = export_jinan_candidates(store, complete[0], args.max_ids)
    except (RuntimeError, ValueError, FileNotFoundError, OSError) as exc:
        print(f"Jinan export stopped: {exc}", file=sys.stderr)
        return 2
    _json({"status": "private_jinan_candidates", "path": str(path), **summary})
    return 0


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "inspect":
        return _inspect(args.data_dir)
    if args.command == "fetch-detail":
        print("no confirmed public detail endpoint for this source; no network request made", file=sys.stderr)
        return 2
    if args.command == "fetch-list":
        try:
            return _fetch_list(args)
        except (OSError, KeyError, ValueError) as exc:
            print(f"configuration/source error: {exc}", file=sys.stderr)
            return 2
    if args.command == "fetch-jinan":
        try:
            return _fetch_jinan(args)
        except (OSError, KeyError, ValueError) as exc:
            print(f"configuration/source error: {exc}", file=sys.stderr)
            return 2
    if args.command == "verify":
        return _verify(args)
    if args.command == "verify-jinan":
        return _verify_jinan(args)
    if args.command == "export-candidates":
        return _export(args)
    if args.command == "export-jinan-candidates":
        return _export_jinan(args)
    if args.command == "review-retry":
        store = Store(args.data_dir)
        try:
            store.review_retry(args.attempt, args.reason)
        except (RuntimeError, ValueError, KeyError, OSError) as exc:
            print(f"review denied: {exc}", file=sys.stderr)
            return 2
        _json({"status": "reviewed_for_manual_retry", "attempt_id": args.attempt})
        return 0
    if args.command == "review-reverify":
        store = Store(args.data_dir)
        try:
            store.review_reverify(args.attempt, args.reason)
        except (RuntimeError, ValueError, KeyError, OSError) as exc:
            print(f"reverification denied: {exc}", file=sys.stderr)
            return 2
        _json({"status": "approved_for_offline_reverification", "attempt_id": args.attempt})
        return 0
    raise AssertionError(args.command)
