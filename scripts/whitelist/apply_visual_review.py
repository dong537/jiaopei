#!/usr/bin/env python
"""把视觉核对确认的存疑项修正号码/机构名并标记「通过」。

依据：逐张查看 ocr/images/doubt/doubt_*.png 原件行截图后的人工判定。
只改核对表里明确列出的条目；其余保持「存疑」。

用法：python scripts/whitelist/apply_visual_review.py
"""
from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path("data/whitelist/ocr")
CSV = ROOT / "人工核对表.csv"

# 视觉核对结论：行号 -> (正确许可证号, 完整机构名)
# 7 条读数分歧：采纳二次识别（已逐张看原件确认正确）
# 2 条假重复：号码本身对，补全机构名
# 若干机构名截断但号码清晰：补全机构名
VERIFIED = {
    5:  ("144150270000201", "汕尾市城区晋级爱之家教育培训有限责任公司"),
    58: ("244158170221988", "陆丰市博美镇小蓓蕾教育培训中心"),
    62: ("244158170221208", "陆丰市东海街道通大教育培训中心"),
    65: ("244158170221298", "陆丰市东海街道文益教育培训中心"),
    67: ("244158170221288", "陆丰市善教育培训中心"),
    69: ("244158170221238", "陆丰市东海街道欢舞飞扬教育培训中心"),
    70: ("244158170221998", "陆丰市东海街道以为教育培训中心"),
    76: ("244158170222198", "陆丰市东海逸雅教育培训中心"),
    81: ("244158190221648", "陆丰市南塘镇润笔教育培训中心"),
    82: ("244158170250698", "陆丰市东海街道朗星艺术教育培训中心"),
    88: ("244152370000269", "汕尾市贝乐计画文化艺术有限公司"),
    94: ("144152370000169", "陆河县陆音琴行"),
}


def main():
    rows = list(csv.reader(CSV.open(encoding="utf-8-sig")))
    hdr = rows[0]
    si = {n: i for i, n in enumerate(hdr)}
    changed = []
    for i, r in enumerate(rows[1:], 1):
        if i not in VERIFIED:
            continue
        lic, name = VERIFIED[i]
        old_lic, old_name = r[si["许可证号"]], r[si["机构名候选"]]
        r[si["许可证号"]] = lic
        r[si["机构名候选"]] = name
        r[si["核对状态"]] = "通过"
        r[si["备注"]] = (r[si["备注"]] + "；" if r[si["备注"]] else "") + "视觉核对原件确认"
        changed.append((i, old_lic, lic, old_name[:16], name[:16]))
    with CSV.open("w", encoding="utf-8-sig", newline="") as f:
        csv.writer(f).writerows(rows)
    print(f"视觉核对修正 {len(changed)} 行：")
    for i, ol, nl, on, nn in changed:
        flag = " [号码改正]" if ol != nl else ""
        print(f"  #{i:3d}{flag} {ol} -> {nl} | {on} -> {nn}")


if __name__ == "__main__":
    main()
