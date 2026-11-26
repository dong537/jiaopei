// 考试百科与选课指南的示例内容。上线后来自内容管理后台，作者、审校、更正记录都是必填字段。

export type Exam = {
  slug: string;
  name: string;
  title: string;
  categorySlug: string;
  groupName: string;
  editor: string;
  reviewer: string;
  published: string;
  updated: string;
  definition: string;
  facts: { label: string; value: string; source: string }[];
  steps: string[];
  scoring: string;
  bands: { score: string; level: string; usage: string }[];
  changes: { date: string; text: string }[];
  prep: { from: string; weeks: string; cost: string }[];
  dates: { date: string; status: string; tight?: boolean }[];
  faqs: { q: string; a: string }[];
  references: { title: string; accessed: string }[];
  corrections: string;
};

export const exams: Exam[] = [
  {
    slug: "ielts",
    name: "雅思（IELTS）",
    title: "雅思（IELTS）考试：报名条件、费用、考试时间与评分",
    categorySlug: "yasi",
    groupName: "语言考试",
    editor: "[姓名]（[职务/资质]）",
    reviewer: "[姓名]",
    published: "2025-03-02",
    updated: "2026-10-20",
    definition:
      "雅思是由英国文化教育协会、IDP 和剑桥大学英语考评部共同主办的国际英语水平考试，分学术类和培训类，满分 9 分。在中国大陆由教育部教育考试院承办，报名费 [费用] 元，成绩通常 2 年内有效。",
    facts: [
      { label: "主办方", value: "英国文化教育协会、IDP、剑桥大学英语考评部", source: "IELTS 官方网站" },
      { label: "中国大陆承办", value: "教育部教育考试院", source: "教育部教育考试院" },
      { label: "考试类别", value: "学术类、培训类；另有用于签证的 UKVI 考试", source: "IELTS 官方网站" },
      { label: "考试形式", value: "纸笔考试、机考", source: "教育部教育考试院" },
      { label: "报名费", value: "[费用] 元（以官网为准）", source: "教育部教育考试院" },
      { label: "考试频率", value: "机考每周多场，纸笔考每月 [N] 场左右", source: "教育部教育考试院" },
      { label: "成绩有效期", value: "一般为 2 年，以接收院校要求为准", source: "英国文化教育协会" },
      { label: "报名网址", value: "[官方报名网址]", source: "教育部教育考试院" },
    ],
    steps: [
      "在教育部教育考试院雅思报名网站注册账号，实名认证。",
      "选择考试类型（学术类 / 培训类）、考试形式（纸笔 / 机考）和考点。",
      "选择考试日期，在线支付报名费。",
      "考前约 [N] 天打印准考证，按时到考点参加笔试和口试。",
      "机考约 [N] 天、纸笔考约 [N] 天后在线查询成绩。",
    ],
    scoring: "听力、阅读、写作、口语四项各按 1–9 分计分，总分为四项平均分，按 0.5 分进位。",
    bands: [
      { score: "7.5–9", level: "熟练至专家", usage: "顶尖院校研究生、医学类专业" },
      { score: "6.5–7", level: "良好", usage: "多数英国、澳洲院校研究生" },
      { score: "5.5–6", level: "合格", usage: "本科、语言班、部分移民类别" },
      { score: "4–5", level: "有限", usage: "培训类、语言预科" },
    ],
    changes: [
      { date: "2026-09", text: "[官方公布的考试政策调整，附原文链接]" },
      { date: "2026-03", text: "[考点或考位调整]" },
      { date: "2025-11", text: "[报名费或成绩发布时间调整]" },
    ],
    prep: [
      { from: "5.0 → 6.0", weeks: "[N]", cost: "[X]" },
      { from: "5.5 → 6.5", weeks: "[N]", cost: "[X]" },
      { from: "6.0 → 7.0", weeks: "[N]", cost: "[X]" },
    ],
    dates: [
      { date: "2026-11-14（机考）", status: "可报名" },
      { date: "2026-11-21（纸笔）", status: "可报名" },
      { date: "2026-12-05（机考）", status: "名额紧张", tight: true },
    ],
    faqs: [
      { q: "雅思机考和纸笔考哪个更好？", a: "两者题目、难度和评分标准相同，机考出分更快、场次更多。打字慢的考生可选纸笔考。" },
      { q: "雅思成绩多久可以重考？", a: "没有次数和间隔限制，可随时报名下一场考试。" },
      { q: "雅思和托福怎么选？", a: "英国、澳洲、新西兰方向多选雅思，美国方向两者都可，以目标院校要求为准。" },
    ],
    references: [
      { title: "教育部教育考试院 · 雅思考试报名网站", accessed: "2026-10-20" },
      { title: "IELTS 官方网站 · 考试形式与评分说明", accessed: "2026-10-20" },
      { title: "英国文化教育协会 · 成绩单说明", accessed: "2026-10-20" },
    ],
    corrections: "2026-10-20 更新报名费金额；2026-06-11 补充机考成绩发布时间。",
  },
];

export const getExam = (slug: string) => exams.find((e) => e.slug === slug);

export type Guide = {
  slug: string;
  section: string;
  topic: string;
  title: string;
  author: string;
  authorBio: string;
  reviewer: string;
  published: string;
  updated: string;
  keyPoints: string[];
  references: string[];
  corrections: string;
};

export const guides: Guide[] = [
  {
    slug: "how-to-verify-training-institution",
    section: "选课指南",
    topic: "机构资质",
    title: "如何判断一家培训机构是否正规：报名前的 5 个核对项",
    author: "[作者姓名]",
    authorBio: "教培网编辑，[从业经历与资质，例如：8 年教育行业记者，曾任某机构教务主管]。",
    reviewer: "[姓名]（[律师 / 行业资质]）",
    published: "2026-05-14",
    updated: "2026-10-15",
    keyPoints: [
      "先查营业执照：经营状态为“存续”，经营范围包含相应培训项目。",
      "再查办学资质：非学科类机构应在当地教育或人社部门登记备案。",
      "看收费方式：单次预收费超过 3 个月或 60 课时的，要格外谨慎。",
      "签书面合同，写清退费规则。",
      "查投诉与处罚记录：信用中国和当地教育局公示。",
    ],
    references: [
      "国家企业信用信息公示系统",
      "教育部等部门《关于加强校外培训机构预收费监管工作的通知》",
      "全国校外教育培训监管与服务综合平台",
      "广州市教育局 · 校外培训机构公示名单",
    ],
    corrections: "2026-10-15 根据广州市新规更新第 3 节。",
  },
];

export const getGuide = (slug: string) => guides.find((g) => g.slug === slug);
