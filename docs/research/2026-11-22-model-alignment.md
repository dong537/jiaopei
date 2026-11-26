# 对象模型单一事实源与两套实现映射（2026-11-22）

> 目标：以 `2026-11-22-object-model-and-national-plan.md` 第 1 章为**唯一对象模型**，
> 统一 `/gd`（Next.js + `data/gd.db` + `data/whitelist.db`）与 `collector/`（Python + `var/*`）两套实现，
> 使字段语义、口径、状态机一致。本文是**映射与对齐方案**，不在本阶段改动运行中的采集代码或重建数据。

## 1. 单一事实源（九对象）

| # | 对象 | 单一事实源字段（权威） | 说明 |
|---|---|---|---|
| 1 | Brand | brand_id, brand_name, brand_name_norm, alias[] | 品牌，非法律主体 |
| 2 | LegalEntity | entity_id, uscc, legal_name, legal_name_norm, entity_type, reg_authority, reg_status, reg_address, listed_scope | 登记主体，52=民非/91=企业/12=事业 |
| 3 | Institution | institution_id, institution_name, license_id, entity_id, category, admin_level, region_code, status | 获许可培训机构 |
| 4 | Campus | campus_id, entity_id, institution_id, campus_name, address, region_code, license_id | 校区/教学点 |
| 5 | License | license_id, license_no, issuer, issue_date, valid_from, valid_to, license_type, permitted_scope, annual_check, status | 办学许可 |
| 6 | Course | course_id, course_name, course_type, price, institution_id, campus_id | 课程 |
| 7 | OfficialListRow | source_record_id, source_id, row_number, table_index, sheet, raw_cells[], raw_fields{}, parsed_*, as_of, published_at, anomalies[] | 官方名单行 |
| 8 | SourceRecord | source_record_id, source_id, url, http_status, redirect_chain, fetched_at_utc, published_at, sha256, content_type, format, region_code, admin_level, batch_id, row_count, license_count, entity_count | 来源原件 |
| 9 | FieldEvidence | evidence_id, object_type, object_id, field_name, raw_value, source_record_id, captured_at_utc, status, prior_value | 字段证据 |

## 2. 两套实现现状对照

### 2.1 `/gd` 链路（Next.js）

| 现状表/实体 | 对应单一事实源对象 | 差异 |
|---|---|---|
| `gd.db.orgs` | LegalEntity（近似） | 缺 `entity_type` 明确标注（有 `biz_type` 但语义是企查查行业分类，非 52/91/12 主体性质）；`uscc` 存于 `credit` 列；`listed_scope` 缺失（无经营范围列，仅 `biz_type`） |
| `whitelist.db.wl_rows` | OfficialListRow（近似） | 缺 `raw_cells[]/raw_fields{}` 原始值（解析后已丢弃未知列）；`row_number` 隐含在 `source_key` 里但未单列；无 `anomalies[]` |
| `whitelist.db.wl_match` | FieldEvidence 的「关联」子集 | 把「名单行→工商主体」关联直接当结果存，缺 `prior_value`/核验状态机（只有 match_type） |
| `whitelist.db.wl_review` | 人工复核队列（近似） | 缺「已复核/待复核」状态字段，只有 reason |
| 无 Brand / Campus / Course / License 独立表 | Brand/Campus/Course/License | **缺失**：名单行被直接当机构资质，未拆出 License/Campus/Course |

### 2.2 `collector/` 链路（Python）

| 现状实体 | 对应单一事实源对象 | 差异 |
|---|---|---|
| `store.runs/attempts/events` | SourceRecord 的账本侧 | 覆盖良好（URL/时间/状态/SHA-256/Retry-After），但 `published_at` 需从解析器补 |
| `sources/longyan.py` `parse_xlsx` 产出 | OfficialListRow | 有 `source_record_id`、`raw_cells`、`raw_fields`、`raw_cells`（完整），比 `/gd` 更贴近事实源 |
| `sources/jinan.py` `parse_html` 产出 | OfficialListRow | 同上，且带 `anomalies[]`（duplicate_license_number） |
| `export.py` 候选 | FieldEvidence（近似） | `publishable=false`，逐字段证据，接近事实源 |
| `qcc_import` | LegalEntity（近似） | 保留原始 37 列 + 真实 Excel 行号 + 收据，是**最贴近** LegalEntity 事实源的实现 |

## 3. 对齐决策（单一事实源 → 实现映射）

### 3.1 语义统一（不改表结构，先统一口径）

| 口径 | 单一事实源定义 | `/gd` 现状 | `collector` 现状 | 对齐动作 |
|---|---|---|---|---|
| 名单行 vs 许可证 | 一行=一次收录观察，≠许可证有效性 | 已标注「未匹配≠无证」 | 已标注「观察非证明」 | 一致，保持 |
| 未匹配语义 | `not_in_business_registry`（不在工商库） | 页面文案已写，但 DB 无显式状态位 | 候选 `publishable=false` | 建议在 `wl_rows` 增加 `match_status` 枚举列 |
| 许可证号 vs 信用代码 | 两个独立字段 | 已分列 | 已分列 | 一致 |
| 计数分离 | 行数/许可证数/机构数分开 | `license.ts` 已分（rows/licenses/matchedOrgs） | `verify` 已分 | 一致 |

### 3.2 结构补齐（后续阶段，不在本阶段执行）

1. `/gd` 增加 License 独立投影：从 `wl_rows` 拆出 `license_no + issuer + valid_* + annual_check + status`，机构页展示「许可」而非「名单行」。
2. `/gd` 增加 Campus/Course 占位（当前名单未刊载，字段为 null，不推断）。
3. `wl_rows` 增加 `raw_fields` JSON 列（保留未知列，避免「解析后丢弃原始值」）。
4. `wl_match` 增加状态机（`candidate`→`confirmed`，需复核记录）。
5. 两套实现共用同一套 `region_code`（6 位县区码），`/gd` 当前用 `city_slug`（地级），需补县区级码。

### 3.3 不动的部分

- `collector` 的账本/原件/收据/互斥/硬预算机制**已是事实源标准**，不动。
- `/gd` 的「未匹配≠无证」文案与「分母=工商名录核心数」口径**保持**，避免误读为合规率。

## 4. 结论

- **两套实现分歧不在「采集纪律」**（都遵守了原件留痕、硬预算、不绕过），**而在「对象颗粒度」**：
  `collector` 把「名单行」作为一等公民并保留原始值（贴近事实源），`/gd` 把「名单行→工商主体」直接当「机构资质」展示，缺 License/Campus/Course 分层。
- **对齐方向**：以 `collector` 的 SourceRecord/OfficialListRow 为「原始层」标准，以单一事实源九对象为「业务层」标准，`/gd` 的 `orgs/wl_rows/wl_match` 作为「投影层」，逐步补齐 License/Campus/Course 与 `region_code`、`match_status`、`raw_fields`。
- **本阶段只交付此映射方案**，不重建数据、不修改运行中的采集与页面。
