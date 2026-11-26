"""Private, offline import of the user's QCC advanced-search XLSX exports.

These are registration-subject observations, never training-institution or
license records. Nothing here reads the network or publishes to the website.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sqlite3
import sys
import uuid
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from zipfile import BadZipFile

from filelock import FileLock, Timeout
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException


DEFAULT_SOURCE_DIR = Path(__file__).resolve().parents[3] / "教育"
DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "var"
EXPECTED_HEADERS = (
    "企业名称", "登记状态", "法定代表人", "注册资本", "成立日期",
    "统一社会信用代码", "注册地址", "注册地址邮编", "所属省份",
    "所属城市", "所属区县", "有效手机号", "更多电话", "邮箱",
    "企业(机构)类型", "纳税人识别号", "注册号", "组织机构代码",
    "参保人数", "参保人数所属年报", "营业期限", "国标行业门类",
    "国标行业大类", "国标行业中类", "国标行业小类",
    "企查查行业门类", "企查查行业大类", "企查查行业中类",
    "企查查行业小类", "企业规模", "曾用名", "英文名",
    "官网网址", "通信地址", "通信地址邮编", "企业简介", "经营范围",
)
MAX_SEARCH_LIMIT = 100


class ImportStopped(RuntimeError):
    """An input or audit check failed; the current file must not complete."""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json(value: dict[str, Any]) -> None:
    print(json.dumps(value, ensure_ascii=False, sort_keys=True))


def _positive_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be a positive integer") from exc
    if number < 1:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return number


def _limited_search_int(value: str) -> int:
    number = _positive_int(value)
    if number > MAX_SEARCH_LIMIT:
        raise argparse.ArgumentTypeError(f"limit cannot exceed {MAX_SEARCH_LIMIT}")
    return number


def _nonnegative_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be a nonnegative integer") from exc
    if number < 0:
        raise argparse.ArgumentTypeError("must be a nonnegative integer")
    return number


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m edu_collector.qcc_import",
        description="OFFLINE private QCC registration-subject candidate import; never publishes data",
    )
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("inspect", "import", "search"):
        command = commands.add_parser(name, help=f"offline {name}; no website requests")
        command.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
        command.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
        if name == "import":
            command.add_argument("--max-files", type=_positive_int, required=True,
                                 help="maximum newly attempted files in this run")
            command.add_argument("--max-rows", type=_positive_int, required=True,
                                 help="maximum newly accepted observations in this run")
        elif name == "search":
            query = command.add_mutually_exclusive_group(required=True)
            query.add_argument("--name", help="literal substring of registration-subject name")
            query.add_argument("--uscc", help="exact unified social credit code, if present")
            command.add_argument("--limit", type=_limited_search_int, required=True)
            command.add_argument("--offset", type=_nonnegative_int, default=0)
    return parser


def _files(source_dir: Path) -> list[Path]:
    if not source_dir.is_dir():
        raise ImportStopped(f"source directory does not exist: {source_dir}")
    return sorted(
        (path for path in source_dir.iterdir()
         if path.is_file() and path.suffix.lower() == ".xlsx" and not path.name.startswith("~$")),
        key=lambda path: path.name.casefold(),
    )


def _hash_file(path: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    return digest.hexdigest(), size


def _file_id(name: str, sha256: str) -> str:
    return hashlib.sha256(f"{name}\0{sha256}".encode("utf-8")).hexdigest()


def _export_snapshot_hint(filename: str) -> str | None:
    match = re.search(r"高级搜索.*?(20\d{6})", filename)
    return match.group(1) if match else None


def _value(value: Any) -> Any:
    """Represent Excel's typed values reversibly in raw JSON; preserve null."""
    if value is None or isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            return {"type": "float", "value": repr(value)}
        return value
    if isinstance(value, datetime):
        return {"type": "datetime", "value": value.isoformat()}
    if isinstance(value, date):
        return {"type": "date", "value": value.isoformat()}
    if isinstance(value, time):
        return {"type": "time", "value": value.isoformat()}
    if isinstance(value, timedelta):
        return {"type": "timedelta", "value": str(value.total_seconds())}
    raise ImportStopped(f"unsupported XLSX cell type: {type(value).__name__}")


