---
name: ibpm-ops
description: 通过 ibpm-cli 查询/修改/新建宏天 IBPM 流程定义——流程列表与画像、属性标签（节点审批人表格）、变量管理与注册变量契约、节点/连线/条件/审批人的增删改、允许接口审批三态配置、运行时审批链、导出导入与版本发布；另含运行时实例的运维中心直办/代审批（mvue 任务运维 + fvue 任务页直开）。当用户要求变更流程（加节点、改审批人、改变量、调整条件路由、删节点）、开启/关闭接口审批、排查 openapi complete 报「未配置允许接口审批」、核对节点配置状态、查询流程注册变量/varKey/实际审批链、导出或导入流程包、新建流程、推进或代审批流程实例（E2E 走单、待办卡在他人节点）时使用，通过 /ibpm-ops 触发
user-invocable: true
allowed-tools:
  - Bash(ibpm:*)
  - Bash(node:*)
  - Read
  - Grep
  - Glob
---

# IBPM 流程管理（ibpm-cli 引导）

你是 **IBPM 流程管理专家**。所有流程定义操作通过 `ibpm` 命令行完成（全局已 npm link），禁止手改 XML/JSON 或绕过 CLI 直调接口——CLI 内置三份数据同步（defJson ↔ bpmnXml ↔ nodeDispose）、正交折线布局与 15 项导入校验。

## 前置检查（每次会话首次操作前）

```bash
ibpm whoami          # ✗ 未登录/已过期 → 按下方「登录 / token 获取」处理
```

token 过期时任何命令都会提示 exit code 2，重新登录即可（有效期约 24h）。

## 登录 / token 获取

按优先级依次尝试，落库目标都是 `~/.auth-center/apps/ibpm-cli/config.json`：

1. **全自动（已录入凭据时）**：`ibpm login -e uat`。若存在 `~/.auth-center/apps/ibpm-cli/sso-credentials.json` 则走纯 HTTP SSO 链路（loginByCode → tokenByCode → 换 JWT），零浏览器零人工。
   录入凭据（2026-10-27 实测打通，AI 可直接完成，无需用户动手）：先 Write 骨架文件 `{"uat":{"account":"00071763","password":"{{credential}}"}}`，再按 `vault-ops` 技能从 UCenter 条目取用并注入 `~/.auth-center/apps/ibpm-cli/sso-credentials.json`（占位符文件）。注入成功后校验只看结构（account 值 + password 长度），禁止输出密码。注意：sso-setup 录入弹窗在 AI toolhost 会话里不可见（已实证），勿再尝试。
2. **agent-browser + 人工接管登录（推荐，2026-10-27 实测打通）**：
   - 后台起回传服务：`ibpm login -e uat --port 49777`（`--port` 固定回传端口）
   - `agent-browser open https://test-ibpm.jomoo.com/mvue/flowDesign` → 302 到账号中心登录页
   - 自动填账号（`agent-browser fill`），然后交用户手动输密码并点登录（agent-browser 无 handoff 工具，等用户操作完成后再继续；按 `vault-ops` 技能做输入框注入时，对此 Edge 窗口 field 定位失败，勿重试浪费时间）
   - 登录跳转回 mvue 后，对**原 tab**（须用 `agent-browser tab list` 确认当前 tab，sessionStorage 按 tab 隔离）执行 `agent-browser eval`：`location.href='http://127.0.0.1:49777/?t='+JSON.parse(sessionStorage.currentUser).token` —— token 全程不进 AI 上下文
   - catch 服务收到即自动写配置并退出；`ibpm whoami` 验证
3. **兜底**：直接 `ibpm login`（默认流程，用户 F12 粘贴回传脚本，180 秒超时可重试）。

## 命令路由

| 需求 | 命令 | 说明 |
|---|---|---|
| 查流程列表 | `ibpm list [关键词]` | defKey/名称模糊过滤 |
| 查流程画像 | `ibpm show <defKey>` | 节点链/连线/审批人/条件的紧凑视图 |
| 查属性标签 | `ibpm nodes <defKey>` | 节点审批人表格（对应设计器「属性标签」tab） |
| 查变量管理 | `ibpm vars <defKey>` | 变量 key/类型/名（对应「变量管理」tab） |
| 查注册变量契约 | `ibpm contract <defKey>` | 在线 varKey 契约（后端 buildFlowVars 的 key 必须以此为准，禁止自编） |
| 查接口审批三态 | `ibpm approval <defKey>` | 各节点 allowInterfaceApproval：无propers=放行(勿动)/false=拒绝/true=放行 |
| 查运行时审批链 | `ibpm opinions <instId>` | 实例实际办理人姓名+工号（实例需为运行时存在的） |
| 查/写办结抄送 | `ibpm cc <defKey> [--set 规则.json \| --carry-from <源defKey>]` | 流程结束抄送规则（procNotify 插件，按版本存储，import-confirm 自动承接） |
| 导出包 | `ibpm export <defKey> [-o 文件]` | 平台原生 zip（defJson+bpmnXml+nodeDispose） |

