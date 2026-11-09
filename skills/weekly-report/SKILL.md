---
name: weekly-report
description: 周报/日报/下周计划填写全流程。拉取 PMS 仓库本周 git 提交（uat 分支），归属禅道任务，起草日报+周报汇总+下周计划到统一草稿文件（TSV），用户确认后通过 tencent-docs 本地 CLI 直写三表记录，最后去重与清理。全程无浏览器自动化。触发词：周报、日报、下周计划、填日报、本周提交。
---

# 周报填写 Skill

自包含技能：SOP、配置、经验教训在本目录；腾讯文档操作走 `tencent-docs` 本地 CLI，禅道操作走 `zentao` CLI（`jpm-zentao-operate`）。从 git 提交记录出发，产出日报、周报汇总、下周计划并写入腾讯文档智能表格。

**填写方案定案（2026-10-23，第四轮收敛）**：腾讯文档 API 直写记录，现统一经 `tencent-docs` 本地 CLI（通用端点/格式见 `tencent-docs`）。历经 agent-browser 粘贴（成功但 AI 逐步介入慢）、playwright 全自动（日报两次失败）、PowerShell 批处理脚本（分组外游离行问题）三轮试错后定案——API 写入无焦点/定位/分组问题，秒级完成。

## 依赖：腾讯文档 / 禅道操作能力

腾讯文档的通用操作（MCP 工具/HTTP 端点、smartsheet 字段值格式、选项映射、分页、写后校验、token/凭据、PowerShell 互操作）统一见 `tencent-docs`。

禅道操作（登录、任务列表/详情、工时填写、任务关闭、API 异常处理）统一走 `zentao` CLI，用法见 `jpm-zentao-operate`。周报不维护禅道 API 脚本。

本技能只保留周报业务：PMS 仓库/禅道数据准备、草稿格式、三表字段与视图映射、写入后的禅道状态处理。草稿解析、字段映射、去重决策均由 AI 按 SOP 执行，不维护脚本。

周报不再维护腾讯文档脚本；AI 按本技能 SOP 直接调用 `tencent-docs/scripts/tdocs.mjs`，token/MCP/分页都由 CLI 负责。默认按同级技能目录解析，可用 `TENCENT_DOCS_ROOT` 覆盖。

## 环境与资产

**业务资产自包含**：doc 配置、模板、经验教训在本技能目录（全局安装位置 `~/.agents/skills/weekly-report/`）；腾讯文档 token/账号共享配置在 `tencent-docs/config/tdocs_common.json`；禅道连接配置、凭据与 token 全部在 `~/.auth-center/apps/zentao-cli/`，由 zentao CLI 经 auth-center 管理。工作区根按 `docs` + `.agents`/`.claude`（其次 `.git`）识别，草稿与仓库都相对它定位。

| 资产 | 位置/值 | 说明 |
|---|---|---|
| PMS 仓库 | `<项目根>/pms`、`pms_frontend`、`pms_mobile` | 统一切 `uat` 分支 |
| 禅道配置 | `~/.auth-center/apps/zentao-cli/config.json` | baseUrl/account/defaultAssignee + token 缓存；由 zentao CLI 管理，不含密码 |
| 禅道凭据 | `~/.auth-center/apps/zentao-cli/sso-credentials.json` | 由 zentao CLI 经 auth-center 管理；AI 用 vault 注入时只改这个文件 |
| 周报文档配置 | **技能内 `config/weekly_docs.json`** | 只存周报三表标识（doc 节）；token/同步目标在 `tencent-docs/config/tdocs_common.json` |
| 配置模板 | 技能内 `config.example/*.json` + `tencent-docs/config.example/tdocs_common.json` | 换机时复制到对应 `config/` 并填入真实值 |
| 禅道 CLI | `zentao` 全局命令（源码 `~/.agents/cli/zentao-cli`） | 任务列表/详情、工时、关闭；用法见 `jpm-zentao-operate` |
| 草稿目录 | `<项目根>/drafts/draft-<年>W<周>.txt` | TSV 数据（填写数据源） |
| 文档工具 CLI | `tencent-docs/scripts/tdocs.mjs` | 所有腾讯文档操作入口：`call` / `sheets` / `smartsheet` |
| 文档/sheet | 配置 `doc` 节：file_id、三表 sheet_id、正文列名、日报 SZQ 视图 vOj1HV | AI 按 SOP 从配置读取；换文档/改表结构只改配置 |
| 配额 | 共享配置 `tencent-docs/config/tdocs_common.json` 的 `quota` | 免费 2000 次/天，每条 MCP 调用计数 |

