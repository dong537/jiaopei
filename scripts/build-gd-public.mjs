/**
 * 广东官方名录的独立公开候选投影。默认只生成私有预览；不访问外网。
 * node scripts/build-gd-public.mjs
 * node scripts/build-gd-public.mjs --publish --approvals <private.json>
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DB = resolve(ROOT, "data", "whitelist.db");
const PREVIEW_FILE = resolve(ROOT, "data", "whitelist", "gd-public-preview.json");
const RELEASE_FILE = resolve(ROOT, "data", "gd-public-release.json");
const RECEIPT_DIR = resolve(ROOT, "data", "whitelist");

// 年检是历史观察，不应冒称现时有效白名单。
const ANNUAL_CHECK_KEYS = new Set([
  "dongguan-2025-annual-check",
  "shaoguan-shixing-2025-annual",
  "shenzhen-city-2024-check",
  "shenzhen-futian-2024-check",
  "shenzhen-nanshan-2024-check",
  "shenzhen-yantian-2024-check",
  "shenzhen-dapeng-2024-check",
]);

const OFFICIAL_WHITELIST_KEYS = new Set([
  "shaoguan-ruyuan-2026-01",
  "maoming-maonan-2026-07",
  "maoming-dianbai-2026-07",
  "maoming-xinyi-2026-07",
  "maoming-gaozhou-2026-07",
  "maoming-huazhou-2026-07",
  "maoming-binhai-2026-07",
  "yunfu-luoding-2026-01",
  "yunfu-yunan-2026-09",
  "yangjiang-yangchun-2026-04",
  "shanwei-2025-10",
  "guangzhou-huangpu-pdf",
  "guangzhou-panyu",
  "qingyuan-yingde-2026-04",
  "heyuan-dongyuan-2026-01",
  "chaozhou-raoping-2025-07",
]);

const AFTER_SCHOOL_REFERENCE_KEYS = new Set(["shaoguan-xinfeng-2025-10"]);
const SINGLE_LICENSE_NOTICE_KEYS = new Set(["zhaoqing-gaoyao-2025-12", "foshan-shunde-2025-27", "foshan-chancheng-2025-setup"]);

function sourceKindFor(sourceKey) {
  if (ANNUAL_CHECK_KEYS.has(sourceKey)) return "annual_check";
  if (AFTER_SCHOOL_REFERENCE_KEYS.has(sourceKey)) return "after_school_reference";
  if (SINGLE_LICENSE_NOTICE_KEYS.has(sourceKey)) return "single_license_notice";
  if (OFFICIAL_WHITELIST_KEYS.has(sourceKey)) return "official_whitelist";
  throw new Error("未分类来源 " + sourceKey + "；先核对用途再加入投影");
}

function optionalText(value) {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result || null;
}

const identityName = (name) => name.normalize("NFKC").replace(/\s+/gu, "").trim();
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function requireSourceFields(row) {
  for (const field of ["licenseNo", "name", "citySlug", "city", "sourceKey", "sourceUrl", "publisher", "title"]) {
    if (!optionalText(row[field])) throw new Error("名单行 " + (row.id ?? "?") + " 缺少必需字段 " + field);
  }
  sourceKindFor(row.sourceKey);
  try {
    const url = new URL(row.sourceUrl);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("invalid scheme");
  } catch {
    throw new Error("名单行 " + (row.id ?? "?") + " 的来源 URL 无效");
  }
}

function compareForDisplay(a, b) {
  // 日期缺失的来源不会压过有名单截至/观察日期的来源；抓取时间只是二级排序。
  for (const key of ["asOf", "collectedAt"]) {
    const delta = (optionalText(b[key]) ?? "").localeCompare(optionalText(a[key]) ?? "");
    if (delta) return delta;
  }
  return a.sourceKey.localeCompare(b.sourceKey) || a.id - b.id;
}

/** 输入为官方名单原始行；一条许可证仅选一个展示观察。 */
export function buildProjection(rows, reviewRowIds = new Set(), generatedAt = new Date().toISOString(), approvedSourceKeys = null) {
  if (!Array.isArray(rows) || !(reviewRowIds instanceof Set) || (approvedSourceKeys !== null && !(approvedSourceKeys instanceof Set))) {
    throw new TypeError("rows、reviewRowIds 或 approvedSourceKeys 类型无效");
  }
  for (const row of rows) requireSourceFields(row);

  // 同号异名即使一侧已进入复核队列，也阻断整个号码的自动公开。
  const namesByLicense = new Map();
  for (const row of rows) {
    const names = namesByLicense.get(row.licenseNo) ?? new Set();
    names.add(identityName(row.name));
    namesByLicense.set(row.licenseNo, names);
  }
  const conflictingLicenses = new Set(
    [...namesByLicense].filter(([, names]) => names.size > 1).map(([number]) => number),
  );

  const stats = {
    rawRows: rows.length,
    excludedReview: 0,
    excludedCityCode: 0,
    excludedConflict: 0,
    excludedUnapproved: 0,
    deduplicated: 0,
    recordCount: 0,
    sourceCount: 0,
    cityCount: 0,
  };
  const eligible = [];
  for (const row of rows) {
    if (reviewRowIds.has(row.id)) stats.excludedReview++;
    else if (row.cityCodeMatch !== 1) stats.excludedCityCode++;
    else if (conflictingLicenses.has(row.licenseNo)) stats.excludedConflict++;
    else if (approvedSourceKeys !== null && !approvedSourceKeys.has(row.sourceKey)) stats.excludedUnapproved++;
    else eligible.push(row);
  }

  const chosenByLicense = new Map();
  for (const row of eligible) {
    const previous = chosenByLicense.get(row.licenseNo);
    if (previous) {
      stats.deduplicated++;
      if (compareForDisplay(row, previous) < 0) chosenByLicense.set(row.licenseNo, row);
    } else {
      chosenByLicense.set(row.licenseNo, row);
    }
  }

  const records = [...chosenByLicense.values()]
    .map((row) => ({
      id: "gd-official-" + sha256(row.licenseNo).slice(0, 20),
      name: row.name,
      licenseNo: row.licenseNo,
      city: row.city,
      citySlug: row.citySlug,
      county: optionalText(row.county),
      address: optionalText(row.address),
      trainingType: optionalText(row.trainingType),
      projects: optionalText(row.projects),
      sourceKey: row.sourceKey,
      sourceUrl: row.sourceUrl,
      publisher: row.publisher,
      title: row.title,
      publishedAt: optionalText(row.publishedAt),
      asOf: optionalText(row.asOf),
      collectedAt: optionalText(row.collectedAt),
      annualRating: optionalText(row.annualRating),
      sourceKind: sourceKindFor(row.sourceKey),
    }))
    .sort((a, b) => a.citySlug.localeCompare(b.citySlug) || a.name.localeCompare(b.name, "zh-CN") || a.licenseNo.localeCompare(b.licenseNo));

  const sourcesByKey = new Map();
  for (const record of records) {
    const source = sourcesByKey.get(record.sourceKey);
    if (source) {
      if (source.url !== record.sourceUrl || source.publisher !== record.publisher || source.title !== record.title) {
        throw new Error("来源键 " + record.sourceKey + " 对应多套元数据，停止投影");
      }
      source.recordCount++;
      continue;
    }
    sourcesByKey.set(record.sourceKey, {
      key: record.sourceKey,
      publisher: record.publisher,
      title: record.title,
      url: record.sourceUrl,
      publishedAt: record.publishedAt,
      asOf: record.asOf,
      citySlug: record.citySlug,
      city: record.city,
      county: record.county,
      recordCount: 1,
      sourceKind: record.sourceKind,
    });
  }
  const sources = [...sourcesByKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  stats.recordCount = records.length;
  stats.sourceCount = sources.length;
  stats.cityCount = new Set(records.map((record) => record.citySlug)).size;
  if (stats.rawRows !== stats.excludedReview + stats.excludedCityCode + stats.excludedConflict + stats.excludedUnapproved + stats.deduplicated + stats.recordCount) {
    throw new Error("投影统计无法对账");
  }
  return { generatedAt, preview: true, records, sources, stats };
}

// 已有明确禁止未经授权再利用的条款，不得用普通网站条款覆盖禁令。
const WRITTEN_PERMISSION_HOSTS = new Set([
  "szeb.sz.gov.cn",
  "www.ruyuan.gov.cn", "ruyuan.gov.cn",
  "www.gdyunan.gov.cn", "gdyunan.gov.cn",
  "www.yangchun.gov.cn", "yangchun.gov.cn",
  "www.shunde.gov.cn", "shunde.gov.cn",
]);

function approvalIssue(source, entry) {
  if (!entry || entry.approved !== true || entry.scope !== "public_directory") return "缺少公开目录再利用授权";
  if (entry.url !== source.url) return "授权 URL 与原件不一致";
  if (!["written_permission", "open_data_license", "site_terms"].includes(entry.basis)) return "缺少有效授权依据类型";
  const hostname = new URL(source.url).hostname.toLowerCase();
  if (WRITTEN_PERMISSION_HOSTS.has(hostname) && entry.basis !== "written_permission") return "该来源条款含禁令，须有针对本用途的书面许可";
  if (!optionalText(entry.evidenceText) || !/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt ?? "")) return "缺少授权证据摘录或核验日期";
  try {
    const url = new URL(entry.evidenceUrl);
    if (!["https:", "http:"].includes(url.protocol)) return "缺少有效授权证据链接";
  } catch {
    return "缺少有效授权证据链接";
  }
  if (entry.linkApproved !== true) return "缺少对原文来源链接使用的审查批准";
  if (entry.basis !== "written_permission" && entry.explicitReuseAllowed !== true) return "条款或开放许可未明确确认允许本用途再利用";
  if (entry.qualityApproved !== true || entry.contentComplete !== true || !optionalText(entry.qualityNotes)) {
    return "缺少内容完整性、备注与质量审查批准";
  }
  return null;
}

