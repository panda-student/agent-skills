---
name: pms-menu-config
description: JMBOS 平台菜单配置 SOP——为前端新页面新增菜单使动态路由可访问，支持直接接口操作（推荐）与菜单管理 UI（/perm/auth/menu）两种模式，覆盖测试环境建菜单→一键发布 UAT→UAT 确认→核实清理全流程，并支持低代码页面结构（列表列/查询条件/按钮配置）修改。触发场景：新前端页面联调直接访问路由 404（路由靠菜单动态挂载）、需要挂载/修正/推送/清理平台菜单、菜单层级错误（落到第一层）、菜单管理页新增/编辑操作、低代码列表页某列恒空或绑错字段需改列绑定 prop、修改页面结构配置后需发布到 UAT。
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

你是 JMBOS 平台菜单配置专家。当用户需要为新前端页面挂载菜单、页面访问 404、推送菜单到 UAT 或操作菜单管理界面时，按本 SOP 执行。

## 模式选择

- 有有效登录 token（cookie `nisbos_auth_token`）→ **直接接口操作模式**（推荐，全流程秒级完成，完整 body 模板见 [reference.md](./reference.md)）
- 无 token / 需人工逐字段确认 / 接口异常 → 菜单管理 UI 模式（兜底）
- 两种模式流程一致：测试环境建菜单 → 一键发布 UAT → UAT 确认 → 核实（→ 按需清理）

## 背景与入口

- jmbos 前端菜单全部是**配置驱动**：登录后按菜单配置的组件路径动态挂载路由，未配菜单的页面直接访问 404（静态路由表里没有）
- 菜单管理页路由：`/perm/auth/menu`（本地 dev 与各环境同路径）。顶部「…」下拉 →「系统管理」入口因 wujie 字体层遮挡点不动，**直接 URL 访问**
- 菜单配置存平台侧（配置后对应环境生效，本地 dev 与 uat-pms 同源）；保存后必须**整页刷新**让动态路由重载，再访问目标路由
- 低代码页面（bos-saas-page）的**列/查询条件**存于页面菜单结构，可在页面结构弹框或结构接口里改；**按钮配置则存于 menuType=3 按钮子菜单记录的 btnStructure 字段**（改页面 structure.btnsDom 加按钮无效）——两者数据源不同，详见 [reference.md](./reference.md)「页面结构编辑」与「按钮配置（btnStructure）」章节
- **硬规则：menuId 必须先经 appMenuList / sync-master/getRouters 核实**，禁止凭截图或记忆取值——无效 id 会让接口返回 500，易被误判成「该环境接口不可用」

## 前置三要素（两种模式通用）

- 菜单名称（如 固定人员配置）
- 访问地址（目标路由，前导斜杠，如 /projectPermission/fixedPersonRule）
- 组件路径（src/views 下相对路径，无斜杠无 .vue，如 advanced/fixedPersonRule）

UI 模式还需目标环境已登录（本地 dev 登录走 test 平台账号，UAT 密码无效）。

## 直接接口操作模式（推荐）

关键参数与接口（完整 body 模板、结构 menuId 表、辅助接口、实测案例 → [reference.md](./reference.md)）：

- 环境域名：测试页面 https://test-pms.jomoo.com ↔ 接口 https://api-tenant-jmbos-dev.jomoo.com；UAT 页面 https://uat-pms.jomoo.com ↔ 接口 https://api-tenant-uat-jmbos.jomoo.com（菜单接口统一走租户网关）
- PMS 固定参数：所属应用 systemId=1108598；UAT 系统注册 systemId=100837377（删除菜单接口用）
- 核心流程：
  - 测试建菜单 → `POST /auth/menu/save`（14 字段 body；parentId 来自 `POST /auth/menu/getRouters`）
  - 一键发布 → `POST /auth/sync-master/save`（syncType:"menu" + targetEnv:"uat" + versionRemark + dataIds）
  - UAT 确认 → `POST /auth/sync-master/page` 查 status=init 批次 → `POST /auth/sync-master/changeTaskExecuteStatus` → 轮询至 success
  - 改低代码页面结构（列/查询）→ `GET /auth/menu-structure/get?menuId=` 读 → 改 prop 后 `POST /auth/menu-structure/save`（structure 传压缩 JSON 字符串，≤30000 字符，保存后 app-system 运行时结构自动同步）→ 再走一键发布到 UAT
  - 配/修按钮 → 两步保存：`POST /auth/menu/save` 建按钮子菜单（menuType=3）→ `POST /auth/menu-structure/save` 传完整菜单记录（id→menuId、删 pageType、btnStructure 传完整按钮 JSON）→ runtime 立即重新物化（详见 [reference.md](./reference.md)「按钮配置」章节）
  - 核实：测试环境 `POST /auth/menu/appMenuList`；UAT `POST /auth/menu/getRouters`——**UAT 菜单 id 与测试不同**（uuid 映射落库），按 menuName/path/component 匹配
