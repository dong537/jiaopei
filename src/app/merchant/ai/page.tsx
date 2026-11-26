import type { Metadata } from "next";
import Link from "next/link";
import { AiStudio, AssistantLiveCount, BrandApply } from "@/components/AiStudio";
import { MerchantShell } from "@/components/MerchantShell";
import { Card, SectionTitle, cx } from "@/components/ui";
import { aiProducts, unansweredQuestions, visibility, visibilityAsOf, visibilityTrend, type Cell } from "@/lib/ai";
import { completeness } from "@/lib/completeness";
import { getOrg } from "@/lib/data";

export const metadata: Metadata = { title: "AI 营销 · 商家中心", robots: { index: false, follow: false } };

const cellStyle: Record<Cell, { mark: string; cls: string; label: string }> = {
  org: { mark: "●", cls: "bg-verified-bg text-verified", label: "引用了你的机构主页" },
  site: { mark: "◐", cls: "bg-claimed-bg text-claimed", label: "引用了教培网，但没提到你" },
  none: { mark: "○", cls: "bg-line-soft text-subtle", label: "没有引用教培网" },
};

const assistantStats = [
  ["对话次数", "214"],
  ["助手直接回答", "81%"],
  ["转机构老师", null],
  ["拒答效果承诺", "9 次"],
] as const;

const topAsked = ["雅思冲刺班多少钱", "最近什么时候开班", "体育西校区怎么走", "能不能先试听", "可以分期吗（未回答）"];

