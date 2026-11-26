# 教培官方名录采集器 V1：一次受限样本验收

采样日期：2026-11-21（Asia/Shanghai）。对象是龙岩市教育局 2026 年非学科校外培训白名单的官方 XLSX 附件：[公告](https://jyj.longyan.gov.cn/zwgk/gggs/202604/t20260413_2286204.htm)、[附件](https://jyj.longyan.gov.cn/zwgk/gggs/202604/P020260413590906477838.xlsx)。公告落款 2026-04-09；名单只能证明该发布日期的收录观察，不能证明每一机构今天仍有有效办学许可或课程在售。

## 请求与原件证据

| 项目 | 实测结果 |
| --- | --- |
| 批次 / 尝试 | `af8ce5b8c52e4c62bdb0af68d8dd74e7` / `fada9e27770c49a88c7dd59d5e24d5c1` |
| 硬预算 | `max-pages=1`、`max-ids=100`、`max-requests=1`；单份 XLSX 不支持只下载前 5 行 |
| 真实 HTTP 请求 | 1 次；GET 附件，HTTP 200；开始 2026-11-21 12:12:03.991203 UTC，完成 12:12:04.627705 UTC；耗时 628.5 ms；Retry-After 为 null |
| 原件 | `collector/var/raw/fada9e27770c49a88c7dd59d5e24d5c1.bin`，151,988 字节；同目录 `.json` sidecar |
| SHA-256 | `2ab50c404a08ba6b5354b85958333fbb05f1ec951cf192011f0f6947ba9c316b`；复算与账本、sidecar、收据一致 |
| 原始列表行 | 77；`Sheet1` 实际 Excel 行号 4–80；标题第 2 行，表头第 3 行 |
| 不同来源行 ID | 77；格式为“来源 ID + 工作表 + Excel 行号”；同名不自动合并 |
| 详情完整 / 待续 | 0 / 77；该 XLSX 无已确认逐家详情入口，“待续”不是 77 次失败请求 |
| 失败 / 未解决 | 最终 0；初版解析器曾因 XLSX 样式空列把 `A1:XFC80` 维度误判为超宽字段，原件未重抓，保留阻断事件；离线修复后显式 `review-reverify` 留痕并重新验收 |
| 收据 | `collector/var/receipts/fada9e27770c49a88c7dd59d5e24d5c1.json` |
| 私有候选 | `collector/var/exports/candidates-fada9e27770c49a88c7dd59d5e24d5c1-9df3cdb6bb7c47228b0ce9f730979043.jsonl`，导出 5 行，每行 `publishable=false` |

收据复核原件哈希、sidecar 与账本身份、来源 URL、HTTP 200、文件身份、表头及 77 个行定位。候选中的机构名称、地区、地址、培训类别带逐字段来源；办学许可、课程、联系人、主管部门和独立校区名称在本文件未给出，保持 null。地址的原始列名已核对为“地址”。第二次运行相同 fetch-list 命令返回 `skipped_verified_receipt`、网络请求 0 次；它没有再下载附件。

**计数口径**：77 是官方文件中的原始名单行及不同来源行 ID，不是 77 个经逐家许可核实的机构或法律主体；5 是内部演示用清洗候选，不是新增采集覆盖。没有持续采集或对外再发布的明确许可，原件和候选继续留在被 Git 忽略的私有目录。网站公开投影、个人信息展示、许可有效性判断均未开启。
