import type { Metadata } from "next";
import { Suspense } from "react";
import { MyCenter } from "@/components/MyCenter";
import { Breadcrumbs, Container } from "@/components/ui";
import { orgs } from "@/lib/data";
import { liveClasses } from "@/lib/live";

export const metadata: Metadata = { title: "个人中心", robots: { index: false, follow: false } };

export default function MePage() {
  const orgMap = Object.fromEntries(orgs.map((o) => [o.id, { name: o.name, area: `${o.district}${o.area}`, priceText: o.priceText }]));
  const liveMap = Object.fromEntries(liveClasses.map((l) => [l.id, { title: l.title, start: l.start }]));
  return (
    <Container>
      <Breadcrumbs items={[{ name: "个人中心" }]} />
      <h1 className="text-2xl font-bold text-ink">个人中心</h1>
      <p className="mb-5 mt-1 text-sm text-subtle">原型演示：以本机浏览器模拟已登录学员，预约、订单、收藏都保存在本机。正式环境用手机号登录。</p>
      <Suspense fallback={<p className="text-muted">正在加载…</p>}>
        <MyCenter orgs={orgMap} liveTitles={liveMap} />
      </Suspense>
    </Container>
  );
}
