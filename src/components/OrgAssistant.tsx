"use client";

import { useState, type FormEvent } from "react";
import { answer, type AssistantKnowledge, type AssistantReply } from "@/lib/assistant";
import { KEYS, newId, nowText, useStored, type AiContent, type Booking } from "@/lib/demo-store";
import { cx } from "./ui";

type Msg = { from: "user" | "ai"; text: string; source?: string; handoff?: boolean };

const quick = ["雅思冲刺班多少钱？", "最近什么时候开班？", "中途退费怎么办？", "能保证考到 6.5 吗？", "可以分期付款吗？"];

/** 机构主页 AI 咨询助手（AI 营销增值服务）。只用本页数据回答，答不了的转机构老师，记为该机构的独享线索 */
export function OrgAssistant({ orgId, knowledge }: { orgId: string; knowledge: AssistantKnowledge }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "ai", text: `你好，我是${knowledge.orgName}的 AI 咨询助手。可以问我课程价格、开班时间、校区、试听和退费。我只根据本页已发布的信息回答。` },
  ]);
  const [handoffQ, setHandoffQ] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [aiContent] = useStored<AiContent[]>(KEYS.aiContent, []);
  const [, setBookings] = useStored<Booking[]>(KEYS.bookings, []);

  // 运营审核通过的 AI 辅助问答，同样进入助手的知识
  const kb: AssistantKnowledge = {
    ...knowledge,
    qa: [...knowledge.qa, ...aiContent.filter((c) => c.orgId === orgId && c.status === "published").map((c) => ({ q: c.q, a: c.a }))],
  };

  function ask(q: string) {
    if (!q.trim()) return;
    const r: AssistantReply = answer(kb, q.trim());
    setMsgs((m) => [...m, { from: "user", text: q.trim() }, { from: "ai", ...r }]);
    if (r.handoff) {
      setHandoffQ(q.trim());
      setSent(false);
    }
    setInput("");
  }

  function submitHandoff(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) return;
    const fd = new FormData(e.currentTarget);
    const phone = String(fd.get("phone"));
    setBookings((prev) => [
      {
        id: newId("A"),
        kind: "ai",
        orgId,
        orgName: knowledge.orgName,
        detail: `AI 助手转人工：${handoffQ}`,
        name: String(fd.get("name") || "学员"),
        phone: phone.slice(0, 3) + "****" + phone.slice(-4),
        createdAt: nowText(),
      },
      ...prev,
    ]);
    setSent(true);
    setHandoffQ(null);
    setMsgs((m) => [...m, { from: "ai", text: "已转给机构老师，老师会通过平台虚拟号联系你。可在个人中心 · 我的预约查看。" }]);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-brand-dark md:bottom-6 md:right-6"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-white/20 text-xs">AI</span>
        问问 AI 助手
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="AI 咨询助手"
      className="fixed inset-x-2 bottom-20 z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl md:inset-x-auto md:bottom-6 md:right-6 md:w-[380px]"
    >
      <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
        <div>
          <div className="text-sm font-semibold">AI 咨询助手</div>
          <div className="text-[11px] opacity-80">只根据本页信息回答 · 不承诺效果 · 答不了转机构老师</div>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded px-2 text-lg leading-none hover:bg-white/15" aria-label="关闭">
          ×
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-page p-3 text-sm">
        {msgs.map((m, i) => (
          <div key={i} className={cx("flex", m.from === "user" ? "justify-end" : "justify-start")}>
            <div className={cx("max-w-[85%] rounded-xl px-3 py-2 leading-6", m.from === "user" ? "bg-brand text-white" : "border border-line bg-white text-ink")}>
              {m.text}
              {m.source && <div className="mt-1 border-t border-line-soft pt-1 text-[11px] text-subtle">依据：{m.source}</div>}
            </div>
          </div>
        ))}
        {handoffQ && !sent && (
          <form onSubmit={submitHandoff} className="space-y-2 rounded-xl border border-cta/40 bg-white p-3">
            <div className="text-xs text-ink-2">转给机构老师回答：{handoffQ}</div>
            <input name="name" placeholder="称呼（选填）" className="h-9 w-full rounded-lg border border-line px-2 text-sm" />
            <input name="phone" required type="tel" pattern="1[0-9]{10}" maxLength={11} inputMode="numeric" placeholder="11 位手机号" className="h-9 w-full rounded-lg border border-line px-2 text-sm" />
            <label className="flex items-start gap-1.5 text-[11px] leading-4 text-subtle">
              <input type="checkbox" required defaultChecked className="mt-0.5" />
              同意以虚拟号形式提供给本机构回电
            </label>
            <button type="submit" className="h-9 w-full rounded-lg bg-cta text-sm text-white hover:bg-cta-dark">
              转给机构老师
            </button>
          </form>
        )}
      </div>
      <div className="border-t border-line bg-white p-2">
        <div className="mb-2 flex gap-1.5 overflow-x-auto">
          {quick.map((q) => (
            <button key={q} type="button" onClick={() => ask(q)} className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 hover:border-brand hover:text-brand">
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的问题"
            aria-label="输入你的问题"
            className="h-9 flex-1 rounded-lg border border-line px-3 text-sm outline-none focus:border-brand"
          />
          <button type="submit" className="rounded-lg bg-brand px-3 text-sm text-white">
            发送
          </button>
        </form>
        <p className="mt-1.5 text-[10px] leading-4 text-subtle">AI 生成的回答仅供参考，以机构合同和本页信息为准。由教培网提供，服务已备案。</p>
      </div>
    </div>
  );
}