export default function MerchantAiPage() {
  const org = getOrg("gz-waiyu")!;
  const done = completeness(org);
  const cited = visibility.reduce((s, r) => s + r.cells.filter((c) => c === "org").length, 0);
  const total = visibility.length * aiProducts.length;
  const maxTrend = Math.max(...visibilityTrend.map((t) => t[1]), total / 2);

  return (
    <MerchantShell org={org} active="AI 营销">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink">AI 营销</h1>
        <span className="rounded bg-brand-soft px-2 py-0.5 text-xs text-brand">年费会员增值服务 · 已开通 · 到期 2027-03-31</span>
      </div>
      <p className="text-sm leading-6 text-muted">
        学员越来越多地直接问豆包、DeepSeek“哪家机构靠谱、多少钱”。这里帮你看清 AI 怎么回答这些问题、主页还缺什么信息，并用 AI 把缺的答案补上。
        我们不承诺 AI 一定推荐你，开通与否也不影响站内排序和榜单。
      </p>

      <Card>
        <SectionTitle as="h3" aside={`测试日期 ${visibilityAsOf} · 每月测一次`}>
          AI 可见度
        </SectionTitle>
        <div className="grid gap-5 xl:grid-cols-[1fr_220px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-subtle">
                  <th className="py-2 font-normal">学员常问的问题</th>
                  {aiProducts.map((p) => (
                    <th key={p} className="py-2 text-center font-normal">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibility.map((r) => (
                  <tr key={r.q} className="border-b border-line-soft last:border-0">
                    <td className="py-2 text-ink-2">{r.q}</td>
                    {r.cells.map((c, i) => (
                      <td key={i} className="py-2 text-center">
                        <span title={cellStyle[c].label} className={cx("inline-flex size-6 items-center justify-center rounded text-xs", cellStyle[c].cls)}>
                          {cellStyle[c].mark}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-subtle">
              {Object.values(cellStyle).map((c) => (
                <span key={c.mark} className="flex items-center gap-1">
                  <span className={cx("inline-flex size-4 items-center justify-center rounded text-[10px]", c.cls)}>{c.mark}</span>
                  {c.label}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm text-subtle">引用你主页的回答</div>
            <div className="mt-1 text-3xl font-bold text-ink tabular">
              {cited}
              <span className="text-base font-normal text-subtle"> / {total}</span>
            </div>
            <ul className="mt-4 space-y-2">
              {visibilityTrend.map(([m, v]) => (
                <li key={m} className="grid grid-cols-[36px_1fr_24px] items-center gap-2 text-xs">
                  <span className="text-subtle">{m}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-line-soft">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${(v / maxTrend) * 100}%` }} />
                  </span>
                  <span className="text-right text-ink tabular">{v}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-4 text-subtle">
              方法：每月用新账号向 5 个 AI 产品各提问 1 次，记录回答引用的网页。AI 回答本身会变化，这是抽样，不是保证。
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle as="h3">主页还缺什么</SectionTitle>
          <p className="text-sm text-ink-2">AI 引用最多的是结构清楚、有来源、有价格和日期的页面。当前完整度 {done.pct}%：</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-2">
            {done.todos.map((t) => (
              <li key={t.label}>· {t.todo}</li>
            ))}
          </ul>
          <div className="mt-4 text-sm font-medium text-ink">学员在问、主页还没有答案的问题</div>
          <ul className="mt-1 space-y-1 text-sm text-muted">
            {unansweredQuestions.map((u) => (
              <li key={u.q}>· {u.q}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-subtle">来源：AI 咨询助手转人工记录、站内搜索词、AI 可见度测试。下方可以用 AI 起草回答。</p>
        </Card>
        <Card>
          <SectionTitle as="h3" aside="近 30 天">
            AI 咨询助手
          </SectionTitle>
          <dl className="grid grid-cols-2 gap-2 text-center">
            {assistantStats.map(([k, v]) => (
              <div key={k} className="rounded-lg bg-page py-2.5">
                <dd className="text-lg font-bold text-ink tabular">{v ?? <AssistantLiveCount orgId={org.id} base={31} />}</dd>
                <dt className="text-xs text-subtle">{k}</dt>
              </div>
            ))}
          </dl>
          <div className="mt-3 text-sm text-ink-2">问得最多：{topAsked.join("、")}</div>
          <p className="mt-2 text-xs leading-5 text-subtle">
            助手挂在你的
            <Link href={`/org/${org.id}`} className="mx-1 text-brand hover:underline">
              机构主页
            </Link>
            右下角，只用主页数据回答；答不了或学员要报名时转给你，计入
            <Link href="/merchant#leads" className="mx-1 text-brand hover:underline">
              线索
            </Link>
            ，来源记为“AI 咨询助手”，属于独享线索。
          </p>
        </Card>
      </div>

      <Card id="studio">
        <SectionTitle as="h3" aside="草稿 → 你修改 → 合规检查 → 平台审核 → 发布">
          AI 内容助手
        </SectionTitle>
        <AiStudio orgId={org.id} orgName={org.name} suggestions={unansweredQuestions.map((u) => ({ q: u.q, draft: u.draft(org) }))} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle as="h3">微官网</SectionTitle>
          <p className="text-sm leading-6 text-ink-2">用主页数据自动生成的机构官网，课程、价格、校区改一处、两边同步。可绑定子域名或机构自有域名，带预约表单和 AI 咨询助手。</p>
          <p className="mt-2 text-xs text-subtle">为避免重复内容，微官网把规范地址（canonical）指向教培网机构主页，AI 和搜索引擎只认一个信源。</p>
          <Link href={`/site/${org.id}`} className="mt-3 inline-block text-sm text-brand hover:underline">
            预览微官网 →
          </Link>
        </Card>
        <Card>
          <SectionTitle as="h3">品牌内容</SectionTitle>
          <p className="mb-3 text-sm leading-6 text-ink-2">由机构供稿的经验分享、公益直播课，编辑审核后发布，页面明确标注“品牌内容”。不进入榜单、不出现在编辑撰写的选课指南里。</p>
          <BrandApply orgId={org.id} orgName={org.name} />
        </Card>
      </div>

      <Card>
        <SectionTitle as="h3">服务内容与边界</SectionTitle>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <div className="font-medium text-ink">包含（年费会员加购 ¥[X] / 年）</div>
            <ul className="mt-1 space-y-1 text-ink-2">
              <li>· AI 可见度月度测试与报告</li>
              <li>· AI 内容助手（问答、课程介绍、开班通知）</li>
              <li>· 机构主页 AI 咨询助手，转人工计入独享线索</li>
              <li>· 微官网与域名绑定</li>
              <li>· 每季度 1 次品牌内容排期</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-ink">不包含，也不会做</div>
            <ul className="mt-1 space-y-1 text-ink-2">
              <li>· 保证 AI 推荐你或排在第几</li>
              <li>· 改变站内自然排序和榜单名次</li>
              <li>· 代写评价、刷咨询量</li>
              <li>· 发布效果承诺、绝对化用语</li>
            </ul>
          </div>
        </div>
      </Card>
      <p className="text-xs text-subtle">原型页面：可见度与助手数据为示例；内容草稿用模板演示，上线后接已备案的大模型。</p>
    </MerchantShell>
  );
}
