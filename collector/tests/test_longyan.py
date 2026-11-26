"""Offline contract tests for the Longyan official XLSX source."""

from io import BytesIO
from zipfile import ZipFile

import pytest
from openpyxl import Workbook
from openpyxl.styles import Font

from edu_collector.sources.longyan import (
    MAX_COLUMNS,
    MAX_ROWS,
    PUBLISHED_AT,
    SOURCE_ID,
    SOURCE_URL,
    list_url,
    parse_xlsx,
)


def workbook_bytes(rows, *, title="龙岩市非学科类校外培训机构白名单", sheet="非学科白名单"):
    book = Workbook()
    page = book.active
    page.title = sheet
    page.append([title])
    for row in rows:
        page.append(row)
    output = BytesIO()
    book.save(output)
    return output.getvalue()


HEADERS = ["县（市、区）", "机构名称", "培训地址", "培训类别", "备注", "未识别指标"]


def test_source_has_one_document_not_a_fabricated_pagination_api():
    assert SOURCE_ID == "longyan-2026-white-nonsubject"
    assert SOURCE_URL == "https://jyj.longyan.gov.cn/zwgk/gggs/202604/P020260413590906477838.xlsx"
    assert PUBLISHED_AT == "2026-04-09"
    assert list_url(1) == SOURCE_URL
    with pytest.raises(ValueError, match="page"):
        list_url(2)
    with pytest.raises(ValueError, match="page"):
        list_url(0)


def test_empty_data_table_cannot_receive_a_complete_list_receipt():
    with pytest.raises(ValueError, match="empty|空"):
        parse_xlsx(workbook_bytes([HEADERS]))


def test_duplicate_names_keep_distinct_source_rows_and_unknown_cells():
    raw = workbook_bytes(
        [
            HEADERS,
            ["新罗区", "甲艺术培训中心", "龙岩市一号", "艺术", None, 0],
            [None, None, None, None, None, None],
            ["新罗区", "甲艺术培训中心", "龙岩市二号", "艺术", "待复核", None],
        ]
    )
    records = parse_xlsx(raw)
    assert len(records) == 2
    assert [record["source_record_id"] for record in records] == [
        f"{SOURCE_ID}:非学科白名单:3",
        f"{SOURCE_ID}:非学科白名单:5",
    ]
    assert [record["row"] for record in records] == [3, 5]
    assert all(record["source_id"] == SOURCE_ID for record in records)
    assert all(record["sheet"] == "非学科白名单" for record in records)
    assert records[0]["raw_cells"] == ["新罗区", "甲艺术培训中心", "龙岩市一号", "艺术", None, 0]
    assert records[0]["raw_fields"]["未识别指标"] == 0
    assert records[0]["raw_fields"]["备注"] is None
    assert records[1]["raw_fields"]["未识别指标"] is None
    assert records[0]["institution_name"] == records[1]["institution_name"] == "甲艺术培训中心"
    assert records[1]["region"] == "新罗区"
    assert records[1]["address"] == "龙岩市二号"
    assert records[1]["training_category"] == "艺术"


def test_rejects_other_city_even_with_matching_column_headers():
    raw = workbook_bytes([HEADERS, ["鼓楼区", "乙培训", "福州某路", "体育"]], title="福州市非学科类校外培训机构白名单")
    with pytest.raises(ValueError, match="龙岩|identity"):
        parse_xlsx(raw)


def test_data_address_cannot_supply_missing_source_identity():
    raw = workbook_bytes(
        [HEADERS, ["鼓楼区", "乙培训", "龙岩市某路", "体育"]],
        title="福州市非学科类校外培训机构白名单",
    )
    with pytest.raises(ValueError, match="龙岩|identity"):
        parse_xlsx(raw)


@pytest.mark.parametrize(
    "raw",
    [
        b"not an XLSX",
        workbook_bytes([["县（市、区）", "机构名称", "经营地址", "培训类别"]]),
    ],
)
def test_rejects_corrupt_file_or_missing_required_header(raw):
    with pytest.raises(ValueError):
        parse_xlsx(raw)


