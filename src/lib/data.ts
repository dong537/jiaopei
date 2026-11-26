// 示例数据：机构名称、价格、评分、统计数字均为演示用途。
// 上线后由数据库替换，页面、JSON-LD、llms.txt 和公开 API 都只从这里读取，保证同一个数字处处一致。
import { cityDirectory } from "./cities";
import type { CategoryGroup, City, Course, Org } from "./types";

export const cities: City[] = [
  { slug: "beijing", name: "北京" },
  { slug: "shanghai", name: "上海" },
  { slug: "guangzhou", name: "广州" },
  { slug: "shenzhen", name: "深圳" },
  { slug: "hangzhou", name: "杭州" },
  { slug: "chengdu", name: "成都" },
  { slug: "wuhan", name: "武汉" },
  { slug: "nanjing", name: "南京" },
  { slug: "xian", name: "西安" },
  { slug: "chongqing", name: "重庆" },
  { slug: "changsha", name: "长沙" },
  { slug: "zhengzhou", name: "郑州" },
];

export const defaultCity = "guangzhou";

export const categoryGroups: CategoryGroup[] = [
  { slug: "language", name: "语言留学", icon: "语", blurb: "雅思 · 托福 · 日语 · 韩语", subs: [
    { slug: "yasi", name: "雅思" }, { slug: "tuofu", name: "托福" }, { slug: "riyu", name: "日语" }, { slug: "hanyu", name: "韩语" },
    { slug: "fayu", name: "法语" }, { slug: "deyu", name: "德语" }, { slug: "pte", name: "PTE" }, { slug: "liuxue", name: "出国留学申请" } ] },
  { slug: "finance", name: "财会金融", icon: "财", blurb: "初级 · 中级会计 · CPA", subs: [
    { slug: "chuji-kuaiji", name: "初级会计" }, { slug: "zhongji-kuaiji", name: "中级会计" }, { slug: "cpa", name: "CPA" },
    { slug: "cma", name: "CMA" }, { slug: "acca", name: "ACCA" }, { slug: "shuiwushi", name: "税务师" }, { slug: "yinhang", name: "银行从业" } ] },
  { slug: "construction", name: "建筑工程", icon: "建", blurb: "一建 · 二建 · 造价 · 消防", subs: [
    { slug: "yijian", name: "一级建造师" }, { slug: "erjian", name: "二级建造师" }, { slug: "zaojia", name: "造价工程师" },
    { slug: "xiaofang", name: "消防工程师" }, { slug: "bim", name: "BIM" }, { slug: "jianli", name: "监理工程师" } ] },
  { slug: "medical", name: "医药卫生", icon: "医", blurb: "执业药师 · 护士 · 职称", subs: [
    { slug: "yaoshi", name: "执业药师" }, { slug: "hushi", name: "护士资格" }, { slug: "zhicheng", name: "初中级职称" },
    { slug: "kangfu", name: "康复理疗" }, { slug: "jiankang", name: "健康管理师" } ] },
  { slug: "civil", name: "公职考试", icon: "公", blurb: "公务员 · 事业单位 · 教招", subs: [
    { slug: "gongwuyuan", name: "公务员" }, { slug: "shiyedanwei", name: "事业单位" }, { slug: "jiaozhao", name: "教师招聘" },
    { slug: "junduiwenzhi", name: "军队文职" }, { slug: "xuandiao", name: "选调生" } ] },
  { slug: "degree", name: "学历提升", icon: "学", blurb: "成考 · 自考 · 开放大学", subs: [
    { slug: "chengkao", name: "成人高考" }, { slug: "zikao", name: "自学考试" }, { slug: "kaifang", name: "开放大学" },
    { slug: "zaizhi", name: "在职研究生" }, { slug: "kaoyan", name: "全日制考研" }, { slug: "mba", name: "MBA" } ] },
  { slug: "it-design", name: "IT 与设计", icon: "设", blurb: "UI · 平面 · Python · 剪辑", subs: [
    { slug: "ui", name: "UI 设计" }, { slug: "pingmian", name: "平面设计" }, { slug: "shinei", name: "室内设计" },
    { slug: "python", name: "Python" }, { slug: "qianduan", name: "前端开发" }, { slug: "shuju", name: "数据分析" }, { slug: "jianji", name: "短视频剪辑" } ] },
  { slug: "skills", name: "职业技能", icon: "技", blurb: "烘焙 · 美容 · 电工 · 汽修", subs: [
    { slug: "hongbei", name: "西点烘焙" }, { slug: "meirong", name: "美容美发" }, { slug: "diangong", name: "电工" },
    { slug: "hangong", name: "焊工" }, { slug: "qixiu", name: "汽修" }, { slug: "wurenji", name: "无人机" }, { slug: "dianshang", name: "电商运营" } ] },
  { slug: "arts", name: "兴趣艺术", icon: "艺", blurb: "钢琴 · 声乐 · 舞蹈 · 美术", subs: [
    { slug: "gangqin", name: "钢琴" }, { slug: "shengyue", name: "声乐" }, { slug: "wudao", name: "舞蹈" },
    { slug: "meishu", name: "美术" }, { slug: "shufa", name: "书法" }, { slug: "boyin", name: "播音主持" }, { slug: "sheying", name: "摄影" } ] },
  { slug: "quality", name: "素质教育", icon: "素", blurb: "编程 · 科学 · 体育 · 研学", subs: [
    { slug: "shaoer-biancheng", name: "少儿编程" }, { slug: "jiqiren", name: "机器人" }, { slug: "kexue", name: "科学实验" },
    { slug: "weiqi", name: "围棋" }, { slug: "tiyu", name: "体育培训" }, { slug: "yanxue", name: "研学营地" } ] },
];

