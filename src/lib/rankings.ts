// 榜单计算：每个榜单只按一项可核实的数据排序，只有平台已核验机构参与。
// 推广、年费、佣金、线索包都不进入这里的任何计算。
import { courses, getCategory, getCity, marketStats, orgsIn, yearsSince } from "./data";
import { site } from "./site";
import type { Org } from "./types";

export type RankingRow = { org: Org; value: number; display: string };

export type Ranking = {
  key: string;
  name: string;
  unit: string;
  basis: string;
  period: string;
  gate: string;
  source: string;
  rows: RankingRow[];
};

/** 好评榜的先验参数：评价数 m 条时，加权分取机构分与城市均分的中点 */
export const BAYES_M = 30;

/** 已核验机构少于这个数时不发布榜单、不显示名次徽章，避免“1 家里的第 1 名” */
export const MIN_RANKED = 3;

export const weightedRating = (avg: number, count: number, cityAvg: number) =>
  (count * avg + BAYES_M * cityAvg) / (count + BAYES_M);

function hourlyPrice(org: Org, categorySlug: string) {
  const smallClasses = courses.filter(
    (c) => c.orgId === org.id && c.categorySlug === categorySlug && c.classType === "small" && c.price > 0,
  );
  if (smallClasses.length < 2) return undefined;
  return smallClasses.reduce((sum, c) => sum + c.price / c.hours, 0) / smallClasses.length;
}

export function cityAverageRating(citySlug: string, categorySlug: string) {
  const stat = marketStats[`${citySlug}/${categorySlug}`];
  if (stat) return stat.cityAvgRating;
  const rated = orgsIn(citySlug, categorySlug).filter((o) => o.rating);
  if (!rated.length) return 0;
  return rated.reduce((s, o) => s + o.rating!.avg, 0) / rated.length;
}

export function buildRankings(citySlug: string, categorySlug: string): Ranking[] {
  const category = getCategory(categorySlug)?.category.name ?? categorySlug;
  const verified = orgsIn(citySlug, categorySlug).filter((o) => o.verification === "verified");
  const cityAvg = cityAverageRating(citySlug, categorySlug);

  const sortDesc = (rows: RankingRow[]) => rows.sort((a, b) => b.value - a.value);

  return [
    {
      key: "rating",
      name: "好评榜",
      unit: "加权评分（评价数）",
      basis: "已报读学员评分的加权平均：评价越少，分数越向全市平均分靠拢，避免少量好评冲上榜首。",
      period: "近 12 个月",
      gate: `已核验，且至少 ${BAYES_M} 条已报读评价`,
      source: "教培网平台成交学员评价",
      rows: sortDesc(
        verified
          .filter((o) => o.rating && o.rating.count >= BAYES_M)
          .map((o) => {
            const value = weightedRating(o.rating!.avg, o.rating!.count, cityAvg);
            return { org: o, value, display: `${value.toFixed(2)}（${o.rating!.count}）` };
          }),
      ),
    },
    {
      key: "enroll",
      name: "报名人数榜",
      unit: "近 90 天报名（人）",
      basis: "通过平台担保付款完成报名的学员人数，同一学员多次报名计 1 人。",
      period: "近 90 天",
      gate: "已核验，开通在线报名",
      source: "教培网订单数据",
      rows: sortDesc(
        verified.filter((o) => o.enroll90d).map((o) => ({ org: o, value: o.enroll90d!, display: `${o.enroll90d}` })),
      ),
    },
    {
      key: "inquiry",
      name: "咨询热度榜",
      unit: "近 30 天咨询（人）",
      basis: "提交预约或咨询的学员人数，按手机号去重。",
      period: "近 30 天",
      gate: "已核验",
      source: "教培网线索数据",
      rows: sortDesc(
        verified
          .filter((o) => o.inquiries30d)
          .map((o) => ({ org: o, value: o.inquiries30d!, display: `${o.inquiries30d}` })),
      ),
    },
    {
      key: "teachers",
      name: "师资榜",
      unit: "已查验教师（人）",
      basis: "机构上传、且平台已查验证书原件的在职教师人数。",
      period: "截至本周一",
      gate: "已核验",
      source: "机构提交 + 平台查验",
      rows: sortDesc(
        verified
          .filter((o) => o.teachersVerified)
          .map((o) => ({ org: o, value: o.teachersVerified!, display: `${o.teachersVerified}` })),
      ),
    },
    {
      key: "years",
      name: "办学年限榜",
      unit: "成立年限（年）",
      basis: "营业执照登记的成立日期到统计日的整年数。",
      period: "截至本周一",
      gate: "已核验，经营状态为存续",
      source: "国家企业信用信息公示系统",
      rows: sortDesc(
        verified.map((o) => {
          const y = yearsSince(o.founded, site.asOf);
          return { org: o, value: y, display: `${y}` };
        }),
      ),
    },
    {
      key: "hourly",
      name: "课时单价榜",
      unit: "小班每课时均价（元）",
      basis: `公开标价的${category}小班课，学费除以课时后取平均，从低到高排列。`,
      period: "截至本周一",
      gate: "已核验，至少 2 门标价小班课",
      source: "机构公开标价",
      rows: verified
        .map((o) => ({ org: o, value: hourlyPrice(o, categorySlug) }))
        .filter((r): r is { org: Org; value: number } => r.value !== undefined)
        .sort((a, b) => a.value - b.value)
        .map((r) => ({ ...r, display: `${Math.round(r.value)}` })),
    },
  ];
}

