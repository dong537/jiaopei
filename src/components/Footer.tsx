import Link from "next/link";
import { Container } from "./ui";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-line bg-white">
      <Container className="flex flex-wrap items-center gap-x-5 gap-y-2 py-6 text-xs leading-5 text-subtle">
        <span>© 2026 {site.name}</span>
        <Link href="/gd" className="hover:text-brand">广东名录</Link>
        <Link href="/gd/license" className="hover:text-brand">官方名单与来源</Link>
        <Link href="/gd/methodology" className="hover:text-brand">如何理解名单</Link>
        <span className="basis-full">本站展示已接入来源的历史刊载记录；机构最新资质请以主管部门公布信息为准。</span>
      </Container>
    </footer>
  );
}
