/**
 * 候选来源体检：判断一个官方页面是否值得登记进 sources.mjs。
 *
 *   node scripts/whitelist/probe.mjs <url> [url...]
 *
 * 只回答四个问题，不做任何入库：
 *   1. 能不能打开（状态码、类型、大小）
 *   2. 是 HTML 表格、PDF 表格，还是图片/扫描件
 *   3. 页面/文件里到底有多少个 15 位办学许可证号（正则直数，不依赖解析器）
 *   4. 按现有解析器能抽出几行、第一行长什么样
 *
 * 临时原件写到 data/whitelist/probe/，跑完即可删；不写收据、不进账本，
 * 因为它只是"要不要登记"的判断，不是数据来源。
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TMP = resolve(ROOT, "data", "whitelist", "probe");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CODE_RE = /(?:1|2|4)\d{14}/g;
const CODE_ONE = /(?:1|2|4)\d{14}/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function countCodes(s) {
  return new Set(s.match(CODE_RE) || []).size;
}

/** 单元格里的许可证号：先按连号找，再允许号码被空格拆开 */
function cellCode(cell) {
  const m = CODE_ONE.exec(cell);
  if (m) return m[0];
  const d = cell.replace(/\D/g, "");
  return d.length === 15 && /^(1|2|4)/.test(d) ? d : "";
}

function htmlSummary(html) {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const imgs = (html.match(/<img/gi) || []).length;
  const trs = tables.reduce((n, t) => n + (t.match(/<tr/gi) || []).length, 0);
  return { kind: "html", tables: tables.length, trs, imgs, codes: countCodes(html) };
}

function pdfSummary(buf, name) {
  const p = resolve(TMP, `${name}.pdf`);
  writeFileSync(p, buf);
  try {
    const out = execFileSync(process.env.PYTHON || "python", [resolve(ROOT, "scripts", "whitelist", "pdf_text.py"), p], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 180000,
    });
    const d = JSON.parse(out);
    if (d.error) return { kind: "pdf", error: d.error };
    return {
      kind: "pdf",
      pages: d.pageCount,
      textLayer: d.hasTextLayer,
      codes: d.codesInText,
      tables: d.tables.length,
      sample: d.tables[0]?.rows?.slice(0, 2) ?? [],
    };
  } finally {
    rmSync(p, { force: true });
  }
}

async function probe(url, i) {
  process.stdout.write(`\n[${i + 1}] ${url}\n`);
  let res;
  try {
    res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/pdf;q=0.9,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(45000),
    });
  } catch (e) {
    console.log(`  ✗ 请求失败：${e?.name === "TimeoutError" ? "timeout" : e?.message}`);
    return null;
  }
  const ct = res.headers.get("content-type") || "";
  console.log(`  HTTP ${res.status}  ${ct.split(";")[0]}`);
  if (!res.ok) return null;

  const isPdf = /pdf/i.test(ct);
  const isSheet = /spreadsheet|excel|ms-excel/i.test(ct) || /\.(xlsx?|et)(\?|$)/i.test(url);
  if (isSheet) {
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = /\.xlsx(\?|$)/i.test(url) ? "xlsx" : "xls";
    const p = resolve(TMP, `p${i}.${ext}`);
    writeFileSync(p, buf);
    try {
      const out = execFileSync(process.env.PYTHON || "python", [resolve(ROOT, "scripts", "whitelist", "sheet_text.py"), p], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        timeout: 120000,
      });
      const d = JSON.parse(out);
      if (d.error) {
        console.log(`  ✗ 表格解析失败：${d.error}`);
        return null;
      }
      const grids = d.sheets.map((s) => s.rows);
      const codes = new Set();
      for (const g of grids) for (const row of g) for (const c of row) {
        const hit = cellCode(c || "");
        if (hit) codes.add(hit);
      }
      console.log(`  ${ext.toUpperCase()} ${d.sheets.length} 表｜许可证号 ${codes.size} 个｜最大表 ${Math.max(...grids.map((g) => g.length))} 行`);
      grids[0]?.slice(0, 2).forEach((r) => console.log(`  首行：${JSON.stringify(r.slice(0, 8))}`));
      return { url, kind: ext, codes: codes.size, sheets: d.sheets.length, size: buf.byteLength };
    } finally {
      rmSync(p, { force: true });
    }
  }
  if (isPdf) {
    const buf = Buffer.from(await res.arrayBuffer());
    const s = pdfSummary(buf, `p${i}`);
    if (s.error) {
      console.log(`  ✗ PDF 解析失败：${s.error}`);
      return null;
    }
    console.log(
      `  PDF ${s.pages} 页｜文字层 ${s.textLayer ? "有" : "无"}｜许可证号 ${s.codes} 个｜表格 ${s.tables} 个`,
    );
    if (s.sample?.length) console.log(`  首行：${JSON.stringify(s.sample[0])}`);
    return { url, ...s, size: buf.byteLength };
  }

  const html = await res.text();
  const s = htmlSummary(html);
  console.log(
    `  HTML ${(html.length / 1024).toFixed(0)}KB｜表格 ${s.tables} 个（${s.trs} 行）｜图片 ${s.imgs} 个｜许可证号 ${s.codes} 个`,
  );
  const verdict =
    s.codes >= 5 && s.trs > 20
      ? "可用（HTML 表格）"
      : s.imgs > 3 && s.codes < 5
        ? "疑似图片版名单"
        : s.codes < 5
          ? "无许可证号"
          : "表格行数偏少";
  console.log(`  判断：${verdict}`);
  return { url, ...s, size: html.length, verdict };
}

const urls = process.argv.slice(2).filter((a) => /^https?:/.test(a));
if (!urls.length) {
  console.log("用法：node scripts/whitelist/probe.mjs <url> [url...]");
  process.exit(1);
}
mkdirSync(TMP, { recursive: true });

const out = [];
for (let i = 0; i < urls.length; i++) {
  if (i > 0) await sleep(2500);
  const r = await probe(urls[i], i);
  if (r) out.push(r);
}
writeFileSync(resolve(TMP, "last-probe.json"), JSON.stringify(out, null, 2));
console.log(`\n体检 ${out.length}/${urls.length} 个可访问；明细：data/whitelist/probe/last-probe.json`);
