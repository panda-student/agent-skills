# 样式矫正速查表 (Style Fix Cheatsheet)

## 资源问题排查

> MPA 架构下，Token/Sprite/Logo/缩放由 `css/common.css`/`js/common.js` 统一提供。资源类 FAIL 时检查是否从 ASSETS 正确复制。
> ⚠️ **阅读禁令**：`js/common.js` 约 186KB（86% 为内嵌 SVG 图标），**禁止全量阅读**，检测一律用下方 grep 命令（输出 1 个数字即可判定）。
> ⚠️ **复制铁律（G6.1）**：补复制时必须用 `cp` 命令直接复制，**禁止用 Read 读取后用 Write 重写**——Read+Write 必然丢失 SVG Sprite 内容或超限。

| 问题信号 | validate检测 | 修复方式 |
|---------|-------------|---------|
| 缺 Token / 颜色变量失效 | E1 FAIL | `grep -c "color-primary" css/common.css`（≥1 即已复制）；无 → `cp ASSETS/page-shells/css/common.css css/common.css` |
| 图标不显示 / 缺 Sprite | E2 FAIL | `grep -c "SVG_SPRITE" js/common.js`（≥1 即已复制）；无 → `cp ASSETS/page-shells/js/common.js js/common.js`（禁止 Read+Write 重写） |
| Logo 异常 / fill 硬编码 | E3 WARN/FAIL | `grep -c "LOGO_SVG" js/common.js`（≥1 即存在）；确认 Logo 内 `fill` 用 `var(--color-brand)`：`grep -o "LOGO_SVG" js/common.js` 后仅局部读取 Logo 段（第159~175行附近） |
| 页面放大失效 / 缩放缺失 | E4 FAIL | `grep -c "applyResponsiveZoom" js/common.js`（≥1 即 PASS）；缺失 → 从 `ASSETS/page-shells/js/common.js` 局部复制缩放段（文末第1028行起） |
| 硬编码颜色值 | style-scan S40 | 三级策略：色板匹配→PASS；UI 场景非规范→FAIL（修正）；图表/多数据→SKIP（允许）；模糊→WARN（确认） |
| 非标准圆角值 | style-scan S39 | 查下方 S39（手动改）或 S68（外部原型批量报告） |
| 导航栏高度非42px | style-scan S13 | 查下方 S13（手动改） |
| 内联 style 污染（外部原型） | E6 FAIL | 查下方 S66（结构性清洗）+ S67（值级自动清洗）。⚠️ Sprite 容器 `display:none` 行级白名单豁免（官方固有模式）；导航壳 `common.js` 的子菜单折叠/页签图标过时内联样式已于 v5.1.3 修正（CSS 状态类 + `.icon-sm`），交付侧需按此同步 |

> **判定规则**：E1-E4/E6 → 资源类问题（检查 common.css/common.js）；样式类问题 → 运行 style-scan.mjs。E6 全量生效（含 common.js），仅 Sprite 容器行级白名单豁免。

---

> **定位**：质量门禁自检的**核心矫正工具**，每条包含「错误→正确」映射 + 可直接复制的修复代码
>
> **使用方式**：自检发现偏差 → 查此表 → 复制修复代码 → 粘贴到对应位置 → 重验通过
>
> **版本**: v2.0 | **与 style-scan.mjs 65项检测 1:1 对应**
>
> **性能优化**：style-scan.mjs 新增 `--quiet` 参数，仅输出 FAIL/WARN 项（跳过 PASS/SKIP），输出量降 70%+。
> ```bash
> node scripts/style-scan.mjs --quiet <文件>   # 精简模式（AI 自检默认使用）
> node scripts/style-scan.mjs <文件>            # 全量模式（用户对结果有异议/要求复查时使用）
> ```

---

## 目录

