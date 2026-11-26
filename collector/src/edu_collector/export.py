"""Private candidate projection from a verified official-list receipt."""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any

from .receipts import verify_list, verify_jinan_list
from .sources import longyan, jinan
from .store import Store


_RAW_HEADERS = {
    "institution_name": ("机构名称", "培训机构名称", "校外培训机构名称"),
    "address": ("地址", "培训地址", "办学地址"),
    "region": ("县（市、区）", "县市区", "县区", "辖区"),
    "training_category": ("培训类别", "培训类型"),
}
_OBSERVED_FIELDS = ("institution_name", "institution_category", "address", "region", "training_category")
_ABSENT_FIELDS = ("campus_name", "license", "supervisory_authority", "course", "contact")


def _raw_header(record: dict[str, Any], field: str) -> str | None:
    return next((name for name in _RAW_HEADERS.get(field, ()) if name in record["raw_fields"]), None)


def _field_evidence(record: dict[str, Any], field: str, value: object, collected_at_utc: str) -> dict[str, Any]:
    if field == "institution_category":
        return {
            "raw_value": None,
            "raw_field": None,
            "source_url": longyan.SOURCE_URL,
            "published_at": longyan.PUBLISHED_AT,
            "collected_at_utc": collected_at_utc,
            "source_record_id": record["source_record_id"],
            "applies_to": "official_listing_row",
            "verification_status": "source_document_classification",
        }
    present = field in _OBSERVED_FIELDS and value is not None
    return {
        "raw_value": value if present else None,
        "raw_field": _raw_header(record, field),
        "source_url": longyan.SOURCE_URL,
        "published_at": longyan.PUBLISHED_AT,
        "collected_at_utc": collected_at_utc,
        "source_record_id": record["source_record_id"],
        "applies_to": "official_listing_row",
        "verification_status": "official_list_observation" if present else "not_provided",
    }


def _candidate(record: dict[str, Any], collected_at_utc: str) -> dict[str, Any]:
    candidate: dict[str, Any] = {
        "institution_name": record["institution_name"],
        "institution_category": "非学科校外培训",
        "campus_name": None,
        "address": record["address"],
        "region": record["region"],
        "training_category": record["training_category"],
        "license": None,
        "supervisory_authority": None,
        "course": None,
        "contact": None,
        "source_url": longyan.SOURCE_URL,
        "published_at": longyan.PUBLISHED_AT,
        "collected_at_utc": collected_at_utc,
        "source_record_id": record["source_record_id"],
        "source_id": longyan.SOURCE_ID,
        "raw_cells": record["raw_cells"],
        "raw_fields": record["raw_fields"],
        "publishable": False,
    }
    candidate["field_evidence"] = {
        field: _field_evidence(record, field, candidate[field], collected_at_utc)
        for field in (*_OBSERVED_FIELDS, *_ABSENT_FIELDS)
    }
    return candidate


def export_candidates(store: Store, attempt_id: str, max_ids: int) -> tuple[Path, dict[str, int]]:
    """Write a new private JSONL from a pre-existing, revalidated receipt."""
    if isinstance(max_ids, bool) or not isinstance(max_ids, int) or max_ids < 1:
        raise ValueError("max_ids must be a positive integer")
    if not (store.root / "receipts" / f"{attempt_id}.json").is_file():
        raise ValueError("complete receipt required before export")
    receipt = verify_list(store, attempt_id)
    collected_at_utc = store.get_attempt(attempt_id)["ended_at_utc"]
    selected: list[dict[str, Any]] = []
    seen: set[str] = set()
    for record in receipt["records"]:
        record_id = record["source_record_id"]
        if record_id in seen:
            continue
        if len(seen) >= max_ids:
            break
        seen.add(record_id)
        selected.append(_candidate(record, collected_at_utc))
    payload = "".join(json.dumps(item, ensure_ascii=False, sort_keys=True) + "\n" for item in selected).encode("utf-8")
    path = store.root / "exports" / f"candidates-{attempt_id}-{uuid.uuid4().hex}.jsonl"
    with path.open("xb") as output:
        output.write(payload)
        output.flush()
        os.fsync(output.fileno())
    return path, {
        "exported_count": len(selected),
        "receipt_row_count": receipt["row_count"],
        "distinct_source_ids": receipt["distinct_source_ids"],
    }


