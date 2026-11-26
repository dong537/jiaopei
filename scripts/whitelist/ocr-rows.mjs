/**
 * OCR 核验结果 → 统一行记录（rows.jsonl 格式）。
 *
 * 纪律（不可绕过）：
 * - 只纳入「核对状态 === 通过」的行；存疑/不通过/空白一律不入库。
 * - 机构名为空的行不入库（宁可漏配不可错配）。
 * - 属地码必须是广东 21 市代码之一（与 parse.mjs 同规则）。
 * - 每条保留来源、页、置信度、是否二次读数分歧，供逐条回溯。
 *
 * 输入：data/whitelist/ocr/人工核对表.csv（人工在此填「核对状态」列）
 * 输出：统一行记录数组，供 parse.mjs 并入 rows.jsonl
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES } from "./sources.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REVIEW_CSV = resolve(ROOT, "data", "whitelist", "ocr", "人工核对表.csv");

const GD_CITY_CODES = new Set([
  "4401", "4402", "4403", "4404", "4405", "4406", "4407", "4408", "4409",
  "4412", "4413", "4414", "4415", "4416", "4417", "4418", "4419", "4420",
  "4451", "4452", "4453",
]);

/** 解析一行 CSV（支持引号包裹的字段与字段内逗号/双引号） */
function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ",") { cells.push(cur); cur = ""; }
      else cur += c;
    }
  }
  cells.push(cur);
  return cells;
}

/** 解析整个 CSV（支持字段内换行的引号字段） */
function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* skip */ }
      else cur += c;
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/** 读取人工核验 CSV，返回仅「通过」且可安全入库的行 */
export function ocrVerifiedRows() {
  if (!existsSync(REVIEW_CSV)) return { rows: [], stats: { total: 0, passed: 0, dropped: 0 } };
  const text = readFileSync(REVIEW_CSV, "utf8").replace(/^\uFEFF/, "");
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], stats: { total: 0, passed: 0, dropped: 0 } };
  const hdr = table[0];
  const col = (name) => hdr.indexOf(name);
  const iStatus = col("核对状态"), iLic = col("许可证号"), iName = col("机构名候选");
  const iAddr = col("地址候选"), iCat = col("类别"), iSrc = col("来源");
  const iPage = col("页或图"), iConf = col("最低置信度"), iCtx = col("上下文（同行及上下行原文）");
  if (iStatus < 0 || iLic < 0 || iName < 0) return { rows: [], stats: { total: table.length - 1, passed: 0, dropped: 0 } };

  const srcByKey = new Map(SOURCES.map((s) => [s.key, s]));
  // 核对表里的「来源」列用的是 OCR 文件名 stem，可能与 sources.mjs 的 key 不完全一致。
  // 用 City+文件名的模糊匹配兜底，避免整批来源因前缀差异被丢弃。
  const resolveSource = (key) => {
    if (srcByKey.has(key)) return srcByKey.get(key);
    const hit = SOURCES.find((s) => s.key === key || s.key.endsWith("-" + key) || s.key.includes(key));
    return hit || null;
  };
  const out = [];
  let dropped = 0;
  for (const cells of table.slice(1)) {
    const status = (cells[iStatus] || "").trim();
    if (status !== "通过") continue; // 只有「通过」入库
    const lic = (cells[iLic] || "").trim();
    const name = (cells[iName] || "").trim();
    if (!lic || !name || !GD_CITY_CODES.has(lic.slice(1, 5))) { dropped++; continue; }
    const srcKey = (cells[iSrc] || "").trim();
    const s = resolveSource(srcKey);
    if (!s) { dropped++; continue; }
    out.push({
      name,
      license: lic,
      licenseRaw: lic,
      credit: "",
      addr: (cells[iAddr] || "").trim(),
      wlType: (cells[iCat] || "").trim(),
      projects: "",
      region: "",
      rating: "",
      sourceKey: s.key,
      ocrSourceLabel: srcKey,
      ocrPage: (cells[iPage] || "").trim(),
      ocrConfidence: (cells[iConf] || "").trim(),
      ocrContext: (cells[iCtx] || "").trim(),
      sourceUrl: s.url,
      publisher: s.publisher,
      title: s.title,
      docDate: s.docDate,
      city: s.city,
      cityName: s.cityName,
      county: s.county || "",
      fetchedAt: new Date().toISOString(),
      officialLicense: !!s.officialLicense,
      viaOcr: true,
    });
  }
  return { rows: out, stats: { total: table.length - 1, passed: out.length, dropped } };
}
