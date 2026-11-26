// 有限只读探测：仅请求 robots.txt，判断各来源域名的爬取约定。
// 预算：16 个域名，各 1 次请求，间隔 1.5s，总请求 ≤16。
const hosts = [
  "www.ruyuan.gov.cn", "www.gdsx.gov.cn", "www.xinfeng.gov.cn", "mmjyj.maoming.gov.cn",
  "www.luoding.gov.cn", "www.gdyunan.gov.cn", "www.yangchun.gov.cn", "www.shanwei.gov.cn",
  "www.hp.gov.cn", "www.panyu.gov.cn", "edu.dg.gov.cn", "www.yingde.gov.cn",
  "jyj.longyan.gov.cn", "innovation.jinan.gov.cn", "glq.fuzhou.gov.cn", "www.whxinzhou.gov.cn",
];
const UA = "Mozilla/5.0 (compatible; edu-source-research/0.1; robots-check)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const out = [];
for (const h of hosts) {
  n++;
  const url = `https://${h}/robots.txt`;
  const rec = { host: h, url, status: null, disallow: [], size: null, note: "" };
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    rec.status = res.status;
    if (res.ok) {
      const t = await res.text();
      rec.size = t.length;
      const dl = [];
      for (const m of t.matchAll(/^Disallow:\s*(\S+)/gim)) dl.push(m[1]);
      rec.disallow = dl.slice(0, 6);
      rec.note = "有 robots.txt";
    } else {
      rec.note = res.status === 404 ? "robots.txt 404（未声明）" : `HTTP ${res.status}`;
    }
  } catch (e) {
    rec.note = e?.name === "TimeoutError" ? "timeout" : String(e?.message || e).slice(0, 60);
  }
  out.push(rec);
  console.log(`${String(n).padStart(2)} ${h} -> ${rec.status || "ERR"} ${rec.note}`);
  if (n < hosts.length) await sleep(1500);
}
console.log("\n总请求数:", n);
import("node:fs").then((fs) => fs.writeFileSync("data/whitelist/robots-probe.json", JSON.stringify(out, null, 2)));
