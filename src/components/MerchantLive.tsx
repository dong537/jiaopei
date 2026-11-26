"use client";

import { KEYS, newId, useStored, type Booking, type LeadFollow, type Order } from "@/lib/demo-store";
import { cx } from "./ui";
import { SelectField } from "./SelectField";

export type LeadAppeal = { id: string; leadId: string; org: string; user: string; reason: string; status: "pending" | "approved" | "rejected" };

type FollowState = LeadFollow[string]["st"];

type Lead = { id: string; t: string; u: string; c: string; s: string; st: FollowState; live?: boolean };

// 轻量跟进：状态 + 一句备注。完整的私域运营（群发、标签、企微）交给成熟 SaaS，不在平台内做
const leadStatus: Record<FollowState, { label: string; cls: string }> = {
  new: { label: "待联系", cls: "bg-orange-100 text-cta-dark" },
  follow: { label: "跟进中", cls: "bg-claimed-bg text-claimed" },
  visited: { label: "已到访试听", cls: "bg-brand-soft text-brand" },
  won: { label: "已成交", cls: "bg-verified-bg text-verified" },
  invalid: { label: "无效", cls: "bg-line-soft text-muted" },
};

const fmt = (n: number) => n.toLocaleString("en-US");

/** 商家中心里随演示操作变化的部分：学员在机构主页提交的预约、平台订单、无效线索申诉 */
export function MerchantLive({ orgId, orgName, staticLeads }: { orgId: string; orgName: string; staticLeads: Lead[] }) {
  const [bookings] = useStored<Booking[]>(KEYS.bookings, []);
  const [orders] = useStored<Order[]>(KEYS.orders, []);
  const [appeals, setAppeals] = useStored<LeadAppeal[]>(KEYS.leadAppeals, []);
  const [follow, setFollow] = useStored<LeadFollow>(KEYS.leadFollow, {});

  const live: Lead[] = bookings
    .filter((b) => b.kind !== "advisor" && b.orgId === orgId)
    .map((b) => ({
      id: b.id,
      t: b.createdAt.slice(5),
      u: `${b.name.slice(0, 1)}** · 虚拟号`,
      c: b.detail,
      s: b.kind === "ai" ? "AI 咨询助手" : "机构主页预约",
      st: "new",
      live: true,
    }));
  const leads = [...live, ...staticLeads].map((l) => ({ ...l, st: follow[l.id]?.st ?? l.st, note: follow[l.id]?.note ?? "" }));
  const patchFollow = (id: string, p: Partial<LeadFollow[string]>, base: FollowState) =>
    setFollow((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { st: base }), ...p } }));
  const myOrders = orders.filter((o) => o.orgId === orgId);
  const appealOf = (id: string) => appeals.find((a) => a.leadId === id);

  return (
    <>
      <section className="rounded-xl border border-line bg-white p-5 md:p-6" id="leads">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-ink">待跟进线索</h3>
          <span className="text-sm text-subtle">线索余额：会员赠送 38 条 · 充值 ¥[X] · 主页预约和 AI 助手转人工为独享线索</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-subtle">
                {["时间", "学员", "意向课程", "来源", "跟进状态", "跟进备注", "无效线索"].map((h) => (
                  <th key={h} className="py-2 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const st = leadStatus[l.st];
                const ap = appealOf(l.id);
                return (
                  <tr key={l.id} className={cx("border-b border-line-soft last:border-0", l.live && "bg-brand-soft/50")}>
                    <td className="py-2.5 text-muted tabular">{l.t}</td>
                    <td className="py-2.5 text-ink">
                      {l.u}
                      {l.live && <span className="ml-1 rounded bg-cta px-1 text-[10px] text-white">新</span>}
                    </td>
                    <td className="py-2.5 text-ink-2">{l.c}</td>
                    <td className={cx("py-2.5", l.s.startsWith("AI") ? "font-medium text-brand" : "text-muted")}>{l.s}</td>
                    <td className="py-2.5">
                      <SelectField
                        aria-label={`${l.u} 跟进状态`}
                        value={l.st}
                        onValueChange={value => patchFollow(l.id, { st: value as FollowState }, l.st)}
                        className={st.cls}
                        size="compact"
                        options={Object.entries(leadStatus).map(([value, item]) => ({ value, label: item.label }))}
                      />
                    </td>
                    <td className="py-2.5">
                      <input
                        aria-label={`${l.u} 跟进备注`}
                        defaultValue={l.note}
                        placeholder="如：周六来试听"
                        onBlur={(e) => e.target.value !== l.note && patchFollow(l.id, { note: e.target.value }, l.st)}
                        className="h-7 w-36 rounded border border-line px-2 text-xs outline-none focus:border-brand"
                      />
                    </td>
                    <td className="py-2.5 text-xs">
                      {l.st === "won" || l.st === "visited" ? (
                        <span className="text-subtle">—</span>
                      ) : ap ? (
                        <span className={ap.status === "approved" ? "text-verified" : ap.status === "rejected" ? "text-cta-dark" : "text-subtle"}>
                          {ap.status === "pending" ? "申诉审核中" : ap.status === "approved" ? "已退回 1 条额度" : "申诉未通过"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setAppeals((prev) => [
                              { id: newId("S"), leadId: l.id, org: orgName, user: l.u, reason: "空号 / 非本人", status: "pending" },
                              ...prev,
                            ])
                          }
                          className="text-subtle underline hover:text-ink"
                        >
                          申诉
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-subtle">
          跟进状态只有你自己看得到，用于统计线索转化率。无效线索（空号、重复、非本人）在 48 小时内申诉，平台核对虚拟号通话记录后退回额度。
        </p>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 md:p-6" id="orders">
        <h3 className="mb-4 font-semibold text-ink">订单与结算</h3>
        <dl className="grid grid-cols-3 gap-3 text-center">
          {[
            ["存管中（未结算）", "¥72,920"],
            ["已按课时结算", "¥23,480"],
            ["退费申请待处理", "1 笔"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-page px-2 py-3">
              <dd className="text-lg font-bold text-ink tabular">{v}</dd>
              <dt className="text-xs text-subtle">{k}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-subtle">近 30 天成交 ¥96,400 = 已按课时结算 ¥23,480 + 存管中 ¥72,920。每完成 1/4 课时结算 25%。</p>
        {myOrders.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-sm font-medium text-ink">演示订单（来自个人中心）</div>
            <ul className="divide-y divide-line-soft text-sm">
              {myOrders.map((o) => (
                <li key={o.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="text-ink-2">
                    {o.id} · {o.courseName} · {o.session}
                  </span>
                  <span className="text-muted tabular">
                    课时 {o.hoursDone}/{o.hoursTotal} · 已结算 ¥{fmt(o.settled)} · 存管 ¥{fmt(Math.max(0, o.paid - o.settled - (o.status === "refunded" ? (o.refundAmount ?? 0) : 0)))}
                    {o.status === "refunding" && " · 学员申请退款中"}
                    {o.status === "refunded" && " · 已退款"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
