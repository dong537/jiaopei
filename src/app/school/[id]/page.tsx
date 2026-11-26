import Loading from "@/app/loading";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Card, Container, PageFootnote, PhotoBox, SectionTitle, Tag } from "@/components/ui";
import { getCity } from "@/lib/data";
import { getSchool, schoolGlyph, schoolPhoto, schools } from "@/lib/schools";
import { absoluteUrl, site } from "@/lib/site";

export function generateStaticParams() {
  return schools.map((s) => ({ id: s.id }));
}

async function load(params: PageProps<"/school/[id]">["params"]) {
  const s = getSchool((await params).id);
  if (!s) notFound();
  return s;
}

export async function generateMetadata({ params }: PageProps<"/school/[id]">): Promise<Metadata> {
  const s = await load(params);
  return {
    title: `${s.name}：办学性质、学段与主管部门`,
    description: `${s.name}是${s.district}一所${s.nature}${s.stage}学校，主管部门${s.authority}。信息来源：${s.source}（${s.checkedAt} 核对）。`,
    alternates: { canonical: `/school/${s.id}` },
  };
}

export default function SchoolDetailPage(props: PageProps<"/school/[id]">) {
  return <Suspense fallback={<Loading />}><SchoolDetailPageContent {...props} /></Suspense>;
}

async function SchoolDetailPageContent({ params }: PageProps<"/school/[id]">) {
  const s = await load(params);
  const city = getCity(s.citySlug)!;
  const rows = [
    ["学校名称", s.name],
    ["办学性质", s.nature],
    ["学段", s.stage],
    ...(s.founded ? [["创办年份", s.founded]] : []),
    ["地址", `${city.name}${s.address}`],
    ["主管部门", s.authority],
  ];
  return (
    <Container>
      <Breadcrumbs items={[{ name: "学校库", href: "/school" }, { name: s.district }, { name: s.name }]} />
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-ink md:text-3xl">{s.name}</h1>
        <Tag tone={s.nature === "公办" ? "brand" : "plain"}>{s.nature}</Tag>
      </div>
      <p className="mt-2 leading-7 text-ink-2">
        {s.name}是{city.name}
        {s.district}的一所{s.nature}学校，学段为{s.stage}
        {s.founded ? `，${s.founded} 年创办` : ""}，主管部门为{s.authority}。
      </p>
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <SectionTitle aside={`来源：${s.source} · ${s.checkedAt} 核对`}>登记信息</SectionTitle>
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-line-soft last:border-0">
                <th className="w-32 py-2.5 text-left font-normal text-subtle">{k}</th>
                <td className="py-2.5 text-ink">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="space-y-4">
      <PhotoBox photo={schoolPhoto(s)} glyph={schoolGlyph(s)} className="aspect-[16/10] rounded-2xl" sizes="360px" />
      <Card>
        <SectionTitle>要注意的事</SectionTitle>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-7 text-ink-2">
          {s.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
          <li>教培网不对学校排名、不打分，学校不能付费修改本页信息。</li>
        </ul>
      </Card>
      </div>
      </div>
      <p className="mt-5 text-sm text-muted">
        想给孩子找课外培训？看
        <Link href="/city/guangzhou" className="mx-1 text-brand hover:underline">
          {city.name}已核验培训机构
        </Link>
        ，或先读
        <Link href="/policies" className="mx-1 text-brand hover:underline">
          校外培训政策
        </Link>
        。
      </p>
      <PageFootnote>学校信息为原型示例，正式数据以教育主管部门公示为准。</PageFootnote>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "School",
          name: s.name,
          url: absoluteUrl(`/school/${s.id}`),
          address: { "@type": "PostalAddress", addressCountry: "CN", addressLocality: city.name, addressRegion: s.district, streetAddress: s.address },
          ...(s.founded ? { foundingDate: s.founded } : {}),
          subjectOf: { "@type": "WebPage", url: absoluteUrl(`/school/${s.id}`), dateModified: s.checkedAt, publisher: { "@id": `${site.url}/#organization` } },
        }}
      />
    </Container>
  );
}
