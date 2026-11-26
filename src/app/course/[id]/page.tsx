import Loading from "@/app/loading";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnrollBox } from "@/components/EnrollBox";
import { JsonLd } from "@/components/JsonLd";
import { AnswerBox, Breadcrumbs, Card, Container, FaqList, PageFootnote, PhotoBox, SectionTitle, Stars, VerificationBadge, cx } from "@/components/ui";
import { courses, getCategory, getCity, getCourse, getOrg } from "@/lib/data";
import { absoluteUrl, site } from "@/lib/site";
import type { Course, Org } from "@/lib/types";

export function generateStaticParams() {
  return courses.map((c) => ({ id: c.id }));
}

async function load(params: PageProps<"/course/[id]">["params"]) {
  const course = getCourse((await params).id);
  if (!course) notFound();
  const org = getOrg(course.orgId)!;
  return { course, org };
}

const fmt = (n: number) => n.toLocaleString("en-US");

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 同城、同类别、同班型、已核验机构的课程，用于价格定位与对比表 */
function peers(course: Course, org: Org) {
  return courses
    .filter((c) => c.categorySlug === course.categorySlug && c.classType === course.classType)
    .map((c) => ({ c, o: getOrg(c.orgId)! }))
    .filter(({ o }) => o.citySlug === org.citySlug && o.verification === "verified");
}

function summaryOf(course: Course, org: Org) {
  if (course.summary) return course.summary;
  return `${org.name}开设的${course.name}，${course.classLabel}，共 ${course.hours} 课时，学费 ${fmt(course.price)} 元。`;
}

