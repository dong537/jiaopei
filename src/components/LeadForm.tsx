"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { KEYS, newId, nowText, useStored, type Booking } from "@/lib/demo-store";
import { cx } from "./ui";
import { SelectField } from "./SelectField";

type Field =
  | { kind: "text"; name: string; label: string; placeholder?: string; type?: string }
  | { kind: "choice"; name: string; label: string; options: string[] }
  | { kind: "select"; name: string; label: string; options: string[] };

/**
 * 预约 / 选课 / 入驻表单。原型阶段不提交到服务器，只在本页显示提交成功；
 * 上线后接线索接口，手机号以虚拟号转接给机构。
 */
export function LeadForm({
  fields,
  submitLabel,
  consent,
  note,
  success,
  tone = "cta",
  record,
}: {
  fields: Field[];
  submitLabel: string;
  consent?: string;
  note?: ReactNode;
  success: string;
  tone?: "cta" | "primary";
  /** 学员线索：记到“我的预约”，机构在商家中心看到同一条线索 */
  record?: { kind: Booking["kind"]; orgId?: string; orgName?: string };
}) {
  const [done, setDone] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [, setBookings] = useStored<Booking[]>(KEYS.bookings, []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) return;
    if (record) {
      const fd = new FormData(e.currentTarget);
      const phone = String(fd.get("phone") ?? "");
      const detail = fields
        .filter((f) => f.kind !== "text")
        .map((f) => (f.kind === "choice" ? (choices[f.name] ?? f.options[0]) : String(fd.get(f.name) ?? "")))
        .join(" · ");
      setBookings((prev) => [
        {
          id: newId("L"),
          ...record,
          detail,
          name: String(fd.get("name") ?? "学员"),
          phone: phone.slice(0, 3) + "****" + phone.slice(-4),
          createdAt: nowText(),
        },
        ...prev,
      ]);
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-lg bg-verified-bg p-4 text-sm leading-6 text-verified" role="status">
        {success}
        {record ? (
          <div className="mt-1 text-xs">
            可在
            <Link href="/me#bookings" className="mx-1 underline">
              个人中心 · 我的预约
            </Link>
            查看进度（原型演示数据保存在本机浏览器）。
          </div>
        ) : (
          <div className="mt-1 text-xs opacity-80">（原型演示：未真正提交）</div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {fields.map((f) => (
        <div key={f.name}>
          <label className="mb-1 block text-sm text-ink-2" htmlFor={f.kind === "choice" ? undefined : f.name}>
            {f.label}
          </label>
          {f.kind === "text" && (
            <input
              id={f.name}
              name={f.name}
              type={f.type ?? "text"}
              placeholder={f.placeholder}
              required
              {...(f.type === "tel" ? { pattern: "1[0-9]{10}", inputMode: "numeric" as const, maxLength: 11 } : {})}
              className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-tint"
            />
          )}
          {f.kind === "select" && (
            <SelectField id={f.name} name={f.name} aria-label={f.label} options={f.options.map(o => ({ value: o, label: o }))} />
          )}
          {f.kind === "choice" && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={f.label}>
              {f.options.map((o) => {
                const on = (choices[f.name] ?? f.options[0]) === o;
                return (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setChoices({ ...choices, [f.name]: o })}
                    className={cx(
                      "rounded-lg border px-3 py-1.5 text-sm",
                      on ? "border-brand bg-brand-soft text-brand" : "border-line bg-white text-ink-2 hover:border-brand",
                    )}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
      {consent && (
        <label className="flex items-start gap-2 text-xs leading-5 text-subtle">
          <input type="checkbox" required defaultChecked className="mt-0.5" />
          {consent}
        </label>
      )}
      <button
        type="submit"
        className={cx(
          "h-11 w-full rounded-lg text-[15px] font-medium text-white transition",
          tone === "cta" ? "bg-cta hover:bg-cta-dark" : "bg-brand hover:bg-brand-dark",
        )}
      >
        {submitLabel}
      </button>
      {note && <p className="text-xs leading-5 text-subtle">{note}</p>}
    </form>
  );
}
