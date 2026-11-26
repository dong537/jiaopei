"use client";

import { SelectField } from "./SelectField";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { KEYS, newId, nowText, useStored, type Application } from "@/lib/demo-store";
import { Icon, cx } from "./ui";

type Candidate = { id: string; name: string; status: "unclaimed" | "claimed" | "verified"; city: string };

const materials = [
  { key: "license", label: "营业执照（经营范围需包含培训项目）", required: true },
  { key: "permit", label: "办学许可证或教育 / 人社部门备案证明", required: true },
  { key: "id", label: "法人身份证明；非法人办理需加盖公章的授权书", required: true },
  { key: "teachers", label: "主讲教师资质证书（上传后显示“已查验”）", required: false },
  { key: "site", label: "校区场地照片与消防合格证明（线下机构）", required: false },
];

export const plans = [
  { key: "free", name: "免费入驻", desc: "主页 + 5 门课程；线索按条付费查看；不含在线售课" },
  { key: "annual", name: "年费会员", desc: "课程不限、赠送线索、开通在线报名与平台担保付款、数据看板、可申请推广位" },
  { key: "leads", name: "线索包", desc: "预充值，按条扣费；可与其他方案叠加" },
  { key: "cps", name: "按成交付费", desc: "无年费；开通在线报名与平台担保付款，按成交学费 [X]% 计佣，随课时结算扣除，退款部分不计佣" },
];

export const planName = (k: string) => plans.find((p) => p.key === k)?.name ?? k;

function Steps({ step }: { step: number }) {
  const names = ["机构信息", "资质材料", "选择方案", "提交审核"];
  return (
    <ol className="mb-5 grid grid-cols-4 gap-2 text-center text-xs">
      {names.map((n, i) => (
        <li key={n} className={cx("rounded-lg border px-1 py-2", i === step ? "border-brand bg-brand-soft text-brand" : i < step ? "border-line bg-white text-verified" : "border-line bg-white text-subtle")}>
          {i < step ? "✓ " : `${i + 1}. `}
          {n}
        </li>
      ))}
    </ol>
  );
}

export function ApplicationStatus({ app }: { app: Application }) {
  const steps = [
    { label: "已提交", done: true, note: app.createdAt },
    { label: `${app.city}城市合伙人初审`, done: app.partnerReview === "passed" || app.status !== "reviewing", note: "核对材料完整性与校区实地信息" },
    { label: "平台复审", done: app.status !== "reviewing", note: "与国家企业信用信息公示系统、教育 / 人社部门名单比对" },
    {
      label: app.status === "rejected" ? "审核未通过" : "核验通过，开通商家中心",
      done: app.status !== "reviewing",
      note: app.status === "rejected" ? (app.note ?? "请补充材料后重新提交") : "主页显示“平台已核验”，有效期 12 个月",
    },
  ];
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">{app.orgName}</span>
        <span className="text-xs text-subtle">
          {app.mode === "claim" ? "认领" : "新建"} · {planName(app.plan)} · 申请号 {app.id}
        </span>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((s) => (
          <li key={s.label} className="flex gap-3">
            <span className={cx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] text-white", s.done ? (app.status === "rejected" && s === steps[3] ? "bg-cta" : "bg-verified") : "bg-line")}>
              {s.done ? "✓" : ""}
            </span>
            <div>
              <div className={cx("text-sm", s.done ? "text-ink" : "text-subtle")}>{s.label}</div>
              <div className="text-xs text-subtle">{s.note}</div>
            </div>
          </li>
        ))}
      </ol>
      {app.status === "approved" && (
        <p className="mt-4 rounded-lg bg-verified-bg p-3 text-sm text-verified">
          审核通过。{app.plan === "annual" ? "支付年费后开通在线报名与平台担保付款。" : app.plan === "cps" ? "已开通在线报名与平台担保付款，成交后按比例计佣。" : "已开通商家中心，可以发布课程、查看线索。"}
          <Link href="/merchant" className="ml-1 underline">
            进入商家中心
          </Link>
        </p>
      )}
      {app.status === "reviewing" && (
        <p className="mt-4 text-xs text-subtle">
          2 个工作日内完成。演示时可以
          <Link href="/ops#qualification" className="mx-1 text-brand underline">
            切换到运营后台
          </Link>
          处理这条申请。
        </p>
      )}
    </div>
  );
}

