"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ResetIcon } from "@radix-ui/react-icons";
import { cx } from "./ui";

export type CourseFilterItem = {
  id: string;
  node: ReactNode;
  category: string;
  classType: string;
  price: number;
  hourly: number;
  /** 距开班天数；随报随学记为 0 */
  startIn: number;
};

type Option = { value: string; label: string; count: number };

const priceBands: { value: string; label: string; range: [number, number] }[] = [
  { value: "lt3k", label: "3,000 元以下", range: [0, 3000] },
  { value: "3k-6k", label: "3,000–6,000 元", range: [3000, 6000] },
  { value: "6k-10k", label: "6,000–10,000 元", range: [6000, 10000] },
  { value: "gt10k", label: "10,000 元以上", range: [10000, Infinity] },
];

const sorts = [
  { key: "default", label: "默认" },
  { key: "price", label: "学费最低" },
  { key: "hourly", label: "每课时最低" },
  { key: "start", label: "开班最早" },
] as const;

function Chips({ label, options, value, onChange }: { label: string; options: Option[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-12 shrink-0 text-xs font-medium text-subtle">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {[{ value: "", label: "全部", count: -1 }, ...options].map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              disabled={o.count === 0}
              onClick={() => onChange(o.value)}
              className={cx(
                "inline-flex min-h-8 items-center gap-1 rounded-lg px-3 text-sm",
                on ? "bg-brand-soft font-medium text-brand" : "text-ink-2 hover:bg-page disabled:text-subtle/60 disabled:hover:bg-transparent",
              )}
            >
              {o.label}
              {o.count >= 0 && <span className={cx("text-xs tabular", on ? "text-brand/70" : "text-subtle")}>{o.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 课程筛选与排序。卡片由服务端渲染，这里只控制显示和顺序 */
export function CourseFilterList({ items, categories, classTypes }: { items: CourseFilterItem[]; categories: Option[]; classTypes: Option[] }) {
  const [category, setCategory] = useState("");
  const [classType, setClassType] = useState("");
  const [band, setBand] = useState("");
  const [sort, setSort] = useState<(typeof sorts)[number]["key"]>("default");

  const bandOptions = priceBands.map((b) => ({ value: b.value, label: b.label, count: items.filter((i) => i.price >= b.range[0] && i.price < b.range[1]).length }));
  const active = !!(category || classType || band);

  const shown = useMemo(() => {
    const range = priceBands.find((b) => b.value === band)?.range;
    const list = items.filter(
      (i) => (!category || i.category === category) && (!classType || i.classType === classType) && (!range || (i.price >= range[0] && i.price < range[1])),
    );
    if (sort === "price") list.sort((a, b) => a.price - b.price);
    if (sort === "hourly") list.sort((a, b) => a.hourly - b.hourly);
    if (sort === "start") list.sort((a, b) => a.startIn - b.startIn);
    return list;
  }, [items, category, classType, band, sort]);

  const reset = () => {
    setCategory("");
    setClassType("");
    setBand("");
  };

  return (
    <section aria-label="课程列表">
      <div className="divide-y divide-line-soft rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] md:px-5">
        <Chips label="类别" options={categories} value={category} onChange={setCategory} />
        <Chips label="班型" options={classTypes} value={classType} onChange={setClassType} />
        <Chips label="学费" options={bandOptions} value={band} onChange={setBand} />
      </div>

      <div className="mb-4 mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-ink">
            课程列表
            <span className="ml-2 text-sm font-normal text-subtle" aria-live="polite">
              {shown.length} 门
            </span>
          </h2>
          {active && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
              <ResetIcon />
              重置筛选
            </button>
          )}
        </div>
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

      {shown.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((i) => (
            <div key={i.id} className="flex">
              {i.node}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-14 text-center">
          <h3 className="font-medium text-ink">没有符合条件的课程</h3>
          <p className="mt-2 text-sm text-muted">可以减少筛选条件，或换个关键词。</p>
          <button type="button" onClick={reset} className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand-dark">
            查看全部课程
          </button>
        </div>
      )}
    </section>
  );
}
