import { courses, marketStats, orgsIn } from "./data";

export type MarketSummary = {
  orgCount: number;
  verifiedCount: number;
  medianPrice?: number;
  typicalRange?: [number, number];
  pricedCourses: number;
  topDistrict?: { name: string; count: number };
  districts?: { name: string; orgs: number; verified: number; median: number }[];
  bands?: { label: string; courses: number }[];
  /** true 表示来自全量机构库统计；false 表示只根据当前收录样本计算 */
  full: boolean;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return undefined;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export function marketSummary(citySlug: string, categorySlug: string): MarketSummary {
  const stat = marketStats[`${citySlug}/${categorySlug}`];
  if (stat) return { ...stat, full: true };

  const list = orgsIn(citySlug, categorySlug);
  const ids = new Set(list.map((o) => o.id));
  const prices = courses.filter((c) => ids.has(c.orgId) && c.categorySlug === categorySlug).map((c) => c.price);
  const counts = new Map<string, number>();
  list.forEach((o) => counts.set(o.district, (counts.get(o.district) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    orgCount: list.length,
    verifiedCount: list.filter((o) => o.verification === "verified").length,
    medianPrice: median(prices),
    typicalRange: prices.length ? [Math.min(...prices), Math.max(...prices)] : undefined,
    pricedCourses: prices.length,
    topDistrict: top ? { name: top[0], count: top[1] } : undefined,
    full: false,
  };
}
