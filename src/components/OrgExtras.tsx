"use client";

import { useEffect } from "react";
import { KEYS, nowText, useStored, type AiContent, type VisitRecord } from "@/lib/demo-store";

/** 演示：机构用 AI 内容助手起草、平台审核通过的问答，追加在机构主页问答区 */
export function OrgDemoQA({ orgId }: { orgId: string }) {
  const [items] = useStored<AiContent[]>(KEYS.aiContent, []);
  const mine = items.filter((c) => c.orgId === orgId && c.status === "published");
  if (!mine.length) return null;
  return (
    <>
      {mine.map((c) => (
        <div key={c.id} className="py-3">
          <dt className="font-medium text-ink">问：{c.q}</dt>
          <dd className="mt-1 text-sm leading-6 text-muted">答：{c.a}</dd>
          <dd className="mt-1 text-[11px] text-subtle">机构填写 · 平台审核 · AI 辅助撰写 · {c.createdAt.slice(0, 10)}</dd>
        </div>
      ))}
    </>
  );
}

/** 记录浏览历史，个人中心“浏览记录”使用 */
export function OrgVisitTracker({ id, name }: { id: string; name: string }) {
  const [, setHistory] = useStored<VisitRecord[]>(KEYS.history, []);
  useEffect(() => {
    setHistory((prev) => [{ id, name, at: nowText() }, ...prev.filter((v) => v.id !== id)].slice(0, 20));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, name]);
  return null;
}
