---
name: yaak-ops
description: Yaak 指导唯一技能——接口相关任务统一以 yaak CLI 处理的执行 SOP 与验证方法论：单发联调、保存复用、链式依赖（回环往复）、批量执行、多环境切换、CI 无人值守、导出文件校验、跨系统数据断点排查。当用户提到接口联调、验证接口、请求调试、接口自动化、接口测试、导出文件校验、调接口、排查接口返回为空/404/认证失败时使用；命令与字段细节直接查 yaak CLI 自描述（`yaak --help` / `yaak request schema`），不依赖其它 Yaak 技能
user-invocable: true
---

# yaak-ops：接口任务全流程（一律 yaak 实现）

## 核心原则

- 接口相关任务（构建/发送/保存/复用/链式/批量/环境切换/校验/排查）**一律以 yaak 实现**；yaak CLI 与桌面端共用同一本地数据库，创建的请求是持久资产
- **本技能是 Yaak 指导唯一技能**：命令/字段/模板函数细节**直接查 yaak CLI 自描述**（`yaak <command> --help`、`yaak request schema http --pretty`、`yaak template-function show <name>`）；本技能承载 SOP/执行规则/方法论/踩坑，不复制命令手册
- Node fetch 脚本仅三种兜底：CI/环境无 yaak（yaak `export + --data-dir` 已能覆盖多数 CI 场景）、复杂断言逻辑一体化、二进制处理（PS5 管道损坏字节流）

## 任务类型 → yaak 实现速查

| 任务 | yaak 实现 |
|---|---|
| 单发请求（联调/调试） | `yaak request create` → `yaak request send <rq_id>` → `yaak response show <rq_id>` 验状态 |
| 保存复用/整理 | 请求与文件夹（继承 headers/auth）存入 workspace，桌面端即时可见 |
| 链式依赖（回环往复） | 参数用模板 `${[ response.body.path(request='rq_login', path='$.token') ]}`，yaak 自动先发上游 |
| 批量/按序执行 | `yaak send <fl_id 或 wk_id>`（`--fail-fast` `--parallel`） |
| 多环境切换 | base_url 变量化 `${[ base_url ]}` + 子环境 `-e ev_uat`；凭据引用环境变量（变量值按 `vault-ops` 技能取用），禁止写入真实 secret |
| CI/无人值守 | `yaak export` + `--data-dir ./.yaak` 得可运行套件（ID 跨导入存活） |
| 导入存量接口 | `yaak import`（OpenAPI/Postman/Insomnia/Bruno/cURL 自动识别） |

## 执行规则（接口任务一律遵守）

- 发送前不确定字段/鉴权结构 → 先 `yaak request schema http --pretty`，不要猜
- **body 必须为 `{bodyType: "application/json", text: "<json字符串>"}` 对象形态**，且 Content-Type 头需手工加（bodyType 不会自动加头）。2026.9.0 对纯字符串 body 会**静默丢弃**——update 失败仍发旧存储 body，导致「重试实际发旧 payload」（2026-11-04 事故复盘）；2026.9.1 起已改为硬报错（`invalid type: string, expected a map`），但不得依赖报错兜底，按下条执行
- **create/update 后必须读回比对，一致才 send**：`yaak request show <rq_id>` 读回，核对 `body.text` 与本次预期载荷逐字符一致后再发送；不一致立即停下排查构造过程，**禁止盲目重试**（body 未更新时重试只会反复发旧 payload）。该兜底同时拦截「合法 JSON 但内容错误」（旧 payload 复用、引号剥离后变形等 CLI 报错拦不住的情形）
- **模板参数传 JSON 文本：单引号必须转义**：Yaak 模板函数参数用单引号定界，JSON 文本里的 `'` 必须写成 `\'`，例如 `${[ json.escape(input='{"name":"O\'Reilly"}') ]}`；未转义时 `'` 被当作参数结束符，模板扫描失败且 **不报错**，整段 `${[ ... ]}` 会原样发给服务端。更稳的写法是把 JSON 文本放环境变量后引用 `${[ json.escape(input=jsonText) ]}`。2026-11-11 用本地 echo 服务验证：普通 JSON body（含中文/嵌套 JSON/换行）、URL/表单参数均正常，仅模板参数内的裸单引号受影响；`json.minify` / `json.jsonpath` / `json.escape` 都适用此规则
- **验证以 `yaak response show` 为准**（status/headers/timing/最终 URL），send 的 stdout 只有 body；`-v` 仅作旁证
- **exit 0 ≠ 接口健康**：HTTP 404/500 也 exit 0，必须核对状态码再下结论
- 删除请求/文件夹需 `--yes`，且先与用户确认
- 请求命名按业务语义（它们是用户数据不是草稿）；临时验证用完清理
- CLI 与本技能冲突时以 CLI 为准（先跑 `yaak --help` 检查技能是否过期）
- **工作区收敛原则：同一业务系统只维护一个 yaak 工作区**。新建前先 `yaak workspace list` 查重；发现同系统重复区时先合并再删除——按归一化 URL（模板变量统一替换后）比对去重，独有请求迁入保留区（优先保留环境变量/凭据齐全的区），确认 0 丢失后 `yaak workspace delete --yes` 删除多余区

## 跨系统数据断点排查法

A 系统页面显示 B 系统数据为空时，用**同一报文**逐层请求三处对比（全部用 yaak 建请求执行）：