def _parse_workbook(path: Path, consume: Callable[[str, int, dict[str, Any]], None]) -> tuple[str, int]:
    workbook = load_workbook(path, read_only=True, data_only=False)
    try:
        if len(workbook.sheetnames) != 1:
            raise ImportStopped("expected one QCC export worksheet")
        sheet = workbook[workbook.sheetnames[0]]
        # QCC's exports sometimes claim A1:A1 although many rows and columns exist.
        sheet.reset_dimensions()
        rows = sheet.iter_rows(values_only=True)
        declaration = next(rows, None)
        if declaration is None or "企查查" not in " ".join(str(v) for v in declaration if v is not None):
            raise ImportStopped("QCC declaration missing from first row")
        heading = next(rows, None)
        if heading is None:
            raise ImportStopped("QCC column headers missing from second row")
        actual_headers = list(heading)
        while actual_headers and actual_headers[-1] is None:
            actual_headers.pop()
        if tuple(actual_headers) != EXPECTED_HEADERS:
            raise ImportStopped("QCC 37-column second-row header mismatch")
        count = 0
        for row_index, row in enumerate(rows, start=3):
            if not any(value is not None for value in row):
                continue
            if any(value is not None for value in row[len(EXPECTED_HEADERS):]):
                raise ImportStopped(f"nonempty cell beyond 37 columns at Excel row {row_index}")
            padded = (*row[:len(EXPECTED_HEADERS)],) + (None,) * max(0, len(EXPECTED_HEADERS) - len(row))
            raw = {header: _value(value) for header, value in zip(EXPECTED_HEADERS, padded)}
            consume(sheet.title, row_index, raw)
            count += 1
        return sheet.title, count
    finally:
        workbook.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS qcc_files (
    file_id TEXT PRIMARY KEY, relative_path TEXT NOT NULL, sha256 TEXT NOT NULL, byte_size INTEGER NOT NULL,
    export_snapshot_hint TEXT, published_at TEXT, sheet_name TEXT NOT NULL, headers_json TEXT NOT NULL,
    started_at_utc TEXT NOT NULL, completed_at_utc TEXT NOT NULL, raw_rows INTEGER NOT NULL,
    imported_rows INTEGER NOT NULL, rows_sha256 TEXT NOT NULL, state TEXT NOT NULL CHECK(state='complete')
);
CREATE TABLE IF NOT EXISTS qcc_rows (
    observation_id TEXT PRIMARY KEY, file_id TEXT NOT NULL REFERENCES qcc_files(file_id),
    sheet_name TEXT NOT NULL, source_row INTEGER NOT NULL, raw_json TEXT NOT NULL,
    name TEXT, uscc TEXT, registry_status TEXT, entity_type TEXT, registered_address TEXT,
    province TEXT, city TEXT, district TEXT, UNIQUE(file_id,sheet_name,source_row)
);
CREATE INDEX IF NOT EXISTS qcc_rows_name ON qcc_rows(name);
CREATE INDEX IF NOT EXISTS qcc_rows_uscc ON qcc_rows(uscc);
CREATE TABLE IF NOT EXISTS qcc_events (
    event_id TEXT PRIMARY KEY, at_utc TEXT NOT NULL, event_type TEXT NOT NULL,
    file_id TEXT, relative_path TEXT, detail TEXT NOT NULL
);
"""


def _open_db(path: Path) -> sqlite3.Connection:
    db = sqlite3.connect(path, timeout=20)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript(SCHEMA)
    return db


def _read_db(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise ImportStopped("private QCC database does not exist; import first")
    db = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    return db


def _event(db: sqlite3.Connection, event_type: str, file_id: str | None, name: str | None, detail: str) -> None:
    with db:
        db.execute(
            "INSERT INTO qcc_events VALUES (?,?,?,?,?,?)",
            (uuid.uuid4().hex, _utc_now(), event_type, file_id, name, detail[:500]),
        )


def _search_text(raw: dict[str, Any], key: str) -> str | None:
    value = raw[key]
    if not isinstance(value, (str, int, float)):
        return None
    text = str(value)
    # This export uses a literal hyphen for absent USCC/district cells. Keep
    # the raw cell in raw_json; normalize only the searchable projection.
    return None if text.strip() in {"", "-"} else text


def _insert_observation(db: sqlite3.Connection, file_id: str, sheet_name: str, row_index: int, raw: dict[str, Any]) -> tuple[str, str]:
    observation_id = f"{file_id}:{sheet_name}:{row_index}"
    raw_json = json.dumps(raw, ensure_ascii=False, separators=(",", ":"))
    db.execute(
        "INSERT INTO qcc_rows VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (observation_id, file_id, sheet_name, row_index, raw_json,
         _search_text(raw, "企业名称"), _search_text(raw, "统一社会信用代码"),
         _search_text(raw, "登记状态"), _search_text(raw, "企业(机构)类型"),
         _search_text(raw, "注册地址"), _search_text(raw, "所属省份"),
         _search_text(raw, "所属城市"), _search_text(raw, "所属区县")),
    )
    return observation_id, raw_json


def _rows_digest(db: sqlite3.Connection, file_id: str) -> tuple[str, int]:
    digest = hashlib.sha256()
    count = 0
    for row in db.execute(
        "SELECT * FROM qcc_rows WHERE file_id=? ORDER BY sheet_name,source_row", (file_id,),
    ):
        if row["observation_id"] != f"{file_id}:{row['sheet_name']}:{row['source_row']}":
            raise ImportStopped("source row identity differs from stored observation")
        try:
            raw = json.loads(row["raw_json"])
        except (TypeError, json.JSONDecodeError) as exc:
            raise ImportStopped("raw row JSON unreadable; SHA-256 receipt invalid") from exc
        if not isinstance(raw, dict) or list(raw) != list(EXPECTED_HEADERS):
            raise ImportStopped("raw source fields incomplete; SHA-256 receipt invalid")
        for column, raw_field in (
            ("name", "企业名称"), ("uscc", "统一社会信用代码"),
            ("registry_status", "登记状态"), ("entity_type", "企业(机构)类型"),
            ("registered_address", "注册地址"), ("province", "所属省份"),
            ("city", "所属城市"), ("district", "所属区县"),
        ):
            if row[column] != _search_text(raw, raw_field):
                raise ImportStopped(f"{column} search projection differs from raw source field")
        digest.update(f"{row['observation_id']}\0{row['raw_json']}\n".encode("utf-8"))
        count += 1
    return digest.hexdigest(), count


def _receipt_payload(file: sqlite3.Row) -> dict[str, Any]:
    return {
        "state": "complete", "kind": "registration_subject_candidate",
        "source": "企查查高级搜索 XLSX 导出", "file_id": file["file_id"],
        "relative_path": file["relative_path"], "source_sha256": file["sha256"],
        "byte_size": file["byte_size"], "sheet_name": file["sheet_name"],
        "headers": json.loads(file["headers_json"]),
        "export_snapshot_hint_from_filename": file["export_snapshot_hint"],
        "published_at": None, "started_at_utc": file["started_at_utc"],
        "completed_at_utc": file["completed_at_utc"],
        "raw_rows": file["raw_rows"], "imported_rows": file["imported_rows"],
        "rows_sha256": file["rows_sha256"], "publishable": False,
    }


def _receipt_path(data_dir: Path, file_id: str) -> Path:
    return data_dir / "qcc_receipts" / f"{file_id}.json"


def _write_receipt(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    with path.open("xb") as output:
        output.write(data)
        output.flush()
        os.fsync(output.fileno())


def _validate_complete(
    db: sqlite3.Connection, data_dir: Path, file: sqlite3.Row, *,
    repair_missing: bool, rebuild_event: bool = True,
) -> None:
    if file["state"] != "complete" or json.loads(file["headers_json"]) != list(EXPECTED_HEADERS):
        raise ImportStopped("completed file state or headers invalid")
    digest, count = _rows_digest(db, file["file_id"])
    if count != file["raw_rows"] or count != file["imported_rows"] or digest != file["rows_sha256"]:
        raise ImportStopped("database row count or SHA-256 differs from completed file")
    receipt = _receipt_path(data_dir, file["file_id"])
    expected = _receipt_payload(file)
    if not receipt.exists():
        if not repair_missing:
            raise ImportStopped("complete database file has no receipt")
        _write_receipt(receipt, expected)
        if rebuild_event:
            _event(db, "receipt_rebuilt_after_interruption", file["file_id"], file["relative_path"], "verified complete database rows")
        return
    try:
        actual = json.loads(receipt.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ImportStopped("completed receipt unreadable") from exc
    if actual != expected:
        raise ImportStopped("completed receipt differs from database and cannot be overwritten")


def _import_file(
    db: sqlite3.Connection, path: Path, data_dir: Path, remaining_rows: int,
    sha256: str, byte_size: int,
) -> tuple[str, int]:
    file_id = _file_id(path.name, sha256)
    prior = db.execute("SELECT * FROM qcc_files WHERE file_id=?", (file_id,)).fetchone()
    if prior is not None:
        if prior["relative_path"] != path.name or prior["sha256"] != sha256 or prior["byte_size"] != byte_size:
            raise ImportStopped("stored file identity differs from source")
        try:
            _validate_complete(db, data_dir, prior, repair_missing=True)
        except (ImportStopped, OSError, sqlite3.Error) as exc:
            _event(db, "verification_failed", file_id, path.name, f"{type(exc).__name__}: {exc}")
            raise
        return "skipped_verified_receipt", 0
    started = _utc_now()
    row_digest = hashlib.sha256()
    rows = 0
    try:
        with db:
            db.execute("BEGIN IMMEDIATE")
            # Insert parent before streaming children; the entire file rolls back together.
            db.execute(
                "INSERT INTO qcc_files VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (file_id, path.name, sha256, byte_size, _export_snapshot_hint(path.name), None,
                 "", json.dumps(EXPECTED_HEADERS, ensure_ascii=False), started, started, 0, 0, "", "complete"),
            )

            def consume(sheet_name: str, row_index: int, raw: dict[str, Any]) -> None:
                nonlocal rows
                if rows >= remaining_rows:
                    raise ImportStopped(f"max-rows budget exhausted before Excel row {row_index}; file rolled back")
                observation_id, raw_json = _insert_observation(db, file_id, sheet_name, row_index, raw)
                row_digest.update(f"{observation_id}\0{raw_json}\n".encode("utf-8"))
                rows += 1

            sheet_name, parsed_rows = _parse_workbook(path, consume)
            if parsed_rows != rows:
                raise ImportStopped("parsed row count and stored observation count differ")
            final_sha, final_size = _hash_file(path)
            if final_sha != sha256 or final_size != byte_size:
                raise ImportStopped("source XLSX changed during import; file rolled back")
            db.execute(
                "UPDATE qcc_files SET sheet_name=?,completed_at_utc=?,raw_rows=?,imported_rows=?,rows_sha256=? WHERE file_id=?",
                (sheet_name, _utc_now(), rows, rows, row_digest.hexdigest(), file_id),
            )
    except Exception as exc:
        # The transaction context rolls back all rows; the separate event survives.
        _event(db, "import_failed", file_id, path.name, f"{type(exc).__name__}: {exc}")
        raise
    completed = db.execute("SELECT * FROM qcc_files WHERE file_id=?", (file_id,)).fetchone()
    try:
        _validate_complete(db, data_dir, completed, repair_missing=True, rebuild_event=False)
    except (ImportStopped, OSError, sqlite3.Error) as exc:
        _event(db, "receipt_failed", file_id, path.name, f"{type(exc).__name__}: {exc}")
        raise
    _event(db, "import_complete", file_id, path.name, f"rows={rows}")
    return "imported", rows


def _inspect(args: argparse.Namespace) -> int:
    files = _files(args.source_dir)
    db_path = args.data_dir / "qcc.sqlite3"
    db = _read_db(db_path) if db_path.is_file() else None
    statuses = []
    try:
        for path in files:
            sha256, _ = _hash_file(path)
            file_id = _file_id(path.name, sha256)
            row = db.execute("SELECT * FROM qcc_files WHERE file_id=?", (file_id,)).fetchone() if db else None
            state = "pending"
            count = None
            if row is not None:
                try:
                    _validate_complete(db, args.data_dir, row, repair_missing=False)
                    state = "complete"
                except (ImportStopped, OSError):
                    state = "needs_review"
                count = row["raw_rows"]
            statuses.append({"file": path.name, "sha256": sha256, "status": state, "raw_rows": count})
        _json({
            "kind": "登记主体候选", "private": True, "network_requests": 0,
            "source_files": len(files), "completed_files": sum(x["status"] == "complete" for x in statuses),
            "pending_files": sum(x["status"] == "pending" for x in statuses),
            "needs_review_files": sum(x["status"] == "needs_review" for x in statuses),
            "known_raw_rows": sum(x["raw_rows"] or 0 for x in statuses),
            "files": statuses,
        })
        return 0
    finally:
        if db is not None:
            db.close()


def _import(args: argparse.Namespace) -> int:
    files = _files(args.source_dir)
    args.data_dir.mkdir(parents=True, exist_ok=True)
    lock = FileLock(str(args.data_dir / "qcc_import.lock"), timeout=0)
    try:
        with lock.acquire(timeout=0):
            db = _open_db(args.data_dir / "qcc.sqlite3")
            try:
                imported = attempted = skipped = 0
                for path in files:
                    # Completed files do not consume a new-file budget.
                    sha256, byte_size = _hash_file(path)
                    prior = db.execute("SELECT 1 FROM qcc_files WHERE file_id=?", (_file_id(path.name, sha256),)).fetchone()
                    if prior is None and attempted >= args.max_files:
                        continue
                    if prior is None:
                        attempted += 1
                    try:
                        state, count = _import_file(db, path, args.data_dir, args.max_rows - imported, sha256, byte_size)
                    except (ImportStopped, OSError, BadZipFile, InvalidFileException, sqlite3.Error, RuntimeError, ValueError) as exc:
                        print(f"QCC import stopped at {path.name}: {type(exc).__name__}: {exc}", file=sys.stderr)
                        return 2
                    imported += count
                    skipped += state == "skipped_verified_receipt"
                _json({
                    "kind": "登记主体候选", "private": True, "network_requests": 0,
                    "source_files": len(files), "attempted_files": attempted,
                    "completed_files": attempted, "skipped_files": skipped,
                    "pending_files": max(0, len(files) - attempted - skipped),
                    "imported_rows": imported, "database": str(args.data_dir / "qcc.sqlite3"),
                    "receipt_dir": str(args.data_dir / "qcc_receipts"),
                    "published_at": None,
                })
                return 0
            finally:
                db.close()
    except Timeout:
        print("QCC import lock is held by another process; no database write attempted", file=sys.stderr)
        return 2


def _search(args: argparse.Namespace) -> int:
    if args.name is not None and not args.name.strip() or args.uscc is not None and not args.uscc.strip():
        raise ImportStopped("search query cannot be blank")
    db = _read_db(args.data_dir / "qcc.sqlite3")
    try:
        where, value = ("instr(r.name, ?) > 0", args.name.strip()) if args.name is not None else ("r.uscc = ?", args.uscc.strip())
        total = db.execute(f"SELECT COUNT(*) FROM qcc_rows r WHERE {where}", (value,)).fetchone()[0]
        data = [
            {
                "kind": "登记主体候选", "observation_id": row["observation_id"],
                "name": row["name"], "uscc": row["uscc"],
                "registry_status_at_export": row["registry_status"],
                "entity_type": row["entity_type"],
                "registered_address": row["registered_address"],
                "province": row["province"], "city": row["city"], "district": row["district"],
                "source": "企查查高级搜索 XLSX 导出",
                "source_file": row["relative_path"], "source_sheet": row["sheet_name"],
                "source_excel_row": row["source_row"],
                "export_snapshot_hint_from_filename": row["export_snapshot_hint"],
                "published_at": None, "imported_at_utc": row["completed_at_utc"],
                "official_training_license_verified": None, "publishable": False,
            }
            for row in db.execute(
                f"SELECT r.*,f.relative_path,f.export_snapshot_hint,f.completed_at_utc FROM qcc_rows r JOIN qcc_files f USING(file_id) WHERE {where} ORDER BY r.name,r.observation_id LIMIT ? OFFSET ?",
                (value, args.limit, args.offset),
            )
        ]
        _json({"kind": "登记主体候选", "private": True, "network_requests": 0,
               "total_observations": total, "limit": args.limit, "offset": args.offset, "data": data})
        return 0
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "inspect":
            return _inspect(args)
        if args.command == "import":
            return _import(args)
        if args.command == "search":
            return _search(args)
    except (ImportStopped, OSError, sqlite3.Error) as exc:
        print(f"QCC {args.command} stopped: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2
    raise AssertionError(args.command)


if __name__ == "__main__":
    raise SystemExit(main())
