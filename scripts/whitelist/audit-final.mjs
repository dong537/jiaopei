/**
 * 端到端质量审计（独立只读）：whitelist.db + gd.db + 公开投影 + 收据/原件。
 * 不修改任何数据，只输出 JSON 审计结果。
 * node scripts/whitelist/audit-final.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const wl = new DatabaseSync(resolve(ROOT, "data/whitelist.db"), { readOnly: true });
const gd = new DatabaseSync(resolve(ROOT, "data/gd.db"), { readOnly: true });
const out = {};

/* ---- 1. 总量与计数口径 ---- */
out.counts = {
  rows: wl.prepare("SELECT COUNT(*) n FROM wl_rows").get().n,
  distinctLicenses: wl.prepare("SELECT COUNT(DISTINCT license_no) n FROM wl_rows").get().n,
  matches: wl.prepare("SELECT COUNT(*) n FROM wl_match").get().n,
  reviews: wl.prepare("SELECT COUNT(*) n FROM wl_review").get().n,
  cities: wl.prepare("SELECT COUNT(DISTINCT city_slug) n FROM wl_rows WHERE city_slug<>''").get().n,
  sources: wl.prepare("SELECT COUNT(DISTINCT source_key) n FROM wl_rows").get().n,
};

/* ---- 2. 号码质量 ---- */
const GD = new Set(["4401","4402","4403","4404","4405","4406","4407","4408","4409","4412","4413","4414","4415","4416","4417","4418","4419","4420","4451","4452","4453"]);
const cols = new Set(wl.prepare("PRAGMA table_info(wl_rows)").all().map(c => c.name));
const viaOcrExpr = cols.has("via_ocr") ? "via_ocr" : "0";
const allRows = wl.prepare(`SELECT id,license_no,name,city,city_slug,license_city_code,city_code_match,source_key,annual_rating,credit,${viaOcrExpr} AS via_ocr FROM wl_rows`).all();
const OCR_SOURCES = new Set(["shanwei-2025-10", "qingyuan-yingde-2026-04"]);
out.licenseQuality = {
  badFormat: allRows.filter(r => !/^(1|2|4)\d{14}$/.test(r.license_no)).map(r => ({ id:r.id, lic:r.license_no })),
  badCityCode: allRows.filter(r => !GD.has(String(r.license_no).slice(1,5))).map(r => ({ id:r.id, lic:r.license_no, name:r.name })),
  cityMismatch: allRows.filter(r => r.city_code_match === 0).map(r => ({ id:r.id, lic:r.license_no, name:r.name, city:r.city, code:r.license_city_code })),
  // 一证多主体：已匹配里同号码挂多个 org
  multiOrg: wl.prepare("SELECT license_no, COUNT(DISTINCT org_id) n FROM wl_match GROUP BY license_no HAVING n>1").all(),
  // 一号多名单行（不同名称）
  multiName: wl.prepare("SELECT license_no, COUNT(DISTINCT name) n FROM wl_rows GROUP BY license_no HAVING n>1").all(),
};

/* ---- 3. 匹配质量 ---- */
const matches = wl.prepare("SELECT m.org_id,m.license_no,m.row_id,m.match_type,m.org_city FROM wl_match m").all();
const rowById = new Map(allRows.map(r => [r.id, r]));
out.matchQuality = {
  byType: wl.prepare("SELECT match_type,COUNT(*) n FROM wl_match GROUP BY match_type").all(),
  // 跨城市匹配：名单城市 vs 工商主体城市不一致
  crossCity: matches.filter(m => {
    const r = rowById.get(m.row_id);
    return r && m.org_city && r.city_slug && m.org_city !== r.city_slug;
  }).map(m => ({ lic:m.license_no, wlCity:rowById.get(m.row_id)?.city_slug, orgCity:m.org_city, type:m.match_type })),
  // 匹配行里仍有 credit 的（理论上很少，白名单多不刊信用代码）
  matchedWithCredit: allRows.filter(r => r.credit && rowById.has(r.id) && matches.some(m => m.row_id === r.id)).length,
  reviewsByReason: wl.prepare("SELECT reason,COUNT(*) n FROM wl_review GROUP BY reason").all(),
};

