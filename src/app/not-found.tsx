import Link from "next/link";
import { Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="py-20 text-center">
      <h1 className="text-2xl font-bold text-ink">页面不存在</h1>
      <p className="mt-2 text-muted">该名单页面不存在，或相关来源暂未接入。</p>
      <Link href="/gd" className="mt-6 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">
        返回广东名录
      </Link>
    </Container>
  );
}
