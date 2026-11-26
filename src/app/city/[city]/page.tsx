import Loading from "@/app/loading";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrgTile } from "@/components/OrgCard";
import { Container, HeroSearch, HeroStats, PageHero, SectionTitle } from "@/components/ui";
import { categoryGroups, cities, cityOrgCounts, getCity, orgsIn } from "@/lib/data";
import { site } from "@/lib/site";

export function generateStaticParams() {
  return cities.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/city/[city]">): Promise<Metadata> {
  const city = getCity((await params).city);
  if (!city) notFound();
  const title = `${city.name}培训机构大全：按类别查找、比较`;
  const description = `教培网收录的${city.name}培训机构，按语言留学、财会金融、IT 与设计、职业技能等类别查找，标注核验状态和更新日期。`;
  return { title, description, ...(orgsIn(city.slug).length ? {} : { robots: { index: false, follow: true } }), alternates: { canonical: `/city/${city.slug}` }, openGraph: { title, description, url: `/city/${city.slug}` } };
}

export default function CityPage(props: PageProps<"/city/[city]">) {
  return <Suspense fallback={<Loading />}><CityPageContent {...props} /></Suspense>;
}

async function CityPageContent({ params }: PageProps<"/city/[city]">) {
  const city = getCity((await params).city);
  if (!city) notFound();
  const list = orgsIn(city.slug);
  const total = cityOrgCounts[city.slug];
  const counts = new Map<string, number>();
  list.forEach((o) => o.categories.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1)));

  const unit = (u: string) => <span className="ml-1 text-sm font-normal text-subtle">{u}</span>;
  return (
    <>
      <PageHero
        crumbs={[{ name: city.name }]}
        eyebrow="找机构 · 核验状态逐条标注"
        icon="building"
        title={`${city.name}培训机构`}
        description={
          total ? (
            <>
              截至 {site.asOf}，教培网收录{city.name}培训机构 <strong className="text-ink">{total.toLocaleString("en-US")} 家</strong>
              ，覆盖 {categoryGroups.length} 个常用大类。选择下方类别可查看该类别的机构数、学费中位数和榜单。
            </>
          ) : (
            <>教培网正在收录{city.name}的培训机构，基础信息来自官方登记，机构认领后补充课程与价格。</>
          )
        }
        aside={
          total ? (
            <HeroStats
              items={[
                { label: "收录机构", value: <>{total.toLocaleString("en-US")}{unit("家")}</> },
                { label: "常用大类", value: <>{categoryGroups.length}{unit("个")}</> },
                { label: "细分方向", value: <>{categoryGroups.reduce((n, g) => n + g.subs.length, 0)}{unit("个")}</> },
                { label: "数据截至", value: <span className="text-lg">{site.asOf}</span> },
              ]}
            />
          ) : undefined
        }
      >
        <HeroSearch placeholder={`搜索${city.name}的机构名称或类别，例如：雅思`} type="org" />
      </PageHero>

      <Container className="pt-6 md:pt-7">
      <section>
        <SectionTitle aside="括号内为原型示例机构数">按类别查找</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categoryGroups.map((g) => {
            const n = g.subs.reduce((sum, s) => sum + (counts.get(s.slug) ?? 0), 0);
            return (
              <section key={g.slug} id={g.slug} className="min-w-0 scroll-mt-28 rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition hover:border-brand-tint hover:shadow-[0_10px_30px_rgb(30_79_216/0.08)]">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-soft to-brand-tint text-base font-semibold text-brand">{g.icon}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-ink">{g.name}</h3>
                    <p className="truncate text-xs text-subtle">{g.blurb}</p>
                  </div>
                  {n > 0 && <span className="shrink-0 rounded-full bg-page px-2 py-0.5 text-xs text-subtle tabular">{n} 家示例</span>}
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5 text-sm">
                  {g.subs.map((s) => (
                    <Link
                      key={s.slug}
                      href={`/city/${city.slug}/${s.slug}`}
                      className={counts.get(s.slug) ? "rounded-lg bg-brand-soft/70 px-2.5 py-1 text-brand hover:bg-brand-soft" : "rounded-lg bg-page px-2.5 py-1 text-ink-2 hover:bg-brand-soft hover:text-brand"}
                    >
                      {s.name}
                      {counts.get(s.slug) ? <span className="ml-1 text-xs opacity-70">({counts.get(s.slug)})</span> : null}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      {list.length > 0 && (
        <section className="mt-8">
          <SectionTitle aside="原型示例数据；正式环境分页显示全部机构">{city.name}已收录机构（示例）</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {list.map((o) => (
              <OrgTile key={o.id} org={o} ad={o.promoted} />
            ))}
          </div>
        </section>
      )}
      </Container>
    </>
  );
}
