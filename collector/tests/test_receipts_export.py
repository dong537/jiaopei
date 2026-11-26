"""Offline receipt and private candidate tests using local XLSX bytes only."""

import hashlib
import json
from io import BytesIO

import pytest
from openpyxl import Workbook

from edu_collector.export import export_candidates
from edu_collector.receipts import latest_valid_receipt, verify_list
from edu_collector.sources.longyan import SOURCE_ID, SOURCE_URL
from edu_collector.store import Store


def xlsx_bytes(rows=None):
    book = Workbook()
    sheet = book.active
    sheet.title = "白名单"
    sheet.append(["龙岩市非学科类校外培训机构白名单"])
    sheet.append(["县（市、区）", "机构名称", "培训地址", "培训类别", "未识别列"])
    for row in rows if rows is not None else [
        ["新罗区", "同名艺术培训", "一号路", "艺术", None],
        ["新罗区", "同名艺术培训", "二号路", "体育", "原值"],
    ]:
        sheet.append(row)
    data = BytesIO()
    book.save(data)
    return data.getvalue()


def captured_attempt(tmp_path, *, body=None, url=SOURCE_URL, status=200, purpose="list", source_id=SOURCE_ID):
    store = Store(tmp_path)
    run_id = store.new_run(source_id, "jyj.longyan.gov.cn", max_pages=1, max_ids=5, max_requests=1)
    attempt_id = store.begin_attempt(run_id, purpose, url)
    store.record_http(attempt_id, status, {"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}, body if body is not None else xlsx_bytes(), 12.5)
    return store, attempt_id


def test_complete_receipt_covers_every_source_row_and_is_rechecked(tmp_path):
    store, attempt_id = captured_attempt(tmp_path)
    receipt = verify_list(store, attempt_id)
    receipt_path = store.root / "receipts" / f"{attempt_id}.json"
    assert receipt_path.exists()
    assert receipt["state"] == "complete"
    assert receipt["source_id"] == SOURCE_ID
    assert receipt["published_at"] == "2026-04-09"
    assert receipt["collected_at_utc"] == store.get_attempt(attempt_id)["ended_at_utc"]
    assert receipt["row_count"] == receipt["distinct_source_ids"] == 2
    assert len(receipt["records"]) == 2
    assert receipt["records"][0]["institution_name"] == receipt["records"][1]["institution_name"]
    assert receipt["raw_sha256"] == hashlib.sha256(store.raw_bytes(attempt_id)).hexdigest()
    before = receipt_path.read_bytes()
    assert verify_list(store, attempt_id) == receipt
    assert receipt_path.read_bytes() == before
    assert store.get_attempt(attempt_id)["business_status"] == "verified"


def test_corrected_offline_parser_can_revalidate_preserved_http_200_raw(tmp_path):
    store, attempt_id = captured_attempt(tmp_path)
    store.set_attempt_state(attempt_id, "blocked", "identity_mismatch", "earlier parser rejected formatting")
    assert latest_valid_receipt(store, SOURCE_ID) is None
    with pytest.raises(ValueError, match="review"):
        verify_list(store, attempt_id)
    assert store.get_attempt(attempt_id)["business_status"] == "identity_mismatch"
    store.review_reverify(attempt_id, "inspected raw XLSX and corrected formatting parser")
    receipt = verify_list(store, attempt_id)
    assert receipt["row_count"] == 2
    assert store.get_attempt(attempt_id)["business_status"] == "verified"
    assert store.get_run(store.get_attempt(attempt_id)["run_id"])["state"] == "verified"
    with store._db() as db:
        events = db.execute("SELECT event_type FROM events WHERE attempt_id=?", (attempt_id,)).fetchall()
    assert "offline_revalidated_after_block" in [row[0] for row in events]


def test_empty_table_is_blocked_without_fake_complete_receipt(tmp_path):
    store, attempt_id = captured_attempt(tmp_path, body=xlsx_bytes([]))
    with pytest.raises(ValueError):
        verify_list(store, attempt_id)
    assert store.get_attempt(attempt_id)["state"] == "blocked"
    assert not (store.root / "receipts" / f"{attempt_id}.json").exists()


@pytest.mark.parametrize(
    "kwargs,expected_status",
    [
        ({"url": "https://jyj.longyan.gov.cn/wrong.xlsx"}, "identity_mismatch"),
        ({"purpose": "detail"}, "identity_mismatch"),
        ({"source_id": "some-other-source"}, "identity_mismatch"),
        ({"status": 403}, "receipt_error"),
        ({"body": b"not xlsx"}, "identity_mismatch"),
    ],
)
def test_wrong_identity_status_or_file_blocks_without_complete_receipt(tmp_path, kwargs, expected_status):
    store, attempt_id = captured_attempt(tmp_path, **kwargs)
    with pytest.raises(ValueError):
        verify_list(store, attempt_id)
    assert not (store.root / "receipts" / f"{attempt_id}.json").exists()
    attempt = store.get_attempt(attempt_id)
    assert attempt["state"] == "blocked"
    assert attempt["business_status"] == expected_status


def test_tampered_raw_or_sidecar_invalidates_previous_receipt(tmp_path):
    store, attempt_id = captured_attempt(tmp_path)
    verify_list(store, attempt_id)
    raw_path = store.root / store.get_attempt(attempt_id)["raw_path"]
    raw_path.write_bytes(raw_path.read_bytes() + b"tampered")
    with pytest.raises(ValueError, match="hash|SHA|raw"):
        verify_list(store, attempt_id)
    assert store.get_attempt(attempt_id)["state"] == "blocked"

    other_store, other_id = captured_attempt(tmp_path / "other")
    verify_list(other_store, other_id)
    sidecar = (other_store.root / other_store.get_attempt(other_id)["raw_path"]).with_suffix(".json")
    data = json.loads(sidecar.read_text(encoding="utf-8"))
    data["url"] = "https://wrong.example/x.xlsx"
    sidecar.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError, match="sidecar"):
        verify_list(other_store, other_id)
    assert other_store.get_attempt(other_id)["state"] == "blocked"


def test_sidecar_request_timing_must_match_ledger(tmp_path):
    store, attempt_id = captured_attempt(tmp_path)
    sidecar = (store.root / store.get_attempt(attempt_id)["raw_path"]).with_suffix(".json")
    data = json.loads(sidecar.read_text(encoding="utf-8"))
    data["duration_ms"] = 999999
    sidecar.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError, match="sidecar"):
        verify_list(store, attempt_id)
    assert store.get_attempt(attempt_id)["state"] == "blocked"


