import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { LiveRemind } from "@/components/LiveRemind";
import { Card, Container, HeroStats, PageFootnote, PageHero, PhotoBox, SectionTitle, Tag } from "@/components/ui";
import { liveClasses, liveCover } from "@/lib/live";
import { absoluteUrl, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "公益直播课：考试政策、备考方法与选课避坑",
  description: "教培网公益直播课免费观看，由编辑部和已核验机构主讲，直播中不卖课、不承诺效果。",
  alternates: { canonical: "/live" },
};

const weekday = (date: string) => "日一二三四五六"[new Date(`${date}T00:00:00Z`).getUTCDay()];

export default function LivePage() {
  const upcoming = liveClasses.filter((l) => !l.replay);
  const past = liveClasses.filter((l) => l.replay);
  const unit = (u: string) => <span className="ml-1 text-sm font-normal text-subtle">{u}</span>;
  return (
    <>
      <PageHero
        crumbs={[{ name: "公益直播课" }]}
        eyebrow="免费观看 · 直播中不卖课"
        icon="play"
        title="公益直播课"
        description="免费观看。主讲人来自教培网编辑部和平台已核验机构，机构供稿的场次标注“品牌内容”。直播中不收款、不承诺考试结果，引用的政策和考试信息附官方来源。"
        aside={
          <HeroStats
            items={[
              { label: "即将开播", value: <>{upcoming.length}{unit("场")}</> },
              { label: "往期回放", value: <>{past.length}{unit("场")}</> },
              ...(upcoming[0] ? [{ label: "下一场", value: <span className="text-lg">{upcoming[0].start.slice(5)}</span> }] : []),
              { label: "观看费用", value: <>0{unit("元")}</> },
            ]}
          />
        }
      />

      <Container className="pt-6 md:pt-7">
      <SectionTitle>即将开播</SectionTitle>
      <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {upcoming.map((l) => (
          <li key={l.id} id={l.id} className="scroll-mt-28">
            <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition hover:border-brand-tint hover:shadow-[0_14px_36px_rgb(30_79_216/0.10)]">
              <div className="relative">
                <PhotoBox photo={liveCover(l)} video={{ badge: "直播预告", duration: `${l.minutes} 分钟` }} className="aspect-video" sizes="(max-width: 768px) 100vw, 440px" />
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
                  <span className="size-1.5 rounded-full bg-cta" aria-hidden />
                  <span className="tabular">
                    {l.start.slice(5, 10)} 周{weekday(l.start.slice(0, 10))} {l.start.slice(11)}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {l.by === "org" ? <Tag tone="warn">品牌内容 · 机构供稿</Tag> : <Tag tone="brand">编辑部</Tag>}
                  <span className="text-xs text-subtle">{l.platform}</span>
                </div>
                <h3 className="mt-2.5 text-[17px] font-semibold leading-snug text-ink">{l.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted">{l.summary}</p>
                <p className="mt-3 text-xs leading-5 text-subtle">
                  主讲：
                  {l.orgId ? (
                    <Link href={`/org/${l.orgId}`} className="text-brand hover:underline">
                      {l.host}
                    </Link>
                  ) : (
                    l.host
                  )}
                </p>
                <div className="mt-auto pt-4">
                  <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-4">
                    <span className="text-xs text-subtle">免费 · 开播前短信提醒</span>
                    <LiveRemind id={l.id} />
                  </div>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>

      <div className="mt-12">
        <SectionTitle>往期回放</SectionTitle>
      </div>
      <ul className="grid gap-4 lg:grid-cols-2">
        {past.map((l) => (
          <li key={l.id} className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-3 pr-5 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
            <PhotoBox photo={liveCover(l, "回放封面")} video={{ duration: `${l.minutes}:00`, small: true }} className="aspect-video w-40 shrink-0 rounded-xl" sizes="160px" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-snug text-ink">{l.title}</span>
              <span className="mt-1 block text-xs text-subtle">
                {l.start.slice(0, 10)} · {l.host}
              </span>
              <span className="mt-2 block text-sm text-brand">在{l.platform}看回放</span>
            </span>
          </li>
        ))}
      </ul>

      <Card className="mt-12 bg-gradient-to-r from-white to-brand-soft/60">
        <h2 className="text-lg font-semibold text-ink">机构想来讲一场？</h2>
        <p className="mt-1 text-sm leading-6 text-ink-2">
          已核验并开通 AI 营销服务的机构，可在
          <Link href="/merchant/ai" className="mx-1 text-brand hover:underline">
            商家中心 · 品牌内容
          </Link>
          申请。选题须是方法、政策或经验分享，编辑审核大纲后排期。
        </p>
      </Card>
      <PageFootnote>直播课表每周更新，以平台通知为准。</PageFootnote>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": upcoming.map((l) => ({
            "@type": "EducationEvent",
            name: l.title,
            description: l.summary,
            startDate: `${l.start.replace(" ", "T")}:00+08:00`,
            eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
            isAccessibleForFree: true,
            location: { "@type": "VirtualLocation", url: absoluteUrl("/live") },
            organizer: { "@id": `${site.url}/#organization` },
            url: absoluteUrl(`/live#${l.id}`),
          })),
        }}
      />
      </Container>
    </>
  );
}
