/**
 * 爬取东莞市社会组织创新服务基地的组织名录（民非/社团/民办学校等）。
 * 来源：http://www.dgshzzcxfw.com/index.php/org/lists-page-{N}.html
 * 共 3885 项 / 195 页 / 每页 20 条。匿名可访问，纯静态 HTML 表格。
 * 输出：data/socialorg/dongguan.jsonl（一行一条）
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = resolve(ROOT, "data", "socialorg", "dongguan.jsonl");
const BASE = "http://www.dgshzzcxfw.com/index.php/org/lists-page-";
const TOTAL_PAGES = 195;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36";

function stripHtml(s) {
  return (s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePage(html) {
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(html)) !== null) {
    const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripHtml(c[1]));
    if (cells.length < 6) continue;
    const [seq, name, credit, category, nature, legal, founded, supervisor, grade, town, tag] = cells;
    if (!name || name === "社会组织名称") continue; // 跳过表头
    rows.push({
      seq: seq || "",
      name: name || "",
      credit: credit || "",
      category: category || "",
      nature: nature || "",
      legal: legal || "",
      founded: founded || "",
      supervisor: supervisor || "",
      grade: grade || "",
      town: town || "",
      tag: tag || "",
      city: "dongguan",
      source: "dgshzzcxfw.com",
    });
  }
  return rows;
}

async function fetchPage(n) {
  const url = BASE + n + ".html";
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return await res.text();
}

mkdirSync(dirname(OUT), { recursive: true });
const all = [];
const stream = [];
let failCount = 0;

for (let page = 1; page <= TOTAL_PAGES; page++) {
  let html;
  try {
    html = await fetchPage(page);
  } catch (e) {
    console.error(`  ! 第 ${page} 页失败: ${e.message}`);
    failCount++;
    continue;
  }
  const rows = parsePage(html);
  all.push(...rows);
  stream.push(...rows.map((r) => JSON.stringify(r)));
  if (page % 20 === 0 || page === TOTAL_PAGES) {
    console.log(`  第 ${page}/${TOTAL_PAGES} 页，累计 ${all.length} 条`);
  }
  // 友好间隔，避免给源站压力
  await new Promise((r) => setTimeout(r, 300));
}

writeFileSync(OUT, stream.join("\n") + "\n", "utf8");
console.log(`\n完成：${all.length} 条，失败页 ${failCount}，输出 ${OUT}`);
