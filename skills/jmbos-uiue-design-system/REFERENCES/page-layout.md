# 页面布局规范 (Page Layout)

> JMBOS UIUE Design System 页面布局规范文档
>
> 📌 **重要**: 所有数值必须引用 [design-tokens.css](../ASSETS/design-tokens.css) 中的 CSS 变量
>
> 🔗 **相关文档**：
> - 页面类型详解 → [page-types.md](./page-types.md)
> - 必备交互 → [page-interactions.md](./page-interactions.md)
> - 索引入口 → [SKILL.md](../SKILL.md)
> - 组件级规范 → [components/](./components/)

## 目录

1. [标准 SaaS 后台布局](#1-标准-saas-后台布局--v18-最终稳定版)
2. [布局防错指南](#2-布局防错指南-layout-anti-patterns-)
3. [标准化模板库](#3-标准化模板库-standard-templates-)
4. [质量检查清单](#4-质量检查清单-qa-checklist-)

---

## 1. 标准 SaaS 后台布局 ⚠️ [v1.8 最终稳定版]

每个生成的页面都应该使用以下**经过验证的稳定布局方案**。

### 核心原则（重要！）

✅ **使用 `position: fixed` 定位顶导和侧边栏**（业界标准方案）
✅ **主内容区用 `margin-top/margin-left` 偏移**避开固定元素
❌ **不要使用 `transform: scale()`**（会导致布局不稳定）
❌ **不要在 body/html 上设置 `overflow-x: hidden`**（会裁剪表格内容）
✅ **使用 CSS `zoom` 属性实现缩放适配**（比 transform 更稳定）

### 布局结构图

```
┌─────────────────────────────────────────────┐
│              顶部导航栏 (42px)               │ ← position: fixed, top:0
│              品牌色 #0C328C                  │
├───────────┬─────────────────────────────────┤
│           │                                 │
│  侧边栏    │         主内容区域              │ ← margin-top:42px; margin-left:180px
│  (180px)  │   width: auto                   │
│  fixed    │   overflow-x: hidden            │
│  top:42px │                                 │
│           │                                 │
│           │                                 │
└───────────┴─────────────────────────────────┘
```

### 关键尺寸参数

| 元素 | 尺寸 | 定位方式 | CSS属性 |
|------|------|---------|---------|
| **顶部导航** | 高度 `42px` | `position: fixed; top: 0` | 背景色: `#0C328C` |
| **侧边栏** | 宽度 `180px` | `position: fixed; top: 42px; left: 0` | 背景色: `#FFFFFF` |
| **主内容区** | 自适应宽度 | `margin-top: 42px; margin-left: 180px; width: auto` | 背景色: `#EBF1F6` |

### 核心CSS实现

```css
/* ===== 全局重置 ===== */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;  /* ⭐ 全局border-box */
}

/* ===== 主内容区域 ===== */
.main-content {
  margin-top: 42px;
  margin-left: 180px;
  padding: var(--spacing-base);                /* 16px */
  background-color: var(--color-bg-page);       /* #EBF1F6 */
  min-height: calc(100vh - 42px);
  width: auto;                                  /* ⭐ 不使用calc(100vw...) */
  overflow-x: hidden;                           /* ⭐ 防止主内容区水平滚动 */
  box-sizing: border-box;
}
```

### 侧边栏菜单高亮规范 ⭐

> **规则**：当3级菜单（叶子节点）被选中时，其父级2级菜单需高亮显示，形成层级关系视觉引导。

| 状态 | 类名 | 样式 | 说明 |
|------|------|------|------|
| **3级菜单选中** | `.submenu-item.active` | 背景色 `#DEEDFF`，文字色 `#3685F2` | 当前页面所在菜单 |
| **2级菜单高亮（子级选中）** | `.sidebar-menu-item.has-active` | 文字色 `#3685F2`，字重不变（400） | 其下3级菜单有选中项 |
| **2级菜单默认** | `.sidebar-menu-item` | 文字色 `#141b24`，字重 `400` | 无子级选中 |
| **2级菜单展开状态hover** | `.sidebar-menu-item.expanded:hover` | 背景色 `#EDF3FA`，文字不变色 | 展开状态也支持hover背景色，禁止设置`background-color:transparent`覆盖hover |

```css
/* ⭐ 2级菜单高亮：当其下3级菜单被选中时 */
.sidebar-menu-item.has-active {
  color: var(--color-primary);                      /* 文字变主题蓝 */
}
.sidebar-menu-item.has-active .sidebar-menu-icon { color: #3685F2; }
```

```javascript
// 切换页面时设置 has-active
function switchPage(pageId) {
  // 清除所有 active 和 has-active
  document.querySelectorAll('.submenu-item.active').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.sidebar-menu-item.has-active').forEach(item => item.classList.remove('has-active'));
  // 设置当前3级菜单 active
  var activeItem = document.querySelector('.submenu-item[data-page="' + pageId + '"]');
  if (activeItem) {
    activeItem.classList.add('active');
    // ⭐ 设置父级2级菜单 has-active 高亮
    var parentMenu = activeItem.closest('li').querySelector('.sidebar-menu-item');
    if (parentMenu) parentMenu.classList.add('has-active');
  }
}
```

---

## 2. 布局防错指南 (Layout Anti-Patterns) ⭐

> **重要说明**：本章专门解决页面生成过程中常见的布局错误问题。
> **必须严格遵守本章规范，否则会导致表格溢出、内容截断、响应式失效等问题！**

### 2.1 表格布局黄金法则 🎯

#### ✅ 法则一：列宽使用固定 px（配合 table-layout: fixed）

> **完整实现** → [tables.md §列宽与布局策略](./components/tables.md#列宽与布局策略)

**核心原则**：列宽使用**固定 px**，配合 `table-layout: fixed`，确保列宽不受屏幕宽度影响。百分比列宽在宽屏下会被等比拉伸，导致内容稀疏、排版失控。

**❌ 错误示例（混用 px 和 %）**:
```html
<thead>
  <tr>
    <th style="width: 40px;">复选框</th>
    <th style="width: 8%;">商品编码</th>      <!-- ❌ 百分比会随屏幕拉伸 -->
    <th style="width: 15%;">商品名称</th>     <!-- ❌ 百分比会随屏幕拉伸 -->
    <th style="width: 120px;">操作</th>
  </tr>
</thead>
```

**✅ 正确示例（纯固定 px）**:
```html
<thead>
  <tr>
    <th style="width:40px;text-align:center">复选框</th>
    <th style="width:120px">商品编码</th>
    <th style="min-width:150px">商品名称</th>   <!-- 主要信息列用 min-width -->
    <th style="width:100px">分类</th>
    <th style="width:100px">品牌</th>
    <th style="width:140px">规格型号</th>
    <th style="width:120px;text-align:right">单价</th>
    <th style="width:80px;text-align:right">库存</th>
    <th style="width:90px;text-align:center">状态</th>
    <th style="width:140px">创建时间</th>
    <th style="width:140px">操作</th>
  </tr>
</thead>
```

> ⚠️ **注意**：所有列宽之和应等于表格总宽度，超出容器的部分由 `.table-container` 的 `overflow-x: auto` 处理（横向滚动）。

---

#### ✅ 法则二：操作列必须符合规范

> **完整实现** → [tables.md §类型3：带操作列表格](./components/tables.md#类型3带操作列表格-⭐⭐⭐-最常用)

操作列规范由 tables.md 统一维护，页面级只需关注以下要点：
- 操作按钮**左对齐**（`flex-start`），间距 `12px`，内边距 `0`
- 列宽 `min-width: 120px` + `max-width: 160px`
- 按钮颜色统一主题蓝 `#3685F2`（三态交互），禁止使用危险红
- 操作总数 ≤ 3 全部展示；> 3 时前 2 个文字按钮 + "更多"图标下拉

---

#### ✅ 法则三：容器必须有宽度约束

> **完整实现** → [tables.md §类型1：基础默认表格](./components/tables.md#类型1基础默认表格)

表格容器规范由 tables.md 统一维护，页面级只需关注以下要点：
- 容器 `width: 100%` + `max-width: 100%`
- 滚动行为 `overflow-x: auto` + `overflow-y: visible`
- 布局模式 `table-layout: fixed`（配合固定 px 列宽）

---

#### ✅ 法则四：单元格必须防溢出

> **完整实现** → [tables.md §类型1：基础默认表格 CSS](./components/tables.md#类型1基础默认表格)

单元格防溢出规范由 tables.md 统一维护，页面级只需关注以下要点：
- 表头/数据单元格均需 `white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis`
- 单列最大宽度 `max-width: 540px`，超长文本自动截断显示省略号，鼠标进入显示全部文字

---

### 2.2 列宽分配最佳实践 📊

列宽分配最佳实践详见 [tables.md](components/tables.md)

---

### 2.3 响应式断点策略 📱

> 画布基准：`--canvas-width: 1280px`（见 [design-tokens.css §6.4](../ASSETS/design-tokens.css)），以下缩放公式均以此为基准计算。

#### 三段式断点方案

缩放逻辑由 `js/common.js` 的 `applyResponsiveZoom` 统一处理，MPA 页面无需额外配置。

**✅ 断点说明**:

| 断点范围 | Zoom值 | 表格处理 | 适用设备 |
|---------|--------|---------|---------|
| **< 1024px** | 75%-85% | 允许横向滚动 | iPad、小平板 |
| **1024-1536px** | 85%-120% | 无滚动条 | 笔记本、标准显示器 |
| **> 1536px** | 120%（锁定）| 填满屏幕 | 大显示器、4K屏 |

---

### 2.4 zoom 缩放与高度计算 ⭐

> **强制规则**：`100vh` 部分必须除以 `--zoom-value` 抵消放大，`px` 偏移量不除（zoom 自动放大为对应元素的渲染高度）。

#### 原理

body 的 `zoom` 属性会放大所有元素的渲染尺寸。当 `zoom=1.2` 时：
- 元素 `height: 100px` → 实际渲染 `120px`
- 视口 `100vh` 在布局时 = 视口高度，渲染时被 zoom 放大 → 需要 **除以 zoom-value** 抵消
- 固定高度 `42px`（如顶导）渲染时 = `42px * zoom` → **不需要除以 zoom-value**，zoom 会自动放大

**关键区别**：`vh` 单位需要除以 zoom-value，`px` 单位不需要。

```css
.main-wrapper {
  /* ❌ 错误：100vh 被放大但 42px 也被放大，双重放大导致超出视口 */
  height: calc(100vh - 42px);

  /* ❌ 错误：42px 也除了 zoom-value，导致 margin-top 渲染值 ≠ 顶导渲染高度，出现重叠 */
  margin-top: calc(42px / var(--zoom-value, 1));

  /* ✅ 正确：100vh 除以 zoom-value，42px 不除 */
  margin-top: 42px;
  height: calc(100vh / var(--zoom-value, 1) - 42px);
}
```

#### 四条强制规则

1. **`:root` 必须声明 `--zoom-value: 1` 默认值**（`applyResponsiveZoom` 会动态更新此变量）
2. **`body` 必须设置 `overflow: hidden`**（防止 zoom 放大后出现 body 滚动条）
3. **`100vh` 必须除以 `var(--zoom-value, 1)`，`px` 偏移量不除**（margin-top: 42px → 渲染 42*zoom = 顶导渲染高度）
4. **flex 子元素（`flex: 1`）必须设置 `min-height: 0`**（防止内容撑高父容器，破坏高度链）

#### 标准实现（common.css 模板源码）

```css
:root {
  --zoom-value: 1;  /* 规则1：默认值声明 */
}

body {
  overflow: hidden;  /* 规则2：禁止 body 滚动 */
}

.main-wrapper {
  margin-top: 42px;                                            /* 规则3：px 不除 zoom，渲染 = 42*zoom = 顶导渲染高度 */
  height: calc(100vh / var(--zoom-value, 1) - 42px - 1px);    /* 规则3：100vh 除以 zoom 抵消放大，42px 不除，-1px 容差防止放大后底部留白被截断 */
  overflow: hidden;
}

.main-content {
  flex: 1;
  min-height: 0;    /* 规则4：flex 子元素 min-height:0 */
  overflow: hidden;
}

#page-content {
  flex: 1;
  min-height: 0;    /* 规则4：flex 子元素 min-height:0 */
  overflow: hidden;
}
```

> **检测**：`style-scan.mjs` S54（zoom 高度计算）+ S55（flex 子元素 min-height:0）会自动检测以上规则。

---

### 2.5 常见CSS陷阱及解决方案 🚨

#### 陷阱1：box-sizing未设置

**症状**: padding撑开容器导致宽度计算错误

**解决方案**:
```css
* {
  box-sizing: border-box;  /* 全局设置：padding计入宽度内 */
}
```

---

#### 陷阱2：使用calc(100vw - xxx)

**症状**: 在不同浏览器下表现不一致，容易超出屏幕

**❌ 错误写法**:
```css
.main-content {
  width: calc(100vw - 180px);  /* 不稳定！*/
}
```

**✅ 正确写法**:
```css
.main-content {
  margin-left: 180px;       /* 使用margin偏移 */
  width: auto;              /* 让浏览器自动计算 */
  box-sizing: border-box;
}
```

---

#### 陷阱3-5：其他CSS陷阱

> **transform: scale() / overflow-x: hidden 在 body/html / table-layout: fixed 配合百分比宽度** — 详见 [implementation-guide.md §2 Anti-patterns](./implementation-guide.md#2-常见错误模式-anti-patterns)。

---

## 3. 标准化模板库 (Standard Templates) 📚

> **重要**：以下模板已经过验证，**可直接使用且不会出现布局错误**。
> 生成新页面时，**强烈建议基于这些模板进行修改**，而非从零开始编写！

### 3.1 列表页完整模板（已验证无错误）✅

**文件位置**: [pages/list.html](../ASSETS/page-shells/pages/list.html) + [js/pages/list.js](../ASSETS/page-shells/js/pages/list.js)

**HTML结构骨架**:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[页面标题] - JOMOO九牧</title>
  <style>
    /* CSS样式见下方 */
  </style>
</head>
<body>
  <!-- 1. 顶部导航栏 -->
  <header class="top-nav">...</header>

  <!-- 2. 左侧菜单 -->
  <aside class="sidebar">...</aside>

  <!-- 3. 主内容区域 -->
  <main class="main-content">
    <!-- 3.1 标签页（可选，规范见 components/tabs.md）-->
    <!-- 标准样式 .tabs：卡片内视图切换 / 页签样式 .tabs-nav：.page-card 外部顶部标签目录 -->
    <div class="tabs">...</div>

    <!-- 3.2 内容卡片 -->
    <div class="page-card">
      <!-- 3.2.1 操作按钮区域 -->
      <div class="action-bar">...</div>

      <!-- 3.2.2 查询栏（可选）-->
      <div class="search-bar">...</div>

      <!-- 3.2.3 数据表格容器 ⭐关键！-->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <!-- 必须遵循2.2节的列宽分配规范 -->
          </tr>
        </thead>
        <tbody>
          <!-- 数据行 -->
        </tbody>
      </table>
    </div>

    <!-- 3.2.4 分页组件（固定底部，不随表格滚动）-->
    <div class="pagination-wrapper">...</div>
    </div>
  </main>

  <!-- 4. 弹窗（可选）-->
  <div class="modal-overlay" id="xxxModal">...</div>

  <script>
    // JS逻辑
  </script>
</body>
</html>
```

**完整代码请查看**: [pages/list.html](../ASSETS/page-shells/pages/list.html) + [js/pages/list.js](../ASSETS/page-shells/js/pages/list.js)

### 3.2 其他页面模板

| 页面类型 | 文件位置 | 验证状态 |
|---------|---------|---------|
| **列表页** | [pages/list.html](../ASSETS/page-shells/pages/list.html) + [js/pages/list.js](../ASSETS/page-shells/js/pages/list.js) | ✅ 已验证 |
| **详情页** | [pages/detail.html](../ASSETS/page-shells/pages/detail.html) + [js/pages/detail.js](../ASSETS/page-shells/js/pages/detail.js) | ✅ 已验证 |
| **表单页** | [pages/form.html](../ASSETS/page-shells/pages/form.html) + [js/pages/form.js](../ASSETS/page-shells/js/pages/form.js) | ✅ 已验证 |
| **弹窗** | [pages/modal.html](../ASSETS/page-shells/pages/modal.html) + [js/pages/modal.js](../ASSETS/page-shells/js/pages/modal.js) | ✅ 已验证 |

---

## 4. 质量检查清单 (QA Checklist) ✅

> **已由自动化脚本统一覆盖**，详见 [SKILL.md §7 自检与矫正](../SKILL.md#7-自检与矫正)。
>
> - **资源层** → `validate-design.mjs`（E1-E6）
> - **样式层** → `style-scan.mjs`（S01-S62，含选项卡/标签页 S58-S62）
> - **结构层** → `layout-scan.mjs`（L1-L12）
> - **交互层** → `interaction-scan.mjs`（IX1-IX12）
>
> 样式数值对照（颜色/字号/圆角/间距）见 [SKILL.md §6.2 关键样式值抽取清单](../SKILL.md#62-组件规范查阅强制输出证明)。
