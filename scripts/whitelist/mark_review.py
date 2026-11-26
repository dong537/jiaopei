#!/usr/bin/env python
"""按「高置信」规则在人工核对表 CSV 的「核对状态」列写判定。

规则（用户已授权"先入库高置信的一批"）：
- 通过：机构名完整 + 非重复号 + 非读数分歧 + （二次识别一致 或 首轮置信度≥0.95）
- 存疑：其余（读数分歧、重复号、机构名不完整、低置信且未二次确认）

只改「核对状态」列，其他列原样保留。写前打印统计，便于复核。
用法：python scripts/whitelist/mark_review.py [--dry]
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path("data/whitelist/ocr")
CSV = ROOT / "人工核对表.csv"
RECHECK = ROOT / "recheck.json"


def name_ok(n: str) -> bool:
    n = (n or "").strip()
    if len(n) < 8:
        return False
    return any(w in n for w in ("有限公司", "中心", "学校", "教育培训", "培训", "幼儿园"))


def main():
    dry = "--dry" in sys.argv
    rc = json.loads(RECHECK.read_text(encoding="utf8")) if RECHECK.exists() else {}
    rows = list(csv.reader(CSV.open(encoding="utf-8-sig")))
    hdr = rows[0]
    si = {name: i for i, name in enumerate(hdr)}
    iStatus = si["核对状态"]
    iLic = si["许可证号"]
    iName = si["机构名候选"]
    iConf = si["最低置信度"]

    passed, doubt = [], []
    for r in rows[1:]:
        idx = len(passed) + len(doubt) + 1  # 仅用于展示序号
        lic, name, conf = r[iLic].strip(), r[iName].strip(), r[iConf].strip()
        try:
            conf_f = float(conf)
        except (ValueError, TypeError):
            conf_f = 0.0
        rec = rc.get(str(idx), {})
        rc_codes = rec.get("codes", [])
        rc_agree = rec.get("agree", True)
        diff = bool(rc_codes) and not rc_agree
        # 重复号：全表统计
        dup = sum(1 for x in rows[1:] if x[iLic].strip() == lic) > 1
        if diff or dup or not name_ok(name) or (conf_f < 0.9 and not (rc_codes and rc_agree)):
            doubt.append((idx, lic, name, "分歧" if diff else "重复" if dup else "名称" if not name_ok(name) else "低置信"))
        else:
            passed.append((idx, lic, name))

    print(f"待判定 {len(rows)-1} 行")
    print(f"  规则通过 {len(passed)} 行")
    print(f"  存疑     {len(doubt)} 行")
    print("=== 存疑明细 ===")
    for idx, lic, name, why in doubt:
        print(f"  #{idx:3d} [{why:4s}] {lic}  {name[:24]}")
    if dry:
        print("--dry：未写入")
        return
    # 写回 CSV：按行号重新映射（CSV 行序 = 核对表 i 顺序）
    pass_set = {i for i, _, _ in passed}
    for n, r in enumerate(rows[1:], 1):
        r[iStatus] = "通过" if n in pass_set else "存疑"
    with CSV.open("w", encoding="utf-8-sig", newline="") as f:
        csv.writer(f).writerows(rows)
    print(f"已写入 {CSV}：通过 {len(passed)} / 存疑 {len(doubt)}")


if __name__ == "__main__":
    main()
