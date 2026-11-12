---
name: vault-ops
description: 通过 vault CLI 操作本机凭据密码库——搜条目、读元数据、把密码/token 密文写入目标文件或浏览器/桌面输入框（密文永不回显、永不进对话），含凭据登记、更新、分组、标签、导出与恢复。统一走 CLI，不为单个软件注册 MCP 封装。任何技能或任务需要数据库、平台、Redis、Nacos、GitLab 等账号密码或 API token、需要注入脚本/配置/登录框、或需要登记整理凭据时使用；登录与 token 刷新链路由认证技能负责。可通过 /vault-ops 手动触发。
user-invocable: true
allowed-tools:
  - Read
  - Bash
---

# vault CLI（本机凭据密码库）

> **单一来源约定**：所有技能不得各自复述 vault 取用细节，只声明「选哪个条目 + 哪个凭据组 + 注入目标」，操作方式统一引用本技能。凭据数据本体在 `D:/vault/data`，不随仓库走。

## 入口：vault CLI

`D:/vault/vault.exe --mcp` 是纯 MCP 二进制；`vault` 命令是配套的 MCP stdio 客户端 shim，把常用操作暴露为子命令。**统一走 CLI，不为单个软件重复注册 MCP**。

| 项 | 值 |
|---|---|
| 命令 | `vault`（全局，落在 `/d/nodejs`） |
| 源码 | `~/.agents/cli/vault-cli/` + `~/.agents/cli/mcp-client/`（stdio 传输，file: 依赖） |
| 换机还原 | 在 `~/.agents/cli/vault-cli/` 执行 `npm install && npm link` |
| 二进制覆盖 | 环境变量 `VAULT_BIN` |
| 数据本体 | `D:/vault/data`（不随仓库走） |

## 核心约束：密文只落不回

- `vault search` / `vault get` **只返回元数据**：id、标题、URL、标签、环境、账号名、`hasPassword` / `hasToken`，没有明文
- 取明文唯一出口是 `vault fill`（或 `vault call write_credential`）：把值写入**文件**或**输入框**，只返回 `file_written` / `input_sent`
- `input_sent` 只代表键盘事件已发送，不代表页面或程序已接受；需另行校验，且不得打印值
- 全流程禁止 echo / cat / 日志打印密文；密文不得进入对话、命令参数、git 记录
- 写出的临时文件用完立即删除，不得 read 其内容，不得放入仓库或技能目录

## 检索与元数据

```bash
vault search gitlab
vault search --tag pms --kind password
vault get <id> [id...]
```

- 结果结构：`results[].entries[]`，每个请求项对应一条 result
- 条目字段：`id`、`title` / `name`、`url`、`services[]`、`groups[]`、`tags[]`、`siteMissing`
- 凭据组字段：`groups[].id` / `environment` / `account` / `hasPassword` / `hasToken`
- `siteMissing:true` 表示条目来源不明：**问用户归属，不要猜**
- 多个候选无法用 URL / tag / environment 区分时，同样问用户
- 条目 id 是唯一句柄：先 search 后 get，不凭记忆拼 id

## 取用范式

### A. 临时文件（给脚本 / CLI / curl 用）

适用：脚本、命令行工具、接口调用等进程内读取。

- 先解析临时目录：`python -c "import tempfile;print(tempfile.gettempdir())"`
- 写入密文，`--file` 必须是绝对路径：

```bash
vault fill <id> --field secret --file "<绝对临时路径>" [--group <gid>]
```

- 脚本从该文件读取值放进请求头 / 连接参数，**不打印**
- 临时文件统一命名 `vault-<app>-<field>.tmp`（如 `vault-gitlab-token.tmp`、`vault-qqmail-authcode.tmp`），放在系统临时目录
- 用完立即 `rm -f "<同一路径>"`

### B. 占位符替换（注入已有配置文件）

适用：`.env.local`、MCP 配置（如 `mcp.json`）等结构固定的文件。

- 先写骨架文件，密文位置放**恰好一个** `{{credential}}`
- 注入：

```bash
vault fill <id> --field secret --file "<绝对路径>" --mode replace [--group <gid>]
```

- `--mode replace` 只替换 `{{credential}}`，保留文件其余内容
- 常驻配置只允许 vault 注入，禁止手输、从对话粘贴或提交仓库；注入值可长期保留
- 任务收尾按需把该字段写回 `{{credential}}`，保持磁盘无明文

### C. 浏览器 / 桌面输入框

适用：登录页、WinForms SSO 弹窗等无法落文件交给进程读取的场景。

```bash
vault call capture_fill_target '{"windowTitle":"<窗口标题子串>","fieldName":"<控件可访问名称>","expectedPassword":true}'
vault call write_credential '{"credentialId":"<id>","groupId":"<gid>","field":"secret","target":{"type":"input","targetId":"<capture 返回的 id>"}}'
```

