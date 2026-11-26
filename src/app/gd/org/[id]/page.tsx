import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Loading from "@/app/loading";
import { Container, PageFootnote, PageHero, SectionTitle } from "@/components/ui";
import { GdPreviewNotice, sourceKindLabel } from "@/components/gd/GdRecordList";
import { getPublicProjection, getPublicRecord } from "@/lib/gd/public";

type Args = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const record = getPublicRecord((await params).id);
  if (!record) return { robots: { index: false } };
  const preview = getPublicProjection()?.preview ?? true;
  return {
    title: record.name + "｜广东官方来源记录",
    description: record.publisher + "公布的" + record.name + "名单记录，查看原公告与来源日期。",
    alternates: { canonical: "/gd/org/" + encodeURIComponent(record.id) },
    robots: { index: !preview },
  };
}
function Fact({ label, value, sourceUrl }: { label: string; value: string | null; sourceUrl: string }) {
  return <div className="border-b border-line-soft py-3 last:border-b-0 sm:grid sm:grid-cols-[8rem_1fr] sm:gap-4">
    <dt className="text-sm text-subtle">{label}</dt>
    <dd className="mt-1 min-w-0 break-words text-sm text-ink sm:mt-0">{value || "暂未核实或未提取"}{value && <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-2 whitespace-nowrap text-xs text-brand hover:underline">核对原文</a>}</dd>
  </div>;
}
export default function RecordPage(props: Args) {
  return <Suspense fallback={<Loading />}><RecordContent {...props} /></Suspense>;
}

async function RecordContent({ params }: Args) {
  const record = getPublicRecord((await params).id);
  if (!record) notFound();
  const projection = getPublicProjection();
  const preview = projection?.preview ?? false;
  const related = projection?.records.filter((item) => item.sourceKey === record.sourceKey && item.id !== record.id).slice(0, 4) ?? [];
  return <>
    <PageHero breadcrumbRoot={{ name: "广东名录", href: "/gd" }} crumbs={[{ name: record.city, href: "/gd/" + record.citySlug }, { name: record.name }]} eyebrow={sourceKindLabel(record.sourceKind)} icon="building" title={record.name} description={<>这是 <strong>{record.publisher}</strong> 公布的名单原文记录。页面陈列的是历史刊载事实，不代表本站已核验当前许可证有效期、实际经营状态或校区归属。</>} />
    <Container className="space-y-6 pt-6">
      {preview && <GdPreviewNotice />}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="rounded-xl border border-line bg-white p-5">
          <SectionTitle>原文记载</SectionTitle>
          <p className="mt-2 text-sm leading-6 text-muted">{record.publisher}的《{record.title}》列有这条记录。名单截至/观察时间为 {record.asOf ?? "暂未核实"}；请对照原公告中的该行结论和备注。</p>
          <dl>
            <Fact label="机构名称" value={record.name} sourceUrl={record.sourceUrl} />
            <Fact label="办学许可证号" value={record.licenseNo} sourceUrl={record.sourceUrl} />
            <Fact label="所属地区" value={record.city + (record.county ? " · " + record.county : "")} sourceUrl={record.sourceUrl} />
            <Fact label="名单记载地址" value={record.address} sourceUrl={record.sourceUrl} />
            <Fact label="原文培训类型" value={record.trainingType} sourceUrl={record.sourceUrl} />
            <Fact label="原文培训项目" value={record.projects} sourceUrl={record.sourceUrl} />
            {record.annualRating && <Fact label="年检结论" value={record.annualRating + "（历史年度结论，非当前许可状态）"} sourceUrl={record.sourceUrl} />}
          </dl>
          <p className="mt-4 text-xs leading-5 text-subtle">地址不自动认定为独立校区；培训项目不等于当前招生课程或价格。无值字段不作推测。</p>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            {record.sourceKind === "annual_check"
              ? record.annualRating
                ? "本页年检结论仅对应公告所载年度；单条备注尚未完整结构化，不能据此推断当前许可状态。请打开原文核对该行。"
                : "本站暂未取得该行年检结论；被公示不代表年检合格。请打开原文查看该行结论与备注。"
              : record.sourceKind === "after_school_reference"
                ? "这份名单仅供校内课后服务遴选参考，不能当作通用持证白名单或当前办学状态证明。"
                : record.sourceKind === "single_license_notice"
                  ? "单家许可公告记录当时的审批事实；本页未核验当前有效期、年检结果或校区归属。"
                : "部分白名单原文可能有单条备注或营业限制，本页尚未结构化提取；请打开原文核对。"}
          </p>
        </div>
        <aside className="rounded-xl border border-line bg-white p-5 lg:self-start">
          <h2 className="font-semibold text-ink">来源与时间</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div><dt className="text-subtle">来源类别</dt><dd className="mt-0.5 text-ink">{sourceKindLabel(record.sourceKind)}</dd></div>
            <div><dt className="text-subtle">发布单位</dt><dd className="mt-0.5 text-ink">{record.publisher}</dd></div>
            <div><dt className="text-subtle">原文标题</dt><dd className="mt-0.5 text-ink">{record.title}</dd></div>
            <div><dt className="text-subtle">名单截至/观察时间</dt><dd className="mt-0.5 text-ink">{record.asOf ?? "暂未核实"}</dd></div>
            <div><dt className="text-subtle">公告发布日期</dt><dd className="mt-0.5 text-ink">{record.publishedAt ?? "未核实"}</dd></div>
            <div><dt className="text-subtle">本站采集时间</dt><dd className="mt-0.5 text-ink">{record.collectedAt ? record.collectedAt.slice(0, 10) : "未记录"}</dd></div>
          </dl>
          <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">打开主管部门原文</a>
          <p className="mt-3 text-xs leading-5 text-subtle">来源日期可能是公告发布时间、名单截至日或年检年度，具体以原文为准。</p>
        </aside>
      </section>
      {related.length > 0 && <section>
        <SectionTitle aside="仅表示同一公告，不代表同一机构">同一公告中的其他记录</SectionTitle>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {related.map((item) => <li key={item.id}><Link href={"/gd/org/" + encodeURIComponent(item.id)} className="block rounded-lg border border-line bg-white p-3 text-sm text-brand hover:border-brand hover:underline">{item.name}</Link></li>)}
        </ul>
      </section>}
      <nav aria-label="继续核对" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link href={"/gd/" + record.citySlug} className="text-brand hover:underline">返回{record.city}来源记录</Link>
        <Link href={"/gd/license#source-" + record.sourceKey} className="text-brand hover:underline">查看这份公告的来源说明</Link>
        <Link href="/gd/methodology" className="text-brand hover:underline">了解名单字段与资质怎么核对</Link>
      </nav>
      <PageFootnote correctionHref={null}>本站未关联此记录与第三方工商登记主体，也没有推定校区、课程、联系人或现时许可状态。若发现原公告与本页有差异，请以原公告为准。</PageFootnote>
    </Container>
  </>;
}