def test_corrupt_raw_path_is_a_receipt_error_not_a_source_identity_error(tmp_path):
    store, attempt_id = captured_attempt(tmp_path)
    with store._db() as db:
        db.execute("UPDATE attempts SET raw_path=? WHERE attempt_id=?", ("raw/wrong.bin", attempt_id))
    with pytest.raises(ValueError, match="raw path"):
        verify_list(store, attempt_id)
    assert store.get_attempt(attempt_id)["business_status"] == "receipt_error"


def test_existing_receipt_cannot_be_silently_replaced(tmp_path):
    store, attempt_id = captured_attempt(tmp_path)
    verify_list(store, attempt_id)
    path = store.root / "receipts" / f"{attempt_id}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["row_count"] = 999
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError, match="receipt"):
        verify_list(store, attempt_id)
    assert json.loads(path.read_text(encoding="utf-8"))["row_count"] == 999
    assert store.get_attempt(attempt_id)["state"] == "blocked"


def test_latest_valid_requires_existing_receipt_and_never_treats_list_as_detail(tmp_path):
    store, attempt_id = captured_attempt(tmp_path)
    assert latest_valid_receipt(store, SOURCE_ID) is None
    receipt = verify_list(store, attempt_id)
    assert latest_valid_receipt(store, SOURCE_ID) == (attempt_id, receipt)
    assert latest_valid_receipt(store, "vocational-training") is None
    assert receipt["records"][0]["source_record_id"]
    assert store.get_attempt(attempt_id)["purpose"] == "list"


