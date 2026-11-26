import { SchoolDirectory } from "@/components/SchoolDirectory";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Container, HeroStats, PageFootnote, PageHero } from "@/components/ui";
import { getCity } from "@/lib/data";
import { schools } from "@/lib/schools";
import { absoluteUrl, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "广州学校库：公办民办中小学登记信息",
  description: "广州市中小学的办学性质、学段、地址与主管部门，来源为各区教育局公示名单，标注核对日期。学校库不排名、不收费。",
  alternates: { canonical: "/school" },
};

export default function SchoolPage() {
  const city = getCity("guangzhou")!;
  const unit = (u: string) => <span className="ml-1 text-sm font-normal text-subtle">{u}</span>;
  return (
    <>
      <PageHero
        crumbs={[{ name: "学校库" }, { name: city.name }]}
        eyebrow="只做事实登记 · 不排名、不打分、不收费"
        icon="building"
        title={`${city.name}学校库`}
        description={
          <>
            <p>
              学校库收录{city.name}中小学的办学性质、学段、地址和主管部门，方便家长在找课外培训前先弄清孩子所在学段和政策要求。
              我们不给学校排名、不打分、不收费，学校也不能入驻或付费修改。升学政策、招生地段以教育局当年公布的文件为准。
            </p>
            <p className="mt-2 text-xs text-subtle">来源：各区教育局公示名单 · 核对日期 {schools[0].checkedAt}</p>
          </>
        }
        aside={
          <HeroStats
            items={[
              { label: "收录学校", value: <>{schools.length}{unit("所")}</> },
              { label: "覆盖区域", value: <>{new Set(schools.map((s) => s.district)).size}{unit("个区")}</> },
              { label: "公办学校", value: <>{schools.filter((s) => s.nature === "公办").length}{unit("所")}</> },
              { label: "民办学校", value: <>{schools.filter((s) => s.nature === "民办").length}{unit("所")}</> },
            ]}
          />
        }
      />
      <Container className="pt-6 md:pt-7">
      <SchoolDirectory schools={schools} />
      <p className="mt-6 text-sm text-muted">
        正式上线后学校库覆盖全国，与
        <Link href="/city/guangzhou" className="mx-1 text-brand hover:underline">
          培训机构库
        </Link>
        分开展示：学校信息只做事实登记，培训机构才有核验、评价和报名。
      </p>
      <PageFootnote>原型收录 {schools.length} 所示例学校。</PageFootnote>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${city.name}学校库`,
          itemListElement: schools.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absoluteUrl(`/school/${s.id}`),
            name: s.name,
          })),
          publisher: { "@id": `${site.url}/#organization` },
        }}
      />
      </Container>
    </>
  );
}
