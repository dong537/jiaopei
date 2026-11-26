import { cityDirectory } from "@/lib/cities";
import type { Metadata } from "next";
import Link from "next/link";
import { ClaimSearch } from "@/components/ClaimSearch";
import { LeadForm } from "@/components/LeadForm";
import { Card, Container, Icon, SectionTitle, cx } from "@/components/ui";
import { orgs, platformStats } from "@/lib/data";

export const metadata: Metadata = {
  title: "机构入驻与认领：让学员在搜索引擎和 AI 助手里找到你",
  description: "培训机构免费入驻教培网：认领已有主页、上传资质完成核验、发布课程，接收来自搜索引擎和 AI 助手的学员咨询。年费会员、按成交付费与线索包按需选择，付费不影响自然排序。",
  alternates: { canonical: "/join" },
};

const steps = [
  { t: "注册账号", d: "手机号注册，选择城市与培训类别。" },
  { t: "认领或新建", d: "搜索已有主页一键认领，没有则新建。" },
  { t: "上传资质", d: "营业执照、办学许可或备案，2 个工作日审核。" },
  { t: "完善主页", d: "校区、教师、课程与价格，完整度越高排序越靠前。" },
  { t: "接收咨询", d: "在商家中心查看线索、跟进、开通在线售课。" },
];

const plans = [
  {
    key: "free",
    name: "免费入驻",
    price: "¥0",
    unit: "",
    rec: false,
    cta: "免费入驻",
    items: ["认领并完善机构主页", "发布 5 门课程", "线索按条付费查看（从线索包扣费）", "基础数据：访问量与咨询量", "不含在线报名与担保付款"],
  },
  {
    key: "annual",
    name: "年费会员",
    price: "¥[X]",
    unit: "/ 年",
    rec: true,
    cta: "开通会员",
    items: [
      "课程数量不限",
      "每年赠送 [N] 条线索",
      "开通在线报名与平台担保付款",
      "完整数据看板，含 AI 来源流量",
      "可申请类别推广位（标注“推广”，轮播展示）",
      "可加购 AI 营销（¥[X] / 年）：AI 可见度报告、AI 内容助手、主页 AI 咨询助手、微官网",
    ],
  },
  {
    key: "leads",
    name: "线索包",
    price: "¥[X]",
    unit: "/ 条起",
    rec: false,
    cta: "购买线索包",
    items: ["按类别定价，预充值扣费", "主页预约为独享线索；选课顾问线索最多分给 3 家", "学员手机号以虚拟号转接", "无效线索 48 小时内可申诉"],
  },
  {
    key: "cps",
    name: "按成交付费",
    price: "[X]%",
    unit: "/ 成交学费",
    rec: false,
    cta: "按成交开通",
    items: ["无年费，核验通过即开通在线报名与担保付款", "学员付款后才计佣，随课时结算自动扣除", "退款部分不计佣", "课程数量不限；线索按条付费查看", "不含推广位与赠送线索"],
  },
];

const materials = [
  "营业执照（经营范围需包含培训项目）",
  "办学许可证或教育 / 人社部门备案证明",
  "法人或授权运营人身份证明、授权书",
  "主讲教师资质证书（可选，上传后显示“已查验”）",
  "校区场地照片与消防合格证明（线下机构）",
];