export async function generateMetadata({ params }: PageProps<"/course/[id]">): Promise<Metadata> {
  const { course, org } = await load(params);
  const title = `${course.name}（${org.name}）：学费、课时、开班时间`;
  const description = summaryOf(course, org);
  const url = `/course/${course.id}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
}

export default function CoursePage(props: PageProps<"/course/[id]">) {
  return <Suspense fallback={<Loading />}><CoursePageContent {...props} /></Suspense>;
}

async function CoursePageContent({ params }: PageProps<"/course/[id]">) {
  const { course, org } = await load(params);
  const city = getCity(org.citySlug)!;
  const cat = getCategory(course.categorySlug)!.category;
  const list = peers(course, org);
  const hourly = (c: Course) => c.price / c.hours;
  const medianHourly = list.length >= 3 ? median(list.map(({ c }) => hourly(c))) : undefined;
  const mine = hourly(course);
  const position =
    medianHourly === undefined
      ? undefined
      : mine > medianHourly * 1.1
        ? "高于"
        : mine < medianHourly * 0.9
          ? "低于"
          : "接近";
  const gallery = org.album?.length ? org.album : [{ label: "教室环境", tone: org.photo.tone }, { label: "上课实拍", tone: org.photo.tone }];
  const sessions = course.sessions ?? [{ date: `${course.nextStart}${/\d/.test(course.nextStart) ? " 开班" : ""}`, left: "可报名" }];
  const classTypeName = { small: "小班", one: "一对一", large: "大班", online: "线上" }[course.classType];
  const facts = [
    { label: "学费", value: `${fmt(course.price)} 元` },
    ...(course.dealPrice
      ? [
          {
            label: "真实成交价",
            value: `${fmt(course.dealPrice.min)}–${fmt(course.dealPrice.max)} 元（近 90 天 ${course.dealPrice.orders} 笔平台订单，差额来自早鸟价和推荐折扣）`,
          },
        ]
      : []),
    ...(course.facts ?? [
      { label: "课时", value: `${course.hours} 课时` },
      { label: "班型", value: course.classLabel },
      { label: "最近开班", value: course.nextStart },
    ]),
  ];

  return (
    <Container>
      <Breadcrumbs
        items={[
          { name: city.name, href: `/city/${city.slug}` },
          { name: `${cat.name}培训`, href: `/city/${city.slug}/${cat.slug}` },
          { name: org.name, href: `/org/${org.id}` },
          { name: course.name },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-ink md:text-[28px]">
              {course.name}（{city.name}
              {org.district.replace("区", "")}）
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link href={`/org/${org.id}`} className="font-medium text-brand hover:underline">
                {org.name}
              </Link>
              <VerificationBadge status={org.verification} />
              {course.rating && (
                <span className="flex items-center gap-1.5 text-ink-2">
                  <Stars value={course.rating.avg} /> {course.rating.avg.toFixed(1)} 分 · {course.rating.count} 条已报读评价
                </span>
              )}
              <span className="text-xs text-subtle">课程信息更新于 {org.updatedAt}</span>
            </div>
          </div>

          {/* 课程图片与试听视频：机构上传、平台审核；未上传时显示占位并标明位置 */}
          <section aria-label="课程图片与视频" className="grid grid-cols-3 gap-2 sm:grid-rows-2">
            <PhotoBox
              photo={course.cover ?? { label: "课程封面", tone: org.photo.tone }}
              glyph={course.trialVideo ? undefined : cat.name}
              video={course.trialVideo && { badge: `试听 · ${course.trialVideo.title}`, duration: course.trialVideo.duration }}
              className="col-span-3 aspect-video rounded-2xl sm:col-span-2 sm:row-span-2 sm:aspect-[16/9]"
              sizes="(max-width: 1024px) 100vw, 640px"
            />
            {gallery.slice(0, 2).map((p, i) => (
              <div key={p.label} className="relative hidden min-h-0 sm:block">
                <PhotoBox photo={p} className="h-full rounded-2xl" sizes="320px" />
                {i === 1 && gallery.length > 2 && (
                  <Link href={`/org/${org.id}#album`} className="absolute inset-0 flex items-center justify-center rounded-2xl bg-ink/55 text-sm font-medium text-white backdrop-blur-sm hover:bg-ink/65">
                    查看全部 {gallery.length} 张
                  </Link>
                )}
              </div>
            ))}
          </section>

          <AnswerBox title="课程摘要">
            {summaryOf(course, org)}
            {course.sessions && `下一期 ${course.nextStart} 开班。`}
            {position && medianHourly && (
              <div className="mt-2 text-sm text-muted">
                每课时 {Math.round(mine)} 元，{position}
                {city.name}已核验机构同类{cat.name}
                {classTypeName}课的中位数（{Math.round(medianHourly)} 元 / 课时，{list.length} 门课程）。
              </div>
            )}
          </AnswerBox>

          <Card>
            <SectionTitle>课程信息</SectionTitle>
            <dl className="divide-y divide-line-soft text-sm">
              {facts.map((f) => (
                <div key={f.label} className="grid grid-cols-[96px_1fr] gap-3 py-2.5 md:grid-cols-[120px_1fr]">
                  <dt className="text-subtle">{f.label}</dt>
                  <dd className={cx("text-ink", f.label === "真实成交价" && "font-medium")}>{f.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {course.schedule && (
            <Card>
              <SectionTitle>课程安排</SectionTitle>
              <ol className="relative space-y-4 border-l-2 border-brand-tint pl-5">
                {course.schedule.map((s) => (
                  <li key={s.title}>
                    <span className="absolute -left-[7px] mt-1.5 size-3 rounded-full bg-brand" aria-hidden />
                    <div className="font-medium text-ink">{s.title}</div>
                    <div className="text-sm text-muted">{s.detail}</div>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {list.length > 1 && (
            <Card>
              <SectionTitle>
                与{city.name}同类课程对比
              </SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm tabular">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-subtle">
                      <th className="py-2 font-normal">课程</th>
                      <th className="py-2 font-normal">机构</th>
                      <th className="py-2 text-right font-normal">课时</th>
                      <th className="py-2 text-right font-normal">学费（元）</th>
                      <th className="py-2 text-right font-normal">每课时（元）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...list]
                      .sort((a, b) => hourly(a.c) - hourly(b.c))
                      .map(({ c, o }) => (
                        <tr key={c.id} className={cx("border-b border-line-soft last:border-0", c.id === course.id && "bg-brand-soft")}>
                          <td className="py-2.5 pl-1">
                            {c.id === course.id ? (
                              <span className="font-medium text-ink">{c.name}（本课程）</span>
                            ) : (
                              <Link href={`/course/${c.id}`} className="text-brand hover:underline">
                                {c.name}
                              </Link>
                            )}
                          </td>
                          <td className="py-2.5 text-muted">{o.name}</td>
                          <td className="py-2.5 text-right">{c.hours}</td>
                          <td className="py-2.5 text-right">{fmt(c.price)}</td>
                          <td className="py-2.5 pr-1 text-right font-medium text-ink">{Math.round(hourly(c))}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-subtle">
                按“{cat.name} · {classTypeName} · {city.name} · 已核验机构”筛选，学费为机构公开标价，按每课时价格从低到高排列。
              </p>
            </Card>
          )}

          {course.faqs && (
            <Card>
              <SectionTitle>报名常见问题</SectionTitle>
              <FaqList items={course.faqs} />
            </Card>
          )}
        </div>

        <aside className="lg:sticky lg:top-[112px] lg:self-start">
          <EnrollBox
            courseId={course.id}
            price={course.price}
            hours={course.hours}
            sessions={sessions}
            offers={org.offers ?? []}
            today={site.asOf}
            orgHref={`/org/${org.id}`}
            escrow={!!org.escrow}
          />
        </aside>
      </div>

      <PageFootnote>价格与开班信息由机构提供并经平台审核，最后更新 {org.updatedAt}。</PageFootnote>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: course.name,
          description: summaryOf(course, org),
          url: absoluteUrl(`/course/${course.id}`),
          inLanguage: "zh-CN",
          provider: { "@type": "EducationalOrganization", name: org.name, url: absoluteUrl(`/org/${org.id}`) },
          offers: {
            "@type": "Offer",
            category: "Paid",
            price: course.price,
            priceCurrency: "CNY",
            availability: "https://schema.org/InStock",
            url: absoluteUrl(`/course/${course.id}`),
          },
          ...(course.rating
            ? { aggregateRating: { "@type": "AggregateRating", ratingValue: course.rating.avg, reviewCount: course.rating.count, bestRating: 5 } }
            : {}),
          hasCourseInstance: sessions
            .filter((s) => /^\d{4}-\d{2}-\d{2}/.test(s.date))
            .map((s) => ({
              "@type": "CourseInstance",
              courseMode: course.classType === "online" ? "Online" : "Onsite",
              startDate: s.date.slice(0, 10),
              location: org.campuses?.[0]?.address ?? `${city.name}${org.district}`,
              courseWorkload: `PT${Math.round((course.hours * 45) / 60)}H`,
            })),
        }}
      />
    </Container>
  );
}
