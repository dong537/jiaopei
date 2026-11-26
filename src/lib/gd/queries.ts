/**
 * 广东教培机构数据库访问层。
 *
 * 只允许在服务端组件 / Route Handler 中引用：node:sqlite 无法在浏览器运行。
 * 数据源 data/gd.db 由 scripts/build-gd-db.mjs 生成，属私有资料，已加入 .gitignore。
 */
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const globalForDb = globalThis as unknown as { __gdDb?: DatabaseSync };

export function gdDb(): DatabaseSync {
  if (!globalForDb.__gdDb) {
    globalForDb.__gdDb = new DatabaseSync(join(process.cwd(), "data", "gd.db"), {
      readOnly: true,
    });
  }
  return globalForDb.__gdDb;
}

/** 页面统一展示的机构字段，字段名与 SQL 列一一对应 */
export type GdOrg = {
  id: string;
  name: string;
  credit: string;
  city: string;
  citySlug: string;
  district: string;
  addr: string;
  phone: string;
  morePhone: string;
  legal: string;
  bizType: string;
  status: string;
  est: string;
  capital: string;
  scale: string;
  gbDa: string;
  gbZhong: string;
  gbXiao: string;
  qccZhong: string;
  qccXiao: string;
  former: string;
  tier: string;
  category: string;
  relevance: string;
};

const SELECT_COLS = `
  id, name, credit, city, city_slug AS citySlug, district, addr, phone,
  more_phone AS morePhone, legal, biz_type AS bizType, status, est, capital,
  scale, gb_da AS gbDa, gb_zhong AS gbZhong, gb_xiao AS gbXiao,
  qcc_zhong AS qccZhong, qcc_xiao AS qccXiao, former, tier, category, relevance
`;

export type GdScope = "core" | "broad" | "all";

/** 把 scope 转成 WHERE 片段；core 只含核心教培，all 不加条件 */
function scopeClause(scope: GdScope, alias = ""): { sql: string; params: string[] } {
  const p = alias ? `${alias}.` : "";
  if (scope === "core") return { sql: ` AND ${p}relevance = 'core'`, params: [] };
  if (scope === "broad") return { sql: ` AND ${p}relevance = 'broad'`, params: [] };
  return { sql: "", params: [] };
}

export type GdSummary = {
  total: number;
  core: number;
  broad: number;
  cityCount: number;
};

export function getSummary(scope: GdScope = "core"): GdSummary {
  const db = gdDb();
  const where = scope === "core" ? "WHERE relevance='core'" : scope === "broad" ? "WHERE relevance='broad'" : "";
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN relevance='core' THEN 1 ELSE 0 END) AS core,
              SUM(CASE WHEN relevance='broad' THEN 1 ELSE 0 END) AS broad,
              COUNT(DISTINCT CASE WHEN city_slug <> '' THEN city_slug END) AS cityCount
         FROM orgs ${where}`,
    )
    .get() as { total: number; core: number; broad: number; cityCount: number };
  return row;
}

export type CityStat = { slug: string; total: number; core: number };

/** 每个地市的数量（同时给出核心与全部，页面按需展示） */
export function getCityStats(): CityStat[] {
  return gdDb()
    .prepare(
      `SELECT city_slug AS slug,
              COUNT(*) AS total,
              SUM(CASE WHEN relevance='core' THEN 1 ELSE 0 END) AS core
         FROM orgs
        WHERE city_slug <> ''
        GROUP BY city_slug
        ORDER BY total DESC`,
    )
    .all() as CityStat[];
}

export type CategoryStat = { key: string; total: number; core: number };

export function getCategoryStats(citySlug?: string, scope: GdScope = "core"): CategoryStat[] {
  const s = scopeClause(scope);
  const cityCond = citySlug ? " AND city_slug = ?" : "";
  const params = citySlug ? [citySlug] : [];
  return gdDb()
    .prepare(
      `SELECT category AS key,
              COUNT(*) AS total,
              SUM(CASE WHEN relevance='core' THEN 1 ELSE 0 END) AS core
         FROM orgs
        WHERE 1=1${cityCond}${s.sql}
        GROUP BY category
        ORDER BY total DESC`,
    )
    .all(...params) as CategoryStat[];
}

/** 某一类别在各地市的数量，用于「同类机构跨市」交叉链接 */
export function getCityStatsForCategory(
  category: string,
  scope: GdScope = "core",
): CityStat[] {
  const s = scopeClause(scope);
  return gdDb()
    .prepare(
      `SELECT city_slug AS slug,
              COUNT(*) AS total,
              SUM(CASE WHEN relevance='core' THEN 1 ELSE 0 END) AS core
         FROM orgs
        WHERE category = ? AND city_slug <> ''${s.sql}
        GROUP BY city_slug
        ORDER BY total DESC`,
    )
    .all(category) as CityStat[];
}

export type GdSort = "name" | "est_desc" | "capital_desc";
export type ListOptions = {
  citySlug?: string;
  category?: string;
  scope?: GdScope;
  q?: string;
  sort?: GdSort;
  page?: number;
  pageSize?: number;
};

export type ListResult = { rows: GdOrg[]; total: number; page: number; pages: number };

const MAX_PAGE_SIZE = 50;

export function listOrgs(opts: ListOptions): ListResult {
  const {
    citySlug,
    category,
    scope = "core",
    q = "",
    sort = "name",
    page = 1,
    pageSize = 20,
  } = opts;

  const conds: string[] = ["1=1"];
  const params: (string | number)[] = [];

  if (citySlug) {
    conds.push("city_slug = ?");
    params.push(citySlug);
  }
  if (category) {
    conds.push("category = ?");
    params.push(category);
  }
  const s = scopeClause(scope);
  if (s.sql) conds.push(s.sql.replace(/^ AND /, ""));

  const kw = q.trim();
  if (kw) {
    conds.push("(name LIKE ? OR addr LIKE ? OR district LIKE ?)");
    const like = `%${kw}%`;
    params.push(like, like, like);
  }

  const where = conds.join(" AND ");
  const db = gdDb();
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM orgs WHERE ${where}`).get(...params) as { n: number }).n;

  const size = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(Math.max(1, page), pages);
  const offset = (cur - 1) * size;

  // 次级排序固定为 id，保证翻页稳定
  const order =
    sort === "est_desc"
      ? "est DESC, name ASC, id ASC"
      : sort === "capital_desc"
        ? "CAST(REPLACE(REPLACE(capital,'万元',''),'万','') AS REAL) DESC, name ASC, id ASC"
        : "name ASC, id ASC";

  const rows = db
    .prepare(`SELECT ${SELECT_COLS} FROM orgs WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, size, offset) as GdOrg[];

  return { rows, total, page: cur, pages };
}

export function getOrg(id: string): GdOrg | null {
  const row = gdDb().prepare(`SELECT ${SELECT_COLS} FROM orgs WHERE id = ?`).get(id) as
    | GdOrg
    | undefined;
  return row ?? null;
}

/** 同城同类别的其他机构，用于详情页底部推荐 */
export function relatedOrgs(org: GdOrg, limit = 8): GdOrg[] {
  return gdDb()
    .prepare(
      `SELECT ${SELECT_COLS} FROM orgs
        WHERE city_slug = ? AND category = ? AND id <> ? AND relevance = ?
        ORDER BY name ASC LIMIT ?`,
    )
    .all(org.citySlug, org.category, org.id, org.relevance, limit) as GdOrg[];
}
