import Link from "next/link";
import { fmtPrice, getCategory, getOrg } from "@/lib/data";
import { site } from "@/lib/site";
import type { Course } from "@/lib/types";
import { Icon, PhotoBox, Stars, VerificationBadge } from "./ui";

export const classTypeNames = { small: "小班", one: "一对一", large: "大班", online: "线上" } as const;

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** 距统计日的天数；“随报随学”等非日期返回 undefined */
export const daysUntilStart = (c: Course) => (isDate(c.nextStart) ? Math.round((Date.parse(c.nextStart) - Date.parse(site.asOf)) / 864e5) : undefined);

export const hourlyOf = (c: Course) => Math.round(c.price / c.hours);

function startText(s: string) {
  return isDate(s) ? `${Number(s.slice(5, 7))} 月 ${Number(s.slice(8))} 日` : s;
}

/** 课程卡片：顶部是课程封面 / 试听视频位（没有封面时用机构底色生成），正文给出课时、开班、每课时价格三项可比数据 */
export function CourseCard({ course }: { course: Course }) {
  const org = getOrg(course.orgId);
  const cat = getCategory(course.categorySlug)?.category;
  const days = daysUntilStart(course);
  const urgent = course.sessions?.find((s) => s.urgent);
  const soon = days !== undefined && days >= 0 && days <= 14;
  const facts = [
    { label: "总课时", value: `${course.hours}`, unit: "课时" },
    { label: isDate(course.nextStart) ? "最近开班" : "开班", value: startText(course.nextStart), unit: "" },
    { label: "每课时", value: `¥${hourlyOf(course)}`, unit: "" },
  ];
  return (
    <Link
      href={`/course/${course.id}`}
      className="group flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition hover:-translate-y-0.5 hover:border-brand-tint hover:shadow-[0_14px_36px_rgb(30_79_216/0.10)]"
    >
      <div className="relative">
        <PhotoBox
          photo={course.cover ?? { label: "课程封面", tone: org?.photo.tone ?? "#dce6f5" }}
          glyph={cat?.name}
          video={course.trialVideo && { badge: "免费试听", duration: course.trialVideo.duration }}
          className="aspect-[2/1]"
          sizes="(max-width: 768px) 100vw, 420px"
        />
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-white/95 px-2 py-0.5 text-xs font-medium text-brand shadow-sm">{cat?.name}</span>
          <span className="rounded-md bg-white/80 px-2 py-0.5 text-xs text-ink-2 backdrop-blur">{course.classLabel}</span>
        </div>
        {urgent ? (
          <span className="absolute right-3 top-3 rounded-md bg-cta px-2 py-0.5 text-xs font-medium text-white shadow-sm">{urgent.left}</span>
        ) : (
          soon && <span className="absolute right-3 top-3 rounded-md bg-white/95 px-2 py-0.5 text-xs font-medium text-cta shadow-sm">近期开班</span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <h3 className="text-[17px] font-semibold leading-snug text-ink group-hover:text-brand">{course.name}</h3>
        {org && (
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium text-ink-2">{org.name}</span>
            <VerificationBadge status={org.verification} />
            <span className="text-xs text-subtle">
              <Icon name="pin" className="mr-0.5 inline size-3 align-[-1px]" />
              {org.district}
            </span>
          </div>
        )}

        <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-xl bg-page py-2.5 text-center">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0 px-1">
              <dt className="text-[11px] text-subtle">{f.label}</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-ink tabular">
                {f.value}
                {f.unit && <span className="ml-0.5 text-xs font-normal text-subtle">{f.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div className="min-w-0">
            <div className="text-[22px] font-bold leading-none text-cta tabular">{fmtPrice(course.price)}</div>
            <div className="mt-1.5 truncate text-xs text-subtle">
              {course.dealPrice ? (
                `近 90 天成交 ${fmtPrice(course.dealPrice.min)}–${course.dealPrice.max.toLocaleString("en-US")}`
              ) : course.rating ? (
                <span className="inline-flex items-center gap-1">
                  <Stars value={course.rating.avg} className="text-[11px]" /> {course.rating.avg.toFixed(1)} · {course.rating.count} 条评价
                </span>
              ) : org?.escrow ? (
                <span className="inline-flex items-center gap-1">
                  <Icon name="shield" className="size-3.5 text-verified" />
                  支持平台担保付款
                </span>
              ) : (
                "机构公开标价"
              )}
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand">
            查看课程
            <Icon name="arrow" className="size-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
