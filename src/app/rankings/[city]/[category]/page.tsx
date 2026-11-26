import Loading from "@/app/loading";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { RankingTable, medals } from "@/components/RankingTable";
import { AnswerBox, Breadcrumbs, Card, Container, FaqList, HeroStats, Icon, IconTile, PageFootnote, PageHero, PhotoBox, SectionTitle, type IconName } from "@/components/ui";
import { getCategory, getCity, marketStats, orgsIn } from "@/lib/data";
import { BAYES_M, MIN_RANKED, buildRankings, cityAverageRating, rankingSummary } from "@/lib/rankings";
import { absoluteUrl, site } from "@/lib/site";

export function generateStaticParams() {
  return [{ city: "guangzhou", category: "yasi" }];
}

// 2026-10-26 是周一：第 4 周
const weekLabel = "2026 年 10 月第 4 周";

const principles: [IconName, "brand" | "emerald" | "orange" | "violet", string, string][] = [
  ["list", "brand", "一个榜单只看一项数据", "不做“综合打分”，每个排名都能说清楚为什么。"],
  ["shield", "emerald", "只有已核验机构上榜", "资质未通过平台核验的机构不参与排名。"],
  ["coin", "orange", "付费不影响排名", "年费会员、按成交付费、线索包和推广位都不改变榜单顺序。"],
  ["calendar", "violet", "每周一更新，往期可查", "数据有误可提交申诉，核实后在下期更正并记录。"],
];

/** 每个榜单的图标与配色，只用于区分卡片 */
const boardStyle: Record<string, { icon: IconName; tone: "amber" | "brand" | "rose" | "violet" | "emerald" | "cyan" }> = {
  rating: { icon: "star", tone: "amber" },
  enroll: { icon: "users", tone: "brand" },
  inquiry: { icon: "flame", tone: "rose" },
  teachers: { icon: "cap", tone: "violet" },
  years: { icon: "calendar", tone: "emerald" },
  hourly: { icon: "coin", tone: "cyan" },
};

const faqs = [
  { q: "为什么没有“综合排名”？", a: "综合排名需要给各项指标定权重，权重本身就是主观判断。我们只按单一、可核实的数据排序，并公开数据来源，学员可以按自己最在意的维度选择。" },
  { q: "机构付费能上榜或提高排名吗？", a: "不能。付费只购买标注“推广”的展示位，榜单顺序只由公开的指标决定。" },
  { q: "为什么某家知名机构不在榜上？", a: `可能尚未认领或未通过资质核验，或未达到该榜单的入榜门槛（如评价数不足 ${BAYES_M} 条）。` },
];

async function load(params: PageProps<"/rankings/[city]/[category]">["params"]) {
  const { city: c, category: k } = await params;
  const city = getCity(c);
  const cat = getCategory(k);
  if (!city || !cat) notFound();
  const verifiedCount = orgsIn(city.slug, cat.category.slug).filter((o) => o.verification === "verified").length;
  // 与“本周结论”同一口径：有全市统计时用全市已核验机构数
  const verifiedTotal = marketStats[`${city.slug}/${cat.category.slug}`]?.verifiedCount ?? verifiedCount;
  return { city, category: cat.category, enough: verifiedCount >= MIN_RANKED, verifiedTotal };
}

