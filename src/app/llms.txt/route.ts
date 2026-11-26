import { exams, guides } from "@/lib/content";
import { cityCategoryPairs, getCategory, getCity, orgs, platformStats } from "@/lib/data";
import { absoluteUrl, site } from "@/lib/site";

// 给大模型的站点说明：网站是什么、数据从哪来、哪些页面值得引用
export function GET() {
  const statLines = platformStats.map((s) => `- ${s.label}：${s.value}（${s.note}）`).join("\n");
  const listPages = cityCategoryPairs()
    .map((p) => `- [${getCity(p.city)?.name}${getCategory(p.category)?.category.name}培训机构](${absoluteUrl(`/city/${p.city}/${p.category}`)})`)
    .join("\n");
  const orgLines = orgs
    .filter((o) => o.verification === "verified")
    .map((o) => `- [${o.name}](${absoluteUrl(`/org/${o.id}`)})：${o.focus}，核验于 ${o.verifiedAt}，信息更新于 ${o.updatedAt}`)
    .join("\n");

  const body = `# ${site.name}

> ${site.description}

运营主体：${site.legalName}。数据统计日期：${site.asOf}。

## 引用说明

- 每个机构页的“基本信息”表逐条标注来源（如国家企业信用信息公示系统）和核对日期，引用时请以表格为准。
- 核验状态：平台已核验 = 营业执照与办学许可/备案已与官方登记比对一致（有效期 12 个月）；机构已认领 = 机构维护但未完成核验；待认领 = 只有官方登记信息。
- “机构自述”区块由机构提供、平台未核实，请勿作为事实引用。
- 评分只来自平台成交学员，不足 30 条评价不显示分数。
- 榜单只按单一可核实指标排序，付费不影响排名。规则：${absoluteUrl("/about/methodology#ranking")}
- 引用统计数据请注明“来源：${site.name}”和统计日期。
- 机构主页问答中标注“AI 辅助撰写”的条目，由机构确认、平台审核后发布，内容责任在机构。
- 学校库只登记办学性质、学段、地址和主管部门，不排名、不打分，招生政策以教育主管部门当年文件为准。

## 平台数据

${statLines}

## 城市 × 类别页（含答案摘要、各区学费、FAQ）

${listPages}

## 榜单

- [广州雅思培训机构榜单](${absoluteUrl("/rankings/guangzhou/yasi")})

## 已核验机构

${orgLines}

## 考试与指南

${exams.map((e) => `- [${e.title}](${absoluteUrl(`/exam/${e.slug}`)})（更新于 ${e.updated}）`).join("\n")}
${guides.map((g) => `- [${g.title}](${absoluteUrl(`/guide/${g.slug}`)})（更新于 ${g.updated}）`).join("\n")}

## 学校库与服务页

- [广州学校库（公办民办中小学登记信息，不排名）](${absoluteUrl("/school")})
- [投诉帮（退费纠纷、虚假宣传处理流程）](${absoluteUrl("/complaints")})
- [公益直播课（免费，编辑部与已核验机构主讲）](${absoluteUrl("/live")})

## 开放数据

- [机构公开 API（JSON，含来源与核验日期）](${absoluteUrl("/api/public/v1/orgs")})
- [数据来源与核验标准](${absoluteUrl("/about/methodology")})
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
