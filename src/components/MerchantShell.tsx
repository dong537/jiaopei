import Link from "next/link";
import type { ReactNode } from "react";
import type { Org } from "@/lib/types";
import { Container, VerificationBadge, cx } from "./ui";

const menu = [
  ["概览", 0, "/merchant"],
  ["机构主页", 0, "/org/gz-waiyu"],
  ["微官网", 0, "/site/gz-waiyu"],
  ["课程管理", 0, ""],
  ["校区与教师", 0, ""],
  ["线索", 5, "/merchant#leads"],
  ["订单与结算", 1, "/merchant#orders"],
  ["评价与问答", 3, ""],
  ["AI 营销", 0, "/merchant/ai"],
  ["数据看板", 0, ""],
  ["推广", 0, ""],
  ["账户与套餐", 0, "/merchant#account"],
] as const;

/** 商家中心外框：顶部机构信息 + 左侧菜单。原型只做了概览和 AI 营销两页，其余菜单项跳到对应区块 */
export function MerchantShell({ org, active, children }: { org: Org; active: string; children: ReactNode }) {
  return (
    <div id="top" className="bg-line-soft">
      <Container className="py-6">
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-5 py-3">
          <span className="text-sm font-semibold text-brand">商家中心</span>
          <span className="font-semibold text-ink">{org.name}</span>
          <VerificationBadge status={org.verification} />
          <span className="text-xs text-subtle">有效至 {org.verifiedUntil}</span>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
            <Link href={`/org/${org.id}`} className="text-brand hover:underline">
              查看机构主页
            </Link>
            <span className="rounded bg-brand-soft px-2 py-0.5 text-xs text-brand">年费会员 · 到期 2027-03-31</span>
            <span className="text-muted">[运营人姓名]</span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
          <nav aria-label="商家中心菜单" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-2 lg:flex-col lg:self-start">
            {menu.map(([t, badge, href]) => {
              const cls = cx(
                "flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm",
                t === active ? "bg-brand-soft font-medium text-brand" : href ? "text-ink-2 hover:bg-page" : "text-subtle",
              );
              const inner = (
                <>
                  {t}
                  {t === "AI 营销" && t !== active && <span className="rounded bg-cta px-1 text-[10px] leading-4 text-white">增值</span>}
                  {badge > 0 && <span className="rounded-full bg-cta px-1.5 text-[11px] leading-5 text-white">{badge}</span>}
                </>
              );
              return href ? (
                <Link key={t} href={href} className={cls}>
                  {inner}
                </Link>
              ) : (
                <span key={t} className={cls} title="原型未展开此页">
                  {inner}
                </span>
              );
            })}
          </nav>
          <div className="min-w-0 space-y-4">{children}</div>
        </div>
      </Container>
    </div>
  );
}
