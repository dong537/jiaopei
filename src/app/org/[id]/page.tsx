import Loading from "@/app/loading";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrgContact } from "@/components/OrgActions";
import { OrgAssistant } from "@/components/OrgAssistant";
import { OrgDemoReviews } from "@/components/OrgDemoReviews";
import { OrgDemoQA, OrgVisitTracker } from "@/components/OrgExtras";
import { JsonLd } from "@/components/JsonLd";
import { LeadForm } from "@/components/LeadForm";
import { ratingText } from "@/components/OrgCard";
import { Breadcrumbs, ButtonLink, Card, Container, Icon, PhotoBox, SectionTitle, Stars, Tag, VerificationBadge } from "@/components/ui";
import { knowledgeOf } from "@/lib/ai";
import { categoryGroups, coursesOf, getCategory, getCity, getOrg, orgs } from "@/lib/data";
import { topBadges } from "@/lib/rankings";
import { absoluteUrl, site } from "@/lib/site";
import type { Org, SourcedFact } from "@/lib/types";

export function generateStaticParams() {
  return orgs.map((o) => ({ id: o.id }));
}

async function load(params: PageProps<"/org/[id]">["params"]) {
  const org = getOrg((await params).id);
  if (!org) notFound();
  return org;
}

const catNames = (org: Org) => org.categories.map((c) => getCategory(c)?.category.name ?? c);

/** 机构概况：只用已核验或平台统计字段拼出，不使用机构自述 */
function overview(org: Org) {
  const city = getCity(org.citySlug)?.name ?? "";
  const cs = coursesOf(org.id);
  const parts = [
    `${org.name}是一家位于${city}市${org.district}的培训机构，${org.founded.slice(0, 4)} 年成立`,
    org.campusCount > 1 ? `设有 ${org.campusCount} 个校区` : "",
    `主要开设${catNames(org).join("、")}课程。`,
  ].filter(Boolean);
  let s = parts.join("，");
  if (cs.length) s += `教培网收录其课程 ${cs.length} 门，学费 ${org.priceText.replace("¥", "")} 元`;
  if (org.rating && org.rating.count >= 30) s += `；已报读学员评分 ${org.rating.avg.toFixed(1)}（${org.rating.count} 条）`;
  return cs.length ? s + "。" : s;
}

/** 未认领机构只展示官方登记字段 */
function basicInfo(org: Org): SourcedFact[] {
  if (org.info) return org.info;
  const gov = "国家企业信用信息公示系统";
  return [
    { label: "主体名称", value: org.legalName, source: gov, checkedAt: org.updatedAt },
    { label: "成立日期", value: org.founded, source: gov, checkedAt: org.updatedAt },
    { label: "经营状态", value: "存续（在营）", source: gov, checkedAt: org.updatedAt },
    { label: "培训类别", value: catNames(org).join("、"), source: org.verification === "unclaimed" ? "根据经营范围整理" : "机构填写 · 平台审核" },
  ];
}

export async function generateMetadata({ params }: PageProps<"/org/[id]">): Promise<Metadata> {
  const org = await load(params);
  const city = getCity(org.citySlug)?.name ?? "";
  const title = `${org.name}：资质、课程价格、校区与评价`;
  const description = overview(org).slice(0, 150);
  const url = `/org/${org.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${org.name}（${city}）`, description, url },
    // 未认领机构页只有登记信息，暂不建议索引
    robots: org.verification === "unclaimed" ? { index: false, follow: true } : undefined,
  };
}

export default function OrgPage(props: PageProps<"/org/[id]">) {
  return <Suspense fallback={<Loading />}><OrgPageContent {...props} /></Suspense>;
}

