import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Container, HeroStats, Icon, IconTile, PageHero, PhotoBox, cx, type IconName } from "@/components/ui";
import { policies } from "@/lib/data";
import { getLive, liveCover } from "@/lib/live";
import { absoluteUrl, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "培训行业政策法规",
  description: "校外培训、职业技能培训相关政策的原文、发布机关、发布日期与解读。",
  alternates: { canonical: "/policies" },
};

/** 按发布机关判断层级，只用于标签展示 */
function levelOf(org: string) {
  if (/部$|国务院|国家/.test(org)) return { label: "国家", cls: "bg-rose-50 text-rose-700" };
  if (org.includes("省")) return { label: "省级", cls: "bg-violet-50 text-violet-700" };
  return { label: "市级", cls: "bg-brand-soft text-brand" };
}

const blocks: [IconName, "brand" | "emerald" | "orange", string, string][] = [
  ["list", "brand", "要点", "[3–5 条要点，逐条对应原文条款]"],
  ["user", "emerald", "对学员", "[报名、付款、退费时要注意什么]"],
  ["building", "orange", "对机构", "[需要调整的收费、合同或资质要求]"],
];

/** 原文预览位：按红头文件版式画的缩略图，正式环境替换为原文 PDF 首页截图 */
function DocThumb({ org }: { org: string }) {
  return (
    <figure className="hidden w-[108px] shrink-0 self-start sm:block">
      <div aria-hidden className="relative aspect-[3/4] overflow-hidden rounded-md bg-white px-2.5 pt-3 shadow-[0_6px_18px_rgb(15_23_42/0.10)] ring-1 ring-line">
        <div className="text-center text-[9px] font-bold leading-tight tracking-[0.12em] text-red-600">{org}文件</div>
        <div className="mt-1.5 h-[2px] bg-red-600" />
        <div className="mx-auto mt-2 h-[3px] w-3/4 rounded bg-ink/25" />
        <div className="mt-2 space-y-[5px]">
          {[100, 94, 100, 72, 100, 88, 56].map((w, i) => (
            <div key={i} className="h-[3px] rounded bg-line" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="absolute bottom-3 right-2.5 flex size-8 items-center justify-center rounded-full border-[1.5px] border-red-500/60 text-[10px] text-red-500/70">★</div>
      </div>
      <figcaption className="mt-2 text-center text-[11px] text-subtle">原文预览</figcaption>
    </figure>
  );
}

const rules = ["注明发布机关、发布日期和原文链接", "要点逐条对应原文条款", "解读由编辑撰写，具备法律资质的审校人复核"];

export default function PoliciesPage() {
  const latest = [...policies].sort((a, b) => b.date.localeCompare(a.date))[0];
  const unit = (u: string) => <span className="ml-1 text-sm font-normal text-subtle">{u}</span>;
  return (
    <>
      <PageHero
        crumbs={[{ name: "政策法规" }]}
        eyebrow="原文 + 解读 · 律师审校"
        icon="scale"
        title="培训行业政策法规"
        description="校外培训、职业技能培训相关政策的原文、发布机关、发布日期与解读。报名、付款、退费前，先看清楚对学员和对机构分别有哪些要求。"
        aside={
          <HeroStats
            items={[
              { label: "收录政策", value: <>{policies.length}{unit("条")}</> },
              { label: "发布机关", value: <>{new Set(policies.map((p) => p.org)).size}{unit("个")}</> },
              { label: "最近发布", value: <span className="text-lg">{latest.date}</span> },
              { label: "覆盖层级", value: <span className="text-lg">国家 · 省 · 市</span> },
            ]}
          />
        }
      />

      <Container className="pt-6 md:pt-7">
        <div className="reading-layout">
          <ol className="relative space-y-6 before:absolute before:bottom-6 before:left-[15px] before:top-6 before:w-px before:bg-line md:before:left-[111px]">
            {policies.map((p) => {
              const level = levelOf(p.org);
              const live = p.liveId ? getLive(p.liveId) : undefined;
              return (
                <li key={p.slug} id={p.slug} className="relative scroll-mt-28 pl-10 md:pl-[140px]">
                  <div className="absolute left-0 top-6 hidden w-[92px] text-right md:block">
                    <div className="text-xs text-subtle tabular">{p.date.slice(0, 4)}</div>
                    <div className="text-xl font-bold leading-tight text-ink tabular">{p.date.slice(5)}</div>
                  </div>
                  <span aria-hidden className="absolute left-[9px] top-7 size-3.5 rounded-full border-[3px] border-page bg-brand ring-1 ring-brand-tint md:left-[105px]" />
                  <article className="flex gap-6 rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] md:p-6">
                    <DocThumb org={p.org} />
                    <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={cx("rounded px-1.5 py-0.5 font-medium", level.cls)}>{level.label}</span>
                      <span className="inline-flex items-center gap-1 text-ink-2">
                        <Icon name="building" className="size-3.5 text-subtle" />
                        <span className="sr-only">发布机关：</span>
                        {p.org}
                      </span>
                      <span className="text-subtle tabular">
                        <span className="sr-only">发布日期：</span>· {p.date}
                      </span>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold leading-snug text-ink md:text-xl">{p.title}</h2>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {blocks.map(([icon, tone, label, text]) => (
                        <div key={label} className="rounded-xl bg-page p-3.5">
                          <div className="flex items-center gap-2 text-sm font-medium text-ink">
                            <IconTile name={icon} tone={tone} className="size-7 rounded-md [&>svg]:size-4" />
                            {label}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
                        </div>
                      ))}
                    </div>
                    {live && (
                      <Link href={`/live#${live.id}`} className="group mt-3 flex items-center gap-3 rounded-xl border border-line p-2 pr-3 sm:gap-3.5 sm:pr-4 hover:border-brand-tint hover:bg-brand-soft/30">
                        <PhotoBox photo={liveCover(live)} video={{ small: true }} className="aspect-video w-24 shrink-0 rounded-lg sm:w-28" sizes="112px" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-cta">
                            视频解读 · {live.start.slice(5, 10)} {live.start.slice(11)} 直播
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-ink group-hover:text-brand sm:text-base">{live.title}</span>
                          <span className="mt-0.5 hidden truncate text-xs text-subtle sm:block">{live.host}</span>
                        </span>
                        <Icon name="arrow" className="hidden size-4 text-subtle group-hover:text-brand sm:block" />
                      </Link>
                    )}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line-soft pt-3 text-xs text-subtle">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="pen" className="size-3.5" />
                        解读作者：[姓名] · 审校：[姓名（律师）] · 更新 {p.date}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-brand">
                        <Icon name="external" className="size-3.5" />
                        原文：[官方原文链接]
                      </span>
                    </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>

          <aside className="reading-sidebar space-y-4">
            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon name="info" className="text-brand" />
                每条政策怎么写
              </h2>
              <ul className="mt-3 space-y-2.5 text-sm leading-6 text-muted">
                {rules.map((r) => (
                  <li key={r} className="flex gap-2">
                    <Icon name="check" className="mt-1 text-verified" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/guide/how-to-verify-training-institution" className="group block rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-5 text-white shadow-[0_10px_30px_rgb(30_79_216/0.25)]">
              <div className="text-xs text-white/75">相关指南</div>
              <div className="mt-1 font-semibold leading-snug">如何判断培训机构是否正规</div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm">
                阅读指南 <Icon name="arrow" className="size-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
            <p className="px-1 text-xs leading-5 text-subtle">
              解读有误？
              <Link href="/about/methodology#corrections" className="text-brand hover:underline">
                提交更正
              </Link>
            </p>
          </aside>
        </div>

        <p className="mt-6 text-sm lg:hidden">
          相关指南：
          <Link href="/guide/how-to-verify-training-institution" className="text-brand hover:underline">
            如何判断培训机构是否正规
          </Link>
        </p>
      </Container>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "培训行业政策法规",
          itemListElement: policies.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: { "@type": "Legislation", name: p.title, legislationDate: p.date, legislationPassedBy: { "@type": "GovernmentOrganization", name: p.org }, url: absoluteUrl(`/policies#${p.slug}`) },
          })),
          publisher: { "@id": `${site.url}/#organization` },
        }}
      />
    </>
  );
}
