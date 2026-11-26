"""Private offline review links between verified official rows and QCC rows.

An exact name creates only a candidate association. It never merges entities or
asserts that a registration subject owns a campus or a valid training license.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Callable, Iterable, Mapping

from . import qcc_import
from .receipts import _check_sidecar
from .sources import jinan, longyan
from .store import utc_now


class MatchStopped(RuntimeError):
    """A receipt, source identity, or hard output budget failed verification."""


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _record_sha256(record: Mapping[str, Any]) -> str:
    raw = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return _sha256(raw.encode("utf-8"))


def _link(receipt: Mapping[str, Any], record: Mapping[str, Any], row: Mapping[str, Any]) -> dict[str, Any]:
    source_id = receipt["source_id"]
    if source_id not in {longyan.SOURCE_ID, jinan.SOURCE_ID}:
        raise MatchStopped(f"unsupported official source: {source_id}")
    return {
        "status": "pending", "publishable": False,
        "match_rule": "exact_raw_name", "review_required": True,
        "official": {
            "source_id": source_id,
            "source_record_id": record["source_record_id"],
            "source_url": receipt["source_url"],
            "source_document_sha256": receipt["raw_sha256"],
            "source_record_sha256": _record_sha256(record),
            "published_at": receipt["published_at"],
            "as_of": receipt.get("as_of"),
            "collected_at_utc": receipt["collected_at_utc"],
            "institution_name_raw": record["institution_name"],
            "source_sheet": record.get("sheet") if source_id == longyan.SOURCE_ID else None,
            "source_row": record.get("row") if source_id == longyan.SOURCE_ID else record.get("table_row"),
            "license_number_raw": record.get("license_number") if source_id == jinan.SOURCE_ID else None,
            "listed_training_content_raw": record.get("permitted_scope") if source_id == jinan.SOURCE_ID else None,
        },
        "qcc": {
            "source_id": "qcc-advanced-search-export",
            "source_record_id": row["observation_id"],
            "source_file": row["relative_path"],
            "source_sheet": row["sheet_name"],
            "source_row": row["source_row"],
            "source_document_sha256": row["sha256"],
            "source_record_sha256": _sha256(row["raw_json"].encode("utf-8")),
            "published_at": row["published_at"],
            "export_snapshot_hint_from_filename": row["export_snapshot_hint"],
            "imported_at_utc": row["completed_at_utc"],
            "name_raw": row["name"],
            "uscc_raw": row["uscc"],
            "entity_type_raw": row["entity_type"],
            "registry_status_raw": row["registry_status"],
        },
    }


def build_links(
    receipts: Iterable[Mapping[str, Any]],
    lookup_qcc: Callable[[str], Iterable[Mapping[str, Any]]],
    *, max_links: int,
) -> list[dict[str, Any]]:
    """Preserve each exact source-row pair, stopping before output truncation."""
    if isinstance(max_links, bool) or not isinstance(max_links, int) or max_links < 1:
        raise ValueError("max-links must be a positive integer")
    links: list[dict[str, Any]] = []
    for receipt in receipts:
        for record in receipt["records"]:
            name = record.get("institution_name")
            if not isinstance(name, str) or not name:
                continue
            for row in lookup_qcc(name):
                # No punctuation, whitespace, legal-suffix, or license normalization.
                if row["name"] != name:
                    continue
                if len(links) >= max_links:
                    raise MatchStopped(f"max-links budget exceeded: more than {max_links} exact-name pairs")
                links.append(_link(receipt, record, row))
    return links


def _verified_qcc_files(db: sqlite3.Connection, source_dirs: Iterable[Path], data_dir: Path) -> list[dict[str, Any]]:
    sources: dict[str, tuple[Path, str, int]] = {}
    for source_dir in source_dirs:
        for path in qcc_import._files(source_dir):
            sha256, byte_size = qcc_import._hash_file(path)
            file_id = qcc_import._file_id(path.name, sha256)
            sources.setdefault(file_id, (path, sha256, byte_size))
    if not sources:
        raise MatchStopped("no QCC XLSX files found")
    stored = {row["file_id"]: row for row in db.execute("SELECT * FROM qcc_files")}
    if set(stored) != set(sources):
        raise MatchStopped("QCC import incomplete: supplied source directories do not match complete database files")
    checked: list[dict[str, Any]] = []
    for file_id, (path, sha256, byte_size) in sorted(sources.items()):
        file = stored.get(file_id)
        if file is None or file["relative_path"] != path.name or file["byte_size"] != byte_size:
            raise MatchStopped(f"QCC source has no matching complete import: {path.name}")
        # repair_missing=False leaves the source database and receipts untouched.
        qcc_import._validate_complete(db, data_dir, file, repair_missing=False)
        receipt_path = data_dir / "qcc_receipts" / f"{file_id}.json"
        checked.append({
            "file_id": file_id, "source_file": path.name,
            "source_dir": str(path.parent.resolve()),
            "source_sha256": sha256, "rows": file["raw_rows"],
            "receipt_sha256": _sha256(receipt_path.read_bytes()),
        })
    return checked


def _verified_official_receipt(
    ledger: sqlite3.Connection, data_dir: Path, module: Any,
) -> tuple[dict[str, Any], dict[str, Any]]:
    row = ledger.execute(
        "SELECT a.*,r.source_id,r.state AS run_state,r.max_ids "
        "FROM attempts a JOIN runs r ON r.run_id=a.run_id "
        "WHERE r.source_id=? AND a.purpose='list' "
        "ORDER BY a.started_at_utc DESC,a.attempt_id DESC LIMIT 1",
        (module.SOURCE_ID,),
    ).fetchone()
    if row is None:
        raise MatchStopped(f"no captured list for {module.SOURCE_ID}")
    attempt = dict(row)
    if (attempt["url"] != module.SOURCE_URL or attempt["state"] != "captured"
            or attempt["business_status"] != "verified" or attempt["run_state"] != "verified"
            or attempt["http_status"] != 200):
        raise MatchStopped(f"latest {module.SOURCE_ID} list is not verified")
    raw = _check_sidecar(SimpleNamespace(root=data_dir), attempt)
    records = module.parse_xlsx(raw) if module.SOURCE_ID == longyan.SOURCE_ID else module.parse_html(raw)
    distinct_ids = len({record["source_record_id"] for record in records})
    if distinct_ids > attempt["max_ids"]:
        raise MatchStopped(f"{module.SOURCE_ID} source row count exceeds original run budget")
    expected: dict[str, Any] = {
        "state": "complete", "attempt_id": attempt["attempt_id"],
        "source_id": module.SOURCE_ID, "source_url": module.SOURCE_URL,
        "published_at": module.PUBLISHED_AT,
        "collected_at_utc": attempt["ended_at_utc"],
        "raw_sha256": attempt["sha256"],
        "row_count": len(records), "distinct_source_ids": distinct_ids,
        "records": records,
    }
    if module.SOURCE_ID == jinan.SOURCE_ID:
        license_counts: dict[str, int] = {}
        for record in records:
            number = record.get("license_number")
            if number:
                license_counts[str(number)] = license_counts.get(str(number), 0) + 1
        expected.update({
            "as_of": jinan.AS_OF,
            "license_number_present_rows": sum(bool(record.get("license_number")) for record in records),
            "duplicate_license_numbers": sorted(number for number, count in license_counts.items() if count > 1),
        })
    receipt_path = data_dir / "receipts" / f"{attempt['attempt_id']}.json"
    try:
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise MatchStopped(f"{module.SOURCE_ID} complete receipt is missing or unreadable") from exc
    if receipt != expected:
        raise MatchStopped(f"{module.SOURCE_ID} receipt differs from raw document and request ledger")
    return receipt, {
        "source_id": module.SOURCE_ID,
        "attempt_id": attempt["attempt_id"],
        "source_document_sha256": attempt["sha256"],
        "receipt_sha256": _sha256(receipt_path.read_bytes()),
        "rows": len(records),
    }


def export_links(source_dir: Path | Iterable[Path], data_dir: Path, *, max_links: int) -> tuple[Path, Path, int]:
    """Verify both source systems offline, then write an immutable private queue."""
    if isinstance(max_links, bool) or not isinstance(max_links, int) or max_links < 1:
        raise ValueError("max-links must be a positive integer")
    qcc_db = qcc_import._read_db(data_dir / "qcc.sqlite3")
    try:
        source_dirs = (source_dir,) if isinstance(source_dir, Path) else source_dir
        qcc_receipts = _verified_qcc_files(qcc_db, source_dirs, data_dir)
        ledger_path = data_dir / "ledger.sqlite3"
        if not ledger_path.is_file():
            raise MatchStopped("official request ledger does not exist")
        ledger = sqlite3.connect(f"{ledger_path.resolve().as_uri()}?mode=ro", uri=True)
        ledger.row_factory = sqlite3.Row
        try:
            official_checked = [_verified_official_receipt(ledger, data_dir, module)
                                for module in (longyan, jinan)]
        finally:
            ledger.close()
        official_receipts = [receipt for receipt, _ in official_checked]

        def lookup(name: str) -> Iterable[Mapping[str, Any]]:
            return qcc_db.execute(
                "SELECT r.observation_id,r.name,r.uscc,r.registry_status,r.entity_type,"
                "r.source_row,r.sheet_name,r.raw_json,f.file_id,f.sha256,f.relative_path,"
                "f.export_snapshot_hint,f.published_at,f.completed_at_utc "
                "FROM qcc_rows r JOIN qcc_files f ON f.file_id=r.file_id "
                "WHERE r.name=? ORDER BY r.observation_id",
                (name,),
            )

        links = build_links(official_receipts, lookup, max_links=max_links)
    finally:
        qcc_db.close()

    payload = "".join(json.dumps(link, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
                      for link in links).encode("utf-8")
    output_dir = data_dir / "matches"
    output_dir.mkdir(parents=True, exist_ok=True)
    batch_id = uuid.uuid4().hex
    jsonl_path = output_dir / f"pending-exact-name-{batch_id}.jsonl"
    manifest_path = output_dir / f"pending-exact-name-{batch_id}.json"
    manifest = {
        "state": "complete", "kind": "pending_exact_name_associations",
        "created_at_utc": utc_now(), "network_requests": 0,
        "match_rule": "exact_raw_name", "status": "pending", "publishable": False,
        "max_links": max_links, "links": len(links),
        "jsonl_file": jsonl_path.name, "links_sha256": _sha256(payload),
        "qcc_receipts": qcc_receipts,
        "source_receipts": [summary for _, summary in official_checked],
    }
    with jsonl_path.open("xb") as output:
        output.write(payload)
        output.flush()
        os.fsync(output.fileno())
    with manifest_path.open("xb") as output:
        output.write(json.dumps(manifest, ensure_ascii=False, sort_keys=True,
                                separators=(",", ":")).encode("utf-8"))
        output.flush()
        os.fsync(output.fileno())
    return jsonl_path, manifest_path, len(links)


def _positive_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("max-links must be a positive integer") from exc
    if number < 1:
        raise argparse.ArgumentTypeError("max-links must be a positive integer")
    return number


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m edu_collector.match_candidates",
        description="OFFLINE private exact-name review links; no network or public output",
    )
    parser.add_argument("--source-dir", type=Path, action="append", dest="source_dirs",
                        help="repeat for every QCC export directory; defaults to both project export folders")
    parser.add_argument("--data-dir", type=Path, default=qcc_import.DEFAULT_DATA_DIR)
    parser.add_argument("--max-links", type=_positive_int, required=True)
    args = parser.parse_args(argv)
    try:
        source_dirs = args.source_dirs or [qcc_import.DEFAULT_SOURCE_DIR,
                                         qcc_import.DEFAULT_SOURCE_DIR.parent / "docs" / "research"]
        jsonl_path, manifest_path, count = export_links(source_dirs, args.data_dir,
                                                        max_links=args.max_links)
    except (MatchStopped, qcc_import.ImportStopped, ValueError, OSError, sqlite3.Error) as exc:
        print(f"Offline match stopped: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2
    print(json.dumps({"kind": "待核关联候选", "private": True, "network_requests": 0,
                      "links": count, "jsonl_file": jsonl_path.name,
                      "manifest_file": manifest_path.name, "publishable": False},
                     ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