export const totalCategoryGroups = 52;
export const totalSubCategories = 640;

export const platformStats = [
  { label: "收录机构", value: "13,412", note: "覆盖 312 个城市" },
  { label: "平台已核验", value: "2,186", note: "资质与官方登记已比对" },
  { label: "课程", value: "151,204", note: "含价格的 64%" },
  { label: "本月更新", value: "3,905", note: "机构或课程信息变更" },
];

/** 城市×类别的市场统计，由全量机构库计算；示例中只提供广州雅思 */
export const marketStats: Record<string, {
  orgCount: number;
  verifiedCount: number;
  medianPrice: number;
  typicalRange: [number, number];
  pricedCourses: number;
  topDistrict: { name: string; count: number };
  districts: { name: string; orgs: number; verified: number; median: number }[];
  bands: { label: string; courses: number }[];
  cityAvgRating: number;
}> = {
  "guangzhou/yasi": {
    orgCount: 186,
    verifiedCount: 41,
    medianPrice: 8800,
    typicalRange: [3800, 16800],
    pricedCourses: 412,
    topDistrict: { name: "天河区", count: 62 },
    districts: [
      { name: "天河区", orgs: 62, verified: 17, median: 9600 },
      { name: "越秀区", orgs: 38, verified: 9, median: 8200 },
      { name: "海珠区", orgs: 29, verified: 6, median: 7800 },
      { name: "番禺区", orgs: 24, verified: 4, median: 6900 },
      { name: "其他区", orgs: 33, verified: 5, median: 7200 },
    ],
    bands: [
      { label: "3,000 元以下", courses: 38 },
      { label: "3,000–6,000", courses: 96 },
      { label: "6,000–10,000", courses: 142 },
      { label: "10,000–15,000", courses: 89 },
      { label: "15,000 元以上", courses: 47 },
    ],
    cityAvgRating: 4.41,
  },
};

const govSource = "国家企业信用信息公示系统";