/** 每个来源独立审查，禁止来源不阻断其他合规来源；至少一个来源须通过。 */
export function validatePublicationApprovals(projection, approvals) {
  if (!projection.sources.length) throw new Error("没有可发布的来源记录");
  if (!approvals || !Array.isArray(approvals.sources)) throw new Error("缺少逐来源授权清单");
  const byKey = new Map();
  for (const entry of approvals.sources) {
    if (!entry?.key || byKey.has(entry.key)) throw new Error("授权清单来源键缺失或重复");
    byKey.set(entry.key, entry);
  }
  const candidates = new Map(projection.sources.map((source) => [source.key, source]));
  for (const entry of approvals.sources) {
    if (!candidates.has(entry.key)) throw new Error("授权清单含未知候选来源 " + entry.key);
  }
  const approvedSourceKeys = new Set();
  const rejectedSources = [];
  for (const source of candidates.values()) {
    const reason = approvalIssue(source, byKey.get(source.key));
    if (reason) rejectedSources.push({ key: source.key, reason });
    else approvedSourceKeys.add(source.key);
  }
  if (!approvedSourceKeys.size) {
    throw new Error("没有通过授权及质量审查的来源：" + rejectedSources.map(({ key, reason }) => key + " " + reason).join("；"));
  }
  return { approvedSourceKeys, rejectedSources };
}

