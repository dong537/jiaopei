/**
 * 白名单原件解析：HTML 表格 / PDF 表格 → 统一行记录（rows.jsonl）。
 *
 * 解析原则：
 * - 只认「带 15 位数字办学许可证号」的行。没有许可证号的行丢弃并计数——
 *   本步骤的唯一目的是补许可证号，其余信息不足以承担误标风险。
 * - 许可证号原样保留，只去掉"教民"前缀，不补零、不猜位数、不猜校验位。
 * - 名称、地址按表头映射取；判不出的留空，不拿相邻行顶替。
 * - 同一来源内按（许可证号+名称）去重；跨来源重复保留，交给 build 阶段处理。
 * - PDF 无文字层（扫描件）→ 明确标记 needs_ocr，不产出空名单冒充"该市无机构"。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rawPathOf, readReceipt, WL_DIR } from "./fetch.mjs";
import { SOURCES } from "./sources.mjs";
import { ocrVerifiedRows } from "./ocr-rows.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ROWS_OUT = resolve(WL_DIR, "rows.jsonl");
const REPORT_OUT = resolve(WL_DIR, "parse-report.json");

/* ---------------- 公共清洗 ---------------- */

const ENTITIES = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&#39;": "'", "&ldquo;": "“", "&rdquo;": "”", "&mdash;": "—",
};

function decode(s) {
  return s.replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ");
}

function cellText(html) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[\u00a0\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 15 位办学许可证号；允许前面带"教民"两字 */
const LICENSE_RE = /(?:教民)?((?:1|2|4)\d{14})(?!\d)/;

/**
 * 号码第 2~5 位必须是广东 21 市行政区划码之一。
 * 2026-11-23 新增：东源页面导航「科技/教育/通告」被 heuristicRow 从面包屑
 * 拼出假号 416250072642794（1625 非城市码）。这不是"猜校验位"，而是
 * 用号码内嵌的行政区划码做最低限度识别——非广东城市码的候选直接丢弃，
 * 避免导航/页码/日期被误当许可证号。合法号一律 44xx 开头（前导 1/2/4 + 44xx）。
 */
const GD_CITY_CODES = new Set([
  "4401", "4402", "4403", "4404", "4405", "4406", "4407", "4408", "4409",
  "4412", "4413", "4414", "4415", "4416", "4417", "4418", "4419", "4420",
  "4451", "4452", "4453",
]);
const isGdLicense = (no) => GD_CITY_CODES.has(String(no || "").slice(1, 5));

/**
 * 取许可证号。
 * lenient 只用于"整格就是号码"的场景：有的 PDF/表格会把号码拆成
 * "14420007000 5229"（中间一个空格），抹掉非数字后正好 15 位才算，
 * 多一位少一位都放弃——不在整行文本上做这种抹除，避免把
 * "序号 1 + 号码 14 位" 拼成错误的 15 位。
 */
function findLicense(text, { lenient = false } = {}) {
  const t = text || "";
  const m = LICENSE_RE.exec(t);
  if (m) return isGdLicense(m[1]) ? m[1] : "";
  if (!lenient) return "";
  const digits = t.replace(/\D/g, "");
  if (digits.length !== 15 || !/^(1|2|4)/.test(digits)) return "";
  return isGdLicense(digits) ? digits : "";
}

const NAME_HINT = /(公司|中心|学校|学院|培训|教育|书院|幼儿园|俱乐部|工作室|协会|研究所)$/;
const ADDR_HINT = /(省|市|区|县|镇|街道|村|路|街|巷|号|层|楼|室|铺|栋|幢|座|广场|大厦)/;

const stripIndex = (s) => (s || "").replace(/^\s*\d{1,5}\s*[.、)）]?\s*/, "").trim();

