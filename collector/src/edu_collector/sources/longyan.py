"""Offline parser for the Longyan non-subject training whitelist attachment.

The attachment is one official XLSX, not a paginated API. This module never
makes network requests and does not infer licenses, campuses, or legal entities.
"""

from __future__ import annotations

from datetime import date, datetime, time
from io import BytesIO
from itertools import chain, islice
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter
from openpyxl.utils.cell import column_index_from_string, coordinate_from_string


SOURCE_ID = "longyan-2026-white-nonsubject"
SOURCE_URL = "https://jyj.longyan.gov.cn/zwgk/gggs/202604/P020260413590906477838.xlsx"
PUBLISHED_AT = "2026-04-09"
# This source is reported as 77 rows. These are safety ceilings, not a claim
# that every future publication must contain exactly 77 institutions.
MAX_ROWS = 2_000
MAX_COLUMNS = 64
_HEADER_SCAN_ROWS = 20
_MAX_ARCHIVE_BYTES = 8 * 1024 * 1024
_MAX_ZIP_ENTRIES = 128
_MAX_UNCOMPRESSED_BYTES = 32 * 1024 * 1024
_MAX_SHEET_XML_BYTES = 16 * 1024 * 1024
_MAX_XML_CELLS = 250_000

_HEADER_ALIASES = {
    "region": {"县市区", "县区", "辖区"},
    "institution_name": {"机构名称", "培训机构名称", "校外培训机构名称"},
    "address": {"地址", "培训地址", "办学地址"},
    "training_category": {"培训类别", "培训类型"},
}


def list_url(page: int) -> str:
    """Return the only confirmed source document URL."""
    if isinstance(page, bool) or page != 1:
        raise ValueError("Longyan XLSX has only page 1")
    return SOURCE_URL


