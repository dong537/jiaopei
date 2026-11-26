import Loading from "@/app/loading";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareTray } from "@/components/compare";
import { JsonLd } from "@/components/JsonLd";
import { OrgFilterList, type FilterItem } from "@/components/OrgFilterList";
import { OrgListItem } from "@/components/OrgCard";
import { AnswerBox, Breadcrumbs, ButtonLink, Card, Container, FaqList, PageFootnote, SectionTitle } from "@/components/ui";
import { categoryFaqs, cities, cityCategoryPairs, coursesOf, getCategory, getCity, orgsIn, orgs } from "@/lib/data";
import { exams } from "@/lib/content";
import { naturalOrder } from "@/lib/completeness";
import { marketSummary } from "@/lib/market";
import { MIN_RANKED, topBadges } from "@/lib/rankings";
import { absoluteUrl, site } from "@/lib/site";

export function generateStaticParams() {
  return cityCategoryPairs();
}

const monthLabel = `${site.asOf.slice(0, 4)} 年 ${Number(site.asOf.slice(5, 7))} 月`;

async function load(params: PageProps<"/city/[city]/[category]">["params"]) {
  const { city: citySlug, category: categorySlug } = await params;
  const city = getCity(citySlug);
  const cat = getCategory(categorySlug);
  if (!city || !cat) notFound();
  return { city, ...cat };
}

export async function generateMetadata({ params }: PageProps<"/city/[city]/[category]">): Promise<Metadata> {
  const { city, category } = await load(params);
  const m = marketSummary(city.slug, category.slug);
  const title = `${city.name}${category.name}培训机构（${monthLabel}）`;
  const description = m.orgCount
    ? `截至 ${site.asOf}，教培网收录${city.name}${category.name}培训机构 ${m.orgCount} 家，其中 ${m.verifiedCount} 家已通过平台资质核验${m.medianPrice ? `，学费中位数 ${m.medianPrice.toLocaleString("en-US")} 元` : ""}。`
    : `教培网${city.name}${category.name}培训机构信息正在收录中。`;
  const url = `/city/${city.slug}/${category.slug}`;
  return { title, description, ...(m.orgCount ? {} : { robots: { index: false, follow: true } }), alternates: { canonical: url }, openGraph: { title, description, url } };
}

export default function CityCategoryPage(props: PageProps<"/city/[city]/[category]">) {
  return <Suspense fallback={<Loading />}><CityCategoryPageContent {...props} /></Suspense>;
}

