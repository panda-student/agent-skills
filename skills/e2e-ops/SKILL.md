---
name: e2e-ops
description: 通用 E2E/自动化验证方法论——验证分层三分诊（接口层/数据链路层/UI 形态层）、验证证据要求、UI 形态层硬规则、异常裁决。当执行 UAT/E2E 终验、自动化测试取证、接口/数据库/UI 验证裁决、排查验证结果异常时使用。本技能面向部署后真实环境验证的执行与裁决
---

# E2E 自动化验证方法论

> 验证对象一律为真实部署环境；接口返回正确 ≠ 页面回显正确。

## 三分诊标准（数据逻辑不走 UI，浏览器只验前端形态）

- 总原则：「打开页面→填表→提交→等响应」类链路一律接口直调 + 查库断言，不上浏览器；浏览器只验证接口/数据链路证明不了的页面形态与交互

| 层级 | 适用场景 | 手段 |
|---|---|---|
| 接口层 | 纯后端数据返回：字段缺失/取数口径/计算逻辑/筛选条件、新接口联调、新增字段核对 | yaak CLI 直调接口核对字段名与值（SOP/命令细节见 yaak-ops；凭据按 `vault-ops` 技能取用） |
| 数据链路层 | 表单提交/保存/状态变更、流程与审批流转、回写落库、导出产物内容 | yaak CLI 直调提交/触发接口 → dbx CLI 查库断言数据变化（dbx-ops 技能）（落库字段值、流程节点状态、回写记录）；导出直调下载端点 + 产物核对（xlsx 解压核对见 UI 硬规则） |
| UI 形态层 | 仅前端交互与呈现：表单回显、联动/条件显隐/必填拦截、列表展示与筛选交互、字典翻译、按钮/弹窗形态 | 主：`agent-browser` 操作用户本机浏览器（复用登录态）；浏览器覆盖不了的系统级操作交用户手动执行 |

- **审批流推进载体**：流程需走到后续节点但待办在他人名下时，用 IBPM 运维中心直办/代审批推进（操作流见 ibpm-ops 技能「运行时实例处理」章节），不走接口伪造审批；END_EVENT 回调重放仅补偿已结束单据的回写，不能推进未走完的流程

## 验证证据要求（结论为「通过」必附）

- **禁止只报结论不出证据**：不出证据的验证点一律按「未验证」表述，不计入通过项
- **接口层**：yaak 实际请求 URL + 响应码 + 关键字段值，逐项「期望 vs 实际」对照（对照本次验证点，不贴无关大段报文）
- **数据链路层**：yaak 提交/触发请求记录（URL + 报文要点 + 响应码）+ dbx 查询结果对照（期望落库值/流程状态 vs 实际，逐字段列出；必要时附取样 SQL 与行数变化）
- **UI 形态层**：`agent-browser network requests` 关键记录（响应码+关键出参）、DOM 断言结果、下载产物核对结论；涉及视觉呈现/前后对比附 `agent-browser screenshot` 截图
- **证据与验证点一一对应**：禁止一条笼统证据（如「页面正常」）覆盖多个验证点；证据不超覆盖终点——列表/汇总页与详情页互为独立终点，只验详情页不算覆盖（实例：2026-10-20 会签人员缺陷详情页正常、汇总页恒空，被判通过后复发）

## UI 形态层硬规则（agent-browser）