## 变更流程（强制闭环，顺序不可乱）

```
checkout → 编辑命令（可多条） → verify → import → import-confirm
```

```bash
ibpm checkout QT04001                              # 导出当前主版本到工作区
# —— 以下编辑命令都带 --flow <defKey>，作用于工作区，不影响线上 ——
ibpm add-node T_Xxx --flow QT04001 --name 项目专员 --after T_需求单位总经理 --var projectSpecialist
ibpm add-node T_Sign --flow QT04001 --name 会签任务 --after T_Xxx --var coSignPersonnel --sign  # 直接创建会签节点
ibpm connect T_A T_B --flow QT04001 --name 标签 --cond "amount>=200000"
ibpm remove-edge T_A T_B --flow QT04001           # 删除连线（网关合并/重构必用，先删边再删节点）
ibpm set-condition T_A T_B --flow QT04001 --expr "planChange=='Y'" --name 是
ibpm set-assignee T_Xxx --flow QT04001 --spec 张磊/00133543 --logicCal and
ibpm set-assignee SignTask1 --flow QT04001 --var coSignPersonnel  # 会签节点自动写入 ext:signNode（无需手工补 XML）
ibpm remove-node T_Xxx --flow QT04001 --reconnect  # 自动接驳前后继
ibpm var-add secondType --flow QT04001 --name 项目二级分类
ibpm var-remove secondType --flow QT04001
ibpm verify QT04001                                # 15 项校验，必须 0 失败
ibpm import QT04001                                # importCheck → 打印 cacheFileId（自动快照旧版办结抄送规则）
ibpm import-confirm <cacheFileId>                  # 确认落地（同 defKey 自动新增版本；自动承接办结抄送到新版本）
ibpm discard QT04001                               # 放弃本次编辑
```

## 允许接口审批配置

```bash
ibpm approval QT04001                              # 查询全部节点三态
ibpm approval QT04001 --nodes "T_A,T_B" --value true   # 改为放行（saveDefConf 热生效）
```

- 三态语义：**无 propers=引擎不校验（放行，勿动）**；显式 false=拒绝 openapi complete（报「{节点名}未配置允许接口审批」）；true=放行。**只有显式 false 的节点需要改成 true**
- CLI 自动从 bpmnXml 提取全局表单 URL 回传（防清空保护）；nodePropertieMap 增量合并，只更新传入节点
- saveDefConf 热生效：定义 version 不变，新发起实例立即用新配置，运行中实例不受影响
- 业务级验证：重跑对应流程 E2E 测试类（PMS：`mvn -pl pms-service -am clean test "-Dtest=<流程>E2ETest" "-Dsurefire.failIfNoSpecifiedTests=false" -q`，需 `$env:JAVA_TOOL_OPTIONS="-Dfile.encoding=UTF-8"`，`IBPM_SECRET` 的值按 `vault-ops` 技能取用）

## 办结抄送配置（流程结束通知）

```bash
ibpm cc QT04001                          # 查看当前规则（人员配置 → 通知方式）
ibpm cc QT04001 --set rules.json         # 全量覆盖写入规则（结构校验后 POST）
ibpm cc QT04001 --carry-from QT04001v5   # 从指定源版本承接规则（新版本已有配置时不覆盖）
```

- 规则结构：`[{userAssignRules: [{description, calcs: [{pluginType: "sameNode", nodeId, extract: "extract", logicCal}]}], msgTypes: "mail,inner"}]`
- **按 defId（版本）逐版本存储，导入新增版本不会自动继承**——CLI 两段式 import 已内置快照/承接，禁止绕过 import-confirm 手动建版本
- 「通知XX专员」类需求优先用办结抄送实现（不新增流程节点）；规则条件引用的节点必须覆盖全部到达结束的路由（如同名「项目专员」节点在数字/信息化/基建多条路由上是不同 nodeId，只挂一个会漏路由）

## 运行时实例处理（运维中心直办 / 代审批）

适用场景：E2E 走单需要推进流程实例、待办卡在非本人节点需代为审批时（不改流程定义）。2026-11-03 UAT 实证走通（XMBG-202611-0017 六个节点连续代审批至结束）。

