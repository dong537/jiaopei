/**
 * 教育部门「白名单」数据访问层（办学许可证号）。
 *
 * 数据源 data/whitelist.db 由 scripts/whitelist.mjs 生成：
 *   fetch（抓官方原件）→ parse（表格解析）→ build（落库 + 与工商名录匹配）
 *
 * 只有服务端可引用（node:sqlite）。
 *
 * 三个口径必须分清，页面文案不得混用：
 *   - 白名单行：官方名单刊载的一行，一个机构一个办学许可证号。
 *   - 已匹配：该行与本站工商名录中的某个主体被判为同一家。
 *   - 未匹配：持证的民办非企业单位等，工商登记库里本来就没有，不是数据缺陷。
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const globalForWl = globalThis as unknown as { __wlDb?: DatabaseSync | null };

function dbPath() {
  return join(process.cwd(), "data", "whitelist.db");
}

/** 未生成时返回 null，页面据此显示「尚未接入」而不是报错 */
function wlDb(): DatabaseSync | null {
  if (globalForWl.__wlDb !== undefined) return globalForWl.__wlDb;
  const p = dbPath();
  globalForWl.__wlDb = existsSync(p) ? new DatabaseSync(p, { readOnly: true }) : null;
  return globalForWl.__wlDb;
}

export function whitelistReady(): boolean {
  return wlDb() !== null;
}

/* ---------------- 机构详情用 ---------------- */

export type GdLicense = {
  licenseNo: string;
  wlName: string;
  county: string;
  wlType: string;
  projects: string;
  addr: string;
  publisher: string;
  title: string;
  docDate: string;
  sourceUrl: string;
  fetchedAt: string;
  matchType: string;
};

export function getLicenseForOrg(orgId: string): GdLicense | null {
  const db = wlDb();
  if (!db) return null;
  const row = db
    .prepare(
      `SELECT r.license_no AS licenseNo, r.name AS wlName, r.county, r.wl_type AS wlType,
              r.projects, r.addr, r.publisher, r.title, r.doc_date AS docDate,
              r.source_url AS sourceUrl, r.fetched_at AS fetchedAt, m.match_type AS matchType
         FROM wl_match m JOIN wl_rows r ON r.id = m.row_id
        WHERE m.org_id = ?`,
    )
    .get(orgId) as GdLicense | undefined;
  return row ?? null;
}

/* ---------------- 总览 ---------------- */

export type LicenseSummary = {
  rows: number;
  licenses: number;
  matchedOrgs: number;
  review: number;
  cities: number;
  sources: number;
  /** 号码内嵌的行政区划码与名单发布地一致的条数 */
  codeOk: number;
  codeBad: number;
  builtAt: string;
};

