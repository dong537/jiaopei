#!/usr/bin/env python
"""对存疑项（重复号/低置信度）做二次识别：放大重裁后重新 OCR，给出复核线索。

不替代人工判定：只把「二次识别号码/置信度/是否与原号一致」写入 recheck.json，
供核验页面标注。最终判定仍由人在页面上完成。

用法（Python 3.8，含 Pillow + rapidocr）：
    "C:/Program Files/python/python.exe" scripts/whitelist/recheck_low_conf.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path("data/whitelist/ocr")
IMG = ROOT / "images"
LICENSE_RE = re.compile(r"(?:教民)?((?:1|2|4)\d{14})(?!\d)")
GD_CODES = {"4401","4402","4403","4404","4405","4406","4407","4408","4409","4412","4413","4414","4415","4416","4417","4418","4419","4420","4451","4452","4453"}
WIN = 60       # 二次重裁窗口 ±60px（比首轮 ±42 更宽）
SCALE = 3      # 放大倍数


def main():
    from PIL import Image
    from rapidocr_onnxruntime import RapidOCR

    s = (ROOT / "人工核验.html").read_text(encoding="utf8")
    data = json.loads(re.search(r"var DATA = (\[.*?\]);\nvar KEY", s, re.S).group(1))
    targets = [x for x in data if x["dup"] or x["low"]]
    engine = RapidOCR()
    out = {}
    for x in targets:
        try:
            img = Image.open(IMG / x["page"])
            w, h = img.size
            y = x["y"]
            top, bot = max(0, int(y - WIN)), min(h, int(y + WIN))
            crop = img.crop((0, top, w, bot))
            crop = crop.resize((crop.width * SCALE, crop.height * SCALE), Image.LANCZOS)
            tmp = IMG / f"_recheck_{x['i']:03d}.png"
            crop.save(tmp)
            result, _ = engine(str(tmp))
            tmp.unlink(missing_ok=True)
            texts, new_codes, confs = [], set(), []
            for item in (result or []):
                t = str(item[1]).strip()
                if t:
                    texts.append(t)
                    for m in LICENSE_RE.finditer(t):
                        if m.group(1)[1:5] in GD_CODES:
                            new_codes.add(m.group(1))
                    try:
                        confs.append(float(item[2]))
                    except (TypeError, ValueError):
                        pass
            out[str(x["i"])] = {
                "orig": x["lic"],
                "codes": sorted(new_codes),
                "agree": x["lic"] in new_codes,
                "conf": round(sum(confs) / len(confs), 3) if confs else 0.0,
                "texts": texts[:14],
            }
            print(f"  {x['i']:3d} {x['lic']} -> {sorted(new_codes)} {'一致' if x['lic'] in new_codes else '不一致'} conf={out[str(x['i'])]['conf']}")
        except Exception as exc:  # noqa: BLE001
            out[str(x["i"])] = {"orig": x["lic"], "error": str(exc)[:120]}
    (ROOT / "recheck.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf8")
    print(f"复核完成 {len(targets)} 条 -> {ROOT / 'recheck.json'}")


if __name__ == "__main__":
    main()
