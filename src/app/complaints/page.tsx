import type { Metadata } from "next";
import Link from "next/link";
import { ComplaintCenter } from "@/components/ComplaintCenter";
import { Container, FaqList, HeroStats, PageHero, SectionTitle } from "@/components/ui";
import { orgs } from "@/lib/data";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "投诉帮：培训退费纠纷、虚假宣传怎么投诉",
  description: "教培网投诉帮：1 个工作日内受理，7 个工作日内给出处理意见；在平台付款的订单按担保规则退款，线下付款的协助对接机构与主管部门。",
  alternates: { canonical: "/complaints" },
};

const steps = [
  ["提交", "填写机构、订单号（如有）和诉求"],
  ["受理", "1 个工作日内电话联系你，核对材料"],
  ["协调", "联系机构，7 个工作日内给出处理意见"],
  ["结果", "达成一致即结案；协调不成，协助向主管部门或 12315 投诉"],
];

const faqs = [
  { q: "在教培网付的学费，机构不退怎么办？", a: "平台付款的学费由持牌支付机构存管，按课时分 4 次结算给机构。未结算部分由平台直接按规则原路退回，不需要机构同意，7 天内到账。" },
  { q: "线下直接付给机构的钱，平台能管吗？", a: "平台不经手这部分资金，只能协调。我们会联系机构、核对合同，协调不成时协助你整理材料，向当地教育主管部门、市场监管部门或 12315 投诉。" },
  { q: "投诉会影响机构在教培网的展示吗？", a: "单条投诉不会。经核实的违规（虚假宣传、拒不退费、停课）会按规则处理：撤下相关内容、暂停在线报名，情节严重的取消核验。处理结果在机构页“投诉与行政处罚记录”中公示。" },
];

export default function ComplaintsPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "投诉帮" }]}
        eyebrow="退费纠纷 · 虚假宣传 · 停课"
        icon="shield"
        title="投诉帮"
        description={
          <>
            <p>1 个工作日内受理，7 个工作日内给出处理意见。在教培网付款的订单，未上课部分由平台按担保规则直接退款；线下付款的，平台协调机构，协调不成时协助你向主管部门投诉。</p>
            <p className="mt-2 text-xs text-subtle">服务热线 {site.hotline}（9:00–21:00）· 处理规则见数据来源与核验标准</p>
          </>
        }
        aside={
          <HeroStats
            items={[
              { label: "受理时限", value: <>1<span className="ml-1 text-sm font-normal text-subtle">个工作日</span></> },
              { label: "处理意见", value: <>7<span className="ml-1 text-sm font-normal text-subtle">个工作日内</span></> },
              { label: "平台付款退款", value: <>7<span className="ml-1 text-sm font-normal text-subtle">天内到账</span></> },
              { label: "服务时间", value: <span className="text-lg">9:00–21:00</span> },
            ]}
          />
        }
      />
      <Container className="pt-6 md:pt-7">
      <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {steps.map(([t, d], i) => (
          <li key={t} className="relative rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-full bg-cta text-xs font-semibold text-white tabular">{i + 1}</span>
              <span className="font-semibold text-ink">{t}</span>
            </div>
            <div className="mt-2 text-sm leading-6 text-muted">{d}</div>
            {i < steps.length - 1 && <span aria-hidden className="absolute -right-2.5 top-1/2 z-10 hidden size-5 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-[11px] text-subtle lg:flex">›</span>}
          </li>
        ))}
      </ol>
      <div className="mt-6">
        <ComplaintCenter orgNames={orgs.map((o) => o.name)} />
      </div>
      <section className="mt-8 rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] md:p-6">
        <SectionTitle>常见问题</SectionTitle>
        <FaqList items={faqs} />
      </section>
      <p className="mt-4 text-xs text-subtle">
        处理规则：
        <Link href="/about/methodology#complaints" className="text-brand hover:underline">
          数据来源与核验标准 · 投诉帮扶
        </Link>
      </p>
      </Container>
    </>
  );
}