export function getLicenseSummary(): LicenseSummary | null {
  const db = wlDb();
  if (!db) return null;
  const r = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM wl_rows) AS rows,
              (SELECT COUNT(DISTINCT license_no) FROM wl_rows) AS licenses,
              (SELECT COUNT(*) FROM wl_match) AS matchedOrgs,
              (SELECT COUNT(*) FROM wl_review) AS review,
              (SELECT COUNT(DISTINCT city_slug) FROM wl_rows WHERE city_slug <> '') AS cities,
              (SELECT COUNT(DISTINCT source_key) FROM wl_rows) AS sources,
              (SELECT COUNT(*) FROM wl_rows WHERE city_code_match = 1) AS codeOk,
              (SELECT COUNT(*) FROM wl_rows WHERE city_code_match IS NOT 1) AS codeBad`,
    )
    .get() as Omit<LicenseSummary, "builtAt">;
  let builtAt = "";
  try {
    builtAt = statSync(dbPath()).mtime.toISOString().slice(0, 10);
  } catch {
    builtAt = "";
  }
  return { ...r, builtAt };
}

export type CityLicenseStat = { slug: string; rows: number; matched: number };

export function getCityLicenseStats(): Map<string, CityLicenseStat> {
  const out = new Map<string, CityLicenseStat>();
  const db = wlDb();
  if (!db) return out;
  const rows = db
    .prepare(
      `SELECT r.city_slug AS slug,
              COUNT(*) AS rows,
              SUM(CASE WHEN m.org_id IS NOT NULL THEN 1 ELSE 0 END) AS matched
         FROM wl_rows r LEFT JOIN wl_match m ON m.row_id = r.id
        WHERE r.city_slug <> ''
        GROUP BY r.city_slug`,
    )
    .all() as CityLicenseStat[];
  for (const r of rows) out.set(r.slug, r);
  return out;
}

/* ---------------- 来源清单（透明度用） ---------------- */

export type LicenseSource = {
  sourceKey: string;
  publisher: string;
  title: string;
  docDate: string;
  sourceUrl: string;
  fetchedAt: string;
  citySlug: string;
  city: string;
  county: string;
  rows: number;
  matched: number;
};

export function getLicenseSources(): LicenseSource[] {
  const db = wlDb();
  if (!db) return [];
  return db
    .prepare(
      `SELECT r.source_key AS sourceKey, r.publisher, r.title, r.doc_date AS docDate,
              r.source_url AS sourceUrl, MAX(r.fetched_at) AS fetchedAt,
              r.city_slug AS citySlug, r.city, MAX(r.county) AS county,
              COUNT(*) AS rows,
              SUM(CASE WHEN m.org_id IS NOT NULL THEN 1 ELSE 0 END) AS matched
         FROM wl_rows r LEFT JOIN wl_match m ON m.row_id = r.id
        GROUP BY r.source_key
        ORDER BY rows DESC`,
    )
    .all() as LicenseSource[];
}

/** 批量取许可证号，列表页一次查询避免 N+1 */
export function getLicenseMapForOrgIds(ids: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const db = wlDb();
  if (!db || !ids.length) return out;
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT org_id AS id, license_no AS no FROM wl_match WHERE org_id IN (${placeholders})`)
    .all(...ids) as { id: string; no: string }[];
  for (const r of rows) out.set(r.id, r.no);
  return out;
}

/* ---------------- 来源登记情况（含解析失败的来源） ---------------- */

export type SourceReportRow = {
  key: string;
  status: string;
  rows: number;
  codes: number;
  codesInRaw: number;
  note: string;
  needsOcr: boolean;
  publisher: string;
  title: string;
  url: string;
  docDate: string;
  citySlug: string;
  cityName: string;
};

/**
 * parse-report.json 里既有成功的来源，也有登记了但没解析出行的来源
 * （图片版名单、扫描件 PDF）。页面必须把它们一并列出，
 * 否则「已接入 6 个来源」会让人误以为只查过 6 个地方。
 */
export function getSourceReport(): SourceReportRow[] {
  const p = join(process.cwd(), "data", "whitelist", "parse-report.json");
  if (!existsSync(p)) return [];
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Array<Record<string, unknown>>;
    return raw.map((r) => ({
      key: String(r.key ?? ""),
      status: String(r.status ?? ""),
      rows: Number(r.rows ?? 0),
      codes: Number(r.codes ?? 0),
      codesInRaw: Number(r.codesInRaw ?? 0),
      note: String(r.note ?? ""),
      needsOcr: Boolean(r.needsOcr),
      publisher: String(r.publisher ?? ""),
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      docDate: String(r.docDate ?? ""),
      citySlug: String(r.citySlug ?? ""),
      cityName: String(r.cityName ?? ""),
    }));
  } catch {
    return [];
  }
}

/* ---------------- 覆盖率（与工商名录的交叉统计） ---------------- */

/**
 * 已核验机构数：按地市 / 类别统计「白名单行能在工商名录里找到对应主体」的数量。
 * 分母永远是工商名录里的核心教培数，不是全省机构总数——两者口径不同，不能相除成"合规率"。
 */
