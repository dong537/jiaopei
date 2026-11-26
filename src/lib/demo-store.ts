"use client";

// 原型演示用的本机存储：用浏览器 localStorage 模拟“已登录用户”的预约、订单、收藏，
// 以及机构入驻申请和运营审核结果，让学员、机构、运营三条流程在演示时能前后衔接。
// 上线后全部换成服务端接口。
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function readKey<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {}
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  try {
    value = raw ? (JSON.parse(raw) as T) : fallback;
  } catch {}
  cache.set(key, { raw, value });
  return value;
}

function writeKey<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useStored<T>(key: string, fallback: T) {
  const value = useSyncExternalStore(
    subscribe,
    () => readKey(key, fallback),
    () => fallback,
  );
  return [value, (next: T | ((prev: T) => T)) => {
    const prev = readKey(key, fallback);
    writeKey(key, typeof next === "function" ? (next as (p: T) => T)(prev) : next);
  }] as const;
}

export const newId = (prefix: string) => `${prefix}${Date.now().toString(36).toUpperCase()}`;

export const nowText = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// ---------- 数据结构 ----------

export type Booking = {
  id: string;
  /** org：机构主页预约；ai：机构主页 AI 咨询助手转人工；两者都是该机构的独享线索 */
  kind: "org" | "advisor" | "ai";
  orgId?: string;
  orgName?: string;
  detail: string;
  name: string;
  phone: string;
  createdAt: string;
};

export type OrderStatus = "deposit" | "paid" | "learning" | "done" | "refunding" | "refunded";

export type Order = {
  id: string;
  courseId: string;
  courseName: string;
  orgId: string;
  orgName: string;
  session: string;
  listPrice: number;
  discountLabel?: string;
  price: number;
  paid: number;
  hoursTotal: number;
  hoursDone: number;
  /** 已按阶段结算给机构的金额 */
  settled: number;
  refundAmount?: number;
  status: OrderStatus;
  createdAt: string;
  review?: { text: string; scores: number[]; status: "pending" | "published" | "rejected" };
};

export type Application = {
  id: string;
  mode: "new" | "claim";
  orgName: string;
  claimOrgId?: string;
  city: string;
  category: string;
  contact: string;
  phone: string;
  files: string[];
  plan: string;
  createdAt: string;
  /** 合伙人初审 → 平台复审 */
  partnerReview: "pending" | "passed";
  status: "reviewing" | "approved" | "rejected";
  note?: string;
};

/** 机构用 AI 内容助手生成、人工确认后提交的问答，平台审核通过后显示在机构主页 */
export type AiContent = {
  id: string;
  orgId: string;
  orgName: string;
  q: string;
  a: string;
  createdAt: string;
  status: "pending" | "published" | "rejected";
};

export type BrandApp = { id: string; orgId: string; orgName: string; topic: string; createdAt: string; status: "pending" | "scheduled" };

export type Complaint = {
  id: string;
  orgName: string;
  orderId?: string;
  type: string;
  text: string;
  phone: string;
  createdAt: string;
  /** 已提交 → 已受理 → 协调中 → 已解决 / 已转主管部门 */
  status: "submitted" | "accepted" | "mediating" | "resolved" | "referred";
};

export type LeadFollow = Record<string, { st: "new" | "follow" | "visited" | "won" | "invalid"; note?: string }>;

export type VisitRecord = { id: string; name: string; at: string };

export const KEYS = {
  bookings: "jp-bookings",
  orders: "jp-orders",
  favorites: "jp-favorites",
  applications: "jp-applications",
  leadAppeals: "jp-lead-appeals",
  leadFollow: "jp-lead-follow",
  aiContent: "jp-ai-content",
  brandApps: "jp-brand-apps",
  liveReminders: "jp-live-reminders",
  complaints: "jp-complaints",
  history: "jp-history",
} as const;

export const STAGES = 4;

/** 担保付款结算：每完成 1/4 课时，把这一阶段的学费从存管划给机构 */
export function settleFor(order: Pick<Order, "price" | "hoursDone" | "hoursTotal">) {
  const stagesDone = Math.floor((order.hoursDone / order.hoursTotal) * STAGES + 1e-9);
  return Math.round((order.price * stagesDone) / STAGES);
}

/** 退款：开课前全额退；开课后按未上课时比例退（已结算部分不退） */
export function refundFor(order: Pick<Order, "price" | "paid" | "hoursDone" | "hoursTotal">) {
  const used = Math.round((order.price * order.hoursDone) / order.hoursTotal);
  return Math.max(0, order.paid - used);
}
