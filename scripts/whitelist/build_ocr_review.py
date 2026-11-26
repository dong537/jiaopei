#!/usr/bin/env python
"""把 ocr_rapid.py 的带坐标 OCR 结果整理成「许可证号人工核对表」CSV。

只做整理，不做自动入库：每行一个号码，附上同行+上下相邻行的文本作为机构名候选，
供人工逐条勾验（核对状态列留空）。通过后才能并入 rows.jsonl。

用法：
    python scripts/whitelist/build_ocr_review.py \
        data/whitelist/ocr/yingde-2026-04.json \
        data/whitelist/ocr/shanwei-2025-10.json \
        --out data/whitelist/ocr/人工核对表.csv
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

LICENSE_RE = re.compile(r"(?:教民)?((?:1|2|4)\d{14})(?!\d)")
GD_CODES = {"4401","4402","4403","4404","4405","4406","4407","4408","4409","4412","4413","4414","4415","4416","4417","4418","4419","4420","4451","4452","4453"}
# 机构名线索词；地址/类别词用于排除
NAME_HINT = ("教育", "培训", "学校", "中心", "有限公司", "公司", "机构", "学院", "幼儿园", "培训中心")
CATEGORY_WORDS = ("非学科类", "学科类", "艺术类", "体育类", "科技类", "中小学生", "成人")
ADDR_HINT = ("路", "街", "号", "栋", "幢", "楼", "层", "大道", "巷", "镇", "村", "广场", "大厦", "综合楼")


def clean_cell(s: str) -> str:
    return (s or "").strip()


def looks_like_name(s: str) -> bool:
    if not s or LICENSE_RE.search(s) or s.isdigit():
        return False
    if any(w in s for w in CATEGORY_WORDS):
        return False
    # 长文本且含地址特征 → 视为地址，不当机构名
    if len(s) >= 18 and any(w in s for w in ADDR_HINT):
        return False
    return any(w in s for w in NAME_HINT)


def looks_like_addr(s: str) -> bool:
    return bool(s) and not s.isdigit() and not LICENSE_RE.search(s) and any(w in s for w in ADDR_HINT)


def review_rows_for_page(page: dict, source: str) -> list[dict]:
    rows = page.get("rows", [])
    out = []
    for idx, r in enumerate(rows):
        cells = [clean_cell(c) for c in r.get("cells", []) if clean_cell(c)]
        joined = " ".join(cells)
        m = LICENSE_RE.search(joined)
        if not m or m.group(1)[1:5] not in GD_CODES:
            continue  # 属地码不属广东 → OCR 误识别，丢弃（与 ocr_rapid.py 同规则）
        lic = m.group(1)
        # 序号：同行里的短纯数字
        seq = next((c for c in cells if c.isdigit() and len(c) <= 3), "")
        # 机构名候选：优先取同行中位于号码之前的片段（最可靠，不串行）；
        # 同行没有时才用上下行补齐（跨行断开的机构名）。
        lic_cell_idx = next((i for i, c in enumerate(cells) if LICENSE_RE.search(c)), -1)
        same_line = [
            c for c in cells[:lic_cell_idx]
            if c and c not in ("序号",) and looks_like_name(c)
        ] if lic_cell_idx > 0 else []
        if same_line:
            name_parts = same_line
        else:
            name_parts = []
            # 上一行末尾的机构名片段
            if idx - 1 >= 0:
                prev = [clean_cell(c) for c in rows[idx - 1].get("cells", [])]
                for c in reversed(prev):
                    if looks_like_name(c):
                        name_parts.insert(0, c)
                        break
            # 下一行开头的短片段（疑似「…有限公司」的续行）
            if idx + 1 < len(rows):
                nxt = [clean_cell(c) for c in rows[idx + 1].get("cells", [])]
                for c in nxt:
                    if c and len(c) <= 6 and "公司" in c and not LICENSE_RE.search(c):
                        name_parts.append(c)
                        break
        # 地址：同行 + 上下 1 行里像地址的片段（取最长的一条，通常最完整）
        addr_cands = []
        for j in (idx - 1, idx, idx + 1):
            if 0 <= j < len(rows):
                for c in rows[j].get("cells", []):
                    c = clean_cell(c)
                    if c and c not in addr_cands and looks_like_addr(c) and not looks_like_name(c):
                        addr_cands.append(c)
        addr = max(addr_cands, key=len) if addr_cands else ""
        # 类别：同行 + 上下行
        cats = []
        for j in (idx - 1, idx, idx + 1):
            if 0 <= j < len(rows):
                for c in rows[j].get("cells", []):
                    c = clean_cell(c)
                    if c and c in CATEGORY_WORDS and c not in cats:
                        cats.append(c)
        context = " / ".join(
            clean_cell(c)
            for j in (idx - 1, idx, idx + 1)
            if 0 <= j < len(rows)
            for c in rows[j].get("cells", [])
            if clean_cell(c)
        )
        out.append({
            "来源": source,
            "页或图": page.get("file", ""),
            "y坐标": r.get("y", ""),
            "序号": seq,
            "许可证号": lic,
            "机构名候选": "".join(name_parts),
            "地址候选": addr,
            "类别": "、".join(cats),
            "最低置信度": r.get("minConf", ""),
            "上下文（同行及上下行原文）": context[:400],
            "核对状态": "",
            "备注": "",
        })
    return out


def main(argv):
    files = []
    skip_next = False
    for a in argv[1:]:
        if skip_next:
            skip_next = False
            continue
        if a == "--out":
            skip_next = True
            continue
        if not a.startswith("--"):
            files.append(a)
    out_path = None
    if "--out" in argv:
        out_path = Path(argv[argv.index("--out") + 1])
    if not files:
        print("用法: build_ocr_review.py <ocr json...> [--out <csv>]")
        return 2
    all_rows = []
    for f in files:
        d = json.loads(Path(f).read_text(encoding="utf8"))
        source = Path(f).stem
        for page in d.get("pageDetails", []):
            all_rows.extend(review_rows_for_page(page, source))
    # 按来源/页/y 排序，便于对照原件
    all_rows.sort(key=lambda r: (r["来源"], r["页或图"], float(r["y坐标"] or 0)))
    fields = list(all_rows[0].keys()) if all_rows else []
    if out_path:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8-sig", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=fields)
            w.writeheader()
            w.writerows(all_rows)
        print(f"已写入 {out_path}　行数 {len(all_rows)}")
    else:
        w = csv.DictWriter(sys.stdout, fieldnames=fields)
        w.writeheader()
        w.writerows(all_rows)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
