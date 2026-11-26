import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Card, Container, SectionTitle } from "@/components/ui";
import { BAYES_M } from "@/lib/rankings";
import { absoluteUrl, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "数据来源、核验标准与排名规则",
  description: "教培网的机构信息从哪里来、“平台已核验”的标准、榜单如何计算、推广位如何标注，以及更正与投诉流程。",
  alternates: { canonical: "/about/methodology" },
};

const sections = [
  {
    id: "sources",
    title: "数据来源",
    body: [
      "机构主体信息（名称、统一社会信用代码、成立日期、经营状态）来自国家企业信用信息公示系统，每 30 天自动复查一次。",
      "办学许可与备案来自各地教育、人社部门公布的名单，由平台人工比对。",
      "课程、价格、校区、教师由机构认领后填写，平台审核后发布，页面上标注“机构填写 · 平台审核”。",
      "评价只来自通过平台报读的学员；报名人数、成交价来自平台订单；咨询人数来自平台线索记录。",
      "页面上的每条事实都标注来源和核对日期。统计数字的统一口径日期写在页面上。",
    ],
  },
  {
    id: "verification",
    title: "核验状态",
    body: [
      "平台已核验：营业执照、办学许可或备案已与官方登记比对一致（城市合伙人初审、平台复审），有效期 12 个月。到期前 60 天提醒复核，逾期降为“机构已认领”并暂停在线报名，已售订单照常履约。核验不代表对教学质量的担保。",
      "机构已认领：机构已绑定账号并维护信息，但资质尚未完成核验。可以接收预约咨询，不能在线报名收款，因此也没有平台成交评价。",
      "官方登记信息 · 待机构认领：只展示官方登记字段，不展示课程、价格和评价，页面不进入搜索引擎索引。",
      "机构自述：由机构自行填写，单独标注“平台未核实”，不进入机构概况和任何统计。",
    ],
  },
  {
    id: "ranking",
    title: "排序与榜单规则",
    body: [
      "列表默认排序依次看：核验状态、信息完整度、已报读评价数。付费不改变自然排序。",
      "每个榜单只按一项可核实的数据排序：好评、报名人数、咨询热度、师资、办学年限、课时单价。不做主观“综合排名”。",
      `好评榜使用加权评分：加权分 =（v × R + m × C）÷（v + m），R 为机构平均分，v 为评价数，C 为该城市该类别的整体平均分，m = ${BAYES_M}。入榜需至少 ${BAYES_M} 条已报读评价。`,
      "只有平台已核验机构参与榜单。榜单每周一更新，往期榜单与更正记录公开可查。",
    ],
  },
  {
    id: "ads",
    title: "商业合作披露",
    body: [
      "教培网向机构收取三类费用：年费会员、线索费（线索包预充值、按条扣费）和按成交付费。年费会员在线卖课，平台不从学费中抽成；不交年费的机构可选按成交付费，按成交学费的固定比例计佣，随课时结算扣除，退款部分不计佣。",
      "推广位是年费会员可申请的权益，同类别会员轮播展示，页面标注“推广”，单独插入列表，不改变自然排序，也不影响榜单名次。",
      "线索规则：学员在机构主页提交的预约是该机构的独享线索；“免费帮选课”的需求最多分给 3 家已核验机构。学员手机号以虚拟号转接，无效线索 48 小时内可申诉退回。",
      "编辑内容（考试百科、选课指南、政策解读）不接受机构付费撰写。机构供稿的经验分享和直播课标注“品牌内容”，不进入榜单，也不出现在编辑撰写的选课指南里。",
      "AI 营销是年费会员的增值服务，包含 AI 可见度测试、AI 内容助手、机构主页 AI 咨询助手和微官网。我们不承诺 AI 一定推荐某家机构，购买与否不改变站内自然排序和榜单名次。",
    ],
  },
  {
    id: "escrow",
    title: "报读流程与退款",
    body: [
      "只有平台已核验、开通年费会员或按成交付费的机构可以在线报名收款。学费由持牌支付机构存管，机构每完成 1/4 课时结算 25%。",
      "可以先付 500 元定金锁定名额，开班前补齐尾款；尾款未付清前不开始结算。",
      "开课前申请可全额退款；开课后按未上课时比例退还（已结算部分对应已上课时，不退），平台确认后 7 天内原路退回。",
      "评价只开放给已上课的平台订单学员，平台只拦截广告和无关内容，不改分、不删差评。",
      "线下直接付款给机构的，按双方合同处理，平台可协助调解。",
    ],
  },
  {
    id: "editorial",
    title: "编辑方针",
    body: [
      "考试与政策类内容必须引用官方原文，标注访问日期；作者与审校人实名署名。",
      "政策解读由具备法律或行业资质的审校人复核后发布。",
      "机构用 AI 辅助撰写的问答，必须由机构确认、平台审核后才发布，页面标注“机构填写 · 平台审核 · AI 辅助撰写”。含效果承诺、绝对化用语或与主页数据不一致的内容不予发布。",
      "机构主页的 AI 咨询助手只根据本页已发布的信息回答，不编造、不承诺考试结果；答不上来的问题转给机构老师，记为该机构的独享线索。",
      "公益直播课免费观看，直播中不收款、不承诺效果；引用的政策和考试信息附官方来源。",
    ],
  },
  {
    id: "corrections",
    title: "更正与申诉",
    body: [
      "任何人发现信息有误，都可以在页面底部提交更正。平台在 3 个工作日内核实，确认后修改并在页面上保留更正记录。",
      "机构对榜单名次有异议，可在商家中心提交申诉，核实后在下期榜单更正。",
    ],
  },
  {
    id: "complaints",
    title: "投诉帮扶",
    body: [
      `学员服务热线 ${site.hotline}（9:00–21:00）。投诉在 1 个工作日内受理，7 个工作日内给出处理意见。`,
      "通过教培网付款的订单，未上课部分由平台按担保规则直接退回，不需要机构同意。线下直接付给机构的，平台协调机构、核对合同，协调不成时协助学员向当地教育主管部门、市场监管部门或 12315 投诉。",
      "经核实的违规（虚假宣传、拒不退费、停课）按规则处理：撤下相关内容、暂停在线报名，情节严重的取消核验，并在机构页公示处理结果。",
    ],
  },
  {
    id: "research",
    title: "行业研究与开放数据",
    body: [
      "季度市场报告基于平台机构库与课程数据计算，免费下载，引用请注明“来源：教培网”。",
      "公开 API 与 llms.txt 提供机构核验状态、来源和更新日期，供搜索引擎与 AI 助手引用。",
    ],
  },
];