def _header_key(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return "".join(character for character in value if character.isalnum()).lower()


def _header_positions(row: tuple[object, ...]) -> dict[str, int] | None:
    positions: dict[str, int] = {}
    for index, value in enumerate(row):
        key = _header_key(value)
        for field, aliases in _HEADER_ALIASES.items():
            if key in aliases and field not in positions:
                positions[field] = index
    return positions if len(positions) == len(_HEADER_ALIASES) else None


def _json_cell(value: object) -> object:
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    return value


def _field_names(header: tuple[object, ...], width: int) -> list[str]:
    names: list[str] = []
    counts: dict[str, int] = {}
    for index in range(width):
        cell = header[index] if index < len(header) else None
        name = str(cell).strip() if cell is not None and str(cell).strip() else f"__column_{get_column_letter(index + 1)}"
        counts[name] = counts.get(name, 0) + 1
        names.append(name if counts[name] == 1 else f"{name}#{counts[name]}")
    return names


def _last_used_column(row: tuple[object, ...]) -> int:
    return max((index + 1 for index, value in enumerate(row) if value is not None and value != ""), default=0)


def _cell_has_value(cell: ElementTree.Element) -> bool:
    for child in cell.iter():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "f" or (tag in {"v", "t"} and child.text not in (None, "")):
            return True
    return False


def _check_archive_limits(raw: bytes) -> None:
    """Bound ZIP/XML work and reject value-bearing cells beyond parser limits.

    Excel's used-range dimension may include thousands of *styled* blank
    columns. It is not a safe proxy for the farthest column with content.
    """
    if len(raw) > _MAX_ARCHIVE_BYTES:
        raise ValueError("Longyan XLSX archive byte limit exceeded")
    try:
        with ZipFile(BytesIO(raw)) as archive:
            members = archive.infolist()
            if len(members) > _MAX_ZIP_ENTRIES:
                raise ValueError("Longyan XLSX ZIP entry limit exceeded")
            if sum(member.file_size for member in members) > _MAX_UNCOMPRESSED_BYTES:
                raise ValueError("Longyan XLSX uncompressed byte limit exceeded")
            sheet_members = [
                member for member in members
                if member.filename.startswith("xl/worksheets/") and member.filename.endswith(".xml")
            ]
            if not sheet_members:
                raise ValueError("Longyan XLSX has no worksheet XML")
            cell_count = 0
            for member in sheet_members:
                if member.file_size > _MAX_SHEET_XML_BYTES:
                    raise ValueError("Longyan XLSX worksheet XML byte limit exceeded")
                with archive.open(member) as stream:
                    parser = ElementTree.iterparse(stream, events=("start", "end"))
                    _, root = next(parser)
                    for event, element in parser:
                        if event != "end":
                            continue
                        tag = element.tag.rsplit("}", 1)[-1]
                        if tag == "c":
                            cell_count += 1
                            if cell_count > _MAX_XML_CELLS:
                                raise ValueError("Longyan XLSX cell element limit exceeded")
                            if _cell_has_value(element):
                                coordinate = element.get("r")
                                if not coordinate:
                                    raise ValueError("Longyan XLSX value-bearing cell lacks coordinate")
                                column_name, row_number = coordinate_from_string(coordinate)
                                if row_number > MAX_ROWS:
                                    raise ValueError("Longyan XLSX worksheet row limit exceeded")
                                if column_index_from_string(column_name) > MAX_COLUMNS:
                                    raise ValueError("Longyan XLSX worksheet column limit exceeded")
                            element.clear()
                        elif tag == "row":
                            root.clear()
    except (BadZipFile, ElementTree.ParseError, OSError, RuntimeError, StopIteration) as exc:
        raise ValueError("Invalid or unreadable Longyan XLSX archive") from exc


def parse_xlsx(raw: bytes) -> list[dict]:
    """Parse source rows without deduplicating names or filling missing fields.

    Raises ValueError when the bytes are not a readable XLSX, the expected
    source identity is absent, the data table is empty, or no worksheet has
    the confirmed field set. Oversized worksheets are rejected before reading
    their full contents into memory.
    Row numbers are actual Excel coordinates and remain stable across reruns.
    """
    _check_archive_limits(raw)
    try:
        workbook = load_workbook(BytesIO(raw), read_only=True, data_only=False)
    except (BadZipFile, OSError, TypeError, ValueError, KeyError) as exc:
        raise ValueError("Invalid Longyan XLSX file") from exc

    try:
        identity_parts: list[str] = []
        records: list[dict] = []
        found_header = False
        for sheet in workbook.worksheets:
            sheet_name = sheet.title
            if sheet.max_row is None or sheet.max_column is None:
                raise ValueError(f"Longyan XLSX worksheet dimensions missing: {sheet_name}")
            if sheet.max_row > MAX_ROWS:
                raise ValueError(f"Longyan XLSX worksheet row limit exceeded: {sheet_name}")
            numbered_rows = enumerate(
                sheet.iter_rows(max_row=sheet.max_row, max_col=MAX_COLUMNS, values_only=True),
                start=1,
            )
            first_rows = list(islice(numbered_rows, _HEADER_SCAN_ROWS))
            for _, row in first_rows:
                if len(row) > MAX_COLUMNS:
                    raise ValueError(f"Longyan XLSX worksheet column limit exceeded: {sheet_name}")
            match = next(
                ((row_number, row, positions) for row_number, row in first_rows
                 if (positions := _header_positions(row)) is not None),
                None,
            )
            identity_parts.append(sheet_name)
            # A data row may mention Longyan in an address even when the file
            # belongs to another city; only document/header metadata identifies
            # the publication.
            identity_last_row = match[0] if match is not None else _HEADER_SCAN_ROWS
            identity_parts.extend(
                str(cell)
                for row_number, row in first_rows if row_number <= identity_last_row
                for cell in row if cell is not None
            )
            if match is None:
                continue
            found_header = True
            header_number, header, positions = match
            remaining_first_rows = (pair for pair in first_rows if pair[0] > header_number)
            for row_number, row in chain(remaining_first_rows, numbered_rows):
                if row_number > MAX_ROWS:
                    raise ValueError(f"Longyan XLSX worksheet row limit exceeded: {sheet_name}")
                if len(row) > MAX_COLUMNS:
                    raise ValueError(f"Longyan XLSX worksheet column limit exceeded: {sheet_name}")
                if not any(value is not None and value != "" for value in row):
                    continue
                width = max(_last_used_column(header), _last_used_column(row))
                cells = [_json_cell(row[index] if index < len(row) else None) for index in range(width)]
                names = _field_names(header, width)
                records.append({
                    "source_record_id": f"{SOURCE_ID}:{sheet_name}:{row_number}",
                    "source_id": SOURCE_ID,
                    "sheet": sheet_name,
                    "row": row_number,
                    "raw_cells": cells,
                    "raw_fields": dict(zip(names, cells)),
                    **{field: cells[index] for field, index in positions.items()},
                })

        if not found_header:
            raise ValueError("Required Longyan XLSX header not found")
        identity_text = " ".join(identity_parts)
        if "龙岩" not in identity_text or "非学科" not in identity_text:
            raise ValueError("Longyan source identity not found in XLSX")
        if not records:
            raise ValueError("Longyan XLSX list is empty; cannot verify a complete list")
        return records
    finally:
        workbook.close()
