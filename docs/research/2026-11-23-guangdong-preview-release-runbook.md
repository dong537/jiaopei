# 广东官方名单预览与发布手册

状态：仅内部预览；截至 2026-11-23 未制作正式发布投影，也未宣称来源可商业再利用。

已核查的网站再利用声明与逐来源决策见 [广东试点来源再利用核查](2026-11-23-guangdong-source-rights.md)。

## 本地预览

1. 私有原件、收据与 data/whitelist.db 由现有白名单管线维护。不要把它们、企查查 XLSX、data/gd.db 或 collector/var/ 推入 Git 或公开静态目录。
2. 在项目根目录运行 node scripts/build-gd-public.mjs。此命令只读本地白名单库，不联网；输出 data/whitelist/gd-public-preview.json 与同目录 gd-public-preview.receipt.json。检查 SHA-256、统计对账及抽样原文。
3. 在本机设置 GD_PRIVATE_PREVIEW=1，再运行 node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3111，打开 http://127.0.0.1:3111/gd。必须同时显式启用预览并绑定回环地址；不要把私有预览服务器暴露到局域网或公网。预览页有醒目的“内部预览”提示并设置不索引；旧原型路由默认重定向到广东页，示例公开 API 返回 404。SITE_DEMO_MODE=1 只允许在非生产环境查看旧原型。

当前预览收据（按本地最新白名单库重建）：原始官方来源行 2,790；排除待复核 48 行、许可证属地异常 0 行、同号异名冲突 24 行、未批准来源 0 行、重复观察 0 行；形成 **2,718 条可追溯的私有候选记录**，来自 24 个来源、11 个地市。来源明确分为 **校外培训白名单**（official_whitelist）、**年度检查公示**（annual_check）、**课后服务参考名单**（after_school_reference）和**单次行政许可公告**（single_license_notice）。新丰“参考白名单”不是通用持证白名单；高要、顺德的单次许可公告也不是地区全量名录。以上都不是已人工核实的机构数或广东全省覆盖率。发布日期未取得，一律为 null；asOf 是来源登记的“名单截至/观察时间”。

## 正式发布闸门

逐来源审核官方网页/附件的公开再利用与商业展示规则、原文链接许可、字段语义、解析完整性和隐私。审批文件放在私有目录，不能进入 Git。审批项须绑定来源 key 与原件 URL，显式填写 approved=true、scope=public_directory、basis、evidenceUrl、evidenceText、reviewedAt、linkApproved=true、contentComplete=true、qualityApproved=true 和非空 qualityNotes；依据为网站条款或开放许可时还须 explicitReuseAllowed=true。机器闸门只检查这些字段与来源一致，证据内容和许可效力仍须人工审阅。深圳市教育局 szeb.sz.gov.cn、乳源、郁南、阳春和顺德来源已查到商业转载或链接限制；顺德来源须先取得提供单位针对本用途的许可，不能凭网页公开下载通过。其余来源未发现明确许可也不能自动批准。

只有逐源审批且通过内容质量复核的来源可以进入发布投影；其他来源计入 excludedUnapproved，不阻断已获许可的来源，但至少须有一个可发布来源和一条通过异常排除规则的记录。未获许可的来源继续留在私库。仅有 robots 未禁止或网页可访问不构成授权。运行 node scripts/build-gd-public.mjs --publish --approvals <私有审批文件> 后，才会生成 data/gd-public-release.json（已在 .gitignore 排除）与发布收据；当前无真实审批文件，**不得运行此命令生成正式发布文件**。须先生成发布文件，再生产构建与部署；否则 Next.js 会把“尚未发布”静态空态烘焙进页面。生产环境仅读取 release 文件；缺失则显示“尚未发布”，不会回退到私有预览或企查查。发布构建还必须设置经运营方核验归属的 HTTPS 域名 NEXT_PUBLIC_SITE_URL；代码会拒绝缺失、本机和非 HTTPS 配置，无法代替人工核对域名归属、备案和对外展示主体。

发布审批还须逐来源抽检原件字段：年度检查结果和白名单单条备注当前未结构化；若影响机构状态，需要先补字段或从发布批次剔除。罗定来源原文 72 行中有两行许可证号仅 14 位，投影只收 70 行，不得宣称全部收录，也不得推测补位；在未完成逐行内容完整性复核前，该来源不得填写 contentComplete=true。东源来源的 27 行有 3 行进入待复核，当前投影保留 24 行；原站证书校验异常期间不继续自动获取。公告撤回、名称变更、同号异名需人工复核；不能因名称相似合并主体/校区，也不能从名单号码推断当下有效期。公众更正入口、负责人、响应时限、版本保留与回滚方案需由运营确认。

## 上线验收

- 运行 node --test scripts/build-gd-public.test.mjs tests/gd-public-query.test.mjs tests/public-access.test.mjs tests/publication-site.test.mjs；运行 node node_modules/eslint/bin/eslint.js src scripts/build-gd-public.mjs scripts/build-gd-public.test.mjs tests；运行 node node_modules/typescript/bin/tsc --noEmit；运行 node node_modules/next/dist/bin/next build。
- 在生产构建和真实域名逐项检查 /、/gd、/gd/license、一个真实城市及档案、原文链接、空结果、robots.txt、sitemap.xml，并确认 /org、/course、/api/public/v1/orgs、/llms.txt 不对外提供原型内容。检查移动端、键盘、控制台错误和访问日志。
- 真实域名归属、主体名称/备案、隐私与更正联系渠道、部署平台、健康检查、备份及发布/回滚权限尚未核验；在这些事项完成前，不宣称正式运营。
- 当前生产构建仍会编译旧版演示路由；运行时 proxy 默认挡住它们。不得将构建产物绕过 Next proxy 直接作为静态目录发布。正式上线前须在目标部署环境验证这些路由不可访问，并安排将演示页面从正式构建中剥离。

安全更新：项目 Next.js 16.4.3 的生产构建触发框架漏洞阻断，已同步升级 next 与 eslint-config-next 到 16.4.6；后续升级应复跑构建和上述业务 smoke check。
