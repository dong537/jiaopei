"use client";

import { useState, type ReactNode } from "react";
import { cx } from "./ui";

const pill = (on: boolean) =>
  cx(
    "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition",
    on ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-2 hover:border-brand hover:text-brand",
  );

/** 按类别筛选卡片。所有卡片都在 HTML 里，只是切换显示，搜索引擎和 AI 抓取能看到全部内容 */
export function FilterTabs({
  tabs,
  items,
  limit,
  gridClassName,
}: {
  tabs: { key: string; label: string }[];
  items: { key: string; node: ReactNode }[];
  limit: number;
  gridClassName: string;
}) {
  const [active, setActive] = useState("all");
  const visible: boolean[] = [];
  let shown = 0;
  for (const it of items) {
    const ok = (active === "all" || it.key === active) && shown < limit;
    if (ok) shown += 1;
    visible.push(ok);
  }
  return (
    <>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t.key === active} className={pill(t.key === active)} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className={gridClassName}>
        {items.map((it, i) => (
          <div key={i} hidden={!visible[i]} className="contents">
            {it.node}
          </div>
        ))}
      </div>
    </>
  );
}

/** 榜单切换。每个面板都已在服务端渲染好 */
export function PanelTabs({ tabs, panels, size = "md" }: { tabs: string[]; panels: ReactNode[]; size?: "sm" | "md" }) {
  const [active, setActive] = useState(0);
  return (
    <>
      <div className={cx("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0", size === "sm" ? "mb-3" : "mb-4")} role="tablist">
        {tabs.map((t, i) => (
          <button key={t} type="button" role="tab" aria-selected={i === active} className={pill(i === active)} onClick={() => setActive(i)}>
            {t}
          </button>
        ))}
      </div>
      {panels.map((p, i) => (
        <div key={i} role="tabpanel" hidden={i !== active}>
          {p}
        </div>
      ))}
    </>
  );
}