def export_jinan_candidates(store: Store, attempt_id: str, max_ids: int) -> tuple[Path, dict[str, int]]:
    """Export bounded private list observations; neither license nor audience is re-certified."""
    if isinstance(max_ids, bool) or not isinstance(max_ids, int) or max_ids < 1:
        raise ValueError("max_ids must be a positive integer")
    if not (store.root / "receipts" / f"{attempt_id}.json").is_file():
        raise ValueError("complete Jinan receipt required before export")
    receipt = verify_jinan_list(store, attempt_id)
    duplicates = set(receipt["duplicate_license_numbers"])
    observed = {
        "institution_name": ("机构名称", "institution_name"),
        "district": ("区县", "district"),
        "address": ("地址", "address"),
        "listed_training_content": ("办学内容", "permitted_scope"),
        "license_number": ("办学许可证号", "license_number"),
    }
    absent = ("institution_category", "campus_name", "legal_entity_name", "course",
              "contact", "license_issue_date", "supervisory_authority")
    selected: list[dict[str, Any]] = []
    seen: set[str] = set()
    for record in receipt["records"]:
        record_id = record["source_record_id"]
        if record_id in seen:
            continue
        if len(seen) >= max_ids:
            break
        seen.add(record_id)
        candidate: dict[str, Any] = {
            **{field: record.get(record_key) for field, (_, record_key) in observed.items()},
            **{field: None for field in absent},
            "source_record_id": record_id, "source_id": jinan.SOURCE_ID,
            "source_url": jinan.SOURCE_URL, "source_publisher": "高新区教育文体部",
            "published_at": jinan.PUBLISHED_AT, "as_of": jinan.AS_OF,
            "collected_at_utc": receipt["collected_at_utc"],
            "raw_fields": record["raw_fields"],
            "license_number_duplicate_in_source": str(record.get("license_number")) in duplicates,
            "category_review_required": True,
            "publishable": False,
        }
        candidate["field_evidence"] = {
            field: {
                "raw_value": candidate[field], "raw_field": raw_field,
                "source_url": jinan.SOURCE_URL, "source_record_id": record_id,
                "published_at": jinan.PUBLISHED_AT, "as_of": jinan.AS_OF,
                "collected_at_utc": receipt["collected_at_utc"],
                "applies_to": "official_listing_row",
                "verification_status": "official_list_observation" if candidate[field] is not None else "not_provided",
            }
            for field, (raw_field, _) in observed.items()
        }
        candidate["field_evidence"].update({
            field: {
                "raw_value": None, "raw_field": None, "source_url": jinan.SOURCE_URL,
                "source_record_id": record_id, "published_at": jinan.PUBLISHED_AT,
                "as_of": jinan.AS_OF, "collected_at_utc": receipt["collected_at_utc"],
                "applies_to": "official_listing_row", "verification_status": "not_provided",
            }
            for field in absent
        })
        selected.append(candidate)
    path = store.root / "exports" / f"jinan-candidates-{attempt_id}-{uuid.uuid4().hex}.jsonl"
    payload = "".join(json.dumps(item, ensure_ascii=False, sort_keys=True) + "\n" for item in selected).encode("utf-8")
    with path.open("xb") as output:
        output.write(payload)
        output.flush()
        os.fsync(output.fileno())
    return path, {"exported_count": len(selected), "receipt_row_count": receipt["row_count"],
                  "distinct_source_ids": receipt["distinct_source_ids"]}
