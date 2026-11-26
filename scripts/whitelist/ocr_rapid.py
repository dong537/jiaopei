#!/usr/bin/env python
"""用 rapidocr-onnxruntime 对扫描 PDF/图片做中文 OCR + 许可证号抽取。

环境（本机的现实）：
- rapidocr-onnxruntime 装在 Python 3.8（C:/Program Files/python/python.exe）
- PyMuPDF 装在 Python 3.13（当前 `python`）
所以本脚本只负责「读 PNG 做 OCR」；PDF 需先用 render_pdf_13.py（3.13）渲染成 PNG。

用法（Python 3.8）：
    "C:/Program Files/python/python.exe" scripts/whitelist/ocr_rapid.py <图片或目录> [--out <json>]

输出 JSON：{pages, codesInText, codes: [...], ocrConfidence, rawLines, error}
纪律：只 OCR + 抽号，产出落私有目录 data/whitelist/ocr/，人工抽验通过才并入 rows.jsonl。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

LICENSE_RE = re.compile(r"(?:教民)?((?:1|2|4)\d{14})(?!\d)")
GD_CODES = {"4401","4402","4403","4404","4405","4406","4407","4408","4409","4412","4413","4414","4415","4416","4417","4418","4419","4420","4451","4452","4453"}
ENGINE = None


def get_engine():
    global ENGINE
    if ENGINE is None:
        from rapidocr_onnxruntime import RapidOCR
        ENGINE = RapidOCR()
    return ENGINE


def ocr_one(path: Path, ytol: float = 12.0) -> dict:
    result, _ = get_engine()(str(path))
    lines, codes, confs, boxes = [], set(), [], []
    for item in (result or []):
        text = str(item[1]).strip()
        conf = item[2]
        box = item[0]
        if text:
            lines.append(text)
            try:
                xs = [float(p[0]) for p in box]
                ys = [float(p[1]) for p in box]
                boxes.append({
                    "t": text,
                    "c": round(float(conf), 3),
                    "x": min(xs), "r": max(xs),
                    "y": (min(ys) + max(ys)) / 2,
                })
            except (TypeError, ValueError, IndexError):
                pass
            for m in LICENSE_RE.finditer(text):
                no = m.group(1)
                if no[1:5] in GD_CODES:
                    codes.add(no)
            try:
                confs.append(float(conf))
            except (TypeError, ValueError):
                pass
    rows = assemble_rows(boxes, ytol)
    return {
        "file": path.name,
        "codesInText": len(codes),
        "codes": sorted(codes),
        "ocrConfidence": round(sum(confs) / len(confs), 3) if confs else 0.0,
        "rawLines": lines,
        "rows": rows,
    }


def assemble_rows(boxes: list, ytol: float) -> list:
    """按 y 中心把文本框聚类成表格行，行内按 x 排序，用于「机构名↔许可证号」配对。"""
    if not boxes:
        return []
    ordered = sorted(boxes, key=lambda b: b["y"])
    groups: list[list[dict]] = []
    for b in ordered:
        placed = False
        for g in groups:
            if abs(b["y"] - g[0]["y"]) <= ytol:
                g.append(b)
                placed = True
                break
        if not placed:
            groups.append([b])
    rows = []
    for g in groups:
        g.sort(key=lambda b: b["x"])
        rows.append({
            "y": round(g[0]["y"], 1),
            "cells": [b["t"] for b in g],
            "minConf": min(b["c"] for b in g),
        })
    return rows


def main(argv):
    if len(argv) < 2:
        print(json.dumps({"error": "用法: ocr_rapid.py <图片或目录> [--out <json>]"}, ensure_ascii=False))
        return 2
    target = Path(argv[1])
    out = None
    if "--out" in argv:
        out = Path(argv[argv.index("--out") + 1])
    files = sorted(target.glob("*.png")) if target.is_dir() else [target]
    pages = []
    for f in files:
        try:
            pages.append(ocr_one(f))
        except Exception as exc:  # noqa: BLE001
            pages.append({"file": f.name, "error": str(exc)})
    all_codes = sorted({c for p in pages for c in p.get("codes", [])})
    result = {
        "pages": len(pages),
        "codesInText": len(all_codes),
        "codes": all_codes,
        "ocrConfidence": round(sum(p.get("ocrConfidence", 0) for p in pages) / max(1, len(pages)), 3),
        "pageDetails": pages,
        "error": None,
    }
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf8")
        print(f"已写入 {out}")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
