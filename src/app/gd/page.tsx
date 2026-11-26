import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageFootnote, PageHero, SectionTitle } from "@/components/ui";
import { GdPreviewNotice, GdRecordList } from "@/components/gd/GdRecordList";
import { getPublicCityStats, getPublicProjection } from "@/lib/gd/public";

export function generateMetadata(): Metadata {
  const projection = getPublicProjection();
  return {
    title: "广东教培机构官方名单查询",
    description: "按地市查询广东教育主管部门公布的培训机构名单与年度检查公示，逐条查看原文来源和日期。",
    alternates: { canonical: "/gd" },
    robots: { index: Boolean(projection && !projection.preview) },
  };
}

export default function GuangdongPage() {
  const data = getPublicProjection();
  const cities = getPublicCityStats(data?.records ?? []);
  const whitelistCount = data?.records.filter((r) => r.sourceKind === "official_whitelist").length ?? 0;
  const annualCount = data?.records.filter((r) => r.sourceKind === "annual_check").length ?? 0;
  const referenceCount = data?.records.filter((r) => r.sourceKind === "after_school_reference").length ?? 0;
  const noticeCount = data?.records.filter((r) => r.sourceKind === "single_license_notice").length ?? 0;
  const examples = data ? [
    ...data.records.filter((r) => r.sourceKind === "official_whitelist").slice(0, 4),
    ...data.records.filter((r) => r.sourceKind === "annual_check").slice(0, 2),
    ...data.records.filter((r) => r.sourceKind === "after_school_reference").slice(0, 2),
    ...data.records.filter((r) => r.sourceKind === "single_license_notice").slice(0, 2),
  ] : [];
  return <>
    <PageHero
      breadcrumbRoot={{ name: "广东名录", href: "/gd" }}
      crumbs={[]}
      eyebrow="教育主管部门原文 · 可回查来源"
      icon="building"
      title="广东教培机构官方名单查询"
      description={<>查询已接入的校外培训白名单、课后服务参考名单、年度检查公示与单家许可公告。每条记录均可回查原文；历史刊载不等于现时许可有效。</>}
      aside={<form action="/gd/license" method="get" className="rounded-xl border border-line bg-white p-4">
        <label htmlFor="gd-home-q" className="block text-sm font-semibold text-ink">查机构名单原文</label>
        <div className="mt-3 flex gap-2"><input id="gd-home-q" name="q" maxLength={60} placeholder="机构名称、区县或许可证号" className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm" /><button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">查询</button></div>
        <p className="mt-2 text-xs text-subtle">只检索已接入来源，不代表全省完整覆盖。</p>
      </form>}
    />
    <Container className="space-y-8 pt-6 md:pt-8">
      {data?.preview && <GdPreviewNotice />}
      {!data ? <section className="rounded-xl border border-line bg-white p-6"><h2 className="font-semibold text-ink">广东名单尚未发布</h2><p className="mt-2 text-sm text-muted">来源记录仍在审查。发布后将提供地市检索、逐条档案和原文链接。</p></section> : <>
        <section>
          <SectionTitle aside="记录条数不是全省机构总数">当前接入范围</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs text-subtle">有记录的地市</p><p className="mt-1 text-2xl font-semibold text-ink">{cities.length}</p></div>
            <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs text-subtle">校外培训白名单观察</p><p className="mt-1 text-2xl font-semibold text-ink">{whitelistCount.toLocaleString("zh-CN")}</p></div>
            <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs text-subtle">课后服务参考观察</p><p className="mt-1 text-2xl font-semibold text-ink">{referenceCount.toLocaleString("zh-CN")}</p></div>
            <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs text-subtle">年检公示观察</p><p className="mt-1 text-2xl font-semibold text-ink">{annualCount.toLocaleString("zh-CN")}</p></div>
            <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs text-subtle">单家许可公告观察</p><p className="mt-1 text-2xl font-semibold text-ink">{noticeCount.toLocaleString("zh-CN")}</p></div>
          </div>
          <p className="mt-2 text-xs text-subtle">来自 {data.sources.length} 个官方来源；投影生成于 {data.generatedAt.slice(0, 10)}。同一机构可能出现多条，不能将记录数视为机构家数。</p>
        </section>
        <section><SectionTitle aside="仅列已接入的地市">按地市查看</SectionTitle><div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cities.map((c) => <Link key={c.citySlug} href={"/gd/" + c.citySlug} className="rounded-xl border border-line bg-white p-4 hover:border-brand-tint"><strong className="block text-ink">{c.city}</strong><span className="mt-2 block text-xs text-subtle">{c.records.toLocaleString("zh-CN")} 条来源记录</span></Link>)}
        </div></section>
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-ink">名单中有许可号，是否代表现在仍有效？</h2><p className="mt-1 text-sm leading-6 text-muted">名单、年检和单家许可公告的含义不同。先看来源和时间，再回查原文结论与备注。</p></div>
          <Link href="/gd/methodology" className="shrink-0 text-sm font-medium text-brand underline-offset-2 hover:underline">阅读名单核对方法</Link>
        </section>
        <section><SectionTitle aside={<Link href="/gd/license" className="text-brand hover:underline">查看全部来源与记录</Link>}>名单记录示例</SectionTitle><GdRecordList records={examples} /></section>
      </>}
      <PageFootnote correctionHref={null}>此处是官方公告的历史刊载信息。来源日期可能为发布日期、名单截至日或年检年度，以原公告为准；未收录不代表无证，名单列有许可号也不单独证明当前有效期。</PageFootnote>
    </Container>
  </>;
}
