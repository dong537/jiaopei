# 广东教培机构信源试点 · Next.js

当前默认入口是 /gd：从教育主管部门名单的私有原件库生成可追溯预览，明确区分校外培训白名单、课后服务参考名单、年度检查公示与单家许可公告。此批记录尚未通过逐来源公开再利用审批，生产环境不读取预览数据，也不会发布企查查导出。正式发布须配置经核验的 HTTPS 域名 NEXT_PUBLIC_SITE_URL。启动、统计口径、正式发布闸门与验收步骤见 docs/research/2026-11-23-guangdong-preview-release-runbook.md。旧版原型路由默认关闭；SITE_DEMO_MODE=1 仅在非生产环境开放。

广东页面现有地市检索、来源和单条档案，并增加 /gd/methodology 名单解读、规范面包屑及记录→来源→地市的站内回访链接。SEO/GEO 对照与未完成项见 docs/research/2026-11-24-gd-competitor-seo-audit.md。私有预览仍禁止索引，不能把页面优化视作已获搜索收录或正式发布。

以下为此前全站原型的历史说明；其中价格、评分、报名、订单等均非正式功能。

## 旧版前台原型

按「教培网全站原型」设计稿实现的可运行前台，主题为深海蓝 `#1E4FD8` + 暖橙 `#C2410C`。页面里的机构、价格、评分、统计数字都是**示例数据**，上线前由数据库替换。

## 运行

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # 生产模式
```

需要 Node.js 20 以上。技术栈：Next.js 16（App Router，开启 Cache Components）、React 19、Tailwind CSS v4、TypeScript。不依赖 Google Fonts，使用系统中文字体。

## 页面

| 路径 | 页面 | 结构化数据 |
| --- | --- | --- |
| `/` | 首页：搜索、平台数据、类别目录、考试与政策、本地机构（按类别切换，带商家图片）、榜单（6 种可切换）、免费选课、最新报名、FAQ | Organization、WebSite、ItemList、FAQPage |
| `/city/[city]` | 城市页：按类别找机构 | BreadcrumbList |
| `/city/[city]/[category]` | 城市×类别页（如 `/city/guangzhou/yasi`）：答案摘要、各区学费、学费分布、可筛选排序的机构列表、对比、FAQ | ItemList、Dataset、FAQPage、BreadcrumbList |
| `/org/[id]` | 机构档案：核验状态、来源逐条标注的基本信息、课程价格、校区、教师、相册、优惠、机构自述（单独标注）、分项评价、问答、预约 | EducationalOrganization、FAQPage |
| `/course/[id]` | 课程详情：课程摘要、真实成交价、课程安排、同类课程每课时对比、开班选择与担保付款 | Course、CourseInstance、Offer |
| `/rankings/[city]/[category]` | 榜单：本周结论 + 6 个单指标榜单 + 加权评分公式 | 每个榜单一个 ItemList |
| `/exam/[slug]` | 考试百科（雅思） | Article + EducationalOccupationalCredential |
| `/guide/[slug]` | 选课指南（作者、审校、参考来源、更正记录） | Article |
| `/join` | 机构入驻与认领：流程、认领查找、收费标准、材料、城市合伙人 | |
| `/join/apply` | 入驻 / 认领申请向导（信息 → 材料 → 方案 → 确认）与审核进度 | noindex |
| `/checkout/[id]` | 报名收银台：选开班、学员信息、推荐码、定金或全款、合同摘要 | noindex |
| `/merchant` | 商家中心（AI 来源流量、线索与申诉、订单与结算、完整度、推广位、续期） | noindex |
| `/ops` | 运营后台（演示）：资质审核、退款、评价审核、线索申诉、更正、核验到期 | noindex |
| `/policies` | 政策法规 | Legislation ItemList |
| `/about/methodology` | 数据来源、核验标准、排名规则、商业合作披露、更正流程 | AboutPage |
| `/compare` `/search` `/me` | 机构对比、站内搜索、个人中心（预约、订单、收藏） | noindex |
| `/llms.txt` `/robots.txt` `/sitemap.xml` | 给 AI 和搜索引擎的入口 | |
| `/api/public/v1/orgs` | 公开 API，每个字段带来源 | |

## 目录

```
src/lib/data.ts       示例数据（机构、课程、统计、FAQ）——上线后换成数据库查询
src/lib/content.ts    考试百科与选课指南内容
src/lib/rankings.ts   榜单计算（只用已核验机构，付费字段不参与）
src/lib/market.ts     城市×类别的统计摘要
src/lib/completeness.ts  信息完整度打分与列表自然排序
src/lib/pricing.ts    优惠计算（早鸟价、推荐码，不叠加取低价）与开班是否可报名
src/lib/demo-store.ts 演示数据层（浏览器 localStorage），串起学员、机构、运营三端
src/components/       公共组件（核验标签、答案摘要、FAQ、JSON-LD、机构卡片、筛选、对比、表单）
src/app/              路由
```

## 关键规则在代码里的位置

- **榜单**：`src/lib/rankings.ts`。好评榜使用加权评分 `(v×R + m×C)/(v+m)`，m = 30；已核验机构少于 3 家的类别不发布榜单、不显示名次徽章。“本周结论”由榜单数据生成，保证文字和表格一致。
- **评分显示**：评价不足 30 条不显示分数（`ratingText`，`src/components/OrgCard.tsx`）。
- **推广位**：付费推广在列表里单独插入一个展示位并标注“推广”，不改变自然排序，也不出现在列表的 ItemList 结构化数据里。榜单只看指标，推广机构是否上榜、排第几与付费无关。
- **未认领机构**：只展示官方登记字段，页面 `noindex`，不进 sitemap。
- **机构概况**：由已核验字段自动生成，不使用机构自述。
- **robots**：放开 `/api/public/` 和主流 AI 爬虫，修正了现网 llms.txt 推荐 `/api/` 但 robots 禁止 `/api/` 的矛盾。

- **自然排序**：`naturalOrder`（`src/lib/completeness.ts`）依次看核验状态、信息完整度、评价数。
- **报名与结算**：`src/lib/demo-store.ts` 的 `settleFor` / `refundFor`。每完成 1/4 课时结算 25%；退款 = 已付 − 单价 × 已上课时 ÷ 总课时。
- **评价**：只有已上课（`hoursDone > 0`）的订单可以写，运营审核通过后显示在机构页。

## 演示闭环（一台浏览器内走通）

原型没有后端，三端共用浏览器 localStorage 里的演示数据。按下面顺序点一遍：

1. **学员预约**：打开 `/org/gz-waiyu-peixun`，点“电话咨询”看虚拟号，点“收藏”，在底部预约表单提交。到 `/me` 看到预约和收藏，到 `/merchant#leads` 看到一条标“新”的线索。
2. **线索申诉**：在商家中心对线索点“申诉”，到 `/ops#lead-appeals` 通过，回商家中心看到“已退回 1 条额度”。
3. **报名付款**：打开 `/course/c-waiyu-65`，12-06 班自动用早鸟价 ¥8,200；01-10 班是“预约中”，不能付款。点立即报名进收银台，填推荐码也不会叠加。可选定金 ¥500，之后在 `/me` 补齐尾款。
4. **上课与结算**：在 `/me` 点“演示：完成 N 课时”，看已结算和可退金额变化。
5. **评价与退款**：写评价、申请退款，到 `/ops` 通过评价、确认退款。评价出现在机构页，订单在商家中心可见。
6. **机构认领**：到 `/join` 搜索“语言”认领未认领机构，走完 4 步申请，在 `/ops#qualification` 做合伙人初审和平台复审，回 `/join/apply` 看到审核通过。

