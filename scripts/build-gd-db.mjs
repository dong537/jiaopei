/**
 * 构建广东省教培机构数据库
 *
 * 输入：企查查导出整理后的 SQLite（guangdong_training.db）
 * 输出：data/gd.db（项目内只读数据源）
 *
 * 用法：
 *   node scripts/build-gd-db.mjs
 *   node scripts/build-gd-db.mjs --source "D:/path/to/guangdong_training.db"
 *
 * 说明：
 * - 原始数据来自 users 自有企查查导出，属私有资料，data/gd.db 已加入 .gitignore。
 * - 只做字段规范化 + 培训类别推导，不修改、不推断原始工商字段。
 * - 无法确定的值保持空字符串，不用占位符冒充。
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE =
  "C:/Users/Lenovo/WorkBuddy/2026-11-21-23-32-41/yanglao_scraper/edu_match/guangdong_training.db";
const OUT_DIR = resolve(ROOT, "data");
const OUT_DB = resolve(OUT_DIR, "gd.db");

const argSource = process.argv.indexOf("--source");
const SOURCE = argSource > -1 ? process.argv[argSource + 1] : DEFAULT_SOURCE;

/* ---------- 城市 slug：与 src/lib/generated/cities.json 保持一致 ---------- */
const CITY_SLUGS = {
  chaozhou: "潮州", dongguan: "东莞", foshan: "佛山", guangzhou: "广州",
  heyuan: "河源", huizhou: "惠州", jiangmen: "江门", jieyang: "揭阳",
  maoming: "茂名", meizhou: "梅州", qingyuan: "清远", shantou: "汕头",
  shanwei: "汕尾", shaoguan: "韶关", shenzhen: "深圳", yangjiang: "阳江",
  yunfu: "云浮", zhanjiang: "湛江", zhaoqing: "肇庆", zhongshan: "中山",
  zhuhai: "珠海",
};
const NAME_TO_SLUG = Object.fromEntries(
  Object.entries(CITY_SLUGS).map(([slug, name]) => [name, slug]),
);

/* ---------- 培训类别：按名称关键词推导，行业作兜底 ---------- */
/** 顺序敏感：越具体的类别越靠前，"舞蹈"归艺术而非体育，"雅思"归语言而非学科 */
const RULES = [
  { key: "jiache", kws: ["驾驶培训", "驾校", "机动车驾驶", "汽车培训", "驾驶员"] },
  { key: "yishu", kws: ["艺术", "美术", "音乐", "舞蹈", "书法", "绘画", "钢琴", "古筝", "吉他", "播音", "主持", "表演", "摄影", "传媒", "陶艺", "国画", "乐器", "声乐", "戏曲", "模特", "艺考"] },
  { key: "tiyu", kws: ["体育", "武术", "跆拳道", "游泳", "篮球", "足球", "乒乓", "羽毛球", "轮滑", "击剑", "拳击", "散打", "田径", "网球", "健身", "体适能", "瑜伽", "棋"] },
  { key: "keji", kws: ["科技", "编程", "机器人", "创客", "人工智能", "无人机", "steam"] },
  { key: "zaojiao", kws: ["早教", "亲子", "托育", "婴幼儿", "幼儿", "感统", "蒙特梭利"] },
  { key: "tuoguan", kws: ["托管", "托辅", "课后"] },
  { key: "zhiye", kws: ["职业", "技工", "技能", "专修", "美容", "美发", "厨师", "电工", "焊工", "家政", "月嫂", "护理", "消防", "保安", "叉车", "面点", "汽修"] },
  { key: "qiye", kws: ["管理", "企业", "干部", "党校", "拓展", "团建", "人力资源"] },
  { key: "yuyan", kws: ["雅思", "托福", "留学", "外语", "日语", "韩语", "英语口语", "小语种"] },
  { key: "xueke", kws: ["课外", "辅导", "补习", "学科", "中高考", "数理化", "英语", "语文", "数学", "物理", "化学", "升学", "培优"] },
];

/**
 * 相关性：决定机构是否进入默认目录。
 * core —— 名称本身指向培训机构（含"培训/教育/学院/学校/辅导/托管"等机构词），
 *         这是最可辩护的判定：企查查的国标行业会把"XX文化传播有限公司"也归到
 *         文化艺术业，但名称才是判别身份最直接的证据。
 * broad —— 只有经营范围里提到"培训"，主营往往是贸易、养殖、制造、文化传播等。
 * 两者都保留在库里，目录默认只看 core，可切换查看全部。
 */
const CORE_NAME_KWS = [
  "培训", "教育", "学院", "学校", "辅导", "补习", "托管", "托育",
  "驾校", "幼儿园", "早教", "书院", "培训班",
];

function relevanceOf(name) {
  const n = (name || "").toLowerCase();
  return CORE_NAME_KWS.some((k) => n.includes(k.toLowerCase())) ? "core" : "broad";
}

/** 国标行业大类兜底 */
const GB_FALLBACK = {
  文化艺术业: "yishu",
  体育: "tiyu",
  教育: "qita",
};

const CATEGORY_META = {
  yishu: "艺术培训",
  tiyu: "体育培训",
  xueke: "学科辅导",
  zhiye: "职业技能",
  jiache: "驾驶培训",
  keji: "科技培训",
  zaojiao: "早教托育",
  tuoguan: "课后托管",
  qiye: "企业培训",
  yuyan: "语言培训",
  qita: "其他培训",
};