/** 榜单页顶部“本周结论”，由榜单数据直接生成，保证与表格一致 */
export function rankingSummary(citySlug: string, categorySlug: string, rankings: Ranking[]) {
  const city = getCity(citySlug)?.name ?? citySlug;
  const category = getCategory(categorySlug)?.category.name ?? categorySlug;
  const stat = marketStats[`${citySlug}/${categorySlug}`];
  const verifiedCount = stat?.verifiedCount ?? orgsIn(citySlug, categorySlug).filter((o) => o.verification === "verified").length;
  const [rating, enroll, , , , hourly] = rankings;
  const parts: string[] = [];
  if (rating.rows[0]) {
    const r = rating.rows[0];
    parts.push(`好评榜第一为${r.org.name}（加权 ${r.value.toFixed(2)} 分，${r.org.rating!.count} 条评价）`);
  }
  if (enroll.rows[0]) parts.push(`报名人数榜第一为${enroll.rows[0].org.name}（近 90 天 ${enroll.rows[0].value} 人）`);
  if (hourly.rows[0])
    parts.push(`${category}小班课时单价最低为${hourly.rows[0].org.name}（平均 ${Math.round(hourly.rows[0].value)} 元 / 课时）`);
  if (!parts.length) return `${site.asOf} 更新：${city}${category}培训暂无达到入榜门槛的已核验机构。`;
  return `${site.asOf} 更新：${city} ${verifiedCount} 家已核验${category}培训机构中，${parts.join("，")}。`;
}

/** 机构在本类别各榜单中的名次（只取前 3 名，用于列表徽章） */
export function topBadges(org: Org, categorySlug: string) {
  const city = getCity(org.citySlug)?.name ?? "";
  const category = getCategory(categorySlug)?.category.name ?? "";
  return buildRankings(org.citySlug, categorySlug)
    .map((r) => ({ r, idx: r.rows.findIndex((x) => x.org.id === org.id) }))
    .filter(({ r, idx }) => r.rows.length >= MIN_RANKED && idx >= 0 && idx < 3)
    .sort((a, b) => a.idx - b.idx)
    .map(({ r, idx }) => ({ label: `${city}${category}${r.name}第 ${idx + 1} 名`, key: r.key }));
}
