"use client";

import { useState } from "react";
import { checkCompliance } from "@/lib/compliance";
import { KEYS, newId, nowText, useStored, type AiContent, type Booking, type BrandApp } from "@/lib/demo-store";
import { cx } from "./ui";

const statusText = {
  pending: { label: "平台审核中", cls: "bg-orange-100 text-cta-dark" },
  published: { label: "已发布到机构主页", cls: "bg-verified-bg text-verified" },
  rejected: { label: "未通过", cls: "bg-line-soft text-muted" },
} as const;

/** AI 内容助手：选问题 → 生成草稿 → 机构修改 → 合规检查 → 提交平台审核 → 发布到机构主页问答 */
export function AiStudio({ orgId, orgName, suggestions }: { orgId: string; orgName: string; suggestions: { q: string; draft: string }[] }) {
  const [items, setItems] = useStored<AiContent[]>(KEYS.aiContent, []);
  const [q, setQ] = useState(suggestions[0]?.q ?? "");
  const [a, setA] = useState("");
  const [drafted, setDrafted] = useState(false);
  const check = checkCompliance(`${q} ${a}`);
  const mine = items.filter((c) => c.orgId === orgId);

  function draft(question: string) {
    const s = suggestions.find((x) => x.q === question);
    setQ(question);
    setA(s?.draft ?? `关于“${question}”：[请填写：直接回答，第一句给结论]。[请填写：具体条件、价格或时间]。如需进一步了解，可以在本页预约试听，老师会通过平台虚拟号联系你。`);
    setDrafted(true);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-3">
        <div>
          <label htmlFor="ai-q" className="mb-1 block text-sm text-ink-2">
            要回答的问题
          </label>
          <div className="flex gap-2">
            <input id="ai-q" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 flex-1 rounded-lg border border-line px-3 text-sm outline-none focus:border-brand" />
            <button type="button" onClick={() => draft(q)} disabled={!q.trim()} className="rounded-lg bg-brand px-4 text-sm text-white hover:bg-brand-dark disabled:opacity-40">
              AI 起草
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s.q} type="button" onClick={() => draft(s.q)} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 hover:border-brand hover:text-brand">
                {s.q}
              </button>
            ))}
          </div>
        </div>
        {drafted && (
          <>
            <div>
              <label htmlFor="ai-a" className="mb-1 block text-sm text-ink-2">
                回答（草稿只用主页已有数据，方括号处需要你补充）
              </label>
              <textarea id="ai-a" value={a} onChange={(e) => setA(e.target.value)} className="h-36 w-full rounded-lg border border-line p-3 text-sm leading-6 outline-none focus:border-brand" />
            </div>
            <div className={cx("rounded-lg p-3 text-sm", check.ok ? "bg-verified-bg text-verified" : "bg-orange-50 text-cta-dark")} role="status">
              {check.ok ? (
                "合规检查通过：未发现效果承诺和绝对化用语，可以提交平台审核。"
              ) : (
                <>
                  <div className="font-medium">提交前需要修改：</div>
                  {check.blanks > 0 && <div>· 还有 {check.blanks} 处“[请填写]”未补充</div>}
                  {check.hits.map((h) => (
                    <div key={h.word}>
                      · “{h.word}”：{h.why}（《广告法》与校外培训广告管理要求不允许）
                    </div>
                  ))}
                </>
              )}
            </div>
            <button
              type="button"
              disabled={!check.ok}
              onClick={() => {
                setItems((prev) => [{ id: newId("Q"), orgId, orgName, q: q.trim(), a: a.trim(), createdAt: nowText(), status: "pending" }, ...prev]);
                setDrafted(false);
                setA("");
              }}
              className="h-10 rounded-lg bg-cta px-5 text-sm font-medium text-white hover:bg-cta-dark disabled:opacity-40"
            >
              提交平台审核
            </button>
          </>
        )}
      </div>
      <div>
        <div className="mb-2 text-sm font-medium text-ink">我提交的内容（{mine.length}）</div>
        {mine.length ? (
          <ul className="space-y-2">
            {mine.map((c) => (
              <li key={c.id} className="rounded-lg border border-line p-2.5 text-xs">
                <span className={cx("rounded px-1.5 py-0.5", statusText[c.status].cls)}>{statusText[c.status].label}</span>
                <div className="mt-1 text-ink">{c.q}</div>
                <div className="mt-0.5 line-clamp-2 text-muted">{c.a}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-page p-3 text-xs leading-5 text-subtle">提交后在运营后台“内容审核”处理，通过后显示在机构主页问答区，标注“AI 辅助撰写”，并进入 AI 咨询助手的知识。</p>
        )}
      </div>
    </div>
  );
}

/** 品牌内容申请：机构供稿、编辑审核，页面标注“品牌内容”，不进榜单、不进编辑指南 */
export function BrandApply({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [apps, setApps] = useStored<BrandApp[]>(KEYS.brandApps, []);
  const [topic, setTopic] = useState("雅思口语 Part 2 备考方法分享");
  const check = checkCompliance(topic);
  const mine = apps.filter((x) => x.orgId === orgId);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex gap-2">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="品牌内容选题" className="h-9 flex-1 rounded-lg border border-line px-3 outline-none focus:border-brand" />
        <button
          type="button"
          disabled={!check.ok || !topic.trim()}
          onClick={() => setApps((p) => [{ id: newId("B"), orgId, orgName, topic: topic.trim(), createdAt: nowText(), status: "pending" }, ...p])}
          className="rounded-lg border border-brand px-3 text-brand hover:bg-brand-soft disabled:opacity-40"
        >
          申请
        </button>
      </div>
      {!check.ok && check.hits.length > 0 && <p className="text-xs text-cta-dark">选题含“{check.hits[0].word}”（{check.hits[0].why}），请修改。</p>}
      {mine.map((x) => (
        <div key={x.id} className="flex justify-between rounded bg-page px-2 py-1 text-xs">
          <span className="text-ink-2">{x.topic}</span>
          <span className={x.status === "scheduled" ? "text-verified" : "text-cta-dark"}>{x.status === "scheduled" ? "已排期" : "编辑审核中"}</span>
        </div>
      ))}
    </div>
  );
}

/** AI 咨询助手转人工的线索数（演示数据 + 本机演示操作） */
export function AssistantLiveCount({ orgId, base }: { orgId: string; base: number }) {
  const [bookings] = useStored<Booking[]>(KEYS.bookings, []);
  return <>{base + bookings.filter((b) => b.kind === "ai" && b.orgId === orgId).length}</>;
}
