import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { site } from "@/lib/site";
import type { Photo, QA, Verification } from "@/lib/types";
import { JsonLd } from "./JsonLd";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("page-container mx-auto w-full px-4 md:px-6 xl:px-8", className)}>{children}</div>;
}

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx("min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] md:p-6", className)}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, aside, as = "h2" }: { children: ReactNode; aside?: ReactNode; as?: "h2" | "h3" }) {
  const H = as;
  return (
    <div className={cx("mb-4 flex flex-wrap justify-between gap-x-4 gap-y-1", as === "h2" ? "items-center" : "items-baseline")}>
      <H className={cx("font-semibold text-ink", as === "h2" ? "flex items-center gap-2.5 text-xl" : "text-base")}>
        {as === "h2" && <span aria-hidden className="h-[18px] w-1 shrink-0 rounded-full bg-brand" />}
        <span className="min-w-0">{children}</span>
      </H>
      {aside && <div className="text-sm text-subtle">{aside}</div>}
    </div>
  );
}

const badgeStyles: Record<Verification, { cls: string; label: string }> = {
  verified: { cls: "bg-verified-bg text-verified", label: "平台已核验" },
  claimed: { cls: "bg-claimed-bg text-claimed", label: "机构已认领" },
  unclaimed: { cls: "bg-line-soft text-muted", label: "官方登记信息 · 待机构认领" },
};

export function VerificationBadge({ status, until }: { status: Verification; until?: string }) {
  const s = badgeStyles[status];
  return (
    <span className={cx("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium", s.cls)}>
      {status === "verified" && <Icon name="check" className="size-3.5" />}
      {s.label}
      {status === "verified" && until && ` · 有效至 ${until.slice(0, 7)}`}
    </span>
  );
}

export function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "brand" | "ad" | "warn" }) {
  const cls = {
    plain: "bg-line-soft text-ink-2",
    brand: "bg-brand-soft text-brand",
    ad: "border border-line bg-white/90 text-subtle",
    warn: "bg-selfreport-bg text-selfreport",
  }[tone];
  return <span className={cx("inline-flex items-center rounded px-1.5 py-0.5 text-xs", cls)}>{children}</span>;
}

export function AdLabel() {
  return (
    <span className="rounded border border-line bg-white/90 px-1.5 py-0.5 text-[11px] leading-none text-subtle" title="付费展示位，不影响自然排序和榜单">
      推广
    </span>
  );
}

/**
 * 图片 / 视频位。有 src 显示图片；没有时显示带纹理的占位图，标明这里放什么。
 * glyph：占位图上的大字（如类别名），让占位图看起来像封面而不是空白；
 * video：叠加播放按钮、角标和时长；compact：小尺寸缩略图，只显示图标。
 */
export function PhotoBox({
  photo,
  className,
  sizes = "300px",
  glyph,
  video,
  compact,
}: {
  photo: Photo;
  className?: string;
  sizes?: string;
  glyph?: string;
  video?: { badge?: string; duration?: string; small?: boolean };
  compact?: boolean;
}) {
  return (
    <div className={cx("relative isolate overflow-hidden", className)} style={{ background: photo.tone }}>
      {photo.src ? (
        <Image src={photo.src} alt={photo.label} fill sizes={sizes} className="object-cover" />
      ) : (
        <div className="media-ph absolute inset-0" role="img" aria-label={photo.label}>
          {glyph && (
            <span aria-hidden className="absolute -bottom-[0.18em] right-3 select-none text-[clamp(44px,22cqw,88px)] font-black leading-none tracking-tight text-white/65 [text-shadow:0_2px_12px_rgb(15_23_42/0.06)]">
              {glyph}
            </span>
          )}
          {compact ? (
            <span className="absolute inset-0 flex items-center justify-center text-ink-2/45">
              <Icon name="building" className="size-[45%] max-h-5 max-w-5" />
            </span>
          ) : video ? null : glyph ? (
            <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] text-ink-2/80 backdrop-blur">
              <Icon name="camera" className="size-3" />
              {photo.label}
            </span>
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-xs text-ink-2/70">
              <span className="flex size-9 items-center justify-center rounded-full bg-white/70 shadow-sm backdrop-blur">
                <Icon name="camera" className="size-[18px]" />
              </span>
              {photo.label}
            </span>
          )}
        </div>
      )}
      {video && (
        <>
          <span className="absolute inset-0 flex items-center justify-center">
            <span className={cx("flex items-center justify-center rounded-full bg-white/95 text-brand shadow-[0_6px_20px_rgb(15_23_42/0.18)] ring-white/35 transition group-hover:scale-105", video.small ? "size-9 ring-2" : "size-12 ring-4")}>
              <svg viewBox="0 0 24 24" className={cx("ml-0.5", video.small ? "size-4" : "size-5")} aria-hidden>
                <path d="M8 5.2v13.6L19 12z" fill="currentColor" />
              </svg>
            </span>
          </span>
          {video.badge && <span className="absolute bottom-2.5 left-2.5 rounded-md bg-ink/65 px-1.5 py-0.5 text-[11px] text-white backdrop-blur">{video.badge}</span>}
          {video.duration && <span className="absolute bottom-2 right-2 rounded-md bg-ink/65 px-1.5 py-0.5 text-[11px] text-white tabular backdrop-blur">{video.duration}</span>}
        </>
      )}
    </div>
  );
}

