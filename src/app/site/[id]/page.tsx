import Loading from "@/app/loading";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/LeadForm";
import { OrgAssistant } from "@/components/OrgAssistant";
import { Container, Icon, PhotoBox, VerificationBadge } from "@/components/ui";
import { knowledgeOf } from "@/lib/ai";
import { coursesOf, fmtPrice, getCity, getOrg, orgs } from "@/lib/data";

// 机构微官网：AI 营销增值服务的一部分。数据与教培网机构主页同源，机构不用单独维护
export function generateStaticParams() {
  return orgs.filter((o) => o.aiAssistant && o.verification === "verified").map((o) => ({ id: o.id }));
}

async function load(params: PageProps<"/site/[id]">["params"]) {
  const org = getOrg((await params).id);
  if (!org || !org.aiAssistant || org.verification !== "verified") notFound();
  return org;
}

export async function generateMetadata({ params }: PageProps<"/site/[id]">): Promise<Metadata> {
  const org = await load(params);
  return {
    title: `${org.name}官网`,
    description: `${org.name}：${org.focus}。课程、价格、校区与预约试听。`,
    // 与机构主页内容相同，规范地址指向机构主页，避免重复内容分散信源
    alternates: { canonical: `/org/${org.id}` },
  };
}

export default function OrgSitePage(props: PageProps<"/site/[id]">) {
  return <Suspense fallback={<Loading />}><OrgSitePageContent {...props} /></Suspense>;
}

async function OrgSitePageContent({ params }: PageProps<"/site/[id]">) {
  const org = await load(params);
  const city = getCity(org.citySlug)!;
  const cs = coursesOf(org.id);
  const sub = org.id.replace(/^gz-/, "");

  return (
    <div className="bg-white">
      <div className="bg-ink py-1.5 text-center text-xs text-white/80">
        微官网预览（正式环境无教培网导航栏）· 地址为 {sub}.jiaopei.com 或机构自有域名 ·{" "}
        <Link href="/merchant/ai" className="underline">
          返回商家中心
        </Link>
      </div>
      <section className="bg-gradient-to-br from-brand to-brand-dark text-white">
        <Container className="grid gap-6 py-12 md:grid-cols-[1fr_340px] md:items-center">
          <div>
            <div className="text-sm opacity-80">
              {city.name} · {org.district}
              {org.area} · 创办于 {org.founded.slice(0, 4)} 年
            </div>
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">{org.name}</h1>
            <p className="mt-3 text-lg opacity-90">{org.focus} · {org.tags.join(" · ")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded bg-white px-2 py-0.5">
                <VerificationBadge status={org.verification} until={org.verifiedUntil} />
              </span>
              {org.escrow && <span className="rounded bg-white/15 px-2 py-1 text-xs">学费平台担保 · 按课时结算</span>}
            </div>
          </div>
          <PhotoBox photo={org.photo} className="hidden aspect-[4/3] rounded-xl md:block" sizes="340px" />
        </Container>
      </section>

      <Container className="grid gap-8 py-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-bold text-ink">课程与学费</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {cs.map((c) => (
                <Link key={c.id} href={`/course/${c.id}`} className="rounded-xl border border-line p-4 hover:border-brand">
                  <div className="font-semibold text-ink">{c.name}</div>
                  <div className="mt-1 text-sm text-muted">
                    {c.classLabel} · {c.hours} 课时 · {c.nextStart === "随报随学" ? "随报随学" : `${c.nextStart} 开班`}
                  </div>
                  <div className="mt-2 text-xl font-bold text-cta tabular">{fmtPrice(c.price)}</div>
                </Link>
              ))}
            </div>
            <p className="mt-2 text-xs text-subtle">在线报名、付款和退款在教培网完成，学费由持牌支付机构存管。</p>
          </section>

          {org.offers && (
            <section>
              <h2 className="text-2xl font-bold text-ink">优惠</h2>
              <ul className="mt-4 grid gap-3 md:grid-cols-3">
                {org.offers.map((f) => (
                  <li key={f.title} className="rounded-xl bg-orange-50 p-4">
                    <div className="font-semibold text-cta">{f.title}</div>
                    <div className="mt-1 text-sm text-muted">{f.detail}</div>
                    <div className="mt-2 text-xs text-subtle">{f.validUntil}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {org.album && (
            <section>
              <h2 className="text-2xl font-bold text-ink">校区环境</h2>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {org.album.map((p) => (
                  <PhotoBox key={p.label} photo={p} className="aspect-[4/3] rounded-lg" sizes="240px" />
                ))}
              </div>
            </section>
          )}

          {org.teachers && (
            <section>
              <h2 className="text-2xl font-bold text-ink">教师团队</h2>
              <ul className="mt-4 grid gap-3 md:grid-cols-3">
                {org.teachers.map((t, i) => (
                  <li key={i} className="rounded-xl border border-line p-4">
                    <div className="font-medium text-ink">{t.name}</div>
                    <div className="text-sm text-muted">{t.role}</div>
                    <div className="mt-1 text-xs text-verified">{t.cert}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {org.campuses && (
            <section>
              <h2 className="text-2xl font-bold text-ink">校区地址</h2>
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {org.campuses.map((c) => (
                  <li key={c.name} className="flex gap-2 rounded-xl border border-line p-4">
                    <Icon name="pin" className="mt-0.5 text-brand" />
                    <div>
                      <div className="font-medium text-ink">{c.name}</div>
                      <div className="text-sm text-muted">{c.address}</div>
                      <div className="text-xs text-subtle">{c.metro}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="border-t border-line pt-4 text-xs leading-6 text-subtle">
            本站内容与
            <Link href={`/org/${org.id}`} className="mx-1 text-brand hover:underline">
              教培网 · {org.name}主页
            </Link>
            同步，资质信息由教培网核验（{org.verifiedAt}）。学员评价请在教培网主页查看。技术支持：教培网。
          </p>
        </div>

        <aside className="lg:sticky lg:top-[120px] lg:self-start">
          <div className="rounded-xl border border-line p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-ink">预约免费试听</h2>
            <LeadForm
              fields={[
                { kind: "select", name: "course", label: "意向课程", options: cs.map((c) => c.name) },
                { kind: "text", name: "name", label: "称呼", placeholder: "如：陈同学" },
                { kind: "text", name: "phone", label: "手机号", type: "tel", placeholder: "11 位手机号" },
              ]}
              submitLabel="提交预约"
              consent="同意将手机号以虚拟号形式提供给本机构用于回电"
              success={`预约已提交，${org.name}会通过平台虚拟号联系你。`}
              record={{ kind: "org", orgId: org.id, orgName: org.name }}
            />
          </div>
        </aside>
      </Container>
      <OrgAssistant orgId={org.id} knowledge={knowledgeOf(org)} />
    </div>
  );
}
