import Link from "next/link";
import { coursesOf, fmtPrice, getCategory } from "@/lib/data";
import type { Org } from "@/lib/types";
import { CompareButton } from "./compare";
import { AdLabel, ButtonLink, Icon, PhotoBox, Tag, VerificationBadge } from "./ui";

/** 评分展示规则：已报读评价不足 30 条时不显示分数，避免少量评价误导 */
export function ratingText(org: Org) {
  if (!org.rating) return "暂无评价";
  if (org.rating.count < 30) return "评价不足 30 条，暂不显示评分";
  return `${org.rating.avg.toFixed(1)} 分 · ${org.rating.count} 条已报读评价`;
}

export function priceFromText(org: Org) {
  if (!org.priceFrom) return org.priceText;
  return org.priceText.includes("课时") ? org.priceText : `${fmtPrice(org.priceFrom)} 起`;
}

/** 首页、城市页使用的图片卡片 */
export function OrgTile({ org, ad }: { org: Org; ad?: boolean }) {
  const showScore = org.rating && org.rating.count >= 30;
  return (
    <Link href={`/org/${org.id}`} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition hover:-translate-y-0.5 hover:border-brand-tint hover:shadow-[0_14px_36px_rgb(30_79_216/0.10)]">
      <div className="relative">
        <PhotoBox photo={org.photo} className="aspect-[16/10]" sizes="(max-width: 768px) 50vw, 280px" />
        {ad && (
          <span className="absolute right-2 top-2">
            <AdLabel />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div>
          <VerificationBadge status={org.verification} />
        </div>
        <div className="font-semibold text-ink group-hover:text-brand">{org.name}</div>
        <div className="line-clamp-2 text-xs leading-5 text-subtle">
          {org.district}
          {org.area} {org.distanceKm !== undefined && `· ${org.distanceKm} km `}· {org.focus}
        </div>
        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 pt-1 text-sm">
          <span className="text-ink-2">
            {showScore ? (
              <>
                <span className="font-semibold text-amber-600">{org.rating!.avg.toFixed(1)}</span>
                <span className="ml-1 text-xs text-subtle">{org.rating!.count} 条评价</span>
              </>
            ) : (
              <span className="text-xs text-subtle">{org.rating ? "评价不足 30 条" : "暂无评价"}</span>
            )}
          </span>
          <span className="font-semibold text-cta tabular">{priceFromText(org)}</span>
        </div>
      </div>
    </Link>
  );
}

/** 城市×类别列表里的横向卡片 */
export function OrgListItem({
  org,
  categorySlug,
  ad,
  badges = [],
}: {
  org: Org;
  categorySlug: string;
  ad?: boolean;
  badges?: string[];
}) {
  const catName = getCategory(categorySlug)?.category.name ?? "";
  const list = coursesOf(org.id).filter((c) => c.categorySlug === categorySlug);
  const classKinds = [...new Set(list.map((c) => ({ small: "小班", one: "一对一", large: "大班", online: "线上" })[c.classType]))];
  const unclaimed = org.verification === "unclaimed";
  return (
    <article className="flex flex-wrap gap-3 rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:flex-nowrap sm:gap-5">
      <Link href={`/org/${org.id}`} className="relative shrink-0">
        <PhotoBox photo={org.photo} className="size-24 rounded-xl sm:h-[132px] sm:w-[200px]" sizes="200px" />
        {ad && (
          <span className="absolute right-2 top-2">
            <AdLabel />
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge status={org.verification} />
          {badges.map((b) => (
            <span key={b} className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
              <Icon name="trophy" className="size-3" />
              {b}
            </span>
          ))}
        </div>
        <h3 className="mt-1.5 text-lg font-semibold text-ink">
          <Link href={`/org/${org.id}`} className="hover:text-brand">
            {org.name}
          </Link>
        </h3>
        <div className="mt-1 text-sm text-muted">
          {unclaimed
            ? `${org.district}${org.area} · ${org.focus}`
            : `${org.district}${org.area} · ${org.campusCount} 个校区 · 成立于 ${org.founded.slice(0, 4)} 年`}
        </div>
        <div className="mt-1 text-sm text-ink-2">
          {unclaimed || !list.length
            ? "课程信息待机构完善"
            : `${catName}课程 ${list.length} 门${classKinds.length ? ` · ${classKinds.join(" / ")}` : ""}`}
        </div>
        {org.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {org.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-subtle">
          <span>{unclaimed ? `登记信息核对于 ${org.updatedAt}` : `信息更新于 ${org.updatedAt}`}</span>
          {!unclaimed && <CompareButton id={org.id} />}
        </div>
      </div>
      <div className="flex w-full shrink-0 flex-row items-end justify-between gap-2 border-t border-line-soft pt-3 sm:w-48 sm:flex-col sm:border-0 sm:pt-0">
        <div className="sm:text-right">
          <div className={org.priceFrom ? "text-lg font-semibold text-cta tabular" : "text-base text-subtle"}>{org.priceText}</div>
          <div className="text-xs text-subtle">{ratingText(org)}</div>
        </div>
        {unclaimed ? (
          <Link href={`/join/apply?claim=${org.id}`} className="text-sm text-brand hover:underline">
            我是该机构，申请认领
          </Link>
        ) : (
          <ButtonLink href={`/org/${org.id}#booking`} className="h-9">
            预约试听
          </ButtonLink>
        )}
      </div>
    </article>
  );
}
