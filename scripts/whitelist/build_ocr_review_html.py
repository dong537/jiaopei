#!/usr/bin/env python
"""把 OCR 核对表 + 原件截图整理成一个可逐条勾验的本地 HTML 页面。

- 复制原图到私有目录 data/whitelist/ocr/images/（不依赖 /c/tmp 临时目录）
- 按 y 坐标从原图裁出每个号码所在的表格行，作为该条的截图证据
- 生成自包含核验页 data/whitelist/ocr/人工核验.html：号码 + 截图 + 解析字段并排，
  支持筛选/搜索/通过|存疑|不通过 判定（localStorage 持久化）和导出结果 CSV。

用法（Python 3.8，含 Pillow）：
    "C:/Program Files/python/python.exe" scripts/whitelist/build_ocr_review_html.py
"""
from __future__ import annotations

import csv
import json
import shutil
from collections import Counter
from pathlib import Path

ROOT = Path("data/whitelist/ocr")
IMG = ROOT / "images"
IMG.mkdir(parents=True, exist_ok=True)

SRC = {
    "yingde-2026-04": Path("C:/tmp/yingde-ocr"),
    "shanwei-2025-10": Path("C:/tmp/shanwei-ocr"),
}
CROP_HALF = 56  # 裁剪行高 ±56px（2x 渲染图），比初版 ±42 更高，字更清楚


def main():
    # 1) 复制原图到项目私有目录
    for src in SRC.values():
        if src.exists():
            for f in src.glob("*.png"):
                shutil.copy2(f, IMG / f.name)

    # 2) 逐条裁行 + 组装记录
    rows = list(csv.DictReader((ROOT / "人工核对表.csv").open(encoding="utf-8-sig")))
    lic_count = Counter(r["许可证号"] for r in rows)
    from PIL import Image
    records = []
    for i, r in enumerate(rows, 1):
        page = r["页或图"]
        try:
            y = float(r["y坐标"])
        except (ValueError, TypeError):
            y = 0.0
        img_path = IMG / page
        crop_name = f"crop_{i:03d}.png"
        if img_path.exists():
            img = Image.open(img_path)
            w, h = img.size
            top, bot = max(0, int(y - CROP_HALF)), min(h, int(y + CROP_HALF))
            img.crop((0, top, w, bot)).save(IMG / crop_name)
            img.close()
        conf = r["最低置信度"]
        try:
            conf_f = float(conf)
        except (ValueError, TypeError):
            conf_f = 1.0
        records.append({
            "i": i,
            "source": r["来源"],
            "page": page,
            "y": y,
            "seq": r["序号"],
            "lic": r["许可证号"],
            "name": r["机构名候选"],
            "addr": r["地址候选"],
            "cat": r["类别"],
            "conf": conf,
            "ctx": r["上下文（同行及上下行原文）"],
            "crop": f"images/{crop_name}",
            "full": f"images/{page}",
            "dup": lic_count[r["许可证号"]] > 1,
            "low": conf_f < 0.9,
        })

    # 载入二次识别线索（若存在）
    recheck = {}
    rc_path = ROOT / "recheck.json"
    if rc_path.exists():
        recheck = json.loads(rc_path.read_text(encoding="utf8"))

    # 3) 生成 HTML
    for rec in records:
        rc = recheck.get(str(rec["i"]))
        if rc and not rc.get("error"):
            rec["rcCodes"] = rc.get("codes", [])
            rec["rcAgree"] = rc.get("agree", True)
            rec["rcConf"] = rc.get("conf", 0.0)
        else:
            rec["rcCodes"] = []
            rec["rcAgree"] = True
            rec["rcConf"] = 0.0
    data_json = json.dumps(records, ensure_ascii=False)
    html = TEMPLATE.replace("__DATA__", data_json).replace("__N__", str(len(records)))
    out = ROOT / "人工核验.html"
    out.write_text(html, encoding="utf8")
    print(f"已写入 {out}")
    print(f"记录 {len(records)} 条，裁剪图 {len(list(IMG.glob('crop_*.png')))} 张，原图 {len(list(IMG.glob('*.png')))-len(list(IMG.glob('crop_*.png')))} 张")


