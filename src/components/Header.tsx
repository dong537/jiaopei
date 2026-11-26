import Link from "next/link";
import { Container } from "./ui";
import { site } from "@/lib/site";

export function Logo({ suffix }: { suffix?: string }) {
  return (
    <Link href="/gd" className="flex shrink-0 items-center gap-2 font-semibold text-ink">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-base text-white">教</span>
      <span className="text-lg">{site.name}</span>
      {suffix && <span className="ml-1 border-l border-line pl-3 text-sm font-normal text-subtle">{suffix}</span>}
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <Container className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-2 md:min-h-16">
        <Logo />
        <nav aria-label="主导航" className="flex items-center gap-1 text-sm">
          <Link href="/gd" className="rounded-lg px-3 py-2 font-medium text-ink-2 hover:bg-brand-soft hover:text-brand">广东名录</Link>
          <Link href="/gd/license" className="rounded-lg px-3 py-2 font-medium text-ink-2 hover:bg-brand-soft hover:text-brand">官方来源</Link>
          <Link href="/gd/methodology" className="rounded-lg px-3 py-2 font-medium text-ink-2 hover:bg-brand-soft hover:text-brand">如何核对</Link>
        </nav>
      </Container>
    </header>
  );
}
