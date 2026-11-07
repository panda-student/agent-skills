---
name: weekly-report
description: 周报/日报/下周计划填写全流程。拉取 PMS 仓库本周 git 提交（uat 分支），归属禅道任务，起草日报+周报汇总+下周计划到统一草稿文件（TSV），用户确认后用腾讯文档官方 MCP（smartsheet.*）API 直写三表记录，最后去重与清理。全程无浏览器自动化。触发词：周报、日报、下周计划、填日报、本周提交。
---

# 周报填写 Skill

自包含技能：脚本、经验教训、流程都在本目录。从 git 提交记录出发，产出日报、周报汇总、下周计划并写入腾讯文档智能表格。

**填写方案定案（2026-10-23，第四轮收敛）**：腾讯文档官方 MCP（`https://docs.qq.com/openapi/mcp`）+ `smartsheet.*` 工具 API 直写记录。历经 agent-browser 粘贴（成功但 AI 逐步介入慢）、playwright 全自动（日报两次失败）、PowerShell 批处理脚本（分组外游离行问题）三轮试错后定案——API 写入无焦点/定位/分组问题，秒级完成。

## 环境与资产

**技能是自包含的**：脚本、配置、模板、经验教训均在本技能目录（全局安装位置 `~/.agents/skills/weekly-report/`）。脚本运行时会自动探测项目根（`docs` + `.agents`/`.claude` 优先，其次 `.git`），因此项目内任意目录执行都能找到仓库与草稿目录。

| 资产 | 位置/值 | 说明 |
|---|---|---|
| PMS 仓库 | `<项目根>/pms`、`pms_frontend`、`pms_mobile` | 统一切 `uat` 分支 |
| 禅道配置 | **技能内 `config/zentao.json`**（回退 `<项目根>/.config/zentao.json`） | baseUrl/username；password 为 vault 占位符；`config/` 已 gitignore |
| MCP 配置 | **技能内 `config/tdocs_mcp.json`**（回退 `<项目根>/.config/`） | 三表标识（doc 节）+ 同步目标；token 为 vault 占位符 |
| 配置模板 | 技能内 `config.example/*.json` | 换机时复制到 `config/` 并填入真实值 |
| 禅道脚本 | 本目录 `scripts/zentao_tasks.js`、`zentao_task_detail.js` | 拉任务列表/详情 |
| 草稿目录 | `<项目根>/drafts/draft-<年>W<周>.txt` | TSV 数据（填写数据源） |
| Token 同步 | 本目录 `scripts/sync_token.mjs` | 重置后一键同步（剪贴板读新token → 更新配置 → 同步各 sync_targets） |
| 填写脚本 | 本目录 `scripts/fill_mcp.mjs` | 正式填写（解析草稿三节 → add_records 三表） |
| 去重脚本 | 本目录 `scripts/dedup_mcp.mjs` | 按日期+成员+内容分组保留最早，防重复写入 |
| MCP CLI | 本目录 `scripts/tdocs_mcp.mjs` | 通用单工具调用：`node tdocs_mcp.mjs <tool> <args.json>` |
| 文档/sheet | 配置 `doc` 节：file_id、三表 sheet_id、正文列名、日报 SZQ 视图 vOj1HV | fill/dedup 脚本均从此读取；换文档/改表结构只改配置，不动脚本 |
| 配额 | 免费 2000 次/天 | 每条 MCP 调用计数 |

**配置查找顺序**（`scripts/lib/config.cjs` 统一实现）：环境变量（`ZENTAO_CONFIG` / `TDOCS_CONFIG`）→ 技能内 `config/` → `<项目根>/.config/`。找不到直接报错并列出已查路径。

## 凭据注入（vault，运行前必须）

密钥不以明文保存：`config/zentao.json` 的 `password` 和 `config/tdocs_mcp.json` 的 `token` 是 `{{credential}}` 占位符，值由本地密码库 vault 维护。脚本检测到占位符会直接报错「未注入」。

| 凭据 | vault 条目 | credentialId | 注入目标 |
|---|---|---|---|
| 禅道密码（账号 W00120） | `禅道 zentao.jomoo.com` | `080c11b5-ec00-42b8-882a-9079080c5bdc` | `config/zentao.json` |
| 腾讯文档 MCP Token | `腾讯文档 MCP Token` | `7ce75007-717c-490e-86d2-234ca3ed9994` | `config/tdocs_mcp.json` |

1. **注入**：调 vault `write_credential`，`field=secret`，`target={"type":"file","mode":"replace","placeholder":"{{credential}}","path":"<注入目标绝对路径>"}`，`credentialId` 用上表。
2. **复位**：脚本跑完把对应字段写回 `{{credential}}`（改 JSON 即可，不要打印值），保持磁盘无明文。
3. **轮换**：改密码 / 重置腾讯文档 token 后，在 vault 桌面端更新对应条目；不要手写回配置文件。

> 注意：`sync_token.mjs` 仍会把新 token 写进配置并同步 Trae 的 `mcp.json`（外部消费者需要明文）。用它之后必须同步更新 vault 条目，再复位配置占位符。

## 流程

### 第 1 步：数据准备
1. **先更新所有仓库**（在项目根执行，三仓库各一次）：
   ```powershell
   git -C pms checkout uat; git -C pms pull origin uat
   ```
2. 拉本周提交（三仓库各拉一次合并去重；`<项目根>` = 脚本自动探测的根，通常就是当前工作区）：
   ```powershell
   git -C pms log origin/uat --since="2026-MM-DD" --until="2026-MM-DD" --pretty="format:%h|%ad|%s" --date=format:"%m-%d" --author="sunzhiqiang" > log_pms.txt
   ```
