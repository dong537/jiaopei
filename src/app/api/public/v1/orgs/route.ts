import { coursesOf, getCategory, getCity, orgs } from "@/lib/data";
import { absoluteUrl, site } from "@/lib/site";

// 公开 API：只输出已认领或已核验机构的事实字段，每个字段带来源，不输出机构自述
export function GET() {
  const data = orgs
    .filter((o) => o.verification !== "unclaimed")
    .map((o) => ({
      id: o.id,
      name: o.name,
      legalName: o.legalName,
      url: absoluteUrl(`/org/${o.id}`),
      city: getCity(o.citySlug)?.name,
      district: o.district,
      founded: o.founded,
      categories: o.categories.map((c) => getCategory(c)?.category.name ?? c),
      verification: { status: o.verification, verifiedAt: o.verifiedAt ?? null, verifiedUntil: o.verifiedUntil ?? null },
      rating: o.rating && o.rating.count >= 30 ? { average: o.rating.avg, count: o.rating.count, source: "平台成交学员评价" } : null,
      priceRange: o.priceText,
      facts: o.info ?? [],
      courses: coursesOf(o.id).map((c) => ({
        name: c.name,
        url: absoluteUrl(`/course/${c.id}`),
        classType: c.classLabel,
        hours: c.hours,
        priceCNY: c.price,
        nextStart: c.nextStart,
        source: "机构填写 · 平台审核",
      })),
      updatedAt: o.updatedAt,
    }));
  return Response.json(
    { source: site.name, license: "引用请注明来源：教培网", asOf: site.asOf, methodology: absoluteUrl("/about/methodology"), count: data.length, data },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
