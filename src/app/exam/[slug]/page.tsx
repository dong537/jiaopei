import Loading from "@/app/loading";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { AnswerBox, Breadcrumbs, ButtonLink, Card, Container, FaqList, SectionTitle } from "@/components/ui";
import { exams, getExam } from "@/lib/content";
import { cities, marketStats } from "@/lib/data";
import { absoluteUrl, site } from "@/lib/site";

export function generateStaticParams() {
  return exams.map((e) => ({ slug: e.slug }));
}

async function load(params: PageProps<"/exam/[slug]">["params"]) {
  const exam = getExam((await params).slug);
  if (!exam) notFound();
  return exam;
}

export async function generateMetadata({ params }: PageProps<"/exam/[slug]">): Promise<Metadata> {
  const e = await load(params);
  const url = `/exam/${e.slug}`;
  return {
    title: e.title,
    description: e.definition,
    alternates: { canonical: url },
    openGraph: { title: e.title, description: e.definition, url, type: "article", modifiedTime: e.updated },
  };
}

const toc = [
  ["steps", "报名流程"],
  ["scoring", "分数怎么算"],
  ["changes", "近期变化"],
  ["prep", "备考周期参考"],
];

export default function ExamPage(props: PageProps<"/exam/[slug]">) {
  return <Suspense fallback={<Loading />}><ExamPageContent {...props} /></Suspense>;
}

