import Link from "next/link";
import { Tag } from "@/components/ui";
import type { PublicGdRecord } from "@/lib/gd/public";

export function sourceKindLabel(kind: PublicGdRecord["sourceKind"]) {
  if (kind === "annual_check") return "年度检查公示";
  if (kind === "after_school_reference") return "课后服务参考名单";
  if (kind === "single_license_notice") return "单家办学许可公告";
  return "校外培训白名单";
}

export function GdRecordList({ records }: { records: PublicGdRecord[] }) {
  if (!records.length) return <p className="rounded-xl border border-line bg-white p-6 text-sm text-muted">暂无符合条件的来源记录。请调整筛选条件。</p>;
  return <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-white">
    {records.map((r) => <li key={r.id}>
      <Link href={"/gd/org/" + encodeURIComponent(r.id)} className="block p-4 hover:bg-brand-soft/30 focus-visible:bg-brand-soft/30">
        <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-ink">{r.name}</span><Tag tone="brand">{sourceKindLabel(r.sourceKind)}</Tag></div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle"><span>{r.city}{r.county ? " · " + r.county : ""}</span><span>名单载许可号：{r.licenseNo}</span><span>{r.publisher}</span><span>名单截至/观察时间：{r.asOf ?? "暂未核实"}</span></div>
      </Link>
    </li>)}
  </ul>;
}

export function GdPreviewNotice() {
  return <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">内部预览：来源的公开再利用条件仍在逐项审查，本页尚未批准正式对外发布。请勿将预览当作现行资质证明。</div>;
}
