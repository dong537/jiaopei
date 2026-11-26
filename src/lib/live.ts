// 公益直播课：编辑部和已核验机构供稿，免费观看，直播中不允许收款和承诺效果。
// 直播本身放在视频号等有资质的第三方平台，教培网只做预告、提醒和回放索引。
import { getOrg } from "./data";
import type { Photo } from "./types";

export type LiveClass = {
  id: string;
  title: string;
  start: string;
  minutes: number;
  host: string;
  /** editorial：编辑部；org：机构供稿（标注“品牌内容”） */
  by: "editorial" | "org";
  orgId?: string;
  summary: string;
  platform: string;
  replay?: boolean;
};

export const liveClasses: LiveClass[] = [
  {
    id: "live-1101",
    title: "2026 年雅思机考与纸笔考怎么选",
    start: "2026-11-01 19:30",
    minutes: 45,
    host: "教培网编辑部 · [主讲人姓名]",
    by: "editorial",
    summary: "两种考试形式的报名费、出分时间、考场差异，以及适合哪些考生。资料来源：雅思官方网站。",
    platform: "视频号「教培网」",
  },
  {
    id: "live-1105",
    title: "雅思口语 Part 2 备考：话题怎么准备",
    start: "2026-11-05 20:00",
    minutes: 60,
    host: "广州示例外语学校 · [教师姓名]（TESOL 证书 · 已查验）",
    by: "org",
    orgId: "gz-waiyu",
    summary: "常见话题分类、答题结构、现场演示与点评。机构供稿，内容经编辑审核。",
    platform: "视频号「教培网」",
  },
  {
    id: "live-1112",
    title: "预付费培训怎么避坑：合同、退费与资金监管",
    start: "2026-11-12 19:30",
    minutes: 45,
    host: "教培网编辑部 · [审校律师姓名]",
    by: "editorial",
    summary: "看懂培训合同示范文本、退费条款，以及当地预收费监管政策。引用条文均附原文链接。",
    platform: "视频号「教培网」",
  },
  {
    id: "live-1020",
    title: "广州雅思培训机构怎么挑：看资质、看价格、看评价",
    start: "2026-10-20 19:30",
    minutes: 40,
    host: "教培网编辑部",
    by: "editorial",
    summary: "用教培网的核验状态、成交价区间和已报读评价挑机构。",
    platform: "视频号「教培网」",
    replay: true,
  },
];

/** 直播封面位：机构供稿用机构图片底色，编辑部场次按顺序轮换底色 */
const editorialTones = ["#dce6f5", "#f5e6d8", "#ddefe6", "#e5e1f3"];
export const liveCover = (l: LiveClass, label = "直播封面"): Photo => ({
  label,
  tone: (l.orgId && getOrg(l.orgId)?.photo.tone) || editorialTones[Math.max(0, liveClasses.findIndex((x) => x.id === l.id)) % editorialTones.length],
});

export const getLive = (id: string) => liveClasses.find((l) => l.id === id);
