/**
 * 白名单原件抓取：一次一请求、礼貌间隔、原件与收据留痕。
 *
 * 纪律（与 collector/README.md 的口径一致）：
 * - 不并发、不重试、不伪造身份。默认 2.5 秒间隔，仅对本机顺序访问有效。
 * - 403 / 429 / 验证码 / 非预期类型：记录后停止该来源，不绕过、不换 UA 硬闯。
 * - 原件按 key 落盘，同名文件不覆盖（内容变了就换 key 或加 -2 后缀，人工决定）。
 * - 每份原件配一份收据：URL、UTC 时间、HTTP 状态、字节数、SHA-256、Content-Type。
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES } from "./sources.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const WL_DIR = resolve(ROOT, "data", "whitelist");
const RAW_DIR = resolve(WL_DIR, "raw");
const RECEIPT_DIR = resolve(WL_DIR, "receipts");
const LEDGER = resolve(WL_DIR, "ledger.jsonl");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const EXT = { html: "html", pdf: "pdf", xls: "xls", xlsx: "xlsx" };
const DELAY_MS = 2500;
const TIMEOUT_MS = 40000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function readReceipt(key) {
  const p = resolve(RECEIPT_DIR, `${key}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function rawPathOf(source) {
  return resolve(RAW_DIR, `${source.key}.${EXT[source.format] || "bin"}`);
}

export async function fetchAll({ force = false, only = null } = {}) {
  mkdirSync(RAW_DIR, { recursive: true });
  mkdirSync(RECEIPT_DIR, { recursive: true });

  const targets = SOURCES.filter((s) => (only ? s.key === only : true));
  const results = [];
  let seq = 0;

  for (const s of targets) {
    const rawPath = rawPathOf(s);
    const prior = readReceipt(s.key);

    if (!force && prior?.httpStatus === 200 && existsSync(rawPath)) {
      console.log(`  skip  ${s.key}（已有 200 原件，${prior.bytes} 字节）`);
      results.push({ key: s.key, status: "skipped", receipt: prior });
      continue;
    }

    if (seq > 0) await sleep(DELAY_MS);
    seq++;

    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    let status = 0;
    let bytes = 0;
    let sha256 = "";
    let contentType = "";
    let error = "";

    try {
      const res = await fetch(s.url, {
        headers: { "user-agent": UA, accept: "text/html,application/pdf;q=0.9,*/*;q=0.8" },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = res.status;
      contentType = res.headers.get("content-type") || "";
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        bytes = buf.byteLength;
        sha256 = createHash("sha256").update(buf).digest("hex");
        writeFileSync(rawPath, buf);
      } else {
        const retryAfter = res.headers.get("retry-after") || "";
        error = `HTTP ${status}${retryAfter ? ` retry-after=${retryAfter}` : ""}`;
      }
    } catch (e) {
      error = e?.name === "TimeoutError" ? "timeout" : String(e?.message || e);
    }

    const receipt = {
      key: s.key,
      url: s.url,
      publisher: s.publisher,
      title: s.title,
      docDate: s.docDate,
      format: s.format,
      startedAt,
      elapsedMs: Date.now() - t0,
      httpStatus: status,
      contentType,
      bytes,
      sha256,
      rawFile: bytes ? rawPath.split(/[\\/]/).pop() : "",
      error,
    };
    writeFileSync(resolve(RECEIPT_DIR, `${s.key}.json`), JSON.stringify(receipt, null, 2));
    appendFileSync(LEDGER, JSON.stringify(receipt) + "\n");

    const tag = status === 200 ? "ok   " : "FAIL ";
    console.log(`  ${tag} ${s.key}  ${status}  ${bytes} 字节  ${error}`);
    results.push({ key: s.key, status: status === 200 ? "ok" : "failed", receipt });
  }

  return results;
}
