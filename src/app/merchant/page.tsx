import type { Metadata } from "next";
import Link from "next/link";
import { MerchantShell } from "@/components/MerchantShell";
import { Card, SectionTitle, cx } from "@/components/ui";
import { MerchantLive } from "@/components/MerchantLive";
import { completeness } from "@/lib/completeness";
import { getOrg } from "@/lib/data";

export const metadata: Metadata = {
  title: "商家中心",
  robots: { index: false, follow: false },
};

const leads = [
  {
    id: "L-1026a",
    t: "10-26 09:12",
    u: "陈** · 虚拟号",
    c: "雅思 6.5 分冲刺小班",
    s: "AI 搜索 · 豆包",
    st: "new",
  },
  {
    id: "L-1025a",
    t: "10-25 20:41",
    u: "王** · 虚拟号",
    c: "托福 100 分冲刺班",
    s: "百度搜索",
    st: "new",
  },
  {
    id: "L-1025b",
    t: "10-25 15:03",
    u: "李** · 虚拟号",
    c: "雅思 7 分精品一对一",
    s: "AI 搜索 · DeepSeek",
    st: "follow",
  },
  {
    id: "L-1024a",
    t: "10-24 11:27",
    u: "赵** · 虚拟号",
    c: "雅思基础预备班",
    s: "教培网站内",
    st: "follow",
  },
  {
    id: "L-1023a",
    t: "10-23 18:55",
    u: "周** · 虚拟号",
    c: "雅思 6.5 分冲刺小班",
    s: "AI 搜索 · 豆包",
    st: "won",
  },
] as const;

const sources = [
  ["百度搜索", 1690],
  ["AI 搜索", 1162],
  ["教培网站内", 1034],
  ["微信小程序", 612],
  ["其他", 322],
] as const;

const ai = [
  ["豆包", 438],
  ["DeepSeek", 296],
  ["百度 AI 搜索", 201],
  ["腾讯元宝", 134],
  ["Kimi 等其他", 93],
] as const;

function Bars({ rows, highlight }: { rows: readonly (readonly [string, number])[]; highlight?: string }) {
  const max = Math.max(...rows.map((r) => r[1]));
  return (
    <ul className="space-y-2.5">
      {rows.map(([n, v]) => (
        <li key={n} className="grid grid-cols-[96px_1fr_48px] items-center gap-3 text-sm">
          <span className="text-muted">{n}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-line-soft">
            <span
              className={cx("block h-full rounded-full", !highlight || n === highlight ? "bg-brand" : "bg-subtle/60")}
              style={{ width: `${(v / max) * 100}%` }}
            />
          </span>
          <span className="text-right text-ink tabular">{v.toLocaleString("en-US")}</span>
        </li>
      ))}
    </ul>
  );
}

export default function MerchantPage() {
  const org = getOrg("gz-waiyu")!;
  const done = completeness(org);
  const visits = sources.reduce((s, r) => s + r[1], 0);
  const aiVisits = ai.reduce((s, r) => s + r[1], 0);

  return (
    <MerchantShell org={org} active="概览">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink">概览</h1>
        <div className="flex overflow-hidden rounded-lg border border-line bg-white text-sm">
          <span className="bg-brand px-3 py-1.5 text-white">近 30 天</span>
          <span className="px-3 py-1.5 text-ink-2">近 90 天</span>
        </div>
      </div>

      <Card className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="w-48 shrink-0">
          <div className="text-sm text-subtle">主页完整度</div>
          <div className="mt-1 text-3xl font-bold text-ink">{done.pct}%</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line-soft">
            <div className="h-full rounded-full bg-brand" style={{ width: `${done.pct}%` }} />
          </div>
        </div>
        <div className="text-sm leading-7 text-ink-2">
          完善以下 {done.todos.length} 项可提升列表排序（完整度是自然排序的第二依据）：
          {done.todos.map((t) => (
            <div key={t.label}>· {t.todo}</div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["主页访问", visits.toLocaleString("en-US"), "比上月 +18%", true],
          ["咨询线索", String(org.inquiries30d), "比上月 +9 条", true],
          ["线上成交", "12 单", "线索转化率 26%", false],
          ["成交金额", "¥96,400", "平台担保付款", false],
        ].map(([l, v, d, up]) => (
          <div key={String(l)} className="rounded-xl border border-line bg-white p-4">
            <div className="text-sm text-subtle">{l}</div>
            <div className="mt-1 text-2xl font-bold text-ink tabular">{v}</div>
            <div className={cx("mt-0.5 text-xs", up ? "text-verified" : "text-muted")}>{d}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle as="h3" aside={`近 30 天 · 共 ${visits.toLocaleString("en-US")} 次访问`}>
            访问来源
          </SectionTitle>
          <Bars rows={sources} highlight="AI 搜索" />
        </Card>
        <Card>
          <SectionTitle as="h3" aside={`近 30 天 · ${aiVisits.toLocaleString("en-US")} 次，占全部访问 ${Math.round((aiVisits / visits) * 100)}%`}>
            AI 搜索带来的访问
          </SectionTitle>
          <Bars rows={ai} />
          <p className="mt-3 text-xs text-subtle">
            AI 最常引用的页面：机构概况、课程与价格表 ·{" "}
            <Link href="/merchant/ai" className="text-brand hover:underline">
              在 AI 营销中心查看 8 个常见问题的引用情况
            </Link>
          </p>
        </Card>
      </div>

      <MerchantLive orgId={org.id} orgName={org.name} staticLeads={leads.map((l) => ({ ...l }))} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle as="h3">推广位</SectionTitle>
          <p className="text-sm leading-6 text-ink-2">年费会员权益：可申请“广州 · 雅思”列表推广位，与其他会员轮播展示，页面标注“推广”。</p>
          <p className="mt-2 text-sm text-muted">当前状态：排队中（第 3 位），预计 2026-11-16 起展示 2 周。</p>
          <p className="mt-2 text-xs text-subtle">推广位不改变自然排序，也不进入榜单计算。</p>
        </Card>
        <Card>
          <SectionTitle as="h3">资质与核验</SectionTitle>
          <ul className="space-y-2 text-sm text-ink-2">
            <li>营业执照、办学备案：已核验（{org.verifiedAt}）</li>
            <li>
              教师资质：{org.teachersVerified} / {org.teachersTotal} 已查验
            </li>
            <li>下次复核：{org.verifiedUntil}（到期前 60 天提醒，逾期未复核主页降为“机构已认领”，暂停在线报名）</li>
          </ul>
          <p className="mt-3 text-sm text-brand">更新资质材料</p>
        </Card>
        <Card id="account" className="xl:col-span-2">
          <SectionTitle as="h3">账户与套餐</SectionTitle>
          <ul className="space-y-1.5 text-sm text-ink-2">
            <li>当前套餐：年费会员，到期 2027-03-31（到期后自动转为免费入驻，在线报名关闭、已售订单照常履约结算）</li>
            <li>线索余额：会员赠送 38 条；用完后从线索包预充值余额按条扣费</li>
            <li>榜单申诉：对名次数据有异议，可提交申诉，平台核实后在下期榜单更正</li>
          </ul>
        </Card>
      </div>
      <p className="text-xs text-subtle">原型页面：商家中心为登录后可见，数据为示例。</p>
    </MerchantShell>
  );
}
