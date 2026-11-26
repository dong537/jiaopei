#!/usr/bin/env node
/**
 * 白名单管线入口。
 *
 *   node scripts/whitelist.mjs fetch [--force] [--only <key>]
 *   node scripts/whitelist.mjs parse
 *   node scripts/whitelist.mjs build
 *   node scripts/whitelist.mjs all
 *   node scripts/whitelist.mjs status
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES } from "./whitelist/sources.mjs";
import { fetchAll, readReceipt } from "./whitelist/fetch.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cmd = process.argv[2] || "status";
const argv = process.argv.slice(3);

const flag = (name) => argv.includes(name);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i > -1 ? argv[i + 1] : null;
};

async function status() {
  console.log("来源                          格式  收据       解析");
  for (const s of SOURCES) {
    const rc = readReceipt(s.key);
    const chk = rc ? `${rc.httpStatus} ${rc.bytes}B` : "—";
    console.log(`  ${s.key.padEnd(26)} ${s.format.padEnd(5)} ${chk.padEnd(11)}`);
  }
  const p = resolve(ROOT, "data", "whitelist", "parse-report.json");
  if (existsSync(p)) {
    const rep = JSON.parse(readFileSync(p, "utf8"));
    console.log("\n最近一次解析：");
    for (const r of rep) {
      console.log(`  ${r.key.padEnd(26)} ${String(r.status).padEnd(12)} ${r.rows ?? 0} 行`);
    }
  }
  const enabled = SOURCES.filter((s) => s.officialLicense).length;
  console.log(`\n共 ${SOURCES.length} 个来源，其中 ${enabled} 个逐行刊载办学许可证号。`);
}

switch (cmd) {
  case "fetch":
    console.log("抓取白名单原件（顺序、2.5 秒间隔、不重试）…");
    await fetchAll({ force: flag("--force"), only: opt("--only") });
    break;
  case "parse": {
    const { parseAll } = await import("./whitelist/parse.mjs");
    console.log("解析原件…");
    parseAll();
    break;
  }
  case "build": {
    await import("./whitelist/build.mjs");
    break;
  }
  case "all": {
    console.log("① 抓取");
    await fetchAll({ force: flag("--force") });
    console.log("\n② 解析");
    const { parseAll } = await import("./whitelist/parse.mjs");
    parseAll();
    console.log("\n③ 落库与匹配");
    await import("./whitelist/build.mjs");
    break;
  }
  case "status":
    await status();
    break;
  default:
    console.log("用法：node scripts/whitelist.mjs <fetch|parse|build|all|status>");
    process.exit(1);
}
