"""Offline exact-name association tests; no real website requests."""

from __future__ import annotations

import json
import hashlib
from html import escape
from io import BytesIO

from openpyxl import Workbook

import pytest

from edu_collector import qcc_import
from edu_collector.receipts import verify_jinan_list, verify_list
from edu_collector.sources import jinan, longyan
from edu_collector.store import Store


def qcc_row(name: str | None, observation: str, *, entity_type: str | None = None):
    return {
        "observation_id": observation,
        "name": name,
        "uscc": None,
        "registry_status": "存续",
        "entity_type": entity_type,
        "source_row": 3,
        "sheet_name": "企查查导出",
        "raw_json": json.dumps({"企业名称": name, "有效手机号": "13900000000"}, ensure_ascii=False),
        "file_id": "qcc-file",
        "sha256": "a" * 64,
        "relative_path": "a.xlsx",
        "export_snapshot_hint": "20261120",
        "published_at": None,
        "completed_at_utc": "2026-11-21T00:00:00+00:00",
    }


def official_receipt(source_id: str, names: list[str | None]):
    records = [
        {
            "source_record_id": f"{source_id}:row:{number}",
            "source_id": source_id,
            "institution_name": name,
            "row": number if source_id == longyan.SOURCE_ID else None,
            "sheet": "白名单" if source_id == longyan.SOURCE_ID else None,
            "table_row": number if source_id == jinan.SOURCE_ID else None,
            "license_number": "LIC-SAME" if source_id == jinan.SOURCE_ID else None,
            "permitted_scope": "艺术培训" if source_id == jinan.SOURCE_ID else None,
        }
        for number, name in enumerate(names, 3)
    ]
    return {
        "source_id": source_id,
        "source_url": longyan.SOURCE_URL if source_id == longyan.SOURCE_ID else jinan.SOURCE_URL,
        "published_at": "2026-04-09" if source_id == longyan.SOURCE_ID else "2026-10-30",
        "as_of": None if source_id == longyan.SOURCE_ID else "2026-10-29",
        "collected_at_utc": "2026-11-21T00:01:00+00:00",
        "raw_sha256": "b" * 64,
        "attempt_id": f"attempt-{source_id}",
        "records": records,
    }


def test_exact_name_only_produces_pending_pairs_and_preserves_duplicates():
    from edu_collector.match_candidates import build_links

    qcc = [qcc_row("同名培训中心", "qcc:3", entity_type="有限责任公司"),
           qcc_row("同名培训中心", "qcc:4", entity_type="个体工商户")]
    receipts = [official_receipt(jinan.SOURCE_ID, ["同名培训中心", "同名培训中心", "同名培训中心 ", None])]
    links = build_links(receipts, lambda name: [row for row in qcc if row["name"] == name], max_links=4)
    assert len(links) == 4
    assert len({(item["official"]["source_record_id"], item["qcc"]["source_record_id"]) for item in links}) == 4
    assert all(item["status"] == "pending" and item["publishable"] is False for item in links)
    assert all(item["official"]["license_number_raw"] == "LIC-SAME" for item in links)
    assert all(item["official"]["listed_training_content_raw"] == "艺术培训" for item in links)
    assert {item["qcc"]["entity_type_raw"] for item in links} == {"有限责任公司", "个体工商户"}
    assert "13900000000" not in json.dumps(links, ensure_ascii=False)


def test_no_match_and_null_fields_remain_empty_without_inference():
    from edu_collector.match_candidates import build_links

    receipt = official_receipt(longyan.SOURCE_ID, ["甲培训", "乙培训"])
    links = build_links([receipt], lambda name: [qcc_row("甲培训", "qcc:3")] if name == "甲培训" else [], max_links=2)
    assert len(links) == 1
    assert links[0]["official"]["license_number_raw"] is None
    assert links[0]["official"]["listed_training_content_raw"] is None
    assert links[0]["qcc"]["uscc_raw"] is None
    assert links[0]["qcc"]["published_at"] is None
    assert links[0]["official"]["source_record_sha256"]


