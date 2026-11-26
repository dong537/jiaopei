#!/usr/bin/env python
"""为存疑项生成高清裁剪图（号码区域放大），供视觉核对。

从原图按 y 坐标裁 ±50px，放大 3 倍（LANCZOS），存到 ocr/images/doubt/。
用法（Python 3.8）："C:/Program Files/python/python.exe" scripts/whitelist/doubt_crops.py
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path("data/whitelist/ocr")
IMG = ROOT / "images"
OUT = IMG / "doubt"
OUT.mkdir(parents=True, exist_ok=True)


def main():
    from PIL import Image

    rows = list(csv.reader((ROOT / "人工核对表.csv").open(encoding="utf-8-sig")))
    hdr = rows[0]
    si = {n: i for i, n in enumerate(hdr)}
    iStatus = si["核对状态"]
    iPage = si["页或图"]
    iY = si["y坐标"]
    iLic = si["许可证号"]
    iName = si["机构名候选"]

    made = []
    for i, r in enumerate(rows[1:], 1):
        if r[iStatus].strip() != "存疑":
            continue
        page, y = r[iPage].strip(), float(r[iY])
        src = IMG / page
        if not src.exists():
            continue
        img = Image.open(src)
        w, h = img.size
        top, bot = max(0, int(y - 50)), min(h, int(y + 50))
        crop = img.crop((0, top, w, bot))
        crop = crop.resize((crop.width * 3, crop.height * 3), Image.LANCZOS)
        name = f"doubt_{i:03d}.png"
        crop.save(OUT / name)
        img.close()
        made.append({"i": i, "lic": r[iLic].strip(), "name": r[iName].strip(), "file": str(OUT / name)})

    (ROOT / "doubt_crops.json").write_text(json.dumps(made, ensure_ascii=False, indent=2), encoding="utf8")
    print(f"生成 {len(made)} 张高清裁剪图 -> {OUT}")


if __name__ == "__main__":
    main()
