"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { quote, sessionOpen, type Session } from "@/lib/pricing";
import type { Offer } from "@/lib/types";
import { cx } from "./ui";

/** 课程报名：选择开班与付款方式，进入结算页 */
export function EnrollBox({
  courseId,
  price,
  hours,
  sessions,
  offers,
  today,
  orgHref,
  escrow,
}: {
  courseId: string;
  price: number;
  hours: number;
  sessions: Session[];
  offers: Offer[];
  today: string;
  orgHref: string;
  escrow: boolean;
}) {
  const router = useRouter();
  const firstOpen = Math.max(0, sessions.findIndex(sessionOpen));
  const [session, setSession] = useState(firstOpen);
  const [pay, setPay] = useState(0);
  const q = quote(courseId, price, sessions[session], offers, today);
  const open = sessions[session] && sessionOpen(sessions[session]);
  const fmt = (n: number) => n.toLocaleString("en-US");
  const payOptions = [`全款 ¥${fmt(q.price)}（存管后按课时阶段结算给机构）`, `先付定金 ¥500，开班前补齐 ¥${fmt(q.price - 500)}`];

  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-cta tabular">¥{fmt(q.price)}</span>
        {q.price < price && <span className="text-sm text-subtle line-through">¥{fmt(price)}</span>}
        <span className="text-sm text-subtle">/ {hours} 课时</span>
      </div>
      {q.label && <div className="mt-1 text-xs text-cta-dark">已按“{q.label}”计算</div>}

      <div className="mt-4 text-sm font-medium text-ink">选择开班</div>
      <div className="mt-2 space-y-2" role="radiogroup" aria-label="选择开班">
        {sessions.map((s, i) => (
          <button
            key={s.date}
            type="button"
            role="radio"
            aria-checked={i === session}
            onClick={() => setSession(i)}
            className={cx(
              "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
              i === session ? "border-brand bg-brand-soft" : "border-line hover:border-brand",
            )}
          >
            <span className="text-ink">{s.date}</span>
            <span className={cx("text-xs", s.urgent ? "text-cta-dark" : "text-subtle")}>{s.left}</span>
          </button>
        ))}
      </div>

      {escrow && open && (
        <>
          <div className="mt-4 text-sm font-medium text-ink">付款方式</div>
          <div className="mt-2 space-y-1.5">
            {payOptions.map((o, i) => (
              <label key={o} className="flex items-center gap-2 text-sm text-ink-2">
                <input type="radio" name="pay" checked={pay === i} onChange={() => setPay(i)} className="accent-brand" />
                {o}
              </label>
            ))}
          </div>
        </>
      )}

      {escrow && open ? (
        <button
          type="button"
          onClick={() => router.push(`/checkout/${courseId}?s=${session}&p=${pay}`)}
          className="mt-4 h-11 w-full rounded-lg bg-cta text-[15px] font-medium text-white hover:bg-cta-dark"
        >
          立即报名
        </button>
      ) : (
        <p className="mt-4 rounded-lg bg-page p-3 text-xs leading-5 text-muted">
          {escrow ? "这一期还未开放报名，可以先预约试听，开放后顾问会通知你。" : "该机构暂未开通在线报名，可以先预约试听，由机构与你联系。"}
        </p>
      )}
      <Link href={`${orgHref}#booking`} className="mt-2 flex h-10 w-full items-center justify-center rounded-lg border border-brand text-sm text-brand hover:bg-brand-soft">
        先预约免费试听
      </Link>

      {escrow && (
        <div className="mt-4 rounded-lg bg-page p-3 text-xs leading-5 text-muted">
          <div className="mb-1 font-medium text-ink">平台担保付款</div>
          学费由持牌支付机构存管，每完成 1/4 课时结算对应金额给机构。未上课部分可随时申请按比例退费。
          <Link href="/about/methodology#escrow" className="ml-1 text-brand hover:underline">
            退款政策
          </Link>
        </div>
      )}
    </div>
  );
}