export function AnswerBox({ title = "答案摘要", children, source }: { title?: string; children: ReactNode; source?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-tint border-l-4 border-l-brand bg-brand-soft/60 px-5 py-4 md:px-6">
      <div className="mb-1.5 text-sm font-semibold text-brand">{title}</div>
      <div className="leading-7 text-ink">{children}</div>
      {source && <div className="mt-2 text-xs text-subtle">{source}</div>}
    </div>
  );
}

/** 列表页页头：面包屑、标题、说明放在渐变底色里，右侧可放一组统计数字 */
export function PageHero({
  crumbs,
  breadcrumbRoot,
  eyebrow,
  icon,
  title,
  description,
  aside,
  children,
}: {
  crumbs: { name: string; href?: string }[];
  breadcrumbRoot?: { name: string; href: string };
  eyebrow?: ReactNode;
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="page-hero">
      <Container>
        <Breadcrumbs items={crumbs} root={breadcrumbRoot} />
        <div className="grid gap-6 pb-7 md:pb-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
          <div className="min-w-0">
            {eyebrow && (
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-brand ring-1 ring-brand-tint">
                {icon && <Icon name={icon} className="size-3.5" />}
                {eyebrow}
              </div>
            )}
            <h1 className="text-[26px] font-bold leading-tight text-ink md:text-[34px]">{title}</h1>
            {description && <div className="mt-3 max-w-3xl text-[15px] leading-7 text-pretty text-muted">{description}</div>}
            {children && <div className="mt-5">{children}</div>}
          </div>
          {aside}
        </div>
      </Container>
    </section>
  );
}

