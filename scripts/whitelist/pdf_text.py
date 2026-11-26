"""把 PDF 中的表格导出为 JSON 单元格矩阵，供 node 侧复用同一套表头映射。

用 PyMuPDF 的 find_tables() 做版面表格识别：这类教育局名单 PDF 是规整的
单元格表格，直接按行/列还原比按文本行猜要可靠。

输出：
  {
    "pageCount": 9,
    "tables": [ {"page": 1, "rows": [["序号","单位名称",...], ...]}, ... ],
    "hasTextLayer": true
  }

扫描件（无文字层）会返回 hasTextLayer=false、tables=[]，由 node 侧如实标记
为「需 OCR」，不静默当作空名单。
"""
import json
import sys


def clean(cell) -> str:
    if cell is None:
        return ""
    text = str(cell)
    # CJK 词内换行是排版产物，去掉；其余空白压成单空格
    for ch in ("\n", "\r", "\t"):
        text = text.replace(ch, "")
    return " ".join(text.split())


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing pdf path"}))
        return 2
    path = sys.argv[1]

    try:
        import pymupdf
    except ImportError:
        try:
            import fitz as pymupdf  # type: ignore
        except ImportError:
            print(json.dumps({"error": "pymupdf not installed"}))
            return 3

    try:
        doc = pymupdf.open(path)
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"error": f"open failed: {exc}"}))
        return 4

    tables = []
    text_chars = 0
    page_texts = []

    for index, page in enumerate(doc):
        try:
            page_text = page.get_text("text") or ""
        except Exception:
            page_text = ""
        text_chars += len(page_text)
        page_texts.append(page_text)
        try:
            found = page.find_tables()
        except Exception as exc:  # pragma: no cover
            tables.append({"page": index + 1, "error": str(exc), "rows": []})
            continue
        for table in found.tables:
            try:
                rows = []
                for row in table.rows:
                    cells = []
                    for cell in row.cells:
                        if cell is None:
                            cells.append("")
                            continue
                        # 用 get_textbox 按阅读顺序重取单元格文本：
                        # table.extract() 在跨行折行的中文单元格里会把字序打乱
                        # （"一心武道跆|拳道" 变成 "心武道跆一|拳道"），
                        # 而 textbox 按 (y, x) 逐行还原，折行拼接后与原名一致。
                        try:
                            text = page.get_textbox(pymupdf.Rect(cell))
                        except Exception:
                            text = ""
                        cells.append(clean(text))
                    if any(cells):
                        rows.append(cells)
            except Exception:
                continue
            if rows:
                tables.append({"page": index + 1, "rows": rows})

    import re

    codes_in_text = len(set(re.findall(r"(?:1|2|4)\d{14}", "".join(page_texts))))

    print(
        json.dumps(
            {
                "pageCount": doc.page_count,
                "hasTextLayer": text_chars > 200,
                "textChars": text_chars,
                "codesInText": codes_in_text,
                "tables": tables,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
