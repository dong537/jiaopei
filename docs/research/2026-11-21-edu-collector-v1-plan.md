# 教培采集器 V1 实施计划

> 依据 `2026-11-21-edu-collector-v1-design.md`；用户已明确要求调查与设计之后继续实现、测试和一次有硬上限的内部采样。

**目标：**交付独立 Python CLI，单次取得龙岩官方非学科白名单 XLSX，先存原件、离线验收、私有导出；没有许可号和详情端点时如实保留 null/未支持。

**边界：**不改养老工程和 Next.js 原型，不启动定时任务，不对外发布采集结果。`collector/var/`、环境密钥和生成原件不得提交。任何网络请求均受同站互斥、请求账本和硬预算控制。

## 实施步骤

1. 创建 `collector/pyproject.toml` 和 `src/edu_collector/`，用 uv 锁定 httpx、openpyxl、filelock、pytest；配置示例仅包含龙岩准确 URL、独立保守间隔与私有目录。先写不联网的 XLSX 解析/身份校验测试，包括空表、未知列/null、重复机构名和行 ID。
2. 测试先行实现 `store.py` 与 `network.py`：SQLite run/attempt 账本、请求前预算占用、同站 FileLock、不可覆盖 raw+sidecar、失败响应先存后校验、429/403/身份错误阻断、明确可恢复错误的上限重试。测试预算、429 Retry-After、403、异常中断、跨进程锁。
3. 实现 `sources/longyan.py`、`receipts.py`：只接受官方 XLSX 和已观察的表头；保留全行原始单元格、工作表/行号，完整收据离线校验文件哈希与数量。列表与详情分别状态化；详情无 URL 时返回明确的不支持，不将列表冒充详情。测试损坏原件、列表完成而详情缺失、错误身份、无分页上限。
4. 实现 `export.py` 与 `cli.py`：`inspect`、`fetch-list`、`fetch-detail`、`verify`、`export-candidates`；清洗候选保留逐字段原值、来源 URL、发布时间、UTC 采集时间、对象适用范围与 null，默认 `publishable=false`。测试导出字段、重复观察和恢复判定。
5. 运行 `uv sync`、全量离线测试与 CLI help；再以 `max-pages=1,max-ids=100,max-requests=1` 执行一次真实 GET。离线 `verify` 和 `export-candidates` 后复算请求数、原始行数、不同来源行 ID、详情完整数、失败/待续数，并核对原件/收据位置。若实际 HTTP/业务限制阻断，保存证据、停止站点并报告，不尝试绕过。
6. 自查 README、CLI 帮助、配置、目录/停止/恢复步骤、无密钥/私人联系信息公开、源码边界与依赖；请独立 reviewer 只读检查，报告未满足项。

**验证命令（不触网）：**`uv run pytest -q`，`uv run python -m edu_collector --help`，`uv run python -m edu_collector inspect --data-dir var`，`uv run python -m edu_collector verify --data-dir var`。只有 `fetch-list` 会访问外网；`fetch-detail` 在本来源明确失败而不联网。
