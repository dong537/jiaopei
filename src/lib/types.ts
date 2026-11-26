export type Verification = "verified" | "claimed" | "unclaimed";

/** 一条带来源的事实：页面表格、JSON-LD 和公开 API 都从这里取值 */
export type SourcedFact = {
  label: string;
  value: string;
  source: string;
  checkedAt?: string;
};

export type City = { slug: string; name: string };

export type Category = { slug: string; name: string };

export type CategoryGroup = {
  slug: string;
  name: string;
  icon: string;
  blurb: string;
  subs: Category[];
};

export type Photo = { label: string; tone: string; src?: string };

export type Review = {
  user: string;
  course: string;
  date: string;
  text: string;
  scores: { teaching: number; result: number; service: number; env: number };
  photos: number;
};

/** 优惠：discount 有值时在报名结算页自动计算，没有值的只做展示（如免费试听） */
export type Offer = {
  title: string;
  detail: string;
  validUntil: string;
  discount?: { kind: "minus"; amount: number; courseId: string; sessionDate: string; deadline: string } | { kind: "rate"; rate: number; needsCode: true };
};

export type QA = { q: string; a: string };

export type Org = {
  id: string;
  name: string;
  legalName: string;
  citySlug: string;
  district: string;
  area: string;
  distanceKm?: number;
  founded: string;
  verification: Verification;
  verifiedAt?: string;
  verifiedUntil?: string;
  updatedAt: string;
  groupSlug: string;
  categories: string[];
  focus: string;
  campusCount: number;
  rating: { avg: number; count: number; sub?: { teaching: number; result: number; service: number; env: number } } | null;
  priceFrom?: number;
  priceText: string;
  tags: string[];
  promoted?: boolean;
  photo: Photo;
  teachersTotal?: number;
  teachersVerified?: number;
  enroll90d?: number;
  inquiries30d?: number;
  escrow?: boolean;
  info?: SourcedFact[];
  campuses?: { name: string; address: string; metro: string }[];
  teachers?: { name: string; role: string; cert: string }[];
  album?: Photo[];
  offers?: Offer[];
  reviews?: Review[];
  ratingHistogram?: number[];
  qa?: QA[];
  selfIntro?: string;
  /** 开通 AI 营销增值服务：机构主页显示 AI 咨询助手 */
  aiAssistant?: boolean;
};

export type Course = {
  id: string;
  orgId: string;
  name: string;
  categorySlug: string;
  classType: "small" | "one" | "large" | "online";
  classLabel: string;
  hours: number;
  price: number;
  nextStart: string;
  summary?: string;
  facts?: { label: string; value: string }[];
  schedule?: { title: string; detail: string }[];
  sessions?: { date: string; left: string; urgent?: boolean }[];
  dealPrice?: { min: number; max: number; orders: number };
  rating?: { avg: number; count: number };
  faqs?: QA[];
  /** 课程封面；没有时用机构底色生成占位封面 */
  cover?: Photo;
  /** 试听视频（机构上传，平台审核后展示） */
  trialVideo?: { title: string; duration: string };
};
