import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Loading from "@/app/loading";
import { Container, PageFootnote, PageHero, SectionTitle } from "@/components/ui";
import { GdPreviewNotice, GdRecordList, sourceKindLabel } from "@/components/gd/GdRecordList";
import { getPublicProjection, filterPublicRecords, getPublicCityStats, parsePageParam, type PublicSourceKind } from "@/lib/gd/public";

type Args = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ searchParams }: Args): Promise<Metadata> {
  const projection = getPublicProjection();
  const sp = await searchParams;
  const rawPage = first(sp.page);
  const requestedPage = parsePageParam(rawPage);
  const pages = projection ? filterPublicRecords(projection.records, { pageSize: 30 }).pages : 1;
  const validPage = !rawPage || (rawPage === String(requestedPage) && requestedPage <= pages);
  const hasFilters = Object.keys(sp).some((key) => key !== "page");
  const page = validPage ? requestedPage : 1;
  return {
    title: page > 1 ? "广东教培机构官方来源与名单记录·第 " + page + " 页" : "广东教培机构官方来源与名单记录",
    description: "查询已接入的教育主管部门培训机构名单与年度检查公示，查看每条来源、日期及收录范围。",
    alternates: { canonical: "/gd/license" + (page > 1 && !hasFilters ? "?page=" + page : "") },
    robots: { index: Boolean(projection && !projection.preview && validPage && !hasFilters) },
  };
}
function path(city: string, kind: string, q: string, page: number) {
  const sp = new URLSearchParams();
  if (city) sp.set("city", city);
  if (kind) sp.set("kind", kind);
  if (q) sp.set("q", q);
  if (page > 1) sp.set("page", String(page));
  return "/gd/license" + (sp.size ? "?" + sp : "");
}
export default function SourcePage(props: Args) {
  return <Suspense fallback={<Loading />}><SourceContent {...props} /></Suspense>;
}
async function SourceContent({ searchParams }: Args) {
  const sp = await searchParams;
  const data = getPublicProjection();
  const cities = getPublicCityStats(data?.records ?? []);
  const cityRaw = first(sp.city);
  const city = cities.some((item) => item.citySlug === cityRaw) ? cityRaw : "";
  const kindRaw = first(sp.kind);
  const kind: PublicSourceKind | undefined = kindRaw === "official_whitelist" || kindRaw === "after_school_reference" || kindRaw === "annual_check" || kindRaw === "single_license_notice" ? kindRaw : undefined;
  const q = first(sp.q).trim().slice(0, 60);
  const page = parsePageParam(first(sp.page));
  const result = filterPublicRecords(data?.records ?? [], { citySlug: city || undefined, sourceKind: kind, q, page, pageSize: 30 });
  return <>
    <PageHero breadcrumbRoot={{ name: "广东名录", href: "/gd" }} crumbs={[{ name: "官方来源与记录" }]} eyebrow="覆盖说明 · 原文可查" icon="shield" title="官方来源与记录" description={<>本站按原文展示校外培训白名单、课后服务参考名单、年度检查公示和单家许可公告。各类资料分开标注；记录数不等于当前持证机构数。</>} />
    <Container className="space-y-8 pt-6">
      {data?.preview && <GdPreviewNotice />}
      <p className="text-sm leading-6 text-muted">不确定某类公告或许可号的含义？<Link href="/gd/methodology" className="text-brand underline-offset-2 hover:underline">先看名单核对方法</Link>，再打开下方原公告核对单条结论与备注。</p>
      {!data ? <div className="rounded-xl border border-line bg-white p-6 text-sm text-muted">官方来源投影尚未批准发布，当前没有可查询的记录。</div> : <>
        <section>
          <SectionTitle aside={result.total.toLocaleString("zh-CN") + " 条符合条件的来源记录"}>逐条检索</SectionTitle>
          <form action="/gd/license" method="get" className="mb-3 grid gap-2 rounded-xl border border-line bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto]">
            <label htmlFor="source-q" className="sr-only">机构名称、区县或许可证号</label>
            <input id="source-q" name="q" defaultValue={q} maxLength={60} placeholder="机构名称、区县或许可证号" className="min-w-0 rounded-lg border border-line px-3 py-2 text-sm" />
            <label htmlFor="source-city" className="sr-only">地市</label>
            <select id="source-city" name="city" defaultValue={city} className="rounded-lg border border-line px-3 py-2 text-sm"><option value="">全部地市</option>{cities.map((c) => <option value={c.citySlug} key={c.citySlug}>{c.city}</option>)}</select>
            <label htmlFor="source-kind" className="sr-only">来源类型</label>
            <select id="source-kind" name="kind" defaultValue={kind ?? ""} className="rounded-lg border border-line px-3 py-2 text-sm"><option value="">全部来源</option><option value="official_whitelist">校外培训白名单</option><option value="after_school_reference">课后服务参考名单</option><option value="annual_check">年度检查公示</option><option value="single_license_notice">单家许可公告</option></select>
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">查询</button>
          </form>
          <GdRecordList records={result.rows} />
          {result.pages > 1 && <nav aria-label="结果分页" className="mt-4 flex justify-between text-sm"><span>第 {result.page} / {result.pages} 页</span><div className="flex gap-4">{result.page > 1 && <Link href={path(city, kind ?? "", q, result.page - 1)} className="text-brand">上一页</Link>}{result.page < result.pages && <Link href={path(city, kind ?? "", q, result.page + 1)} className="text-brand">下一页</Link>}</div></nav>}
        </section>
        <section>
          <SectionTitle aside={data.sources.length + " 个有记录的来源"}>已接入的公告</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {data.sources.map((source) => <div key={source.key} id={"source-" + source.key} className="scroll-mt-20 rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-brand">{sourceKindLabel(source.sourceKind)}</span><span className="text-xs text-subtle">{source.recordCount} 条记录</span></div>
              <h3 className="mt-2 font-medium leading-6 text-ink">{source.title}</h3>
              <p className="mt-1 text-xs text-subtle">{source.publisher} · {source.city}{source.county ? " · " + source.county : ""} · 名单截至/观察时间 {source.asOf ?? "暂未核实"}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">打开原公告</a><Link href={"/gd/" + source.citySlug} className="text-brand hover:underline">查看{source.city}来源记录</Link></div>
            </div>)}
          </div>
        </section>
      </>}
      <PageFootnote correctionHref={null}>来源原文及本站采集时间可在单条档案中查看。没有记录的城市、类别或机构，不能推断为无证；名单日期、办学许可证有效期和当前经营状态是不同事实。</PageFootnote>
      <p className="text-xs leading-5 text-subtle">本版未结构化提取年检结论与名单中单条备注。查看机构时，请同时打开原公告核对这些可能改变判断的信息。</p>
    </Container>
  </>;
}