export const orgs: Org[] = [
  {
    id: "gz-waiyu",
    name: "广州示例外语学校",
    legalName: "广州示例外语培训有限公司",
    citySlug: "guangzhou",
    district: "天河区",
    area: "体育西",
    distanceKm: 1.2,
    founded: "2009-03-16",
    verification: "verified",
    verifiedAt: "2026-09-12",
    verifiedUntil: "2027-09-12",
    updatedAt: "2026-10-21",
    groupSlug: "language",
    categories: ["yasi", "tuofu", "riyu", "hanyu"],
    focus: "雅思 / 托福 / 小语种",
    campusCount: 4,
    rating: { avg: 4.72, count: 112, sub: { teaching: 4.8, result: 4.6, service: 4.7, env: 4.6 } },
    ratingHistogram: [86, 22, 3, 1, 0],
    priceFrom: 3800,
    priceText: "¥3,800 – 16,800",
    tags: ["0 元试听", "小班 6 人", "送教材", "可线上上课"],
    photo: { label: "校区实拍", tone: "#dce6f5" },
    teachersTotal: 18,
    teachersVerified: 11,
    enroll90d: 36,
    inquiries30d: 46,
    escrow: true,
    aiAssistant: true,
    info: [
      { label: "主体名称", value: "广州示例外语培训有限公司", source: govSource, checkedAt: "2026-09-12" },
      { label: "统一社会信用代码", value: "9144010[XXXXXXXXXXX]", source: govSource, checkedAt: "2026-09-12" },
      { label: "成立日期", value: "2009-03-16", source: govSource, checkedAt: "2026-09-12" },
      { label: "经营状态", value: "存续（在营）", source: govSource, checkedAt: "2026-10-21" },
      { label: "办学许可 / 备案", value: "非学科类校外培训机构备案 [编号]", source: "广州市教育局公示名单", checkedAt: "2026-09-12" },
      { label: "培训类别", value: "语言培训（雅思、托福、日语、韩语）", source: "机构填写 · 平台审核" },
      { label: "退费规则", value: "未上课时按比例退费，7 天内处理", source: "机构填写 · 平台审核" },
    ],
    campuses: [
      { name: "天河体育西校区", address: "天河区体育西路 [门牌号]", metro: "地铁 1/3 号线体育西路站 · 步行 5 分钟" },
      { name: "越秀北京路校区", address: "越秀区北京路 [门牌号]", metro: "地铁 6 号线北京路站" },
      { name: "海珠江南西校区", address: "海珠区江南西路 [门牌号]", metro: "地铁 2 号线江南西站" },
      { name: "番禺市桥校区", address: "番禺区市桥街 [门牌号]", metro: "地铁 3 号线市桥站" },
    ],
    teachers: [
      { name: "[教师姓名]", role: "雅思口语 · 教龄 9 年", cert: "TESOL 证书 · 已查验" },
      { name: "[教师姓名]", role: "雅思写作 · 教龄 6 年", cert: "英语专业八级 · 已查验" },
      { name: "[教师姓名]", role: "托福综合 · 教龄 7 年", cert: "教师资格证 · 已查验" },
    ],
    album: [
      { label: "门头", tone: "#dce6f5" }, { label: "前台", tone: "#e5e1f3" }, { label: "小班教室", tone: "#ddefe6" },
      { label: "自习室", tone: "#f5e6d8" }, { label: "口语一对一室", tone: "#dcEff3" }, { label: "模考考场", tone: "#f3e1e6" },
    ],
    offers: [
      { title: "免费试听", detail: "雅思小班任选 1 节试听课，含入学水平测试", validUntil: "长期有效" },
      {
        title: "早鸟价减 600 元",
        detail: "报名 2026-12-06 开班的雅思 6.5 分冲刺小班",
        validUntil: "2026-11-20 前",
        discount: { kind: "minus", amount: 600, courseId: "c-waiyu-65", sessionDate: "2026-12-06", deadline: "2026-11-20" },
      },
      {
        title: "老学员推荐 95 折",
        detail: "老学员推荐新学员报名，凭推荐码享 95 折（与早鸟价不叠加）",
        validUntil: "2026-12-31 前",
        discount: { kind: "rate", rate: 0.95, needsCode: true },
      },
    ],
    reviews: [
      { user: "陈**", course: "雅思 6.5 分冲刺小班", date: "2026-10-12", text: "小班确实只有 6 个人，口语每节课都有一对一纠音。考前两周加了 3 次模考。最终 7 分。", scores: { teaching: 5, result: 5, service: 5, env: 4 }, photos: 2 },
      { user: "林**", course: "雅思基础预备班", date: "2026-09-28", text: "课程安排合理，但周末班换过一次老师，衔接有点问题，后来机构补了 2 节课。", scores: { teaching: 4, result: 4, service: 4, env: 5 }, photos: 0 },
    ],
    qa: [
      { q: "可以先试听再付款吗？", a: "可以。每门小班课提供 1 节免费试听，通过本页预约即可。" },
      { q: "中途想退费怎么办？", a: "通过教培网付款的，在“我的订单”中申请，未上课时按比例退还，7 天内到账。" },
      { q: "有线上课吗？", a: "雅思一对一和托福课程支持线上直播，价格与线下相同。" },
    ],
    selfIntro: "[机构自行填写的介绍、办学理念、教学特色、获奖情况等。此区块内容由机构负责，平台只做合规审核，不做真实性担保。]",
  },
  {
    id: "gz-yasi-xueyuan", name: "广州示例雅思学院", legalName: "广州示例雅思教育咨询有限公司", citySlug: "guangzhou",
    district: "越秀区", area: "农讲所", distanceKm: 3.4, founded: "2016-05-20", verification: "verified", verifiedAt: "2026-08-03",
    verifiedUntil: "2027-08-03", updatedAt: "2026-10-18", groupSlug: "language", categories: ["yasi"], focus: "雅思", campusCount: 2,
    rating: { avg: 4.71, count: 88 }, priceFrom: 2880, priceText: "¥2,880 – 6,200", tags: ["0 元试听", "写作精批"],
    photo: { label: "教室环境", tone: "#e5e1f3" }, teachersTotal: 9, teachersVerified: 7, enroll90d: 24, inquiries30d: 31, escrow: true,
  },
  {
    id: "gz-yingyu-peixun", name: "广州示例英语培训中心", legalName: "广州示例英语培训中心有限公司", citySlug: "guangzhou",
    district: "番禺区", area: "市桥", distanceKm: 18.6, founded: "2007-04-02", verification: "verified", verifiedAt: "2026-07-21",
    verifiedUntil: "2027-07-21", updatedAt: "2026-10-15", groupSlug: "language", categories: ["yasi", "tuofu"], focus: "雅思 / 托福 / 成人英语",
    campusCount: 3, rating: { avg: 4.65, count: 131 }, priceFrom: 6800, priceText: "¥6,800 – 13,500", tags: ["周末班", "分级测试"],
    photo: { label: "校区实拍", tone: "#ddefe6" }, teachersTotal: 30, teachersVerified: 24, enroll90d: 31, inquiries30d: 39, escrow: true,
  },
  {
    id: "gz-guoji-yingyu", name: "广州示例国际英语中心", legalName: "广州示例国际英语培训有限公司", citySlug: "guangzhou",
    district: "越秀区", area: "北京路", distanceKm: 4.1, founded: "2014-09-01", verification: "verified", verifiedAt: "2026-09-02",
    verifiedUntil: "2027-09-02", updatedAt: "2026-10-19", groupSlug: "language", categories: ["yasi"], focus: "雅思 / 留学英语",
    campusCount: 2, rating: { avg: 4.69, count: 64 }, priceFrom: 5280, priceText: "¥5,280 – 14,800", tags: ["0 元试听", "分级测试", "周末班"],
    promoted: true, photo: { label: "教室环境", tone: "#e5e1f3" }, teachersTotal: 12, teachersVerified: 9, enroll90d: 52, inquiries30d: 58, escrow: true,
  },
  {
    id: "gz-liuxue-yuyan", name: "广州示例留学语言学校", legalName: "广州示例留学语言培训有限公司", citySlug: "guangzhou",
    district: "海珠区", area: "客村", distanceKm: 6.2, founded: "2018-03-12", verification: "verified", verifiedAt: "2026-06-30",
    verifiedUntil: "2027-06-30", updatedAt: "2026-10-09", groupSlug: "language", categories: ["yasi"], focus: "雅思 / 口语",
    campusCount: 1, rating: { avg: 4.68, count: 46 }, priceFrom: 3960, priceText: "¥3,960 – 9,200", tags: ["小班 6 人", "口语专项"],
    photo: { label: "教室环境", tone: "#dcEff3" }, teachersTotal: 6, teachersVerified: 5, enroll90d: 15, inquiries30d: 22, escrow: true,
  },
  {
    id: "gz-yingyu-gongzuoshi", name: "广州示例英语工作室", legalName: "广州示例英语文化传播有限公司", citySlug: "guangzhou",
    district: "海珠区", area: "江南西", distanceKm: 5.0, founded: "2021-07-08", verification: "claimed", updatedAt: "2026-10-02",
    groupSlug: "language", categories: ["yasi"], focus: "雅思一对一", campusCount: 1, rating: null,
    priceFrom: 6800, priceText: "¥6,800 – 12,000", tags: ["一对一", "可线上上课"], photo: { label: "机构上传照片", tone: "#e2e8f0" },
  },
  {
    id: "gz-yuyan-peixun", name: "广州示例语言培训有限公司", legalName: "广州示例语言培训有限公司", citySlug: "guangzhou",
    district: "番禺区", area: "市桥", founded: "2019-11-26", verification: "unclaimed", updatedAt: "2026-09-30", groupSlug: "language",
    categories: ["yasi"], focus: "经营范围含语言培训", campusCount: 1, rating: null, priceText: "价格未公开", tags: [],
    photo: { label: "暂无机构照片", tone: "#f1f5f9" },
  },
  {
    id: "gz-sheji", name: "广州示例设计培训中心", legalName: "广州示例设计培训有限公司", citySlug: "guangzhou", district: "天河区",
    area: "岗顶", distanceKm: 2.1, founded: "2012-06-18", verification: "verified", verifiedAt: "2026-08-15", verifiedUntil: "2027-08-15",
    updatedAt: "2026-10-20", groupSlug: "it-design", categories: ["ui", "pingmian", "shinei"], focus: "UI / 平面 / 室内设计", campusCount: 2,
    rating: { avg: 4.6, count: 86 }, priceFrom: 5200, priceText: "¥5,200 – 19,800", tags: ["就业指导", "作品集辅导"], promoted: true,
    photo: { label: "教室环境", tone: "#e5e1f3" }, escrow: true,
  },
  {
    id: "gz-caihui", name: "广州示例财会学校", legalName: "广州示例财会培训有限公司", citySlug: "guangzhou", district: "天河区",
    area: "珠江新城", distanceKm: 2.8, founded: "2010-02-09", verification: "verified", verifiedAt: "2026-09-20", verifiedUntil: "2027-09-20",
    updatedAt: "2026-10-22", groupSlug: "finance", categories: ["chuji-kuaiji", "zhongji-kuaiji"], focus: "初级 / 中级会计", campusCount: 3,
    rating: { avg: 4.8, count: 203 }, priceFrom: 980, priceText: "¥980 – 6,800", tags: ["不过免费重读", "送题库"],
    photo: { label: "门头照片", tone: "#ddefe6" }, escrow: true,
  },
  {
    id: "gz-hongbei", name: "广州示例烘焙学校", legalName: "广州示例烘焙职业培训学校", citySlug: "guangzhou", district: "天河区",
    area: "车陂", distanceKm: 4.5, founded: "2013-10-30", verification: "verified", verifiedAt: "2026-07-08", verifiedUntil: "2027-07-08",
    updatedAt: "2026-10-11", groupSlug: "skills", categories: ["hongbei"], focus: "西点 / 蛋糕 / 面包", campusCount: 1,
    rating: { avg: 4.7, count: 64 }, priceFrom: 2680, priceText: "¥2,680 – 26,800", tags: ["实操为主", "创业指导"],
    photo: { label: "实操课堂", tone: "#f5e6d8" }, escrow: true,
  },
  {
    id: "gz-xueli", name: "广州示例学历教育中心", legalName: "广州示例教育科技有限公司", citySlug: "guangzhou", district: "天河区",
    area: "天河北", distanceKm: 1.9, founded: "2015-04-14", verification: "claimed", updatedAt: "2026-10-05", groupSlug: "degree",
    categories: ["chengkao", "zikao"], focus: "成人本科 / 自考", campusCount: 1, rating: null, priceFrom: 4500,
    priceText: "¥4,500 – 12,800", tags: ["报考指导"], photo: { label: "校区实拍", tone: "#e2e8f0" },
  },
  {
    id: "gz-gangqin", name: "广州示例钢琴艺术中心", legalName: "广州示例艺术培训有限公司", citySlug: "guangzhou", district: "天河区",
    area: "天河南", distanceKm: 1.4, founded: "2011-08-22", verification: "verified", verifiedAt: "2026-08-28", verifiedUntil: "2027-08-28",
    updatedAt: "2026-10-16", groupSlug: "arts", categories: ["gangqin", "shengyue"], focus: "钢琴 / 声乐", campusCount: 1,
    rating: { avg: 4.9, count: 58 }, priceFrom: 180, priceText: "¥180 / 课时起", tags: ["一对一", "成人零基础"],
    photo: { label: "琴房照片", tone: "#f3e1e6" }, escrow: true,
  },
  {
    id: "gz-biancheng", name: "广州示例编程学院", legalName: "广州示例信息技术培训有限公司", citySlug: "guangzhou", district: "天河区",
    area: "五山", distanceKm: 3.6, founded: "2017-01-05", verification: "verified", verifiedAt: "2026-09-08", verifiedUntil: "2027-09-08",
    updatedAt: "2026-10-23", groupSlug: "it-design", categories: ["python", "qianduan", "shuju"], focus: "Python / 前端 / 数据分析",
    campusCount: 1, rating: { avg: 4.6, count: 77 }, priceFrom: 6800, priceText: "¥6,800 – 21,800", tags: ["项目实战", "就业指导"],
    photo: { label: "机房环境", tone: "#dcEff3" }, escrow: true,
  },
  {
    id: "gz-rihan", name: "广州示例日韩语学校", legalName: "广州示例日韩语培训有限公司", citySlug: "guangzhou", district: "天河区",
    area: "石牌桥", distanceKm: 2.3, founded: "2013-05-17", verification: "claimed", updatedAt: "2026-10-12", groupSlug: "language",
    categories: ["riyu", "hanyu"], focus: "日语 / 韩语", campusCount: 1, rating: null, priceFrom: 2980,
    priceText: "¥2,980 – 9,800", tags: ["0 元试听", "小班"], photo: { label: "教室环境", tone: "#dce6f5" },
  },
];

