"""Offline contract tests for QCC's private XLSX observations."""

from __future__ import annotations

import json
import multiprocessing
import re
import sqlite3
from datetime import date
from pathlib import Path
from zipfile import ZipFile

from filelock import FileLock
from openpyxl import Workbook


HEADERS = [
    "企业名称", "登记状态", "法定代表人", "注册资本", "成立日期",
    "统一社会信用代码", "注册地址", "注册地址邮编", "所属省份",
    "所属城市", "所属区县", "有效手机号", "更多电话", "邮箱",
    "企业(机构)类型", "纳税人识别号", "注册号", "组织机构代码",
    "参保人数", "参保人数所属年报", "营业期限", "国标行业门类",
    "国标行业大类", "国标行业中类", "国标行业小类",
    "企查查行业门类", "企查查行业大类", "企查查行业中类",
    "企查查行业小类", "企业规模", "曾用名", "英文名",
    "官网网址", "通信地址", "通信地址邮编", "企业简介", "经营范围",
]


def make_file(folder: Path, filename: str, records: list[dict], *, bad_header=False) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    book = Workbook()
    sheet = book.active
    sheet.title = "企查查导出"
    sheet.append(["声明：本数据仅供参考。不得向第三方出售。企查查"])
    headers = HEADERS.copy()
    if bad_header:
        headers[0] = "学校名称"
    sheet.append(headers)
    for record in records:
        sheet.append([record.get(column) for column in HEADERS])
    path = folder / filename
    book.save(path)
    book.close()
    return path


def forge_dimension(path: Path) -> None:
    rewrite = path.with_suffix(".rewrite")
    with ZipFile(path) as source, ZipFile(rewrite, "w") as target:
        for member in source.infolist():
            contents = source.read(member.filename)
            if member.filename == "xl/worksheets/sheet1.xml":
                contents = re.sub(rb'<dimension ref="[^"]+"', b'<dimension ref="A1:A1"', contents, count=1)
            target.writestr(member, contents)
    rewrite.replace(path)


def hold_process_lock(lock_path: str, ready, release) -> None:
    with FileLock(lock_path, timeout=5):
        ready.set()
        release.wait(10)


def invoke(command: str, source: Path, data: Path, *args: str) -> int:
    from edu_collector.qcc_import import main

    return main([command, "--source-dir", str(source), "--data-dir", str(data), *args])


def test_inspect_is_read_only_and_ignores_excel_lock_file(tmp_path, capsys):
    source = tmp_path / "input"
    source.mkdir()
    (source / "~$open.xlsx").write_bytes(b"temporary")
    data = tmp_path / "private"
    assert invoke("inspect", source, data) == 0
    assert json.loads(capsys.readouterr().out)["source_files"] == 0
    assert not data.exists()


def test_tagged_export_filename_preserves_snapshot_hint(tmp_path, capsys):
    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "【企查查】高级搜索“培训”20261122(001).xlsx",
              [{"企业名称": "样本培训主体"}])
    assert invoke("import", source, data, "--max-files", "1", "--max-rows", "1") == 0
    capsys.readouterr()
    with sqlite3.connect(data / "qcc.sqlite3") as db:
        assert db.execute("SELECT export_snapshot_hint FROM qcc_files").fetchone()[0] == "20261122"


def test_import_preserves_all_fields_types_nulls_and_false_dimensions(tmp_path, capsys):
    source, data = tmp_path / "input", tmp_path / "private"
    file = make_file(source, "batch.xlsx", [
        {"企业名称": "样本教育咨询有限公司", "登记状态": "存续",
         "成立日期": date(2020, 1, 2), "统一社会信用代码": "91350000123456789X",
         "注册地址": "甲路 1 号", "参保人数": 0, "企业简介": "原文不清洗",
         "经营范围": "教育咨询"},
        {"企业名称": "样本民办培训中心", "统一社会信用代码": None,
         "企业(机构)类型": "民办非企业单位"},
    ])
    forge_dimension(file)
    assert invoke("import", source, data, "--max-files", "1", "--max-rows", "2") == 0
    summary = json.loads(capsys.readouterr().out)
    assert summary["imported_rows"] == 2
    assert summary["completed_files"] == 1
    with sqlite3.connect(data / "qcc.sqlite3") as db:
        rows = db.execute("SELECT source_row, raw_json, uscc, entity_type FROM qcc_rows ORDER BY source_row").fetchall()
        assert len(rows) == 2
        assert [row[0] for row in rows] == [3, 4]
        raw = json.loads(rows[0][1])
        assert list(raw) == HEADERS
        assert raw["参保人数"] == 0
        assert raw["邮箱"] is None
        assert raw["成立日期"] == {"type": "datetime", "value": "2020-01-02T00:00:00"}
        assert raw["企业简介"] == "原文不清洗"
        assert rows[1][2] is None
        assert rows[1][3] == "民办非企业单位"


        file_id, digest, count = db.execute("SELECT file_id, sha256, raw_rows FROM qcc_files").fetchone()
        assert count == 2
        assert len(digest) == 64
        assert (data / "qcc_receipts" / f"{file_id}.json").is_file()
        receipt = json.loads((data / "qcc_receipts" / f"{file_id}.json").read_text(encoding="utf-8"))
        assert receipt["published_at"] is None
        assert receipt["publishable"] is False
    assert invoke("search", source, data, "--name", "样本", "--limit", "5") == 0
    search = json.loads(capsys.readouterr().out)
    assert len(search["data"]) == 2
    assert all(item["kind"] == "登记主体候选" for item in search["data"])
    assert all(item["official_training_license_verified"] is None for item in search["data"])
    assert "有效手机号" not in json.dumps(search, ensure_ascii=False)


