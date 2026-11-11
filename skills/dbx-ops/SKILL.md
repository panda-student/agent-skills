---
name: dbx-ops
description: 通过 dbx CLI 操作数据库与 Nacos——查表结构、执行 SQL、多语句脚本、会话与事务、Redis 命令、Nacos 配置/实例/命名空间（含 UAT 配置拉取，替代 ingress HTTP API）。连接清单由 DBX 桌面端托管，CLI 直接复用。当用户要查/改数据库数据、看表结构、拉 Nacos 配置、排查环境数据、执行 Redis 命令时使用；PMS SOP 中「数据库一律 dbx」红线由此 CLI 承载。也可通过 /dbx-ops 手动触发。
---

# dbx CLI（数据库 / Nacos）

> 封装说明：底层是 DBX 的纯 MCP 二进制（不支持命令行直调），`dbx` 命令是 MCP stdio 客户端 shim。源码 `~/.agents/cli/dbx-cli/`（领域逻辑）+ `~/.agents/cli/mcp-client/`（统一 MCP 机制层，stdio 传输，file: 依赖），`npm install && npm link` 装到 /d/nodejs；ZCode 的 MCP 形态配置已于 2026-11-10 移除，**一律走 CLI**。二进制路径可用环境变量 `DBX_BIN` 覆盖。

## 命令速查

| 命令 | 作用 |
|---|---|
| `dbx connections` | 列出已配置连接（ID/名称/类型/主机/库） |
| `dbx query --conn pms-uat "SELECT …"` | 执行查询，表格输出 |
| `dbx query --conn pms-uat --rows 1000 --cell 4000 "SQL"` | 放宽行数（默认100，上限1000）与单元格截断（默认200字符，上限4000） |
| `dbx batch --conn pms-uat "stmt1; stmt2;"` | 多语句脚本（方言感知分句，字符串/注释内分号安全） |
| `dbx tables --conn pms-uat [--db sys]` | 列表/视图 |
| `dbx describe --conn pms-uat TABLE` | 表结构 |
| `dbx databases --conn pms-uat` | 列出连接可用库 |
| `dbx call <工具名> '<json参数>'` | 其余 31 个工具原样透传（nacos/session/事务/redis 等） |
| `dbx tools [--json]` | 工具清单与参数模式（权威参考，写 call 参数前先查） |

## 高频 call 形态

- Nacos 拉配置（**参数名是 data_id / namespace，不是 dataId / tenant**）：
  `dbx call dbx_nacos_get_config '{"connection_name":"pms-uat-nacos","namespace":"pms-uat","data_id":"pms-service.yaml","group":"DEFAULT_GROUP"}'`
  返回 JSON 的 `content` 字段即配置全文。UAT Nacos 走 ingress 的 HTTP API 已 404，**拉 UAT 配置一律用本命令**。
- 会话与事务（跨语句共享连接/临时表）：`dbx call dbx_open_session '{"connection_name":"pms-uat","enable_transactions":true}'` → 拿 session_id → `dbx_begin_transaction` / `dbx_execute_query`(带session_id) / `dbx_commit_transaction` / `dbx_rollback_transaction` / `dbx_close_session`
- Redis：`dbx call dbx_execute_redis_command '{"connection_name":"pms-uat-redis","db":9,"command":"GET mykey"}'`（用 db 参数选库，不发 SELECT；枚举用 SCAN 勿用 KEYS）
- 长值滑窗：单格超 4000 字符时用 call 传 `cell_char_offset`（取上次返回的 offset 续读），先缩小到目标行列再滑

## 连接清单（2026-11-10 快照，以 `dbx connections` 实时为准）

| 连接名 | 用途 |
|---|---|
| pms-uat | **UAT 业务库** mysql 10.1.5.86:3306/sys（已经 UAT Nacos pms-uat/pms-service.yaml 原文确认） |
| pms-test | mysql 10.1.5.86:3306/pms_test（测试库，勿与 UAT 混淆） |
| pms-uat-redis / pms-test-redis | Redis（不同 db 号） |
| pms-uat-nacos / pms-test-nacos | Nacos（uat-pms.jomoo.com / 10.1.12.33:36032） |
| jpm-uat / jpm-test / livebos-prod | Oracle |
| jpm-uat-es / jpm-test-es | Elasticsearch |

## 踩坑与红线

- 双库陷阱：10.1.5.86 上 sys=UAT 业务库、pms_test=测试库，同名项目代码两边都有，**改数前必先 `--conn` 指对连接**，并用数据指纹（业务字段值比对 API 返回）确认打的是哪个环境
- 大结果集：query 单次上限 1000 行，更多用 LIMIT 分页；`--cell 4000` 只放宽单元格截断，超长值走 cell_char_offset 滑窗
- DDL 隐式提交：MySQL 族 DDL 不能进事务批量（dbx 会拒绝 use_transaction+DDL 组合）
- 写操作（UPDATE/DELETE/DDL）属危险动作，执行前向用户确认；改数后保留原值证据（SELECT 快照）
- 凭据不在 dbx 里取：连接密码等原料按 `vault-ops` 技能取用；系统登录/token 链路走 auth-center
- Nacos 拓扑坑（dev 入口的 pms-uat 命名空间为空属正常）见 nacos-ops 技能；dbx 的 nacos 连接已按正确环境配好，优先用
- 换机还原：`~/.agents/cli/dbx-cli/` 内 `npm install && npm link` 即恢复全局命令；连接配置在 DBX 桌面端数据目录，不随本仓库走
