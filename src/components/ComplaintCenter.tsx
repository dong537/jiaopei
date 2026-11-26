"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { KEYS, newId, nowText, useStored, type Complaint, type Order } from "@/lib/demo-store";
import { cx } from "./ui";
import { SelectField } from "./SelectField";
import { ComboInput } from "./ComboInput";

export const complaintStatus: Record<Complaint["status"], { label: string; cls: string }> = {
  submitted: { label: "已提交 · 1 个工作日内受理", cls: "bg-orange-100 text-cta-dark" },
  accepted: { label: "已受理", cls: "bg-claimed-bg text-claimed" },
  mediating: { label: "平台协调中", cls: "bg-claimed-bg text-claimed" },
  resolved: { label: "已解决", cls: "bg-verified-bg text-verified" },
  referred: { label: "已协助转主管部门", cls: "bg-line-soft text-muted" },
};

const types = ["退费纠纷", "虚假宣传", "机构停课 / 跑路", "服务与合同不符", "其他"];

export function ComplaintCenter({ orgNames }: { orgNames: string[] }) {
  const [list, setList] = useStored<Complaint[]>(KEYS.complaints, []);
  const [orders] = useStored<Order[]>(KEYS.orders, []);
  const [type, setType] = useState(types[0]);
  const [done, setDone] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) return;
    const fd = new FormData(e.currentTarget);
    const phone = String(fd.get("phone"));
    setList((p) => [
      {
        id: newId("T"),
        orgName: String(fd.get("org")),
        orderId: String(fd.get("order") || "") || undefined,
        type,
        text: String(fd.get("text")),
        phone: phone.slice(0, 3) + "****" + phone.slice(-4),
        createdAt: nowText(),
        status: "submitted",
      },
      ...p,
    ]);
    setDone(true);
    e.currentTarget.reset();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">提交投诉</h2>
        {done && (
          <p className="rounded-lg bg-verified-bg p-3 text-sm text-verified" role="status">
            已提交。工作人员 1 个工作日内通过 400 电话联系你，进度在右侧和个人中心可查。
          </p>
        )}
        <div>
          <label htmlFor="c-org" className="mb-1 block text-sm text-ink-2">
            机构名称
          </label>
          <ComboInput id="c-org" name="org" required options={orgNames} placeholder="搜索或输入机构全称" />
        </div>
        <div>
          <label htmlFor="c-order" className="mb-1 block text-sm text-ink-2">
            教培网订单号（选填，平台订单处理更快）
          </label>
          <SelectField id="c-order" name="order" aria-label="教培网订单号" options={[
            { value: "", label: "不是在教培网付款的" },
            ...orders.map(o => ({ value: o.id, label: `${o.id} · ${o.orgName} · ${o.courseName}` })),
          ]} />
        </div>
        <div role="radiogroup" aria-label="问题类型" className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={cx("rounded-lg border px-3 py-1.5 text-sm", type === t ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2")}
            >
              {t}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="c-text" className="mb-1 block text-sm text-ink-2">
            经过与诉求
          </label>
          <textarea id="c-text" name="text" required minLength={10} placeholder="什么时候、付了多少钱、现在的问题，以及你希望怎么解决" className="h-28 w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-brand" />
        </div>
        <div>
          <label htmlFor="c-phone" className="mb-1 block text-sm text-ink-2">
            手机号
          </label>
          <input id="c-phone" name="phone" type="tel" required pattern="1[0-9]{10}" maxLength={11} inputMode="numeric" className="h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand" />
        </div>
        <button type="submit" className="h-11 w-full rounded-lg bg-cta text-[15px] font-medium text-white hover:bg-cta-dark">
          提交投诉
        </button>
        <p className="text-xs leading-5 text-subtle">投诉内容只用于处理本次纠纷，不公开展示。机构名称与订单仅对被投诉机构和处理人员可见。</p>
      </form>
      <div>
        <h2 className="mb-2 text-lg font-semibold text-ink">我的投诉（{list.length}）</h2>
        {list.length ? (
          <ul className="space-y-2">
            {list.map((c) => (
              <li key={c.id} className="rounded-xl border border-line bg-white p-3 text-sm">
                <span className={cx("rounded px-1.5 py-0.5 text-xs", complaintStatus[c.status].cls)}>{complaintStatus[c.status].label}</span>
                <div className="mt-1 font-medium text-ink">
                  {c.orgName} · {c.type}
                </div>
                <div className="text-xs text-subtle">
                  {c.id} · {c.createdAt}
                  {c.orderId && ` · 订单 ${c.orderId}`}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-line bg-white p-4 text-sm text-muted">还没有投诉记录。</p>
        )}
        <p className="mt-3 text-xs text-subtle">
          处理进度同步在
          <Link href="/me#complaints" className="mx-1 text-brand hover:underline">
            个人中心
          </Link>
          。
        </p>
      </div>
    </div>
  );
}