TEMPLATE = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OCR 许可证号人工核验</title>
<style>
:root{--bg:#fff;--bg2:#f5f5f4;--line:#e5e4e0;--tx:#1a1a19;--tx2:#6b6a66;--ok:#1d9e75;--warn:#ba7517;--bad:#e24b4a;--info:#378add}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;color:var(--tx);background:var(--bg);font-size:13px;line-height:1.6}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:14px 20px;z-index:10}
h1{font-size:16px;margin:0 0 4px;font-weight:600}
.sub{color:var(--tx2);font-size:12px}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}
button,select,input{font:inherit;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--tx);cursor:pointer}
button.on{background:var(--tx);color:var(--bg);border-color:var(--tx)}
input[type=text]{cursor:text;min-width:180px}
.stat{display:flex;gap:16px;margin-top:8px;font-size:12px;color:var(--tx2)}
.stat b{color:var(--tx);font-weight:600}
main{padding:12px 20px 60px}
.row{display:grid;grid-template-columns:300px 1fr;gap:14px;border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:12px}
.row.flag{border-color:var(--warn)}
.shot{background:var(--bg2);border-radius:8px;overflow:hidden;cursor:zoom-in;align-self:start}
.shot img{display:block;width:100%;height:auto}
.info{min-width:0}
.lic{font-family:ui-monospace,monospace;font-size:15px;font-weight:600;letter-spacing:.3px}
.badge{display:inline-block;font-size:11px;padding:1px 7px;border-radius:10px;margin-left:6px;vertical-align:middle}
.b-dup{background:#fcebeb;color:var(--bad)}
.b-low{background:#faeeda;color:var(--warn)}
.b-none{background:#f1efe8;color:var(--tx2)}
.kv{margin:6px 0}
.kv span{color:var(--tx2)}
.ctx{color:var(--tx2);font-size:12px;margin-top:6px;word-break:break-all;max-height:3.1em;overflow:hidden;cursor:pointer}
.ctx.open{max-height:none}
.rc{background:#fcebeb;color:var(--bad);border-radius:8px;padding:5px 9px;margin-top:6px;font-size:12px}
.acts{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.acts button.ok.on{background:var(--ok);color:#fff;border-color:var(--ok)}
.acts button.maybe.on{background:var(--warn);color:#fff;border-color:var(--warn)}
.acts button.no.on{background:var(--bad);color:#fff;border-color:var(--bad)}
.meta{font-size:11px;color:var(--tx2);margin-top:6px}
#lb{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:50;padding:24px;overflow:auto}
#lb img{display:block;max-width:none;background:#fff}
#lb .hint{color:#ddd;font-size:12px;margin-bottom:10px}
footer{position:fixed;bottom:0;left:0;right:0;background:var(--bg);border-top:1px solid var(--line);padding:10px 20px;display:flex;gap:10px;align-items:center;z-index:11}
footer .sp{flex:1;font-size:12px;color:var(--tx2)}
@media(max-width:640px){.row{grid-template-columns:1fr}.shot{max-width:420px}}
</style>
</head>
<body>
<header>
<h1>OCR 许可证号人工核验</h1>
<div class="sub">每条号码配一张从原件裁出的表格行截图，请对照判定。共 <b id="totalNum">__N__</b> 条。</div>
<div class="bar">
<input type="text" id="q" placeholder="搜索号码 / 机构名">
<select id="flt">
<option value="all">全部</option>
<option value="undecided">未判定</option>
<option value="flag">需重点看（重复号或低置信度）</option>
<option value="diff">二次读数分歧（号码存疑）</option>
<option value="ok">已通过</option>
<option value="maybe">已存疑</option>
<option value="no">已不通过</option>
</select>
<button id="exportraw">导出原件图对照</button>
</div>
<div class="stat"><span>通过 <b id="cOk">0</b></span><span>存疑 <b id="cMaybe">0</b></span><span>不通过 <b id="cNo">0</b></span><span>未判定 <b id="cUnd">0</b></span></div>
</header>
<main id="list"></main>
<footer>
<span class="sp">判定结果自动保存在本机浏览器，可随时回来继续。</span>
<button id="export">导出核对结果 CSV</button>
<button id="clear">清空判定</button>
</footer>
<div id="lb" onclick="this.style.display='none'"><div class="hint">点击任意处关闭</div><img id="lbimg"></div>
<script>
var DATA = __DATA__;
var KEY = 'ocr_review_v1';
var state = {};
try{ state = JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ state={}; }
function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function save(){localStorage.setItem(KEY,JSON.stringify(state));updateStat();}
function setv(i,v){state[i]=v;save();var el=document.querySelector('[data-row="'+i+'"]');if(el)paint(el,DATA[i-1]);}
function paint(el,d){
  var v=state[d.i]||'';
  el.querySelectorAll('.acts button').forEach(function(b){b.classList.toggle('on',b.dataset.v===v);});
  el.classList.toggle('flag',d.dup||d.low);
}
function render(){
  var q=(document.getElementById('q').value||'').trim().toLowerCase();
  var f=document.getElementById('flt').value;
  var html='';
  DATA.forEach(function(d){
    var v=state[d.i]||'';
    if(q && (d.lic+' '+d.name+' '+d.addr).toLowerCase().indexOf(q)<0) return;
    if(f==='undecided'&&v) return;
    if(f==='flag'&&!(d.dup||d.low)) return;
    if(f==='diff'&&(d.rcAgree||!d.rcCodes.length)) return;
    if(f==='ok'&&v!=='ok') return;
    if(f==='maybe'&&v!=='maybe') return;
    if(f==='no'&&v!=='no') return;
    var badges=(d.dup?'<span class="badge b-dup">重复号</span>':'')+(d.low?'<span class="badge b-low">低置信</span>':'')+(!d.rcAgree&&d.rcCodes.length?'<span class="badge b-dup">读数分歧</span>':'')+(!d.name?'<span class="badge b-none">机构名待定</span>':'');
    html+='<div class="row'+(d.dup||d.low?' flag':'')+'" data-row="'+d.i+'">'
      +'<div class="shot" onclick="zoom(\''+d.full+'\')" title="点击查看整页原件"><img loading="lazy" src="'+d.crop+'" alt="原件行"></div>'
      +'<div class="info">'
      +'<div><span class="lic">'+esc(d.lic)+'</span>'+badges+'</div>'
      +'<div class="kv"><span>机构名：</span>'+(esc(d.name)||'<i style="color:var(--tx2)">未配对，见下方原文</i>')+'</div>'
      +'<div class="kv"><span>地址：</span>'+esc(d.addr)+'</div>'
      +'<div class="kv"><span>类别：</span>'+esc(d.cat)+'　<span>置信度：</span>'+esc(d.conf)+'</div>'
      +(d.rcCodes && d.rcCodes.length && !d.rcAgree ? '<div class="rc">二次放大重读：<b>'+esc(d.rcCodes.join(' / '))+'</b> — 与首轮不同，请对照截图确认</div>' : '')
      +'<div class="ctx" onclick="this.classList.toggle(\'open\')">原文：'+esc(d.ctx)+'</div>'
      +'<div class="acts">'
      +'<button class="ok" data-v="ok" onclick="setv('+d.i+',\'ok\')">通过</button>'
      +'<button class="maybe" data-v="maybe" onclick="setv('+d.i+',\'maybe\')">存疑</button>'
      +'<button class="no" data-v="no" onclick="setv('+d.i+',\'no\')">不通过</button>'
      +'</div>'
      +'<div class="meta">来源 '+esc(d.source)+' · 图 '+esc(d.page)+' · 序号 '+esc(d.seq)+'</div>'
      +'</div></div>';
  });
  document.getElementById('list').innerHTML=html||'<p style="color:var(--tx2)">没有符合条件的记录。</p>';
  DATA.forEach(function(d){var el=document.querySelector('[data-row="'+d.i+'"]');if(el)paint(el,d);});
}
function updateStat(){
  var vals=Object.values(state);
  document.getElementById('cOk').textContent=vals.filter(function(v){return v==='ok';}).length;
  document.getElementById('cMaybe').textContent=vals.filter(function(v){return v==='maybe';}).length;
  document.getElementById('cNo').textContent=vals.filter(function(v){return v==='no';}).length;
  document.getElementById('cUnd').textContent=DATA.length-vals.length;
}
function zoom(src){document.getElementById('lbimg').src=src;document.getElementById('lb').style.display='block';}
function exportCsv(){
  var lines=['序号,许可证号,机构名,置信度,核对状态,来源,图'];
  DATA.forEach(function(d){
    var v=state[d.i]||'未判定';
    function c(x){x=(x==null?'':String(x));return '"'+x.replace(/"/g,'""')+'"';}
    lines.push([d.i,c(d.lic),c(d.name),c(d.conf),c(v),c(d.source),c(d.page)].join(','));
  });
  var blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='OCR核对结果_已判定.csv';a.click();
}
document.getElementById('q').addEventListener('input',render);
document.getElementById('flt').addEventListener('change',render);
document.getElementById('export').addEventListener('click',exportCsv);
document.getElementById('clear').addEventListener('click',function(){if(confirm('清空所有判定？')){state={};save();render();}});
document.getElementById('exportraw').addEventListener('click',function(){window.open('images/','_blank');});
render();updateStat();
</script>
</body>
</html>
"""

if __name__ == "__main__":
    main()