- **先连接再操作**：会话内首次操作浏览器前先建立 agent-browser 会话（`agent-browser open <url>`，或按需 `agent-browser connect <port|url>` 接入已开启 CDP 的本机浏览器），并用 `agent-browser get url` 确认连接正常
- **统一入口**：浏览器操作一律走 `agent-browser` CLI（`open`/`click`/`fill`/`snapshot`/`eval`/`network`/`tab`/`screenshot`），禁用其他内置浏览器工具（会丢登录态）
- **纯 UI 交互模拟人工**：点击/输入/勾选走真实组件操作，禁止脚本直接赋值字段（绕过真实校验）；调用组件既有方法（如 Vue 实例方法驱动弹窗选行）等价真实交互，不算脚本赋值
- **裁决以网络层 + 产物为准**：`agent-browser network requests` 核对请求与响应码；下载类以下载目录实际文件为准——成功 toast 可能因内部 TypeError 静默失败，toast 不出现不代表失败
- **表格勾选状态用组件 API 核实**：vxe-table 用 `getCheckboxRecords()` 只读确认，不凭截图判断
- **下载产物内容核对**：xlsx 改 `.zip` 解压直读 sheet1.xml（EasyExcel 内联字符串不走 sharedStrings）
- **wujie 微前端面板内原生点击受限**：`agent-browser click` 报 `Hit test failed` 且 scrollIntoView/坐标偏移重试无效时，用 `agent-browser eval` 派发完整 mousedown→mouseup→click 事件序列模拟真实点击
- **列表排序类断言三要点**：vxe-table 固定列使 body-wrapper 出现多份（全列副本重复提数）——取最后一个 wrapper 或按列数判主表；含中文正则在 `agent-browser eval` 传输中可能静默失配——改固定列索引 + `replace(/[^0-9]/g,'')` 提数；断言模板 = 项目分组连续 + 组内升序同时成立才 PASS
- **SPA 同 tab 导航可能不生效**：`agent-browser open` 后 pathname 仍是旧路由且无报错——改用新 tab（`agent-browser tab new` 后 `open`）直达；登录页刷新后旧 ref 失效，先重新 `agent-browser snapshot` 再填
- **弹窗关不掉/被遮挡，先激活目标 tab 再定性**：后台标签页暂停 CSS 动画，el-dialog 关闭 transition 的 animationend 不触发 → wrapper 残留遮挡（Vue 状态已 false、数据已刷新）；`agent-browser tab <n>` 切到目标 tab 后动画完成。弹窗类验证与异常裁决前必须先激活 tab，禁止把该现象当应用缺陷
- **激活 tab 后仍 hit test 失败的终极降级**：`agent-browser eval` 驱动 Vue2 实例调真实组件方法——`document.querySelector('#app').__vue__` 起步，`$children` 递归定位含目标方法的组件直接调用（走真实代码路径），再断言 DOM value/disabled；行数据用组件已有列表或先 fetch 列表接口
- **OA 水印覆盖层吞点击**：`agent-browser click` 报 hit test 落在覆盖 div、或点击后 `agent-browser network requests` 无任何请求发出 = 被水印层吞——重新 `snapshot` 换 ref 重试、`agent-browser reload` 后重试；列表页查询按钮反复无请求时改用深链直开目标页根治（实例：IBPM 任务运维列表查询失效，改 fvue 任务页直开）
- **mvue 主区域首次加载空白**：点菜单后路由不变、内容区空白——整页 `agent-browser reload` 即渲染；反复出现，reload 是标准解法而非环境异常
- **日期筛选默认值重置不清**：Element UI 日期范围带默认值时点重置清不掉（残留历史区间导致查询结果为空）——直接输入覆盖目标值后再查询，不依赖重置按钮

## 异常裁决

- **取证结果互相矛盾时，第一时间开全新 tab 复验**：长期复用的自动化 tab 经反复导航/cookie 注入后 wujie 沙箱进入脏态，取证不可信；新 tab 复验正常即定性环境假象，禁止当应用缺陷上报
- **脏态三信号**（齐现即换 tab 复验再定性）：手动 fetch 永久 pending + `agent-browser eval` 报 Bridge error/Detached + 原生点击 hit test 失败
- 接口返回 null/空先查库分界：库有值接口空 → 映射缺陷；库无值 → 数据现状（非代码问题），用 dbx CLI 统计填充率 + 取样例
- 空结果/400 先核对必填参数再怀疑改动：抽查 Controller/Service 方法签名与 DTO 确认必填入参（实例：`/benefit/report/ledger` 缺 `applyType`、`queryBudgetExpenseDetail` 缺 `projectCode` 均为缺参非改动问题）
- **连续 2 轮验证失败即停止**：汇报根因分析 + 方案选项（含回滚）由用户拍板，禁止暴力重试

## 排障前置动作

- **动手排障前先记忆快查**：先 Grep 项目记忆（project_memory.md）与环境配置类技能（如 start-pms-backend），确认无现成方案再自行排查（实例：同源化代理方案记忆早有完整记载，未先查导致重复排障 4 轮）
- **新经验回填**：验证过程中新发现的坑位/裁决经验，按「现象 → 判定 → 标准解法（+实例）」格式回填本技能对应章节，保持沉淀迭代
