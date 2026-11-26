import Loading from "@/app/loading";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Container } from "@/components/ui";
import { getGuide, guides } from "@/lib/content";
import { absoluteUrl, site } from "@/lib/site";

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

async function load(params: PageProps<"/guide/[slug]">["params"]) {
  const g = getGuide((await params).slug);
  if (!g) notFound();
  return g;
}

export async function generateMetadata({ params }: PageProps<"/guide/[slug]">): Promise<Metadata> {
  const g = await load(params);
  const url = `/guide/${g.slug}`;
  const description = g.keyPoints.join(" ");
  return {
    title: g.title,
    description,
    alternates: { canonical: url },
    openGraph: { title: g.title, description, url, type: "article", publishedTime: g.published, modifiedTime: g.updated },
  };
}

const H2 = ({ id, children }: { id: string; children: ReactNode }) => (
  <h2 id={id} className="mt-10 scroll-mt-28 text-xl font-semibold text-ink">
    {children}
  </h2>
);

export default function GuidePage(props: PageProps<"/guide/[slug]">) {
  return <Suspense fallback={<Loading />}><GuidePageContent {...props} /></Suspense>;
}

async function GuidePageContent({ params }: PageProps<"/guide/[slug]">) {
  const g = await load(params);
  return (
    <div className="bg-white">
      <Container>
        <Breadcrumbs items={[{ name: g.section }, { name: g.topic }]} />
        <div className="reading-layout">
        <article className="max-w-[900px] pb-6 text-[16px] leading-8 text-ink-2">
          <div className="text-sm font-medium text-brand">
            {g.section} · {g.topic}
          </div>
          <h1 className="mt-2 text-2xl font-bold leading-snug text-ink md:text-[32px]">{g.title}</h1>
          <div className="mt-4 flex items-center gap-3 border-b border-line pb-5 text-sm text-subtle">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand">编</span>
            <div>
              <div className="text-ink">{g.author} · 教培网编辑部</div>
              <div>
                审校：{g.reviewer} · 发布 <time dateTime={g.published}>{g.published}</time> · 更新 <time dateTime={g.updated}>{g.updated}</time>
              </div>
            </div>
          </div>

          <section className="mt-6 rounded-xl border border-brand-tint bg-brand-soft/60 p-5">
            <h2 className="mb-2 text-base font-semibold text-brand">要点速览</h2>
            <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-7 text-ink">
              {g.keyPoints.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </section>

          <H2 id="s1">1. 营业执照与经营范围</H2>
          <p className="mt-3">
            在国家企业信用信息公示系统输入机构全称，核对三项：经营状态是否为“存续”或“在业”；经营范围是否包含你要报的培训项目；成立时间与机构宣传是否一致。
          </p>

          <H2 id="s2">2. 办学许可或备案</H2>
          <p className="mt-3">不同类型培训的主管部门不同，下表是常见对应关系。</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm leading-6">
              <thead>
                <tr className="border-b border-line bg-page text-left text-xs text-subtle">
                  <th className="p-2.5 font-normal">培训类型</th>
                  <th className="p-2.5 font-normal">主管部门</th>
                  <th className="p-2.5 font-normal">应查看</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["语言、艺术、体育、科技等非学科类", "县级以上教育部门", "办学许可证或备案公示"],
                  ["职业技能培训", "人力资源社会保障部门", "民办职业培训学校办学许可证"],
                  ["中小学学科类", "教育部门（严格审批）", "全国校外教育培训监管与服务综合平台"],
                ].map((r) => (
                  <tr key={r[0]} className="border-b border-line-soft">
                    {r.map((c, i) => (
                      <td key={i} className={i === 0 ? "p-2.5 text-ink" : "p-2.5"}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H2 id="s3">3. 收费方式</H2>
          <p className="mt-3">
            多地规定校外培训机构单次预收费不得超过 3 个月或 60 课时，并要求预收资金进入监管账户。一次性要求缴纳一年以上学费、或只接受私人账户转账的，风险较高。
          </p>
          <p className="mt-3 rounded-lg border-l-4 border-brand bg-page px-4 py-3 text-[15px]">
            提示：通过教培网付款的课程，学费由持牌支付机构存管，按课时结算给机构。
          </p>

          <H2 id="s4">4. 合同与退费条款</H2>
          <p className="mt-3">[正文：建议使用当地市场监管部门发布的培训服务合同示范文本，并逐条说明需要关注的条款。]</p>

          <H2 id="s5">5. 投诉与处罚记录</H2>
          <p className="mt-3">[正文：说明在信用中国、当地教育局网站查询的方法，并附截图示例。]</p>

          <section className="mt-10 border-t border-line pt-6">
            <h2 className="text-base font-semibold text-ink">参考来源</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6">
              {g.references.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-subtle">
              更正记录：{g.corrections}发现错误？
              <Link href="/about/methodology#corrections" className="text-brand hover:underline">
                提交更正
              </Link>
            </p>
          </section>

          <section className="mt-6 flex gap-4 rounded-xl bg-page p-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand">编</span>
            <div className="text-sm leading-6">
              <div className="font-semibold text-ink">关于作者</div>
              <p className="text-muted">
                {g.author}，{g.authorBio}
              </p>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-base font-semibold text-ink">相关阅读</h2>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                <Link href="/about/methodology#escrow" className="text-brand hover:underline">
                  培训预付费如何申请退费：流程与时限
                </Link>
              </li>
              <li>
                <Link href="/exam/ielts" className="text-brand hover:underline">
                  雅思考试：报名条件、费用、考试时间与评分
                </Link>
              </li>
              <li>
                <Link href="/city/guangzhou/yasi" className="text-brand hover:underline">
                  查看广州已核验培训机构
                </Link>
              </li>
            </ul>
          </section>
        </article>
        <aside className="reading-sidebar rounded-xl border border-line bg-page p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">本页目录</h2>
          <nav aria-label="文章目录" className="space-y-1 text-sm">
            {["营业执照与经营范围", "办学许可或备案", "收费方式", "合同与退费条款", "投诉与处罚记录"].map((title, index) => <a key={title} href={`#s${index + 1}`} className="block rounded-lg px-3 py-2.5 leading-6 text-muted hover:bg-brand-soft hover:text-brand">{title}</a>)}
          </nav>
          <div className="mt-4 border-t border-line pt-4"><p className="text-xs leading-6 text-subtle">先核对资质，再比较课程与价格。</p><Link href="/city/guangzhou" className="mt-3 inline-flex rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand-dark">查看培训机构</Link></div>
        </aside>
        </div>
      </Container>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: g.title,
          url: absoluteUrl(`/guide/${g.slug}`),
          datePublished: g.published,
          dateModified: g.updated,
          inLanguage: "zh-CN",
          author: { "@type": "Person", name: g.author, description: g.authorBio },
          publisher: { "@id": `${site.url}/#organization` },
          abstract: g.keyPoints.join(" "),
          citation: g.references,
        }}
      />
    </div>
  );
}
