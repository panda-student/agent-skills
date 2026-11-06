# 实现指南 — 反模式百科与检查清单

> JMBOS UIUE Design System **跨组件集成指南（统一入口）**
>
> 📌 **定位**：本文件是**唯一的全量检查清单 + 反模式百科 + 设计补全规范**，聚焦跨组件集成视角的常见错误、质量保障和需求补全决策。
>
> 🔧 **工具链**：
> - **[style-fix-cheatsheet.md](./style-fix-cheatsheet.md)** — 65项样式偏差的「错误→正确」映射 + **可复制修复代码**
> - **`node scripts/style-scan.mjs <文件>`** — 自动化样式合规扫描（65项逐项检测 + 行号定位 + 矫正建议）
>
> 📖 **各组件详细代码示例**请查阅：
> - [buttons.md](./components/buttons.md) — 按钮
> - [action-buttons.md](./components/action-buttons.md) — 操作按钮组
> - [tables.md](./components/tables.md) — 表格
> - [form-inputs.md](./components/form-inputs.md) — 表单输入
> - [checkboxes.md](./components/checkboxes.md) — 复选框
> - [query-bar.md](./components/query-bar.md) — 查询栏
> - [navigation.md](./components/navigation.md) — 导航（规范） / [nav-menu-full-code.md](./nav-menu-full-code.md) （代码）
> - [icons.md](./components/icons.md) — 图标（完整规范） / [icons/README.md](../ASSETS/icons/README.md) （快速指南）
> - [Pagination.md](./components/Pagination.md) — 分页（弹窗/列表页双场景 + 条目数选择器 + 跳转页）
> - [modal.md](./components/modal.md) — 弹窗（表单编辑场景）
> - [confirm-dialog.md](./components/confirm-dialog.md) — 确认对话框（二次确认场景，四态变体）

---

## 目录