function classify(name, gbDa) {
  const n = (name || "").toLowerCase();
  for (const rule of RULES) {
    if (rule.kws.some((k) => n.includes(k.toLowerCase()))) return rule.key;
  }
  return GB_FALLBACK[gbDa] || "qita";
}

function clean(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s === "-" || s === "None" || s === "null" ? "" : s;
}

/* ---------- 主流程 ---------- */
if (!existsSync(SOURCE)) {
  console.error(`找不到源数据库：${SOURCE}`);
  console.error("请用 --source 指定 guangdong_training.db 的路径。");
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
if (existsSync(OUT_DB)) rmSync(OUT_DB);

console.log(`源：${SOURCE}`);
const src = new DatabaseSync(SOURCE, { readOnly: true });
const rows = src
  .prepare(
    `SELECT name, credit, city, district, addr, phone, more_phone, legal,
            biz_type, status, est, capital, scale, gb_da, gb_zhong, gb_xiao,
            qcc_zhong, qcc_xiao, former, tier
       FROM training_orgs
      WHERE flag IN ('ok_pos','ok_name')`,
  )
  .all();
src.close();
console.log(`读取可用记录：${rows.length.toLocaleString("en-US")} 条`);

const out = new DatabaseSync(OUT_DB);
out.exec(`
  PRAGMA journal_mode = OFF;
  PRAGMA synchronous = OFF;
  CREATE TABLE orgs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    credit TEXT, city TEXT, city_slug TEXT, district TEXT,
    addr TEXT, phone TEXT, more_phone TEXT, legal TEXT,
    biz_type TEXT, status TEXT, est TEXT, capital TEXT, scale TEXT,
    gb_da TEXT, gb_zhong TEXT, gb_xiao TEXT,
    qcc_zhong TEXT, qcc_xiao TEXT, former TEXT,
    tier TEXT, category TEXT, relevance TEXT
  );
`);
const insert = out.prepare(
  `INSERT OR REPLACE INTO orgs
   (id,name,credit,city,city_slug,district,addr,phone,more_phone,legal,
    biz_type,status,est,capital,scale,gb_da,gb_zhong,gb_xiao,
    qcc_zhong,qcc_xiao,former,tier,category,relevance)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
);

const catCount = new Map();
const cityCount = new Map();
const relCount = new Map();
let downgraded = 0;
let transactions = 0;

out.exec("BEGIN");
for (const r of rows) {
  const name = clean(r.name);
  if (!name) continue;
  const credit = clean(r.credit);
  const cityRaw = clean(r.city);
  const cityName = cityRaw.replace(/市$/, "");
  const citySlug = NAME_TO_SLUG[cityName] || "";

  // 没有信用代码时用名称+城市生成稳定 id，保证详情页可访问
  const id = credit || "nk_" + createHash("sha1").update(name + "|" + cityRaw).digest("hex").slice(0, 16);
  const gbDa = clean(r.gb_da);
  const category = classify(name, gbDa);
  const relevance = relevanceOf(name);

  insert.run(
    id, name, credit, cityRaw, citySlug, clean(r.district),
    clean(r.addr), clean(r.phone), clean(r.more_phone), clean(r.legal),
    clean(r.biz_type), clean(r.status), clean(r.est), clean(r.capital), clean(r.scale),
    gbDa, clean(r.gb_zhong), clean(r.gb_xiao),
    clean(r.qcc_zhong), clean(r.qcc_xiao), clean(r.former),
    clean(r.tier), category, relevance,
  );

  catCount.set(category, (catCount.get(category) || 0) + 1);
  relCount.set(relevance, (relCount.get(relevance) || 0) + 1);
  if (citySlug) cityCount.set(citySlug, (cityCount.get(citySlug) || 0) + 1);
  else downgraded++;
  transactions++;
}
out.exec("COMMIT");

out.exec(`
  CREATE INDEX idx_city ON orgs(city_slug);
  CREATE INDEX idx_cat ON orgs(category);
  CREATE INDEX idx_rel ON orgs(relevance);
  CREATE INDEX idx_city_cat ON orgs(city_slug, category);
  CREATE INDEX idx_city_rel ON orgs(city_slug, relevance);
  CREATE INDEX idx_name ON orgs(name);
  CREATE INDEX idx_credit ON orgs(credit);
  ANALYZE;
`);
out.close();

console.log(`写入：${transactions.toLocaleString("en-US")} 条`);
console.log("\n相关性：");
[...relCount.entries()].forEach(([k, v]) =>
  console.log(`  ${k === "core" ? "核心教培" : "泛培训主体"}  ${v.toLocaleString("en-US")}`));
if (downgraded) console.log(`\n未匹配到城市 slug：${downgraded} 条（详情页仍可访问，不进城市列表）`);
console.log("\n类别分布（全部）：");
[...catCount.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${CATEGORY_META[k] || k}  ${v.toLocaleString("en-US")}`));
console.log("\n城市前 8：");
[...cityCount.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .forEach(([k, v]) => console.log(`  ${k}  ${v.toLocaleString("en-US")}`));
console.log(`\n输出：${OUT_DB}`);
