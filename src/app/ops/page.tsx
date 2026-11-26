import type { Metadata } from "next";
import { OpsConsole } from "@/components/OpsConsole";
import { Container } from "@/components/ui";
import { orgs } from "@/lib/data";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "运营后台", robots: { index: false, follow: false } };

const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

export default function OpsPage() {
  const renewals = orgs
    .filter((o) => o.verifiedUntil)
    .map((o) => ({ name: o.name, until: o.verifiedUntil!, days: daysBetween(site.asOf, o.verifiedUntil!) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);
  return (
    <div className="bg-line-soft">
      <Container className="py-6">
        <h1 className="text-xl font-semibold text-ink">运营后台（演示）</h1>
        <p className="mb-4 mt-1 text-sm text-subtle">
          平台运营与城市合伙人在这里处理资质审核、退款、评价、线索申诉、更正和复核。原型中的申请、订单、评价都来自本机浏览器的演示操作。
        </p>
        <OpsConsole renewals={renewals} />
      </Container>
    </div>
  );
}