const ieltsFaq = [
  { q: "没达到 6.5 分可以重读吗？", a: "机构承诺：完成全部课时并参加 4 次模考，首考未达 6.5 分可免费重读一期。承诺内容写入报名合同。" },
  { q: "可以开发票吗？", a: "学费发票由机构开具，报名后在“我的订单”中申请。" },
  { q: "错过一节课怎么办？", a: "可预约同进度的其他班级补课，或观看课堂录播。" },
];

export const courses: Course[] = [
  {
    id: "c-waiyu-65", orgId: "gz-waiyu", name: "雅思 6.5 分冲刺小班", categorySlug: "yasi", classType: "small", classLabel: "小班，最多 6 人",
    hours: 80, price: 8800, nextStart: "2026-11-08",
    summary: "面向雅思 5.5 分左右、目标 6.5 分的学员。6 人小班，共 80 课时（约 10 周），学费 8,800 元，含教材和 4 次全真模考。",
    facts: [
      { label: "课时", value: "80 课时 · 每课时 45 分钟 · 约 10 周" },
      { label: "上课时间", value: "周六、周日 9:30–12:00 与 14:00–16:30" },
      { label: "上课地点", value: "天河体育西校区（地铁体育西路站）" },
      { label: "适合人群", value: "雅思 5–5.5 分，目标 6.5 分" },
      { label: "教师", value: "主讲 2 人，资质已查验" },
      { label: "退费规则", value: "开课前全额退；开课后按未上课时比例退" },
      { label: "学科类别", value: "非学科类（语言培训）" },
    ],
    schedule: [
      { title: "第 1–2 周 · 入学测评与基础", detail: "全真模考定级，听力与阅读题型拆解。" },
      { title: "第 3–6 周 · 分项提升", detail: "写作 Task 1/2 模板与批改，口语 Part 1–3 话题库。" },
      { title: "第 7–9 周 · 强化训练", detail: "每周 1 次模考，错题复盘。" },
      { title: "第 10 周 · 考前冲刺", detail: "口语一对一模拟、写作终稿精批。" },
    ],
    sessions: [
      { date: "2026-11-08 开班（周末班）", left: "剩 2 个名额", urgent: true },
      { date: "2026-12-06 开班（周末班）", left: "剩 6 个名额" },
      { date: "2027-01-10 开班（寒假集训）", left: "预约中" },
    ],
    dealPrice: { min: 8200, max: 8800, orders: 23 },
    rating: { avg: 4.8, count: 37 },
    faqs: ieltsFaq,
    trialVideo: { title: "写作 Task 2 试听片段", duration: "08:30" },
  },
  { id: "c-waiyu-base", orgId: "gz-waiyu", name: "雅思基础预备班", categorySlug: "yasi", classType: "small", classLabel: "小班 8 人", hours: 48, price: 3800, nextStart: "2026-11-15" },
  { id: "c-waiyu-1v1", orgId: "gz-waiyu", name: "雅思 7 分精品一对一", categorySlug: "yasi", classType: "one", classLabel: "一对一", hours: 60, price: 16800, nextStart: "随报随学" },
  { id: "c-waiyu-toefl", orgId: "gz-waiyu", name: "托福 100 分冲刺班", categorySlug: "tuofu", classType: "small", classLabel: "小班 6 人", hours: 90, price: 12600, nextStart: "2026-11-22" },
  { id: "c-xueyuan-65", orgId: "gz-yasi-xueyuan", name: "雅思 6.5 精品小班", categorySlug: "yasi", classType: "small", classLabel: "小班 6 人", hours: 72, price: 6200, nextStart: "2026-11-09", trialVideo: { title: "听力 Section 3 试听片段", duration: "06:12" } },
  { id: "c-xueyuan-w", orgId: "gz-yasi-xueyuan", name: "雅思写作专项小班", categorySlug: "yasi", classType: "small", classLabel: "小班 8 人", hours: 32, price: 2880, nextStart: "2026-11-16" },
  { id: "c-liuxue-6", orgId: "gz-liuxue-yuyan", name: "雅思强化 6 人班", categorySlug: "yasi", classType: "small", classLabel: "小班 6 人", hours: 96, price: 9200, nextStart: "2026-11-10" },
  { id: "c-liuxue-oral", orgId: "gz-liuxue-yuyan", name: "雅思口语小班", categorySlug: "yasi", classType: "small", classLabel: "小班 6 人", hours: 40, price: 3960, nextStart: "2026-11-17" },
  { id: "c-peixun-week", orgId: "gz-yingyu-peixun", name: "雅思周末提分班", categorySlug: "yasi", classType: "small", classLabel: "小班 8 人", hours: 64, price: 6800, nextStart: "2026-11-08" },
  { id: "c-peixun-65", orgId: "gz-yingyu-peixun", name: "雅思 6.5 冲刺小班", categorySlug: "yasi", classType: "small", classLabel: "小班 6 人", hours: 80, price: 8000, nextStart: "2026-11-22" },
  { id: "c-guoji-65", orgId: "gz-guoji-yingyu", name: "雅思 6.5 精品小班", categorySlug: "yasi", classType: "small", classLabel: "小班 6 人", hours: 72, price: 9600, nextStart: "2026-11-15" },
  { id: "c-guoji-base", orgId: "gz-guoji-yingyu", name: "雅思基础班", categorySlug: "yasi", classType: "small", classLabel: "小班 8 人", hours: 48, price: 5280, nextStart: "2026-11-29" },
];

