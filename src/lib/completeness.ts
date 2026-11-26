// 主页完整度：列表默认排序、商家中心“完善建议”和入驻页说明都用这一套规则
import { coursesOf } from "./data";
import type { Org } from "./types";

type Item = { label: string; weight: number; score: number; todo: string };

export function completenessItems(org: Org): Item[] {
  const cs = coursesOf(org.id);
  const dated = cs.filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.nextStart) || c.nextStart === "随报随学").length;
  const teacherRatio = org.teachersTotal ? (org.teachersVerified ?? 0) / org.teachersTotal : 0;
  const campusesWithPhotos = org.album ? Math.min(1, org.album.length / 8) : 0;
  return [
    { label: "资质与基本信息", weight: 20, score: org.info ? 1 : 0, todo: "上传营业执照与办学许可 / 备案" },
    { label: "课程与价格", weight: 20, score: cs.length ? 1 : 0, todo: "发布课程并公开价格" },
    { label: "开班日期", weight: 10, score: cs.length ? dated / cs.length : 0, todo: "为课程补充开班日期" },
    { label: "校区地址", weight: 10, score: org.campuses ? 1 : 0, todo: "填写校区地址与交通" },
    {
      label: "教师资质",
      weight: 20,
      score: teacherRatio,
      todo: org.teachersTotal
        ? `上传 ${org.teachersTotal - (org.teachersVerified ?? 0)} 位教师的资质证书`
        : "登记教师并上传资质证书",
    },
    {
      label: "机构相册",
      weight: 10,
      score: campusesWithPhotos,
      todo: `补充校区实拍照片（至少 8 张，当前 ${org.album?.length ?? 0} 张）`,
    },
    { label: "学员问答", weight: 10, score: org.qa ? 1 : 0, todo: "回复学员问答" },
  ];
}

export function completeness(org: Org) {
  const items = completenessItems(org);
  const pct = Math.round(items.reduce((s, i) => s + i.weight * i.score, 0));
  const todos = items.filter((i) => i.score < 1).sort((a, b) => b.weight * (1 - b.score) - a.weight * (1 - a.score));
  return { pct, todos };
}

const verificationRank = { verified: 0, claimed: 1, unclaimed: 2 } as const;

/** 自然排序：核验状态 → 信息完整度 → 已报读评价数。付费推广不参与 */
export const naturalOrder = (a: Org, b: Org) =>
  verificationRank[a.verification] - verificationRank[b.verification] ||
  completeness(b).pct - completeness(a).pct ||
  (b.rating?.count ?? 0) - (a.rating?.count ?? 0);
