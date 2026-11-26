"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, MagnifyingGlassIcon, ResetIcon } from "@radix-ui/react-icons";
import { schoolGlyph, schoolPhoto, type School } from "@/lib/schools";
import { SelectField } from "./SelectField";
import { Icon, PhotoBox, cx } from "./ui";

export function SchoolDirectory({ schools }: { schools: School[] }) {
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [nature, setNature] = useState("");
  const [stage, setStage] = useState("");
  const districts = [...new Set(schools.map(s => s.district))];
  const filtered = schools.filter(s => (!district || s.district === district) && (!nature || s.nature === nature) && (!stage || s.stage.includes(stage)) && (!query.trim() || `${s.name}${s.district}${s.address}`.includes(query.trim())));
  const active = !!(query || district || nature || stage);
  const reset = () => { setQuery(""); setDistrict(""); setNature(""); setStage(""); };
  return (
    <section aria-label="学校目录">
      <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] md:p-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="school-search" className="mb-1.5 block text-xs font-medium text-muted">学校名称或地址</label>
            <div className="flex items-center gap-2 rounded-lg border border-line px-3 focus-within:border-brand">
              <MagnifyingGlassIcon className="size-4 shrink-0 text-subtle" />
              <input id="school-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索学校名称、区县或地址" className="h-10 min-w-0 flex-1 text-sm outline-none focus-visible:shadow-none!" />
            </div>
          </div>
          <div><label htmlFor="school-nature" className="mb-1.5 block text-xs font-medium text-muted">办学性质</label><SelectField id="school-nature" value={nature} onValueChange={setNature} options={[{ value: "", label: "全部性质" }, ...["公办", "民办"].map(value => ({ value, label: value }))]} /></div>
          <div><label htmlFor="school-stage" className="mb-1.5 block text-xs font-medium text-muted">学段</label><SelectField id="school-stage" value={stage} onValueChange={setStage} options={[{ value: "", label: "全部学段" }, ...["小学", "初中", "高中"].map(value => ({ value, label: value }))]} /></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-4" aria-label="按区域筛选">
          <span className="mr-2 text-xs font-medium text-subtle">所在区域</span>
          {["", ...districts].map(value => <button type="button" key={value} aria-pressed={district === value} onClick={() => setDistrict(value)} className={`min-h-9 rounded-lg px-3 text-sm ${district === value ? "bg-brand-soft font-medium text-brand" : "text-ink-2 hover:bg-page"}`}>{value || "全部区域"}</button>)}
        </div>
      </div>
      <div className="mb-4 mt-6 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">学校列表 <span className="ml-1 text-sm font-normal text-subtle" aria-live="polite">{filtered.length} 所</span></h2>
        {active ? <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-sm text-brand"><ResetIcon />重置筛选</button> : <span className="text-xs text-subtle">登记信息 · 原型示例</span>}
      </div>
      {filtered.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(s => {
          const pub = s.nature === "公办";
          return <Link key={s.id} href={`/school/${s.id}`} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition hover:-translate-y-0.5 hover:border-brand-tint hover:shadow-[0_14px_36px_rgb(30_79_216/0.10)]">
            <div className="relative">
              <PhotoBox photo={schoolPhoto(s)} glyph={schoolGlyph(s)} className="aspect-[2/1]" sizes="(max-width: 768px) 100vw, 420px" />
              <div className="absolute left-3 top-3 flex items-center gap-1.5">
                <span className={cx("rounded-md px-2 py-0.5 text-xs font-medium shadow-sm", pub ? "bg-brand text-white" : "bg-violet-600 text-white")}>{s.nature}</span>
                <span className="rounded-md bg-white/90 px-2 py-0.5 text-xs text-ink-2 backdrop-blur">{s.district}</span>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5">
            <h3 className="text-[17px] font-semibold leading-snug text-ink group-hover:text-brand">{s.name}</h3>
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="学段">
              {s.stage.split("、").map(x => <span key={x} className="inline-flex items-center gap-1 rounded-full bg-page px-2.5 py-1 text-xs text-ink-2 ring-1 ring-line-soft"><Icon name="cap" className="size-3.5 text-subtle" />{x}</span>)}
            </div>
            <dl className="mb-4 mt-3 space-y-1.5 text-sm leading-6">
              <div className="flex gap-2"><dt className="pt-1 text-subtle"><Icon name="pin" className="size-4" /><span className="sr-only">地址</span></dt><dd className="min-w-0 text-ink-2">{s.address}</dd></div>
              <div className="flex gap-2"><dt className="pt-1 text-subtle"><Icon name="shield" className="size-4" /><span className="sr-only">主管部门</span></dt><dd className="min-w-0 text-ink-2">{s.authority}</dd></div>
            </dl>
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-soft pt-3"><span className="text-xs text-subtle">核对于 {s.checkedAt}</span><span className="inline-flex items-center gap-1 text-xs font-medium text-brand">查看档案<ArrowRightIcon className="transition group-hover:translate-x-0.5" /></span></div>
            </div>
          </Link>;
        })}
      </div> : <div className="rounded-xl border border-dashed border-line bg-white px-5 py-14 text-center"><h3 className="font-medium text-ink">没有符合条件的学校</h3><p className="mt-2 text-sm text-muted">可以换个关键词，或减少筛选条件。</p><button type="button" onClick={reset} className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm text-white">查看全部学校</button></div>}
    </section>
  );
}