/** 评级归一：全角 A/B/C → 半角，保留 A+ 等后缀；非评级文本留空。 */
function normalizeRating(s) {
  const t = String(s || "").trim().toUpperCase().replace(/[ＡＢＣ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  return /^[ABC]\+?$/.test(t) ? t : "";
}

/* ---------------- 表头映射 ---------------- */

const COLS = [
  { key: "name", re: /(培训机构|机构名称|单位名称|学校名称|名称|机构)/ },
  { key: "license", re: /(办学许可|许可证|许可编号|许可证书|证号)/ },
  // 排除「许可机关/数据来源单位」的信用代码——那是发布机关的码，不是机构的。
  // 顺德双公示 xls 有两级表头：列24「许可机关统一社会信用代码」在前，
  // 若不排除会把教育局的码 11440606007055725C 错记成机构信用代码。
  { key: "credit", re: /^(?:统一社会信用代码|信用代码)$/ },
  { key: "addr", re: /(办学地址|机构地址|地址)/ },
  { key: "wlType", re: /(培训类型|培训类别|办学类型|类型|类别)/ },
  { key: "projects", re: /(培训项目|办学内容|培训内容|许可内容|招生对象)/ },
  { key: "region", re: /(区域|属地|所属街道|区县)/ },
  // 年检评级：深圳福田 xlsx 用「评级」列，南山/盐田/大鹏 PDF 用「年检结果/年检结论」列。
  // 全市 PDF 的评级是分组标题（一、年检A类），不在列里，本映射取不到，留空。
  { key: "rating", re: /^(评级|年检结果|年检结论)$/ },
];

/**
 * 统一社会信用代码校验：正规代码为 18 位大写字母/数字。
 * 若抓到的值形如 15 位许可证号，说明原件把「许可证号/信用代码」两列填反了
 * （始兴 2025 年检 HTML 即如此），此时留空——不把许可证号冒充信用代码。
 */
function normalizeCredit(raw) {
  const v = (raw || "").trim().toUpperCase();
  if (!v) return "";
  if (/^(1|2|4)\d{14}$/.test(v)) return ""; // 15 位许可证号 → 判为错位
  if (/^[0-9A-Z]{18}$/.test(v)) return v;   // 18 位信用代码 → 保留
  return ""; // 其他格式一律留空，不存可疑值
}

function mapHeader(cells) {
  const map = {};
  cells.forEach((raw, idx) => {
    const h = (raw || "").replace(/\s/g, "");
    if (!h) return;
    for (const c of COLS) {
      if (map[c.key] !== undefined) continue;
      if (c.re.test(h)) {
        map[c.key] = idx;
        break;
      }
    }
  });
  return map;
}

/* ---------------- 网格 → 行 ---------------- */

function rowFromCells(cells, map) {
  const licenseRaw = map.license !== undefined ? cells[map.license] || "" : "";
  const license = findLicense(licenseRaw, { lenient: true }) || findLicense(cells.join(" "));
  if (!license) return null;
  const name = stripIndex(map.name !== undefined ? cells[map.name] || "" : "");
  if (!name) return null;
  return {
    name,
    license,
    licenseRaw: licenseRaw || license,
    credit: normalizeCredit(map.credit !== undefined ? cells[map.credit] : ""),
    addr: map.addr !== undefined ? cells[map.addr] || "" : "",
    wlType: map.wlType !== undefined ? cells[map.wlType] || "" : "",
    projects: map.projects !== undefined ? cells[map.projects] || "" : "",
    region: map.region !== undefined ? cells[map.region] || "" : "",
    rating: map.rating !== undefined ? normalizeRating(cells[map.rating]) : "",
  };
}

/** 无表头兜底：按内容猜名称与地址 */
function heuristicRow(cells) {
  const joined = cells.join(" ");
  const license = findLicense(joined);
  if (!license) return null;
  const licIdx = cells.findIndex((c) => findLicense(c));
  const rest = cells.filter((_, i) => i !== licIdx).map(stripIndex).filter(Boolean);
  const name =
    rest.find((c) => NAME_HINT.test(c) || /培训|教育/.test(c)) || "";
  const addr = rest.find((c) => c !== name && ADDR_HINT.test(c) && c.length > 6) || "";
  if (!name) return null;
  return { name, license, licenseRaw: cells[licIdx], credit: "", addr, wlType: "", projects: "", region: "", rating: "" };
}

/**
 * @param grids 每张表的二维单元格数组（PDF 跨页时表头可能只在首页出现）
 */
function rowsFromGrids(grids, stats) {
  const rows = [];
  let lastMap = null;

  for (const grid of grids) {
    if (!grid.length) continue;
    let map = null;
    let start = 0;

    for (let i = 0; i < Math.min(3, grid.length); i++) {
      const m = mapHeader(grid[i]);
      if (m.name !== undefined && m.license !== undefined) {
        map = m;
        start = i + 1;
        break;
      }
    }
    if (map) lastMap = map;
    else if (lastMap) {
      map = lastMap;
      start = 0;
      stats.continuedTables++;
    } else {
      stats.headerlessTables++;
    }

    for (let i = start; i < grid.length; i++) {
      const cells = grid[i];
      if (!cells || !cells.length) continue;
      const rec = map ? rowFromCells(cells, map) : heuristicRow(cells);
      if (!rec) {
        stats.droppedRows++;
        continue;
      }
      rows.push(rec);
    }
  }
  return rows;
}

/* ---------------- HTML ---------------- */

function htmlGrids(html) {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  return tables
    .map((table) =>
      (table.match(/<tr[\s\S]*?<\/tr>/gi) || []).map((tr) =>
        (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map((td) =>
          cellText(td.replace(/^<t[dh][^>]*>/i, "")),
        ),
      ),
    )
    .filter((g) => g.length);
}

/* ---------------- PDF ---------------- */

function pdfTables(pdfPath) {
  const py = process.env.PYTHON || "python";
  const out = execFileSync(py, [resolve(ROOT, "scripts", "whitelist", "pdf_text.py"), pdfPath], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180000,
  });
  const data = JSON.parse(out);
  if (data.error) throw new Error(data.error);
  return data;
}

/* ---------------- XLS / XLSX ---------------- */

function sheetTables(path) {
  const py = process.env.PYTHON || "python";
  const out = execFileSync(py, [resolve(ROOT, "scripts", "whitelist", "sheet_text.py"), path], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180000,
  });
  const data = JSON.parse(out);
  if (data.error) throw new Error(data.error);
  return data;
}

/** 表格里出现的许可证号数量，用于算抽取率 */
function codesInGrids(grids) {
  const set = new Set();
  for (const g of grids) {
    for (const row of g) {
      for (const cell of row) {
        const m = LICENSE_RE.exec(cell || "");
        if (m && isGdLicense(m[1])) set.add(m[1]);
      }
    }
  }
  return set.size;
}

/* ---------------- 主流程 ---------------- */

export function parseAll() {
  const report = [];
  const all = [];

  for (const s of SOURCES) {
    const rc = readReceipt(s.key);
    if (!rc || rc.httpStatus !== 200) {
      report.push({ key: s.key, status: "no_receipt", rows: 0 });
      console.log(`  skip  ${s.key}（无 200 收据）`);
      continue;
    }
    const rawPath = rawPathOf(s);
    if (!existsSync(rawPath)) {
      report.push({ key: s.key, status: "raw_missing", rows: 0 });
      console.log(`  FAIL  ${s.key}（收据在但原件缺失）`);
      continue;
    }

    let rows = [];
    const stats = {
      grids: 0,
      headerlessTables: 0,
      continuedTables: 0,
      droppedRows: 0,
      needsOcr: false,
      codesInRaw: 0,
    };

    try {
      if (s.format === "html") {
        const html = readFileSync(rawPath, "utf8");
        stats.codesInRaw = new Set([...html.matchAll(/(?:1|2|4)\d{14}/g)].map((m) => m[0])).size;
        const grids = htmlGrids(html);
        stats.grids = grids.length;
        rows = rowsFromGrids(grids, stats);
      } else if (s.format === "pdf") {
        const data = pdfTables(rawPath);
        stats.codesInRaw = data.codesInText || 0;
        if (!data.hasTextLayer) {
          stats.needsOcr = true;
          rows = [];
        } else {
          const grids = data.tables.map((t) => t.rows);
          stats.grids = grids.length;
          rows = rowsFromGrids(grids, stats);
        }
      } else if (s.format === "xls" || s.format === "xlsx") {
        const data = sheetTables(rawPath);
        const grids = data.sheets.map((t) => t.rows);
        stats.grids = grids.length;
        stats.codesInRaw = codesInGrids(grids);
        rows = rowsFromGrids(grids, stats);
      } else {
        throw new Error(`unsupported format ${s.format}`);
      }
    } catch (e) {
      report.push({ key: s.key, status: "parse_error", error: String(e?.message || e), rows: 0 });
      console.log(`  FAIL  ${s.key} 解析失败：${e?.message || e}`);
      continue;
    }

    const seen = new Set();
    const uniq = [];
    for (const r of rows) {
      const k = `${r.license}|${r.name}`;
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push({
        ...r,
        sourceKey: s.key,
        sourceUrl: s.url,
        publisher: s.publisher,
        title: s.title,
        docDate: s.docDate,
        city: s.city,
        cityName: s.cityName,
        county: s.county || r.region || "",
        fetchedAt: rc.startedAt,
        officialLicense: !!s.officialLicense,
      });
    }

    all.push(...uniq);
    const status = stats.needsOcr ? "needs_ocr" : uniq.length ? "ok" : "no_rows";
    const codes = new Set(uniq.map((r) => r.license)).size;
    const extraction = stats.codesInRaw ? Math.round((codes / stats.codesInRaw) * 100) : null;
    report.push({
      key: s.key,
      status,
      ...stats,
      rows: uniq.length,
      codes,
      extraction,
      note: s.note || "",
      publisher: s.publisher,
      title: s.title,
      url: s.url,
      docDate: s.docDate,
      citySlug: s.city,
      cityName: s.cityName,
    });
    const bits = [
      stats.needsOcr ? "扫描件，无文字层，需 OCR" : "",
      s.note || "",
      extraction !== null && extraction < 90 ? `原件含 ${stats.codesInRaw} 个号码，抽出 ${codes} 个（${extraction}%）` : "",
    ].filter(Boolean);
    console.log(`  ${status === "ok" ? "ok   " : "warn "} ${s.key}  ${uniq.length} 行  ${bits.join("；")}`);
  }

  // 并入人工核验通过的 OCR 行（只有 CSV 里「核对状态=通过」才进）
  const ocr = ocrVerifiedRows();
  if (ocr.rows.length) {
    all.push(...ocr.rows);
    report.push({
      key: "ocr-verified",
      status: "ok",
      rows: ocr.rows.length,
      note: `人工核验通过并入：${ocr.stats.passed} 行（核对表共 ${ocr.stats.total} 行）`,
    });
    console.log(`  ok    ocr-verified  ${ocr.rows.length} 行（人工核验通过）`);
  } else {
    console.log(`  skip  ocr-verified  核对表中无「通过」行（共 ${ocr.stats.total} 行待判定）`);
  }

  writeFileSync(ROWS_OUT, all.map((r) => JSON.stringify(r)).join("\n") + "\n");
  writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2));

  const codes = new Set(all.map((r) => r.license));
  const cities = new Set(all.map((r) => r.city));
  console.log(`\n合计 ${all.length} 行｜不同许可证号 ${codes.size} 个｜覆盖 ${cities.size} 个地市`);
  return { report, total: all.length };
}
