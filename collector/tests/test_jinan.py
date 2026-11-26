"""Offline contract tests for the Jinan High-tech Zone official HTML list."""

from html import escape

import pytest

from edu_collector.sources.jinan import (
    AS_OF,
    PUBLISHED_AT,
    SOURCE_ID,
    SOURCE_URL,
    parse_html,
)


TITLE = "济南高新区校外培训机构“白名单”（截至2026年10月29日）"
HEADERS = ["序号", "区县", "机构名称", "地址", "办学内容", "办学许可证号"]


def rows():
    return [
        [str(number), "高新区", f"第{number}家培训机构", f"第{number}号路", "面向中小学生的艺术培训", f"许可{number}"]
        for number in range(1, 122)
    ]


def page(data=None, *, title=TITLE, pubdate="2026-10-30 17:11", publisher="高新区教育文体部", headers=None):
    data = rows() if data is None else data
    headers = HEADERS if headers is None else headers

    def cells(values, tag="td"):
        return "<tr>" + "".join(
            f"<{tag}>{escape(str(value)) if value is not None else ''}</{tag}>" for value in values
        ) + "</tr>"

    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<title>{escape(title)}</title>"
        f"<meta name='ArticleTitle' content='{escape(title)}'>"
        f"<meta name='PubDate' content='{escape(pubdate)}'>"
        "</head><body>"
        "<table><tr><td>首页</td></tr></table>"
        f"<table><tr><td>发布机构:</td><td>{escape(publisher)}</td></tr></table>"
        "<table>" + cells(headers, "th") + "".join(cells(row) for row in data) + "</table>"
        "</body></html>"
    ).encode("utf-8")


def test_parse_confirmed_rows_and_preserve_unknown_and_null_fields():
    assert SOURCE_ID == "jinan-hightech-2026-whitelist"
    assert SOURCE_URL == "https://innovation.jinan.gov.cn/col/col89688/art/2026/art_2bc8258b48a24493b521b44a3cb760fc.html"
    assert PUBLISHED_AT == "2026-10-30"
    assert AS_OF == "2026-10-29"
    data = rows()
    for row in data:
        row.append(None)
    data[1][2] = data[0][2]
    data[1][6] = "原站附注"
    records = parse_html(page(data, headers=HEADERS + ["未知备注"]))
    assert len(records) == 121
    assert [record["source_record_id"] for record in records[:2]] == [
        f"{SOURCE_ID}:table3:tr2", f"{SOURCE_ID}:table3:tr3",
    ]
    assert records[0]["source_id"] == SOURCE_ID
    assert records[0]["row_number"] == 1
    assert records[0]["table_row"] == 2
    assert records[0]["raw_fields"]["未知备注"] is None
    assert records[1]["raw_fields"]["未知备注"] == "原站附注"
    assert records[0]["institution_name"] == records[1]["institution_name"]
    assert records[0]["district"] == "高新区"
    assert records[0]["address"] == "第1号路"
    assert records[0]["permitted_scope"] == "面向中小学生的艺术培训"
    assert records[0]["license_number"] == "许可1"
    assert records[0]["published_at"] == PUBLISHED_AT
    assert records[0]["as_of"] == AS_OF
    assert records[0]["publishing_agency"] == "高新区教育文体部"


def test_duplicate_license_is_flagged_without_dedup_or_category_inference():
    data = rows()
    data[1][4] = "面向成人的考研培训"
    data[1][5] = data[2][5]
    data[3][5] = None
    records = parse_html(page(data))
    assert len(records) == 121
    assert records[1]["permitted_scope"] == "面向成人的考研培训"
    assert "training_category" not in records[1]
    assert records[1]["anomalies"] == ["duplicate_license_number"]
    assert records[2]["anomalies"] == ["duplicate_license_number"]
    assert records[0]["anomalies"] == []
    assert records[3]["license_number"] is None
    assert records[3]["raw_fields"]["办学许可证号"] is None


@pytest.mark.parametrize(
    "override",
    [
        {"title": "验证码"},
        {"title": "其他地区校外培训机构白名单"},
        {"pubdate": "2025-10-30"},
        {"publisher": "其他单位"},
    ],
)
def test_rejects_captcha_or_source_identity_mismatch(override):
    with pytest.raises(ValueError, match="identity|验证码|source"):
        parse_html(page(**override))


@pytest.mark.parametrize("kind", ["empty", "short", "duplicate_number", "missing_header", "truncated"])
def test_incomplete_or_changed_table_never_passes_verification(kind):
    data = rows()
    if kind == "empty":
        data = []
    elif kind == "short":
        data.pop()
    elif kind == "duplicate_number":
        data[1][0] = "1"
    elif kind == "missing_header":
        bad = HEADERS.copy()
        bad[5] = "其他编号"
        with pytest.raises(ValueError, match="header|table"):
            parse_html(page(data, headers=bad))
        return
    raw = page(data)
    if kind == "truncated":
        raw = raw[:-14]
    with pytest.raises(ValueError, match="empty|count|number|truncated|complete"):
        parse_html(raw)