export function JoinApply({ candidates, cities, categories }: { candidates: Candidate[]; cities: string[]; categories: string[] }) {
  const sp = useSearchParams();
  const claim = candidates.find((c) => c.id === sp.get("claim"));
  const [apps, setApps] = useStored<Application[]>(KEYS.applications, []);
  const [step, setStep] = useState(0);
  const [info, setInfo] = useState({
    orgName: claim?.name ?? "",
    city: claim?.city ?? cities[0],
    category: categories[0],
    contact: "",
    phone: "",
  });
  const [files, setFiles] = useState<string[]>([]);
  const [plan, setPlan] = useState(sp.get("plan") ?? "annual");
  const [submitted, setSubmitted] = useState<string | null>(null);

  const mine = apps.find((a) => a.id === submitted);
  if (mine)
    return (
      <p className="rounded-xl border border-verified bg-verified-bg p-4 text-sm text-verified">
        申请已提交（{mine.id}），审核进度见下方。
      </p>
    );

  if (claim && claim.status !== "unclaimed") {
    return (
      <div className="rounded-xl border border-line bg-white p-5 text-sm leading-6 text-ink-2">
        <div className="font-semibold text-ink">{claim.name} 已被认领</div>
        如果你是这家机构的法定代表人或授权人，认为认领有误，可以提交认领申诉：上传营业执照和加盖公章的授权书，平台在 3 个工作日内核实，核实后转移主页管理权并通知原认领人。
        <div className="mt-3">
          <Link href="/about/methodology#corrections" className="text-brand hover:underline">
            查看申诉规则
          </Link>
        </div>
      </div>
    );
  }

  const input = "mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand";
  const required = materials.filter((m) => m.required).map((m) => m.key);
  const step0Ok = info.orgName.trim() && info.contact.trim() && /^1\d{10}$/.test(info.phone);
  const step1Ok = required.every((k) => files.includes(k));

  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <Steps step={step} />
      {claim && <p className="mb-4 rounded-lg bg-brand-soft p-3 text-sm text-brand">正在认领：{claim.name}。认领需要证明你是该主体的法定代表人或授权人。</p>}

      {step === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-ink-2 sm:col-span-2">
            机构名称（与营业执照一致）
            <input value={info.orgName} readOnly={!!claim} onChange={(e) => setInfo({ ...info, orgName: e.target.value })} className={cx(input, claim && "bg-page")} />
          </label>
          <label className="text-sm text-ink-2">
            所在城市
            <SelectField value={info.city} onValueChange={city => setInfo({ ...info, city })} className="mt-1" aria-label="所在城市" options={cities.map(c => ({ value: c, label: c }))} />
          </label>
          <label className="text-sm text-ink-2">
            培训类别
            <SelectField value={info.category} onValueChange={category => setInfo({ ...info, category })} className="mt-1" aria-label="培训类别" options={categories.map(c => ({ value: c, label: c }))} />
          </label>
          <label className="text-sm text-ink-2">
            联系人
            <input value={info.contact} onChange={(e) => setInfo({ ...info, contact: e.target.value })} className={input} />
          </label>
          <label className="text-sm text-ink-2">
            手机号（登录商家中心用）
            <input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} inputMode="numeric" maxLength={11} className={input} />
          </label>
        </div>
      )}

      {step === 1 && (
        <ul className="space-y-2">
          {materials.map((m) => {
            const done = files.includes(m.key);
            return (
              <li key={m.key} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3 text-sm">
                <span className="flex items-center gap-2 text-ink-2">
                  <Icon name="shield" className={done ? "text-verified" : "text-subtle"} />
                  {m.label}
                  {m.required && <span className="text-xs text-cta">必传</span>}
                </span>
                <button
                  type="button"
                  onClick={() => setFiles(done ? files.filter((f) => f !== m.key) : [...files, m.key])}
                  className={cx("shrink-0 rounded-md border px-3 py-1 text-xs", done ? "border-verified text-verified" : "border-brand text-brand")}
                >
                  {done ? "已上传 · 移除" : "上传（演示）"}
                </button>
              </li>
            );
          })}
          <li className="text-xs leading-5 text-subtle">中小学学科类培训不开放在线售课。材料仅用于资质核验，不在前台展示原件。</li>
        </ul>
      )}

      {step === 2 && (
        <div className="space-y-2">
          {plans.map((p) => (
            <label key={p.key} className={cx("flex cursor-pointer gap-3 rounded-lg border p-3 text-sm", plan === p.key ? "border-brand bg-brand-soft" : "border-line")}>
              <input type="radio" checked={plan === p.key} onChange={() => setPlan(p.key)} className="mt-1 accent-brand" />
              <span>
                <span className="font-medium text-ink">{p.name}</span>
                <span className="block text-xs text-muted">{p.desc}</span>
              </span>
            </label>
          ))}
          <p className="text-xs leading-5 text-subtle">资质审核通过后才需要付费；审核不通过不收取任何费用。</p>
        </div>
      )}

      {step === 3 && (
        <dl className="grid grid-cols-[96px_1fr] gap-y-2 text-sm">
          <dt className="text-subtle">机构</dt>
          <dd>
            {info.orgName}（{claim ? "认领已有主页" : "新建主页"}）
          </dd>
          <dt className="text-subtle">城市 / 类别</dt>
          <dd>
            {info.city} · {info.category}
          </dd>
          <dt className="text-subtle">联系人</dt>
          <dd>
            {info.contact} · {info.phone}
          </dd>
          <dt className="text-subtle">材料</dt>
          <dd>{files.length} 份（必传 {required.length} 份已齐）</dd>
          <dt className="text-subtle">方案</dt>
          <dd>{planName(plan)}</dd>
        </dl>
      )}

      <div className="mt-5 flex justify-between">
        <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded-lg border border-line px-4 py-2 text-sm text-ink-2 disabled:opacity-40">
          上一步
        </button>
        {step < 3 ? (
          <button
            type="button"
            disabled={(step === 0 && !step0Ok) || (step === 1 && !step1Ok)}
            onClick={() => setStep(step + 1)}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            下一步
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              const app: Application = {
                id: newId("A"),
                mode: claim ? "claim" : "new",
                claimOrgId: claim?.id,
                ...info,
                phone: info.phone.slice(0, 3) + "****" + info.phone.slice(-4),
                files,
                plan,
                createdAt: nowText(),
                partnerReview: "pending",
                status: "reviewing",
              };
              setApps([app, ...apps]);
              setSubmitted(app.id);
            }}
            className="rounded-lg bg-cta px-5 py-2 text-sm font-medium text-white hover:bg-cta-dark"
          >
            提交审核
          </button>
        )}
      </div>
    </div>
  );
}

export function MyApplications() {
  const [apps] = useStored<Application[]>(KEYS.applications, []);
  if (!apps.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">已提交的申请</h2>
      {apps.map((a) => (
        <ApplicationStatus key={a.id} app={a} />
      ))}
    </section>
  );
}
