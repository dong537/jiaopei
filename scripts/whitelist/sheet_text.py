"""把 xls / xlsx 的每张工作表导出为行矩阵，供 node 侧复用同一套表头映射。

政府名单常以 Excel 附件发布（许可决定、年检结果、白名单），
而 .xls（BIFF）与 .xlsx（OOXML）需要不同库：
  .xlsx → openpyxl
  .xls  → xlrd 2.x（仅支持 xls）

输出：
  {"sheets": [{"name": "Sheet1", "rows": [[...], ...]}, ...]}

单元格统一转字符串并压空白；日期按 ISO 日期输出。任何异常都是 {"error": "..."}。
"""
import datetime
import json
import sys


def norm(value) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime.datetime):
        return value.date().isoformat()
    if isinstance(value, datetime.date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value)
    for ch in ("\n", "\r", "\t"):
        text = text.replace(ch, "")
    return " ".join(text.split())


def read_xlsx(path):
    from openpyxl import load_workbook

    wb = load_workbook(path, read_only=True, data_only=True)
    sheets = []
    for ws in wb.worksheets:
        rows = [[norm(c) for c in row] for row in ws.iter_rows(values_only=True)]
        rows = [r for r in rows if any(c for c in r)]
        if rows:
            sheets.append({"name": ws.title, "rows": rows})
    wb.close()
    return sheets


def read_xls(path):
    import xlrd

    book = xlrd.open_workbook(path)
    sheets = []
    for ws in book.sheets():
        rows = []
        for r in range(ws.nrows):
            row = [norm(ws.cell_value(r, c)) for c in range(ws.ncols)]
            if any(row):
                rows.append(row)
        if rows:
            sheets.append({"name": ws.name, "rows": rows})
    return sheets


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing sheet path"}))
        return 2
    path = sys.argv[1]
    lower = path.lower()
    try:
        if lower.endswith(".xlsx") or lower.endswith(".xlsm"):
            sheets = read_xlsx(path)
        elif lower.endswith(".xls"):
            sheets = read_xls(path)
        else:
            print(json.dumps({"error": f"unsupported extension: {path}"}))
            return 5
    except ImportError as exc:
        print(json.dumps({"error": f"missing dependency: {exc}"}))
        return 3
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"error": f"open failed: {exc}"}))
        return 4

    print(json.dumps({"sheets": sheets}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
