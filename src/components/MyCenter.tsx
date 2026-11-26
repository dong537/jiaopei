"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { KEYS, STAGES, refundFor, settleFor, useStored, type Booking, type Complaint, type Order, type OrderStatus, type VisitRecord } from "@/lib/demo-store";
import { complaintStatus } from "./ComplaintCenter";
import { cx } from "./ui";
import { SelectField } from "./SelectField";

const fmt = (n: number) => n.toLocaleString("en-US");

const statusText: Record<OrderStatus, { label: string; cls: string }> = {
  deposit: { label: "已付定金 · 待补尾款", cls: "bg-orange-100 text-cta-dark" },
  paid: { label: "已付款 · 待开班", cls: "bg-claimed-bg text-claimed" },
  learning: { label: "上课中", cls: "bg-claimed-bg text-claimed" },
  done: { label: "已结课", cls: "bg-verified-bg text-verified" },
  refunding: { label: "退款审核中", cls: "bg-orange-100 text-cta-dark" },
  refunded: { label: "已退款", cls: "bg-line-soft text-muted" },
};

function ReviewForm({ onSubmit }: { onSubmit: (text: string, scores: number[]) => void }) {
  const [text, setText] = useState("");
  const [scores, setScores] = useState([5, 5, 5, 5]);
  const names = ["师资", "效果", "服务", "环境"];
  return (
    <div className="mt-3 rounded-lg bg-page p-3">
      <div className="flex flex-wrap gap-3 text-sm">
        {names.map((n, i) => (
          <label key={n} className="flex items-center gap-1 text-ink-2">
            {n}
            <SelectField
              value={scores[i]}
              onValueChange={value => setScores(scores.map((score, k) => k === i ? Number(value) : score))}
              size="compact" aria-label={`${n}评分`}
              options={[5, 4, 3, 2, 1].map(v => ({ value: String(v), label: `${v} 分` }))}
            />
          </label>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="说说上课的真实感受（至少 10 个字）"
        className="mt-2 h-20 w-full rounded-lg border border-line bg-white p-2 text-sm outline-none focus:border-brand"
      />
      <button
        type="button"
        disabled={text.trim().length < 10}
        onClick={() => onSubmit(text.trim(), scores)}
        className="mt-2 rounded-lg bg-brand px-4 py-1.5 text-sm text-white disabled:opacity-40"
      >
        提交评价
      </button>
    </div>
  );
}

function OrderCard({ o, highlight, update }: { o: Order; highlight: boolean; update: (patch: Partial<Order>) => void }) {
  const [reviewing, setReviewing] = useState(false);
  const stage = o.hoursTotal / STAGES;
  const escrow = o.paid - o.settled - (o.status === "refunded" ? (o.refundAmount ?? 0) : 0);
  const canRefund = ["deposit", "paid", "learning"].includes(o.status);
  const canAdvance = ["paid", "learning"].includes(o.status);
  const canReview = o.hoursDone > 0 && !o.review;
  const st = statusText[o.status];

  function advance() {
    const hoursDone = Math.min(o.hoursTotal, o.hoursDone + stage);
    const next = { ...o, hoursDone };
    update({ hoursDone, settled: settleFor(next), status: hoursDone >= o.hoursTotal ? "done" : "learning" });
  }

  return (
    <li className={cx("rounded-xl border bg-white p-4", highlight ? "border-verified ring-2 ring-verified-bg" : "border-line")}>
      {highlight && <div className="mb-2 text-sm text-verified">支付成功（演示）。学费已进入存管账户，机构会在开班前联系你。</div>}
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx("rounded px-2 py-0.5 text-xs", st.cls)}>{st.label}</span>
        <span className="text-xs text-subtle">
          订单 {o.id} · {o.createdAt}
        </span>
      </div>
      <div className="mt-2 font-semibold text-ink">
        <Link href={`/course/${o.courseId}`} className="hover:text-brand">
          {o.courseName}
        </Link>
      </div>
      <div className="text-sm text-muted">
        <Link href={`/org/${o.orgId}`} className="hover:text-brand">
          {o.orgName}
        </Link>{" "}
        · {o.session}
      </div>
      <div className="mt-1 text-sm text-ink-2">
        学费 ¥{fmt(o.price)}
        {o.discountLabel && <span className="text-xs text-cta-dark">（{o.discountLabel}，原价 ¥{fmt(o.listPrice)}）</span>}
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-subtle">
          <span>
            课时进度 {o.hoursDone} / {o.hoursTotal}
          </span>
          <span>每完成 1/{STAGES} 课时结算一次</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-line-soft">
          <div className="h-full rounded-full bg-brand" style={{ width: `${(o.hoursDone / o.hoursTotal) * 100}%` }} />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-page py-2">
          <dd className="text-sm font-semibold text-ink tabular">¥{fmt(o.paid)}</dd>
          <dt className="text-subtle">已支付</dt>
        </div>
        <div className="rounded-lg bg-page py-2">
          <dd className="text-sm font-semibold text-ink tabular">¥{fmt(o.settled)}</dd>
          <dt className="text-subtle">已结算给机构</dt>
        </div>
        <div className="rounded-lg bg-page py-2">
          <dd className="text-sm font-semibold text-ink tabular">¥{fmt(Math.max(0, escrow))}</dd>
          <dt className="text-subtle">{o.status === "refunded" ? "存管余额" : "存管中"}</dt>
        </div>
      </dl>

      {o.status === "refunding" && (
        <p className="mt-3 rounded-lg bg-orange-50 p-2 text-xs leading-5 text-cta-dark">
          已申请退款 ¥{fmt(o.refundAmount ?? 0)}（未上课部分）。已结算给机构的 ¥{fmt(o.settled)} 对应已上课时，不退。平台确认后 7 天内原路退回。
        </p>
      )}
      {o.status === "refunded" && (
        <p className="mt-3 rounded-lg bg-page p-2 text-xs text-muted">已退款 ¥{fmt(o.refundAmount ?? 0)}，订单关闭。</p>
      )}
      {o.review && (
        <p className="mt-3 rounded-lg bg-page p-2 text-xs leading-5 text-muted">
          我的评价（{o.review.status === "pending" ? "审核中，通过后展示在机构主页" : o.review.status === "published" ? "已展示" : "未通过审核"}）：{o.review.text}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {o.status === "deposit" && (
          <button type="button" onClick={() => update({ paid: o.price, status: "paid" })} className="rounded-lg bg-cta px-3 py-1.5 text-white hover:bg-cta-dark">
            补齐尾款 ¥{fmt(o.price - o.paid)}
          </button>
        )}
        {canAdvance && (
          <button type="button" onClick={advance} className="rounded-lg border border-brand px-3 py-1.5 text-brand hover:bg-brand-soft">
            演示：完成 {stage} 课时
          </button>
        )}
        {canReview && !reviewing && (
          <button type="button" onClick={() => setReviewing(true)} className="rounded-lg border border-line px-3 py-1.5 text-ink-2 hover:border-brand">
            写评价
          </button>
        )}
        {canRefund && (
          <button
            type="button"
            onClick={() => update({ status: "refunding", refundAmount: refundFor(o) })}
            className="rounded-lg border border-line px-3 py-1.5 text-ink-2 hover:border-brand"
          >
            申请退款（可退 ¥{fmt(refundFor(o))}）
          </button>
        )}
      </div>
      {reviewing && (
        <ReviewForm
          onSubmit={(text, scores) => {
            update({ review: { text, scores, status: "pending" } });
            setReviewing(false);
          }}
        />
      )}
    </li>
  );
}

export function MyCenter({ orgs, liveTitles }: { orgs: Record<string, { name: string; area: string; priceText: string }>; liveTitles: Record<string, { title: string; start: string }> }) {
  const sp = useSearchParams();
  const paidId = sp.get("paid");
  const [orders, setOrders] = useStored<Order[]>(KEYS.orders, []);
  const [bookings, setBookings] = useStored<Booking[]>(KEYS.bookings, []);
  const [favs, setFavs] = useStored<string[]>(KEYS.favorites, []);
  const [history, setHistory] = useStored<VisitRecord[]>(KEYS.history, []);
  const [reminders, setReminders] = useStored<string[]>(KEYS.liveReminders, []);
  const [complaints] = useStored<Complaint[]>(KEYS.complaints, []);

  const update = (id: string) => (patch: Partial<Order>) => setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const empty = (text: string, href: string, cta: string) => (
    <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">
      {text}
      <Link href={href} className="ml-1 text-brand hover:underline">
        {cta}
      </Link>
    </p>
  );

  return (
    <div className="grid gap-7 lg:grid-cols-2">
      <nav aria-label="个人中心栏目" className="flex flex-wrap gap-2 text-sm lg:col-span-2">
        {[
          ["#orders", `我的订单（${orders.length}）`],
          ["#bookings", `我的预约（${bookings.length}）`],
          ["#favorites", `我的收藏（${favs.length}）`],
          ["#live", `直播预约（${reminders.length}）`],
          ["#complaints", `我的投诉（${complaints.length}）`],
          ["#history", `浏览记录（${history.length}）`],
        ].map(([h, l]) => (
          <a key={h} href={h} className="rounded-full border border-line bg-white px-3 py-1 text-ink-2 hover:border-brand hover:text-brand">
            {l}
          </a>
        ))}
      </nav>

      <section id="orders" className="scroll-mt-28 lg:col-span-2">
        <h2 className="mb-3 text-lg font-semibold text-ink">我的订单</h2>
        {orders.length ? (
          <ul className="space-y-3">
            {orders.map((o) => (
              <OrderCard key={o.id} o={o} highlight={o.id === paidId} update={update(o.id)} />
            ))}
          </ul>
        ) : (
          empty("还没有订单。", "/course/c-waiyu-65", "去看一门可在线报名的课程")
        )}
      </section>

      <section id="bookings" className="scroll-mt-28">
        <h2 className="mb-3 text-lg font-semibold text-ink">我的预约</h2>
        {bookings.length ? (
          <ul className="space-y-2">
            {bookings.map((b) => (
              <li key={b.id} className="rounded-xl border border-line bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-claimed-bg px-2 py-0.5 text-xs text-claimed">{b.kind === "org" ? "已转给机构" : b.kind === "ai" ? "AI 助手已转给机构老师" : "选课顾问处理中"}</span>
                  <span className="text-xs text-subtle">{b.createdAt}</span>
                </div>
                <div className="mt-1 text-ink">
                  {b.kind !== "advisor" ? (
                    <Link href={`/org/${b.orgId}`} className="font-medium hover:text-brand">
                      {b.orgName}
                    </Link>
                  ) : (
                    <span className="font-medium">免费选课咨询</span>
                  )}
                  <span className="ml-2 text-muted">{b.detail}</span>
                </div>
                <div className="mt-1 text-xs leading-5 text-subtle">
                  {b.kind !== "advisor"
                    ? `只有这家机构会通过平台虚拟号联系 ${b.phone}。这条预约在机构的商家中心记为一条独享线索。`
                    : `顾问 30 分钟内回电 ${b.phone}，推荐不超过 3 家已核验机构；你的需求最多分给这 3 家机构。`}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          empty("还没有预约。", "/org/gz-waiyu#booking", "去预约一节试听")
        )}
      </section>

      <section id="favorites" className="scroll-mt-28">
        <h2 className="mb-3 text-lg font-semibold text-ink">我的收藏</h2>
        {favs.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {favs.map((id) => (
              <li key={id} className="flex items-center justify-between rounded-xl border border-line bg-white p-4 text-sm">
                <span>
                  <Link href={`/org/${id}`} className="font-medium text-ink hover:text-brand">
                    {orgs[id]?.name ?? id}
                  </Link>
                  <span className="ml-2 text-xs text-subtle">
                    {orgs[id]?.area} · {orgs[id]?.priceText}
                  </span>
                </span>
                <button type="button" onClick={() => setFavs((p) => p.filter((x) => x !== id))} className="text-xs text-subtle hover:text-ink">
                  取消收藏
                </button>
              </li>
            ))}
          </ul>
        ) : (
          empty("还没有收藏的机构。", "/city/guangzhou/yasi", "去看看广州雅思培训机构")
        )}
      </section>

      <section id="live" className="scroll-mt-28">
        <h2 className="mb-3 text-lg font-semibold text-ink">直播预约</h2>
        {reminders.length ? (
          <ul className="space-y-2">
            {reminders.map((id) => (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-4 text-sm">
                <span>
                  <Link href="/live" className="font-medium text-ink hover:text-brand">
                    {liveTitles[id]?.title ?? id}
                  </Link>
                  <span className="ml-2 text-xs text-subtle">{liveTitles[id]?.start} 开播 · 开播前短信提醒</span>
                </span>
                <button type="button" onClick={() => setReminders((p) => p.filter((x) => x !== id))} className="text-xs text-subtle hover:text-ink">
                  取消提醒
                </button>
              </li>
            ))}
          </ul>
        ) : (
          empty("还没有预约直播课。", "/live", "去看公益直播课表")
        )}
      </section>

      <section id="complaints" className="scroll-mt-28">
        <h2 className="mb-3 text-lg font-semibold text-ink">我的投诉</h2>
        {complaints.length ? (
          <ul className="space-y-2">
            {complaints.map((c) => (
              <li key={c.id} className="rounded-xl border border-line bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cx("rounded px-2 py-0.5 text-xs", complaintStatus[c.status].cls)}>{complaintStatus[c.status].label}</span>
                  <span className="text-xs text-subtle">
                    {c.id} · {c.createdAt}
                  </span>
                </div>
                <div className="mt-1 text-ink">
                  <span className="font-medium">{c.orgName}</span>
                  <span className="ml-2 text-muted">{c.type}</span>
                  {c.orderId && <span className="ml-2 text-xs text-subtle">订单 {c.orderId}</span>}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted">{c.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          empty("没有投诉记录。遇到退费纠纷、虚假宣传可以找我们。", "/complaints", "去投诉帮")
        )}
      </section>

      <section id="history" className="scroll-mt-28">
        <h2 className="mb-3 text-lg font-semibold text-ink">浏览记录</h2>
        {history.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {history.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-xl border border-line bg-white p-3 text-sm">
                <Link href={`/org/${v.id}`} className="font-medium text-ink hover:text-brand">
                  {v.name}
                </Link>
                <span className="text-xs text-subtle">{v.at}</span>
              </li>
            ))}
          </ul>
        ) : (
          empty("还没有浏览记录。", "/city/guangzhou/yasi", "去看看广州雅思培训机构")
        )}
        {history.length > 0 && (
          <button type="button" onClick={() => setHistory([])} className="mt-2 text-xs text-subtle underline hover:text-ink">
            清空浏览记录
          </button>
        )}
      </section>

      <button
        type="button"
        onClick={() => {
          setOrders([]);
          setBookings([]);
          setFavs([]);
          setHistory([]);
          setReminders([]);
        }}
        className="justify-self-start text-xs text-subtle underline hover:text-ink lg:col-span-2"
      >
        清空本机演示数据
      </button>
    </div>
  );
}
