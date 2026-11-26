# 教培官方名录采集器 V1（内部研究）

本项目目前接入龙岩市教育局的非学科校外培训白名单 XLSX，以及济南高新区的校外培训白名单 HTML，另提供用户自有企查查 XLSX 的私有离线导入。名单行是**发布时的官方收录观察**，不是今日许可证有效性证明，也不等同登记主体、独立校区或课程。全国监管平台尚无已确认的公开批量路径；职业技能培训和继续教育教学点须另建来源与类别适配器。

## 运行

在 `collector/` 目录执行：

`powershell
uv sync --python 3.13
uv run python -m edu_collector inspect
uv run python -m edu_collector fetch-list --max-pages 1 --max-ids 100 --max-requests 1 --ack-internal-research
uv run python -m edu_collector verify
uv run python -m edu_collector export-candidates --max-ids 5
uv run pytest -q
`

**只有 fetch-list 与 fetch-jinan 访问外网**，分别只请求一个已核验的官方 XLSX 或 HTML 页面；fetch-detail 目前会明确失败且不联网。inspect 是只读账本检查；verify、verify-jinan、export-candidates、export-jinan-candidates 和两种 review 命令均为离线命令。联网命令强制使用本安装的 `collector/var` 作为该站唯一账本目录；--max-pages 必须为 1。--max-requests 是包含失败尝试的请求硬预算。--max-ids 是可验收来源行 ID 数的硬预算，**无法减少单份 XLSX 下载本身包含的行**；若文件超过预算，原件会保存、验收会阻断。离线导出另用 --max-ids 限制候选行数。第一版不做定时抓取，也不提供公开投影。企查查离线导入和济南来源操作见 `IMPORTS.md`。

采集配置见 `config.example.toml`：30 秒间隔是本项目保守操作值，不代表网站承诺或复用养老工程参数；默认零自动重试。HTTP 429 保存 Retry-After 后停止，403、重定向、验证码文件或身份不符均阻断；不提供绕过访问控制的开关。

## 私有数据与恢复

- `var/ledger.sqlite3`：run、每次请求尝试、状态、HTTP/业务状态、耗时、Retry-After 和事件。
- `var/raw/<attempt>.bin` 及同名 `.json`：不可覆盖原始响应、SHA-256、URL、UTC 时间和请求身份。HTTP 失败响应也保留。
- `var/receipts/<attempt>.json`：离线复核原件、sidecar、来源身份、表头和每一来源行后的完整收据。只有最新尝试的完整收据可令下一次 fetch-list 跳过。
- `var/exports/candidates-*.jsonl`：有上限的私有清洗候选，逐字段证据、未知字段和 null 均保留；publishable 永远为 false。此目录不得放入网站公开目录、API 或 sitemap。

中断后先运行 `inspect`，再运行 `verify`。若进程恰在写原件后中断，verify 会仅在原件和 sidecar 完整且哈希相符时离线重建账本；有缺件或损坏时保持阻断，不自行重抓。对无响应的暂时网络故障或经检查的 HTTP 502/503/504，可执行 `uv run python -m edu_collector review-retry --attempt <ID> --reason "已检查暂时网络故障及原件"`，再显式执行带同样硬预算和 `--resume-reviewed` 的 fetch-list。403/429、身份不符、损坏原件不能用该命令解锁；需停止来源并人工调查条款、文件或授权渠道。

若 HTTP 200 原件因旧解析器误判为 `identity_mismatch`，先核对原件哈希、文件身份与新解析规则，再用 `uv run python -m edu_collector review-reverify --attempt <ID> --reason "已检查原件和解析器修复"` 显式留痕，随后运行 `verify`。该操作完全离线，仅允许原件完整、无既有收据的 HTTP 200 身份误判，不会放行 403/429 或发起新请求。

来源调查、授权边界与模块数据流在 `../docs/research/2026-11-21-edu-collector-v1-design.md`。网站可查询、附件可下载、允许持续批量采集和允许公开再利用是不同判断；当前仅做一次私有研究样本，公开使用前须另审授权、隐私、语义和来源日期。
