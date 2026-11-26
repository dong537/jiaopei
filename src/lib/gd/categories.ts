/** 广东省教培机构名录用到的类别定义。纯常量，客户端组件也可安全引用。 */

export type GdCategory = {
  key: string;
  name: string;
  blurb: string;
};

/** 顺序即页面展示顺序：从最典型的校外培训排到兜底类别 */
export const gdCategories: GdCategory[] = [
  { key: "yishu", name: "艺术培训", blurb: "音乐、美术、舞蹈、书法、播音" },
  { key: "tiyu", name: "体育培训", blurb: "武术、游泳、球类、体适能" },
  { key: "xueke", name: "学科辅导", blurb: "语文、数学、英语、升学辅导" },
  { key: "keji", name: "科技培训", blurb: "编程、机器人、无人机、人工智能" },
  { key: "zhiye", name: "职业技能", blurb: "美容美发、厨师、电工、家政" },
  { key: "jiache", name: "驾驶培训", blurb: "机动车驾驶、驾校" },
  { key: "zaojiao", name: "早教托育", blurb: "早教、亲子、婴幼儿照护" },
  { key: "tuoguan", name: "课后托管", blurb: "课后托管、托辅" },
  { key: "yuyan", name: "语言培训", blurb: "雅思、托福、留学、小语种" },
  { key: "qiye", name: "企业培训", blurb: "管理、干部、企业内训" },
  { key: "qita", name: "其他培训", blurb: "经营范围涉培训的其他主体" },
];

export const gdCategoryMap = new Map(gdCategories.map((c) => [c.key, c]));

export const categoryName = (key: string) => gdCategoryMap.get(key)?.name ?? "其他培训";

/** 录入方式：core 进默认目录，broad 需显式切换才显示 */
export type GdScope = "core" | "broad" | "all";

export const gdScopeLabels: Record<GdScope, string> = {
  core: "核心教培",
  broad: "泛培训主体",
  all: "全部",
};

export function parseScope(v: string | string[] | undefined): GdScope {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "broad" || s === "all" ? s : "core";
}

/** 广东 21 个地市，slug 与 src/lib/generated/cities.json 一致 */
export const guangdongCities = [
  { slug: "guangzhou", name: "广州" },
  { slug: "shenzhen", name: "深圳" },
  { slug: "dongguan", name: "东莞" },
  { slug: "foshan", name: "佛山" },
  { slug: "zhuhai", name: "珠海" },
  { slug: "huizhou", name: "惠州" },
  { slug: "zhongshan", name: "中山" },
  { slug: "jiangmen", name: "江门" },
  { slug: "zhanjiang", name: "湛江" },
  { slug: "zhaoqing", name: "肇庆" },
  { slug: "meizhou", name: "梅州" },
  { slug: "qingyuan", name: "清远" },
  { slug: "maoming", name: "茂名" },
  { slug: "heyuan", name: "河源" },
  { slug: "shaoguan", name: "韶关" },
  { slug: "yangjiang", name: "阳江" },
  { slug: "shantou", name: "汕头" },
  { slug: "yunfu", name: "云浮" },
  { slug: "shanwei", name: "汕尾" },
  { slug: "jieyang", name: "揭阳" },
  { slug: "chaozhou", name: "潮州" },
];

export const gdCityMap = new Map(guangdongCities.map((c) => [c.slug, c]));
