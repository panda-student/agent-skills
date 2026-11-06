# 卡片组件 Cards

> 版本: v5.0 | 来源: components.md | 最后更新: 2026-08-07

> 📌 **重要提示**: 本文档中的所有 CSS 变量（如 `var(--color-bg-card)`、`var(--shadow-s1)` 等）均定义在 `design-tokens.css` 中，使用时需确保正确引入该文件。

## 卡片的两种使用场景（⭐ v5.0 核心规则）

JMBOS 设计系统中，卡片分为两类，**样式规则不同，禁止混用**：

| 场景 | 类名 | 阴影 | 边框 | 用途 |
|------|------|------|------|------|
| **内容区大卡片（容器）** | `.page-card` | ❌ 无 | ❌ 无 | 列表页/表单页/详情页/抽屉详情/弹窗表单等内容区主容器 |
| **内部子卡片（信息分组）** | `.card` | ✅ S1（悬停 S2） | ❌ 无 | 大卡片内部的信息分组区块、特性模块 |

> **判定原则**：该卡片是否是页面/抽屉/弹窗的"最外层内容容器"？是→用 `.page-card`（无阴影无边框）；否（嵌套在大卡片内部）→用 `.card`（有阴影无边框）。

---

## 场景一：内容区大卡片（容器） — 无阴影无边框

**用途**：作为列表页/表单页/详情页/抽屉详情/弹窗表单等内容区的主容器，撑满 `main-content` 高度。

**统一类名**：`.page-card`

> ⚠️ **类名统一**：禁止使用 `.content-card` / `.detail-card` / `.panel-card` 等变体。所有"内容区大卡片"场景统一使用 `.page-card`（已在 `common.css` 全局定义）。

```css
.page-card {
  background-color: var(--color-bg-card);    /* #FFFFFF 白色背景 */
  border: none;                              /* ⚠️ 禁止使用边框 */
  border-radius: var(--radius-r2);           /* 4px (R2) */
  box-shadow: none;                         /* ⚠️ 禁止使用阴影 */
  /* padding 由具体页面场景定义（见下表） */
}
```

**关键规则**：
- ❌ 禁止加 `box-shadow`（任何层级，S1/S2/S3 均不可）
- ❌ 禁止加 `border`（任何颜色/粗细均不可）
- ❌ 禁止加 `margin`（任何外边距均不可，`margin: 0` 除外；外边距会破坏 flex 高度链，导致内容区无法撑满 main-content）
- ✅ 仅靠白色背景 `#FFFFFF` + 页面灰底 `#EBF1F6` 的色差体现层次
- ✅ 撑满 `main-content` 高度，作为 flex 容器承载子内容

**⭐ 内容包裹规则（v5.1 核心规则）**：

页面所有头部内容（页面标题、描述、返回按钮、操作按钮组等）**必须作为 `.page-card` 的第一个子元素，包裹在卡片内部**，禁止写在卡片外面。

```
✅ 正确结构                          ❌ 错误结构
┌─ .main-content ─────────┐         ┌─ .main-content ─────────┐
│ ┌─ .page-card ────────┐ │         │ 页面标题（在卡片外❌） │
│ │ 页面标题栏          │ │         │ ┌─ .page-card ────────┐ │
│ │ 描述文字（可选）     │ │         │ │ 查询栏/表格/表单    │ │
│ │ 返回按钮（可选）     │ │         │ └─────────────────────┘ │
│ │ 查询栏/表格/表单     │ │         └─────────────────────────┘
│ └─────────────────────┘ │
└─────────────────────────┘
```

**必须包裹在 `.page-card` 内部的元素**：
| 元素 | 类名 | 说明 |
|------|------|------|
| 页面标题栏 | `.page-title-bar` | 包含返回按钮、页面标题、操作按钮组 |
| 页面标题 | `.page-title` | 14px 字重600 |
| 页面描述 | `.page-desc` | 标题下方的说明文字（可选） |
| 返回按钮 | `.back-btn` | 详情页/表单页的返回入口（可选） |
| 操作按钮组 | `.action-bar` | 新增/删除/导出等（可选） |
| 查询栏 | `.query-bar` | 列表页的查询条件区 |
| 数据表格 | `.data-table` | 列表页的数据展示区 |
| 分页控件 | `.pagination-wrapper` | 列表页的底部翻页区 |
| 表单区块 | `.form-body` / `.form-section` | 表单页的输入区 |
| 详情区块 | `.detail-section` | 详情页的字段展示区 |

> ⚠️ **判定原则**：凡是在 `main-content` 内部出现的页面级内容元素，都必须包在 `.page-card` 内。只有 `.page-card` 本身是 `main-content` 的直接子元素，其他内容都是 `.page-card` 的后代元素。

**HTML 结构示例**：

```html
<!-- ✅ 正确：所有内容都包在 .page-card 内 -->
<main class="main-content">
  <div class="page-card">
    <div class="page-title-bar">            <!-- 标题栏在卡片内 -->
      <button class="back-btn">返回</button>
      <h1 class="page-title">用户详情</h1>
    </div>
    <div class="page-desc">用户基本信息与权限配置</div>  <!-- 描述在卡片内 -->
    <div class="detail-section">...</div>   <!-- 内容在卡片内 -->
  </div>
</main>

<!-- ❌ 错误：标题栏写在了 .page-card 外面 -->
<main class="main-content">
  <div class="page-title-bar">              <!-- 违规：在卡片外 -->
    <h1 class="page-title">用户详情</h1>
  </div>
  <div class="page-card">
    <div class="detail-section">...</div>
  </div>
</main>
```