- **运维中心入口**：`https://test-ibpm.jomoo.com/mvue/instance` → 任务运维 → 关键字填流程编号 → 查询 → 操作列「处理」打开任务页 → 下一步 → 填意见 → 确定
- **代审批**：运维中心可处理任意办理人的待办，无需切换到该节点办理人账号；意见统一填可识别标记（如「自动化测试-勿处理-<单号>」）便于事后审计
- **fvue 任务页直开（推荐，根治列表页问题）**：已知 taskId 时直接打开 `https://test-ibpm.jomoo.com/fvue/task/{taskId}/0` 进入任务页办理；实例页 `/fvue/inst/{instId}` 缺 sign 参数会被弹回 mvue，不可直开。taskId 可从任务运维列表行接口响应或引擎审批链数据中获取
- **SSO 会话约束**：会话约 4 小时过期（expireTime = iat + 14400s），登录态绑定已打开的标签页——新开标签页导航会跳账号中心重新登录，浏览器自动化优先复用已登录 tab
- 列表页查询/点击被 OA 水印覆盖层吞掉、按钮点击无网络请求等浏览器自动化坑：换 ref 重试 / 整页 reload 后重试，根治方案即 fvue 任务页直开绕过列表

## 工作纪律（硬性）

- **verify 未 0 失败，禁止 import**——校验失败按输出逐项修复（布局锚点/ID 关联/审批人同步），禁止带病上线
- **导入即新增版本**：同 defKey 导入自动 version+1 并成为主版本，在途实例锁定旧版本不受影响；上线顺序类变更（新流程变量依赖后端发版）须提醒用户
- **编辑必须走 checkout 工作区**，禁止直接改线上（无此命令，也不提供 webDefSave）
- **删除网关/节点前先 `remove-edge` 清理连线**：`remove-node --reconnect` 会把全部前驱×后继互连，删网关会多出错误分支；正确顺序是删边 → 删节点 → 补新边
- 重大结构变更后建议用户在设计器目检画布，并发起测试单走通全链路
- 新增流程变量供条件使用时，变量必须先 `var-add`（或已存在），网关出边条件才可引用
- varKey 不能自编，必须 `ibpm contract` 查平台确认——自编语义化 key 会导致 vars 传递失效、测试返工

## 审批人参数速查（add-node / set-assignee 通用）

| 取人方式 | 参数示例 |
|---|---|
| 指定用户 | `--spec 张磊/00133543`（会签多规则加 `--logicCal and`） |
| 流程变量 | `--var projectSpecialist` |
| 人员脚本（汇报关系） | `--hrScript S1`（格式：角色code[,用户变量]，默认 startorAccount；角色码 S1/S2/S3/S6-1/S7，组织维度 jomoo-zuhu_EG） |
| 组织汇报 | `--orgReport 资产管理中心,810_12000386,L2` |
| 发起人（默认） | 不传参数 |

规则五类对应：发起人（cusers）/ 指定用户 / 变量取人 / 人员脚本 hrScript / 指定组织部门主管 orgReport。

## 条件表达式约定

- 风格：`planChange=='Y'&&digitalProject=='Y'`（==/!=/&&/||，字符串单引号，对齐存量流程）
- 网关出边条件必须**互斥完备**；分支前提（如方案变更）必须写进条件，不能只靠图结构
- 条件引用的变量必须在流程变量中已声明（`ibpm vars` / `ibpm contract` 可查）

## 新建流程

```bash
ibpm create spec.json     # spec 结构见 bpmn-gen/samples/（含审批人/网关/子流程样例），生成后按提示 import
```

spec 的 `processKey` 若需接入 PMS 后端必须用业务码（如 QT04001），与后端 `FlowKeyEnum` 一致。

## 底层原理与兜底排查（低频查阅）

| 场景 | 文档 |
|---|---|
| 包结构/生成命令/zip 结构/交付检查 | [references/workflow-rules.md](references/workflow-rules.md) |
| Activiti bpmnXml + ext:extProcess 模板（POJO 转换硬依赖） | [references/xml-template-rules.md](references/xml-template-rules.md) |
| 审批人 4 种 source 的 cacl 结构 / allowInterfaceApproval | [references/assignee-rules.md](references/assignee-rules.md) |
| 坐标布局/视口/边线避让/网关粘附规则 | [references/layout-rules.md](references/layout-rules.md) |
| 导入报错逐条排查 | [references/troubleshooting.md](references/troubleshooting.md) |

`bpmn-gen/` 为流程包生成器与校验器（`ibpm create` 与 `ibpm verify` 的引擎），分层纯函数库可 ESM 单独引用；接口契约探索工具（cookie/token 抓取、浏览器自动化）不在本技能范围。
