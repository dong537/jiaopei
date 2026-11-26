// 机构主页 AI 咨询助手：只根据本页已发布的数据回答，答不了的转给机构老师。
// 原型用关键词匹配演示行为边界；上线后接已备案的大模型，用同一份知识数据做检索增强，
// 并保留“不承诺效果、不编造、答不了就转人工”这三条规则。

export type AssistantKnowledge = {
  orgName: string;
  verification: string;
  courses: { name: string; price: number; hours: number; classLabel: string; open: string[]; deal?: string }[];
  campuses: { name: string; metro: string }[];
  refund?: string;
  trial?: string;
  offers: string[];
  teachers?: string;
  qa: { q: string; a: string }[];
};

export type AssistantReply = { text: string; source?: string; handoff?: boolean };

const fmt = (n: number) => `¥${n.toLocaleString("en-US")}`;

const intents: { re: RegExp; answer: (k: AssistantKnowledge) => AssistantReply }[] = [
  {
    re: /保过|包过|保证|一定.*(过|提分|考到)|能提.*分|不过.*退|通过率/,
    answer: () => ({
      text: "教培网不允许机构承诺考试结果或提分，我也不能替机构做这样的承诺。你可以看本页“已报读学员评价”里学员写的真实结果，或预约试听后让老师做入学测试，再判断是否适合。",
      source: "平台规则 · 数据来源与核验标准",
    }),
  },
  {
    re: /多少钱|价格|学费|费用|贵不贵|收费/,
    answer: (k) => ({
      text: k.courses.map((c) => `${c.name}：${fmt(c.price)}，${c.hours} 课时，${c.classLabel}${c.deal ? `（${c.deal}）` : ""}`).join("；") + "。",
      source: "本页 · 课程与价格（机构填写 · 平台审核）",
    }),
  },
  {
    re: /优惠|折扣|打折|早鸟|便宜|活动|推荐码/,
    answer: (k) => ({ text: k.offers.length ? k.offers.join("；") + "。两种折扣不叠加，报名时自动按低价算。" : "本页暂未发布优惠活动。", source: "本页 · 优惠活动" }),
  },
  {
    re: /开班|什么时候|名额|还有位|几号|报名时间/,
    answer: (k) => {
      const open = k.courses.filter((c) => c.open.length);
      return {
        text: open.length ? open.map((c) => `${c.name}：${c.open.join("、")}`).join("；") + "。“预约中”的班次还不能付款，可以先预约。" : "本页课程暂未公布具体开班日期，我帮你转给机构老师确认。",
        source: "本页 · 课程开班信息",
        handoff: !open.length,
      };
    },
  },
  {
    re: /校区|地址|在哪|地铁|怎么去|离.*近/,
    answer: (k) => ({ text: k.campuses.map((c) => `${c.name}（${c.metro}）`).join("；") + "。", source: "本页 · 校区" }),
  },
  {
    re: /试听|体验课|先听/,
    answer: (k) => ({ text: k.trial ?? "本页没有写试听安排，我帮你转给机构老师确认。", source: "本页 · 优惠活动", handoff: !k.trial }),
  },
  {
    re: /退费|退款|退钱|不想学/,
    answer: (k) => ({
      text: `${k.refund ?? "机构未填写退费规则。"}通过教培网付款的，学费由持牌支付机构存管，每完成 1/4 课时才结算给机构；中途退费按未上课时比例退还，7 天内原路退回。`,
      source: "本页 · 基本信息 + 平台担保付款规则",
    }),
  },
  {
    re: /资质|正规|靠谱|备案|许可|执照|核验|骗/,
    answer: (k) => ({ text: k.verification, source: "本页 · 基本信息（来源：国家企业信用信息公示系统、教育局公示名单）" }),
  },
  {
    re: /老师|师资|教师|外教/,
    answer: (k) => ({ text: k.teachers ?? "本页没有教师信息，我帮你转给机构老师。", source: "本页 · 教师", handoff: !k.teachers }),
  },
];

/** 从已发布问答里找关键词重合最多的一条 */
function fromQa(k: AssistantKnowledge, q: string): AssistantReply | null {
  const grams = (s: string) => new Set(Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2)));
  const g = grams(q.replace(/[？?。，,！!\s]/g, ""));
  let best: { a: string; score: number } | null = null;
  for (const item of k.qa) {
    const score = [...grams(item.q)].filter((x) => g.has(x)).length;
    if (score >= 2 && (!best || score > best.score)) best = { a: item.a, score };
  }
  return best ? { text: best.a, source: "本页 · 问答（机构填写 · 平台审核）" } : null;
}

export function answer(k: AssistantKnowledge, q: string): AssistantReply {
  const hit = intents.find((i) => i.re.test(q));
  if (hit) return hit.answer(k);
  return (
    fromQa(k, q) ?? {
      text: "这个问题本页没有写，我不猜。留个称呼和手机号，我把问题转给机构老师，老师会通过平台虚拟号回复你。",
      handoff: true,
    }
  );
}