- 清理 UAT 遗留菜单：`POST /auth/menu/delete`（systemId 用 UAT 系统注册 id），先删子功能再删页面
- 实现方式：**一律 Node 脚本带 Bearer token 直调网关域名**，禁止页面内 fetch / hook XHR（wujie 沙箱会拦截或挂起）

## 菜单管理 UI 模式（兜底）

### 新增菜单步骤（字段填写顺序敏感，按下列顺序执行）

- 打开 `/perm/auth/menu` → 点「新增」
- **先选「所属应用」**（必填；不选则「父菜单」下拉面板为空，提示「没有可选项」）
- → 选「父菜单」：点输入框输入关键字过滤 → 等下拉面板出现 → 点目标节点（**禁止按 Enter**）
  - **父菜单框显示带 × 的标签才算绑定成功**；纯文本/空值就保存会落到第一层
- → 其余字段参照同类既有菜单填写（页面型参照值）：

   | 字段 | 值 |
   |---|---|
   | 菜单类型 | 页面（目录/页面/功能/接口四选） |
   | 系统类型 | 管理后台 |
   | 页面类型 | 自定义 |
   | 功能类型 | 列表 |
   | 访问地址（必填） | 前导斜杠形态，如 /flowTest/runList |
   | 自定义组件路径（必填） | 无斜杠无 .vue，如 flowTest/runList |
   | 状态 / 是否显示 / 显示排序 | 启用 / 显示 / 0 |
   | 是否缓存 / 是否授权访问 | 是 / 需授权 |
   | 国际化编码 / 跳链地址 / 图标 / 自定义图标 / 接口列表 | 留空 |

- → 保存前逐字段核对（重点父菜单标签），点「确定」
- → 验证：点父菜单左侧展开箭头确认子菜单出现 → 整页刷新 → 访问目标路由渲染即成功

### 参照法（新环境不知道字段怎么填）

菜单树找同类页面菜单 → 点「编辑」查看全部字段值（**只看不存，绝不点保存**）→ 完全照抄格式填新菜单

### 层级错误修复

菜单落到第一层（父菜单未绑定就保存了）：进该菜单「编辑」重新绑定父菜单，确认框内显示带 × 的标签后再保存；或删除后按新增步骤重建

## 浏览器自动化专项坑（2026-10-13 实证）

- 「父菜单」树选择下拉面板 a11y 快照过大，自动化会连续多轮在同一交互截断：
  - **禁止对面板整体 snapshot**
  - 先在输入框过滤缩小面板（且必须先选所属应用）
  - 节点用 `agent-browser eval` 定位并派发真实鼠标事件（mousedown→mouseup→click）点击——等效人工点击，非字段赋值
- 保存后路由仍 404：先整页刷新重载动态路由再访问
- wujie 微前端 iframe blob 沙箱：主文档 hook XHR 抓不到页面请求、页面内 fetch API 域名会挂起——接口操作改 Node 直调（详见 [reference.md](./reference.md) 踩坑记录）
- `agent-browser eval` 多语句脚本包 IIFE 并 return；显式传 viewId（字符串类型），否则操作「最后交互 tab」
- bosui 组件注入技巧（vue-treeselect 三连同步、隐藏 dropdown item 点击、textarea 原型 setter、BosDialogAdd 调 `vm.handleSubmit()`）→ [reference.md](./reference.md)
