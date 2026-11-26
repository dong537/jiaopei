"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { KEYS, useStored, type AiContent, type Application, type BrandApp, type Complaint, type Order } from "@/lib/demo-store";
import { planName } from "./JoinApply";
import type { LeadAppeal } from "./MerchantLive";
import { cx } from "./ui";

const fmt = (n: number) => n.toLocaleString("en-US");

function Section({ id, title, rule, count, children }: { id: string; title: string; rule: string; count: number; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-ink">
          {title}
          <span className={cx("ml-2 rounded-full px-2 text-xs", count ? "bg-cta text-white" : "bg-line-soft text-subtle")}>{count}</span>
        </h2>
        <span className="text-xs text-subtle">{rule}</span>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const Btn = ({ onClick, children, tone = "plain" }: { onClick: () => void; children: ReactNode; tone?: "plain" | "ok" | "no" }) => (
  <button
    type="button"
    onClick={onClick}
    className={cx(
      "rounded-md border px-2.5 py-1 text-xs",
      tone === "ok" ? "border-verified text-verified hover:bg-verified-bg" : tone === "no" ? "border-cta text-cta hover:bg-orange-50" : "border-line text-ink-2 hover:border-brand",
    )}
  >
    {children}
  </button>
);

const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-lg bg-page p-3 text-sm text-subtle">{children}</p>;

const sampleCorrections = [
  { id: "C-1021", target: "广州示例英语培训中心 · 成立日期", from: "学员", content: "成立日期应为 2007-04-02（附公示系统截图）", status: "已核实并更正 · 2026-10-22" },
  { id: "C-1024", target: "广州雅思师资榜", from: "广州示例国际英语中心", content: "新增 2 位教师证书已上传，申请计入", status: "待核验证书原件" },
];

export function OpsConsole({ renewals }: { renewals: { name: string; until: string; days: number }[] }) {
  const [apps, setApps] = useStored<Application[]>(KEYS.applications, []);
  const [orders, setOrders] = useStored<Order[]>(KEYS.orders, []);
  const [appeals, setAppeals] = useStored<LeadAppeal[]>(KEYS.leadAppeals, []);
  const [aiContent, setAiContent] = useStored<AiContent[]>(KEYS.aiContent, []);
  const [brandApps, setBrandApps] = useStored<BrandApp[]>(KEYS.brandApps, []);
  const [complaints, setComplaints] = useStored<Complaint[]>(KEYS.complaints, []);

  const patchApp = (id: string, p: Partial<Application>) => setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const patchOrder = (id: string, p: Partial<Order>) => setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...p } : o)));

  const pendingApps = apps.filter((a) => a.status === "reviewing");
  const refunds = orders.filter((o) => o.status === "refunding");
  const reviews = orders.filter((o) => o.review?.status === "pending");
  const pendingAppeals = appeals.filter((a) => a.status === "pending");
  const pendingContent = aiContent.filter((c) => c.status === "pending").length + brandApps.filter((b) => b.status === "pending").length;
  const openTickets = complaints.filter((c) => c.status !== "resolved" && c.status !== "referred");
  const nextComplaint: Record<Complaint["status"], Complaint["status"]> = {
    submitted: "accepted",
    accepted: "mediating",
    mediating: "resolved",
    resolved: "resolved",
    referred: "referred",
  };
  const complaintLabel: Record<Complaint["status"], string> = {
    submitted: "已提交",
    accepted: "已受理",
    mediating: "协调中",
    resolved: "已解决",
    referred: "已转主管部门",
  };

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2 text-sm">
        {[
          ["#qualification", "资质审核"],
          ["#refunds", "退款"],
          ["#reviews", "评价审核"],
          ["#lead-appeals", "无效线索申诉"],
          ["#content", "内容审核"],
          ["#tickets", "投诉工单"],
          ["#corrections", "更正与榜单申诉"],
          ["#renewals", "核验到期"],
        ].map(([h, l]) => (
          <a key={h} href={h} className="rounded-full border border-line bg-white px-3 py-1 text-ink-2 hover:border-brand hover:text-brand">
            {l}
          </a>
        ))}
      </nav>

      <Section id="qualification" title="资质审核" rule="合伙人初审（材料完整性、校区实地）→ 平台复审（与官方登记比对）· 2 个工作日" count={pendingApps.length}>
        {apps.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-subtle">
                  {["申请", "机构", "城市", "材料", "方案", "合伙人初审", "平台复审"].map((h) => (
                    <th key={h} className="py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-b border-line-soft last:border-0">
                    <td className="py-2.5 text-xs text-muted">
                      {a.id}
                      <div>{a.mode === "claim" ? "认领" : "新建"}</div>
                    </td>
                    <td className="py-2.5 text-ink">{a.orgName}</td>
                    <td className="py-2.5 text-muted">{a.city}</td>
                    <td className="py-2.5 text-muted">{a.files.length} 份</td>
                    <td className="py-2.5 text-muted">{planName(a.plan)}</td>
                    <td className="py-2.5">
                      {a.partnerReview === "passed" ? (
                        <span className="text-xs text-verified">已通过</span>
                      ) : a.status === "reviewing" ? (
                        <Btn tone="ok" onClick={() => patchApp(a.id, { partnerReview: "passed" })}>
                          初审通过
                        </Btn>
                      ) : (
                        <span className="text-xs text-subtle">—</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      {a.status === "reviewing" ? (
                        a.partnerReview === "passed" ? (
                          <span className="flex gap-1.5">
                            <Btn tone="ok" onClick={() => patchApp(a.id, { status: "approved" })}>
                              复审通过
                            </Btn>
                            <Btn tone="no" onClick={() => patchApp(a.id, { status: "rejected", note: "办学许可 / 备案证明与教育局公示名单不一致，请补充" })}>
                              驳回
                            </Btn>
                          </span>
                        ) : (
                          <span className="text-xs text-subtle">等待合伙人初审</span>
                        )
                      ) : (
                        <span className={cx("text-xs", a.status === "approved" ? "text-verified" : "text-cta")}>{a.status === "approved" ? "已通过，开通商家中心" : "已驳回"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            暂无申请。可以先在
            <Link href="/join/apply" className="mx-1 text-brand underline">
              入驻申请
            </Link>
            提交一条演示申请。
          </Empty>
        )}
      </Section>

      <Section id="refunds" title="退款" rule="未上课部分从存管账户原路退回，已结算部分不退 · 7 天内到账" count={refunds.length}>
        {refunds.length ? (
          <ul className="divide-y divide-line-soft text-sm">
            {refunds.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-ink-2">
                  {o.id} · {o.orgName} · {o.courseName} · 课时 {o.hoursDone}/{o.hoursTotal}
                  <span className="ml-2 text-xs text-subtle">
                    已付 ¥{fmt(o.paid)}，已结算 ¥{fmt(o.settled)}，退 ¥{fmt(o.refundAmount ?? 0)}
                  </span>
                </span>
                <Btn tone="ok" onClick={() => patchOrder(o.id, { status: "refunded" })}>
                  确认退款
                </Btn>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>暂无退款申请。学员在“我的订单”申请退款后出现在这里。</Empty>
        )}
      </Section>

      <Section id="reviews" title="评价审核" rule="只接受已上课的平台订单学员评价；不改分、不删差评，只拦截广告与无关内容" count={reviews.length}>
        {reviews.length ? (
          <ul className="divide-y divide-line-soft text-sm">
            {reviews.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0 flex-1 text-ink-2">
                  {o.orgName} · {o.courseName}（订单 {o.id}，已上 {o.hoursDone} 课时）
                  <div className="text-xs text-muted">
                    {o.review!.text}（师资 {o.review!.scores[0]} · 效果 {o.review!.scores[1]} · 服务 {o.review!.scores[2]} · 环境 {o.review!.scores[3]}）
                  </div>
                </span>
                <span className="flex gap-1.5">
                  <Btn tone="ok" onClick={() => patchOrder(o.id, { review: { ...o.review!, status: "published" } })}>
                    通过展示
                  </Btn>
                  <Btn tone="no" onClick={() => patchOrder(o.id, { review: { ...o.review!, status: "rejected" } })}>
                    驳回（广告 / 无关）
                  </Btn>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>暂无待审评价。</Empty>
        )}
      </Section>

      <Section id="lead-appeals" title="无效线索申诉" rule="核对虚拟号通话记录：空号、重复、非本人退回 1 条额度 · 48 小时内提交" count={pendingAppeals.length}>
        {appeals.length ? (
          <ul className="divide-y divide-line-soft text-sm">
            {appeals.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-ink-2">
                  {a.org} · 线索 {a.user} · 理由：{a.reason}
                </span>
                {a.status === "pending" ? (
                  <span className="flex gap-1.5">
                    <Btn tone="ok" onClick={() => setAppeals((p) => p.map((x) => (x.id === a.id ? { ...x, status: "approved" } : x)))}>
                      通过并退回额度
                    </Btn>
                    <Btn tone="no" onClick={() => setAppeals((p) => p.map((x) => (x.id === a.id ? { ...x, status: "rejected" } : x)))}>
                      驳回（通话记录正常）
                    </Btn>
                  </span>
                ) : (
                  <span className={cx("text-xs", a.status === "approved" ? "text-verified" : "text-cta")}>{a.status === "approved" ? "已退回" : "已驳回"}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            暂无申诉。机构在
            <Link href="/merchant#leads" className="mx-1 text-brand underline">
              商家中心 · 线索
            </Link>
            点“申诉”后出现在这里。
          </Empty>
        )}
      </Section>

      <Section id="content" title="内容审核" rule="机构用 AI 内容助手起草的问答与品牌内容选题：查事实是否与主页一致、有无效果承诺和绝对化用语" count={pendingContent}>
        {aiContent.length || brandApps.length ? (
          <ul className="divide-y divide-line-soft text-sm">
            {aiContent.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0 flex-1 text-ink-2">
                  <span className="mr-2 rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand">AI 辅助问答</span>
                  {c.orgName} · {c.q}
                  <div className="text-xs text-muted">{c.a}</div>
                </span>
                {c.status === "pending" ? (
                  <span className="flex gap-1.5">
                    <Btn tone="ok" onClick={() => setAiContent((p) => p.map((x) => (x.id === c.id ? { ...x, status: "published" } : x)))}>
                      通过并发布
                    </Btn>
                    <Btn tone="no" onClick={() => setAiContent((p) => p.map((x) => (x.id === c.id ? { ...x, status: "rejected" } : x)))}>
                      驳回
                    </Btn>
                  </span>
                ) : (
                  <span className={cx("text-xs", c.status === "published" ? "text-verified" : "text-cta")}>{c.status === "published" ? "已发布到机构主页" : "已驳回"}</span>
                )}
              </li>
            ))}
            {brandApps.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-ink-2">
                  <span className="mr-2 rounded bg-selfreport-bg px-1.5 py-0.5 text-xs text-selfreport">品牌内容</span>
                  {b.orgName} · {b.topic}
                </span>
                {b.status === "pending" ? (
                  <Btn tone="ok" onClick={() => setBrandApps((p) => p.map((x) => (x.id === b.id ? { ...x, status: "scheduled" } : x)))}>
                    通过并排期
                  </Btn>
                ) : (
                  <span className="text-xs text-verified">已排期</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            暂无待审内容。机构在
            <Link href="/merchant/ai#studio" className="mx-1 text-brand underline">
              商家中心 · AI 营销
            </Link>
            提交问答或品牌内容后出现在这里。
          </Empty>
        )}
      </Section>

      <Section id="tickets" title="投诉工单" rule="1 个工作日内受理，7 个工作日内给出处理意见；平台订单按担保规则退款，线下付款协调不成的协助转主管部门" count={openTickets.length}>
        {complaints.length ? (
          <ul className="divide-y divide-line-soft text-sm">
            {complaints.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0 flex-1 text-ink-2">
                  {c.id} · {c.orgName} · {c.type}
                  {c.orderId && <span className="ml-1 text-xs text-brand">平台订单 {c.orderId}</span>}
                  <div className="text-xs text-muted">{c.text}</div>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-subtle">{complaintLabel[c.status]}</span>
                  {c.status !== "resolved" && c.status !== "referred" && (
                    <>
                      <Btn tone="ok" onClick={() => setComplaints((p) => p.map((x) => (x.id === c.id ? { ...x, status: nextComplaint[c.status] } : x)))}>
                        {c.status === "submitted" ? "受理" : c.status === "accepted" ? "转协调" : "标记已解决"}
                      </Btn>
                      <Btn tone="no" onClick={() => setComplaints((p) => p.map((x) => (x.id === c.id ? { ...x, status: "referred" } : x)))}>
                        转主管部门
                      </Btn>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            暂无投诉。学员在
            <Link href="/complaints" className="mx-1 text-brand underline">
              投诉帮
            </Link>
            提交后出现在这里。
          </Empty>
        )}
      </Section>

      <Section id="corrections" title="更正与榜单申诉" rule="3 个工作日内核实；确认后修改数据、在页面保留更正记录，榜单在下期更正" count={1}>
        <ul className="divide-y divide-line-soft text-sm">
          {sampleCorrections.map((c) => (
            <li key={c.id} className="py-2.5">
              <div className="text-ink">
                {c.id} · {c.target}
                <span className="ml-2 text-xs text-subtle">提交人：{c.from}</span>
              </div>
              <div className="text-xs text-muted">
                {c.content} · <span className={c.status.startsWith("已") ? "text-verified" : "text-cta-dark"}>{c.status}</span>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="renewals" title="核验到期" rule="到期前 60 天提醒机构复核；逾期降为“机构已认领”，暂停在线报名，已售订单照常履约" count={renewals.filter((r) => r.days <= 60).length}>
        <ul className="divide-y divide-line-soft text-sm">
          {renewals.map((r) => (
            <li key={r.name} className="flex justify-between py-2">
              <span className="text-ink-2">{r.name}</span>
              <span className={cx("text-xs tabular", r.days <= 60 ? "text-cta" : "text-subtle")}>
                有效至 {r.until}（{r.days} 天）
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <button
        type="button"
        onClick={() => {
          setApps([]);
          setAppeals([]);
          setAiContent([]);
          setBrandApps([]);
          setComplaints([]);
        }}
        className="text-xs text-subtle underline hover:text-ink"
      >
        清空运营演示数据（申请、线索申诉、内容、投诉）
      </button>
    </div>
  );
}
