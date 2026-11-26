"use client";

import Link from "next/link";
import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Cross2Icon, HamburgerMenuIcon } from "@radix-ui/react-icons";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "./ui";
import { useSelectedCity } from "./useSelectedCity";

const navigationItems = (slug: string) => [
  ["找机构", `/city/${slug}`], ["广东名录", "/gd"],
  ["找课程", "/search?type=course"],
  ["榜单", `/rankings/${slug}/yasi`], ["考试与证书", "/exam/ielts"],
  ["学校库", "/school"], ["政策法规", "/policies"],
  ["选课指南", "/guide/how-to-verify-training-institution"],
];

/** 路径前缀相同且链接里的查询参数都匹配才算当前页，避免“找课程”在普通搜索页也高亮 */
function useIsActive() {
  const path = usePathname();
  const params = useSearchParams();
  return (href: string) => {
    const [base, query] = href.split("?");
    if (!path.startsWith(base)) return false;
    return [...new URLSearchParams(query)].every(([k, v]) => params.get(k) === v);
  };
}

export function MainNavigation() {
  const city = useSelectedCity();
  const isActive = useIsActive();
  const nav = navigationItems(city.slug);
  return <nav aria-label="主导航" className="hidden min-w-0 flex-1 items-center gap-0.5 xl:flex">
    {nav.map(([label, href]) => { const active = isActive(href); return <Link key={label} href={href} aria-current={active ? "page" : undefined} className={`whitespace-nowrap rounded-md px-2.5 py-2 text-sm ${active ? "bg-brand-soft font-medium text-brand" : "text-ink-2 hover:bg-brand-soft hover:text-brand"}`}>{label}</Link>; })}
  </nav>;
}

export function NavigationMenu() {
  const city = useSelectedCity();
  const isActive = useIsActive();
  const [open, setOpen] = useState(false);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild><button type="button" aria-label="浏览导航" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-2 hover:bg-brand-soft data-[state=open]:text-brand xl:hidden"><HamburgerMenuIcon className="size-5" /></button></Popover.Trigger>
    <Popover.Portal><Popover.Content align="end" sideOffset={12} collisionPadding={12} aria-label="网站导航" className="z-50 w-[320px] max-w-[calc(100vw-24px)] rounded-xl border border-line bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-ink">网站导航</h2><Popover.Close aria-label="关闭导航" className="rounded-md p-1 text-subtle hover:bg-page"><Cross2Icon /></Popover.Close></div>
      <nav aria-label="折叠主导航" className="grid grid-cols-2 gap-2">{[...navigationItems(city.slug), ["站内搜索", "/search"]].map(([label, href]) => <Link key={label} href={href} onClick={() => setOpen(false)} aria-current={isActive(href) ? "page" : undefined} className={`rounded-lg px-3 py-3 text-sm ${isActive(href) ? "bg-brand-soft font-medium text-brand" : "bg-page text-ink-2 hover:bg-brand-soft hover:text-brand"}`}>{label}</Link>)}</nav>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}

export function MobileTabBar() {
  const city = useSelectedCity();
  const path = usePathname();
  const tabs = [
    { label: "首页", href: "/", icon: "home", active: path === "/" },
    { label: "找机构", href: `/city/${city.slug}`, icon: "list", active: path.startsWith("/city/") || path.startsWith("/org/") },
    { label: "榜单", href: `/rankings/${city.slug}/yasi`, icon: "trophy", active: path.startsWith("/rankings/") },
    { label: "我的", href: "/me", icon: "user", active: path === "/me" },
  ];
  return <nav aria-label="底部导航" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
    {tabs.map(t => <Link key={t.label} href={t.href} aria-current={t.active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${t.active ? "font-medium text-brand" : "text-muted hover:text-brand"}`}><Icon name={t.icon} className="size-5" />{t.label}</Link>)}
  </nav>;
}
