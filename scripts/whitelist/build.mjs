/**
 * 白名单落库 + 与工商名录匹配 → data/whitelist.db
 *
 * 匹配策略（保守，逐级降权，全部留痕 match_type）：
 *   1. credit      统一社会信用代码完全相同（最强，仅少数名单刊载）
 *   2. name        机构名称原文完全相同
 *   3. name_norm   剔除全角/括号/空白/标点后相同
 *
 * 不做模糊匹配、不做地址相似度、不做人工改名推断。匹配不上的白名单行照样入库，
 * 它们是「持证但工商库无对应主体」的线索（多为民办非企业单位），本身有信息价值。
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WL_DIR } from "./fetch.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GD_DB = resolve(ROOT, "data", "gd.db");
const OUT_DB = resolve(ROOT, "data", "whitelist.db");
const ROWS_JSONL = resolve(WL_DIR, "rows.jsonl");

export function normName(s) {
  return (s || "")
    .normalize("NFKC")
    .replace(/[\s\u3000]/g, "")
    .replace(/[（）()【】\[\]{}·、，,。.;；:：'"“”‘’\-—_/\\|]/g, "")
    .toLowerCase();
}

/**
 * 办学许可证号内含行政区划码：第 2~5 位是地级市代码（44 开头为广东）。
 * 例：244191470000029 → 4419 = 东莞。
 * 用它交叉校验"名单说自己在哪个市"和"号码说自己在哪个市"，是免费的自检。
 */
const CITY_CODES = {
  4401: "guangzhou", 4402: "shaoguan", 4403: "shenzhen", 4404: "zhuhai",
  4405: "shantou", 4406: "foshan", 4407: "jiangmen", 4408: "zhanjiang",
  4409: "maoming", 4412: "zhaoqing", 4413: "huizhou", 4414: "meizhou",
  4415: "shanwei", 4416: "heyuan", 4417: "yangjiang", 4418: "qingyuan",
  4419: "dongguan", 4420: "zhongshan", 4451: "chaozhou", 4452: "jieyang",
  4453: "yunfu",
};

function cityCodeOf(licenseNo) {
  const code = (licenseNo || "").slice(1, 5);
  return CITY_CODES[code] ? { code, slug: CITY_CODES[code] } : { code, slug: "" };
}

