# 企查查登记主体与官方名录：私有数据操作

以下命令在 `C:/Users/Lenovo/Desktop/edu/collector` 目录运行。只有 `fetch-jinan` 和原有的 `fetch-list` 访问网站；企查查导入、检索、验收、候选关联与导出均为离线操作。原始企查查 XLSX 分别保持在 `../教育/`（2026-11-20 批次）和 `../docs/research/`（2026-11-22“培训”批次），不得移动或改写。

```powershell
uv sync --python 3.13
uv run python -m edu_collector.qcc_import inspect
uv run python -m edu_collector.qcc_import import --max-files 25 --max-rows 150000
uv run python -m edu_collector.qcc_import inspect --source-dir ../docs/research
uv run python -m edu_collector.qcc_import import --source-dir ../docs/research --max-files 18 --max-rows 200000
uv run python -m edu_collector.qcc_import search --name 教育 --limit 5
uv run python -m edu_collector verify-jinan
uv run python -m edu_collector export-jinan-candidates --max-ids 121
uv run python -m edu_collector.match_candidates --max-links 500
uv run pytest -q
```

`qcc_import inspect` 会逐份复核指定目录下文件 SHA-256、数据库行数、行摘要及不可覆盖的收据；完整文件再次导入会跳过，损坏收据或文件变化不会冒充成功。`search` 支持 `--name` 或精确 `--uscc`，必须给 `--limit`（不超过 100），可用 `--offset` 翻页；结果始终标为“登记主体候选”，并且 `publishable=false`。导出文件名中的 2026-11-20 或 2026-11-22 仅是快照提示，不是逐家信息发布日期。原单元格的 `-` 占位符在原始 JSON 中不变，在信用代码和区县检索投影中表示 null。“培训”批次包含驾培等其他类别，不能直接当作校外教培机构。

济南样本的唯一联网命令为：

```powershell
uv run python -m edu_collector fetch-jinan --max-pages 1 --max-ids 150 --max-requests 1 --ack-internal-research
```

该命令已经执行过一次，完整收据存在时再运行返回 `skipped_verified_receipt` 且不联网。它保存的是官方网页在 2026-10-30 发布的名单观察；许可编号为原文记录，**不是今天许可证有效性的核验结果**。页面混有成人培训项目，`办学内容` 是名单刊载的文字，不等于许可证原件核定范围或具体课程；私有候选中使用 `listed_training_content` 字段。不同名单行出现相同许可编号时保留全部行并标异常，不用许可证号或同名自动合并。

私有目录：`var/qcc.sqlite3` 和 `var/qcc_receipts/` 存企查查导入；`var/ledger.sqlite3`、`var/raw/`、`var/receipts/` 存官方网页请求与验收；`var/exports/` 存有界清洗候选。这些路径已被 Git 忽略，本导入链路不直接投放网站 `public/`、公开 API、sitemap、前端数据文件或跨境存储。原始 XLSX 有手机号、邮箱、法定代表人及地址等字段，公开投影必须另做授权和隐私判断。项目现有 `/gd` 页面另行读取 `data/gd.db` 中的企查查投影，本次未修改它；其公开使用仍需单独审查。

现有 Next.js `src/lib/data.ts` 仍是演示机构数据。企查查登记主体不能直接满足其机构/校区/课程/价格类型要求；没有完成官方名单与主体关系人工复核前，不从本导入链路接入 `/org`、`/search` 或 `/api/public/v1/orgs`。`/gd` 是既存的另一条展示路径，不应把它与本次私有收据验收混为一谈。一旦遇到 403、429、验证码、身份不符或条款限制，应停止对应来源，不使用代理轮换或绕过方法。

`match_candidates` 默认纯离线复核两份官方收据和两个目录共 43 份企查查收据，只对**原始名称完全相同**的行生成逐行待核关联。若自行使用其他来源目录，应为每个目录重复指定 `--source-dir`，且须覆盖库中所有已导入文件。输出在 `var/matches/`，JSONL 和同名清单均带来源与 SHA-256；关联状态始终为 `pending`，不自动合并主体与机构。名称不同但实际同一主体、同名不同主体等问题仍需人工处理。新批次验收见 `../docs/research/2026-11-22-qcc-training-import-results.md`。