`/me` 和 `/ops` 底部都有清空演示数据的按钮。

## 原型里没有接后端的部分

- 演示数据只存在当前浏览器，换设备或清缓存会丢失；正式环境由订单、线索、审核服务替代。
- 担保付款需要接持牌支付机构的分账能力（避免“二清”），收银台只模拟下单。
- 登录、往期榜单、分页是界面占位。
- 机构照片是色块占位，正式环境由机构上传、平台抽检后显示（`Photo.src` 有值时自动用 `next/image` 显示）。
- 方括号内容（如 `[费用]`、`[教师姓名]`、`400-[XXX-XXXX]`）需要替换成真实信息。

## 上线前要做

1. 用数据库替换 `src/lib/data.ts`，保留函数签名（`orgsIn`、`coursesOf`、`getOrg` 等），页面不需要改。
2. 数据页使用 `"use cache"` + `cacheLife` 做增量更新（统计每日、榜单每周一）。
3. 接线索接口（虚拟号）、订单与分账、登录。
4. 用百度站长平台和 Google Rich Results Test 校验结构化数据。

## 界面与城市目录

- 公共容器在宽屏下最大宽度为 1400px；学校、政策、直播、个人中心使用响应式网格，长文配侧栏目录。
- `src/components/SelectField.tsx` 统一下拉选择，支持键盘、Esc、外部点击收起，并保留表单提交和重置行为。
- `src/components/CityPicker.tsx` 提供热门城市、拼音索引及中文 / 拼音 / 省份搜索，选择会保留在当前浏览器。
- `src/lib/generated/cities.json` 是行政区划目录快照（来源为 modood/Administrative-divisions-of-China，许可见同目录），并不表示每个城市已有机构数据。已有示例城市列表仍由 `src/lib/data.ts` 管理；未收录城市显示收录中，空数据页面不索引。
- 需要主动更新城市目录时运行 `node scripts/sync-cities.mjs`，该脚本联网读取上游数据，正常启动不依赖外部城市接口。
