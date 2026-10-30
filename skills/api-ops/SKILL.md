---
name: api-ops
description: 接口相关任务统一以 yaak 处理的执行 SOP 与验证方法论——单发联调、保存复用、链式依赖（回环往复）、批量执行、多环境切换、CI 无人值守、导出文件校验、跨系统数据断点排查。当用户提到接口联调、验证接口、请求调试、接口自动化、接口测试、导出文件校验、调接口、排查接口返回为空/404/认证失败时使用；yaak 命令与字段细节以 use-yaak 技能及 CLI 自描述为准
user-invocable: true
---

# api-ops：接口任务全流程（一律 yaak 实现）

## 核心原则

- 接口相关任务（构建/发送/保存/复用/链式/批量/环境切换/校验/排查）**一律以 yaak 实现**；yaak CLI 与桌面端共用同一本地数据库，创建的请求是持久资产
- 命令/字段/模板函数细节**以 use-yaak 技能与 CLI 自描述为准**（`yaak <command> --help`、`yaak request schema http --pretty`、`yaak template-function show <name>`），本技能只写 SOP 与方法论，不复制命令手册
- Node fetch 脚本仅三种兜底：CI/环境无 yaak（yaak `export + --data-dir` 已能覆盖多数 CI 场景）、复杂断言逻辑一体化、二进制处理（PS5 管道损坏字节流）

## 任务类型 → yaak 实现速查

| 任务 | yaak 实现 |
|---|---|
| 单发请求（联调/调试） | `yaak request create` → `yaak request send <rq_id>` → `yaak response show <rq_id>` 验状态 |
| 保存复用/整理 | 请求与文件夹（继承 headers/auth）存入 workspace，桌面端即时可见 |
| 链式依赖（回环往复） | 参数用模板 `${[ response.body.path(request='rq_login', path='$.token') ]}`，yaak 自动先发上游 |
| 批量/按序执行 | `yaak send <fl_id 或 wk_id>`（`--fail-fast` `--parallel`） |
| 多环境切换 | base_url 变量化 `${[ base_url ]}` + 子环境 `-e ev_uat`；凭据引用环境变量，禁止写入真实 secret |
| CI/无人值守 | `yaak export` + `--data-dir ./.yaak` 得可运行套件（ID 跨导入存活） |
| 导入存量接口 | `yaak import`（OpenAPI/Postman/Insomnia/Bruno/cURL 自动识别） |

## 执行规则

- 字段/鉴权结构不确定 → 先读 schema，不要猜
- **验证以 `yaak response show` 为准**（status/headers/timing/最终 URL），send 的 stdout 只有 body；`-v` 仅作旁证
- **exit 0 ≠ 接口健康**：HTTP 404/500 也 exit 0，必须核对状态码再下结论
- 删除请求/文件夹需 `--yes`，且先与用户确认
- 请求命名按业务语义；临时验证用完清理
- CLI 与本文冲突时以 CLI 为准

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

- **CLI 传 JSON 丢引号**：`--json '{"id":...}'` 报 `key must be a string`——PS5 剥内层引号，内联/变量/Get-Content 三种传法全败。解法：node `spawnSync` 以 argv 数组直调 CLI js 入口（`(Get-Command yaak).Source` 定位 → `node_modules/@yaakapp/cli/bin/cli.js`），`JSON.stringify` 生成参数，零 shell 解析
- **二进制重定向损坏**：PS5 `>` 是 UTF-16 文本管道，`--raw > x.xlsx` 必坏字节流。二进制落盘用 `cmd /c "yaak ... > file"` 或 node 读 stdout 后 `Buffer` 写盘
- **中文 body**：PS5 调 HTTP 送中文必坏（编码不可控）——用 yaak 请求体（UTF-8）或 node fetch

## Node fetch 兜底场景（仅此三种）

- CI/环境无 yaak 且无安装权限（优先考虑 `export + --data-dir`）
- 复杂断言逻辑一体化（解析→条件分支→拼装下一步→多步断言）
- 二进制处理（导出魔数校验 + xlsx 解析）
