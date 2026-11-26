"""Offline end-to-end receipt and candidate tests for the Jinan source."""

import json
from html import escape

import pytest

from edu_collector.export import export_jinan_candidates
from edu_collector.receipts import latest_valid_jinan_receipt, verify_jinan_list
from edu_collector.sources import jinan
from edu_collector.store import Store


def html_page(*, duplicate=False, extra=False, same_name=False):
    headers = list(jinan.HEADERS) + (["备注"] if extra else [])
    def tr(cells):
        return "<tr>" + "".join(f"<td>{escape(str(value)) if value is not None else ''}</td>" for value in cells) + "</tr>"
    body = []
    for number in range(1, jinan.EXPECTED_ROWS + 1):
        license_number = "LIC-2" if duplicate and number in (2, 3) else f"LIC-{number}"
        name = "机构2" if same_name and number == 3 else f"机构{number}"
        row = [number, "高新区", name, f"地址{number}", "面向中小学生的艺术培训", license_number]
        if extra:
            row.append(None if number == 1 else "原文")
        body.append(tr(row))
    title = escape(jinan.TITLE, quote=True)
    return (
        f"<!doctype html><html><head><title>{escape(jinan.TITLE)}</title>"
        f"<meta name='ArticleTitle' content='{title}'>"
        "<meta name='PubDate' content='2026-10-30 17:11'>"
        "</head><body><table><tr><td>首页</td></tr></table>"
        f"<table><tr><td>发布机构:</td><td>{jinan.PUBLISHING_AGENCY}</td></tr></table>"
        f"<table>{tr(headers)}{''.join(body)}</table></body></html>"
    ).encode("utf-8")


def captured(tmp_path, *, body=None, status=200, max_ids=150):
    store = Store(tmp_path)
    run_id = store.new_run(jinan.SOURCE_ID, "innovation.jinan.gov.cn",
                           max_pages=1, max_ids=max_ids, max_requests=1)
    attempt_id = store.begin_attempt(run_id, "list", jinan.SOURCE_URL)
    store.record_http(attempt_id, status, {"Content-Type": "text/html; charset=utf-8"},
                      body if body is not None else html_page(), 3.0)
    return store, attempt_id


def test_jinan_receipt_preserves_all_rows_and_flags_duplicate_license(tmp_path):
    store, attempt_id = captured(tmp_path, body=html_page(duplicate=True, extra=True))
    receipt = verify_jinan_list(store, attempt_id)
    assert receipt["row_count"] == receipt["distinct_source_ids"] == jinan.EXPECTED_ROWS
    assert receipt["license_number_present_rows"] == jinan.EXPECTED_ROWS
    assert receipt["duplicate_license_numbers"] == ["LIC-2"]
    assert receipt["records"][0]["raw_fields"]["备注"] is None
    assert receipt["records"][1]["anomalies"] == ["duplicate_license_number"]
    assert latest_valid_jinan_receipt(store) == (attempt_id, receipt)
    path, summary = export_jinan_candidates(store, attempt_id, max_ids=3)
    assert summary["exported_count"] == 3
    data = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
    assert len(data) == 3 and all(item["publishable"] is False for item in data)
    assert data[0]["institution_category"] is None
    assert data[0]["course"] is None and data[0]["license_issue_date"] is None
    assert data[0]["listed_training_content"] == "面向中小学生的艺术培训"
    assert "permitted_scope" not in data[0]
    assert data[0]["field_evidence"]["listed_training_content"]["raw_field"] == "办学内容"
    assert data[0]["field_evidence"]["license_number"]["raw_field"] == "办学许可证号"
    assert data[1]["license_number_duplicate_in_source"] is True


def test_jinan_receipt_rejects_budget_and_wrong_http_without_faking_completion(tmp_path):
    store, attempt_id = captured(tmp_path / "budget", max_ids=100)
    with pytest.raises(ValueError, match="max-ids"):
        verify_jinan_list(store, attempt_id)
    assert store.get_attempt(attempt_id)["state"] == "blocked"
    assert not (store.root / "receipts" / f"{attempt_id}.json").exists()
    denied, denied_id = captured(tmp_path / "denied", status=403)
    with pytest.raises(ValueError):
        verify_jinan_list(denied, denied_id)
    assert denied.get_attempt(denied_id)["state"] == "blocked"


def test_duplicate_license_is_flagged_even_if_listed_names_match(tmp_path):
    store, attempt_id = captured(tmp_path, body=html_page(duplicate=True, same_name=True))
    receipt = verify_jinan_list(store, attempt_id)
    assert receipt["duplicate_license_numbers"] == ["LIC-2"]
    path, _ = export_jinan_candidates(store, attempt_id, max_ids=3)
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
    assert rows[1]["license_number_duplicate_in_source"] is True
    assert rows[2]["license_number_duplicate_in_source"] is True
