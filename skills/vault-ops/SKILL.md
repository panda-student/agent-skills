---
name: vault-ops
description: 通过 vault CLI 操作本机凭据密码库（vault.exe）——搜条目、读条目元数据、把密码/token 密文写入目标文件（密文永不回显、永不进对话）。PMS SOP 中「凭据一律本地密码管理器」红线由此 CLI 承载（原 MCP 形态已移除）。当需要取数据库/平台/Redis/Nacos 等账号密码或 API token 给脚本与 curl 复用、登记新凭据、整理凭据标签时使用；系统登录/token 刷新链路仍走 auth-center 技能。也可通过 /vault-ops 手动触发。
---

# vault CLI（凭据密码库）

> 封装说明：底层 `D:/vault/vault.exe --mcp` 是纯 MCP 二进制，`vault` 命令是 MCP stdio 客户端 shim。源码 `~/.agents/cli/mcp-shim-cli/`（npm link 装到 /d/nodejs）；ZCode 的 MCP 形态配置已于 2026-11-10 移除，**一律走 CLI**。路径可用环境变量 `VAULT_BIN` 覆盖。

## 命令速查

| 命令 | 作用 |
|---|---|
| `vault search [关键词] [--tag pms] [--kind password\|api\|database\|generic]` | 搜条目（只出元数据：id/title/tags/groups/账号名/有无密码或token），**永不出密文** |
| `vault get <id> [id…]` | 按 id 读条目元数据（groups[].id、revision 等，改条目前先读） |
| `vault fill <id> --field password --file D:\path\to\out.txt [--mode create\|replace] [--group GID]` | 把密文写进目标文件（不回显明文） |
| `vault call <工具名> '<json参数>'` | 其余工具原样透传（create/update/delete/pin/organize/export…） |
| `vault tools [--json]` | 工具清单与参数模式（权威参考） |

## 用法范式

- 取密码给脚本用：`vault search uat库` → 拿 id → `vault fill <id> --field password --file "$TEMP/pwd.txt"` → 脚本读该文件，用完即删；**禁止 cat 该文件、禁止让密码出现在终端输出**
- 覆盖已有文件中的占位符：模板里放恰好一个 `{{credential}}` 标记，`--mode replace` 只替换该标记、保留文件其余内容；`--mode create`（默认）新建文件
- 多凭据组条目（同一服务生产/测试两套账号）须 `--group <groups[].id>` 指定组
- `field` 取值：password / token / account / environment / secret（secret=密码，组里没密码时取 token）/ url / service_url / host / port / database_name / database_type
- 填 Windows 桌面程序输入框（WinForms SSO 弹窗等）：`vault call capture_fill_target '{…windowTitle…}'` 拿 30 秒一次性 targetId → `write_credential` target.type=input（anyshare-ops 的 SSO 回路即此机制）

## 常用条目（tag 检索，2026-11-10 快照）

| tag | 条目 |
|---|---|
| pms | PMS 平台 UAT 超管账号(00071763)、测试超管账号、普通账号(00098962/00098997) |
| mysql | uat-pms MySQL UAT 库(sys)、test-pms 测试库(pms_test)，账号 pmsuser |
| nacos | Nacos 注册中心 pms-szq / Nacos test / Nacos uat |
| zentao / 腾讯文档 | 禅道账号、腾讯文档 MCP Token |
| git / gitlab / rancher / ibpm / xxl-job / smtp / ucenter | 各系统账号与 API token |

**以 `vault search` 实时结果为准**；凭据与 auth-center 的关系：auth-center 管系统登录与 token 缓存/刷新链路，本库存底层账号密码与 API token 原料，auth-center 链路不可用时从这里取原料手动构建。

## 踩坑与红线

- 密文红线：MCP 工具层设计上「密文只落文件不回显」，`vault get`/`search` 只出元数据——不要试图用其他工具绕过读取明文；fill 写出的敏感文件用完即删，且不 read 其内容
- search 输出为 JSON（含结构化信息），jq/python 解析时按 `results[0].entries[]` 取
- 导出走桌面端人工确认（export_entries 需桌面窗口打开且输入口令），CLI 调用后两分钟无响应需重试
- 条目 id 是唯一句柄：先 search 后 get/fill，不要凭记忆拼 id
- 换机还原：`~/.agents/cli/mcp-shim-cli/` 内 `npm link`；凭据数据本体在 `D:/vault/data`（不随仓库走）
