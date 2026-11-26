// 内容合规检查：AI 内容助手、品牌内容、直播课简介提交前都过这一遍。
// 依据《广告法》对绝对化用语、效果承诺的限制，以及校外培训广告管理要求。上线后由运营维护词表。

const rules: { re: RegExp; why: string }[] = [
  { re: /保过|包过|不过退|不过全退|通过率\s*100|100\s*%\s*(通过|提分|上岸)/g, why: "承诺考试结果" },
  { re: /保证|确保|一定(能|会)?(过|提分|上岸|考上)/g, why: "承诺培训效果" },
  { re: /最好|最佳|第一|顶级|最高级|最权威|国家级|全网最低|唯一/g, why: "绝对化用语" },
  { re: /提分\s*\d+\s*分|提高\s*\d+\s*分/g, why: "量化效果承诺" },
  { re: /命题(专家|老师|组)|押题|原题/g, why: "暗示与考试命题相关" },
];

export type ComplianceHit = { word: string; why: string };

export function checkCompliance(text: string) {
  const hits: ComplianceHit[] = [];
  for (const r of rules) {
    for (const m of text.matchAll(r.re)) {
      if (!hits.some((h) => h.word === m[0])) hits.push({ word: m[0], why: r.why });
    }
  }
  // 模板里留给机构填写的占位
  const blanks = (text.match(/\[请填写[^\]]*\]/g) ?? []).length;
  return { hits, blanks, ok: hits.length === 0 && blanks === 0 };
}