export function getLicenseCounts(): {
  byCity: Map<string, number>;
  byCityCategory: Map<string, number>;
  byCategory: Map<string, number>;
} {
  const byCity = new Map<string, number>();
  const byCityCategory = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const db = wlDb();
  if (!db) return { byCity, byCityCategory, byCategory };

  const rows = db
    .prepare(
      `SELECT org_city AS city, org_category AS cat, COUNT(*) AS n
         FROM wl_match
        WHERE org_city IS NOT NULL AND org_city <> '' AND org_relevance = 'core'
        GROUP BY org_city, org_category`,
    )
    .all() as { city: string; cat: string; n: number }[];

  for (const r of rows) {
    byCity.set(r.city, (byCity.get(r.city) ?? 0) + r.n);
    byCategory.set(r.cat, (byCategory.get(r.cat) ?? 0) + r.n);
    byCityCategory.set(`${r.city}/${r.cat}`, r.n);
  }
  return { byCity, byCityCategory, byCategory };
}

export function licenseCountFor(citySlug: string, category?: string): number {
  const db = wlDb();
  if (!db) return 0;
  const row = db
    .prepare(
      category
        ? `SELECT COUNT(*) AS n FROM wl_match
            WHERE org_city = ? AND org_category = ? AND org_relevance = 'core'`
        : `SELECT COUNT(*) AS n FROM wl_match
            WHERE org_city = ? AND org_relevance = 'core'`,
    )
    .get(...(category ? [citySlug, category] : [citySlug])) as { n: number };
  return row.n;
}


/* ---------------- 白名单列表 ---------------- */

export type WhitelistRow = {
  id: number;
  licenseNo: string;
  name: string;
  citySlug: string;
  city: string;
  county: string;
  wlType: string;
  addr: string;
  orgId: string | null;
  matchType: string | null;
  docDate: string;
  publisher: string;
};

export type WhitelistQuery = {
  citySlug?: string;
  q?: string;
  matched?: "all" | "yes" | "no";
  page?: number;
  pageSize?: number;
};

export function listWhitelist(opts: WhitelistQuery = {}): {
  rows: WhitelistRow[];
  total: number;
  page: number;
  pages: number;
} {
  const db = wlDb();
  if (!db) return { rows: [], total: 0, page: 1, pages: 1 };
  const { citySlug, q = "", matched = "all", page = 1, pageSize = 30 } = opts;

  const conds = ["1=1"];
  const params: (string | number)[] = [];
  if (citySlug) {
    conds.push("r.city_slug = ?");
    params.push(citySlug);
  }
  const kw = q.trim();
  if (kw) {
    conds.push("(r.name LIKE ? OR r.license_no LIKE ? OR r.addr LIKE ?)");
    const like = `%${kw}%`;
    params.push(like, like, like);
  }
  if (matched === "yes") conds.push("m.org_id IS NOT NULL");
  if (matched === "no") conds.push("m.org_id IS NULL");

  const where = conds.join(" AND ");
  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM wl_rows r LEFT JOIN wl_match m ON m.row_id = r.id WHERE ${where}`,
      )
      .get(...params) as { n: number }
  ).n;

  const size = Math.min(Math.max(1, pageSize), 100);
  const pages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(Math.max(1, page), pages);

  const rows = db
    .prepare(
      `SELECT r.id, r.license_no AS licenseNo, r.name, r.city_slug AS citySlug, r.city,
              r.county, r.wl_type AS wlType, r.addr, m.org_id AS orgId, m.match_type AS matchType,
              r.doc_date AS docDate, r.publisher
         FROM wl_rows r LEFT JOIN wl_match m ON m.row_id = r.id
        WHERE ${where}
        ORDER BY r.city_slug ASC, r.name ASC, r.id ASC
        LIMIT ? OFFSET ?`,
    )
    .all(...params, size, (cur - 1) * size) as WhitelistRow[];

  return { rows, total, page: cur, pages };
}