def test_newer_incomplete_attempt_prevents_skipping_older_receipt(tmp_path):
    store, old_id = captured_attempt(tmp_path)
    verify_list(store, old_id)
    run_id = store.new_run(SOURCE_ID, "jyj.longyan.gov.cn", max_pages=1, max_ids=5, max_requests=1)
    new_id = store.begin_attempt(run_id, "list", SOURCE_URL)
    store.record_http(new_id, 200, {}, b"damaged XLSX", 2.0)
    assert latest_valid_receipt(store, SOURCE_ID) is None
    with pytest.raises(ValueError):
        verify_list(store, new_id)
    assert latest_valid_receipt(store, SOURCE_ID) is None


def test_source_id_budget_rejects_complete_file_above_limit(tmp_path):
    store, attempt_id = captured_attempt(tmp_path)
    with store._db() as db:
        db.execute("UPDATE runs SET max_ids=1 WHERE run_id=?", (store.get_attempt(attempt_id)["run_id"],))
    with pytest.raises(ValueError, match="max-ids"):
        verify_list(store, attempt_id)
    assert store.get_attempt(attempt_id)["state"] == "blocked"
    assert store.raw_bytes(attempt_id)
    assert not (store.root / "receipts" / f"{attempt_id}.json").exists()


def test_export_is_private_bounded_and_preserves_field_evidence_and_nulls(tmp_path):
    store, attempt_id = captured_attempt(tmp_path)
    receipt = verify_list(store, attempt_id)
    path, summary = export_candidates(store, attempt_id, max_ids=1)
    assert path.parent == store.root / "exports"
    assert path.exists() and path.suffix == ".jsonl"
    assert summary["exported_count"] == 1
    assert summary["receipt_row_count"] == 2
    assert receipt["row_count"] == 2
    (candidate,) = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
    assert candidate["institution_name"] == "同名艺术培训"
    assert candidate["institution_category"] == "非学科校外培训"
    assert candidate["campus_name"] is None
    assert candidate["license"] is None
    assert candidate["course"] is None
    assert candidate["contact"] is None
    assert candidate["supervisory_authority"] is None
    assert candidate["source_url"] == SOURCE_URL
    assert candidate["published_at"] == "2026-04-09"
    assert candidate["collected_at_utc"] == store.get_attempt(attempt_id)["ended_at_utc"]
    assert candidate["raw_fields"]["未识别列"] is None
    assert candidate["publishable"] is False
    assert candidate["field_evidence"]["institution_name"]["raw_value"] == "同名艺术培训"
    assert candidate["field_evidence"]["institution_name"]["source_record_id"] == candidate["source_record_id"]
    assert candidate["field_evidence"]["institution_name"]["verification_status"] == "official_list_observation"
    assert candidate["field_evidence"]["institution_category"]["raw_value"] is None
    assert candidate["field_evidence"]["institution_category"]["verification_status"] == "source_document_classification"
    assert candidate["field_evidence"]["license"]["verification_status"] == "not_provided"
    second_path, second_summary = export_candidates(store, attempt_id, max_ids=5)
    assert second_path != path
    assert second_summary["exported_count"] == 2
    assert len(second_path.read_text(encoding="utf-8").splitlines()) == 2


def test_export_requires_complete_rechecked_receipt_and_positive_limit(tmp_path):
    store, attempt_id = captured_attempt(tmp_path)
    with pytest.raises(ValueError, match="receipt"):
        export_candidates(store, attempt_id, max_ids=1)
    verify_list(store, attempt_id)
    with pytest.raises(ValueError, match="max_ids"):
        export_candidates(store, attempt_id, max_ids=0)
    raw_path = store.root / store.get_attempt(attempt_id)["raw_path"]
    raw_path.write_bytes(b"broken")
    with pytest.raises(ValueError):
        export_candidates(store, attempt_id, max_ids=1)
    assert not list((store.root / "exports").glob("*.jsonl"))
