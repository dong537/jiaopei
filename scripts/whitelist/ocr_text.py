#!/usr/bin/env python
"""扫描 PDF / 图片的 OCR 许可证号抽取（供 parse.mjs 消费）。

用法：
    python scripts/whitelist/ocr_text.py <扫描PDF或图片路径>

输出 JSON（与 pdf_text.py / sheet_text.py 约定一致）：
    {
      "pages": int,            # 页数（图片为 1）
      "hasTextLayer": false,   # 恒 false，标明本来源无文字层
      "codesInText": int,      # OCR 文本中抽到的不同 15 位许可证号数
      "ocrConfidence": float,  # 平均置信度
      "rawLines": [str],       # OCR 原始行（供人工抽验）
      "error": str|null
    }

纪律：
- OCR 识别数字串（许可证号）不可靠，产出必须先落私有目录 data/whitelist/ocr/，
  人工抽验通过后才并入 rows.jsonl；识别错误 = 错配风险，宁可漏配不错配。
- 本脚本只做 OCR + 号码抽取，不落库、不联网、不改原始件。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

LICENSE_RE = re.compile(r"(?:1|2|4)\d{14}(?!\d)")

try:
    import fitz  # PyMuPDF；新版推荐 pymupdf
except ImportError:
    fitz = None
try:
    import pytesseract
    from PIL import Image
except ImportError:
    pytesseract = None


def _ocr_image(img) -> str:
    if pytesseract is None:
        raise RuntimeError("pytesseract/Pillow 未安装；先 pip install pytesseract Pillow")
    return pytesseract.image_to_string(img, lang="chi_sim", config="--psm 6")


def _codes_in_text(text: str) -> set[str]:
    return set(LICENSE_RE.findall(text))


def _extract_from_pdf(path: Path) -> dict:
    if fitz is None:
        raise RuntimeError("PyMuPDF 未安装；先 pip install pymupdf")
    doc = fitz.open(str(path))
    codes: set[str] = set()
    raw_lines: list[str] = []
    confs: list[float] = []
    try:
        for page in doc:
            # 300 DPI 渲染，放大字号提升识别率
            pix = page.get_pixmap(matrix=fitz.Matrix(300 / 72, 300 / 72))
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            data = pytesseract.image_to_data(img, lang="chi_sim", config="--psm 6", output_type=pytesseract.Output.DICT)
            for i, txt in enumerate(data.get("text", [])):
                t = (txt or "").strip()
                if not t:
                    continue
                raw_lines.append(t)
                codes.update(LICENSE_RE.findall(t))
                conf = data.get("conf", [])[i]
                if isinstance(conf, (int, float)) and conf > 0:
                    confs.append(float(conf))
            img.close()
    finally:
        doc.close()
    avg_conf = round(sum(confs) / len(confs), 1) if confs else 0.0
    return {
        "pages": len(raw_lines) and doc.page_count or 0,
        "hasTextLayer": False,
        "codesInText": len(codes),
        "ocrConfidence": avg_conf,
        "rawLines": raw_lines,
        "error": None,
    }


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(json.dumps({"error": "用法: ocr_text.py <扫描PDF或图片路径>"}, ensure_ascii=False))
        return 2
    path = Path(argv[1])
    if not path.is_file():
        print(json.dumps({"error": f"文件不存在: {path}"}, ensure_ascii=False))
        return 2
    try:
        if path.suffix.lower() == ".pdf":
            out = _extract_from_pdf(path)
        else:
            img = Image.open(str(path))
            text = _ocr_image(img)
            codes = _codes_in_text(text)
            out = {
                "pages": 1,
                "hasTextLayer": False,
                "codesInText": len(codes),
                "ocrConfidence": 0.0,
                "rawLines": text.splitlines(),
                "error": None,
            }
            img.close()
    except Exception as exc:  # noqa: BLE001
        out = {"pages": 0, "hasTextLayer": False, "codesInText": 0, "ocrConfidence": 0.0, "rawLines": [], "error": str(exc)}
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
