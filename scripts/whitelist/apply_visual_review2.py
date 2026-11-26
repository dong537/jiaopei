#!/usr/bin/env python
"""第二批视觉核对：补全机构名截断项的号码/全名并标「通过」。

逐张查看 doubt_*.png 原件确认。#104 因红色表格线遮挡机构名无法完全辨认，保守留「存疑」。
"""
from __future__ import annotations

import csv
from pathlib import Path

CSV = Path("data/whitelist/ocr/人工核对表.csv")

# 行号 -> (确认的许可证号, 完整机构名)
VERIFIED = {
    20:  ("244150270000439", "汕尾市城区棋院"),
    59:  ("244158170221598", "陆丰市城东街道懿学聪教育培训中心"),
    63:  ("244158170221948", "陆丰市东海街道舞韵孜教育培训中心"),
    64:  ("244158170221958", "陆丰市东海街道艺之韵教育培训中心"),
    66:  ("244158170222238", "陆丰市东海街道玩美画教育培训中心"),
    68:  ("244158170222248", "陆丰市东海街道潼声教育培训中心"),
    72:  ("244158170221668", "陆丰市东海街道晨曦教育培训中心"),
    73:  ("244158170231488", "陆丰市东海街道林武功夫教育培训中心"),
    77:  ("244158170222258", "陆丰市甲东镇艺梦舞蹈教育培训中心"),
    114: ("244188170000469", "英德市舞悦艺术培训中心有限公司城市广场分公司"),
    127: ("244188170000449", "英德市小白杨艺术培训中心有限公司"),
}


def main():
    rows = list(csv.reader(CSV.open(encoding="utf-8-sig")))
    hdr = rows[0]
    si = {n: i for i, n in enumerate(hdr)}
    n = 0
    for i, r in enumerate(rows[1:], 1):
        if i not in VERIFIED:
            continue
        lic, name = VERIFIED[i]
        r[si["许可证号"]] = lic
        r[si["机构名候选"]] = name
        r[si["核对状态"]] = "通过"
        r[si["备注"]] = (r[si["备注"]] + "；" if r[si["备注"]] else "") + "视觉核对原件确认(第二批)"
        n += 1
    with CSV.open("w", encoding="utf-8-sig", newline="") as f:
        csv.writer(f).writerows(rows)
    print(f"第二批视觉核对修正 {n} 行；#104 表格线遮挡机构名，保留存疑")


if __name__ == "__main__":
    main()
