"""Offline parser for one dated Jinan High-tech Zone whitelist page.

This module reads preserved HTML bytes only. A published list row is an
observation, not proof of a currently valid license or an independent campus.
"""

from __future__ import annotations

from collections import Counter

from bs4 import BeautifulSoup

SOURCE_ID = "jinan-hightech-2026-whitelist"
SOURCE_URL = "https://innovation.jinan.gov.cn/col/col89688/art/2026/art_2bc8258b48a24493b521b44a3cb760fc.html"
PUBLISHED_AT = "2026-10-30"
AS_OF = "2026-10-29"
PUBLISHING_AGENCY = "高新区教育文体部"
TITLE = "济南高新区校外培训机构“白名单”（截至2026年10月29日）"
HEADERS = ("序号", "区县", "机构名称", "地址", "办学内容", "办学许可证号")
EXPECTED_ROWS = 121


def _cell_text(cell) -> str | None:
    value = cell.get_text(" ", strip=True)
    return value or None


def _field_names(headers: list[str]) -> list[str]:
    counts: dict[str, int] = {}
    names: list[str] = []
    for index, header in enumerate(headers, start=1):
        name = header or f"__column_{index}"
        counts[name] = counts.get(name, 0) + 1
        names.append(name if counts[name] == 1 else f"{name}#{counts[name]}")
    return names


def _published_by(table) -> str | None:
    for row in table.find_all("tr"):
        cells = [_cell_text(cell) for cell in row.find_all(["th", "td"], recursive=False)]
        for index, cell in enumerate(cells[:-1]):
            if cell and cell.rstrip(":：") == "发布机构":
                return cells[index + 1]
    return None


def parse_html(raw: bytes) -> list[dict]:
    """Verify this immutable publication and preserve every numbered table row.

    Raises ValueError on wrong identity, changed/truncated markup, empty or
    incomplete list. Repeated names and license numbers remain separate rows.
    """
    if not isinstance(raw, bytes) or not raw or len(raw) > 2_000_000:
        raise ValueError("Invalid Jinan HTML bytes or byte limit exceeded")
    if not raw.lower().rstrip().endswith(b"</html>"):
        raise ValueError("Jinan HTML truncated before document end")
    try:
        soup = BeautifulSoup(raw.decode("utf-8"), "html.parser")
    except UnicodeDecodeError as exc:
        raise ValueError("Jinan HTML is not UTF-8") from exc

    title = soup.title.get_text(" ", strip=True) if soup.title else None
    article = soup.find("meta", attrs={"name": "ArticleTitle"})
    pubdate = soup.find("meta", attrs={"name": "PubDate"})
    tables = soup.find_all("table")
    if (
        title != TITLE
        or article is None or article.get("content") != TITLE
        or pubdate is None or not str(pubdate.get("content", "")).startswith(PUBLISHED_AT + " ")
        or len(tables) < 3
        or _published_by(tables[1]) != PUBLISHING_AGENCY
    ):
        raise ValueError("Jinan source identity mismatch or captcha page")

    table_rows = tables[2].find_all("tr")
    if not table_rows:
        raise ValueError("Jinan table header not found")
    header = [_cell_text(cell) or "" for cell in table_rows[0].find_all(["th", "td"], recursive=False)]
    if tuple(header[:len(HEADERS)]) != HEADERS:
        raise ValueError("Jinan table header changed")
    names = _field_names(header)
    if len(table_rows) == 1:
        raise ValueError("Jinan table is empty")
    if len(table_rows) - 1 != EXPECTED_ROWS:
        raise ValueError("Jinan table row count incomplete or changed")

    records: list[dict] = []
    for table_row, row in enumerate(table_rows[1:], start=2):
        cells = row.find_all(["th", "td"], recursive=False)
        if len(cells) != len(header):
            raise ValueError(f"Jinan table row {table_row} column count changed")
        values = [_cell_text(cell) for cell in cells]
        number = values[0]
        if number != str(table_row - 1):
            raise ValueError(f"Jinan table row number missing, duplicate or out of order: {table_row}")
        raw_fields = dict(zip(names, values))
        records.append({
            "source_record_id": f"{SOURCE_ID}:table3:tr{table_row}",
            "source_id": SOURCE_ID,
            "source_url": SOURCE_URL,
            "published_at": PUBLISHED_AT,
            "as_of": AS_OF,
            "publishing_agency": PUBLISHING_AGENCY,
            "table_index": 3,
            "table_row": table_row,
            "row_number": table_row - 1,
            "raw_cells": values,
            "raw_fields": raw_fields,
            "district": raw_fields["区县"],
            "institution_name": raw_fields["机构名称"],
            "address": raw_fields["地址"],
            "permitted_scope": raw_fields["办学内容"],
            "license_number": raw_fields["办学许可证号"],
        })

    license_counts = Counter(record["license_number"] for record in records if record["license_number"])
    for record in records:
        number = record["license_number"]
        record["anomalies"] = ["duplicate_license_number"] if number and license_counts[number] > 1 else []
    return records