// 审批候选在去重前提取，避免新观察未获批时把较旧且获批来源完全遮蔽。
function sourceCandidates(rows) {
  const candidates = new Map();
  for (const row of rows) {
    const source = { key: row.sourceKey, url: row.sourceUrl, publisher: row.publisher, title: row.title };
    const previous = candidates.get(source.key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(source)) throw new Error("来源键 " + source.key + " 的元数据不一致");
    candidates.set(source.key, source);
  }
  return [...candidates.values()];
}

function readOfficialRows() {
  if (!existsSync(SOURCE_DB)) throw new Error("找不到官方名单库：" + SOURCE_DB);
  const db = new DatabaseSync(SOURCE_DB, { readOnly: true });
  try {
    const sql = [
      "SELECT id, license_no AS licenseNo, name, city, city_slug AS citySlug,",
      "county, addr AS address, wl_type AS trainingType, projects,",
      "source_key AS sourceKey, source_url AS sourceUrl, publisher, title,",
      "NULL AS publishedAt, doc_date AS asOf, fetched_at AS collectedAt, city_code_match AS cityCodeMatch,",
      "annual_rating AS annualRating",
      "FROM wl_rows WHERE official_license = 1 ORDER BY id",
    ].join(" ");
    const rows = db.prepare(sql).all();
    const reviewRowIds = new Set(db.prepare("SELECT row_id FROM wl_review").all().map((row) => row.row_id));
    return { rows, reviewRowIds };
  } finally {
    db.close();
  }
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = path + "." + process.pid + ".tmp";
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  renameSync(temporary, path);
}

function cli() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log("用法：node scripts/build-gd-public.mjs [--publish --approvals <private.json>]；默认只写私有预览，不访问外网");
    return;
  }
  const publish = args[0] === "--publish";
  if (!(args.length === 0 || (publish && args.length === 3 && args[1] === "--approvals"))) {
    throw new Error("参数无效；正式发布必须显式传入 --publish --approvals <private.json>");
  }
  const { rows, reviewRowIds } = readOfficialRows();
  let projection = buildProjection(rows, reviewRowIds);
  let publicationReview = null;
  if (publish) {
    const approvalBytes = readFileSync(resolve(args[2]));
    const approvals = JSON.parse(approvalBytes.toString("utf8"));
    const decision = validatePublicationApprovals({ sources: sourceCandidates(rows) }, approvals);
    projection = buildProjection(rows, reviewRowIds, projection.generatedAt, decision.approvedSourceKeys);
    if (!projection.records.length) throw new Error("已批准来源没有通过记录质量排除规则的记录");
    projection.preview = false;
    publicationReview = {
      approvalsSha256: sha256(approvalBytes),
      approvedSourceKeys: [...decision.approvedSourceKeys],
      rejectedSources: decision.rejectedSources,
    };
  }
  const output = publish ? RELEASE_FILE : PREVIEW_FILE;
  atomicJson(output, projection);
  const receipt = {
    generatedAt: projection.generatedAt,
    mode: publish ? "release" : "private_preview",
    sourceDbSha256: sha256(readFileSync(SOURCE_DB)),
    outputSha256: sha256(readFileSync(output)),
    stats: projection.stats,
    ...(publicationReview ? { publicationReview } : {}),
  };
  atomicJson(resolve(RECEIPT_DIR, publish ? "gd-public-release.receipt.json" : "gd-public-preview.receipt.json"), receipt);
  console.log(JSON.stringify({ output, receipt, stats: projection.stats }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