export const upcomingExams = [
  { date: "2026-11-01", name: "2027 年度初级会计职称考试", org: "财政部会计财务评价中心", status: "报名未开始", tone: "neutral" as const, href: "/city/guangzhou/chuji-kuaiji" },
  { date: "2026-11-05", name: "2026 年下半年中小学教师资格面试", org: "教育部教育考试院", status: "报名中", tone: "open" as const, href: undefined },
  { date: "2026-11-14", name: "雅思机考（广州考点）", org: "英国文化教育协会 / 教育部教育考试院", status: "报名中", tone: "open" as const, href: "/exam/ielts" },
  { date: "2026-11-30", name: "2026 年成人高考成绩查询", org: "广东省教育考试院", status: "即将开始", tone: "soon" as const, href: "/city/guangzhou/chengkao" },
];

export const policies = [
  { title: "关于进一步规范校外培训机构预收费资金监管的通知", org: "广州市教育局", date: "2026-10-18", slug: "gz-prepaid-escrow-2026", liveId: "live-1112" },
  { title: "职业技能等级认定工作规程（2026 年修订）解读", org: "人力资源社会保障部", date: "2026-10-09", slug: "skill-certification-rules-2026" },
  { title: "非学科类校外培训机构设置标准（广东省）", org: "广东省教育厅", date: "2026-09-26", slug: "gd-nonacademic-standard" },
];