async function ExamPageContent({ params }: PageProps<"/exam/[slug]">) {
  const e = await load(params);
  const cityLinks = cities.slice(0, 4).map((c) => ({ ...c, count: marketStats[`${c.slug}/${e.categorySlug}`]?.orgCount }));

  return (
    <Container>
      <Breadcrumbs items={[{ name: "考试与证书" }, { name: e.groupName }, { name: e.name.replace(/（.*）/, "") }]} />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <article className="min-w-0 space-y-5">
          <header>
            <h1 className="text-2xl font-bold leading-snug text-ink md:text-3xl">{e.title}</h1>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-subtle">
              <span>编辑：{e.editor}</span>
              <span>审校：{e.reviewer}</span>
              <span>
                首次发布 <time dateTime={e.published}>{e.published}</time>
              </span>
              <span>
                最后更新 <time dateTime={e.updated}>{e.updated}</time>
              </span>
            </p>
          </header>

          <AnswerBox title="一句话说明">{e.definition}</AnswerBox>

          <Card>
            <SectionTitle>关键信息</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-subtle">
                    <th className="w-32 py-2 font-normal">项目</th>
                    <th className="py-2 font-normal">内容</th>
                    <th className="py-2 font-normal">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {e.facts.map((f) => (
                    <tr key={f.label} className="border-b border-line-soft last:border-0">
                      <th className="py-2.5 text-left font-normal text-subtle">{f.label}</th>
                      <td className="py-2.5 text-ink">{f.value}</td>
                      <td className="py-2.5 text-xs text-subtle">{f.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card id="steps" className="scroll-mt-28">
            <SectionTitle>报名流程</SectionTitle>
            <ol className="space-y-3">
              {e.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-ink-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">{i + 1}</span>
                  <span className="leading-6">{s}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card id="scoring" className="scroll-mt-28">
            <SectionTitle>分数怎么算</SectionTitle>
            <p className="mb-3 leading-7 text-ink-2">{e.scoring}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-subtle">
                  <th className="py-2 font-normal">总分</th>
                  <th className="py-2 font-normal">水平</th>
                  <th className="py-2 font-normal">常见用途</th>
                </tr>
              </thead>
              <tbody>
                {e.bands.map((b) => (
                  <tr key={b.score} className="border-b border-line-soft last:border-0">
                    <td className="py-2.5 font-medium text-ink tabular">{b.score}</td>
                    <td className="py-2.5 text-ink-2">{b.level}</td>
                    <td className="py-2.5 text-muted">{b.usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card id="changes" className="scroll-mt-28">
            <SectionTitle>近期变化</SectionTitle>
            <ul className="space-y-2">
              {e.changes.map((c) => (
                <li key={c.date} className="flex gap-4 text-sm">
                  <span className="w-16 shrink-0 font-medium text-ink tabular">{c.date}</span>
                  <span className="text-muted">{c.text}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card id="prep" className="scroll-mt-28">
            <SectionTitle>备考周期参考</SectionTitle>
            <p className="mb-3 text-sm text-muted">来自教培网 [N] 名已报读学员的反馈数据（2025-07 至 2026-09），仅供参考。</p>
            <table className="w-full text-sm tabular">
              <thead>
                <tr className="border-b border-line text-left text-xs text-subtle">
                  <th className="py-2 font-normal">起点 → 目标</th>
                  <th className="py-2 text-right font-normal">平均备考周（周）</th>
                  <th className="py-2 text-right font-normal">平均培训花费（元）</th>
                </tr>
              </thead>
              <tbody>
                {e.prep.map((p) => (
                  <tr key={p.from} className="border-b border-line-soft last:border-0">
                    <td className="py-2.5 text-ink">{p.from}</td>
                    <td className="py-2.5 text-right text-ink-2">{p.weeks}</td>
                    <td className="py-2.5 text-right text-ink-2">{p.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <SectionTitle>在你的城市找{e.name.replace(/（.*）/, "")}培训</SectionTitle>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {cityLinks.map((c) => (
                <li key={c.slug}>
                  <Link href={`/city/${c.slug}/${e.categorySlug}`} className="block rounded-lg border border-line p-3 hover:border-brand">
                    <div className="font-medium text-ink">{c.name}</div>
                    <div className="text-xs text-subtle">{c.count ? `${c.count} 家机构` : "[N] 家机构"}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionTitle>常见问题</SectionTitle>
            <FaqList items={e.faqs} />
          </Card>

          <Card>
            <SectionTitle>参考来源</SectionTitle>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
              {e.references.map((r) => (
                <li key={r.title}>
                  {r.title} <span className="text-subtle">（访问于 {r.accessed}）</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-line pt-3 text-xs text-subtle">
              更正记录：{e.corrections}
              <Link href="/about/methodology#corrections" className="ml-1 text-brand hover:underline">
                提交更正
              </Link>
            </p>
          </Card>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-[112px] lg:self-start">
          <Card className="p-4!">
            <div className="mb-2 text-sm font-semibold text-ink">本页目录</div>
            <ul className="space-y-1.5 text-sm">
              {toc.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-ink-2 hover:text-brand">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4!">
            <div className="mb-2 text-sm font-semibold text-ink">近期考试日期（广州考点）</div>
            <ul className="space-y-2 text-sm">
              {e.dates.map((d) => (
                <li key={d.date} className="flex justify-between">
                  <span className="text-ink-2 tabular">{d.date}</span>
                  <span className={d.tight ? "text-cta-dark" : "text-verified"}>{d.status}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-subtle">报名请前往官方网站，教培网不代办报名。</p>
          </Card>
          <Card className="p-4!">
            <div className="text-sm font-semibold text-ink">需要备考辅导？</div>
            <p className="mb-3 mt-1 text-sm text-muted">按城市、价格和核验状态比较{e.name.replace(/（.*）/, "")}培训机构。</p>
            <ButtonLink href={`/city/guangzhou/${e.categorySlug}`} variant="primary" className="w-full">
              比较培训机构
            </ButtonLink>
          </Card>
        </aside>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: e.title,
          url: absoluteUrl(`/exam/${e.slug}`),
          datePublished: e.published,
          dateModified: e.updated,
          inLanguage: "zh-CN",
          author: { "@type": "Person", name: e.editor },
          publisher: { "@id": `${site.url}/#organization` },
          citation: e.references.map((r) => r.title),
          about: {
            "@type": "EducationalOccupationalCredential",
            name: e.name,
            description: e.definition,
            credentialCategory: "语言能力证书",
            recognizedBy: { "@type": "Organization", name: "英国文化教育协会、IDP、剑桥大学英语考评部" },
          },
        }}
      />
    </Container>
  );
}
