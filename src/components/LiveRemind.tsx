"use client";

import { KEYS, useStored } from "@/lib/demo-store";
import { cx } from "./ui";

export function LiveRemind({ id }: { id: string }) {
  const [list, setList] = useStored<string[]>(KEYS.liveReminders, []);
  const on = list.includes(id);
  return (
    <button
      type="button"
      onClick={() => setList((p) => (on ? p.filter((x) => x !== id) : [id, ...p]))}
      className={cx("rounded-lg px-4 py-2 text-sm font-medium", on ? "border border-verified bg-verified-bg text-verified" : "bg-cta text-white hover:bg-cta-dark")}
    >
      {on ? "已预约 · 开播前短信提醒" : "预约提醒"}
    </button>
  );
}