def test_same_name_on_two_sheets_keeps_sheet_scoped_identity():
    book = Workbook()
    first = book.active
    first.title = "上杭县"
    first.append(["龙岩市非学科类校外培训机构白名单"])
    first.append(HEADERS)
    first.append(["上杭县", "甲培训", "上杭一号", "艺术"])
    second = book.create_sheet("新罗区")
    second.append(["龙岩市非学科类校外培训机构白名单"])
    second.append(HEADERS)
    second.append(["新罗区", "甲培训", "新罗一号", "艺术"])
    output = BytesIO()
    book.save(output)
    records = parse_xlsx(output.getvalue())
    assert [record["source_record_id"] for record in records] == [
        f"{SOURCE_ID}:上杭县:3",
        f"{SOURCE_ID}:新罗区:3",
    ]


def test_rejects_abnormal_worksheet_width_before_materializing_rows():
    book = Workbook()
    sheet = book.active
    sheet.append(["龙岩市非学科类校外培训机构白名单"])
    sheet.append(HEADERS)
    sheet.append(["新罗区", "甲培训", "一号路", "艺术"])
    sheet.cell(row=3, column=MAX_COLUMNS + 1, value="异常远列")
    output = BytesIO()
    book.save(output)
    with pytest.raises(ValueError, match="column|列"):
        parse_xlsx(output.getvalue())


def test_rejects_abnormal_worksheet_length_before_materializing_rows():
    book = Workbook()
    sheet = book.active
    sheet.append(["龙岩市非学科类校外培训机构白名单"])
    sheet.append(HEADERS)
    sheet.append(["新罗区", "甲培训", "一号路", "艺术"])
    sheet.cell(row=MAX_ROWS + 1, column=1, value="异常远行")
    output = BytesIO()
    book.save(output)
    with pytest.raises(ValueError, match="row|行"):
        parse_xlsx(output.getvalue())


def test_rejects_worksheet_without_declared_dimensions():
    original = workbook_bytes([HEADERS, ["新罗区", "甲培训", "一号路", "艺术"]])
    revised = BytesIO()
    with ZipFile(BytesIO(original)) as source, ZipFile(revised, "w") as target:
        for member in source.infolist():
            data = source.read(member.filename)
            if member.filename == "xl/worksheets/sheet1.xml":
                assert b'<dimension ref="A1:F3" />' in data
                data = data.replace(b'<dimension ref="A1:F3" />', b"")
            target.writestr(member, data)
    with pytest.raises(ValueError, match="dimension|维度"):
        parse_xlsx(revised.getvalue())


def test_real_layout_allows_style_only_far_column_without_losing_raw_fields():
    book = Workbook()
    sheet = book.active
    sheet.title = "Sheet1"
    sheet.append(["附件"])
    sheet.append(["龙岩市非学科类校外培训机构“白名单”（截止4月9号）"])
    sheet.append(["序号", "县（市、区）", "机构名称", "地址", "培训类别", "备注"])
    sheet.append([1, "新罗区", "甲培训", "一号路", "文化艺术类", None])
    sheet.cell(row=80, column=16_383).font = Font(bold=True)
    output = BytesIO()
    book.save(output)
    (record,) = parse_xlsx(output.getvalue())
    assert record["row"] == 4
    assert record["raw_cells"] == [1, "新罗区", "甲培训", "一号路", "文化艺术类", None]
    assert record["raw_fields"]["备注"] is None
    assert record["address"] == "一号路"
    assert record["training_category"] == "文化艺术类"


def test_style_only_far_column_does_not_hide_nonempty_far_column():
    book = Workbook()
    sheet = book.active
    sheet.append(["附件"])
    sheet.append(["龙岩市非学科类校外培训机构白名单"])
    sheet.append(["序号", "县（市、区）", "机构名称", "地址", "培训类别"])
    sheet.append([1, "新罗区", "甲培训", "一号路", "文化艺术类"])
    sheet.cell(row=80, column=16_383, value="未知远列有值")
    output = BytesIO()
    book.save(output)
    with pytest.raises(ValueError, match="column|列"):
        parse_xlsx(output.getvalue())