- B 系统直连入口（绕过中间层）→ 中间转发层（API 中心在线调试/网关）→ A 系统透传/消费接口
- 哪层开始变空/报错，断点就在该层与上一层之间
- **空响应结构指纹**：不同环境空响应字段结构（errorCode/nowDateTime/args 有无）可实锤「实际打到了哪个环境」
- **陷阱①静默降级**：下游常对外部数据空/异常静默降级（跳过覆盖+主表兜底），页面无报错≠链路健康，必须直调透传接口
- **陷阱②环境隔离**：SIT 域名打 UAT 数据 ID 恒返回空且不报错；跨环境验证先确认报文数据与目标环境匹配

## 导出文件类接口校验（三层）

- HTTP 200 + Content-Type 为 excel/octet-stream
- 文件魔数：前 4 字节 `50 4B 03 04`（xlsx=ZIP 容器）；若是 `7B 22`（`{"`）说明返回 JSON 错误体而非文件
- 内容：Node xlsx 库解析表头与数据行，校验列存在性与字典翻译值（@PersonField 工号→姓名、@DictField id→名称）

## Windows/PowerShell 5 坑与兜底

- **CLI 传 JSON 丢引号（复杂载荷）**：`--json '{"id":...}'` 报 `key must be a string`——PS5 剥内层引号；变量/Get-Content 传法全败。解法：node `spawnSync` argv 数组直调 CLI js 入口（`(Get-Command yaak).Source` → `node_modules/@yaakapp/cli/bin/cli.js`），`JSON.stringify` 生成参数，零 shell 解析。**注意（2026-10-23 实证）**：从 PowerShell 命令行直接调 `node cli.js` 并以 PS 字符串变量传参同样断裂（`.Replace('"','\"')` 手动转义后 PS→node.exe 的引号化仍二次处理，`\"Bearer x\"` 的段内空格必断）——PS 字符串变量路径无解；spawnSync 必须在 **node 脚本内部**构造 argv 数组才绕开 shell。多步请求+断言场景更快的路：直接写 Node fetch 脚本一体化（序列+断言+清理一气呵成，脚本放临时目录用完即删），不必强行走 yaak CLI
- **CLI 传 JSON 可内联（2026-10-28 实证，简单载荷首选）**：`yaak request update '{\"id\":\"rq_xxx\",\"name\":\"...\"}'`——单引号包裹、**内部双引号全部前置反斜杠转义**（`\"`）、嵌套 JSON（如 body.text）内层引号用 `\\\"`；**载荷内禁止 ASCII 空格**（含空格会被 shell 包装拆散报 `unexpected argument`，中文说明去掉空格即可，中文本身可正常入库）。含空格/复杂转义载荷仍走上条 node spawnSync。**2026-11-03 反证**：`ConvertTo-Json` 产物再手动 `-replace '"','\"'` 转义同样两连败（长载荷报 `invalid escape`/`expected , or }`；含空格模板串报 `unexpected argument '${['`）——ConvertTo-Json 不改变 PS→exe 引号化二次处理的结局，勿再尝试该组合
- **已存请求场景最省链路：yaak send 拿凭据 + python urllib 发业务请求（2026-11-02 实证）**：PS5.1 向原生 exe 传 JSON 参数双引号必被拆（`$obj | ConvertTo-Json` 变量直传同样报 `Invalid JSON: key must be a string`——PS→exe 引号化二次处理无解）；且 `yaak` 实为 `yaak.ps1` shim（`Get-Command yaak` 验证），python `subprocess.run(['yaak',...])` 报 WinError 2（找不到文件），`subprocess` 调 `powershell` 又可能被策略拦（WinError 786）。标准兜底链路：① Shell 里 `yaak send <登录请求ID> -e <环境ID> | Out-File $env:TEMP\xxx.json`（环境变量自动替换密码，**凭据不落对话**）② python urllib 读 token 文件后直接发业务请求。适用于「登录请求已存 yaak、业务请求临时发」的终验/联调场景
- **创建带模板串的请求走文件中转 import**（2026-10-28 实证）：PS 内联 curl 带 `${[ ... ]}` 模板串会被引号解析破坏——把 curl 命令文本原样写入文件再 `yaak import`，模板串字面量入库、发送时才求值；import 产物无名无分组，创建后需再 update 补名称/分组/说明。**2026-11-03 实证**：curl 的 `Authorization: Bearer ${[ response.body.path(request='rq_xxx', path='$.token') ]}` 头不会丢——importer 把它转换为**请求级 bearer 认证设置**（authenticationType=bearer，token 模板随之迁移，发送时链式依赖照常生效），不再是 header；导入后用 `yaak request show <rq_id> | Select-String authentication` 核认模板完整即可直接发送
- **二进制重定向损坏**：PS5 `>` 是 UTF-16 文本管道，`--raw > x.xlsx` 必坏字节流。二进制落盘用 `cmd /c "yaak ... > file"` 或 node 读 stdout 后 `Buffer` 写盘
- **中文 body**：PS5 调 HTTP 送中文必坏（编码不可控）——用 yaak 请求体（桌面端/CLI 均为 UTF-8）或 node fetch

## 职责边界

- 本技能是 Yaak 指导**唯一 SSOT**（SOP/执行规则/方法论/踩坑只在此维护）；其它技能只引用 `yaak-ops`；命令细节一律以 `yaak --help` 等 CLI 自描述为准

## Node fetch 兜底场景（仅此三种）

- CI/环境无 yaak 且无安装权限（优先考虑 `export + --data-dir`）
- 复杂断言逻辑一体化（解析→条件分支→拼装下一步→多步断言）
- 二进制处理（导出魔数校验 + xlsx 解析）