def test_export_dash_placeholder_is_null_only_in_search_projection(tmp_path, capsys):
    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "dash.xlsx", [{"企业名称": "样本个体培训店", "统一社会信用代码": "-", "所属区县": "-"}])
    assert invoke("import", source, data, "--max-files", "1", "--max-rows", "1") == 0
    capsys.readouterr()
    with sqlite3.connect(data / "qcc.sqlite3") as db:
        uscc, district, raw_json = db.execute("SELECT uscc,district,raw_json FROM qcc_rows").fetchone()
    assert uscc is None and district is None
    raw = json.loads(raw_json)
    assert raw["统一社会信用代码"] == "-"
    assert raw["所属区县"] == "-"
def test_cross_file_duplicate_names_are_distinct_and_complete_receipt_skips(tmp_path, capsys):
    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "a.xlsx", [{"企业名称": "同名机构", "统一社会信用代码": "A"}])
    make_file(source, "b.xlsx", [{"企业名称": "同名机构", "统一社会信用代码": "B"}])
    args = ("--max-files", "2", "--max-rows", "2")
    assert invoke("import", source, data, *args) == 0
    capsys.readouterr()
    assert invoke("import", source, data, *args) == 0
    assert json.loads(capsys.readouterr().out)["imported_rows"] == 0
    with sqlite3.connect(data / "qcc.sqlite3") as db:
        assert db.execute("SELECT COUNT(*),COUNT(DISTINCT observation_id) FROM qcc_rows").fetchone() == (2, 2)
    assert invoke("search", source, data, "--uscc", "B", "--limit", "1") == 0
    assert json.loads(capsys.readouterr().out)["data"][0]["uscc"] == "B"


def test_new_file_budget_advances_after_verified_skip(tmp_path, capsys):
    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "a.xlsx", [{"企业名称": "甲"}])
    make_file(source, "b.xlsx", [{"企业名称": "乙"}])
    args = ("--max-files", "1", "--max-rows", "1")
    assert invoke("import", source, data, *args) == 0
    assert json.loads(capsys.readouterr().out)["pending_files"] == 1
    assert invoke("import", source, data, *args) == 0
    assert json.loads(capsys.readouterr().out)["imported_rows"] == 1
    with sqlite3.connect(data / "qcc.sqlite3") as db:
        assert db.execute("SELECT COUNT(*) FROM qcc_files").fetchone()[0] == 2


def test_missing_receipt_after_commit_is_rebuilt_only_from_valid_rows(tmp_path, capsys):
    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "a.xlsx", [{"企业名称": "甲"}])
    args = ("--max-files", "1", "--max-rows", "1")
    assert invoke("import", source, data, *args) == 0
    capsys.readouterr()
    receipt = next((data / "qcc_receipts").glob("*.json"))
    receipt.unlink()
    assert invoke("import", source, data, *args) == 0
    assert json.loads(capsys.readouterr().out)["imported_rows"] == 0
    assert receipt.is_file()
    with sqlite3.connect(data / "qcc.sqlite3") as db:
        assert db.execute("SELECT COUNT(*) FROM qcc_rows").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM qcc_events WHERE event_type='receipt_rebuilt_after_interruption'").fetchone()[0] == 1


def test_changed_source_creates_new_observations_without_overwriting_history(tmp_path, capsys):
    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "a.xlsx", [{"企业名称": "甲"}])
    args = ("--max-files", "1", "--max-rows", "1")
    assert invoke("import", source, data, *args) == 0
    capsys.readouterr()
    make_file(source, "a.xlsx", [{"企业名称": "乙"}])
    assert invoke("import", source, data, *args) == 0
    with sqlite3.connect(data / "qcc.sqlite3") as db:
        assert db.execute("SELECT COUNT(*),COUNT(DISTINCT file_id) FROM qcc_rows").fetchone() == (2, 2)


def test_corrupted_database_observation_cannot_be_skipped(tmp_path, capsys):
    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "a.xlsx", [{"企业名称": "甲"}])
    args = ("--max-files", "1", "--max-rows", "1")
    assert invoke("import", source, data, *args) == 0
    capsys.readouterr()
    with sqlite3.connect(data / "qcc.sqlite3") as db:
        db.execute("UPDATE qcc_rows SET raw_json='{}'")
    assert invoke("import", source, data, *args) == 2
    assert "SHA-256" in capsys.readouterr().err