**配置位置**：禅道连接配置、凭据与 token 缓存统一在 `~/.auth-center/apps/zentao-cli/`，由 zentao CLI 与 auth-center 管理，周报不再维护禅道配置；周报文档配置 `config/weekly_docs.json` 由 AI 直接读取；腾讯文档 token 由 `tencent-docs` CLI 从 `tencent-docs/config/tdocs_common.json` 读取，周报不接触。

## 凭据注入（vault，可选；无头登录时需要）

周报自己的凭据只有禅道密码；腾讯文档 token 由 `tencent-docs` 技能统一管理，周报不再单独维护。

禅道密码不再写进配置。zentao CLI 已接入 `auth-center`：
- 首选交互登录：`zentao login` 拉起共享 Edge（`~/.auth-center/edge-profile`），登录一次后捕获 `zentaosid` 存 `~/.auth-center/apps/zentao-cli/config.json`，后续复用。
- 可选无头登录：凭据存 `~/.auth-center/apps/zentao-cli/sso-credentials.json`，`zentao login` 直接调 `/tokens`，不弹窗。
- 占位符 `{{credential}}` 会被 CLI 视为未注入；失效时重新 `zentao login` 即可。

| 凭据 | vault 条目 | credentialId | 注入目标 |
|---|---|---|---|
| 禅道密码（账号 W00120） | `禅道 zentao.jomoo.com` | `080c11b5-ec00-42b8-882a-9079080c5bdc` | `~/.auth-center/apps/zentao-cli/sso-credentials.json` |

- **骨架**：先写 `{"account":"W00120","password":"{{credential}}"}` 到注入目标（文件不存在时），再调 vault。
- **注入**：调 vault `write_credential`，`field=secret`，`target={"type":"file","mode":"replace","placeholder":"{{credential}}","path":"<注入目标绝对路径>"}`，`credentialId` 用上表。
- **验证**：`zentao whoami`（缓存有效）或 `zentao login`（强制刷新）。
- **复位**：流程跑完把对应字段写回 `{{credential}}`（改 JSON 即可，不要打印值），保持磁盘无明文。
- **轮换**：改密码后在 vault 桌面端更新禅道条目；腾讯文档 token 的轮换见 `tencent-docs` 技能。

## 流程

### 数据准备

- 禅道 CLI 使用统一配置 `~/.auth-center/apps/zentao-cli/config.json`，无需设置环境变量。
- 凭据/token 由 zentao CLI/auth-center 管理；失效时 `zentao login`（共享 Edge 弹窗登录一次），再用 `zentao whoami` 确认。
- **先更新所有仓库**（在项目根执行，三仓库各一次）：
  ```powershell
  git -C pms checkout uat; git -C pms pull origin uat
  ```
- 拉本周提交（三仓库各拉一次合并去重；`<项目根>` 通常就是当前工作区）：
  ```powershell
  git -C pms log origin/uat --since="2026-MM-DD" --until="2026-MM-DD" --pretty="format:%h|%ad|%s" --date=format:"%m-%d" --author="sunzhiqiang" > log_pms.txt
  ```
- **禅道编号来自 commit 信息前缀**（从禅道领取的任务，提交时在前缀标识编号）。起草阶段不访问禅道；没有前缀的提交无需编号，直接进入起草
  - 需要访问时：`zentao my-tasks <执行ID>`（或 `zentao my-work`），用法见 `jpm-zentao-operate`
  - ⚠️ 禅道 `GET /tasks` 有重复与缺失，任务列表以 `zentao my-tasks <执行ID>` 为准；任务数可疑时对照禅道页面核对
  - 已完结模块的延续迭代仍带原编号（如 23024）；自动化测试等无在职编号工作直接不带编号

### 归属分析与起草

