/**
 * 生成「公开投影逐源授权核对清单」模板（27 个来源）。
 * 自动填入真实 URL/发布单位/标题/行数，标注所需授权依据类型；
 * 待人工核验的字段（basis/evidenceUrl/evidenceText/reviewedAt/各级批准）留空。
 * node scripts/whitelist/gen-approval-checklist.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const db = new DatabaseSync(resolve(ROOT, "data/whitelist.db"), { readOnly: true });

// 与 build-gd-public.mjs 保持一致：条款含禁令、必须书面许可的域名
const WRITTEN_PERMISSION_HOSTS = new Set([
  "szeb.sz.gov.cn",
  "www.ruyuan.gov.cn", "ruyuan.gov.cn",
  "www.gdyunan.gov.cn", "gdyunan.gov.cn",
  "www.yangchun.gov.cn", "yangchun.gov.cn",
  "www.shunde.gov.cn", "shunde.gov.cn",
]);

const rows = db.prepare(`
  SELECT source_key, source_url, publisher, title, city, COUNT(*) n
  FROM wl_rows GROUP BY source_key ORDER BY n DESC
`).all();

const items = rows.map((r) => {
  let host = "";
  try { host = new URL(r.source_url).hostname.toLowerCase(); } catch { host = ""; }
  const needsWritten = WRITTEN_PERMISSION_HOSTS.has(host);
  return {
    key: r.source_key,
    publisher: r.publisher,
    city: r.city,
    rows: r.n,
    url: r.source_url,
    host,
    requiredBasis: needsWritten ? "written_permission" : "site_terms 或 open_data_license",
    basis: "",
    approved: "",
    scope: "",
    evidenceUrl: "",
    evidenceText: "",
    reviewedAt: "",
    explicitReuseAllowed: "",
    linkApproved: "",
    qualityApproved: "",
    contentComplete: "",
    qualityNotes: "",
  };
});

const csvHeader = [
  "来源key", "发布单位", "地市", "行数", "原件URL", "域名",
  "所需授权依据", "basis(填written_permission/open_data_license/site_terms)",
  "approved(true/false)", "scope(填public_directory)",
  "evidenceUrl(授权/条款证据链接)", "evidenceText(证据摘录)", "reviewedAt(YYYY-MM-DD)",
  "explicitReuseAllowed(true/false)", "linkApproved(true/false)",
  "qualityApproved(true/false)", "contentComplete(true/false)", "qualityNotes(质量备注)",
];
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const lines = [csvHeader.join(",")];
for (const it of items) {
  lines.push([
    it.key, it.publisher, it.city, it.rows, it.url, it.host,
    it.requiredBasis, it.basis, it.approved, it.scope,
    it.evidenceUrl, it.evidenceText, it.reviewedAt, it.explicitReuseAllowed,
    it.linkApproved, it.qualityApproved, it.contentComplete, it.qualityNotes,
  ].map(esc).join(","));
}
const outCsv = resolve(ROOT, "data/whitelist/approvals-checklist.csv");
writeFileSync(outCsv, "\uFEFF" + lines.join("\n") + "\n", "utf8");

// 同时产出一个可直接喂给 --approvals 的空模板 JSON（字段结构对齐校验器）
const template = {
  _note: "逐源授权清单模板：approved/scope/basis/evidenceUrl/evidenceText/reviewedAt/linkApproved/qualityApproved/contentComplete/qualityNotes 全填齐且合规，来源才可通过。basis=written_permission 的域名（szeb/ruyuan/yunan/yangchun/shunde）必须有针对性书面许可。",
  sources: items.map((it) => ({
    key: it.key,
    url: it.url,
    publisher: it.publisher,
    rows: it.rows,
    requiredBasis: it.requiredBasis,
    approved: false,
    scope: "",
    basis: "",
    evidenceUrl: "",
    evidenceText: "",
    reviewedAt: "",
    explicitReuseAllowed: false,
    linkApproved: false,
    qualityApproved: false,
    contentComplete: false,
    qualityNotes: "",
  })),
};
writeFileSync(resolve(ROOT, "data/whitelist/approvals-template.json"), JSON.stringify(template, null, 2) + "\n", "utf8");

const written = items.filter((i) => i.requiredBasis === "written_permission");
console.log(`清单已生成：${items.length} 个来源`);
console.log(`  需书面许可（条款含禁令）：${written.length} 个 → ${written.map((i) => i.key).join(", ")}`);
console.log(`  可走 site_terms/open_data_license：${items.length - written.length} 个`);
console.log(`  输出：${outCsv}`);
console.log(`  模板：data/whitelist/approvals-template.json`);
db.close();