- Edge / Chrome 必须传 `windowTitle` + `fieldName` + `expectedPassword:true`；可用 `processId` 缩小窗口
- `targetId` 一次性、30 秒有效；过期重新 capture
- 输入插入到光标 / 选区，不清空、不提交；是否成功由调用方校验页面状态
- 空参数 capture 只认当前原生光标位置，DOM 聚焦不算数
- 目标必须唯一可编辑且标签匹配；歧义、只读、不匹配会被拒绝，不要绕过

## 凭据组与字段

- 一个条目可有多个凭据组；**多组时 `--group` 必填**，按 `environment` / `account` 选择
- `--field` 取值：
  - `password` / `token` / `secret`（`secret` = 有密码取密码，无密码取 token）
  - `account` / `environment` / `url` / `service_url` / `host` / `port` / `database_name` / `database_type`
- 条目有多个服务地址时，`field:"service_url"` 需指定 `serviceId`

## 登记与维护

```bash
vault call <工具名> '<json参数>'   # create/update/delete/restore/pin/organize/export 等
vault tools --json                 # 工具清单与参数模式（权威参考）
```

| 操作 | 工具 | 要点 |
|------|------|------|
| 新建 | `create_entries` | `items` 一次 1-100 条，批量原子；password/api 条目至少一组含密码或 token |
| 更新 | `update_entries` | 必须带 `expectedRevision`；只传要改字段，省略的密码 / token 保留 |
| 改组 | `update_entries` | 传 `groups[].id` 改现有组；省略 id 新增组；`removeGroups` 删组 |
| 软删除 | `delete_entries` | 删除后不可用；`restore_entries` 逐条恢复 |
| 置顶 | `pin_entries` | 单条 |
| 标签整理 | `organize` | 标签重命名 / 全局删除 |
| 导出 | `export_entries` | 桌面端人工输入口令；AI 只拿到状态与条目数 |
| 设置 / 同步 | 桌面端 | settings 权限默认关闭且权限规则只读；需要改设置或触发同步时请用户在桌面端操作 |

## 常用条目（tag 检索，2026-11-11 快照）

| tag | 条目 |
|-----|------|
| w00120 | 禅道账号（W00120 统一账号；禅道 / Rancher 等正式 jomoo 系统通用） |
| pms | PMS 平台 UAT 超管账号(00071763)、测试超管账号、普通账号(00098962/00098997) |
| mysql | uat-pms MySQL UAT 库(sys)、test-pms 测试库(pms_test)，账号 pmsuser |
| nacos | Nacos 注册中心 pms-szq / Nacos test / Nacos uat |
| zentao / tencent-docs / qqmail | 禅道账号、腾讯文档 MCP Token、QQ邮箱 |
| github / gitlab / rancher / ibpm / xxl-job / smtp / ucenter | 各系统账号与 API token |

**以 `vault search` 实时结果为准**。

## 与登录 / 认证链路的边界

- 登录 / 认证链路：系统登录、token 缓存与刷新（不在本技能范围）
- `vault-ops`：底层账号密码 / API token 原料
- 登录 / 认证链路不可用时，从 vault 取原料手动构建，不要另建凭据存储
- 工具链分工：数据库走 `dbx`、接口走 `yaak`、凭据走 `vault-ops`、登录走认证链路

## 被其它技能引用（复用契约）

调用方只声明三件事：

- **条目定位**：标题 / tag / URL / environment
- **凭据组**：`groups[].id` 或目标环境
- **注入目标**：临时文件路径、占位符文件路径，或浏览器窗口与字段名

统一引用句：

> 凭据取用见 `vault-ops` 技能；本技能只声明条目匹配与注入目标。

调用方禁止复制本技能的 CLI 命令与字段语义——口径变更只改本技能。

## 踩坑与红线

- 统一走 CLI，不要为单个软件再注册 MCP 封装；MCP 形态只在 `vault.exe --mcp` 内部协议层使用
- MCP 工具列表按桌面「MCP 管理 → 权限管理」实时裁剪：`search_entries`/`get_entries` 需「读取信息」，`write_credential` 需「窗口填写/写入文件」；被关掉时工具直接不出现且无报错。仅排障时用 stdio 探针核对服务端工具列表，日常不依赖 MCP
- `vault` 不可用时先按「入口」表还原（`npm install && npm link`），不要自行拼 MCP 客户端
- 密文红线：`search` / `get` 只出元数据，`fill` / `write_credential` 只落文件或输入框；不要试图绕过读取明文
- search 输出是 JSON，解析按 `results[0].entries[]` 取
- 导出需桌面端打开并人工确认；长时间无响应先确认桌面端状态，不重复触发
- 临时产物（密文文件、骨架文件、注入产生的 env 类文件）按任务收尾规则删除或复位