export const enrollFeed = [
  { ago: "3 分钟前", user: "吴**", course: "雅思 6.5 分冲刺小班", org: "广州示例外语学校", href: "/course/c-waiyu-65" },
  { ago: "12 分钟前", user: "林**", course: "初级会计全科班", org: "广州示例财会学校", href: "/org/gz-caihui" },
  { ago: "26 分钟前", user: "黄**", course: "UI 设计就业班", org: "广州示例设计培训中心", href: "/org/gz-sheji" },
  { ago: "41 分钟前", user: "张**", course: "西点烘焙创业班", org: "广州示例烘焙学校", href: "/org/gz-hongbei" },
  { ago: "1 小时前", user: "王**", course: "成人钢琴一对一", org: "广州示例钢琴艺术中心", href: "/org/gz-gangqin" },
];

export const homeFaqs = [
  { q: "教培网上的机构信息从哪里来？", a: "基础信息来自国家企业信用信息公示系统和各地教育部门公布的机构名单；课程和价格由机构认领后自行填写，并由平台审核。每条信息都标注来源和更新日期。" },
  { q: "“平台已核验”是什么意思？", a: "表示平台已比对该机构的营业执照、办学许可或备案信息与官方登记一致，核验有效期 12 个月。核验不代表对教学质量的担保。" },
  { q: "在教培网报名付款安全吗？", a: "学费由持牌支付机构存管，按课时或阶段结算给机构；未上课部分可按退款政策申请退还。" },
];