async function OrgPageContent({ params }: PageProps<"/org/[id]">) {
  const org = await load(params);
  const city = getCity(org.citySlug)!;
  const group = categoryGroups.find((g) => g.slug === org.groupSlug)!;
  const cs = coursesOf(org.id);
  const badges = org.verification === "verified" ? topBadges(org, org.categories[0]) : [];
  const unclaimed = org.verification === "unclaimed";
  const showScore = org.rating && org.rating.count >= 30;
  const info = basicInfo(org);
  const histTotal = org.ratingHistogram?.reduce((a, b) => a + b, 0) ?? 0;

  const tabs = [
    { id: "overview", label: "概览" },
    { id: "info", label: "基本信息" },
    ...(cs.length ? [{ id: "courses", label: `课程与价格（${cs.length}）` }] : []),
    ...(org.campuses ? [{ id: "campuses", label: `校区（${org.campuses.length}）` }] : []),
    ...(org.teachers ? [{ id: "teachers", label: "教师" }] : []),
    ...(org.rating ? [{ id: "reviews", label: `评价（${org.rating.count}）` }] : []),
    ...(org.qa ? [{ id: "qa", label: "问答" }] : []),
  ];

  return (
    <Container>
      <Breadcrumbs
        items={[
          { name: city.name, href: `/city/${city.slug}` },
          { name: group.name, href: `/city/${city.slug}/${org.categories[0]}` },
          { name: org.name },
        ]}
      />

      {/* 机构头部 */}
      <Card className="flex flex-col gap-5 md:flex-row">
        <div className="hidden size-24 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-3xl font-bold text-brand md:flex">
          {org.name.replace(city.name, "").slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <VerificationBadge status={org.verification} until={org.verifiedUntil} />
            {org.escrow && <Tag tone="brand">支持平台担保付款</Tag>}
            {badges.slice(0, 2).map((b) => (
              <Link key={b.key} href={`/rankings/${city.slug}/${org.categories[0]}#${b.key}`} className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:underline">
                <Icon name="trophy" className="size-3" />
                {b.label}
              </Link>
            ))}
          </div>
          <h1 className="mt-2 text-2xl font-bold text-ink md:text-[28px]">{org.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {org.district} · {org.campusCount} 个校区 · {catNames(org).join(" / ")} · 成立于 {org.founded.slice(0, 4)} 年
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            {showScore && <Stars value={org.rating!.avg} />}
            {ratingText(org)}
            {org.inquiries30d ? ` · 近 30 天 ${org.inquiries30d} 人咨询` : ""}
          </p>
          <p className="mt-1 text-xs text-subtle">
            信息最后更新：{org.updatedAt}
            {org.verifiedAt && ` · 资质核验：${org.verifiedAt}`}
          </p>
          {org.verification === "claimed" && (
            <p className="mt-2 rounded-lg bg-claimed-bg/60 px-3 py-2 text-xs leading-5 text-claimed">
              机构已认领、资质审核中：可以预约咨询，暂不支持在线报名和平台担保付款，也暂无平台成交评价。
            </p>
          )}
        </div>
        {!unclaimed ? (
          <div className="flex shrink-0 flex-col gap-2 md:w-56">
            <ButtonLink href="#booking">预约试听</ButtonLink>
            <OrgContact id={org.id} extension={String(2300 + orgs.indexOf(org))} />
            <p className="text-[11px] text-subtle">电话为平台虚拟号，通话可回溯</p>
          </div>
        ) : (
          <div className="flex shrink-0 flex-col gap-2 md:w-56">
            <ButtonLink href={`/join/apply?claim=${org.id}`} variant="primary">
              我是该机构，申请认领
            </ButtonLink>
            <p className="text-xs leading-5 text-subtle">本页只展示官方登记信息。机构认领并通过核验后，才会显示课程、价格和评价。</p>
          </div>
        )}
      </Card>

      {/* 页内导航 */}
      <nav aria-label="页内导航" className="sticky top-14 z-20 -mx-4 mt-4 overflow-x-auto border-b border-line bg-page/95 px-4 backdrop-blur md:top-[97px] md:mx-0 md:px-0">
        <ul className="flex gap-1 whitespace-nowrap text-sm">
          {tabs.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="block border-b-2 border-transparent px-3 py-2.5 text-ink-2 hover:border-brand hover:text-brand">
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <Card id="overview" className="scroll-mt-40">
            <SectionTitle>机构概况</SectionTitle>
            <p className="leading-7 text-ink">{overview(org)}</p>
            <p className="mt-2 text-xs text-subtle">本段由平台根据已核验字段自动生成</p>

            {org.album && (
              <div id="album" className="mt-5 scroll-mt-40">
                <SectionTitle as="h3" aside={`机构上传 · 平台 ${org.verifiedAt?.slice(0, 7)} 实地抽检一致`}>
                  机构相册（{org.album.length}）
                </SectionTitle>
                <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                  {org.album.map((p) => (
                    <PhotoBox key={p.label} photo={p} className="aspect-square rounded-lg" sizes="120px" />
                  ))}
                </div>
              </div>
            )}

            {org.offers && (
              <div className="mt-5">
                <SectionTitle as="h3">优惠活动</SectionTitle>
                <ul className="grid gap-2 md:grid-cols-3">
                  {org.offers.map((f) => (
                    <li key={f.title} className="flex flex-col rounded-lg border border-dashed border-cta/40 bg-orange-50/50 p-3">
                      <span className="font-semibold text-cta">{f.title}</span>
                      <span className="mt-1 flex-1 text-xs leading-5 text-muted">{f.detail}</span>
                      <span className="mt-2 flex items-center justify-between text-xs text-subtle">
                        {f.validUntil}
                        <a href="#booking" className="rounded border border-cta px-2 py-0.5 text-cta hover:bg-cta hover:text-white">
                          领取
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card id="info" className="scroll-mt-40">
            <SectionTitle>基本信息</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-subtle">
                    <th className="w-36 py-2 font-normal">项目</th>
                    <th className="py-2 font-normal">内容</th>
                    <th className="py-2 font-normal">来源 · 核对日期</th>
                  </tr>
                </thead>
                <tbody>
                  {info.map((r) => (
                    <tr key={r.label} className="border-b border-line-soft last:border-0">
                      <th className="py-2.5 text-left font-normal text-subtle">{r.label}</th>
                      <td className="py-2.5 text-ink">{r.value}</td>
                      <td className="py-2.5 text-xs text-subtle">
                        {r.source}
                        {r.checkedAt && ` · ${r.checkedAt}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {cs.length > 0 && (
            <Card id="courses" className="scroll-mt-40">
              <SectionTitle>课程与价格</SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm tabular">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-subtle">
                      <th className="py-2 font-normal">课程</th>
                      <th className="py-2 font-normal">班型</th>
                      <th className="py-2 text-right font-normal">课时</th>
                      <th className="py-2 text-right font-normal">学费（元）</th>
                      <th className="py-2 pl-4 font-normal">最近开班</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cs.map((c) => (
                      <tr key={c.id} className="border-b border-line-soft last:border-0">
                        <td className="py-2.5">
                          <Link href={`/course/${c.id}`} className="font-medium text-brand hover:underline">
                            {c.name}
                          </Link>
                        </td>
                        <td className="py-2.5 text-muted">{c.classLabel}</td>
                        <td className="py-2.5 text-right">{c.hours}</td>
                        <td className="py-2.5 text-right font-medium text-ink">{c.price.toLocaleString("en-US")}</td>
                        <td className="py-2.5 pl-4 text-muted">{c.nextStart}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {org.campuses && (
            <Card id="campuses" className="scroll-mt-40">
              <SectionTitle>校区</SectionTitle>
              <ul className="grid gap-3 md:grid-cols-2">
                {org.campuses.map((c) => (
                  <li key={c.name} className="rounded-lg border border-line p-3">
                    <div className="flex items-center gap-1.5 font-medium text-ink">
                      <Icon name="pin" className="text-brand" />
                      {c.name}
                    </div>
                    <div className="mt-1 text-sm text-muted">{c.address}</div>
                    <div className="mt-0.5 text-xs text-subtle">{c.metro}</div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {org.teachers && (
            <Card id="teachers" className="scroll-mt-40">
              <SectionTitle>教师</SectionTitle>
              <p className="mb-3 text-sm text-muted">
                机构登记教师 {org.teachersTotal} 人，其中 {org.teachersVerified} 人的资质证书已上传并经平台查验。
              </p>
              <ul className="grid gap-3 md:grid-cols-3">
                {org.teachers.map((t, i) => (
                  <li key={i} className="rounded-lg border border-line p-3">
                    <div className="font-medium text-ink">{t.name}</div>
                    <div className="mt-0.5 text-sm text-muted">{t.role}</div>
                    <div className="mt-2 inline-flex items-center gap-1 rounded bg-verified-bg px-2 py-0.5 text-xs text-verified">
                      <Icon name="check" className="size-3" />
                      {t.cert}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {org.selfIntro && (
            <section className="rounded-xl border border-selfreport/20 bg-selfreport-bg/50 p-5 md:p-6">
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <h2 className="text-xl font-semibold text-ink">机构自述</h2>
                <span className="rounded bg-selfreport-bg px-2 py-0.5 text-xs text-selfreport">由机构提供 · 平台未核实</span>
              </div>
              <p className="leading-7 text-ink-2">{org.selfIntro}</p>
            </section>
          )}

          {org.rating && (
            <Card id="reviews" className="scroll-mt-40">
              <SectionTitle aside="仅限通过平台报读的学员评价">已报读学员评价</SectionTitle>
              {showScore ? (
                <div className="grid gap-5 border-b border-line pb-5 md:grid-cols-[160px_1fr_1fr]">
                  <div>
                    <div className="text-4xl font-bold text-ink tabular">{org.rating.avg.toFixed(1)}</div>
                    <Stars value={org.rating.avg} className="mt-1" />
                    <div className="mt-1 text-xs text-subtle">{org.rating.count} 条 · 仅限平台成交学员</div>
                  </div>
                  {org.ratingHistogram && (
                    <ul className="space-y-1.5 text-xs">
                      {org.ratingHistogram.map((n, i) => (
                        <li key={i} className="grid grid-cols-[32px_1fr_28px] items-center gap-2">
                          <span className="text-subtle">{5 - i} 分</span>
                          <span className="h-2 overflow-hidden rounded-full bg-line-soft">
                            <span className="block h-full rounded-full bg-amber-500" style={{ width: `${(n / histTotal) * 100}%` }} />
                          </span>
                          <span className="text-right text-muted tabular">{n}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {org.rating.sub && (
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      {(
                        [
                          ["师资", org.rating.sub.teaching],
                          ["效果", org.rating.sub.result],
                          ["服务", org.rating.sub.service],
                          ["环境", org.rating.sub.env],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-page px-3 py-2">
                          <dt className="text-xs text-subtle">{k}</dt>
                          <dd className="font-semibold text-ink tabular">{v.toFixed(1)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted">已报读评价 {org.rating.count} 条，不足 30 条，暂不显示评分。</p>
              )}
              <OrgDemoReviews orgId={org.id} />
              {org.reviews && (
                <ul className="divide-y divide-line-soft">
                  {org.reviews.map((r) => (
                    <li key={r.user + r.date} className="py-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-ink">{r.user}</span>
                        <span className="text-subtle">{r.course}</span>
                        <span className="text-xs text-subtle">{r.date}</span>
                        <Tag tone="brand">已报读</Tag>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-ink-2">{r.text}</p>
                      <div className="mt-1 text-xs text-subtle">
                        师资 {r.scores.teaching} · 效果 {r.scores.result} · 服务 {r.scores.service} · 环境 {r.scores.env}
                        {r.photos > 0 && ` · 晒图 ${r.photos} 张`}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {org.qa && (
            <Card id="qa" className="scroll-mt-40">
              <SectionTitle>问答</SectionTitle>
              <dl className="divide-y divide-line-soft">
                {org.qa.map((q) => (
                  <div key={q.q} className="py-3">
                    <dt className="font-medium text-ink">问：{q.q}</dt>
                    <dd className="mt-1 text-sm leading-6 text-muted">答：{q.a}</dd>
                  </div>
                ))}
                <OrgDemoQA orgId={org.id} />
              </dl>
            </Card>
          )}

          <p className="text-xs leading-6 text-subtle">
            投诉与行政处罚记录：截至 {org.updatedAt} 未查询到（来源：信用中国、{city.name}市教育局公示）。信息有误？
            <Link href="/about/methodology#corrections" className="text-brand hover:underline">
              提交更正
            </Link>{" "}
            · 是该机构？
            <Link href={unclaimed ? `/join/apply?claim=${org.id}` : "/merchant"} className="text-brand hover:underline">
              {unclaimed ? "申请认领" : "进入商家中心"}
            </Link>
          </p>
        </div>

        {/* 预约表单 */}
        {!unclaimed && (
          <aside id="booking" className="scroll-mt-40 lg:sticky lg:top-[160px] lg:self-start">
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-ink">预约免费试听</h2>
              <LeadForm
                fields={[
                  { kind: "select", name: "course", label: "意向课程", options: cs.length ? cs.map((c) => c.name) : ["咨询课程"] },
                  { kind: "text", name: "name", label: "称呼", placeholder: "如：陈同学" },
                  { kind: "text", name: "phone", label: "手机号", type: "tel", placeholder: "11 位手机号" },
                ]}
                submitLabel="提交预约"
                consent="同意将手机号以虚拟号形式提供给本机构用于回电，详见《隐私政策》"
                note="只有本机构会联系你。通过平台付款的学费由持牌支付机构存管，按课时结算。"
                success={`预约已提交，${org.name}会通过平台虚拟号联系你。`}
                record={{ kind: "org", orgId: org.id, orgName: org.name }}
              />
            </Card>
          </aside>
        )}
      </div>

      <OrgVisitTracker id={org.id} name={org.name} />
      {org.aiAssistant && org.verification === "verified" && <OrgAssistant orgId={org.id} knowledge={knowledgeOf(org)} />}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          "@id": absoluteUrl(`/org/${org.id}#org`),
          name: org.name,
          legalName: org.legalName,
          url: absoluteUrl(`/org/${org.id}`),
          foundingDate: org.founded,
          address: {
            "@type": "PostalAddress",
            addressCountry: "CN",
            addressLocality: city.name,
            addressRegion: org.district,
            ...(org.campuses ? { streetAddress: org.campuses[0].address } : {}),
          },
          ...(org.campuses
            ? { location: org.campuses.map((c) => ({ "@type": "Place", name: c.name, address: c.address })) }
            : {}),
          knowsAbout: catNames(org),
          ...(showScore
            ? { aggregateRating: { "@type": "AggregateRating", ratingValue: org.rating!.avg, reviewCount: org.rating!.count, bestRating: 5 } }
            : {}),
          ...(cs.length
            ? {
                hasOfferCatalog: {
                  "@type": "OfferCatalog",
                  name: `${org.name}课程`,
                  itemListElement: cs.map((c) => ({
                    "@type": "Offer",
                    price: c.price,
                    priceCurrency: "CNY",
                    itemOffered: { "@type": "Course", name: c.name, url: absoluteUrl(`/course/${c.id}`) },
                  })),
                },
              }
            : {}),
          subjectOf: { "@type": "WebPage", url: absoluteUrl(`/org/${org.id}`), dateModified: org.updatedAt, publisher: { "@id": `${site.url}/#organization` } },
        }}
      />
      {org.qa && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: org.qa.map((q) => ({ "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: q.a } })),
          }}
        />
      )}
    </Container>
  );
}
