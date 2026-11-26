"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cx } from "./ui";

export type FilterItem = {
  id: string;
  node: ReactNode;
  ad: boolean;
  district: string;
  verification: string;
  escrow: boolean;
  minPrice?: number;
  classTypes: string[];
  ratingCount: number;
  distance?: number;
};

type Group = { key: "district" | "price" | "classType" | "status"; title: string; options: { value: string; label: string }[] };

const priceBands: Record<string, [number, number]> = {
  lt3k: [0, 3000],
  "3k-6k": [3000, 6000],
  "6k-10k": [6000, 10000],
  gt10k: [10000, Infinity],
};

const sorts = [
  { key: "default", label: "综合" },
  { key: "reviews", label: "评价数" },
  { key: "price", label: "价格" },
  { key: "distance", label: "距离" },
] as const;

/** 列表筛选与排序。所有机构卡片都由服务端渲染，筛选只控制显示 */
export function OrgFilterList({ items, districts, total }: { items: FilterItem[]; districts: string[]; total: number }) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useState<(typeof sorts)[number]["key"]>("default");
  const [open, setOpen] = useState(false);

  const groups: Group[] = [
    { key: "district", title: "区域", options: districts.map((d) => ({ value: d, label: d })) },
    {
      key: "price",
      title: "学费",
      options: [
        { value: "lt3k", label: "3,000 元以下" },
        { value: "3k-6k", label: "3,000–6,000 元" },
        { value: "6k-10k", label: "6,000–10,000 元" },
        { value: "gt10k", label: "10,000 元以上" },
      ],
    },
    {
      key: "classType",
      title: "班型",
      options: [
        { value: "one", label: "一对一" },
        { value: "small", label: "小班（8 人以下）" },
        { value: "large", label: "大班" },
        { value: "online", label: "线上直播" },
      ],
    },
    {
      key: "status",
      title: "核验状态",
      options: [
        { value: "verified", label: "平台已核验" },
        { value: "claimed", label: "机构已认领" },
        { value: "escrow", label: "支持平台担保付款" },
      ],
    },
  ];

  const activeCount = Object.values(picked).reduce((s, v) => s + v.length, 0);

  const toggle = (key: string, value: string) => {
    const cur = picked[key] ?? [];
    setPicked({ ...picked, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] });
  };

  const order = useMemo(() => {
    const match = (it: FilterItem) => {
      const d = picked.district ?? [];
      if (d.length && !d.includes(it.district)) return false;
      const p = picked.price ?? [];
      if (p.length && (it.minPrice === undefined || !p.some((b) => it.minPrice! >= priceBands[b][0] && it.minPrice! < priceBands[b][1]))) return false;
      const c = picked.classType ?? [];
      if (c.length && !c.some((x) => it.classTypes.includes(x))) return false;
      const s = picked.status ?? [];
      if (s.length) {
        const ok = s.every((x) => (x === "escrow" ? it.escrow : x === "verified" ? it.verification === "verified" : it.verification !== "unclaimed"));
        if (!ok) return false;
      }
      return true;
    };
    const natural = items.filter((i) => !i.ad && match(i));
    if (sort === "reviews") natural.sort((a, b) => b.ratingCount - a.ratingCount);
    if (sort === "price") natural.sort((a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity));
    if (sort === "distance") natural.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    const ads = items.filter((i) => i.ad && match(i));
    const out = [...natural];
    ads.forEach((a, k) => out.splice(Math.min(1 + k * 4, out.length), 0, a));
    return out;
  }, [items, picked, sort]);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink lg:hidden"
      >
        筛选：区域 · 学费 · 班型 · 核验状态{activeCount > 0 && `（已选 ${activeCount}）`}
        <span className="text-subtle">{open ? "收起" : "展开"}</span>
      </button>
      <aside className={cx("space-y-5 rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] lg:block lg:self-start", !open && "hidden")}>
        {groups.map((g) => (
          <fieldset key={g.key}>
            <legend className="mb-2 text-sm font-semibold text-ink">{g.title}</legend>
            <div className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-1">
              {g.options.map((o) => {
                const on = (picked[g.key] ?? []).includes(o.value);
                return (
                  <label
                    key={o.value}
                    className={cx(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm",
                      on ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-page",
                    )}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggle(g.key, o.value)} className="accent-brand" />
                    {o.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        {activeCount > 0 && (
          <button type="button" onClick={() => setPicked({})} className="text-sm text-brand hover:underline">
            清除筛选（{activeCount}）
          </button>
        )}
      </aside>
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            共 {total} 家机构 · 当前显示 {order.length} 家 · 默认按核验状态、信息完整度、真实评价排序
          </p>
          <div className="flex overflow-hidden rounded-lg border border-line bg-white text-sm" role="group" aria-label="排序">
            {sorts.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                aria-pressed={sort === s.key}
                className={cx("px-3 py-1.5", sort === s.key ? "bg-brand text-white" : "text-ink-2 hover:bg-page")}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {order.map((it) => (
            <div key={it.id + (it.ad ? ":ad" : "")}>{it.node}</div>
          ))}
          {order.length === 0 && <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">没有符合条件的机构，试试减少筛选条件。</p>}
        </div>
      </div>
    </div>
  );
}