def test_max_links_rejects_overflow_instead_of_silently_truncating():
    from edu_collector.match_candidates import MatchStopped, build_links

    rows = [qcc_row("甲培训", "qcc:3"), qcc_row("甲培训", "qcc:4")]
    receipt = official_receipt(longyan.SOURCE_ID, ["甲培训"])
    with pytest.raises(MatchStopped, match="max-links"):
        build_links([receipt], lambda name: rows, max_links=1)
    with pytest.raises(ValueError, match="max-links"):
        build_links([receipt], lambda name: rows, max_links=0)


def _make_qcc_file(source_dir, filename="a.xlsx"):
    source_dir.mkdir()
    book = Workbook()
    sheet = book.active
    sheet.title = "企查查导出"
    sheet.append(["声明：本数据仅供参考，企查查"])
    sheet.append(list(qcc_import.EXPECTED_HEADERS))
    for uscc in ("91350000123456789X", "91350000123456789Y"):
        raw = {"企业名称": "同名培训中心", "统一社会信用代码": uscc,
               "企业(机构)类型": "有限责任公司", "有效手机号": "13900000000"}
        sheet.append([raw.get(header) for header in qcc_import.EXPECTED_HEADERS])
    path = source_dir / filename
    book.save(path)
    book.close()


def _longyan_bytes():
    book = Workbook()
    sheet = book.active
    sheet.title = "白名单"
    sheet.append(["龙岩市非学科类校外培训机构白名单"])
    sheet.append(["县（市、区）", "机构名称", "培训地址", "培训类别"])
    sheet.append(["新罗区", "同名培训中心", "一号路", "艺术"])
    output = BytesIO()
    book.save(output)
    book.close()
    return output.getvalue()


def _jinan_bytes():
    def row(values):
        return "<tr>" + "".join(f"<td>{escape(str(value))}</td>" for value in values) + "</tr>"

    rows = [row([number, "高新区", "同名培训中心" if number == 1 else f"其他机构{number}",
                 f"地址{number}", "艺术培训", "LIC-SAME" if number in (1, 2) else f"LIC-{number}"])
            for number in range(1, jinan.EXPECTED_ROWS + 1)]
    title = escape(jinan.TITLE, quote=True)
    return (f"<!doctype html><html><head><title>{escape(jinan.TITLE)}</title>"
            f"<meta name='ArticleTitle' content='{title}'>"
            "<meta name='PubDate' content='2026-10-30 17:11'>"
            "</head><body><table><tr><td>首页</td></tr></table>"
            f"<table><tr><td>发布机构:</td><td>{jinan.PUBLISHING_AGENCY}</td></tr></table>"
            f"<table>{row(jinan.HEADERS)}{''.join(rows)}</table></body></html>").encode("utf-8")


def _prepared_sources(tmp_path, capsys):
    source_dir, data_dir = tmp_path / "source", tmp_path / "private"
    _make_qcc_file(source_dir)
    assert qcc_import.main(["import", "--source-dir", str(source_dir), "--data-dir", str(data_dir),
                            "--max-files", "1", "--max-rows", "2"]) == 0
    capsys.readouterr()
    store = Store(data_dir)
    for module, body, verifier in ((longyan, _longyan_bytes(), verify_list),
                                   (jinan, _jinan_bytes(), verify_jinan_list)):
        run = store.new_run(module.SOURCE_ID, module.SOURCE_URL.split("/")[2],
                            max_pages=1, max_ids=150, max_requests=1)
        attempt = store.begin_attempt(run, "list", module.SOURCE_URL)
        store.record_http(attempt, 200, {}, body, 1.0)
        verifier(store, attempt)
    return source_dir, data_dir


