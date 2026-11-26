import type { Metadata } from "next";
import { CompareTable, type CompareRow } from "@/components/compare";
import { ratingText } from "@/components/OrgCard";
import { Breadcrumbs, Container } from "@/components/ui";
import { coursesOf, orgs } from "@/lib/data";

export const metadata: Metadata = {
  title: "机构对比",
  description: "并排比较培训机构的核验状态、学费、课时单价、师资、评价和退费规则。",
  robots: { index: false, follow: true },
};

const statusName = { verified: "平台已核验", claimed: "机构已认领", unclaimed: "待认领" };

export default function ComparePage() {
  const rows: CompareRow[] = orgs
    .filter((o) => o.verification !== "unclaimed")
    .map((o) => {
      const small = coursesOf(o.id).filter((c) => c.classType === "small");
      const hourly = small.length ? Math.round(small.reduce((s, c) => s + c.price / c.hours, 0) / small.length) : undefined;
      return {
        id: o.id,
        name: o.name,
        verification: statusName[o.verification],
        district: `${o.district}${o.area}`,
        founded: o.founded,
        campusCount: o.campusCount,
        priceText: o.priceText,
        hourly: hourly ? `${hourly} 元` : "—",
        teachers: o.teachersVerified ? `${o.teachersVerified} / ${o.teachersTotal} 人` : "—",
        rating: ratingText(o),
        refund: o.info?.find((f) => f.label === "退费规则")?.value ?? (o.escrow ? "平台担保付款，按未上课时比例退" : "按机构合同"),
        tags: o.tags.join("、") || "—",
      };
    });
  return (
    <Container>
      <Breadcrumbs items={[{ name: "机构对比" }]} />
      <h1 className="mb-1 text-2xl font-bold text-ink">机构对比</h1>
      <p className="mb-5 text-sm text-muted">对比价格、课时单价、师资、评价、退费规则。对比清单保存在你的浏览器里。</p>
      <CompareTable rows={rows} />
    </Container>
  );
}