export default function JoinPage() {
  const candidates = orgs
    .filter((o) => o.verification !== "verified")
    .map((o) => ({
      id: o.id,
      name: o.legalName,
      area: `${o.district}${o.area}`,
      code: "91440[XXXXXXXXXXXXX]",
      status: o.verification,
      ...(o.verification === "unclaimed" ? { views: 326, leads: 14 } : {}),
    }));

  return (
    <>
      <div className="border-b border-line bg-white">
        <Container className="flex gap-1 overflow-x-auto py-2 text-sm">
          {[
            ["#claim", "认领机构"],
            ["#pricing", "收费标准"],
            ["#materials", "资质材料"],
            ["#partner", "城市合伙人"],
            ["/merchant", "商家登录"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="shrink-0 rounded-md px-3 py-1.5 text-ink-2 hover:bg-brand-soft hover:text-brand">
              {label}
            </Link>
          ))}
        </Container>
      </div>

      <section className="bg-gradient-to-br from-brand to-brand-dark text-white">
        <Container className="grid gap-8 py-10 md:py-14 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <h1 className="text-2xl font-bold leading-tight md:text-4xl">让学员在搜索引擎和 AI 助手里找到你的机构</h1>
            <p className="mt-4 max-w-2xl leading-7 text-white/85">
              教培网的机构页按 AI 可引用的结构编写。完成认领和核验后，学员在豆包、DeepSeek、百度搜索等渠道询问“广州雅思培训哪家好”时，你的机构更有机会被推荐。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/join/apply?plan=free" className="rounded-lg bg-cta px-5 py-3 text-sm font-medium text-white hover:bg-cta-dark">
                免费入驻
              </Link>
              <a href="#claim" className="rounded-lg border border-white/50 px-5 py-3 text-sm font-medium text-white hover:bg-white/10">
                认领已有主页
              </a>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {[
              ["收录机构", platformStats[0].value],
              ["月访问学员", "[N] 万"],
              ["月咨询线索", "[N]"],
              ["来自 AI 搜索", "[Y]%"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white/10 p-4">
                <dd className="text-2xl font-bold tabular">{v}</dd>
                <dt className="text-sm text-white/75">{k}</dt>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <Container className="space-y-10 py-10">
        <section>
          <SectionTitle>入驻流程</SectionTitle>
          <ol className="grid gap-3 md:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.t} className="rounded-xl border border-line bg-white p-4">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">{i + 1}</span>
                <div className="mt-2 font-semibold text-ink">{s.t}</div>
                <div className="mt-1 text-sm leading-6 text-muted">{s.d}</div>
              </li>
            ))}
          </ol>
        </section>

        <Card id="claim" className="scroll-mt-28">
          <SectionTitle aside="我们已根据官方登记信息收录了部分机构。认领后即可完善资料、发布课程、接收咨询。">你的机构可能已经在教培网上</SectionTitle>
          <ClaimSearch candidates={candidates} initial="广州示例语言培训" />
        </Card>

        <section id="pricing" className="scroll-mt-28">
          <SectionTitle aside="想在线卖课：交年费（学费不抽成）或按成交付费（不交年费）二选一；线索包可叠加。付费不影响自然排序。">收费标准</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((p) => (
              <div key={p.name} className={cx("relative flex flex-col rounded-xl bg-white p-6", p.rec ? "border-2 border-brand shadow-md" : "border border-line")}>
                {p.rec && <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-0.5 text-xs text-white">推荐</span>}
                <div className="font-semibold text-ink">{p.name}</div>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-ink">{p.price}</span>
                  <span className="ml-1 text-sm text-subtle">{p.unit}</span>
                </div>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-2">
                  {p.items.map((i) => (
                    <li key={i} className="flex gap-2">
                      <Icon name="check" className="mt-0.5 text-verified" />
                      {i}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/join/apply?plan=${p.key}`}
                  className={cx(
                    "mt-5 flex h-10 items-center justify-center rounded-lg text-sm font-medium",
                    p.rec ? "bg-brand text-white hover:bg-brand-dark" : "border border-brand text-brand hover:bg-brand-soft",
                  )}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-subtle">年费按城市分档，以上为一线城市参考价。资质审核通过后才需付费。无效线索（空号、重复、非本人）48 小时内可申诉退还。推广位不改变自然排序和榜单。</p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card id="materials" className="scroll-mt-28">
            <SectionTitle>核验需要的材料</SectionTitle>
            <ul className="space-y-2.5 text-sm text-ink-2">
              {materials.map((m) => (
                <li key={m} className="flex gap-2">
                  <Icon name="shield" className="mt-0.5 text-brand" />
                  {m}
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-lg bg-page p-3 text-xs leading-5 text-muted">
              提交后 2 个工作日内完成审核。核验有效期 12 个月。学科类培训暂不开放在线售课。
            </p>
          </Card>
          <Card id="apply" className="scroll-mt-28 flex flex-col">
            <SectionTitle>入驻申请</SectionTitle>
            <ol className="flex-1 space-y-2 text-sm text-ink-2">
              <li>1. 填写机构信息（认领已有主页会自动带出登记信息）</li>
              <li>2. 上传资质材料</li>
              <li>3. 选择免费入驻、年费会员、按成交付费或线索包</li>
              <li>4. 城市合伙人初审 → 平台复审，2 个工作日出结果</li>
            </ol>
            <Link href="/join/apply" className="mt-4 flex h-11 items-center justify-center rounded-lg bg-cta text-sm font-medium text-white hover:bg-cta-dark">
              开始申请
            </Link>
          </Card>
        </div>

        <section id="partner" className="scroll-mt-28 grid gap-6 rounded-xl border border-line bg-white p-6 md:grid-cols-[1fr_360px]">
          <div>
            <h2 className="text-xl font-semibold text-ink">招募城市合伙人</h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              合伙人负责本城市的机构招商、资质初审（核对材料与校区实地信息）和本地内容；平台负责复审、支付存管、榜单与评价规则，合伙人不能修改排序或评价。收入按本城市年费、线索和成交佣金收入分成。
            </p>
          </div>
          <LeadForm
            fields={[
              { kind: "select", name: "city", label: "意向城市", options: cityDirectory.map((c) => c.name) },
              { kind: "text", name: "name", label: "称呼" },
              { kind: "text", name: "phone", label: "手机号", type: "tel" },
            ]}
            submitLabel="申请成为合伙人"
            tone="primary"
            success="已收到，招商经理会在 2 个工作日内联系你。"
          />
        </section>
      </Container>
    </>
  );
}
