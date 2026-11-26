# 公开投影逐源授权核对清单（2026-11-23）

> 目的：把 `gd-public-preview.json`（`preview: true` 私有预览）转为可正式发布的 `gd-public-release.json`。
> 前置条件：**每一个进投影的来源都必须通过 `validatePublicationApprovals` 校验**（`scripts/build-gd-public.mjs`）。
> 生成脚本：`scripts/whitelist/gen-approval-checklist.mjs`
> 产出：`data/whitelist/approvals-checklist.csv`（人工填写）、`data/whitelist/approvals-template.json`（喂给 `--approvals`）

## 一、校验规则（必须逐项满足，缺一即该来源被拒）

每个来源的授权条目需同时具备：

| 字段 | 要求 | 说明 |
|---|---|---|
| `key` | 唯一、存在于候选来源 | 来源键 |
| `url` | **与投影中该来源 URL 完全一致** | 不一致直接拒 |
| `approved` | `true` | 已批准 |
| `scope` | `"public_directory"` | 用途必须是"公开目录展示" |
| `basis` | `written_permission` / `open_data_license` / `site_terms` 三选一 | 授权依据类型 |
| `evidenceUrl` | 合法 http/https 链接 | 授权/条款证据链接 |
| `evidenceText` | 非空 | 证据原文摘录（条款原句/许可文号） |
| `reviewedAt` | `YYYY-MM-DD` | 核验日期 |
| `linkApproved` | `true` | 已审查"原文来源链接"可公开使用 |
| `explicitReuseAllowed` | `basis≠written_permission` 时须 `true` | 条款须明确允许本用途再利用 |
| `qualityApproved` | `true` | 质量审查通过 |
| `contentComplete` | `true` | 内容完整性通过 |
| `qualityNotes` | 非空 | 质量备注（如"逐行核对原件"） |

**特殊约束**：以下 5 个域名条款含禁令，`basis` **必须**是 `written_permission`，否则被拒：
- `szeb.sz.gov.cn`（深圳市教育局）
- `www.ruyuan.gov.cn`（乳源）
- `www.gdyunan.gov.cn`（郁南）
- `www.yangchun.gov.cn`（阳春）
- `www.shunde.gov.cn`（顺德）

## 二、27 个来源现状

### 需书面许可（5 个）—— 必须先取得针对性书面许可，否则无法发布

| 来源 key | 发布单位 | 行数 | 原件 URL |
|---|---|---|---|
| shenzhen-city-2024-check | 深圳市教育局 | 92 | https://szeb.sz.gov.cn/attachment/1/1594/1594075/12229949.pdf |
| yangjiang-yangchun-2026-04 | 阳春市教育局 | 68 | https://www.yangchun.gov.cn/zxzx/gsgg/content/post_953030.html |
| shaoguan-ruyuan-2026-01 | 乳源瑶族自治县教育局 | 19 | https://www.ruyuan.gov.cn/sgryjyj/gkmlpt/content/2/2815/post_2815048.html |
| yunfu-yunan-2026-09 | 郁南县教育局 | 15 | https://www.gdyunan.gov.cn/yfynjyj/gkmlpt/content/2/2042/post_2042429.html |
| foshan-shunde-2025-27 | 佛山市顺德区教育局 | 1 | https://www.shunde.gov.cn/fssdjyj/attachment/0/534/534549/6554041.xls |

### 可走 site_terms / open_data_license（22 个）—— 需核验各站条款是否明确允许再利用

东莞（教育局年检 1260）、深圳福田/南山/盐田/大鹏（区级年检）、茂名（市局 6 份区县名单）、广州番禺/黄埔、汕尾、云浮罗定、清远英德、韶关始兴/新丰、河源东源、潮州饶平、肇庆高要、佛山禅城。

> 注意：**"政府主动公开"不等于"允许批量再利用"**。逐站核对：
> - 站点是否有"不得转载/不得用于商业用途"声明 → 有则转 `written_permission`
> - 是否有开放数据许可（如政府数据开放平台）→ 有则填 `open_data_license`
> - 均无明确禁令、且属主动公开信息 → 可填 `site_terms` + `explicitReuseAllowed: true` + 摘录原文

## 三、填表与发布流程

1. 在 `approvals-checklist.csv` 逐行填写 basis/approved/scope/evidenceUrl/evidenceText/reviewedAt/各批准字段。
2. 把 CSV 内容转成 `approvals.json`（结构见 `approvals-template.json`），确保字段名与校验器一致。
3. 执行发布：
   ```
   node scripts/build-gd-public.mjs --publish --approvals data/whitelist/approvals.json
   ```
4. 校验器逐源审查：**通过的来源进 release 投影，未通过的来源单独记录在 `rejectedSources`，不阻断其他合规来源**（至少 1 个通过才生成 release）。
5. 产物 `data/gd-public-release.json` + 收据 `receipt`（含 approvalsSha256、approvedSourceKeys、rejectedSources）。

## 四、当前判断（诚实结论）

- **一个来源都还没填写授权**，因此现在只能出 `preview`（私有预览），不能正式发布。
- 5 个"条款含禁令"来源是最难的一关，需要逐个发函或找其上级开放数据平台，短期内拿不到就**把这 5 个来源排除在正式发布之外**（release 可以只含通过授权的来源）。
- 22 个可走 site_terms 的来源里，实际核查大概率有一半站点带"未经许可不得转载"类声明，需要实打实打开页面看——这一步无法由脚本替代，必须人工逐站确认并留存证据链接。

**可以立即做的最小可行发布**：先挑 3–5 个条款明确、无禁令的政府公开名单（如东源、饶平、高要这类"许可公告"性质），核验通过后先发一版小样本 release，验证发布链路，再逐步扩大。这样既守住合规，又不用等 27 个全齐。
