import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import Loading from "@/app/loading";
import { CourseCard, classTypeNames, daysUntilStart, hourlyOf } from "@/components/CourseCard";
import { CourseFilterList } from "@/components/CourseFilterList";
import { OrgTile } from "@/components/OrgCard";
import { Container, HeroSearch, HeroStats, Icon, IconTile, PageFootnote, PageHero, type IconName } from "@/components/ui";
import { exams, guides } from "@/lib/content";
import { categoryGroups, courses, fmtPrice, getCategory, getOrg, hotSearches, orgs } from "@/lib/data";
import type { Course } from "@/lib/types";

export const metadata: Metadata = { title: "搜索", robots: { index: false, follow: true } };

function find(q: string) {
  const k = q.trim().toLowerCase();
  if (!k) return null;
  const hit = (s: string) => s.toLowerCase().includes(k);
  const cats = categoryGroups.flatMap((g) => g.subs).filter((s) => hit(s.name) || k.includes(s.name.toLowerCase()));
  return {
    cats,
    orgs: orgs.filter((o) => hit(o.name) || hit(o.focus) || o.categories.some((c) => cats.some((x) => x.slug === c))),
    courses: courses.filter((c) => hit(c.name) || cats.some((x) => x.slug === c.categorySlug)),
    exams: exams.filter((e) => hit(e.name) || hit(e.title) || cats.some((x) => x.slug === e.categorySlug)),
    guides: guides.filter((g) => hit(g.title) || g.keyPoints.some(hit)),
  };
}