/* ---- 4. 字段覆盖 ---- */
out.fieldCoverage = {
  annualRating: allRows.filter(r => r.annual_rating).length,
  ratingDist: wl.prepare("SELECT annual_rating,COUNT(*) n FROM wl_rows WHERE annual_rating<>'' GROUP BY annual_rating").all(),
  viaOcrBySource: allRows.filter(r => OCR_SOURCES.has(r.source_key)).length,
  viaOcrFlagged: allRows.filter(r => r.via_ocr === 1).length,
  viaOcrColumnExists: cols.has("via_ocr"),
  withCredit: allRows.filter(r => r.credit).length,
  officialLicense: allRows.filter(r => r.official_license).length,
};

/* ---- 5. 来源完整性：收据/原件/SHA-256 ---- */
const receiptsDir = resolve(ROOT, "data/whitelist/receipts");
const rawDir = resolve(ROOT, "data/whitelist/raw");
const srcKeys = [...new Set(allRows.map(r => r.source_key).filter(Boolean))];
const receiptFiles = existsSync(receiptsDir) ? readdirSync(receiptsDir).filter(f => f.endsWith(".json")) : [];
const srcIntegrity = srcKeys.map(key => {
  const rp = resolve(receiptsDir, key + ".json");
  let receipt = null, shaOk = null, rawExists = null, httpStatus = null;
  if (existsSync(rp)) {
    try {
      receipt = JSON.parse(readFileSync(rp, "utf8"));
      httpStatus = receipt.httpStatus;
      if (receipt.rawFile) {
        const fp = resolve(rawDir, receipt.rawFile);
        rawExists = existsSync(fp);
        if (rawExists && receipt.sha256) {
          const h = createHash("sha256").update(readFileSync(fp)).digest("hex");
          shaOk = (h === receipt.sha256);
        }
      }
    } catch { receipt = null; }
  }
  return { key, receipt: !!receipt, httpStatus, rawExists, shaOk };
});
out.sourceIntegrity = {
  sources: srcIntegrity,
  missingReceipt: srcIntegrity.filter(s => !s.receipt).map(s => s.key),
  non200: srcIntegrity.filter(s => s.receipt && s.httpStatus !== 200).map(s => ({ key:s.key, http:s.httpStatus })),
  rawMissing: srcIntegrity.filter(s => s.rawExists === false).map(s => s.key),
  shaMismatch: srcIntegrity.filter(s => s.shaOk === false).map(s => s.key),
  receiptCount: receiptFiles.length,
};

/* ---- 6. 公开投影合规 ---- */
const proj = JSON.parse(readFileSync(resolve(ROOT, "data/whitelist/gd-public-preview.json"), "utf8"));
const PII_FIELDS = ["legal","phone","mobile","creditCode","credit","法定代表人","手机号","注册资本","capital","legalPerson","contact"];
const recFields = Object.keys(proj.records[0]);
out.projection = {
  preview: proj.preview,
  recordCount: proj.records.length,
  sourceCount: proj.sources.length,
  hasPIIFields: recFields.filter(f => PII_FIELDS.some(p => f.toLowerCase().includes(p.toLowerCase()))),
  fields: recFields,
  sourceKinds: proj.records.reduce((a,r) => { a[r.sourceKind]=(a[r.sourceKind]||0)+1; return a; }, {}),
  annualCheckWithRating: proj.records.filter(r => r.sourceKind === "annual_check" && r.annualRating).length,
  // 有 rating 但 sourceKind 不是 annual_check（口径可能错）
  ratingNonAnnual: proj.records.filter(r => r.annualRating && r.sourceKind !== "annual_check").map(r => ({name:r.name, rating:r.annualRating, kind:r.sourceKind})).slice(0,10),
  // 关键字段缺失
  missingRequired: proj.records.filter(r => !r.licenseNo || !r.name || !r.sourceUrl || !r.publisher).length,
  stats: proj.stats,
};

console.log(JSON.stringify(out, null, 2));
wl.close(); gd.close();
