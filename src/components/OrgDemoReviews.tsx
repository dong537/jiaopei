"use client";

import { KEYS, useStored, type Order } from "@/lib/demo-store";

/** 演示：个人中心提交、运营审核通过的评价，出现在机构主页（评分统计每周更新一次） */
export function OrgDemoReviews({ orgId }: { orgId: string }) {
  const [orders] = useStored<Order[]>(KEYS.orders, []);
  const mine = orders.filter((o) => o.orgId === orgId && o.review?.status === "published");
  if (!mine.length) return null;
  return (
    <ul className="divide-y divide-line-soft border-b border-line-soft">
      {mine.map((o) => (
        <li key={o.id} className="py-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-ink">演示学员</span>
            <span className="text-subtle">{o.courseName}</span>
            <span className="rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand">已报读 · 已上 {o.hoursDone} 课时</span>
            <span className="text-xs text-subtle">新评价，计入下周评分统计</span>
          </div>
          <p className="mt-2 text-sm leading-7 text-ink-2">{o.review!.text}</p>
          <div className="mt-1 text-xs text-subtle">
            师资 {o.review!.scores[0]} · 效果 {o.review!.scores[1]} · 服务 {o.review!.scores[2]} · 环境 {o.review!.scores[3]}
          </div>
        </li>
      ))}
    </ul>
  );
}