1. [资源预置类](#1-资源预置类-s01-s03) — Token/Sprite/Logo
2. [图标合规类](#2-图标合规类-s04-s12) — 尺寸/颜色/引入方式
3. [导航栏类](#3-导航栏类-s13-s19) — 顶导/侧边菜单/功能区
4. [表格与操作列类](#4-表格与操作列类-s20-s25) — 表格/操作列/排序
5. [查询栏与表单类](#5-查询栏与表单类-s26-s31--s42-s46) — 查询栏/输入框/下拉选择/换行间距/按钮区布局
6. [按钮与交互类](#6-按钮与交互类-s32-s36) — 按钮/hover/active
7. [布局与技术原则类](#7-布局与技术原则类-s37-s41) — 布局/overflow/圆角/类名
8. [内容区大卡片类](#8-内容区大卡片类-s47-s50) — 阴影/边框/类名变体/内容包裹（cards.md v5.0/v5.1）
9. [弹窗/操作栏/zoom/分页类](#9-弹窗操作栏操作列zoom分页类-s51-s57) — 弹窗/操作栏/zoom/分页/外边距
10. [选项卡/标签页 Tabs 类](#10-选项卡标签页-tabs-类-s58-s62) — 选中态指示线/容器/边框占位/溢出箭头
11. [系统级页签类](#11-系统级页签类-s63-s65) — 容器内边距/卡片圆角/关闭图标逻辑
12. [外部原型污染清洗类](#12-外部原型污染清洗类-s66-s69) — 内联style/硬编码颜色批量映射/非标准圆角/JS模板字符串内嵌HTML

---

## 1. 资源预置类 (S01-S03)

| # | 组件位置 | 错误值 / 错误现象 | 正确值 | 一键修复命令 | 修复CSS/HTML |
|---|---------|------------------|--------|-------------|-------------|
| S01 | `<head>` 区块 | 缺少 Design Tokens 或外链引用 | 内联 `design-tokens.css` 全部内容到 `<style>` 标签 | `node scripts/quick-fix.mjs tokens <文件>` | 见 quick-fix.mjs 自动处理 |
| S02 | `<body>` 开头 | 缺少 SVG Sprite 或 symbol 数量不足(需≥113) | 内联全部 `<symbol>` 到隐藏 `<svg>` 容器 | `node scripts/quick-fix.mjs sprite <文件>` | 见 quick-fix.mjs 自动处理 |
| S03 | Logo 区域 | 使用 `<img>` 外链 / `fill="#0C328C"` 硬编码 / 显示异常 | 内联 SVG + `class="top-nav-logo"` + `fill="var(--color-brand)"` | `node scripts/quick-fix.mjs logo <文件>` | 见 quick-fix.mjs 自动处理 |
| S03a | 文字Logo宽度 | `.top-nav-logo-text` 宽度非180px（导致Logo区域宽度不稳定） | `width: 180px`（与SVG Logo一致） | `grep -n 'top-nav-logo-text.*width' <文件>` | `.top-nav-logo-text { width: 180px !important; }` |

**自动化验证**：`node scripts/validate-design.mjs <文件>` → 三项全 PASS（支持 .html 和 .js 文件）

**⚠️ 强制规则（G6）**：S01/S02/S03 属内容注入类，**禁止手动复制 CSS/SVG 代码**，必须执行 `quick-fix.mjs` 对应子命令（tokens/sprite/logo）。映射关系详见本文件开头「快速修复脚本导航」。本表的「修复CSS/HTML」列仅供理解原理，不作为修复手段。

---

## 2. 图标合规类 (S04-S12)

| # | 组件位置 | 错误值 / 错误现象 | 正确值 | 快速定位命令 | 修复CSS |
|---|---------|------------------|--------|------------|--------|
| S04 | 所有图标引入 | `<img src="icon.svg">` / `<object data="icon.svg">` / Sprite 块外内联 `<path d="...">` | `<svg class="icon"><use href="#icon-xxx"></use></svg>` | `grep -n '<img.*svg\|<object\|<path d=' <文件>` | 见下方 **S04 详细修复指引** |
| S05 | 顶部导航栏图标尺寸 | `width:16px; height:16px` | `width:20px; height:20px` | `grep -n 'nav-icon-btn\|top-nav-right.*icon' <文件>` | `.nav-icon-btn { width: 20px !important; height: 20px !important; }` |
| S06 | 左侧菜单功能图标（未选中态） | `color: #7C8493`（次要灰，看起来像禁用） | `color: #141b24`（主文本色，清晰专业） | `grep -n 'sidebar-menu-item.*color\|menu-icon.*color' <文件>` | `.sidebar-menu-item .icon, .sidebar-menu-item .menu-icon { color: var(--color-text-primary) !important; }` |
| S07 | 左侧菜单功能图标（选中态） | `color: #141b24`（不变色） | `color: #3685F2`（主题蓝） | `grep -n 'sidebar-menu-item.*active.*color\|\.active.*icon' <文件>` | `.sidebar-menu-item.active .icon, .sidebar-menu-item.active .menu-icon { color: var(--color-primary) !important; }` |
| S08 | 输入框内图标 / 下拉箭头 | `color: #141b24` 或 `#7C8493` | `color: #B9BFCB`（弱提示灰） | `grep -n 'input-wrapper.*icon\|select.*icon\|\.input-icon' <文件>` | `.input-wrapper .icon, .select-arrow .icon { color: var(--color-text-tertiary) !important; }` |
| S09 | 表格排序图标 | `color: #141b24`（过深） | `color: #7C8493`（次要灰） | `grep -n 'sort.*icon\|th.*icon' <文件>` | `.sort-arrow, th .icon { color: var(--color-text-secondary) !important; }` |
| S10 | 分页器 / "更多操作"箭头 | `color: #141b24`（过深） | `color: #7C8493`（次要灰） | `grep -n 'pagination.*icon\|more.*icon\|btn-more.*icon' <文件>` | `.pagination .icon, .btn-more-text .icon { color: var(--color-text-secondary) !important; }` |
| S11 | 展开箭头尺寸 | `width:12px; height:12px` | `width:16px; height:16px` | `grep -n 'sidebar-menu-expand\|expand.*icon' <文件>` | `.sidebar-menu-expand .icon { width: 16px !important; height: 16px !important; }` |
| S12 | 左侧菜单展开箭头 SVG 文件名（仅检测 `.sidebar-menu-expand` 元素内） | `href="#icon-chevron-right"` | `href="#icon-chevron-down"` | `awk '/sidebar-menu-expand/{in=1} in&&/chevron-right/{print NR": "$0} in&&/<\/svg>/{in=0}' <文件>` | 将 `.sidebar-menu-expand` 内的 `#icon-chevron-right` 替换为 `#icon-chevron-down`，展开/收起由 CSS `.sidebar-menu-item.expanded .sidebar-menu-expand { transform: rotate(-90deg); }` 控制。**注意**：分页器"下一页"/面包屑分隔等场景的 `chevron-right` 为合法使用，不在本项检测范围 |

**S06 视觉对比参考**：
- ❌ `#7C8493` — 图标过淡，视觉上接近禁用状态
- ✅ `#141b24` — 与文字同色，清晰可辨

**S04 详细修复指引**：

> ⚠️ **核心原则：图标命名必须可追溯**。不论是 `<img>` 还是内联 `<svg>`，最终都必须能从代码中看出对应哪个图标资源。
>
> ✅ **用户自定义图标允许使用**：当 113 个标准图标无法满足业务需求时，允许用户自行补充图标。但必须将图标命名在代码中暴露（通过 `<symbol id="icon-名称">` + `<use href="#icon-名称">`），禁止内联 `<path d=>` 隐藏命名。

**场景 1：标准图标（113 个 Sprite 内已有）**

将 `<img src="文件名.svg">` 直接转为 `<use>` 引用，文件名即图标名：

```html
<!-- ❌ 错误：img 引用，无法支持 currentColor 变色 -->
<img src="edit.svg" alt="编辑">

<!-- ❌ 错误：内联 path，丢失命名关系，无法追溯图标资源 -->
<svg class="icon"><path d="M3 17.5V2..." fill="currentColor"/></svg>

<!-- ✅ 正确：use 引用，文件名 → icon-文件名，命名清晰 -->
<svg class="icon"><use href="#icon-edit"></use></svg>
```

命名转换规则：`edit.svg` → `#icon-edit`，`save 2.svg` → `#icon-save-2`（空格转连字符）。

**场景 2：用户自定义图标（不在 113 个标准 Sprite 中）**

用户自行补充的图标（含 AI 生成）允许使用，但必须：① 本地存入 `2.UI/images/{名称}.svg`；② 在 Sprite 块中注册 `<symbol>` 暴露命名；③ 通过 `<use>` 引用：

```html
<!-- 步骤 1：将 SVG 文件存入 2.UI/images/custom-chart.svg（含 AI 生成图标，必须本地有文件） -->

<!-- 步骤 2：在 Sprite 块（<!-- JMBOS-SVG-SPRITE --> 区域内）添加 symbol -->
<symbol id="icon-custom-chart" viewBox="0 0 16 16">
  <path d="M2 14V4h12v10H2z" fill="none" stroke="currentColor" stroke-width="1.5"/>
</symbol>

<!-- 步骤 3：在页面中使用，命名关系清晰 -->
<svg class="icon"><use href="#icon-custom-chart"></use></svg>
```

> ⛔ **禁止**：将 `<path d="...">` 直接内联到页面内容区域作为图标使用。此方式：
> - 丢失图标命名关系，无法追溯对应资源文件
> - 无法通过 `<use href="#icon-xxx">` 命中 Sprite 资源
> - S04 会持续报错（Sprite 块外的 `<path d=` 均为违规）

> ℹ️ **Logo 例外**：顶部导航栏 Logo 区域允许使用 `<img src="logo.svg">` + CSS filter 方案（见 [brand/README.md](../ASSETS/brand/README.md) 方案C），S04 检测已排除 Logo 区域的 `<img>` 引用。

---

## 3. 导航栏类 (S13-S19)

| # | 组件位置 | 错误值 / 错误现象 | 正确值 | 快速定位命令 | 修复CSS |
|---|---------|------------------|--------|------------|--------|
| S13 | 顶部导航栏高度 | 非42px（如40px/44px/48px） | `height: 42px` | `grep -n 'top-nav.*height\|header.*height\|\.nav-bar.*height' <文件>` | `.top-nav, .header-nav { height: 42px !important; }` |
| S14 | 顶部导航栏菜单项高度控制 | 仅靠 `padding` 控制（如 `padding: 10px 16px`） | `height: 100%` + `align-items: stretch` 撑满42px | `grep -n 'nav-menu-item.*padding\|nav-item.*height' <文件>` | `.nav-menu-item { height: 100% !important; align-items: stretch !important; padding: 0 16px !important; }` |
| S15 | 顶部导航栏菜单项圆角 | `border-radius: 2px/4px` | `border-radius: 0`（无圆角） | `grep -n 'nav-menu-item.*radius' <文件>` | `.nav-menu-item { border-radius: 0 !important; }` |
| S16 | 顶部导航栏右侧功能区 | 图标直接放在 `<header>` 中 | 包裹在 `<div class="top-nav-right">` 内 | `grep -n 'top-nav-right' <文件>`（无结果则缺失） | 用 `<div class="top-nav-right">` 包裹右侧所有图标/用户头像 |
| S17 | 左侧菜单宽度 | 非180px（如200px/160px） | `width: 180px` | `grep -n 'sidebar.*width' <文件>` | `.sidebar { width: 180px !important; }` |
| S18 | 左侧菜单项内边距 | `padding: 0 16px` | `padding: 0 12px` | `grep -n 'sidebar-menu-item.*padding' <文件>` | `.sidebar-menu-item { padding: 0 12px !important; }` |
| S19 | 左侧菜单项字重 | `font-weight: 600`（含 active 态） | `font-weight: 400`（固定，active 态也不加粗） | `grep -n 'sidebar-menu-item.*weight\|sidebar.*font-weight' <文件>` | `.sidebar-menu-item { font-weight: 400 !important; }` |

---

## 4. 表格与操作列类 (S20-S25)

| # | 组件位置 | 错误值 / 错误现象 | 正确值 | 快速定位命令 | 修复CSS |
|---|---------|------------------|--------|------------|--------|
| S20 | 操作列按钮形式 | 图标+文字混用（如 📝 编辑）或纯图标/纯文字未统一 | **2选1：纯图标 或 纯文字（默认纯文字）；更多按钮统一 ··· 图标** | `grep -n 'action-col.*svg\|action-links.*<use' <文件>`（排除 icon-more） | `.link-btn` 内删除 `<svg><use>` 仅保留文字，或删除文字仅保留svg；`.more-action-btn` 保持 `#icon-more` 不变 |
| S21 | 操作列 Hover 态 | `background-color: rgba(...)` 有背景色 | `background: none` + `color: #5E9DF5` 仅变色 | `grep -A2 'link-btn:hover\|action-links.*:hover' <文件>` | ```css\n.link-btn:hover {\n  background: none !important;\n  color: var(--color-primary-hover) !important;\n}\n``` |
| S22 | 操作列 Active 态 | 缺少 `:active` 定义（三态不完整） | 必须定义 `:active` 态，颜色 `#2364CC` | `grep -n 'link-btn:active' <文件>`（无结果则缺失） | ```css\n.link-btn:active {\n  color: var(--color-primary-active) !important;\n}\n``` |
| S23 | 操作列 Padding | `padding > 0`（有内边距） | `padding: 0`（无内边距） | `grep -n 'link-btn.*padding\|action-links.*padding' <文件>` | `.link-btn { padding: 0 !important; }` |
| S24 | 操作列间距 | `gap: 8px/16px` 或用 margin | `gap: 12px` | `grep -n 'action-links.*gap\|\.action-links.*margin' <文件>` | `.action-links { display: flex; align-items: center; gap: 12px !important; justify-content: flex-start; }` |
| S25 | 排序图标 | 箭头尺寸非标准 / gap非3px | 箭头底4px高5px（CSS border三角形）+ `gap: 3px` | `grep -n 'sort.*width\|sort-arrow\|arrow-up\|arrow-down' <文件>` | ```css\n.sort-icon .arrow-up {\n  border-left: 4px solid transparent;\n  border-right: 4px solid transparent;\n  border-bottom: 5px solid var(--color-text-secondary);\n}\n.sort-icon .arrow-down {\n  border-left: 4px solid transparent;\n  border-right: 4px solid transparent;\n  border-top: 5px solid var(--color-text-secondary);\n}\n.sort-icon { gap: 3px; }\n``` |

---

## 5. 查询栏与表单类 (S26-S31, S42-S46)

| # | 组件位置 | 错误值 / 错误现象 | 正确值 | 快速定位命令 | 修复CSS |
|---|---------|------------------|--------|------------|--------|
| S26 | 查询栏背景色 | `background: #F4F7F9`（用了表头色）或 `var(--color-bg-header)` | `background: #FFFFFF`（纯白） | `grep -n 'query-bar.*background' <文件>` | `.query-bar { background: #FFFFFF !important; }` |
| S27 | 查询标签宽度 | `width: auto` / `80px` / `100px` / `em单位` | `width: 72px` 且 `min-width: 72px` | `grep -n 'query-item.*label.*width\|query-item > label' <文件>` | `.query-item > label { width: 72px !important; min-width: 72px !important; }` |
| S28 | 下拉选择器箭头实现 | CSS `border` 绘制的三角（如 `border-width: 4px 4px 0`） | SVG chevron-down 图标 | `grep -n 'border.*solid.*transparent\|select.*arrow.*border\|css.*triangle' <文件>` | 删除 CSS border 三角代码，替换为：`<svg class="icon"><use href="#icon-chevron-down"></use></svg>` |
| S29 | Tab 关闭图标 | `<use href="#icon-circle-remove">` SVG 图标 | 纯 CSS 伪元素 X | `grep -n 'tab-close.*circle-remove\|tab.*close.*use' <文件>` | ```css\n.tab-close::after {\n  content: '×';\n  font-size: 14px;\n  line-height: 1;\n}\n``` |
| S30 | 输入框边框色 | 非 `#D2D7E1`（如 `#ccc` / `#e0e0e0`） | `border-color: #D2D7E1` | `grep -n 'input-field.*border\|\.input.*border' <文件>` | `.input-field { border: 1px solid var(--color-bg-border) !important; }` |
| S31 | 输入框高度 | 非28px（如32px/36px/40px） | `height: 28px` | `grep -n 'input-field.*height' <文件>` | `.input-field { height: 28px !important; }` |
| S42 | 查询栏换行间距 | 缺少 `flex-wrap: wrap` 或 `row-gap` 非12px | `flex-wrap: wrap` + `row-gap: 12px` | `grep -n 'query-bar.*flex-wrap\|query-bar.*row-gap' <文件>` | `.query-bar { flex-wrap: wrap; row-gap: 12px; }` |
| S43 | 查询栏按钮区等分布局 | 使用 `margin-left: auto` 推到右侧 | `flex: 1` 等分空间 + `justify-content: flex-end` 右对齐 | `grep -n 'query-actions.*margin-left\|query-actions.*flex' <文件>` | `.query-actions { flex: 1; justify-content: flex-end; }（删除 margin-left: auto）` |
| S44 | 查询栏按钮区右对齐 | 缺少 `justify-content: flex-end` | `justify-content: flex-end` | `grep -n 'query-actions.*justify-content' <文件>` | `.query-actions { justify-content: flex-end; }` |
| S45 | 查询栏布局注释 | 注释未包含按钮区说明 | 注释格式 `(N查询条件 + M按钮区)` | `grep -n '<!--.*查询栏' <文件>` | `<!-- 查询栏 - N列模式：M查询条件 + 1按钮区 -->` |
| S46 | 查询栏全行统一列数 + 多行结构 | 混用3列和4列布局 / 多行子元素数量不一致 / 按钮区不在末行 | 全行统一列数 + 多行每行子元素一致（3列=3个，4列=4个）+ 按钮区在末行末列 | `grep -n '<!--.*3.*列\|<!--.*4.*列' <文件>` | 统一为相同列数模式；多行用 `.query-row` 分行，末行不足用 `visibility:hidden` 占位补齐 |

---

## 6. 按钮与交互类 (S32-S36)

| # | 组件位置 | 错误值 / 错误现象 | 正确值 | 快速定位命令 | 修复CSS |
|---|---------|------------------|--------|------------|--------|
| S32 | 按钮 hover 时图标不变色 | hover 规则未覆盖 inline style 的优先级 | hover 规则添加 `!important` | 检查按钮 hover 后图标是否变色 | ```css\n.btn-primary:hover svg,\n.btn-secondary:hover svg,\n.btn-danger:hover svg,\n.btn-link:hover svg {\n  color: #FFFFFF !important;\n}\n.btn-secondary:hover svg,\n.btn-link:hover svg {\n  color: #5E9DF5 !important;\n}\n``` |
| S33 | 设置按钮（卡片头部） | 有边框（如 `border: 1px solid #ddd`） | `border: none`（无边框） | `grep -n 'settings.*btn.*border\|card-header.*settings' <文件>` | `.btn-settings, .card-header .settings-btn { border: none !important; }` |
| S34 | fill 硬编码色（三级色值策略） | Logo/UI 场景非规范 fill 色值 | 替换为 design-tokens 中定义的色值（`var()` 或正确 hex 均可） | `node scripts/style-scan.mjs --quiet <文件> 2>&1 \| grep S34` | 色板匹配→PASS；Logo/UI→FAIL；图表→SKIP；模糊→WARN |
| S35 | 复选框实现 | `<input type="checkbox">` + `accent-color` | 自定义复选框（`.checkbox-item` + `.checkbox-cell`） | `grep -n 'accent-color' <文件>` | 使用 design-tokens.css 中预定义的 checkbox 样式，详见 [checkboxes.md](./components/checkboxes.md) |
| S36 | 弹窗关闭按钮 | 非右上角 × / 无 hover 背景变化 | 右上角 × 图标 + hover 有背景变化 | `grep -n 'modal-close\|modal.*close' <文件>` | 参考 [modal.md](./components/modal.md) 中的关闭按钮实现 |

---

## 7. 布局与技术原则类 (S37-S41)

| # | 组件位置 | 错误值 / 错误现象 | 正确值 | 快速定位命令 | 修复CSS |
|---|---------|------------------|--------|------------|--------|
| S37 | 页面整体布局 | 使用 `transform: scale()` 做布局适配 | 顶导/侧边 `position: fixed` + 主内容区 `margin` 偏移 | `grep -n 'transform: scale\|scale(' <文件>` | 删除 transform: scale()，改用 fixed + margin 方案 |
| S38 | body/html overflow | `overflow-x: hidden`（导致横向滚动失效） | 移除 `overflow-x: hidden`；表格容器使用 `overflow-x: auto` | `grep -n 'overflow-x.*hidden' <文件>` | 从 body/html 选择器中删除 `overflow-x: hidden`；确保 `.table-container { overflow-x: auto; }` |
| S39 | 圆角值 | 使用非规范值（如3px/5px/6px/10px） | 仅使用 `0/2px/4px/8px/12px/16px` 或 `var(--radius-rX)` | `grep -oE 'border-radius:\s*[0-9]+px' <文件>\| grep -vE '(0\|2\|4\|8\|12\|16)px'` | 将非标准圆角值替换为最近的规范值或变量 |
| S40 | 高频颜色硬编码（三级色值策略） | UI 组件场景非规范色值（`#非规范色` 在按钮/文字/背景等） | 替换为 design-tokens 中定义的色值（`var()` 或正确 hex 均可） | `node scripts/style-scan.mjs --quiet <文件> 2>&1 \| grep S40` | 色板匹配→PASS；UI 场景→FAIL；图表/多数据→SKIP；模糊→WARN |
| S41 | 自定义组件类名 | 使用 `.toolbar-left` / `.my-button` 等自定义命名 | 使用 components/*.md 定义的标准类名 | 对照 components/README.md 核查 | 全局替换为标准类名 |

---

## 8. 内容区大卡片类 (S47-S50)

> 对应 [cards.md v5.0/v5.1](./components/cards.md) — 内容区大卡片（`.page-card`）无阴影无边框 + 内容包裹规则

| # | 组件位置 | 错误值 / 错误现象 | 正确值 | 快速定位命令 | 修复CSS |
|---|---------|------------------|--------|------------|--------|
| S47 | 内容区大卡片 `.page-card` 阴影 | `box-shadow: var(--shadow-s1)` / `box-shadow: 0 1px 5px rgba(...)` 等任意阴影值 | `box-shadow: none`（禁止使用任何层级阴影） | `grep -nE '\.page-card.*box-shadow\|box-shadow.*var\(--shadow' <文件>` | `.page-card { box-shadow: none !important; }` |
| S48 | 内容区大卡片 `.page-card` 边框 | `border: 1px solid #D2D7E1` / `border: 1px solid var(--color-bg-border)` 等任意边框 | `border: none`（禁止使用任何边框） | `grep -nE '\.page-card.*border\|border.*solid.*page-card' <文件>` | `.page-card { border: none !important; }` |
| S49 | 大卡片类名变体 | 使用 `.content-card` / `.detail-card` / `.panel-card` 等废弃类名 | 统一使用 `.page-card`（已在 common.css 全局定义） | `grep -nE 'class="[^"]*(content-card\|detail-card\|panel-card)' <文件>` | 全局替换 `class="content-card/detail-card/panel-card"` → `class="page-card"` |
| S50 | 标题栏写在 `.page-card` 外面 | `.page-title-bar` / `.page-title` 作为 `main-content` 的直接子元素（在 `.page-card` 之前出现） | 标题栏必须作为 `.page-card` 的第一个子元素，包裹在卡片内 | `grep -n 'page-title-bar\|page-title' <文件>` 对比 `grep -n 'page-card' <文件>` 行号 | 将 `.page-title-bar` 整体移入 `<div class="page-card">` 内部作为第一个子元素 |

**判定原则**：该卡片是否是页面/抽屉/弹窗的"最外层内容容器"？
- 是 → 用 `.page-card`（无阴影、无边框，仅靠白色背景与页面灰底色差体现层次）
- 否（嵌套在大卡片内部的信息分组） → 用 `.card`（有 S1 阴影、无边框）

**抽屉/弹窗特殊说明**：抽屉与弹窗本体已通过 `box-shadow` 体现悬浮层次，内部内容区不得再嵌套带阴影的"大卡片"容器，否则会产生阴影叠加的视觉污染。

---

## 9. 弹窗/操作栏/操作列/zoom/分页类 (S51-S57)

> 对应 [page-layout.md §2.4](./page-layout.md) + [Pagination.md](./components/Pagination.md) + [tables.md](./components/tables.md)

| # | 组件位置 | 错误值 / 错误现象 | 正确值 | 快速定位命令 | 修复CSS |
|---|---------|------------------|--------|------------|--------|
| S51 | `.modal` 最小高度 | 缺少 `min-height` 或非 36vh | `min-height: 36vh`（允许 `calc(36vh / var(--zoom-value, 1))` 抵消 zoom） | `grep -A 30 '\.modal\s*{' <文件> \| grep min-height` | `.modal { min-height: 36vh; }`（若需抵消 zoom：`min-height: calc(36vh / var(--zoom-value, 1));`） |
| S52 | 列表页 `.action-bar` 内主按钮 | `.action-bar` 内出现 `.btn-primary` | 列表页操作栏统一用 `.btn-default`（主按钮仅用于表单/弹窗提交） | `grep -nE 'action-bar.*btn-primary\|btn-primary.*action-bar' <文件>` | 将 `.action-bar` 内的 `.btn-primary` 改为 `.btn-default` |
| S53 | `.action-col` 内"更多"按钮图标 | `.more-action-btn` 未使用 `#icon-more` | "更多"按钮（`···`）必须使用 `<svg class="icon"><use href="#icon-more"></use></svg>` | `grep -nE 'class="[^"]*more-action-btn[^"]*"' <文件>` 检查是否含 `#icon-more` | 将 `.more-action-btn` 内的图标替换为 `<svg class="icon"><use href="#icon-more"></use></svg>`（规范见 tables.md） |
| S54 | 基于视口的高度计算未除以 zoom-value | `height: calc(100vh - 42px)`（zoom 放大后超出视口） | `height: calc(100vh / var(--zoom-value, 1) - 42px - 1px)` | `grep -nE '(height\|min-height)\s*:\s*calc\([^)]*100vh' <文件> \| grep -v zoom-value` | 将 `calc(100vh - Xpx)` 改为 `calc(100vh / var(--zoom-value, 1) - Xpx - 1px)`（`100vh` 除以 zoom，`Xpx` 不除，`-1px` 容差防止放大后底部截断）。**注意**：`margin-top` 等 px 偏移量不除以 zoom-value。详见 page-layout.md §2.4 |
| S55 | flex 子元素缺少 `min-height:0` | `flex: 1` 的子元素未设置 `min-height: 0`（内容撑高父容器） | 每个 `flex: 1` 的子元素都应设置 `min-height: 0`（至少3处：`.main-content` / `#page-content` / `.page-card`） | `grep -cE 'flex\s*:\s*1' <文件>` 对比 `grep -cE 'min-height\s*:\s*0' <文件>` | 为每个 `flex: 1` 的子元素添加 `min-height: 0`；特别是 `.main-content / #page-content / .page-card` |
| S56 | 分页组件样式偏差 | 页码按钮高度非24px / active 未用主色 / gap 非4px / 字号非12px / 缺 disabled 态 | 24px × 24px / `background-color: var(--color-primary)` / `gap: 4px` / `font-size: 12px` / 含 `:disabled` 态 | `grep -nE '\.page-btn\|\.pagination' <文件>` | 详见 [Pagination.md 第七节](./components/Pagination.md) CSS 样式 |
| S57 | `.page-card` 外边距 | `margin: 10px` / `margin-bottom: 12px` 等任意非0外边距 | **无外边距**（撑满 main-content，margin 会破坏 flex 高度链） | `awk '/\.page-card[[:space:]]*\{/{in=1} in&&/margin[[:space:]]*:[[:space:]]*[^0]/{print NR": "$0} in&&/margin-(top\|bottom\|left\|right)[[:space:]]*:[[:space:]]*[^0]/{print NR": "$0} in&&/^[[:space:]]*\}/{in=0}' <文件>` | 删除 `.page-card` 规则块内的 `margin` / `margin-bottom` / `margin-top` 等属性（`margin: 0` 除外） |

**S54/S55 标准实现**：标准实现详见 [page-layout.md](page-layout.md) §2.4 zoom缩放与高度计算

---

## 10. 选项卡/标签页 Tabs 类 (S58-S62)

> 对应 [tabs.md v1.2.0](./components/tabs.md) — 标准样式选中态指示线 / 页签容器 / 筛选标签 / 溢出箭头

| # | 组件位置 | 错误值 / 错误现象 | 正确值 | 快速定位命令 | 修复CSS |
|---|---------|------------------|--------|------------|--------|
| S58 | `.tabs` 选中态指示线 | 缺少底部2px主题色指示线 | `border-bottom: 2px solid var(--color-primary)`（默认透明占位防跳动） | `grep -A8 '.tab-item.is-active' <文件>` | `.tabs .tab-item { border-bottom: 2px solid transparent; } .tabs .tab-item.is-active { border-bottom-color: var(--color-primary); }` |
| S59 | `.tabs-nav` 容器背景色 | 容器设置了背景色 | 容器透明（由 `.nav-item` 各自背景决定） | `awk '/\.tabs-nav[[:space:]]*\{/{in=1} in&&/background/{print NR": "$0} in&&/\}/{in=0}' <文件>` | 删除 `.tabs-nav` 规则块内的 `background` 属性。选中 `.nav-item` 背景=#FFFFFF，未选中=#F4F7F9 |
| S60 | `.tabs-nav` 选中项白色边框 | 选中项缺少 1px 白色边框占位（切换时跳动） | `border: 1px solid var(--color-bg-card)`（白色边框占位） | `grep -A10 '.nav-item.is-active' <文件>` | `.tabs-nav .nav-item.is-active { border: 1px solid var(--color-bg-card); border-bottom: none; }` |
| S61 | `.tabs-filter` 选中项主题色边框 | 选中项缺少 1px 主题色边框占位（切换时跳动） | `border: 1px solid var(--color-primary)`（主题色边框占位） | `grep -A10 '.filter-item.is-active' <文件>` | `.tabs-filter .filter-item.is-active { border: 1px solid var(--color-primary); }` |
| S62 | `.tabs` 溢出箭头 | 使用自行绘制 path 或非标准图标 | 必须引用 `#icon-chevron-right` / `#icon-chevron-left` | `grep -n 'tabs-arrow' <文件>` 检查是否含标准 chevron 图标 | 使用 `<svg class="icon"><use href="#icon-chevron-right"></use></svg>`，禁止自行绘制 path |

---

## 11. 系统级页签类 (S63-S65)

> 对应 [tabs.md 系统级页签](./components/tabs.md) — 由 `common.js` 的 `renderTabs` 统一管理

| # | 组件位置 | 错误值 / 错误现象 | 正确值 | 快速定位命令 | 修复CSS |
|---|---------|------------------|--------|------------|--------|
| S63 | `.tabs-nav` 容器内边距 | 有非0内边距（页签未与卡片左对齐） | `padding: 0`（直接与下方 `.page-card` 左对齐） | `awk '/\.tabs-nav[[:space:]]*\{/{in=1} in&&/padding[[:space:]]*:[[:space:]]*[1-9]/{print NR": "$0} in&&/\}/{in=0}' <文件>` | `.tabs-nav { padding: 0; }` |
| S64 | 有页签时 `.page-card` 左上角圆角 | 缺少 `.has-tabs` 规则（卡片左上角圆角不为0） | `border-top-left-radius: 0`（有页签时与页签无缝衔接） | `grep -nE 'has-tabs.*page-card.*border-top-left-radius:\s*0' <文件>` | `.main-content.has-tabs .page-card { border-top-left-radius: 0; }` |
| S65 | 页签关闭图标显示逻辑 | 关闭图标始终显示或始终不显示 | 1个页签不显示关闭图标，≥2个才显示 | `grep -cE 'showClose.*openTabs\.length.*>=.*2\|openTabs\.length.*>=.*2.*showClose' <文件>`（仅 common.js 检测） | 在 `renderTabs` 函数中添加: `var showClose = openTabs.length >= 2;` 仅当 `showClose` 为 true 时渲染关闭图标 |

---

## 12. 外部原型污染清洗类 (S66-S69)

> 对应 [external-html-workflow.md](./external-html-workflow.md) — 外部 HTML 原型（独立 .html / 已转 .js 带污染）→ 规范 SPA 页面清洗流程
>
> **适用场景**：外部原型导入时识别并清洗内联 style、硬编码颜色、非标准圆角三大污染源
>
> **检测工具**：`node scripts/validate-design.mjs <文件>` 的 E6 + `node scripts/style-scan.mjs <文件>` 的 S39/S40 检测项
>
> **自动清洗工具**：`node scripts/quick-fix.mjs pollution <文件>`（值级映射，S67 适用）

| # | 组件位置 | 错误值 / 错误现象 | 正确值 | 快速定位命令 | 修复CSS/HTML |
|---|---------|------------------|--------|------------|--------|
| S66 | HTML 标签内联 style | `style="text-align:center;padding:32px;color:#7C8493"` 等任意内联样式 | 提取为语义化 class + CSS 变量（禁止保留 `style="..."`） | `awk '/<!-- JMBOS-SVG-SPRITE -->/{in=1;next} /<!-- \/JMBOS-SVG-SPRITE -->/{in=0;next} in{next} {line=$0; while(match(line,/style="[^"]*"/)){print NR": "substr(line,RSTART,RLENGTH); line=substr(line,RSTART+RLENGTH)}}' <文件>` | 按语义命名 class（如 `.empty-state`），将 style 内容移入对应页面 .html 的 `<style>` 块，硬编码值按 S40 映射为 design-tokens 变量；业务交互逻辑归入 `js/pages/D-XXX_{页面功能名称}.js` |
| S67 | CSS/内联 style 中硬编码颜色批量清洗（可选） | `color: #3685F2` / `background: #FFFFFF` / `border-color: #D2D7E1` 等直接写死（含大小写混合） | `var(--color-primary)` / `var(--color-bg-card)` / `var(--color-bg-border)` 等 CSS 变量（按上下文区分） | `node scripts/quick-fix.mjs pollution <文件>`（自动映射，含上下文敏感映射 #FFFFFF/#D2D7E1） | **var() 转换为可选优化**：S40 值白名单模式下色值正确即 PASS。本命令适用于需要主题切换支持的场景；映射表见 [external-html-workflow.md §2.2](./external-html-workflow.md#22-自动映射规则) |
| S68 | 非标准圆角值（含内联 style 内） | `border-radius: 1px/3px/5px/6px/10px` 等非规范值 | `0/2px/4px/8px/12px/16px` 或 `var(--radius-r1~r5)`（取最近规范值） | `grep -oE 'border-radius:\s*[0-9]+px' <文件> \| grep -vE '(0\|2\|4\|8\|12\|16)px'` | 手动确认最近规范值（不自动改，避免破坏设计意图）：1px→2px(var(--radius-r1))、3px→2px、5px→4px(var(--radius-r2))、6px→8px(var(--radius-r3))、10px→8px |
| S69 | JS 模板字符串内嵌 HTML 结构 | `var html = \`<div>...\`` / `return \`<table>...\`` / `innerHTML = \`<div>...\``（HTML/CSS 藏在 JS 函数中，style-scan 无法扫描，AI 实现需大量读 JS） | 提取为独立 .html 文件（HTML/CSS 与 JS 分离） | `node scripts/style-scan.mjs --quiet <文件> 2>&1 \| grep S69` | `node scripts/quick-fix.mjs flatten <文件>` 自动提取 JS 模板字符串中的 HTML/CSS 为 `.flattened.html` 文件，再走标准清洗流程（pollution → style-scan → 结构性清洗） |

**清洗流程**（详见 [external-html-workflow.md](./external-html-workflow.md)）：
0. **flatten 预处理（S69 触发时）**：`node scripts/quick-fix.mjs flatten <文件>` → 提取 JS 模板字符串中的 HTML/CSS 为 `.flattened.html`，后续步骤对 `.flattened.html` 执行
1. **检测**：`node scripts/validate-design.mjs <文件>` → E6 报告内联 style；`node scripts/style-scan.mjs <文件>` → S39/S40 报告污染清单
2. **值级自动清洗（可选）**：`node scripts/quick-fix.mjs pollution <文件>` → S67 自动映射硬编码颜色为 var()，S68 报告非标准圆角（手动改）。**注**：S40 值白名单模式下，色值匹配 design-tokens 色板即 PASS，var() 转换非必须
3. **结构性清洗**：S66 内联 style 提取为 class（手动，需语义判断）
4. **重验**：`node scripts/validate-design.mjs <文件>` → E6 PASS；`node scripts/style-scan.mjs <文件>` → S39/S40 PASS

**判定原则**：
- 内联 style 是外部原型导入主要污染源，必须 100% 提取为 class
- 硬编码颜色：色值在 design-tokens 色板中 → 合规（var() 可选）；不在色板 → 必须修正
- 非标准圆角不自动改（有歧义，需视觉判断最近规范值）

---

## 附录 B：记忆口诀汇总

| 口诀 | 含义 | 覆盖项 |
|------|------|--------|
| **导航二十排四五余十六** | 导航图标20px / 排序箭头底4px高5px / 其余默认16px | S05, S11, S25 |
| **侧边图标主文本** | 侧边菜单图标用 `#141b24` 不是 `#7C8493` | S06, S07 |
| **查询标签七十二** | 查询 label 宽度固定72px | S27 |
| **操作列纯文字零间距** | 操作列纯文字 + padding:0 + gap:12px | S20, S23, S24 |
| **Hover只变不加底** | 操作列hover仅变色不添加背景 | S21 |
| **Logo品牌变量色** | Logo禁止硬编码 `#0C328C` | S34 |

---

## 与 implementation-guide.md 检查项的映射关系

> 每条 S## 修复项已在行内通过「修复CSS/HTML」列与对应 implementation-guide.md 检查项 / Anti-pattern 编号 / validate 检测项建立交叉引用。
>
> 本表不再单独维护映射清单，避免与行内引用重复。如需反向查询「某个 implementation-guide.md 检查项对应哪个 S## 修复项」，请在本文档内搜索对应检查项编号（如搜索 `C19` 可定位到 S06 侧边菜单图标颜色）。