/** 页头右侧的统计卡：数字大、说明小，2×2 排列 */
export function HeroStats({ items }: { items: { label: string; value: ReactNode; note?: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white bg-line-soft shadow-[0_8px_30px_rgb(30_79_216/0.08)] sm:grid-cols-4 lg:w-[400px] lg:grid-cols-2">
      {items.map((it) => (
        <div key={it.label} className="bg-white/90 px-4 py-3.5 backdrop-blur">
          <dt className="text-xs text-subtle">{it.label}</dt>
          <dd className="mt-1 text-[22px] font-bold leading-tight text-ink tabular">{it.value}</dd>
          {it.note && <dd className="mt-0.5 text-[11px] text-subtle">{it.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** 页头里的搜索框，提交到站内搜索 */
export function HeroSearch({ q = "", type, placeholder }: { q?: string; type?: string; placeholder: string }) {
  return (
    <form action="/search" className="flex max-w-2xl overflow-hidden rounded-xl border border-brand-tint bg-white shadow-[0_8px_24px_rgb(30_79_216/0.10)] focus-within:border-brand">
      {type && <input type="hidden" name="type" value={type} />}
      <span className="flex items-center pl-4 text-subtle">
        <Icon name="search" className="size-[18px]" />
      </span>
      <input name="q" defaultValue={q} placeholder={placeholder} aria-label="搜索关键词" className="h-12 min-w-0 flex-1 px-3 text-[15px] outline-none focus-visible:shadow-none!" />
      <button className="m-1.5 rounded-lg bg-brand px-5 text-[15px] font-medium text-white hover:bg-brand-dark md:px-7">搜索</button>
    </form>
  );
}

/** 带底色的图标方块，用于卡片标题、说明条目 */
export function IconTile({ name, tone = "brand", className }: { name: IconName; tone?: keyof typeof tileTones; className?: string }) {
  return (
    <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg", tileTones[tone], className)}>
      <Icon name={name} className="size-[18px]" />
    </span>
  );
}

const tileTones = {
  brand: "bg-brand-soft text-brand",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
  cyan: "bg-cyan-50 text-cyan-700",
  orange: "bg-orange-50 text-cta",
  slate: "bg-line-soft text-muted",
};

export function Breadcrumbs({ items, root = { name: "首页", href: "/" } }: { items: { name: string; href?: string }[]; root?: { name: string; href: string } }) {
  const all = [root, ...items];
  return (
    <>
      <nav aria-label="面包屑" className="py-4 text-xs text-subtle md:py-5 md:text-sm">
        <ol className="flex flex-wrap items-center gap-1.5">
          {all.map((it, i) => (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              {it.href && i < all.length - 1 ? (
                <Link href={it.href} className="hover:text-brand">
                  {it.name}
                </Link>
              ) : (
                <span aria-current={i === all.length - 1 ? "page" : undefined} className={i === all.length - 1 ? "text-ink-2" : ""}>{it.name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {all.length >= 2 && <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((it, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: it.name,
            ...(it.href ? { item: new URL(it.href, site.url).toString() } : {}),
          })),
        }}
      />}
    </>
  );
}

/** FAQ 用原生 details，不依赖 JS；同时输出 FAQPage 结构化数据 */
export function FaqList({ items, schema = true }: { items: QA[]; schema?: boolean }) {
  return (
    <>
      <div className="divide-y divide-line">
        {items.map((f) => (
          <details key={f.q} className="group py-3" open>
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium text-ink">
              <h3 className="text-[15px]">{f.q}</h3>
              <span className="mt-0.5 text-subtle transition group-open:rotate-180" aria-hidden>
                ▾
              </span>
            </summary>
            <p className="mt-2 text-sm leading-7 text-muted">{f.a}</p>
          </details>
        ))}
      </div>
      {schema && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }}
        />
      )}
    </>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={cx("relative inline-block text-[13px] leading-none tracking-[1px]", className)} aria-label={`${value} 分`}>
      <span className="text-line">★★★★★</span>
      <span className="absolute inset-0 overflow-hidden text-amber-500" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  );
}

export function PageFootnote({ children, correctionHref = "/about/methodology#corrections" }: { children: ReactNode; correctionHref?: string | null }) {
  return (
    <p className="mt-6 border-t border-line pt-4 text-xs leading-6 text-subtle">
      {children}{correctionHref && <> 发现错误？<Link href={correctionHref} className="text-brand hover:underline">提交更正</Link></>}
    </p>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "cta",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "cta" | "primary" | "outline" | "ghost";
  className?: string;
}) {
  const cls = {
    cta: "bg-cta text-white hover:bg-cta-dark",
    primary: "bg-brand text-white hover:bg-brand-dark",
    outline: "border border-brand text-brand bg-white hover:bg-brand-soft",
    ghost: "border border-line text-ink-2 bg-white hover:border-brand hover:text-brand",
  }[variant];
  return (
    <Link href={href} className={cx("inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium transition", cls, className)}>
      {children}
    </Link>
  );
}

const icons: Record<string, ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  phone: <path d="M6 3h3l1.5 5-2 1.5a11 11 0 006 6l1.5-2 5 1.5v3a2 2 0 01-2 2A17 17 0 014 5a2 2 0 012-2z" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.5 4.3 4.3 0 0119.5 10C19.5 15.4 12 20 12 20z" />,
  compare: <path d="M8 4v16M16 4v16M4 8h8M12 16h8" />,
  home: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  trophy: <path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4.5a3 3 0 003.5 4M16 6h3.5a3 3 0 01-3.5 4M12 13v4M8 20h8" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0115 0" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  shield: <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />,
  book: (
    <>
      <path d="M5 5.5A2.5 2.5 0 017.5 3H19v14H7.5A2.5 2.5 0 005 19.5z" />
      <path d="M5 19.5A2.5 2.5 0 017.5 17H19v4H7.5A2.5 2.5 0 015 18.5" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V9.5L12 4l8 5.5V21" />
      <path d="M3 21h18M9.5 21v-5h5v5M9 11h.01M15 11h.01" />
    </>
  ),
  doc: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M3 20a6 6 0 0112 0M16 5a3.5 3.5 0 010 7M18 14.5a6 6 0 013 5.5" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  flame: <path d="M12 21c-4 0-6.5-2.7-6.5-6.2 0-3.6 3-5.4 3.5-9.3 2.5 1.3 4 3.8 4 6 1-.6 1.7-1.8 1.8-3 1.8 1.7 3.7 4 3.7 6.6 0 3.4-2.5 5.9-6.5 5.9z" />,
  cap: (
    <>
      <path d="M2.5 9.5L12 5l9.5 4.5L12 14z" />
      <path d="M6.5 11.5v4.5c1.5 1.4 3.5 2.1 5.5 2.1s4-.7 5.5-2.1v-4.5M21.5 9.5V14" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 7.5l3 4 3-4M8.5 12h7M8.5 15h7M12 11.5V17" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16M7.5 20h9M5 7.5h14M12 4.5l-7 3M12 4.5l7 3" />
      <path d="M5 7.5l-2.5 6a2.6 2.6 0 005 0zM19 7.5l-2.5 6a2.6 2.6 0 005 0z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </>
  ),
  pen: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  play: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M10 9.3v5.4l4.6-2.7z" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
};

export type IconName = keyof typeof icons;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={cx("size-4 shrink-0", className)} aria-hidden>
      {icons[name]}
    </svg>
  );
}