export default function MethodologyPage() {
  return (
    <Container>
      <Breadcrumbs items={[{ name: "关于教培网" }, { name: "数据来源与核验标准" }]} />
      <h1 className="text-2xl font-bold text-ink md:text-3xl">数据来源、核验标准与排名规则</h1>
      <p className="mt-2 text-sm text-subtle">最后更新：{site.asOf} · 本页说明教培网所有统计数字、标签和榜单的计算方法。</p>
      <div className="reading-layout mt-6">
      <div className="space-y-4">

        {sections.map((s) => (
          <Card key={s.id} id={s.id} className="scroll-mt-28">
            <SectionTitle>{s.title}</SectionTitle>
            <ul className="list-disc space-y-2 pl-5 leading-7 text-ink-2">
              {s.body.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {s.id === "research" && (
              <p className="mt-3 text-sm">
                <a href="/api/public/v1/orgs" className="text-brand hover:underline">
                  公开 API
                </a>{" "}
                ·{" "}
                <a href="/llms.txt" className="text-brand hover:underline">
                  llms.txt
                </a>{" "}
                ·{" "}
                <Link href="/rankings/guangzhou/yasi" className="text-brand hover:underline">
                  榜单示例
                </Link>
              </p>
            )}
          </Card>
        ))}
      </div>
      <aside className="reading-sidebar rounded-xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">本页目录</h2>
        <nav aria-label="本页目录" className="space-y-1">{sections.map(section => <a key={section.id} href={`#${section.id}`} className="block rounded-lg px-3 py-2 text-sm leading-6 text-muted hover:bg-brand-soft hover:text-brand">{section.title}</a>)}</nav>
      </aside>
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "数据来源、核验标准与排名规则",
          url: absoluteUrl("/about/methodology"),
          dateModified: site.asOf,
          about: { "@id": `${site.url}/#organization` },
        }}
      />
    </Container>
  );
}
