import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinApply, MyApplications } from "@/components/JoinApply";
import { Breadcrumbs, Container } from "@/components/ui";
import { cityDirectory } from "@/lib/cities";
import { categoryGroups, getCity, orgs } from "@/lib/data";

export const metadata: Metadata = { title: "入驻申请", robots: { index: false, follow: true } };

export default function ApplyPage() {
  const candidates = orgs.map((o) => ({ id: o.id, name: o.legalName, status: o.verification, city: getCity(o.citySlug)?.name ?? "" }));
  return (
    <Container className="max-w-[1040px]!">
      <Breadcrumbs items={[{ name: "机构入驻", href: "/join" }, { name: "入驻申请" }]} />
      <h1 className="mb-5 text-2xl font-bold text-ink">入驻 / 认领申请</h1>
      <Suspense fallback={<p className="text-muted">正在加载…</p>}>
        <JoinApply candidates={candidates} cities={cityDirectory.map((c) => c.name)} categories={categoryGroups.map((g) => g.name)} />
      </Suspense>
      <div className="mt-8">
        <MyApplications />
      </div>
    </Container>
  );
}