- **起草时不访问禅道**：编号只取 commit 信息前缀，没有前缀的条目不写编号。禅道只在填写成功后更新任务状态时访问（见「禅道状态更新」）
- 写草稿 `weekreport/drafts/draft-<年>W<周>.txt`（模板 references/draft-template.txt），三节：
  - **日报** = 本周实际工作日数（法定节假日不上，调休补班要上）
  - **周报汇总** 1 行、**下周计划** 1 行，日期 = 当前日期
  - 格式：`禅道：编号-内容`；**内容禁半角空格**（TSV 列分隔安全）；全角空格　可作条目分隔；列间真实 Tab
- **展示草稿全文，用户确认/修改后进入「填写」**

### 填写（AI 按 SOP 调用腾讯文档 CLI）

- 读 `config/weekly_docs.json`，拿 `file_id`、三表 `sheet_id`、字段名和日报视图 `view_id`。
- 对每张表先拉字段元数据，建立 option 文本→id 映射：
  ```powershell
  node "$HOME\.agents\skills\tencent-docs\scripts\tdocs.mjs" smartsheet fields <file_id> <sheet_id> --pretty
  ```
- 解析草稿三节，按字段类型构造记录：日期毫秒时间戳、singleSelect 选项 id、number、text。
- 把记录写入临时 JSON，按表调用：
  ```powershell
  node "$HOME\.agents\skills\tencent-docs\scripts\tdocs.mjs" smartsheet add <file_id> <sheet_id> @records.json
  ```
- 记录落位由表自动处理；三表可以并行/依次写。
- **防重**：先拉全量记录，按「日期+成员+内容」分组，保留最后编辑最早的一条，其余收集 `record_id` 删除：
  ```powershell
  node "$HOME\.agents\skills\tencent-docs\scripts\tdocs.mjs" smartsheet records <file_id> <sheet_id> --all --pretty
  node "$HOME\.agents\skills\tencent-docs\scripts\tdocs.mjs" smartsheet delete <file_id> <sheet_id> --ids id1,id2
  ```
- **核对**：再拉记录抽查；填错行用同一个 delete 命令删除。
- **禅道状态更新（写入成功后）**：仅当草稿中的条目带禅道编号前缀时，才更新对应禅道任务状态；无前缀的条目不访问禅道。用 `zentao close <任务ID>` 关闭，或 `zentao effort` 填至 left=0 自动完成

### 禅道工时与任务收尾（用户触发"补工时/梳理任务"时执行）

- 先拉现状：`zentao tasks <ID1,ID2,...>`（状态/预计/消耗/剩余 + `dailyTotals` 当日已填工时，用于 8h 校验）
- 输入为 `<项目根>/gitlog_{pms,pms_frontend,pms_mobile}.txt` 或本周 commit；AI 按规则现算补录计划，草稿写 `<项目根>/drafts/zentao-worktime-<本周>.txt`：
  - 每任务补录至 left=0；日期参考提交日期；每天全局 ≤8h；每任务总消耗 ≤ 预计工时
- 过期任务先提醒用户调整 deadline；确认后逐条执行：
  ```powershell
  zentao effort --task-id <ID> --date <YYYY-MM-DD> --consumed <h> [--left <剩余>] [--deadline <YYYY-MM-DD>]
  ```
- 填完用 `zentao tasks <ID,...>` 复核状态/消耗/剩余
- 清理临时文件：`shots\`、`log_*.txt`、`zentao_*.json`、`.config\_mcp_args*.json` 等；保留 `drafts\`、`.config\`、skill 目录、三仓库

## 经验教训速查（详见 references/lessons.md）
- 腾讯文档操作格式（日期/选项/数字/文本、MCP 端点、PowerShell/Node 互操作）统一见 `tencent-docs`
- smartsheet 表体 canvas 渲染：「总计」等单元格内容 DOM/innerText 读不到；「添加一行」按钮 DOM 有 4 个同名（2 个屏幕外负坐标），`find text` 会点错隐藏元素
- 浏览器加行+粘贴的坑（已废弃但备查）：点已选中的 SZQ tab 触发子视图重载；mouse 坐标点击加行后粘贴焦点丢失（click @ref 正常）；游离空行导致「粘贴内容与类型不符」toast
- 进度表环节已移除（2026-10-23 用户确认任务均 100%）；进度表文档自动化打开可能卡加载转圈
