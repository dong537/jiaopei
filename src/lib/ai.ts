// AI 营销：机构主页知识数据、AI 可见度监测样例、内容助手草稿模板。
import type { AssistantKnowledge } from "./assistant";
import { coursesOf } from "./data";
import { sessionOpen } from "./pricing";
import type { Org } from "./types";

/** AI 咨询助手可用的全部知识：只取本页已发布、已审核的数据 */
export function knowledgeOf(org: Org): AssistantKnowledge {
  const refund = org.info?.find((f) => f.label === "退费规则")?.value;
  return {
    orgName: org.name,
    verification:
      org.verification === "verified"
        ? `${org.name}的营业执照和办学备案已由教培网与官方登记比对一致（核验于 ${org.verifiedAt}，有效至 ${org.verifiedUntil}）。核验说明资质真实，不代表对教学效果的担保。`
        : "该机构资质尚未完成平台核验，暂不支持在线报名和担保付款。",
    courses: coursesOf(org.id).map((c) => ({
      name: c.name,
      price: c.price,
      hours: c.hours,
      classLabel: c.classLabel,
      open: (c.sessions ?? []).map((s) => `${s.date.split(" ")[0]} ${sessionOpen(s) ? s.left : "预约中"}`).concat(c.sessions ? [] : /^\d{4}/.test(c.nextStart) ? [`${c.nextStart} 开班`] : c.nextStart ? [c.nextStart] : []),
      deal: c.dealPrice ? `近期 ${c.dealPrice.orders} 单成交价 ¥${c.dealPrice.min.toLocaleString("en-US")}–${c.dealPrice.max.toLocaleString("en-US")}` : undefined,
    })),
    campuses: (org.campuses ?? []).map((c) => ({ name: c.name, metro: c.metro })),
    refund: refund ? `退费规则：${refund}。` : undefined,
    trial: org.offers?.find((o) => o.title.includes("试听")) ? `可以免费试听：${org.offers.find((o) => o.title.includes("试听"))!.detail}。在本页“预约免费试听”提交即可。` : undefined,
    offers: (org.offers ?? []).filter((o) => !o.title.includes("试听")).map((o) => `${o.title}（${o.detail}，${o.validUntil}）`),
    teachers: org.teachersTotal ? `机构登记教师 ${org.teachersTotal} 人，其中 ${org.teachersVerified} 人的资质证书已经平台查验。${(org.teachers ?? []).map((t) => `${t.role}（${t.cert}）`).join("；")}` : undefined,
    qa: org.qa ?? [],
  };
}

// ---------- AI 可见度监测（样例数据） ----------

export const aiProducts = ["豆包", "DeepSeek", "文心一言", "Kimi", "腾讯元宝"] as const;

/** org：回答中引用了机构主页；site：引用了教培网其他页面但没提到本机构；none：未引用教培网 */
export type Cell = "org" | "site" | "none";

export const visibility: { q: string; cells: Cell[] }[] = [
  { q: "广州雅思培训机构哪家靠谱", cells: ["org", "site", "org", "site", "org"] },
  { q: "天河区雅思小班多少钱", cells: ["org", "org", "site", "org", "org"] },
  { q: "广州雅思 6.5 冲刺班推荐", cells: ["org", "site", "none", "site", "org"] },
  { q: "体育西附近雅思培训", cells: ["org", "org", "org", "none", "site"] },
  { q: "广州托福培训班价格", cells: ["site", "none", "site", "org", "site"] },
  { q: "广州雅思一对一多少钱一小时", cells: ["site", "org", "none", "none", "site"] },
  { q: "雅思培训中途退费怎么办", cells: ["site", "site", "site", "site", "org"] },
  { q: "广州示例外语学校怎么样", cells: ["org", "org", "org", "site", "org"] },
];

export const visibilityTrend = [
  ["7 月", 6],
  ["8 月", 9],
  ["9 月", 13],
  ["10 月", 17],
] as const;

export const visibilityAsOf = "2026-10-20";

/** AI 助手和搜索里常被问、但主页还没有答案的问题（来自 AI 咨询助手转人工记录与搜索词） */
export const unansweredQuestions = [
  {
    q: "雅思 5 分可以直接报 6.5 分冲刺班吗？",
    draft: (org: Org) =>
      `建议先做入学水平测试再决定。${org.name}的雅思 6.5 分冲刺小班面向 5–5.5 分的学员；测试低于 5 分的，老师会建议先上雅思基础预备班（48 课时，¥3,800）。入学测试可以在预约试听时一起做，[请填写：测试时长和形式]。`,
  },
  {
    q: "周末班一天上几个小时？",
    draft: () => `周末班每周六、周日上课，上午 9:30–12:00、下午 14:00–16:30，每天约 5 小时（6 课时，每课时 45 分钟）。[请填写：是否可以只上半天]。`,
  },
  {
    q: "学费可以分期吗？",
    draft: () =>
      `通过教培网报名，可以先付 500 元定金锁定名额，开班前付清尾款；学费由持牌支付机构存管，按课时分 4 次结算给机构。[请填写：是否支持信用卡或花呗分期，以及是否收手续费]。`,
  },
  {
    q: "考不到目标分数可以免费重读吗？",
    draft: () =>
      `[请填写：重读政策，例如“结课后 6 个月内考试未达到入学时约定的目标分，可免费重读同一课程 1 次，需提供成绩单和出勤记录”]。重读属于服务约定，不代表对考试结果的承诺。`,
  },
];