def test_cli_exports_only_verified_private_links_with_hash_manifest(tmp_path, capsys):
    from edu_collector.match_candidates import main

    source_dir, data_dir = _prepared_sources(tmp_path, capsys)
    originals = {p: p.read_bytes() for p in [data_dir / "qcc.sqlite3", data_dir / "ledger.sqlite3",
                                             *sorted((data_dir / "qcc_receipts").glob("*.json")),
                                             *sorted((data_dir / "receipts").glob("*.json"))]}
    assert main(["--source-dir", str(source_dir), "--data-dir", str(data_dir), "--max-links", "4"]) == 0
    summary = json.loads(capsys.readouterr().out)
    assert summary["links"] == 4 and summary["network_requests"] == 0
    output = data_dir / "matches" / summary["jsonl_file"]
    manifest = data_dir / "matches" / summary["manifest_file"]
    links = [json.loads(line) for line in output.read_text(encoding="utf-8").splitlines()]
    check = json.loads(manifest.read_text(encoding="utf-8"))
    assert len(links) == 4
    assert check["links_sha256"] == hashlib.sha256(output.read_bytes()).hexdigest()
    assert len(check["source_receipts"]) == 2 and len(check["qcc_receipts"]) == 1
    assert all(link["status"] == "pending" and link["publishable"] is False for link in links)
    assert "13900000000" not in output.read_text(encoding="utf-8")
    assert all(p.read_bytes() == original for p, original in originals.items())


def test_cli_verifies_all_qcc_source_directories(tmp_path, capsys):
    from edu_collector.match_candidates import main

    first, data = _prepared_sources(tmp_path, capsys)
    second = tmp_path / "second-source"
    _make_qcc_file(second, "b.xlsx")
    assert qcc_import.main(["import", "--source-dir", str(second), "--data-dir", str(data),
                            "--max-files", "1", "--max-rows", "2"]) == 0
    capsys.readouterr()
    args = ["--source-dir", str(first), "--source-dir", str(second),
            "--data-dir", str(data), "--max-links", "8"]
    assert main(args) == 0
    summary = json.loads(capsys.readouterr().out)
    assert summary["links"] == 8
    manifest = json.loads((data / "matches" / summary["manifest_file"]).read_text(encoding="utf-8"))
    assert len(manifest["qcc_receipts"]) == 2
    assert {item["source_dir"] for item in manifest["qcc_receipts"]} == {str(first.resolve()), str(second.resolve())}
    assert main(["--source-dir", str(first), "--data-dir", str(data), "--max-links", "8"]) == 2
    assert "supplied source directories" in capsys.readouterr().err


def test_cli_blocks_budget_or_tampered_receipt_without_output(tmp_path, capsys):
    from edu_collector.match_candidates import main

    source_dir, data_dir = _prepared_sources(tmp_path, capsys)
    args = ["--source-dir", str(source_dir), "--data-dir", str(data_dir), "--max-links"]
    assert main([*args, "3"]) == 2
    assert "max-links" in capsys.readouterr().err
    assert not (data_dir / "matches").exists()
    receipt = next((data_dir / "qcc_receipts").glob("*.json"))
    receipt.write_text("{}", encoding="utf-8")
    assert main([*args, "4"]) == 2
    assert not (data_dir / "matches").exists()


def test_cli_rejects_changed_official_receipt_before_writing(tmp_path, capsys):
    from edu_collector.match_candidates import main

    source_dir, data_dir = _prepared_sources(tmp_path, capsys)
    receipt = next((data_dir / "receipts").glob("*.json"))
    changed = json.loads(receipt.read_text(encoding="utf-8"))
    changed["records"][0]["institution_name"] = "篡改名称"
    receipt.write_text(json.dumps(changed, ensure_ascii=False), encoding="utf-8")
    assert main(["--source-dir", str(source_dir), "--data-dir", str(data_dir), "--max-links", "4"]) == 2
    assert "receipt differs" in capsys.readouterr().err
    assert not (data_dir / "matches").exists()
