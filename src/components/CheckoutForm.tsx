"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { KEYS, newId, nowText, useStored, type Order } from "@/lib/demo-store";
import { quote, sessionOpen, type Session } from "@/lib/pricing";
import type { Offer } from "@/lib/types";
import { cx } from "./ui";

const DEPOSIT = 500;
const fmt = (n: number) => n.toLocaleString("en-US");

export function CheckoutForm({
  course,
  org,
  sessions,
  offers,
  today,
  refundRule,
}: {
  course: { id: string; name: string; price: number; hours: number; classLabel: string };
  org: { id: string; name: string };
  sessions: Session[];
  offers: Offer[];
  today: string;
  refundRule: string;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const [, setOrders] = useStored<Order[]>(KEYS.orders, []);
  const initial = Number(sp.get("s") ?? 0);
  const [session, setSession] = useState(sessions[initial] && sessionOpen(sessions[initial]) ? initial : Math.max(0, sessions.findIndex(sessionOpen)));
  const [pay, setPay] = useState(sp.get("p") === "1" ? 1 : 0);
  const [code, setCode] = useState("");
  const q = quote(course.id, course.price, sessions[session], offers, today, code);
  const due = pay === 1 ? DEPOSIT : q.price;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) return;
    const order: Order = {
      id: newId("D"),
      courseId: course.id,
      courseName: course.name,
      orgId: org.id,
      orgName: org.name,
      session: sessions[session].date,
      listPrice: course.price,
      discountLabel: q.label || undefined,
      price: q.price,
      paid: due,
      hoursTotal: course.hours,
      hoursDone: 0,
      settled: 0,
      status: pay === 1 ? "deposit" : "paid",
      createdAt: nowText(),
    };
    setOrders((prev) => [order, ...prev]);
    router.push(`/me?paid=${order.id}#orders`);
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-3 font-semibold text-ink">1. 开班</h2>
          <div className="space-y-2">
            {sessions.map((s, i) => {
              const open = sessionOpen(s);
              return (
                <label
                  key={s.date}
                  className={cx(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                    !open ? "cursor-not-allowed border-line text-subtle" : i === session ? "border-brand bg-brand-soft" : "cursor-pointer border-line",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <input type="radio" name="session" disabled={!open} checked={i === session} onChange={() => setSession(i)} className="accent-brand" />
                    {s.date}
                  </span>
                  <span className="text-xs">{open ? s.left : `${s.left} · 暂不可付款`}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-3 font-semibold text-ink">2. 学员信息</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink-2">
              学员姓名
              <input name="student" required className="mt-1 h-10 w-full rounded-lg border border-line px-3 outline-none focus:border-brand" />
            </label>
            <label className="text-sm text-ink-2">
              手机号
              <input name="phone" required pattern="1[0-9]{10}" inputMode="numeric" maxLength={11} className="mt-1 h-10 w-full rounded-lg border border-line px-3 outline-none focus:border-brand" />
            </label>
            <label className="text-sm text-ink-2 sm:col-span-2">
              推荐码（选填，老学员推荐 95 折，与早鸟价不叠加，自动取低价）
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="如 TJ8K2Q" className="mt-1 h-10 w-full rounded-lg border border-line px-3 uppercase outline-none focus:border-brand" />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-3 font-semibold text-ink">3. 付款方式与合同</h2>
          <div className="space-y-2 text-sm text-ink-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="pay" checked={pay === 0} onChange={() => setPay(0)} className="accent-brand" />
              全款 ¥{fmt(q.price)}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="pay" checked={pay === 1} onChange={() => setPay(1)} className="accent-brand" />
              定金 ¥{DEPOSIT}，开班前在“我的订单”补齐 ¥{fmt(q.price - DEPOSIT)}
            </label>
          </div>
          <div className="mt-4 rounded-lg bg-page p-3 text-xs leading-6 text-muted">
            <div className="font-medium text-ink">《培训服务合同》要点（采用当地市场监管部门示范文本）</div>
            <div>· 培训内容：{course.name}，{course.classLabel}，{course.hours} 课时</div>
            <div>· 资金：学费进入持牌支付机构存管账户，每完成 1/4 课时结算 25% 给机构</div>
            <div>· 退费：{refundRule}；退款原路返回，7 天内到账</div>
            <div>· 争议：可通过教培网投诉帮扶协调，或向当地教育、市场监管部门投诉</div>
          </div>
          <label className="mt-3 flex items-start gap-2 text-xs text-ink-2">
            <input type="checkbox" required className="mt-0.5" />
            我已阅读并同意《培训服务合同》《退款政策》
          </label>
        </section>
      </div>

      <aside className="lg:sticky lg:top-[112px] lg:self-start">
        <div className="rounded-xl border border-line bg-white p-5">
          <div className="text-sm text-subtle">{org.name}</div>
          <div className="mt-1 font-semibold text-ink">{course.name}</div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-subtle">课程标价</dt>
              <dd className="tabular">¥{fmt(course.price)}</dd>
            </div>
            {q.label && (
              <div className="flex justify-between gap-4">
                <dt className="text-subtle">优惠</dt>
                <dd className="text-right text-cta-dark tabular">
                  −¥{fmt(course.price - q.price)}
                  <div className="text-[11px] text-subtle">{q.label}</div>
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-subtle">应付学费</dt>
              <dd className="font-medium tabular">¥{fmt(q.price)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="text-ink">本次支付</dt>
              <dd className="text-xl font-bold text-cta tabular">¥{fmt(due)}</dd>
            </div>
          </dl>
          <button className="mt-4 h-11 w-full rounded-lg bg-cta text-[15px] font-medium text-white hover:bg-cta-dark">确认并支付（演示）</button>
          <p className="mt-2 text-xs leading-5 text-subtle">原型不会真实扣款，提交后在“我的订单”里演示上课结算、退费和评价。</p>
          <Link href={`/course/${course.id}`} className="mt-2 block text-center text-xs text-brand hover:underline">
            返回课程
          </Link>
        </div>
      </aside>
    </form>
  );
}
