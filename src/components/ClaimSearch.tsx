"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type Candidate = { id: string; name: string; area: string; code: string; status: "unclaimed" | "claimed" | "verified"; views?: number; leads?: number };

/** 认领前先查机构是否已被收录（原型只在示例数据里查） */
export function ClaimSearch({ candidates, initial }: { candidates: Candidate[]; initial: string }) {
  const [q, setQ] = useState(initial);
  const [term, setTerm] = useState(initial);
  const results = term.trim() ? candidates.filter((c) => c.name.includes(term.trim())) : [];

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTerm(q);
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex max-w-xl overflow-hidden rounded-lg border border-line bg-white focus-within:border-brand">
        <label htmlFor="claim-q" className="sr-only">
          机构名称
        </label>
        <input id="claim-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="输入营业执照上的机构名称" className="h-11 min-w-0 flex-1 px-3 text-sm outline-none" />
        <button className="bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark">查找</button>
      </form>
      <div className="mt-4 space-y-3">
        {results.slice(0, 3).map((c) => (
          <div key={c.id} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <span className={`rounded px-2 py-0.5 text-xs ${c.status === "unclaimed" ? "bg-line-soft text-muted" : "bg-claimed-bg text-claimed"}`}>
                {c.status === "unclaimed" ? "官方登记信息 · 待机构认领" : "已被认领"}
              </span>
              <div className="mt-1.5 font-semibold text-ink">
                <Link href={`/org/${c.id}`} className="hover:text-brand">
                  {c.name}
                </Link>
              </div>
              <div className="text-sm text-muted">
                {c.area} · 统一社会信用代码 {c.code}
              </div>
              {c.status === "unclaimed" && c.views && (
                <div className="mt-1 text-sm text-cta-dark">
                  本页近 30 天被访问 {c.views} 次，有 {c.leads} 位学员想咨询，认领后可查看
                </div>
              )}
            </div>
            {c.status === "unclaimed" ? (
              <Link href={`/join/apply?claim=${c.id}`} className="rounded-lg bg-cta px-4 py-2 text-center text-sm font-medium text-white hover:bg-cta-dark">
                认领这家机构
              </Link>
            ) : (
              <Link href={`/join/apply?claim=${c.id}`} className="text-xs text-brand hover:underline">
                认领有误？提交申诉
              </Link>
            )}
          </div>
        ))}
        {term.trim() && results.length === 0 && <p className="text-sm text-muted">没有找到“{term}”。</p>}
        <p className="text-sm text-muted">
          没找到？
          <Link href="/join/apply" className="text-brand hover:underline">
            新建机构主页
          </Link>
        </p>
      </div>
    </div>
  );
}
