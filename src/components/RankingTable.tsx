import Link from "next/link";
import type { Ranking } from "@/lib/rankings";
import { PhotoBox, cx } from "./ui";

export const medals = [
  "bg-gradient-to-b from-amber-200 to-amber-400 text-amber-950 shadow-[0_2px_6px_rgb(245_158_11/0.35)]",
  "bg-gradient-to-b from-slate-100 to-slate-300 text-slate-800 shadow-[0_2px_6px_rgb(100_116_139/0.25)]",
  "bg-gradient-to-b from-orange-100 to-orange-300 text-orange-950 shadow-[0_2px_6px_rgb(234_88_12/0.25)]",
];

function RankNo({ n }: { n: number }) {
  return (
    <span className={cx("inline-flex size-7 items-center justify-center rounded-full text-xs font-bold tabular", medals[n - 1] ?? "bg-line-soft text-muted")}>
      {n}
    </span>
  );
}

export function RankingTable({ ranking, limit, showMeta = true }: { ranking: Ranking; limit?: number; showMeta?: boolean }) {
  const rows = limit ? ranking.rows.slice(0, limit) : ranking.rows;
  if (!rows.length) {
    return <p className="rounded-lg bg-page p-4 text-sm text-muted">暂无机构达到入榜门槛（{ranking.gate}）。</p>;
  }
  // 条形长度从 0 起算：评分按满分 5 分，其他指标按本榜最大值
  const scale = ranking.key === "rating" ? 5 : Math.max(...ranking.rows.map((r) => r.value));
  return (
    <div>
      <table className="w-full text-sm">
        <caption className="sr-only">
          {ranking.name}：{ranking.basis}
        </caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-subtle">
            <th className="w-12 py-2 font-normal">排名</th>
            <th className="py-2 font-normal">机构</th>
            <th className="hidden py-2 font-normal sm:table-cell">区域</th>
            <th className="w-36 py-2 text-right font-normal">{ranking.unit}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.org.id} className={cx("border-b border-line-soft last:border-0", i === 0 && "bg-gradient-to-r from-amber-50/80 to-transparent")}>
              <td className="py-3 pl-1">
                <RankNo n={i + 1} />
              </td>
              <td className="py-2.5">
                <Link href={`/org/${r.org.id}`} className="group/org flex items-center gap-3">
                  <PhotoBox photo={r.org.photo} compact className="size-9 shrink-0 rounded-lg ring-1 ring-ink/5" sizes="36px" />
                  <span className="min-w-0">
                    <span className={cx("block text-ink group-hover/org:text-brand", i < 3 ? "font-semibold" : "font-medium")}>{r.org.name}</span>
                    <span className="block text-xs text-subtle sm:hidden">{r.org.district}</span>
                  </span>
                </Link>
              </td>
              <td className="hidden py-3 text-muted sm:table-cell">
                {r.org.district} · {r.org.campusCount} 个校区
              </td>
              <td className="py-3 pr-1 text-right">
                <div className="font-semibold text-ink tabular">{r.display}</div>
                <div className="ml-auto mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-line-soft" aria-hidden>
                  <div className={cx("h-full rounded-full", i === 0 ? "bg-amber-400" : "bg-brand/60")} style={{ width: `${scale ? Math.max(4, (r.value / scale) * 100) : 0}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showMeta && (
        <p className="mt-3 text-xs leading-5 text-subtle">
          统计周期：{ranking.period} · 入榜门槛：{ranking.gate} · 来源：{ranking.source}
        </p>
      )}
    </div>
  );
}
