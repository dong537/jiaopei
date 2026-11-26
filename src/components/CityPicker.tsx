"use client";

import Link from "next/link";
import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDownIcon, Cross2Icon, MagnifyingGlassIcon, CheckIcon } from "@radix-ui/react-icons";
import { cityDirectory, hotCitySlugs } from "@/lib/cities";
import { selectCity, useSelectedCity } from "./useSelectedCity";

export function CityPicker({ variant = "header" }: { variant?: "header" | "link" }) {
  const current = useSelectedCity();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [initial, setInitial] = useState("");
  const changeOpen = (next: boolean) => { setOpen(next); if (!next) { setQuery(""); setInitial(""); } };
  const q = query.trim().toLowerCase();
  const filtered = cityDirectory.filter(c =>
    (!initial || c.initial === initial) && (!q || c.name.includes(q) || c.pinyin.includes(q) || c.province.includes(q)),
  );
  const groups = Object.entries(Object.groupBy(filtered, c => c.initial));
  const letters = [...new Set(cityDirectory.map(c => c.initial))];
  const hot = hotCitySlugs.map(slug => cityDirectory.find(c => c.slug === slug)!);
  const linkClass = (slug: string) => `flex min-h-9 items-center justify-between gap-1 rounded-md px-2 py-1.5 text-sm transition ${slug === current.slug ? "bg-brand-soft font-medium text-brand" : "text-ink-2 hover:bg-brand-soft hover:text-brand"}`;

  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={variant === "header" ? `切换城市，当前${current.name}` : "查看全部城市"} className={variant === "header" ? "flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-sm text-ink-2 hover:border-brand data-[state=open]:border-brand data-[state=open]:bg-brand-soft data-[state=open]:text-brand" : "inline-flex items-center gap-1 text-sm text-brand hover:underline"}>
          {variant === "header" ? <span title={current.name} className="max-w-[4.5em] truncate sm:max-w-[7em]">{current.name}</span> : "全部城市"}
          <ChevronDownIcon className="size-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={12} collisionPadding={12} className="city-panel" aria-label="选择城市">
          <div className="shrink-0 border-b border-line p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-ink">选择城市</h2>
              <Popover.Close aria-label="关闭城市选择" className="rounded-md p-1.5 text-subtle hover:bg-page hover:text-ink"><Cross2Icon className="size-4" /></Popover.Close>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-page px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-soft">
              <MagnifyingGlassIcon className="size-4 shrink-0 text-subtle" />
              <input value={query} onChange={e => { setQuery(e.target.value); setInitial(""); }} placeholder="搜索城市、拼音或省份" aria-label="搜索城市" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:shadow-none!" />
              {query && <button type="button" aria-label="清空城市搜索" onClick={() => setQuery("")} className="p-1 text-subtle"><Cross2Icon /></button>}
            </div>
            {!q && <div className="mt-3 flex flex-wrap gap-1" aria-label="按拼音首字母筛选城市">
              {["", ...letters].map(letter => <button key={letter} type="button" aria-pressed={initial === letter} onClick={() => setInitial(letter)} className={`min-h-8 min-w-8 rounded-md px-2 text-xs font-medium ${initial === letter ? "bg-brand text-white" : "text-muted hover:bg-brand-soft hover:text-brand"}`}>{letter || "全部"}</button>)}
            </div>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
            {!q && !initial && <section className="mb-5 border-b border-line pb-4">
              <h3 className="mb-2 text-xs font-medium text-subtle">热门城市</h3>
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">{hot.map(c => <Link key={c.slug} href={`/city/${c.slug}`} prefetch={false} onClick={() => { selectCity(c.slug); changeOpen(false); }} className={linkClass(c.slug)}>{c.name}{c.slug === current.slug && <CheckIcon />}</Link>)}</div>
            </section>}
            <div aria-live="polite" className="mb-3 text-xs text-subtle">{q ? `找到 ${filtered.length} 个匹配城市或地区` : `共 ${cityDirectory.length} 个城市与地区，按拼音排序`}</div>
            {groups.length ? groups.map(([letter, list]) => <section key={letter} className="mb-4 flex items-start gap-3 last:mb-0">
              <h3 className="flex size-7 shrink-0 items-center justify-center rounded-md bg-page text-sm font-semibold text-brand">{letter}</h3>
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 sm:grid-cols-4">{list?.map(c => <Link key={c.slug} href={`/city/${c.slug}`} prefetch={false} title={c.province} onClick={() => { selectCity(c.slug); changeOpen(false); }} className={linkClass(c.slug)}>{c.name}{c.slug === current.slug && <CheckIcon className="shrink-0" />}</Link>)}</div>
            </section>) : <div className="py-8 text-center"><p className="text-sm text-muted">没有找到匹配城市</p><p className="mt-1 text-xs text-subtle">试试城市中文名、完整拼音或省份名称</p><button type="button" onClick={() => { setQuery(""); setInitial(""); }} className="mt-3 text-sm text-brand">查看全部城市</button></div>}
          </div>
          <p className="shrink-0 border-t border-line bg-page px-5 py-3 text-xs leading-5 text-subtle">中国内地城市与地区目录。机构数据正在补充，城市页标注实际收录情况。</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