async function CityCategoryPageContent({ params }: PageProps<"/city/[city]/[category]">) {
  const { city, group, category } = await load(params);
  const m = marketSummary(city.slug, category.slug);
  const list = orgsIn(city.slug, category.slug);
  const faqs = categoryFaqs[`${city.slug}/${category.slug}`];
  const exam = exams.find((e) => e.categorySlug === category.slug);
  const otherCities = cities.filter((c) => c.slug !== city.slug).slice(0, 3);
  const sorted = [...list].sort(naturalOrder);
  const names = Object.fromEntries(orgs.map((o) => [o.id, o.name]));

  const items: FilterItem[] = sorted.map((o) => {
    const cs = coursesOf(o.id).filter((c) => c.categorySlug === category.slug);
    return {
      id: o.id,
      ad: !!o.promoted,
      node: (
        <OrgListItem
          org={o}
          categorySlug={category.slug}
          ad={o.promoted}
          badges={o.verification === "verified" ? topBadges(o, category.slug).slice(0, 1).map((b) => b.label) : []}
        />
      ),
      district: o.district,
      verification: o.verification,
      escrow: !!o.escrow,
      minPrice: o.priceFrom,
      classTypes: [...new Set(cs.map((c) => c.classType))].concat(o.tags.includes("一对一") ? ["one"] : []),
      ratingCount: o.rating?.count ?? 0,
      distance: o.distanceKm,
    };
  });
  const districts = [...new Set(list.map((o) => o.district))];
  const maxBand = Math.max(...(m.bands?.map((b) => b.courses) ?? [1]));

  return (
    <Container>
      <Breadcrumbs
        items={[
          { name: city.name, href: `/city/${city.slug}` },
          { name: group.name, href: `/city/${city.slug}#${group.slug}` },
          { name: category.name },
        ]}
      />
      <h1 className="text-2xl font-bold text-ink md:text-3xl">
        {city.name}
        {category.name}培训机构（{monthLabel}）
      </h1>

      {m.orgCount === 0 ? (
        <Card className="mt-5">
          <p className="text-muted">
            教培网暂未收录{city.name}的{category.name}培训机构。如果你是这一类别的机构，可以
            <Link href="/join" className="text-brand hover:underline">
              免费入驻
            </Link>
            。
          </p>
        </Card>
      ) : (
        <>
          <div className="mt-5">
            <AnswerBox
              source={
                <>
                  数据来源：教培网机构库、国家企业信用信息公示系统 ·{" "}
                  <Link href="/about/methodology#sources" className="text-brand hover:underline">
                    统计口径
                  </Link>
                  {!m.full && " · 本页统计仅基于当前收录样本"}
                </>
              }
            >
              截至 {site.asOf}，教培网收录{city.name}
              {category.name}培训机构 <strong>{m.orgCount} 家</strong>，其中 <strong>{m.verifiedCount} 家</strong>已通过平台资质核验
              {m.medianPrice && m.typicalRange && (
                <>
                  。{category.name}课程学费中位数为 <strong>{m.medianPrice.toLocaleString("en-US")} 元</strong>
                  {m.pricedCourses > 1 &&
                    `，多数在 ${m.typicalRange[0].toLocaleString("en-US")}–${m.typicalRange[1].toLocaleString("en-US")} 元之间`}
                </>
              )}
              {m.topDistrict && m.topDistrict.count > 1 && `；${m.topDistrict.name}机构最多（${m.topDistrict.count} 家）`}
              。
            </AnswerBox>
          </div>

          {m.districts && m.bands && (
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionTitle as="h3">各区机构与学费</SectionTitle>
                <table className="w-full text-sm tabular">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-subtle">
                      <th className="py-2 font-normal">区</th>
                      <th className="py-2 text-right font-normal">机构数（家）</th>
                      <th className="py-2 text-right font-normal">已核验（家）</th>
                      <th className="py-2 text-right font-normal">学费中位数（元）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.districts.map((d) => (
                      <tr key={d.name} className="border-b border-line-soft last:border-0">
                        <td className="py-2 text-ink">{d.name}</td>
                        <td className="py-2 text-right">{d.orgs}</td>
                        <td className="py-2 text-right">{d.verified}</td>
                        <td className="py-2 text-right">{d.median.toLocaleString("en-US")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card>
                <SectionTitle as="h3">学费分布（课程数）</SectionTitle>
                <ul className="space-y-2.5">
                  {m.bands.map((b) => (
                    <li key={b.label} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 text-sm">
                      <span className="text-muted">{b.label}</span>
                      <span className="h-3 overflow-hidden rounded-full bg-line-soft">
                        <span className="block h-full rounded-full bg-brand" style={{ width: `${(b.courses / maxBand) * 100}%` }} />
                      </span>
                      <span className="text-right text-ink tabular">{b.courses}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-subtle">统计 {m.pricedCourses} 门标注了价格的{category.name}课程；未公开价格的课程不计入。</p>
              </Card>
            </div>
          )}

          <section className="mt-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold text-ink">
                {city.name}
                {category.name}培训机构列表
              </h2>
              {m.verifiedCount >= MIN_RANKED && (
                <Link href={`/rankings/${city.slug}/${category.slug}`} className="text-sm text-brand hover:underline">
                  查看{city.name}
                  {category.name}榜单
                </Link>
              )}
            </div>
            <OrgFilterList items={items} districts={districts} total={m.orgCount} />
            {m.orgCount > list.length && (
              <p className="mt-4 text-center text-xs text-subtle">
                原型只展示 {list.length} 家示例机构，正式环境按每页 20 家分页展示全部 {m.orgCount} 家。
              </p>
            )}
          </section>
        </>
      )}

      {faqs && (
        <Card className="mt-8">
          <SectionTitle>
            关于{city.name}
            {category.name}培训的常见问题
          </SectionTitle>
          <FaqList items={faqs} />
        </Card>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card>
          <SectionTitle as="h3">相关考试</SectionTitle>
          <ul className="space-y-2 text-sm">
            {exam ? (
              <li>
                <Link href={`/exam/${exam.slug}`} className="text-brand hover:underline">
                  {exam.name}考试：报名、费用、考试时间
                </Link>
              </li>
            ) : (
              <li className="text-subtle">暂无相关考试百科</li>
            )}
          </ul>
        </Card>
        <Card>
          <SectionTitle as="h3">其他城市</SectionTitle>
          <ul className="space-y-2 text-sm">
            {otherCities.map((c) => (
              <li key={c.slug}>
                <Link href={`/city/${c.slug}/${category.slug}`} className="text-brand hover:underline">
                  {c.name}
                  {category.name}培训机构
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionTitle as="h3">选课指南</SectionTitle>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/guide/how-to-verify-training-institution" className="text-brand hover:underline">
                如何判断培训机构是否正规：5 个核对项
              </Link>
            </li>
            <li>
              <Link href="/about/methodology#escrow" className="text-brand hover:underline">
                培训预付费如何申请退费
              </Link>
            </li>
          </ul>
        </Card>
      </div>

      <div className="mt-6 flex justify-center">
        <ButtonLink href="/#advisor" variant="ghost">
          让选课顾问帮我挑 3 家
        </ButtonLink>
      </div>

      <PageFootnote>本页数据最后更新：{site.asOf} · 编辑：[姓名] · 价格为机构公开标价，单位：元。</PageFootnote>

      <CompareTray names={names} />

      {list.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "ItemList",
                name: `${city.name}${category.name}培训机构`,
                numberOfItems: m.orgCount,
                itemListElement: sorted
                  .filter((o) => !o.promoted)
                  .map((o, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/org/${o.id}`), name: o.name })),
              },
              ...(m.full
                ? [
                    {
                      "@type": "Dataset",
                      name: `${city.name}${category.name}培训市场统计（${site.asOf}）`,
                      description: `${city.name}${category.name}培训机构数、核验数、各区学费中位数与学费分布。`,
                      url: absoluteUrl(`/city/${city.slug}/${category.slug}`),
                      dateModified: site.asOf,
                      creator: { "@id": `${site.url}/#organization` },
                      isAccessibleForFree: true,
                      variableMeasured: ["机构数", "已核验机构数", "学费中位数", "课程数"],
                    },
                  ]
                : []),
            ],
          }}
        />
      )}
    </Container>
  );
}
