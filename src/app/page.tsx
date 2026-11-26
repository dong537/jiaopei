import { Suspense } from "react";
import { CityPicker } from "@/components/CityPicker";
import { SelectField } from "@/components/SelectField";
import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/LeadForm";
import { OrgTile } from "@/components/OrgCard";
import { RankingTable } from "@/components/RankingTable";
import { PanelTabs, FilterTabs } from "@/components/tabs";
import { Card, Container, FaqList, Icon, SectionTitle } from "@/components/ui";
import { JsonLd } from "@/components/JsonLd";
import {
  categoryGroups,
  cities,
  cityOrgCounts,
  defaultCity,
  enrollFeed,
  homeFaqs,
  hotSearches,
  orgsIn,
  platformStats,
  policies,
  totalCategoryGroups,
  totalSubCategories,
  upcomingExams,
} from "@/lib/data";
import { naturalOrder } from "@/lib/completeness";
import { buildRankings } from "@/lib/rankings";
import { absoluteUrl, site } from "@/lib/site";
import type { Org } from "@/lib/types";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { title: `${site.name}：查培训机构、比课程、看政策`, description: site.description, url: "/" },
};

/** 首页本地机构：自然排序按核验状态、评价数；推广位单独插入并标注 */
function localOrgList(citySlug: string) {
  const all = orgsIn(citySlug).filter((o) => o.verification !== "unclaimed");
  const natural = all
    .filter((o) => !o.promoted)
    .sort(naturalOrder);
  const ads = all.filter((o) => o.promoted);
  const list: { org: Org; ad: boolean }[] = natural.map((org) => ({ org, ad: false }));
  ads.forEach((org, i) => list.splice(Math.min(1 + i * 4, list.length), 0, { org, ad: true }));
  return list;
}

const toneCls = {
  open: "bg-verified-bg text-verified",
  soon: "bg-selfreport-bg text-selfreport",
  neutral: "bg-line-soft text-muted",
};