0. [推荐实现顺序](#0-推荐实现顺序)
1. [强制执行检查清单](#1-强制执行检查清单)
2. [常见错误模式 (Anti-patterns)](#2-常见错误模式-anti-patterns)
3. [FAQ 常见问题解答](#3-faq-常见问题解答)

---

## 0. 推荐实现顺序

推荐实现顺序与关键词→组件映射详见 [components/README.md](components/README.md) 场景化查阅指南。

---

## 1. 强制执行检查清单

> **🚨🚨🚨 这是质量保证的核心机制！**
>
> 将规范检查嵌入到**执行的每个阶段**，而非仅在最后的 QA 阶段才检查。
>
> ### 🔄 自检矫正工作流
>
> ```
> 步骤1: node scripts/validate-design.mjs <文件>     → 资源层检测（Token/Sprite/Logo）
>        ↓ FAIL → node scripts/quick-fix.mjs all <文件> → 重跑 validate
>        ↓ PASS
> 步骤2: node scripts/style-scan.mjs <文件>          → 样式层检测（65项偏差扫描）
>        ↓ 输出偏差报告（含行号 + 矫正建议）
> 步骤3: 查 style-fix-cheatsheet.md 对应编号         → 复制修复代码
> 步骤4: 应用修复到目标文件                           → 对应页面 .html 的 `<style>` 块或 `js/pages/D-XXX_{页面功能名称}.js`
> 步骤5: 重跑 style-scan.mjs + validate-design.mjs      → 确认全PASS
> ```
>
> **核心原则**：从「勾选清单」升级为**「检测→定位→矫正→验证」闭环**

### Phase 1: Pre-flight 预检（开始写代码前 — 3项）

| # | 检查项 | 检查方法 | 通过标准 |
|---|--------|---------|---------|
| P1 | 设计令牌 CSS 变量已声明 | 检查 `<style>` 顶部是否有 `:root { }` 块 | 包含所有核心变量（primary/text/bg/function）|
| P2 | 已加载正确的骨架模板 | 确认使用的 page-shell 文件与页面类型匹配 | list→page-shells/pages/list.html, detail→page-shells/pages/detail.html 等 |
| P3 | 已读取所有相关视觉参考图 | 回顾第2步的图片读取记录 | 组件图 + 页面示例图均已读取 |

### Phase 2: Icon Compliance 图标合规（每引入一个图标时 — 9项）

> **这是最高频的检查点**，每个图标写入 HTML 时都必须核对：

| # | 检查项 | 通过标准 |
|---|--------|---------|
| I1 | **引入方式**：SVG Sprite `<svg class="icon"><use href="#icon-xxx"></use></svg>` | ✅ 唯一正确方式 | ❌ 禁止 `<img>` / `<object>` / 内联 path 数据 / `fetch()` → 见 Anti-pattern #3 |
| I2 | **fill 属性**：Sprite 内部已统一设置 `fill="currentColor"`，无需手动添加 | → 见 Anti-pattern #6 |
| I3 | **Sprite 文件引入**：页面 `<body>` 开头必须**内联** `icons-sprite.svg` 全部内容 | 缺少则所有 `<use>` 引用失效 | → 见 [icons.md SVG Sprite引用方式](components/icons.md) |
| I4 | **图标 ID 正确性**：使用 `#icon-{文件名}` 格式（如 `#icon-edit`） | ID 错误导致图标不显示 |
| I5 | **color 控制**：通过父元素 style 或 CSS class 设置 color 属性 | 图标自动继承 color 值作为 currentColor |
| I6 | **尺寸正确性**：通过 CSS class 控制尺寸 | → 见 [icons.md 尺寸规范](components/icons.md) + Anti-pattern #2 |
| I7 | **缺失图标映射**：引用名不在 `icons-sprite.svg` 中时查 [icons/README.md](../ASSETS/icons/README.md) | 见完整图标清单 |
| I8 | **颜色正确性**：根据所在位置的背景色确认 icon 颜色 | → 见 [icons.md 颜色体系](components/icons.md) + Anti-pattern #6 |
| I9 | **Sprite 引用完整性**：`<use href="#icon-xxx">` 标签必须正确闭合 | ❌ 残缺标签导致不渲染 |

> **图标基础类**（`.icon` / `.icon-nav` / `.icon-lg` / `.icon-text-group`）已在 `design-tokens.css` 中内置（v4.19.0+）。如未生效，请查阅 [icons.md](components/icons.md) 手动添加。

### Phase 3: Component Compliance 组件合规（每个组件写入时 — 25项）

| # | 检查项 | 组件类型 | 通过标准 |
|---|--------|---------|---------|
| C1 | **复选框**：使用 `.checkbox-wrapper` + `.checkbox-visual` | checkbox | ❌ 禁止 `<input type="checkbox">` + `accent-color` → 见 Anti-pattern #7 |
| C2 | **复选框边框色**：未勾选态 = `#B9BFCB` | checkbox | 见 [form-inputs.md](./components/form-inputs.md) |
| C3 | **按钮 hover 图标**：CSS 规则含 `!important` | button | → 见 Anti-pattern #1 |
| C4 | **操作按钮组容器**：使用 `.action-button-group` | toolbar | ❌ 禁止 `.toolbar-left` 等自定义类名 |
| C5 | **"更多操作"按钮（工具栏）**：使用 `.btn-more-text` + chevron-down 图标 + 文字"更多操作" | toolbar | ✅ 必须是文字+图标组合（图标在右侧）|
| C6 | **排序图标**：CSS border三角形，箭头尺寸4×5，双箭头常显，gap=3px | table header | 见 [tables.md](./components/tables.md) |
| C7 | **Tab 关闭图标**：纯 CSS X（伪元素）| tab | ❌ 禁止 SVG circle-remove → 见 Anti-pattern #8 |
| C8 | **设置按钮**：无边框 (`border: none`) | card/header | 见 [style-fix-cheatsheet.md S33](./style-fix-cheatsheet.md) |
| C9 | **下拉选择器箭头**：使用 chevron-down.svg | select | ❌ 禁止简单三角 CSS border → 见 Anti-pattern #9 |
| C10 | **顶部导航栏-Logo区域**：仅保留品牌名，无副标题 | top-nav | ❌ 禁止显示"低代码平台"等副标题文字 |
| C11 | **顶部导航栏-菜单项高度**：`height:100%` + `align-items:stretch` 撑满42px | nav-menu-item | ❌ 禁止仅靠padding控制高度 |
| C12 | **顶部导航栏-菜单项圆角**：`border-radius: 0` (无圆角) | nav-menu-item | ❌ 禁止设置圆角(2px/4px) |
| C13 | **顶部导航栏-右侧功能区容器**：包裹在 `<div class="top-nav-right">` 内 | top-nav-right | ❌ 禁止图标直接放在header中 |
| C14 | **顶部导航栏-用户图标尺寸**：`width:20px; height:20px` + `.nav-icon-btn` | user icon | ⭐ 必须为20px（见 I6 尺寸规范）|
| C15 | **操作列-按钮形式**：2选1 — **纯图标 或 纯文字（默认纯文字）**；更多按钮统一 `···` 图标；❌ 禁止图标+文字混用 | action-col | → 见 Anti-pattern #4 + [action-buttons.md](./components/action-buttons.md) |
| C16 | **操作列-Hover**：仅变色（`#5E9DF5`），**无背景色** | action-col .link-btn:hover | ❌ 禁止 `background-color: rgba(...)` |
| C17 | **操作列-Active**：必须定义 `:active` 态（`#2364CC`）| action-col .link-btn:active | ❌ 缺少 active = 三态不完整 |
| C18 | **操作列-Padding**：`padding: 0`（无内边距）| action-col .link-btn | 见 [tables.md](./components/tables.md) |
| C19 | **左侧菜单-文字色/图标色**：默认 `#141b24`（不是 `#7C8493`）| .sidebar-menu-item | → 见 Anti-pattern #6 |
| C20 | **左侧菜单-内边距**：`0 12px`（不是 `0 16px`）| .sidebar-menu-item | 见 [navigation.md](./components/navigation.md) |
| C21 | **左侧菜单-字重**：固定 `400`（active 态也不是 `600`）| .sidebar-menu-item | 见 [navigation.md](./components/navigation.md) |
| C22 | **左侧菜单-容器 padding**：`8px 0` | .sidebar | 见 [navigation.md](./components/navigation.md) |
| C23 | **展开箭头尺寸**：`16×16px`（不是 `12×12`）| .sidebar-menu-expand | 见 [navigation.md](./components/navigation.md) |
| C24 | **展开箭头颜色**：固定 `#141b24`（不随状态变化）| .sidebar-menu-expand | 见 [navigation.md](./components/navigation.md) |
| C25 ⭐ | **展开箭头SVG文件名**：必须使用 `chevron-down.svg` | .sidebar-menu-expand | → 见 Anti-pattern #5 |

### Phase 4: Technical Principles 技术原则（全局层面 — 4项）

| # | 检查项 | 通过标准 |
|---|--------|---------|
| T1 | **布局稳定**：顶导/侧边栏 `position: fixed`，主内容区 `margin` 偏移 | ❌ 禁止用 `transform: scale()` 做布局 |
| T2 | **Overflow 正确**：body/html 无 `overflow-x: hidden` | 表格容器用 `overflow-x: auto` |
| T3 | **颜色引用**：高频颜色用 `var()` 变量，局部特殊值直接写数值 | ❌ 禁止高频色硬编码 |
| T4 | **标准类名**：使用 components/*.md 定义的标准类名 | ❌ 禁止随意自定义组件类名 |

### Phase 5: Output Quality 输出质量（交付前 — 3项）

| # | 检查项 | 通过标准 |
|---|--------|---------|
| O1 | **真实数据**：无 "测试数据"、"XXX"、"placeholder" 占位符 | 使用真实业务数据 |
| O2 | **交互完整性**：包含 hover/focus/disabled/active 四态样式 | 至少有 hover 态 |
| O3 | **画布尺寸**：符合标准画布（见 [SKILL.md 关键数值](../SKILL.md)） | body 设置 min-width/min-height |

### Phase 6: Page Completeness 页面完整性（业务层面 — 56项）

> **使用时机**：每个页面交付前，必须逐项确认以下要素齐全
>
> **与 Phase 1-5 的关系**：Phase 1-5 聚焦**技术实现质量**，Phase 6 聚焦**业务功能完整性**。**两者必须同时通过**

#### 设计补全决策树

> 当需求文档不完整时，按以下决策树判断是否可自主补全：

```
┌─────────────────────────────────────────────────────────────┐
│                    设计补全决策树                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  需求文档完整？                                              │
│    ├─ 是 → 严格按需求实现                                     │
│    └─ 否 → ↓                                                │
│                                                             │
│  属于以下安全补全范围？                                      │
│    ├─ Mock数据 / 查询条件 / 按钮组合 / 分页 / 空状态         │
│    │   / 交互四态 / 操作列 / 标题 / 标签页 / 加载状态         │
│    │   → ✅ 自主补全（见下方「安全自主决策表」）              │
│    └─ 否 → ↓                                                │
│                                                             │
│  属于以下需确认范围？                                        │
│    ├─ 特殊布局 / 新组件 / 品牌色变更 / 权限控制 / 非常规交互  │
│    │   → ⚠️ 必须询问设计师确认后再执行                        │
│    └─ 否 → 按规范默认实现                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

##### 安全自主决策范围（可直接执行，无需确认）

| 补全类型 | 补充规则 | 触发示例 |
|---------|---------|---------|
| Mock 数据 | 生成 5-10 条符合业务场景的假数据 | 需求未提供示例数据 |
| 查询条件 | 提供 2-3 个常见查询项（名称/状态/日期） | 需求只说"支持筛选" |
| 按钮组合 | 列表页工具栏按「普通按钮+更多操作」标准组合（见 [action-buttons.md](./components/action-buttons.md)） | 需求说"CRUD操作" |
| 分页功能 | 添加标准分页器（20条/页、共X条、页码跳转） | 列表页默认需要 |
| 空状态占位 | 图标 + "暂无数据"提示文字 | 表格/列表区域必须有 |
| 交互状态 | 实现四态（default/hover/active/disabled） | 交互组件必须有 |
| 操作列 | 默认提供"编辑 + 删除 + 更多" | 数据表格必须有 |

#### 6.1 列表页完整性检查（L1-L23 + L14.1-L14.3 — 26项）

##### 6.1.1 导航系统（L1-L3）

| # | 检查项 | 通过标准 |
|---|--------|---------|
| L1 | 顶部导航栏 | 高度42px，品牌色#0C328C背景（详见 C10-C14）|
| L2 | 左侧菜单 | 宽度180px，当前页高亮显示（详见 C19-C25）|
| L3 | 组织选择器 | 右上角显示（如适用）|

##### 6.1.2 查询区域（L4-L7）

| # | 检查项 | 通过标准 |
|---|--------|---------|
| L4 | 查询栏容器 | `.query-bar`，白色背景#FFFFFF（→ [query-bar.md](./components/query-bar.md) QB-1）|
| L5 | 查询条件 | 至少2个查询条件（`.query-item`：label 72px宽 + 输入控件）（→ [query-bar.md](./components/query-bar.md) QB-2）|
| L6 | 查询按钮 | `.btn-primary` + search图标 + 白色图标 |
| L7 | 重置按钮 | **查询栏/表单/弹窗**: `.btn-secondary`（有边框）/ **列表页工具栏**: `.btn-default`（无边框） |

##### 6.1.3 工具栏（L8-L12）

| # | 检查项 | 通过标准 |
|---|--------|---------|
| L8 | 工具栏容器 | `.action-bar` |
| L9 | 新增按钮 | `.btn-default` + plus图标（列表页工具栏统一用普通按钮，见 [action-buttons.md](./components/action-buttons.md)）|
| L10 | 批量操作按钮 | 删除/导出/导入均用 `.btn-default`（列表页工具栏统一普通按钮） |
| L11 | 更多操作按钮 | 文字**"更多操作"** + chevron-down图标（在右侧），第7个起收纳 |
| L12 | 按钮间距 | `gap: 12px`（**= Anti-pattern #4**）|

##### 6.1.4 数据表格（L13-L19）

| # | 检查项 | 通过标准 |
|---|--------|---------|
| L13 | 表格容器 | `.table-container`，横向滚动 |
| L14 | 表头 | `.data-table thead`，背景#F4F7F9 |
| L14.1 | 列宽策略 | `table-layout: fixed` + 固定 px 列宽（见 [tables.md §列宽与布局策略](./components/tables.md#列宽与布局策略)）|
| L14.2 | 列宽范围 | 48px（最小）~ 540px（最大），固定列宽项按 [标准](./components/tables.md#固定列宽项标准-⭐) 设置 |
| L14.3 | 溢出交互 | 超出列宽显示省略号「…」，鼠标进入显示全部文字 |
| L15 | 复选框列 | 全选功能（**= C1-C2**）|
| L16 | 排序列 | `.sortable` + `.sort-icon` 双箭头常显，CSS border三角形（**= C6**）|
| L17 | 数据列 | 至少5-10条mock数据（**= O1**）|
| L18 | 操作列 | 编辑 + 删除 + 更多，左对齐（**= C15-C18**）|
| L19 | 状态标签 | `.tag-success` / `.tag-warning` / `.tag-info`（见 [tags.md](./components/tags.md)）|

##### 6.1.5 分页器（L20-L23）

> **完整规范** → [Pagination.md](./components/Pagination.md)

| # | 检查项 | 通过标准 |
|---|--------|---------|
| L20 | 分页信息 | "共有 X 条"（列表页用 `.pagination-wrapper`）/ "共 X 条"（弹窗用 `.pagination-bar`） |
| L21 | 每页条数选择器 | 10/20/50/100条/页（仅列表页场景，弹窗场景无） |
| L22 | 页码按钮 | 上一页、页码、下一页，24×24px，激活态主色背景 |
| L23 | 跳转输入框 | "前往 X 页"（仅列表页场景，弹窗场景无） |

#### 6.2 表单弹窗完整性检查（F1-F13 — 13项）

##### 6.2.1 弹窗容器（F1-F3）

| # | 检查项 | 通过标准 |
|---|--------|---------|
| F1 | 遮罩层 | 半透明黑色背景 |
| F2 | 弹窗主体 | 居中显示，白色背景，圆角4px，阴影S3 |
| F3 | 关闭按钮 | 右上角 × 图标（**= C7**），hover有背景变化 |

##### 6.2.2 弹窗头部（F4-F5）

| # | 检查项 | 通过标准 |
|---|--------|---------|
| F4 | 标题文字 | 16px，主文字色#141b24 |
| F5 | 副标题或描述 | 可选，12px灰色 |

##### 6.2.3 表单区域（F6-F10 — 5项）

| # | 检查项 | 通过标准 |
|---|--------|---------|
| F6 | 表单项 | `.form-item`：label + 输入控件 |
| F7 | 必填标记 | 红色 * 号 |
| F8 | 输入框 | `.input-field`：边框#D2D7E1、圆角4px、高度**28px**（**= form-inputs.md**）|
| F9 | 下拉选择器 | 隐藏原生箭头 + 内联SVG chevron-down（**= C9**）|
| F10 | 验证样式 | 错误提示红色、成功提示绿色 |

##### 6.2.4 底部操作区（F11-F13 — 3项）

| # | 检查项 | 通过标准 |
|---|--------|---------|
| F11 | 取消按钮 | `.btn-secondary`（弹窗/表单场景，有边框） |
| F12 | 确定按钮 | `.btn-primary` |
| F13 | 按钮右对齐 | `margin-left: auto` 或 `justify-content: flex-end` |

#### 6.3 详情页完整性检查（D1-D9 — 9项）

##### 6.3.1 页面标题区（D1-D3）

| # | 检查项 | 通过标准 |
|---|--------|---------|
| D1 | 返回按钮 | chevron-left图标 + "返回"文字 |
| D2 | 页面标题 | 18-20px，600字重 |
| D3 | 操作按钮组 | 编辑、删除等 |

##### 6.3.2 内容展示区（D4-D7）

| # | 检查项 | 通过标准 |
|---|--------|---------|
| D4 | 卡片容器 | `.page-card`：白色背景、圆角4px、**无阴影无边框**（见 [cards.md v5.0](./components/cards.md)）|
| D5 | 信息分组 | 按模块分区，如"基本信息"、"联系方式" |
| D6 | 描述列表 | label-value对齐展示 |
| D7 | 状态标签 | 启用/禁用/审核中等 |

##### 6.3.3 关联操作区（D8-D9）

| # | 检查项 | 通过标准 |
|---|--------|---------|
| D8 | 操作历史时间轴 | 如适用 |
| D9 | 关联数据列表 | 如适用 |

#### 6.4 交互完整性检查（AC1-AC8 — 8项）

> **使用时机**：每个页面交付前，必须逐项确认所有按钮/链接/控件**可点击且有反馈**
>
> **核心原则**：禁止出现"死按钮"——任何可见的可点击元素必须绑定交互行为
>
> **交互模拟方式**：使用 Mock 数据 + 原生 JS 模拟（不依赖后端），详见 [page-interactions.md § 必备交互](./page-interactions.md)

##### 6.4.1 列表页交互（AC1-AC5）

| # | 检查项 | 通过标准 | 实现方式 |
|---|--------|---------|---------|
| AC1 | **查询/重置** | 查询按钮点击 → 显示加载态（≥500ms）→ 渲染表格；重置按钮点击 → 清空所有查询条件 | `handleSearch()` + `showLoading()` + `setTimeout` 模拟异步 |
| AC2 | **新增** | 新增按钮点击 → 打开弹窗或跳转表单页 | `openModal()` 或 `switchPage('路由ID', module)` |
| AC3 | **编辑/查看** | 操作列编辑/查看按钮点击 → 打开弹窗或跳转（携带 `id` 参数） | `handleEdit(id)` / `handleView(id)` |
| AC4 | **删除** | 删除按钮点击 → 弹出确认对话框（`.confirm-danger`）→ 确认后从表格移除该行 | `openConfirm('confirmDelete')` + `row.remove()`（详见 [confirm-dialog.md](./components/confirm-dialog.md)） |
| AC5 | **分页** | 页码可切换、每页条数可切换、跳转输入框可用 | 重渲染表格 + 高亮当前页 |

##### 6.4.2 表单/弹窗交互（AC6-AC7）

| # | 检查项 | 通过标准 | 实现方式 |
|---|--------|---------|---------|
| AC6 | **表单提交** | 提交按钮点击 → 校验必填项 → 通过则提示成功并关闭/跳转；不通过则标红错误项 | `handleFormSave()` + `querySelectorAll('[required]')` 校验 |
| AC7 | **弹窗管理** | 弹窗可打开/关闭；遮罩层点击关闭；ESC 键关闭；取消按钮关闭 | `openModal/closeModal` + `keydown` 监听 + 遮罩 `onclick` |

##### 6.4.3 多页面跳转交互（AC8 — 1项）

| # | 检查项 | 通过标准 | 实现方式 |
|---|--------|---------|---------|
| AC8 | **跨页面跳转** | 列表页"新增/编辑/查看"按钮点击 → `switchPage('路由ID', module)` 经 `location.href` 跳转到 `pages/D-XXX_{页面功能名称}.html`；业务数据通过 `localStorage` 或 URL 查询参数传递，页签/模块状态由 `sessionStorage` 持久化 | `switchPage()` + `localStorage.setItem()` / `URLSearchParams` |

> AC8 仅多页面场景（≥2个独立页面）适用，单页面场景跳过。

##### 6.4.4 交互实现规范

**Mock 数据约定**：
- 列表页提供 5-10 条符合业务场景的假数据（变量名 `MOCK_DATA`）
- 详情页根据 URL `id` 参数从 Mock 数据中查找对应记录
- 表单页保存时仅做前端校验 + 提示，不真实写入

**交互反馈约定**：
- 加载态：显示 loading 占位（≥500ms，避免闪烁过快）
- 成功提示：`alert('保存成功')` 或 toast 组件
- 失败提示：`alert('请填写所有必填项')` + 错误项标红（`border-color: var(--color-error)`）

**多页面跳转约定**（MPA 下 `js/common.js` 的 `switchPage(pageId, module)` 通过 `location.href` 跳转到 `pages/D-XXX_{页面功能名称}.html`，详见 AC8）：
```javascript
// 列表页跳转表单页（业务数据用 localStorage，也可用 URL 查询参数）
localStorage.setItem('editId', id);
switchPage('user-form', 'user-list');
// 表单页保存成功后返回列表
switchPage('user-list');
```

---

**📊 全量 Checklist 总计**:
- **技术层面**（Phase 1-5）：P(3) + I(9) + C(25) + T(4) + O(3) = **44项**
- **业务层面**（Phase 6）：L(26) + F(13) + D(9) + AC(8) = **56项**
- **合计：100项** ✅（含交互完整性 8 项）

---

## 2. 常见错误模式 (Anti-patterns)

> **🚨 本节沉淀实战中反复出现的高频错误及其正确做法。**
> **在写代码之前先浏览本节，避免重复踩坑！**

| # | 错误模式 | 正确做法 | 修复参考 | 关联检查项 |
|---|---------|---------|---------|-----------|
| 1 | Inline Style 优先级陷阱：按钮 hover 时图标不变色 | hover 规则添加 `!important` 强制覆盖 inline style | [S32](style-fix-cheatsheet.md) | C3 |
| 2 | 图标尺寸凭感觉设定（如顶导图标 16px） | 查阅尺寸速查表，顶导 20px、展开箭头 16px | [S05, S11, S25](style-fix-cheatsheet.md) | I6, C14 |
| 3 | 错误的图标引入方式（`<object>`/`<img>`/内联 path） | 使用 SVG Sprite `<use>` 引用，文件名即图标名（`edit.svg` → `#icon-edit`）；自定义图标先在 Sprite 块中添加 `<symbol id="icon-名称">` 再引用 | [S04](style-fix-cheatsheet.md) | I1, I9 |
| 4 | 操作列按钮间距错误 | 统一 `gap: 12px` 左对齐 | [S24](style-fix-cheatsheet.md) | C15-C18 |
| 5 ⭐ | 箭头方向错误（chevron-right + rotate 模拟下箭头） | 直接使用 chevron-down.svg | [S12](style-fix-cheatsheet.md) | C23-C25 |
| 6 ⭐ | 图标颜色过淡（`#7C8493` 看似禁用） | 使用主文本色 `#141b24`（选中态 `#3685F2`） | [S06-S07](style-fix-cheatsheet.md) | I8, C19 |
| 7 | 复选框使用原生 input + accent-color | 使用自定义复选框方案 | [S35](style-fix-cheatsheet.md) | C1, C2 |
| 8 | Tab 关闭图标使用 SVG circle-remove | 使用纯 CSS 伪元素绘制 × 符号 | [S29](style-fix-cheatsheet.md) | C7 |
| 9 | 下拉选择器使用 CSS border 三角 | 使用 chevron-down SVG 图标 | [S28](style-fix-cheatsheet.md) | C9 |
| 10 ⭐⭐ | 仅凭文字描述发明规范 | 先加载 Skill 文件和 design-tokens.css 再编写代码 | [全表](style-fix-cheatsheet.md) | — |

---

## 3. FAQ 常见问题解答

> **Q1-Q4** 为独立问题（无对应 Anti-pattern）；其余问题请直接查阅 §2 对应 Anti-pattern 条目获取完整解释。

---

### Q1: 为什么禁止 `transform: scale()`？
> A: `scale()` 会改变元素的渲染边界，导致布局计算不稳定，特别是在复杂表格和弹窗场景下。推荐使用 `opacity` + `translateY()` 实现动画效果。
> 
> 📎 对应检查项：[T1](#phase-4-technical-principles-技术原则全局层面--4项)

### Q2: `overflow-x: hidden` 什么时候可以用？
> A:
> - ✅ **可以用于**：侧边栏 `.sidebar`（防止菜单溢出）、特定容器（明确需要裁剪的场景）
> - ❌ **禁止用于**：`body/html`（全局裁剪）、`.main-content`（会裁剪表格内容）
>
> **正确做法**：表格容器 `.table-container` 应该使用 `overflow-x: auto;`
>
> 📎 对应检查项：[T2](#phase-4-technical-principles-技术原则全局层面--4项)

### Q3: "来自 design-tokens.css" 是指什么意思？
> A:
> 1. **数值准确性**：你写的颜色/尺寸值必须与 design-tokens.css 中定义的一致
> 2. **引用方式**：高频使用的核心变量应该通过 CSS `var()` 引用，便于统一管理和主题切换
>
> 📎 对应检查项：[T3](#phase-4-technical-principles-技术原则全局层面--4项)

### Q4: 表格列宽应该怎么设置？
> A: 使用**固定 px** 列宽，配合 `table-layout: fixed`：
> ```css
> .data-table { table-layout: fixed; width: 100%; }
> /* 列宽在 HTML 的 th style 中按 px 指定 */
> /* 示例：<th style="width:48px;text-align:center"> 序号 */
> /* 示例：<th style="width:140px"> 操作（范围120-160px）*/
> ```
> 列宽范围：48px（最小）~ 540px（最大），详见 [tables.md §列宽三档规则](./components/tables.md#列宽三档规则-⭐)。
> 遇到固定列宽项（序号/姓名/手机号码等）时，按 [固定列宽项标准](./components/tables.md#固定列宽项标准-⭐) 设置。

---

*最后更新: 2026-08-31 | v9.4.0（AC4 删除交互改为确认对话框 `openConfirm`；新增 modal.md 和 confirm-dialog.md 组件引用）*
