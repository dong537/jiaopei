import { Container } from "@/components/ui";

export default function Loading() {
  return <Container className="py-8"><div role="status" aria-live="polite" className="motion-safe:animate-pulse"><span className="sr-only">正在加载页面</span><div aria-hidden="true"><div className="mb-6 h-4 w-36 rounded bg-line" /><div className="h-9 w-2/3 max-w-xl rounded bg-line" /><div className="mt-5 h-28 rounded-xl bg-brand-soft" /><div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0,1,2].map(i => <div key={i} className="h-48 rounded-xl border border-line bg-white p-5"><div className="mb-4 h-5 w-2/3 rounded bg-line" /><div className="mb-3 h-3 w-full rounded bg-line-soft" /><div className="h-3 w-4/5 rounded bg-line-soft" /></div>)}</div></div></div></Container>;
}