export default function Home() {
  const city = cities.find((c) => c.slug === defaultCity)!;
  const local = localOrgList(city.slug);
  const groupsPresent = categoryGroups.filter((g) => local.some((l) => l.org.groupSlug === g.slug));
  const rankings = buildRankings(city.slug, "yasi");

  return (
    <>
      {/* 首屏：H1 直接说明网站是什么 */}
      <section className="border-b border-line bg-gradient-to-b from-brand-soft to-white">
        <Container className="py-8 md:py-12">
          <h1 className="max-w-4xl text-2xl font-bold leading-snug text-ink md:text-[34px]">查培训机构、比课程、看政策，每条信息都标明来源</h1>
          <p className="mt-3 max-w-5xl text-[15px] leading-7 text-muted">{site.description}</p>
          <form action="/search" className="mt-6 flex max-w-4xl overflow-hidden rounded-xl border-2 border-brand bg-white shadow-sm">
            <SelectField name="type" aria-label="搜索类型" size="search" className="w-[96px]! sm:w-[132px]!" options={[
              { value: "org", label: "机构" }, { value: "course", label: "课程" },
              { value: "exam", label: "考试与证书" }, { value: "policy", label: "政策" },
            ]} />
            <input name="q" aria-label="搜索关键词" placeholder="搜索机构名称、课程或考试，例如：雅思培训" className="h-12 min-w-0 flex-1 px-4 text-[15px] outline-none" />
            <button className="flex items-center gap-1.5 bg-brand px-5 text-[15px] font-medium text-white hover:bg-brand-dark md:px-7">
              <Icon name="search" />
              搜索
            </button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-subtle">热门搜索：</span>
            {hotSearches.map((h) => (
              <Link key={h.label} href={h.href} className="text-ink-2 hover:text-brand">
                {h.label}
              </Link>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-subtle">热门城市：</span>
            {cities.slice(0, 10).map((c) => (
              <Link key={c.slug} href={`/city/${c.slug}`} className="text-ink-2 hover:text-brand">
                {c.name}
              </Link>
            ))}
            <Suspense fallback={<span className="text-brand">全部城市</span>}><CityPicker variant="link" /></Suspense>
          </div>
        </Container>
      </section>

      <Container className="space-y-10 py-8">
        {/* 平台数据 */}
        <section aria-label="平台数据">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {platformStats.map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-white p-4">
                <div className="text-sm text-subtle">{s.label}</div>
                <div className="mt-1 text-2xl font-bold text-ink tabular">{s.value}</div>
                <div className="mt-0.5 text-xs text-subtle">{s.note}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-subtle">
            数据统计于 {site.asOf}。
            <Link href="/about/methodology#sources" className="ml-1 text-brand hover:underline">
              统计口径与核验标准
            </Link>
          </p>
        </section>

        {/* 类别目录 */}
        <section>
          <SectionTitle aside={`共 ${totalCategoryGroups} 个大类、${totalSubCategories} 个细分方向`}>按类别找机构</SectionTitle>
          <div className="grid grid-cols-4 gap-2 md:hidden">
            {categoryGroups.slice(0, 7).map((g) => (
              <Link key={g.slug} href={`/city/${city.slug}#${g.slug}`} className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-white py-3 text-xs text-ink-2">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft font-semibold text-brand">{g.icon}</span>
                {g.name}
              </Link>
            ))}
            <Link href={`/city/${city.slug}`} className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-white py-3 text-xs text-ink-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-line-soft font-semibold text-muted">全</span>
              全部分类
            </Link>
          </div>
          <div className="hidden gap-3 md:grid md:grid-cols-3 lg:grid-cols-5">
            {categoryGroups.map((g) => (
              <div key={g.slug} className="rounded-xl border border-line bg-white p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft font-semibold text-brand">{g.icon}</span>
                  <div>
                    <div className="font-semibold text-ink">{g.name}</div>
                    <div className="text-xs text-subtle">{g.blurb}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-sm">
                  {g.subs.slice(0, 6).map((s) => (
                    <Link key={s.slug} href={`/city/${city.slug}/${s.slug}`} className="text-ink-2 hover:text-brand">
                      {s.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 hidden text-center md:block">
            <Link href={`/city/${city.slug}`} className="text-sm text-brand hover:underline">
              展开全部 {totalCategoryGroups} 个大类
            </Link>
          </div>
        </section>

        {/* 考试与政策 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionTitle aside="日期以考试机构公告为准">近期考试报名</SectionTitle>
            <ul className="divide-y divide-line-soft">
              {upcomingExams.map((e) => (
                <li key={e.name} className="flex items-center gap-4 py-3">
                  <div className="w-14 shrink-0 rounded-lg bg-page py-1.5 text-center">
                    <div className="text-lg font-bold leading-none text-ink tabular">{e.date.slice(8)}</div>
                    <div className="mt-0.5 text-[11px] text-subtle">{Number(e.date.slice(5, 7))} 月</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    {e.href ? (
                      <Link href={e.href} className="font-medium text-ink hover:text-brand">
                        {e.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{e.name}</span>
                    )}
                    <div className="truncate text-xs text-subtle">{e.org}</div>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${toneCls[e.tone]}`}>{e.status}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <SectionTitle aside={<Link href="/policies" className="text-brand">政策库</Link>}>最新政策</SectionTitle>
            <ul className="divide-y divide-line-soft">
              {policies.map((p) => (
                <li key={p.title} className="py-3">
                  <Link href={`/policies#${p.slug}`} className="font-medium text-ink hover:text-brand">
                    {p.title}
                  </Link>
                  <div className="mt-0.5 text-xs text-subtle">
                    发布机关：{p.org} · {p.date} · 含原文链接与解读
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* 本地机构 */}
        <section>
          <SectionTitle
            aside={
              <>
                共 {cityOrgCounts[city.slug]?.toLocaleString("en-US")} 家 · 默认按核验状态、信息完整度、真实评价排序 ·{" "}
                <Link href="/about/methodology#ranking" className="text-brand">
                  排序规则
                </Link>
              </>
            }
          >
            {city.name}本地培训机构
          </SectionTitle>
          <FilterTabs
            tabs={[{ key: "all", label: "全部" }, ...groupsPresent.map((g) => ({ key: g.slug, label: g.name }))]}
            items={local.map(({ org, ad }) => ({ key: org.groupSlug, node: <OrgTile org={org} ad={ad} /> }))}
            limit={8}
            gridClassName="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
          />
          <div className="mt-4 text-center">
            <Link href={`/city/${city.slug}`} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-5 py-2.5 text-sm text-ink-2 hover:border-brand hover:text-brand">
              查看{city.name}全部 {cityOrgCounts[city.slug]?.toLocaleString("en-US")} 家机构 <Icon name="arrow" className="size-3.5" />
            </Link>
          </div>
        </section>

        {/* 榜单 */}
        <Card>
          <SectionTitle aside="每个榜单只按一项可核实的数据排序 · 仅平台已核验机构上榜 · 付费不影响排名 · 每周一更新">
            {city.name}雅思培训机构榜单
          </SectionTitle>
          <PanelTabs
            tabs={rankings.map((r) => r.name)}
            panels={rankings.map((r) => (
              <div key={r.key} className="grid gap-6 lg:grid-cols-[1fr_340px]">
                <RankingTable ranking={r} limit={5} showMeta={false} />
                <aside className="rounded-lg bg-page p-4 text-sm leading-6">
                  <div className="mb-2 font-semibold text-ink">排名依据：{r.name}</div>
                  <dl className="space-y-1.5 text-muted">
                    <div>
                      <dt className="inline text-subtle">指标：</dt>
                      <dd className="inline">{r.basis}</dd>
                    </div>
                    <div>
                      <dt className="inline text-subtle">统计周期：</dt>
                      <dd className="inline">{r.period}</dd>
                    </div>
                    <div>
                      <dt className="inline text-subtle">入榜门槛：</dt>
                      <dd className="inline">{r.gate}</dd>
                    </div>
                    <div>
                      <dt className="inline text-subtle">数据来源：</dt>
                      <dd className="inline">{r.source}</dd>
                    </div>
                  </dl>
                  <Link href={`/rankings/${city.slug}/yasi#${r.key}`} className="mt-3 inline-block text-brand hover:underline">
                    查看完整榜单与计算方法
                  </Link>
                </aside>
              </div>
            ))}
          />
        </Card>

        {/* 免费选课 + 最新报名 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card id="advisor" className="border-brand-tint bg-gradient-to-br from-brand-soft to-white">
            <h2 className="text-xl font-semibold text-ink">不知道怎么选？免费帮你选课</h2>
            <p className="mb-4 mt-1 text-sm text-muted">选课顾问按你的目标、预算和位置推荐 3 家已核验机构，不收任何费用。</p>
            <LeadForm
              fields={[
                { kind: "choice", name: "subject", label: "想学什么", options: ["雅思", "初级会计", "UI 设计", "其他"] },
                { kind: "choice", name: "budget", label: "预算", options: ["5,000 元以内", "5,000–10,000 元", "10,000 元以上"] },
                { kind: "text", name: "phone", label: "手机号", type: "tel", placeholder: "11 位手机号" },
              ]}
              submitLabel="获取选课建议"
              consent="同意《隐私政策》，手机号只用于本次选课回电"
              note="工作时间 30 分钟内回电。"
              success="已收到，选课顾问会在工作时间 30 分钟内回电。"
              record={{ kind: "advisor" }}
            />
          </Card>
          <Card>
            <SectionTitle aside="仅显示通过平台担保付款完成的真实报名，学员信息已脱敏">最新报名</SectionTitle>
            <ul className="divide-y divide-line-soft">
              {enrollFeed.map((f) => (
                <li key={f.ago + f.user} className="flex items-center gap-3 py-3 text-sm">
                  <span className="w-20 shrink-0 text-xs text-subtle">{f.ago}</span>
                  <span className="min-w-0 flex-1 text-ink-2">
                    {f.user} 报名了{" "}
                    <Link href={f.href} className="font-medium text-ink hover:text-brand">
                      {f.course}
                    </Link>
                  </span>
                  <span className="hidden shrink-0 text-xs text-subtle sm:inline">{f.org}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* 行业研究 */}
        <Card className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="text-xs font-medium text-brand">行业研究 · 季度报告</div>
            <h2 className="mt-1 text-xl font-semibold text-ink">2026 年第三季度广州职业技能培训市场报告</h2>
            <p className="mt-2 text-sm leading-6 text-muted">基于教培网收录的广州机构与课程数据，统计机构数量、课程价格分布和核验比例。可免费下载，引用请注明出处。</p>
            <Link href="/about/methodology#research" className="mt-3 inline-block text-sm text-brand hover:underline">
              阅读报告与下载数据
            </Link>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[
              ["机构数", "[N]"],
              ["学费中位数", "[X] 元"],
              ["核验比例", "[Y]%"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-page px-4 py-3">
                <dd className="text-lg font-bold text-ink">{v}</dd>
                <dt className="text-xs text-subtle">{k}</dt>
              </div>
            ))}
          </dl>
        </Card>

        <Card id="faq">
          <SectionTitle>常见问题</SectionTitle>
          <FaqList items={homeFaqs} />
        </Card>

        {/* 机构入驻 */}
        <section className="flex flex-col items-start justify-between gap-4 rounded-xl bg-brand p-6 text-white md:flex-row md:items-center md:p-8">
          <div>
            <h2 className="text-xl font-semibold">你是培训机构？认领你的主页</h2>
            <p className="mt-1 text-sm text-white/80">完善资质与课程信息，接收来自搜索引擎和 AI 助手的学员咨询。基础入驻免费。</p>
          </div>
          <Link href="/join" className="rounded-lg bg-cta px-5 py-3 text-sm font-medium text-white hover:bg-cta-dark">
            免费入驻 / 认领机构
          </Link>
        </section>
      </Container>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${city.name}本地培训机构`,
          itemListElement: local
            .filter((l) => !l.ad)
            .map((l, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/org/${l.org.id}`), name: l.org.name })),
        }}
      />
    </>
  );
}