def test_changed_search_projection_cannot_pass_receipt_check(tmp_path, capsys):
    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "a.xlsx", [{"企业名称": "甲"}])
    args = ("--max-files", "1", "--max-rows", "1")
    assert invoke("import", source, data, *args) == 0
    capsys.readouterr()
    with sqlite3.connect(data / "qcc.sqlite3") as db:
        db.execute("UPDATE qcc_rows SET name='不是甲'")
    assert invoke("import", source, data, *args) == 2
    assert "projection" in capsys.readouterr().err


def test_row_budget_rolls_back_whole_file_and_retry_is_audited(tmp_path, capsys):
    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "a.xlsx", [{"企业名称": "甲"}, {"企业名称": "乙"}])
    assert invoke("import", source, data, "--max-files", "1", "--max-rows", "1") == 2
    capsys.readouterr()
    with sqlite3.connect(data / "qcc.sqlite3") as db:
        assert db.execute("SELECT COUNT(*) FROM qcc_rows").fetchone()[0] == 0
        assert db.execute("SELECT event_type FROM qcc_events").fetchone()[0] == "import_failed"
    assert invoke("import", source, data, "--max-files", "1", "--max-rows", "2") == 0
    assert json.loads(capsys.readouterr().out)["imported_rows"] == 2


def test_invalid_header_and_corrupt_workbook_never_complete(tmp_path, capsys):
    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "bad.xlsx", [{"企业名称": "甲"}], bad_header=True)
    assert invoke("import", source, data, "--max-files", "1", "--max-rows", "5") == 2
    capsys.readouterr()
    with sqlite3.connect(data / "qcc.sqlite3") as db:
        assert db.execute("SELECT COUNT(*) FROM qcc_files").fetchone()[0] == 0
    (source / "bad.xlsx").write_bytes(b"broken zip")
    assert invoke("import", source, data, "--max-files", "1", "--max-rows", "5") == 2
    with sqlite3.connect(data / "qcc.sqlite3") as db:
        assert db.execute("SELECT COUNT(*) FROM qcc_files").fetchone()[0] == 0


def test_invalid_receipt_blocks_automatic_skip_or_overwrite(tmp_path, capsys):
    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "a.xlsx", [{"企业名称": "甲"}])
    assert invoke("import", source, data, "--max-files", "1", "--max-rows", "1") == 0
    capsys.readouterr()
    receipt = next((data / "qcc_receipts").glob("*.json"))
    receipt.write_text("{}", encoding="utf-8")
    assert invoke("import", source, data, "--max-files", "1", "--max-rows", "1") == 2
    assert receipt.read_text(encoding="utf-8") == "{}"


def test_file_lock_prevents_parallel_import(tmp_path):
    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "a.xlsx", [{"企业名称": "甲"}])
    data.mkdir()
    with FileLock(str(data / "qcc_import.lock"), timeout=0):
        assert invoke("import", source, data, "--max-files", "1", "--max-rows", "1") == 2
    assert not (data / "qcc.sqlite3").exists()


def test_other_process_cannot_import_while_lock_is_held(tmp_path):
    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "a.xlsx", [{"企业名称": "甲"}])
    data.mkdir()
    context = multiprocessing.get_context("spawn")
    ready, release = context.Event(), context.Event()
    process = context.Process(target=hold_process_lock, args=(str(data / "qcc_import.lock"), ready, release))
    process.start()
    try:
        assert ready.wait(10)
        assert invoke("import", source, data, "--max-files", "1", "--max-rows", "1") == 2
        assert not (data / "qcc.sqlite3").exists()
    finally:
        release.set()
        process.join(10)
        if process.is_alive():
            process.terminate()
            process.join(10)


def test_interruption_rolls_back_and_later_run_recovers(tmp_path, monkeypatch, capsys):
    from edu_collector import qcc_import

    source, data = tmp_path / "input", tmp_path / "private"
    make_file(source, "a.xlsx", [{"企业名称": "甲"}, {"企业名称": "乙"}])
    original = qcc_import._insert_observation
    calls = 0

    def interrupt(*args, **kwargs):
        nonlocal calls
        calls += 1
        original(*args, **kwargs)
        if calls == 1:
            raise RuntimeError("simulated crash")

    monkeypatch.setattr(qcc_import, "_insert_observation", interrupt)
    assert invoke("import", source, data, "--max-files", "1", "--max-rows", "2") == 2
    capsys.readouterr()
    with sqlite3.connect(data / "qcc.sqlite3") as db:
        assert db.execute("SELECT COUNT(*) FROM qcc_rows").fetchone()[0] == 0
    monkeypatch.setattr(qcc_import, "_insert_observation", original)
    assert invoke("import", source, data, "--max-files", "1", "--max-rows", "2") == 0
    assert json.loads(capsys.readouterr().out)["imported_rows"] == 2