**各场景应用**：

| 场景 | `.page-card` 内部结构 | 内边距 |
|------|----------------------|--------|
| 列表页 | 查询栏 + 操作按钮组 + 表格 + 分页 | 由内部子模块各自定义（`.page-card` 本身无 padding） |
| 表单页 | 页面标题栏 + 表单区块 | 标题栏 padding 自定义，表单区 padding 20px |
| 详情页 | 页面标题栏 + 详情区块 | padding: var(--spacing-lg)（20px） |
| 抽屉详情 | 抽屉内容区即大卡片 | padding 由抽屉规范定义 |
| 弹窗表单 | 弹窗 `.modal` 本体即大卡片 | 弹窗已有 `box-shadow: var(--shadow-modal)`，内部不再叠加阴影 |

> ⚠️ **抽屉/弹窗的特殊说明**：抽屉与弹窗本体已通过 `box-shadow` 体现悬浮层次，其**内部内容区不得再嵌套带阴影的"大卡片"容器**，否则会产生阴影叠加的视觉污染。内部仅可使用 `.card`（子卡片）做信息分组。

---

## 场景二：内部子卡片（信息分组） — 有阴影无边框

**用途**：大卡片（`.page-card`）内部的信息分组区块，需要通过阴影体现层次感与可点击性。

**类名**：`.card`

```css
.card {
  background-color: var(--color-bg-card);    /* #FFFFFF */
  border: none;                              /* ⚠️ 禁止使用边框 */
  border-radius: var(--radius-r2);           /* 4px (R2) */
  box-shadow: var(--shadow-s1);              /* S1: 0 1px 5px rgba(20,27,36,0.10) */
  padding: var(--spacing-md);                /* 12px */
  transition: box-shadow var(--transition-fast);  /* 150ms ease-in-out */
}

/* 悬停状态 - 升级阴影层级 */
.card:hover {
  box-shadow: var(--shadow-s2);              /* S2: 0 6px 18px rgba(20,27,36,0.14) */
}
```

**关键规则**：
- ✅ 默认 S1 阴影，悬停升级到 S2
- ❌ 禁止使用边框
- ⚠️ **仅可在 `.page-card` 内部使用**，不可作为页面主容器
- ⚠️ 不可嵌套在 `.modal` / `.drawer` 内部作为"内容区容器"（这些容器已有阴影）

---

## 规范速查表

### 内容区大卡片（`.page-card`）

| 属性 | 值 | 来源 |
|------|---|------|
| 背景 | `#FFFFFF` | --color-bg-card |
| 边框 | **无**（禁止使用） | - |
| 圆角 | `4px` (R2) | --radius-r2 |
| 阴影 | **无**（禁止使用） | - |
| 内边距 | 由页面场景定义 | - |

### 内部子卡片（`.card`）

| 属性 | 值 | 来源 |
|------|---|------|
| 背景 | `#FFFFFF` | --color-bg-card |
| 边框 | **无**（禁止使用） | - |
| 圆角 | `4px` (R2) | --radius-r2 |
| 内边距 | `12px` | --spacing-md |
| 默认阴影 | S1 | --shadow-s1 |
| 悬停阴影 | S2 | --shadow-s2 |

---

## 常见错误（Anti-patterns）

| # | 错误现象 | 正确做法 |
|---|---------|---------|
| C1 | 内容区大卡片加了 `box-shadow: var(--shadow-s1)` | 移除阴影，大卡片仅靠背景色差体现层次 |
| C2 | 内容区大卡片加了 `border: 1px solid #D2D7E1` | 移除边框，大卡片禁止使用任何边框 |
| C3 | 使用 `.content-card` / `.detail-card` 等自定义类名 | 统一使用 `.page-card` |
| C4 | 弹窗内部再嵌套一个带阴影的"卡片容器" | 弹窗本体已是容器，内部直接放表单内容或 `.card` 子卡片 |
| C5 | 内部子卡片 `.card` 缺少 `box-shadow` | 补上 `var(--shadow-s1)`，子卡片必须有阴影体现层次 |
| C6 | 内部子卡片 `.card` 加了边框 | 移除边框，子卡片仅用阴影不用边框 |
| C7 | 页面标题栏（.page-title-bar）写在了 .page-card 外面 | 标题栏必须作为 .page-card 的第一个子元素，包裹在卡片内 |
| C8 | 页面描述（.page-desc）写在 .page-card 外面 | 描述必须包在 .page-card 内，紧跟标题栏之后 |

---

## 与其他组件的关系

- **弹窗 `.modal`**：弹窗本体使用 `box-shadow: var(--shadow-modal)`（S3 级别），内部内容区按大卡片规则（无阴影无边框），如需信息分组用 `.card` 子卡片
- **抽屉 `.drawer`**：抽屉本体使用 `box-shadow`，内部内容区按大卡片规则（无阴影无边框）
- **表格 `.data-table`**：表格直接放在 `.page-card` 内部，表格本身不需要额外的卡片容器包裹
- **查询栏 `.query-bar`**：查询栏直接放在 `.page-card` 内部，通过 `border-bottom` 与下方内容分隔