/** 找课程：课程名、机构名、类别名任一包含关键词即命中 */
function courseHits(q: string) {
  const k = q.trim().toLowerCase();
  if (!k) return courses;
  return courses.filter((c) => {
    const cat = getCategory(c.categorySlug)?.category.name.toLowerCase() ?? "";
    return [c.name, getOrg(c.orgId)?.name ?? "", cat].some((s) => s.toLowerCase().includes(k)) || (!!cat && k.includes(cat));
  });
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function CoursesView({ q }: { q: string }) {
  const list = courseHits(q);
  const prices = list.map((c) => c.price);
  const count = <T extends string>(key: (c: Course) => T) => list.reduce<Record<string, number>>((m, c) => ((m[key(c)] = (m[key(c)] ?? 0) + 1), m), {});
  const byCat = count((c) => c.categorySlug);
  const byType = count((c) => c.classType);
  return (
    <>
      <PageHero
        crumbs={[{ name: "找课程" }]}
        eyebrow="课程库"
        icon="book"
        title={q ? `“${q}”相关课程` : "找课程"}
        description="按类别、班型和学费筛选可报名的课程。学费是机构公开标价，每课时价格 = 学费 ÷ 课时，方便横向比较不同机构。"
        aside={
          list.length > 0 && (
            <HeroStats
              items={[
                { label: "可报名课程", value: <>{list.length}<span className="ml-1 text-sm font-normal text-subtle">门</span></> },
                { label: "开课机构", value: <>{new Set(list.map((c) => c.orgId)).size}<span className="ml-1 text-sm font-normal text-subtle">家</span></> },
                { label: "学费区间", value: <span className="text-lg">{fmtPrice(Math.min(...prices))}–{Math.max(...prices).toLocaleString("en-US")}</span> },
                { label: "每课时中位数", value: <>¥{Math.round(median(list.map(hourlyOf)))}</> },
              ]}
            />
          )
        }
      >
        <HeroSearch q={q} type="course" placeholder="搜索课程名、机构名或类别，例如：雅思 6.5" />
        {q && (
          <Link href="/search?type=course" className="mt-3 inline-flex items-center gap-1 text-sm text-brand hover:underline">
            查看全部课程 <Icon name="arrow" className="size-3.5" />
          </Link>
        )}
      </PageHero>
      <Container className="pt-6 md:pt-7">
        {list.length ? (
          <CourseFilterList
            items={list.map((c) => ({
              id: c.id,
              node: <CourseCard course={c} />,
              category: c.categorySlug,
              classType: c.classType,
              price: c.price,
              hourly: hourlyOf(c),
              startIn: daysUntilStart(c) ?? 0,
            }))}
            categories={Object.entries(byCat).map(([slug, n]) => ({ value: slug, label: getCategory(slug)?.category.name ?? slug, count: n }))}
            classTypes={Object.entries(byType).map(([t, n]) => ({ value: t, label: classTypeNames[t as Course["classType"]], count: n }))}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-14 text-center">
            <h2 className="font-medium text-ink">没有找到相关课程</h2>
            <p className="mt-2 text-sm text-muted">换个关键词试试，例如“雅思”“托福”。</p>
          </div>
        )}
        <PageFootnote>学费与开班时间由机构提供并经平台审核，数据截至统计日。每课时价格四舍五入到元。</PageFootnote>
      </Container>
    </>
  );
}

function ResultSection({ icon, tone, title, count, children }: { icon: IconName; tone: "brand" | "orange" | "violet" | "emerald"; title: string; count?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <IconTile name={icon} tone={tone} />
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {count && <span className="text-sm text-subtle">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function SearchView({ q, type }: { q: string; type: string }) {
  const r = find(q);
  const total = r ? r.cats.length + r.orgs.length + r.courses.length + r.exams.length + r.guides.length : 0;
  return (
    <>
      <PageHero
        crumbs={[{ name: "搜索" }]}
        eyebrow="站内搜索"
        icon="search"
        title={q ? `“${q}”的搜索结果` : "搜索机构、课程和考试"}
        description={r ? `共找到 ${total} 条相关结果。` : "输入机构名称、课程或考试名称，例如“雅思”“会计”“钢琴”。"}
        aside={
          r && (
            <HeroStats
              items={[
                { label: "机构", value: r.orgs.length },
                { label: "课程", value: r.courses.length },
                { label: "考试", value: r.exams.length },
                { label: "指南", value: r.guides.length },
              ]}
            />
          )
        }
      >
        <HeroSearch q={q} type={type} placeholder="搜索机构、课程、考试" />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-subtle">热门搜索</span>
          {hotSearches.map((h) => (
            <Link key={h.label} href={h.href} className="rounded-full bg-white/80 px-3 py-1 text-ink-2 ring-1 ring-line hover:text-brand hover:ring-brand-tint">
              {h.label}
            </Link>
          ))}
        </div>
      </PageHero>

      <Container className="pt-6 md:pt-7">
        {!r ? (
          <ResultSection icon="layers" tone="brand" title="按类别浏览">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {categoryGroups.map((g) => (
                <Link key={g.slug} href={`/city/guangzhou#${g.slug}`} className="group flex items-center gap-3 rounded-xl border border-line bg-white p-3.5 hover:border-brand-tint hover:shadow-md hover:shadow-brand/5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft font-semibold text-brand">{g.icon}</span>
                  <span className="min-w-0">
                    <span className="block font-medium text-ink group-hover:text-brand">{g.name}</span>
                    <span className="block truncate text-xs text-subtle">{g.blurb}</span>
                  </span>
                </Link>
              ))}
            </div>
          </ResultSection>
        ) : total === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-14 text-center">
            <h2 className="font-medium text-ink">没有找到“{q}”的相关结果</h2>
            <p className="mt-2 text-sm text-muted">换个关键词试试，或从上方热门搜索开始。</p>
          </div>
        ) : (
          <div className="space-y-10">
            {r.cats.length > 0 && (
              <ResultSection icon="layers" tone="brand" title="相关类别">
                <div className="flex flex-wrap gap-2">
                  {r.cats.map((c) => (
                    <Link key={c.slug} href={`/city/guangzhou/${c.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-ink-2 hover:border-brand hover:text-brand">
                      广州{c.name}培训机构 <Icon name="arrow" className="size-3" />
                    </Link>
                  ))}
                </div>
              </ResultSection>
            )}
            <ResultSection icon="building" tone="brand" title="机构" count={`${r.orgs.length} 家`}>
              {r.orgs.length ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {r.orgs.map((o) => (
                    <OrgTile key={o.id} org={o} ad={o.promoted} />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-white p-4 text-sm text-muted ring-1 ring-line">没有找到相关机构。</p>
              )}
            </ResultSection>
            {r.courses.length > 0 && (
              <ResultSection icon="book" tone="orange" title="课程" count={`${r.courses.length} 门`}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {r.courses.map((c) => (
                    <div key={c.id} className="flex">
                      <CourseCard course={c} />
                    </div>
                  ))}
                </div>
              </ResultSection>
            )}
            {(r.exams.length > 0 || r.guides.length > 0) && (
              <ResultSection icon="cap" tone="violet" title="考试与指南">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ...r.exams.map((e) => ({ key: e.slug, href: `/exam/${e.slug}`, title: e.title, kind: "考试百科", icon: "cap" as const })),
                    ...r.guides.map((g) => ({ key: g.slug, href: `/guide/${g.slug}`, title: g.title, kind: "选课指南", icon: "doc" as const })),
                  ].map((it) => (
                    <Link key={it.key} href={it.href} className="group flex items-center gap-3 rounded-xl border border-line bg-white p-4 hover:border-brand-tint hover:shadow-md hover:shadow-brand/5">
                      <IconTile name={it.icon} tone={it.icon === "cap" ? "violet" : "emerald"} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-subtle">{it.kind}</span>
                        <span className="block truncate font-medium text-ink group-hover:text-brand">{it.title}</span>
                      </span>
                      <Icon name="arrow" className="size-4 text-subtle group-hover:text-brand" />
                    </Link>
                  ))}
                </div>
              </ResultSection>
            )}
          </div>
        )}
      </Container>
    </>
  );
}

async function SearchContent({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  return type === "course" ? <CoursesView q={q} /> : <SearchView q={q} type={type} />;
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense fallback={<Loading />}>
      <SearchContent searchParams={searchParams} />
    </Suspense>
  );
}