export const categoryFaqs: Record<string, { q: string; a: string }[]> = {
  "guangzhou/yasi": [
    { q: "广州雅思培训一般多少钱？", a: "按教培网 2026 年 10 月收录的 412 门标价课程，学费中位数为 8,800 元，多数在 3,800–16,800 元之间。一对一课程通常按课时计价，高于小班。" },
    { q: "怎么判断雅思培训机构是否正规？", a: "查看机构是否有营业执照、经营范围是否包含培训，以及是否在当地教育或人社部门登记。教培网的“平台已核验”标签表示这些信息已与官方登记比对一致。" },
    { q: "预付的培训费可以退吗？", a: "通过教培网付款的课程，学费由持牌支付机构存管、按课时结算，未上课部分可按退款政策申请退还。线下直接付款给机构的，按双方合同处理。" },
    { q: "线上雅思课和线下课怎么选？", a: "时间不固定的学员适合线上课；口语和写作需要高频反馈的，线下小班或一对一更合适。" },
  ],
};

// ---------- 查询函数 ----------

export const getCity = (slug: string) => cityDirectory.find((c) => c.slug === slug);
export const getOrg = (id: string) => orgs.find((o) => o.id === id);
export const getCourse = (id: string) => courses.find((c) => c.id === id);
export const coursesOf = (orgId: string) => courses.filter((c) => c.orgId === orgId);

