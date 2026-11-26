"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

// 机构对比：最多 4 家，存在本机浏览器里，跨页面保留
const KEY = "jp-compare";
const MAX = 4;
const listeners = new Set<() => void>();
const EMPTY: string[] = [];
let cache: { raw: string | null; ids: string[] } = { raw: null, ids: EMPTY };

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw !== cache.raw) {
    let ids: string[] = EMPTY;
    try {
      ids = raw ? (JSON.parse(raw) as string[]) : EMPTY;
    } catch {}
    cache = { raw, ids };
  }
  return cache.ids;
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
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

export function useCompare() {
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => write(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-MAX)),
    clear: () => write([]),
  };
}

export function CompareButton({ id, className }: { id: string; className?: string }) {
  const { has, toggle } = useCompare();
  const on = has(id);
  return (
    <button
      type="button"
      onClick={() => toggle(id)}
      aria-pressed={on}
      className={
        className ??
        `rounded-md border px-2.5 py-1 text-xs transition ${on ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:border-brand hover:text-brand"}`
      }
    >
      {on ? "已加入对比" : "加入对比"}
    </button>
  );
}

export function CompareTray({ names }: { names: Record<string, string> }) {
  const { ids, toggle, clear } = useCompare();
  if (!ids.length) return null;
  return (
    <div className="fixed inset-x-0 bottom-14 z-30 px-4 md:bottom-4">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 rounded-xl border border-brand-tint bg-white p-3 shadow-lg">
        <span className="text-sm font-medium text-ink">
          机构对比（{ids.length} / {MAX}）
        </span>
        {ids.map((id) => (
          <span key={id} className="flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-xs text-brand">
            {names[id] ?? id}
            <button type="button" onClick={() => toggle(id)} aria-label={`移除 ${names[id] ?? id}`} className="ml-1 text-subtle hover:text-ink">
              ×
            </button>
          </span>
        ))}
        <span className="hidden text-xs text-subtle lg:inline">对比价格、课时单价、师资、评价、退费规则</span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={clear} className="px-2 text-xs text-subtle hover:text-ink">
            清空
          </button>
          <Link href="/compare" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            开始对比
          </Link>
        </div>
      </div>
    </div>
  );
}

export type CompareRow = {
  id: string;
  name: string;
  verification: string;
  district: string;
  founded: string;
  campusCount: number;
  priceText: string;
  hourly: string;
  teachers: string;
  rating: string;
  refund: string;
  tags: string;
};

export function CompareTable({ rows }: { rows: CompareRow[] }) {
  const { ids, toggle } = useCompare();
  const picked = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is CompareRow => !!r);
  if (!picked.length) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center text-muted">
        还没有加入对比的机构。在机构列表或机构主页点击“加入对比”，最多可选 4 家。
        <div className="mt-4">
          <Link href="/city/guangzhou/yasi" className="text-brand hover:underline">
            去看广州雅思培训机构
          </Link>
        </div>
      </div>
    );
  }
  const fields: [keyof CompareRow, string][] = [
    ["verification", "核验状态"],
    ["district", "区域"],
    ["founded", "成立日期"],
    ["campusCount", "校区数"],
    ["priceText", "学费区间"],
    ["hourly", "小班每课时均价"],
    ["teachers", "已查验教师"],
    ["rating", "已报读评价"],
    ["refund", "退费规则"],
    ["tags", "服务标签"],
  ];
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line bg-page text-left">
            <th className="w-36 p-3 font-medium text-subtle">项目</th>
            {picked.map((r) => (
              <th key={r.id} className="p-3 align-top font-semibold text-ink">
                <Link href={`/org/${r.id}`} className="hover:text-brand">
                  {r.name}
                </Link>
                <button type="button" onClick={() => toggle(r.id)} className="ml-2 text-xs font-normal text-subtle hover:text-ink">
                  移除
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map(([k, label]) => (
            <tr key={k} className="border-b border-line-soft last:border-0">
              <th className="p-3 text-left font-normal text-subtle">{label}</th>
              {picked.map((r) => (
                <td key={r.id} className="p-3 text-ink-2 tabular">
                  {r[k]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