/* ---------- 读入解析结果 ---------- */
if (!existsSync(ROWS_JSONL)) {
  console.error(`找不到 ${ROWS_JSONL}，请先运行 node scripts/whitelist.mjs parse`);
  process.exit(1);
}
const rows = readFileSync(ROWS_JSONL, "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));
console.log(`解析行：${rows.length}`);

/* ---------- 建库（保留上一版本快照，供增量对比） ---------- */
import { copyFileSync, mkdirSync, renameSync, existsSync as _exists, rmSync as _rm } from "node:fs";
const SNAP_DIR = resolve(WL_DIR, "snapshots");
const OUT_TMP = resolve(ROOT, "data", "whitelist.db.tmp");
let prevRowsById = new Map(); // 上一版本的 row_id -> {license_no,name}，用于增量对比
if (existsSync(OUT_DB)) {
  // 1) 先读旧库的“上一版本”行，用于计算本版本新增/消失。
  const prev = new DatabaseSync(OUT_DB, { readOnly: true });
  for (const r of prev.prepare("SELECT id, license_no, name, name_norm FROM wl_rows").all()) {
    prevRowsById.set(r.id, r);
  }
  prev.close();
  // 2) 复制快照（不删除旧库数据，保留审计线索）。
  mkdirSync(SNAP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  copyFileSync(OUT_DB, resolve(SNAP_DIR, `whitelist-${ts}.db`));
}
// 3) 清掉可能残留的临时库（上一轮中断可能留下），保证本次从空库重建。
if (_exists(OUT_TMP)) {
  try { _rm(OUT_TMP); } catch { /* 残留 tmp 无法删除时，改用带时间戳的唯一临时名 */ }
}
// 4) 新库写入临时文件，最后原子替换。
const db = new DatabaseSync(OUT_TMP);
db.exec(`
  PRAGMA journal_mode = OFF;
  PRAGMA synchronous = OFF;
  CREATE TABLE wl_rows (
    id INTEGER PRIMARY KEY,
    license_no TEXT NOT NULL,
    name TEXT NOT NULL,
    name_norm TEXT NOT NULL,
    credit TEXT,
    addr TEXT, wl_type TEXT, projects TEXT, region TEXT,
    county TEXT, city TEXT, city_slug TEXT,
    license_city_code TEXT, license_city_slug TEXT, city_code_match INTEGER,
    source_key TEXT, source_url TEXT, publisher TEXT, title TEXT,
    doc_date TEXT, fetched_at TEXT, official_license INTEGER,
    annual_rating TEXT,
    via_ocr INTEGER DEFAULT 0, ocr_page TEXT, ocr_confidence TEXT
  );
`);

const ins = db.prepare(
  `INSERT INTO wl_rows
   (license_no,name,name_norm,credit,addr,wl_type,projects,region,county,city,city_slug,
    license_city_code,license_city_slug,city_code_match,
    source_key,source_url,publisher,title,doc_date,fetched_at,official_license,
    annual_rating, via_ocr, ocr_page, ocr_confidence)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)` ,
);

const codeStats = { match: 0, mismatch: 0, unknown: 0 };

db.exec("BEGIN");
for (const r of rows) {
  const cc = cityCodeOf(r.license);
  const match = cc.slug ? (cc.slug === r.city ? 1 : 0) : null;
  if (match === 1) codeStats.match++;
  else if (match === 0) codeStats.mismatch++;
  else codeStats.unknown++;

  ins.run(
    r.license, r.name, normName(r.name), (r.credit || "").toUpperCase(),
    r.addr || "", r.wlType || "", r.projects || "", r.region || "",
    r.county || "", r.cityName || "", r.city || "",
    cc.code, cc.slug, match === null ? null : match,
    r.sourceKey, r.sourceUrl, r.publisher, r.title, r.docDate || "", r.fetchedAt || "",
    r.officialLicense ? 1 : 0,
    r.rating || "",
    r.viaOcr ? 1 : 0, r.ocrPage || "", r.ocrConfidence || "",
  );
}
db.exec("COMMIT");

/* ---------- 匹配 ---------- */
if (!existsSync(GD_DB)) {
  console.error(`找不到 ${GD_DB}，请先运行 node scripts/build-gd-db.mjs`);
  process.exit(1);
}
const gd = new DatabaseSync(GD_DB, { readOnly: true });
const orgs = gd
  .prepare("SELECT id, name, credit, city_slug, category, relevance FROM orgs")
  .all();
gd.close();

const byCredit = new Map();
const byName = new Map();
// 名称规范化索引按「城市」分区，避免跨城市同名连锁（如“童画”“神墨”）被误配。
// 键为 `${city_slug}|${norm}`；city_slug 为空的主体只进 byNormGlobal 作为兜底（见下）。
const byNorm = new Map();
const byNormGlobal = new Map();
for (const o of orgs) {
  if (o.credit) byCredit.set(o.credit.toUpperCase(), o);
  const n = (o.name || "").trim();
  if (n && !byName.has(n)) byName.set(n, o);
  const nn = normName(o.name);
  if (!nn) continue;
  const city = (o.city_slug || "").trim();
  if (city && !byNorm.has(`${city}|${nn}`)) {
    byNorm.set(`${city}|${nn}`, o);
  }
  if (!byNormGlobal.has(nn)) byNormGlobal.set(nn, o);
}

/**
 * 名称规范化命中：优先在「同城市」分区内找；找不到时用全局兜底，
 * 但兜底命中必须在匹配阶段显式降级为 name_norm_uncity 并进复核（见 wl_review），
 * 而不是直接落 wl_match——跨城市同名不能自动认定为同一机构。
 */
function normHit(citySlug, nameNorm) {
  const city = (citySlug || "").trim();
  if (city && byNorm.has(`${city}|${nameNorm}`)) {
    return { org: byNorm.get(`${city}|${nameNorm}`), scoped: true };
  }
  const org = byNormGlobal.get(nameNorm) || null;
  return { org, scoped: false };
}

db.exec(`
  CREATE TABLE wl_match (
    org_id TEXT PRIMARY KEY,
    license_no TEXT NOT NULL,
    row_id INTEGER NOT NULL,
    match_type TEXT NOT NULL,
    org_city TEXT, org_category TEXT, org_relevance TEXT
  );
  CREATE TABLE wl_review (
    row_id INTEGER PRIMARY KEY,
    license_no TEXT, name TEXT, credit TEXT,
    name_org TEXT, credit_org TEXT, reason TEXT
  );
`);
const insMatch = db.prepare(
  `INSERT OR REPLACE INTO wl_match
   (org_id, license_no, row_id, match_type, org_city, org_category, org_relevance)
   VALUES (?,?,?,?,?,?,?)`,
);
const insReview = db.prepare(
  "INSERT INTO wl_review (row_id, license_no, name, credit, name_org, credit_org, reason) VALUES (?,?,?,?,?,?,?)",
);

const tally = { credit: 0, name: 0, name_norm: 0, conflict: 0, none: 0, shared_license: 0 };
const all = db
  .prepare("SELECT id, license_no, name, name_norm, credit, city_slug FROM wl_rows")
  .all();

// 许可证号唯一性预扫描（多地市核对 2026-11-23 发现）：
// 东莞/茂名部分名单原件把同一个许可证号刊给两家不同机构（不同名称、不同信用代码）。
// 这类号码不能作为「已核验资质」——若照常匹配，两家机构会各自在详情页显示同一张证。
// 这里按号码统计不同 name_norm 的数量，>1 的号码全部进复核队列，不落 wl_match。
// 「（分教点）/（分校）/（教学点）」是同一张证下的合法教学点，不是不同机构。
// 判断共号前先剥掉这类后缀，否则广州番禺的「XX中心」+「XX中心(分教点)」会被误判为共用。
const stripCampus = (n) =>
  (n || "").replace(/[（(](分教点|分校|教学点|校区)[）)]/g, "");
const nameNormByLicense = new Map(); // license_no -> Set<去掉教学点后缀的 name_norm>
for (const r of all) {
  if (!nameNormByLicense.has(r.license_no)) nameNormByLicense.set(r.license_no, new Set());
  nameNormByLicense.get(r.license_no).add(normName(stripCampus(r.name)));
}
const sharedLicenses = new Set(
  [...nameNormByLicense].filter(([, names]) => names.size > 1).map(([lic]) => lic),
);
if (sharedLicenses.size) {
  console.log(`\n! 发现 ${sharedLicenses.size} 个许可证号被多家不同机构共用，已打入复核队列：`);
  for (const lic of sharedLicenses) console.log(`    ${lic}`);
}

db.exec("BEGIN");
for (const r of all) {
  // 共用许可证号：原件缺陷，不把存疑号码当已核验资质。
  if (sharedLicenses.has(r.license_no)) {
    insReview.run(r.id, r.license_no, r.name, r.credit, "", "", "license_shared_by_multiple_orgs");
    tally.shared_license++;
    continue;
  }
  // 号码必须能自证属地：区划码不在广东 21 市、或与名单发布地不符，都不进匹配。
  // 前者多是名单原件把其中一位打错（如 2441… 写成 2241…），后者说明这一行的
  // 号码与机构不是同一条记录——两种都不该显示在机构页上。
  const cc = cityCodeOf(r.license_no);
  const cityMatch = cc.slug ? (cc.slug === r.city_slug ? 1 : 0) : null;
  if (cityMatch !== 1) {
    insReview.run(
      r.id,
      r.license_no,
      r.name,
      r.credit,
      "",
      cc.slug || `code:${cc.code}`,
      cityMatch === 0 ? "license_city_mismatch" : "license_city_code_unknown",
    );
    tally.conflict++;
    continue;
  }

  // 名称命中与信用代码命中分别计算，二者指向不同主体时判为冲突，宁可不匹配
  let nameHit = byName.get(r.name) || null;
  let nameType = nameHit ? "name" : "";
  if (!nameHit) {
    const nh = normHit(r.city_slug, r.name_norm);
    if (nh.org) {
      if (nh.scoped) {
        // 同城市分区内规范化命中：采用（必须把命中主体赋给 nameHit，否则后面按 null 处理）。
        nameHit = nh.org;
        nameType = "name_norm";
      } else {
        // 全局兜底命中但城市不匹配/城市缺失：进复核，不落匹配。
        // 这是跨城市同名连锁（童画/神墨）与“库方城市为空”的唯一安全出口。
        insReview.run(
          r.id, r.license_no, r.name, r.credit,
          nh.org.name, nh.org.credit || "",
          "name_norm_unscoped_city",
        );
        tally.conflict++;
        continue;
      }
    }
  }
  const creditHit = r.credit ? byCredit.get(r.credit.toUpperCase()) || null : null;

  if (nameHit && creditHit && nameHit.id !== creditHit.id) {
    insReview.run(r.id, r.license_no, r.name, r.credit, nameHit.name, creditHit.name, "name_vs_credit_conflict");
    tally.conflict++;
    continue;
  }

  // 只有信用代码命中、名称对不上：不收。已实测这种情况多来自 PDF 单元格错位，
  // 收下会把 A 机构的号码挂到 B 机构头上——比不匹配危害大得多。
  if (!nameHit && creditHit && normName(creditHit.name) !== r.name_norm) {
    insReview.run(r.id, r.license_no, r.name, r.credit, "", creditHit.name, "credit_name_mismatch");
    tally.conflict++;
    continue;
  }

  const hit = nameHit || creditHit;
  if (!hit) {
    tally.none++;
    continue;
  }
  const type = nameHit ? nameType : "credit";
  insMatch.run(hit.id, r.license_no, r.id, type, hit.city_slug || "", hit.category || "", hit.relevance || "");
  tally[type]++;
}
db.exec("COMMIT");

/* ---------- 增量对比：本版本新增 / 消失的行 ---------- */
// 名单是“发布时观察”，同一机构在上版本存在、本版本消失，是停办/更名/名单更新的信号，
// 不能随重建丢失。这里用（许可证号+名称）作稳定键对比上一版本快照。
db.exec(`
  CREATE TABLE wl_delta (
    key TEXT PRIMARY KEY,        -- license_no + '|' + name_norm
    license_no TEXT NOT NULL,
    name TEXT NOT NULL,
    delta TEXT NOT NULL,         -- 'added' | 'removed'
    prev_build_at TEXT,          -- 上一版本重建时间（从快照文件名无法精确取，留空由调用方填）
    built_at TEXT NOT NULL
  );
`);
const builtAt = new Date().toISOString();
const insDelta = db.prepare(
  "INSERT INTO wl_delta (key, license_no, name, delta, built_at) VALUES (?,?,?,?,?)",
);
db.exec("BEGIN");
const curKeys = new Map();
for (const r of all) {
  curKeys.set(`${r.license_no}|${r.name_norm}`, r);
}
// 新增：本版本有、上一版本无
for (const [k, r] of curKeys) {
  if (!prevRowsById.size || ![...prevRowsById.values()].some((p) => `${p.license_no}|${p.name_norm}` === k)) {
    insDelta.run(k, r.license_no, r.name, "added", builtAt);
  }
}
// 消失：上一版本有、本版本无
if (prevRowsById.size) {
  for (const p of prevRowsById.values()) {
    const k = `${p.license_no}|${p.name_norm}`;
    if (!curKeys.has(k)) insDelta.run(k, p.license_no, p.name, "removed", builtAt);
  }
}
db.exec("COMMIT");
const added = db.prepare("SELECT COUNT(*) n FROM wl_delta WHERE delta='added'").get().n;
const removed = db.prepare("SELECT COUNT(*) n FROM wl_delta WHERE delta='removed'").get().n;
if (prevRowsById.size) console.log(`\n增量：本版本新增 ${added} 行、较上版本消失 ${removed} 行（见 wl_delta）`);

db.exec(`
  CREATE INDEX idx_wl_license ON wl_rows(license_no);
  CREATE INDEX idx_wl_norm ON wl_rows(name_norm);
  CREATE INDEX idx_wl_city ON wl_rows(city_slug);
  CREATE INDEX idx_match_license ON wl_match(license_no);
  ANALYZE;
`);

/* ---------- 统计 ---------- */
const licenses = db.prepare("SELECT COUNT(DISTINCT license_no) AS n FROM wl_rows").get().n;
const matchedOrgs = db.prepare("SELECT COUNT(*) AS n FROM wl_match").get().n;
const cities = db.prepare("SELECT city_slug, city, COUNT(DISTINCT license_no) AS n FROM wl_rows GROUP BY city_slug ORDER BY n DESC").all();

console.log(`\n白名单行 ${all.length}｜不同许可证号 ${licenses}｜匹配到工商主体 ${matchedOrgs}`);
console.log(
  `匹配构成：名称完全一致 ${tally.name}｜规范化一致 ${tally.name_norm}｜信用代码 ${tally.credit}｜` +
    `冲突挂起 ${tally.conflict}｜未匹配 ${tally.none}`,
);
console.log("\n按地市（许可证号数）：");
for (const c of cities) console.log(`  ${c.city || c.city_slug}  ${c.n}`);
console.log(
  `\n号码属地自检：一致 ${codeStats.match}｜与名单发布地不符 ${codeStats.mismatch}｜区划码不在广东 21 市 ${codeStats.unknown}`,
);
if (codeStats.mismatch) {
  const bad = db
    .prepare(
      `SELECT license_no, name, city, license_city_slug FROM wl_rows
        WHERE city_code_match = 0 LIMIT 8`,
    )
    .all();
  for (const b of bad) console.log(`  ! ${b.license_no} ${b.name} 名单=${b.city} 号码=${b.license_city_slug}`);
}
console.log(`\n输出：${OUT_DB}`);
db.close();

// 原子替换：关闭临时库后 rename 到正式路径。
// Windows 上 rename 覆盖已存在且被占用/保护的文件会 EPERM，降级为 cp 覆盖内容
//（cp 直接写文件内容，不换 inode，可绕过「文件被只读打开」的锁；旧库已快照，安全）。
try {
  renameSync(OUT_TMP, OUT_DB);
} catch (e) {
  try {
    copyFileSync(OUT_TMP, OUT_DB);
    _rm(OUT_TMP);
  } catch (e2) {
    console.error(`\n⚠ 无法替换 ${OUT_DB}（${e2?.message || e2}）。`);
    console.error(`  新库已完整生成于 ${OUT_TMP}，请手动关闭占用 ${OUT_DB} 的进程后，用 cp 覆盖。`);
    process.exit(1);
  }
}
console.log(`已替换 ${OUT_DB}（上一版本快照见 data/whitelist/snapshots/）`);