export function getCategory(slug: string) {
  for (const g of categoryGroups) {
    const sub = g.subs.find((s) => s.slug === slug);
    if (sub) return { group: g, category: sub };
  }
  return undefined;
}

export const orgsIn = (citySlug: string, categorySlug?: string) =>
  orgs.filter((o) => o.citySlug === citySlug && (!categorySlug || o.categories.includes(categorySlug)));

export const yearsSince = (date: string, asOf = "2026-10-26") => {
  const a = new Date(asOf);
  const d = new Date(date);
  let y = a.getFullYear() - d.getFullYear();
  if (a.getMonth() < d.getMonth() || (a.getMonth() === d.getMonth() && a.getDate() < d.getDate())) y -= 1;
  return y;
};

export const fmtPrice = (n: number) => `¥${n.toLocaleString("en-US")}`;

/** 各城市收录机构总数（示例中只有广州有机构明细） */
export const cityOrgCounts: Record<string, number> = { guangzhou: 3286 };

export const hotSearches = [
  { label: "雅思培训", href: "/city/guangzhou/yasi" },
  { label: "初级会计", href: "/city/guangzhou/chuji-kuaiji" },
  { label: "UI 设计", href: "/city/guangzhou/ui" },
  { label: "成人本科", href: "/city/guangzhou/chengkao" },
  { label: "西点烘焙", href: "/city/guangzhou/hongbei" },
  { label: "钢琴", href: "/city/guangzhou/gangqin" },
];

/** 同一个城市×类别下有机构的组合，用于静态生成与 sitemap */
export function cityCategoryPairs() {
  const set = new Set<string>();
  for (const o of orgs) for (const c of o.categories) set.add(`${o.citySlug}/${c}`);
  return [...set].map((k) => {
    const [city, category] = k.split("/");
    return { city, category };
  });
}
