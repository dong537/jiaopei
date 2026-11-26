import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageFootnote, PageHero, SectionTitle } from "@/components/ui";
import { GdPreviewNotice } from "@/components/gd/GdRecordList";
import { getPublicProjection } from "@/lib/gd/public";

export function generateMetadata(): Metadata {
  const projection = getPublicProjection();
  return {
    title: "如何理解校外培训机构名单与办学许可记录",
    description: "解释广东教培来源记录中的白名单、年检、许可号、地址、培训项目与时间字段，并说明如何回查主管部门原文。",
    alternates: { canonical: "/gd/methodology" },
    robots: { index: Boolean(projection && !projection.preview) },
  };
}

const sourceTypes = [
  { name: "校外培训白名单", evidence: "说明发布单位在这份名单中列有该条记录。", limit: "不能单独证明许可证当前仍有效、机构正在经营或全省完整覆盖。" },
  { name: "课后服务参考名单", evidence: "说明该记录出现在供校内课后服务遴选参考的资料中。", limit: "不能等同于面向所有培训场景的持证白名单。" },
  { name: "年度检查公示", evidence: "说明发布单位公布过该年度的检查记录；具体结论以该行原文为准。", limit: "被列入年检公告不等于年检合格，也不代表现时许可状态。" },
  { name: "单家许可公告", evidence: "说明发布单位曾对特定对象公布过许可事项。", limit: "不是该地区机构的完整名录，不能推定后来没有变更或撤回。" },
];

export default function MethodologyPage() {
  const data = getPublicProjection();
  return <>
    <PageHero breadcrumbRoot={{ name: "广东名录", href: "/gd" }} crumbs={[{ name: "如何理解名单" }]} eyebrow="查证方法 · 字段口径" icon="shield" title="如何理解一条校外培训机构名单记录" description="先看这条记录来自哪份公告、何时适用，再核对原文中的许可号、结论和备注。本站展示历史刊载事实，不代替主管部门确认当前状态。" />
    <Container className="space-y-9 pt-6 md:pt-8">
      {data?.preview && <GdPreviewNotice />}
      <section>
        <SectionTitle>四类来源分别说明什么</SectionTitle>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {sourceTypes.map((item) => <article key={item.name} className="rounded-xl border border-line bg-white p-5">
            <h3 className="font-semibold text-ink">{item.name}</h3>
            <p className="mt-3 text-sm leading-6 text-ink-2">{item.evidence}</p>
            <p className="mt-2 text-sm leading-6 text-muted">解读边界：{item.limit}</p>
          </article>)}
        </div>
        <p className="mt-3 text-sm text-muted">每条记录都标注来源类别。<Link href="/gd/license" className="text-brand underline-offset-2 hover:underline">查看已接入公告及逐条检索</Link>。</p>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 md:p-6">
        <SectionTitle>页面字段怎么读</SectionTitle>
        <dl className="mt-3 divide-y divide-line-soft text-sm leading-6">
          <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"><dt className="font-medium text-ink">机构名称与许可号</dt><dd className="text-muted">按本站取得的来源记录展示；同名不自动认定为同一机构，名单载有许可号也不单独证明当前有效期。</dd></div>
          <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"><dt className="font-medium text-ink">名单记载地址</dt><dd className="text-muted">是原记录中的地址字段，不自动认定为独立校区或实际授课地点。</dd></div>
          <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"><dt className="font-medium text-ink">培训项目</dt><dd className="text-muted">是公告或附件的原文分类，不等于当前在售课程、价格或可报名班次。</dd></div>
          <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"><dt className="font-medium text-ink">名单时间与采集时间</dt><dd className="text-muted">前者描述原名单的截至日或观察时点；后者是本站取得资料的时间。两者都不是许可证有效期。未核实的日期保留未知。</dd></div>
          <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"><dt className="font-medium text-ink">暂未核实的字段</dt><dd className="text-muted">本站尚未取得或未完成字段提取，不能据此断言原公告没有该信息，更不能以零或推测值补齐。</dd></div>
        </dl>
      </section>

      <section>
        <SectionTitle>核对一条记录的顺序</SectionTitle>
        <ol className="mt-3 grid gap-3 md:grid-cols-3">
          <li className="rounded-xl border border-line bg-white p-5"><strong className="text-ink">1. 找到原公告</strong><p className="mt-2 text-sm leading-6 text-muted">在档案页查看发布单位、公告标题和来源链接；确认是在查询同一条记录。</p></li>
          <li className="rounded-xl border border-line bg-white p-5"><strong className="text-ink">2. 读日期、结论与备注</strong><p className="mt-2 text-sm leading-6 text-muted">查看名单截至日、年度检查结论和单条备注。本站未提取的部分以原件为准。</p></li>
          <li className="rounded-xl border border-line bg-white p-5"><strong className="text-ink">3. 核实当前状态</strong><p className="mt-2 text-sm leading-6 text-muted">若要判断现时办学资质，应进一步向相应主管部门核对最新许可与变更信息。</p></li>
        </ol>
        <p className="mt-3 text-sm leading-6 text-muted">本站未收录某机构，只表示当前接入来源中没有可展示记录，不能据此认定其无证或不合规。</p>
      </section>

      <nav aria-label="继续查询" className="flex flex-wrap gap-3 border-t border-line pt-6 text-sm">
        <Link href="/gd" className="rounded-lg border border-line bg-white px-4 py-2 text-brand hover:border-brand">返回广东地市目录</Link>
        <Link href="/gd/license" className="rounded-lg border border-line bg-white px-4 py-2 text-brand hover:border-brand">查询官方来源记录</Link>
      </nav>
      <PageFootnote correctionHref={null}>说明页只解释本站的数据口径，不提供机构评价、课程报价或报名服务。具体信息以发布单位原公告和最新通知为准。</PageFootnote>
    </Container>
  </>;
}