export async function generateMetadata({ params }: PageProps<"/rankings/[city]/[category]">): Promise<Metadata> {
  const { city, category, enough } = await load(params);
  const title = `${city.name}${category.name}培训机构排名（${weekLabel}）`;
  const description = rankingSummary(city.slug, category.slug, buildRankings(city.slug, category.slug));
  const url = `/rankings/${city.slug}/${category.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    robots: enough ? undefined : { index: false, follow: true },
  };
}

export default function RankingPage(props: PageProps<"/rankings/[city]/[category]">) {
  return <Suspense fallback={<Loading />}><RankingPageContent {...props} /></Suspense>;
}

async function RankingPageContent({ params }: PageProps<"/rankings/[city]/[category]">) {
  const { city, category, enough, verifiedTotal } = await load(params);
  if (!enough) {
    return (
      <Container>
        <Breadcrumbs items={[{ name: "榜单" }, { name: city.name, href: `/city/${city.slug}` }, { name: `${category.name}培训` }]} />
        <h1 className="text-2xl font-bold text-ink md:text-3xl">
          {city.name}
          {category.name}培训机构榜单
        </h1>
        <div className="mt-5">
          <AnswerBox title="暂不发布">
            {city.name}
            {category.name}培训的已核验机构不足 {MIN_RANKED} 家，暂不发布榜单。可以先查看
            <Link href={`/city/${city.slug}/${category.slug}`} className="text-brand hover:underline">
              {city.name}
              {category.name}培训机构列表
            </Link>
            。
          </AnswerBox>
        </div>
      </Container>
    );
  }
  const rankings = buildRankings(city.slug, category.slug);
  const cityAvg = cityAverageRating(city.slug, category.slug);
  const spotlight = [
    { r: rankings.find((r) => r.key === "rating"), label: "好评榜第一" },
    { r: rankings.find((r) => r.key === "enroll"), label: "报名人数榜第一" },
    { r: rankings.find((r) => r.key === "hourly"), label: "小班课时单价最低" },
  ].filter((x): x is { r: (typeof rankings)[number]; label: string } => !!x.r?.rows.length);
  const url = absoluteUrl(`/rankings/${city.slug}/${category.slug}`);

  return (
    <>
      <PageHero
        crumbs={[{ name: "榜单" }, { name: city.name, href: `/city/${city.slug}` }, { name: `${category.name}培训` }]}
        eyebrow="每周一更新 · 付费不影响排名"
        icon="trophy"
        title={
          <>
            {city.name}
            {category.name}培训机构榜单
            <span className="mt-1.5 block text-base font-medium text-subtle md:text-lg">（{weekLabel}）</span>
          </>
        }
        aside={
          <HeroStats
            items={[
              { label: "参与排名", value: <>{verifiedTotal}<span className="ml-1 text-sm font-normal text-subtle">家已核验</span></> },
              { label: "单项榜单", value: <>{rankings.length}<span className="ml-1 text-sm font-normal text-subtle">个</span></> },
              { label: "数据截至", value: <span className="text-lg">{site.asOf}</span> },
              { label: "往期榜单", value: <span className="text-lg">2026-10-19</span> },
            ]}
          />
        }
      >
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-white/85 px-3 py-1 text-ink-2 ring-1 ring-line">城市：{city.name}</span>
          <span className="rounded-full bg-white/85 px-3 py-1 text-ink-2 ring-1 ring-line">类别：{category.name}培训</span>
        </div>
      </PageHero>

      <Container className="pt-6 md:pt-7">
      <AnswerBox title="本周结论">{rankingSummary(city.slug, category.slug, rankings)}</AnswerBox>

      {/* 本周第一：与“本周结论”同一组数据，只是换成带机构图片的卡片 */}
      <ul className="mt-4 grid gap-4 md:grid-cols-3">
        {spotlight.map(({ r, label }) => {
          const w = r.rows[0];
          return (
            <li key={r.key}>
              <Link href={`/org/${w.org.id}`} className="group flex h-full items-center gap-4 rounded-2xl border border-line bg-white p-3 pr-5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition hover:border-brand-tint hover:shadow-[0_10px_30px_rgb(30_79_216/0.08)]">
                <div className="relative shrink-0">
                  <PhotoBox photo={w.org.photo} className="aspect-[4/3] w-24 rounded-xl sm:w-28" sizes="112px" />
                  <span className={`absolute -left-1.5 -top-1.5 inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ring-2 ring-white ${medals[0]}`}>1</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-xs font-medium text-amber-700">
                    <Icon name={boardStyle[r.key]?.icon ?? "trophy"} className="size-3.5" />
                    {label}
                  </div>
                  <div className="mt-1 truncate font-semibold text-ink group-hover:text-brand">{w.org.name}</div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                    <span className="whitespace-nowrap text-lg font-bold text-ink tabular">{w.display}</span>
                    <span className="text-xs text-subtle">{r.unit}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <ul className="mt-5 grid gap-px overflow-hidden rounded-xl border border-line bg-line-soft shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:grid-cols-2 lg:grid-cols-4">
        {principles.map(([icon, tone, t, d]) => (
          <li key={t} className="flex gap-3 bg-white p-4 md:p-5">
            <IconTile name={icon} tone={tone} />
            <div className="min-w-0">
              <div className="font-semibold text-ink">{t}</div>
              <div className="mt-1 text-sm leading-6 text-muted">{d}</div>
            </div>
          </li>
        ))}
      </ul>

      <nav aria-label="榜单目录" className="mt-8 flex flex-wrap gap-2">
        {rankings.map((r) => (
          <a key={r.key} href={`#${r.key}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-ink-2 hover:border-brand hover:text-brand">
            <IconTile name={boardStyle[r.key]?.icon ?? "trophy"} tone={boardStyle[r.key]?.tone ?? "brand"} className="size-5 rounded-full [&>svg]:size-3" />
            {r.name}
          </a>
        ))}
      </nav>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {rankings.map((r) => (
          <Card key={r.key} id={r.key} className="flex scroll-mt-28 flex-col p-0! md:p-0!">
            <div className="flex gap-3 px-5 pt-5 md:px-6 md:pt-6">
              <IconTile name={boardStyle[r.key]?.icon ?? "trophy"} tone={boardStyle[r.key]?.tone ?? "brand"} className="size-10" />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-ink">{r.name}</h2>
                <p className="mt-0.5 text-sm leading-6 text-muted">{r.basis}</p>
              </div>
            </div>
            <div className="flex-1 px-5 pt-3 md:px-6">
              <RankingTable ranking={r} showMeta={false} />
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 rounded-b-xl border-t border-line-soft bg-page/70 px-5 py-3 text-xs md:px-6">
              <div className="min-w-0">
                <dt className="text-subtle">统计周期</dt>
                <dd className="mt-0.5 text-ink-2">{r.period}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-subtle">入榜门槛</dt>
                <dd className="mt-0.5 text-ink-2">{r.gate}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-subtle">数据来源</dt>
                <dd className="mt-0.5 text-ink-2">{r.source}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      <Card className="mt-5">
        <SectionTitle>好评榜的加权评分怎么算</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center">
          <div className="space-y-3 leading-7 text-ink-2">
            <p>只有 3 条评价、都是 5 分的机构，不应排在 200 条评价、平均 4.8 分的机构前面。所以好评榜使用加权评分：评价越多，加权分越接近机构自己的平均分。</p>
            <p>
              完整规则见
              <Link href="/about/methodology#ranking" className="text-brand hover:underline">
                数据来源与排名规则
              </Link>
              。
            </p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-brand-soft to-white p-5 ring-1 ring-brand-tint">
            <p className="text-center text-lg font-semibold text-ink">加权分 =（v × R + m × C）÷（v + m）</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {[
                ["R", "机构平均分"],
                ["v", "机构评价数"],
                ["C", `${city.name}${category.name}机构整体平均分（本期 ${cityAvg.toFixed(2)}）`],
                ["m", `先验评价数，取 ${BAYES_M}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start gap-2 rounded-lg bg-white/80 px-3 py-2">
                  <dt className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand font-semibold italic text-white">{k}</dt>
                  <dd className="text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Card>

      <Card className="mt-5">
        <SectionTitle>关于榜单的常见问题</SectionTitle>
        <FaqList items={faqs} />
      </Card>

      <PageFootnote>
        榜单数据截至 {site.asOf} 00:00 · 编辑：[姓名] · 机构对排名有异议？可通过商家中心提交申诉 · 往期榜单与更正记录随每期公开。
      </PageFootnote>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": rankings
            .filter((r) => r.rows.length)
            .map((r) => ({
              "@type": "ItemList",
              "@id": `${url}#${r.key}`,
              name: `${city.name}${category.name}培训机构${r.name}（${weekLabel}）`,
              description: `${r.basis} 统计周期：${r.period}；入榜门槛：${r.gate}；来源：${r.source}。`,
              itemListOrder: r.key === "hourly" ? "https://schema.org/ItemListOrderAscending" : "https://schema.org/ItemListOrderDescending",
              numberOfItems: r.rows.length,
              itemListElement: r.rows.map((row, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: row.org.name,
                url: absoluteUrl(`/org/${row.org.id}`),
                description: `${r.unit}：${row.display}`,
              })),
            })),
        }}
      />
      </Container>
    </>
  );
}