3. **禅道编号来自 commit 信息前缀**（从禅道领取的任务，提交时在前缀标识编号）。起草阶段不访问禅道；没有前缀的提交无需编号，直接进入起草
   - 需要访问时：`node scripts/zentao_tasks.js` → `zentao_tasks.json`
   - ⚠️ 脚本分页可能截断，任务数可疑时全量翻页核对；`GET /tasks` 重复缺失，以 `GET /executions/1231/tasks` 过滤 assignedTo 为准
   - 已完结模块的延续迭代仍带原编号（如 23024）；自动化测试等无在职编号工作直接不带编号

### 第 2 步：归属分析与起草
4. **起草时不访问禅道**：编号只取 commit 信息前缀，没有前缀的条目不写编号。禅道只在填写成功后更新任务状态时访问（见第 3 步第 10 条）
5. 写草稿 `weekreport/drafts/draft-<年>W<周>.txt`（模板 references/draft-template.txt），三节：
   - **日报** = 本周实际工作日数（法定节假日不上，调休补班要上）
   - **周报汇总** 1 行、**下周计划** 1 行，日期 = 当前日期
   - 格式：`禅道：编号-内容`；**内容禁半角空格**（TSV 列分隔安全）；全角空格　可作条目分隔；列间真实 Tab
6. **展示草稿全文，用户确认/修改后进入第 3 步**

### 第 3 步：MCP 直写（约 1 秒，无浏览器，三表并行）
7. **工具选择分层**（重要）：
   - **点状操作**（补录/修改一两行、查状态对账）：AI 直接调 Trae 内置 `tencent-docs` MCP 工具（list_records/update_records），灵活无需脚本
   - **整周全量填写/去重/清理**：跑脚本（格式构造、分页拉全量、本地分组是确定性机械活，脚本省上下文且零格式错误）
   ```powershell
   node "$HOME\.agents\skills\weekly-report\scripts\fill_mcp.mjs" drafts\draft-2026W43.txt
   ```
   - 脚本自动：并行拉三表字段元数据（option text→id 动态映射）→ 解析三节 → `smartsheet.add_records` 三表并行写入 → 记录自动归组
8. **防重（重要）**：写入前若该周已有数据（如用户手填过），先跑去重：
   ```powershell
   node "$HOME\.agents\skills\weekly-report\scripts\dedup_mcp.mjs"   # 按 日期+成员+内容 分组，保留最早，删其余
   ```
   - 保险顺序：`fill_mcp.mjs` → `dedup_mcp.mjs` → 浏览器刷新核对
9. **核对**：浏览器刷新看三表（或 `tdocs_mcp.mjs smartsheet.list_records` 抽查）；填错删行用 `smartsheet.delete_records`（record_id 从 list_records 拿）
10. **禅道状态更新（写入成功后）**：仅当草稿中的条目带禅道编号前缀时，才更新对应禅道任务状态；无前缀的条目不访问禅道。本目录暂无任务状态更新脚本，需要时再补

### 第 4 步：禅道工时与任务收尾（用户触发"补工时/梳理任务"时执行）
10. `node "$HOME\.agents\skills\weekly-report\scripts\zentao_worktime_build.js" [周标识]` 生成补录草稿（默认写 `<项目根>/drafts/zentao-worktime-<本周>.txt`）
    - TASKS/RULES 为当期硬编码，先更新；输入为 `<项目根>/gitlog_{pms,pms_frontend,pms_mobile}.txt`
    - 规则：每任务补录至 left=0；日期参考提交日期；每天全局 ≤8h；每任务总消耗 ≤ 预计工时
11. 过期任务先提醒用户调整，确认后 `node "$HOME\.agents\skills\weekly-report\scripts\zentao_worktime_execute.js" [草稿文件]` 执行
12. 清理临时文件：`shots\`、`log_*.txt`、`zentao_*.json`、`.config\_mcp_args*.json` 等；保留 `drafts\`、`.config\`、skill 目录、三仓库

## 经验教训速查（详见 references/lessons.md）
- **MCP 写入格式**：日期=`string_value` 毫秒时间戳（+08:00 0 点）；singleSelect=`option_value:{items:[{id,text}]}`（option 必须已存在，动态从 list_fields 拉映射）；number=`number_value`；text=`text_value:{items:[{text,type:"text"}]}`（**type 必填**，漏了报 400001）
- MCP 端点 stateless（无 session header），先 initialize 再 tools/call；免费 2000 次/天
- PowerShell 5.1 调外部程序：内嵌双引号被剥离 + 中文参数 GBK 乱码 → JSON 参数一律走临时文件（UTF8 无 BOM），读外部 UTF8 输出前设 `[Console]::OutputEncoding=UTF8`
- smartsheet 表体 canvas 渲染：「总计」等单元格内容 DOM/innerText 读不到；「添加一行」按钮 DOM 有 4 个同名（2 个屏幕外负坐标），`find text` 会点错隐藏元素
- 浏览器加行+粘贴的坑（已废弃但备查）：点已选中的 SZQ tab 触发子视图重载；mouse 坐标点击加行后粘贴焦点丢失（click @ref 正常）；游离空行导致「粘贴内容与类型不符」toast
- 进度表环节已移除（2026-10-23 用户确认任务均 100%）；进度表文档自动化打开可能卡加载转圈
