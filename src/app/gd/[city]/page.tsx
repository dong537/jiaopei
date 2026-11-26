import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Loading from "@/app/loading";
import { Container, PageFootnote, PageHero, SectionTitle } from "@/components/ui";
import { GdPreviewNotice, GdRecordList } from "@/components/gd/GdRecordList";
import { gdCityMap } from "@/lib/gd/categories";
import { filterPublicRecords, getPublicCityStats, getPublicProjection, parsePageParam, type PublicSourceKind } from "@/lib/gd/public";

type Args = { params: Promise<{ city: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
function path(slug: string, q: string, kind: string, page: number) {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (kind) sp.set("kind", kind);
  if (page > 1) sp.set("page", String(page));
  return "/gd/" + slug + (sp.size ? "?" + sp : "");
}
export async function generateMetadata({ params, searchParams }: Args): Promise<Metadata> {
  const city = gdCityMap.get((await params).city);
  if (!city) return {};
  const projection = getPublicProjection();
  const sp = await searchParams;
  const rawPage = first(sp.page);
  const requestedPage = parsePageParam(rawPage);
  const cityRecords = projection?.records.filter((record) => record.citySlug === city.slug) ?? [];
  const pages = Math.max(1, Math.ceil(cityRecords.length / 20));
  const validPage = !rawPage || (rawPage === String(requestedPage) && requestedPage <= pages);
  const hasFilters = Object.keys(sp).some((key) => key !== "page");
  const page = validPage ? requestedPage : 1;
  return {
    title: city.name + "教培机构官方来源记录" + (page > 1 ? "·第 " + page + " 页" : ""),
    description: "查询已接入的" + city.name + "培训机构官方公告、名单与年度检查来源记录，逐条回查原文。",
    alternates: { canonical: "/gd/" + city.slug + (page > 1 && !hasFilters ? "?page=" + page : "") },
    robots: { index: Boolean(projection && !projection.preview && cityRecords.length > 0 && validPage && !hasFilters) },
  };
}
export default function CityPage(props: Args) {
  return <Suspense fallback={<Loading />}><CityContent {...props} /></Suspense>;
}
async function CityContent({ params, searchParams }: Args) {
  const slug = (await params).city;
  const city = gdCityMap.get(slug);
  if (!city) notFound();
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 60);
  const kindRaw = first(sp.kind);
  const kind: PublicSourceKind | undefined = kindRaw === "official_whitelist" || kindRaw === "after_school_reference" || kindRaw === "annual_check" || kindRaw === "single_license_notice" ? kindRaw : undefined;
  const page = parsePageParam(first(sp.page));
  const data = getPublicProjection();
  const result = filterPublicRecords(data?.records ?? [], { citySlug: slug, sourceKind: kind, q, page, pageSize: 20 });
  const citySources = data?.sources.filter((source) => source.citySlug === slug) ?? [];
  const otherCities = getPublicCityStats(data?.records ?? []).filter((item) => item.citySlug !== slug).slice(0, 6);
  return <>
    <PageHero breadcrumbRoot={{ name: "广东名录", href: "/gd" }} crumbs={[{ name: city.name }]} eyebrow="官方来源记录" icon="building" title={city.name + "培训机构来源记录"} description={<>本站仅展示已接入的主管部门来源，不代表该市全部机构。许可号和名单时间需结合原公告理解，不能直接推断当前有效状态。</>} />
    <Container className="space-y-6 pt-6">
      {data?.preview && <GdPreviewNotice />}
      {!data ? <p className="rounded-xl border border-line bg-white p-6 text-muted">官方名单尚未批准发布。</p> : <>
        <section className="rounded-xl border border-line bg-white p-4">
          <p className="text-sm text-muted">已接入 {citySources.length} 个来源，当前筛选有 {result.total.toLocaleString("zh-CN")} 条记录。记录数不是机构数。</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link href={path(slug, q, "", 1)} className={!kind ? "rounded-lg bg-brand px-3 py-1.5 text-white" : "rounded-lg bg-page px-3 py-1.5 text-ink"}>全部来源</Link>
            <Link href={path(slug, q, "official_whitelist", 1)} className={kind === "official_whitelist" ? "rounded-lg bg-brand px-3 py-1.5 text-white" : "rounded-lg bg-page px-3 py-1.5 text-ink"}>校外培训白名单</Link>
            <Link href={path(slug, q, "after_school_reference", 1)} className={kind === "after_school_reference" ? "rounded-lg bg-brand px-3 py-1.5 text-white" : "rounded-lg bg-page px-3 py-1.5 text-ink"}>课后服务参考名单</Link>
            <Link href={path(slug, q, "annual_check", 1)} className={kind === "annual_check" ? "rounded-lg bg-brand px-3 py-1.5 text-white" : "rounded-lg bg-page px-3 py-1.5 text-ink"}>年度检查公示</Link>
            <Link href={path(slug, q, "single_license_notice", 1)} className={kind === "single_license_notice" ? "rounded-lg bg-brand px-3 py-1.5 text-white" : "rounded-lg bg-page px-3 py-1.5 text-ink"}>单家许可公告</Link>
          </div>
          <form action={"/gd/" + slug} method="get" className="mt-3 flex gap-2">
            {kind && <input type="hidden" name="kind" value={kind} />}
            <label htmlFor="city-q" className="sr-only">搜索机构名称、区县或许可证号</label>
            <input id="city-q" name="q" defaultValue={q} maxLength={60} placeholder="机构名称、区县或许可证号" className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm text-white">查询</button>
          </form>
        </section>
        <section><SectionTitle aside={"第 " + result.page + " / " + result.pages + " 页"}>来源记录</SectionTitle><GdRecordList records={result.rows} />
          {result.pages > 1 && <nav aria-label="结果分页" className="mt-4 flex items-center justify-between text-sm"><span>{result.total.toLocaleString("zh-CN")} 条记录</span><div className="flex gap-4">{result.page > 1 && <Link className="text-brand" href={path(slug, q, kind ?? "", result.page - 1)}>上一页</Link>}{result.page < result.pages && <Link className="text-brand" href={path(slug, q, kind ?? "", result.page + 1)}>下一页</Link>}</div></nav>}
        </section>
        {citySources.length > 0 && <section>
          <SectionTitle aside="只列本站已接入的公告">{city.name}已接入来源</SectionTitle>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {citySources.map((source) => <li key={source.key} className="rounded-xl border border-line bg-white p-4">
              <Link href={"/gd/license#source-" + source.key} className="font-medium leading-6 text-brand hover:underline">{source.title}</Link>
              <p className="mt-1 text-xs leading-5 text-subtle">{source.publisher} · {source.recordCount} 条来源记录 · 名单截至/观察时间 {source.asOf ?? "暂未核实"}</p>
            </li>)}
          </ul>
        </section>}
        <nav aria-label="继续核对与浏览" className="space-y-3 border-t border-line pt-5 text-sm">
          <div className="flex flex-wrap gap-x-5 gap-y-2"><Link className="text-brand hover:underline" href="/gd/license">查看全部公告及检索</Link><Link className="text-brand hover:underline" href="/gd/methodology">了解名单与许可号怎么核对</Link><Link className="text-brand hover:underline" href="/gd">返回广东地市目录</Link></div>
          {otherCities.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-2 text-subtle"><span>其他已接入地市：</span>{otherCities.map((item) => <Link key={item.citySlug} href={"/gd/" + item.citySlug} className="text-brand hover:underline">{item.city}</Link>)}</div>}
        </nav>
      </>}
      <PageFootnote correctionHref={null}>未出现在本站当前已接入的名单中，不代表无证或不合规。课后服务参考名单、年度检查公示与校外培训白名单属于不同来源类别。</PageFootnote>
    </Container>
  </>;
}
