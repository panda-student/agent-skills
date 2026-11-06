# 页面类型详解 (Page Types)

> JMBOS UIUE Design System 四种页面类型规范
>
> 📌 **重要**: 所有数值必须引用 [design-tokens.css](../ASSETS/design-tokens.css) 中的 CSS 变量
>
> 🔗 **相关文档**：
>
> * 布局基础/防错/QA → [page-layout.md](./page-layout.md)
>
> * 必备交互 → [page-interactions.md](./page-interactions.md)
>
> * 索引入口 → [SKILL.md](../SKILL.md)
>
> * 组件级规范 → [components/](./components/)

## 目录

1. [列表页 (List Page)](#1-列表页-list-page)
2. [详情页 (Detail Page)](#2-详情页-detail-page)
3. [表单页 (Form Page)](#3-表单页-form-page)
4. [弹窗/对话框 (Modal)](#4-弹窗对话框-modal)

***

## 1. 列表页 (List Page)

> 🔗 **骨架绑定**：必须以 [ASSETS/page-shells/pages/list.html](../ASSETS/page-shells/pages/list.html) + [js/pages/list.js](../ASSETS/page-shells/js/pages/list.js) 为基础复制完整结构（含 STRUCT 锚点），禁止从零写。布局结构检测：`node scripts/layout-scan.mjs <文件>`

### 标准结构

> ⚠️ **v5.1 内容包裹规则**：页面标题、操作按钮组等所有头部内容**必须包在** **`.page-card`** **内部**（作为第一个子元素），禁止写在卡片外。详见 [cards.md 内容包裹规则](./components/cards.md#-内容包裹规则v51-核心规则)。

```
┌─────────────────────────────────────────────┐
│              顶部导航栏 (42px)               │
├───────────┬─────────────────────────────────┤
│           │ ┌─ .page-card (白色) ─────────┐ │
│  侧边栏    │ │ 页面标题 + 操作按钮区域     │ │ ← 头部内容在卡片内
│  (180px)  │ ├─────────────────────────────┤ │
│           │ │ 查询栏（白色背景）           │ │
│           │ ├─────────────────────────────┤ │
│           │ │ 操作按钮组（新增/删除等）    │ │
│           │ ├─────────────────────────────┤ │
│           │ │                             │ │
│           │ │      数据表格               │ │
│           │ │                             │ │
│           │ ├─────────────────────────────┤ │
│           │ │      分页控件               │ │
│           │ └─────────────────────────────┘ │
└───────────┴─────────────────────────────────┘
```

**必需元素**:

* ✅ 页面标题（H2, 14px, 字重600）— **必须包在** **`.page-card`** **内**

* ✅ 操作按钮组（遵循[操作按钮组规范](./components/action-buttons.md)：最多6个可见，第7个起收纳至"更多操作"按钮（文字+chevron-down图标））

* ✅ **查询栏**（遵循[查询栏规范](./components/query-bar.md#查询栏-query-bar)：白色背景 + 72px标签 + 2种列数+多行扩展）

* ✅ 数据表格（遵循[表格规范](./components/tables.md#表格样式)）

* ✅ 分页控件（遵循[分页组件规范](./components/Pagination.md)：弹窗用 `.pagination-bar` / 列表页用 `.pagination-wrapper` + 条目数选择器 + 跳转页）

### 内容区范围规范 ⭐

> **效果示意**：主内容区背景色 `#EBF1F6`，内容区大卡片白色底色 + 10px 外边距 + 铺满页面高度
>
> ⚠️ **v5.0 核心规则**：内容区大卡片（`.page-card`）**无阴影、无边框**，仅靠白色背景与页面灰底的色差体现层次。详见 [cards.md 场景一](./components/cards.md#场景一内容区大卡片容器--无阴影无边框)。

```
┌─────────────────────────────────────────────┐
│              主内容区 (#EBF1F6)              │
│  ┌─────────────────────────────────────┐    │
│  │  内容区大卡片 .page-card            │    │ ← background: #FFFFFF
│  │  无阴影、无边框                     │    │   box-shadow: none
│  │  border: none                       │    │
│  │  页面标题 + 操作按钮区域（头部）    │    │ ← v5.1: 头部内容在卡片内
│  │  ┌─────────────────────────────┐   │    │
│  │  │ 查询栏                      │   │    │
│  │  ├─────────────────────────────┤   │    │
│  │  │ 操作按钮组                  │   │    │
│  │  ├─────────────────────────────┤   │    │
│  │  │ 数据表格                    │   │    │
│  │  ├─────────────────────────────┤   │    │
│  │  │ 分页控件                    │   │    │
│  │  └─────────────────────────────┘   │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

CSS规范详见 [cards.md](components/cards.md) 场景一（无阴影无边框）

**关键要点**:

| 属性      | 值              | 说明                                |
| ------- | -------------- | --------------------------------- |
| **外边距** | **无**（禁止使用）    | ⚠️ 内容区大卡片撑满 main-content，禁止加任何外边距 |
| **背景色** | `#FFFFFF` (白色) | 与页面背景 `#EBF1F6` 形成层次对比            |
| **圆角**  | `4px` (R2)     | 统一卡片圆角规范                          |
| **边框**  | **无**（禁止使用）    | ⚠️ 内容区大卡片禁止加任何边框                  |
| **阴影**  | **无**（禁止使用）    | ⚠️ 内容区大卡片禁止加任何阴影（S1/S2/S3 均不可）    |

> 📌 **类名统一说明**：旧版本的 `.content-card` 已废弃，所有"内容区大卡片"场景统一使用 `.page-card`（已在 `common.css` 全局定义，详见 [cards.md](./components/cards.md)）。

### 分页固定底部规范 ⭐ v5.1.3

> ⭐ **核心规则**：列表页分页组件固定在容器底部，不随表格内容滚动。表格区域（`.table-container`）独立滚动，分页始终可见。
>
> **实现要点**：
> - `.page-card` 设置 `overflow: hidden`（禁止整体滚动）
> - `.table-container` 设置 `overflow-y: auto; flex: 1; min-height: 0`（表格独立滚动）
> - `.pagination-wrapper` 设置 `flex-shrink: 0`（固定底部不被压缩）
> - **无分割线**：分页组件上方不显示分割线（`border-top: none`）
>
> 分页固定底部规范详见 [Pagination.md](components/Pagination.md)

### 查询栏（⭐ v4.10.0 完整规范）

> **详细实现** → [query-bar.md §查询栏 Query Bar](./components/query-bar.md#查询栏-query-bar)
> **检查清单** → [implementation-guide.md C28-C36](../META/implementation-guide.md#phase-35-查询栏专项检查-v4100-新增--9项)

查询栏规范详见 [query-bar.md](components/query-bar.md)

**完整骨架**: [list.html](../ASSETS/page-shells/pages/list.html) + [list.js](../ASSETS/page-shells/js/pages/list.js)

### 组件查阅清单

> 📋 **列表页必读（9项）**：导航菜单 → 查询栏 → 表格 → 操作按钮组 → 按钮 → 图标 → 标签 → 分页 + 列表页参考图
>
> 👉 [完整清单及查阅指引](./components/README.md#1-列表页-list-page)

***

## 2. 详情页 (Detail Page)

> 🔗 **骨架绑定**：必须以 [ASSETS/page-shells/pages/detail.html](../ASSETS/page-shells/pages/detail.html) + [js/pages/detail.js](../ASSETS/page-shells/js/pages/detail.js) 为基础复制完整结构（含 STRUCT 锚点），禁止从零写。布局结构检测：`node scripts/layout-scan.mjs <文件>`

### 标准结构

> ⚠️ **v5.1 内容包裹规则**：返回按钮、页面标题、描述等所有头部内容**必须包在** **`.page-card`** **内部**（作为第一个子元素），禁止写在卡片外。详见 [cards.md 内容包裹规则](./components/cards.md#-内容包裹规则v51-核心规则)。

```
┌─────────────────────────────────────────────┐
│              顶部导航栏 (42px)               │
├───────────┬─────────────────────────────────┤
│           │ ┌─ .page-card (白色) ─────────┐ │
│  侧边栏    │ │ 返回按钮 + 页面标题         │ │ ← 头部内容在卡片内
│  (180px)  │ │ 页面描述（可选）            │ │
│           │ ├─────────────────────────────┤ │
│           │ │ ┌─ .detail-section ───────┐ │ │
│           │ │ │ 基本信息                │ │ │
│           │ │ │  - 字段标签 + 内容      │ │ │
│           │ │ │  - 字段标签 + 内容      │ │ │
│           │ │ ├─────────────────────────┤ │ │
│           │ │ │ 详细信息（Tab切换）       │ │ │
│           │ │ └─────────────────────────┘ │ │
│           │ └─────────────────────────────┘ │
└───────────┴─────────────────────────────────┘
```

**必需元素**:

* ✅ 返回按钮（文字链接或图标按钮）— **必须包在** **`.page-card`** **内**

* ✅ 页面标题 — **必须包在** **`.page-card`** **内**

* ✅ 信息展示区（键值对形式）

**可选元素**:

* ⚪ Tab 导航（多区块信息切换）

* ⚪ 操作按钮区（编辑、删除、导出等）

* ⚪ 关联数据列表

* ⚪ 时间线/状态流转

### 内容区范围规范 ⭐

> **效果示意**：主内容区背景色 `#EBF1F6`，详情大卡片白色底色 + 10px 外边距 + 铺满屏幕高度
>
> ⚠️ **v5.0 核心规则**：内容区大卡片（`.page-card`）**无阴影、无边框**，仅靠白色背景与页面灰底的色差体现层次。详见 [cards.md 场景一](./components/cards.md#场景一内容区大卡片容器--无阴影无边框)。
>
> ⚠️ **v5.1 内容包裹规则**：返回按钮、页面标题、描述等头部内容**必须包在** **`.page-card`** **内**（作为第一个子元素）。详见 [cards.md 内容包裹规则](./components/cards.md#-内容包裹规则v51-核心规则)。

```
┌─────────────────────────────────────────────┐
│              主内容区 (#EBF1F6)              │
│  ┌─────────────────────────────────────┐    │
│  │  内容区大卡片 .page-card            │    │ ← background: #FFFFFF
│  │  无阴影、无边框                     │    │   box-shadow: none
│  │  border: none                       │    │
│  │  返回按钮 + 页面标题（头部）        │    │ ← v5.1: 头部内容在卡片内
│  │  页面描述（可选）                    │    │
│  │  ┌─────────────────────────────┐   │    │
│  │  │ 基本信息                    │   │    │
│  │  │  - 字段标签 + 内容          │   │    │
│  │  │  - 字段标签 + 内容          │   │    │
│  │  ├─────────────────────────────┤   │    │
│  │  │ 详细信息（Tab切换）          │   │    │
│  │  └─────────────────────────────┘   │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**CSS 规范**：同列表页 `.page-card`（见上方），仅 padding 差异：详情页 `padding: var(--spacing-lg)` (20px)。详见 [cards.md](./components/cards.md)。

**完整骨架**: [detail.html](../ASSETS/page-shells/pages/detail.html) + [detail.js](../ASSETS/page-shells/js/pages/detail.js)

***

### 详情页组件样式规范 ⭐

> 以下为详情页内各组件的统一样式规范，适用于 detail.html 及所有详情类页面。

#### 页面标题 (.page-title)

| 属性      | 值                                       | 说明         |
| ------- | --------------------------------------- | ---------- |
| **字号**  | `14px`                                  | 固定值        |
| **字重**  | `600` (semibold)                        | 半粗体        |
| **颜色**  | `var(--color-text-primary)` → `#141b24` | 主文字色       |
| **分割线** | 无                                       | 标题下方不显示分割线 |

```css
.page-title {
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}
```

#### 区块标题 (.section-title / .form-section-title) — 统一规范

> **适用范围**: 详情页 `.section-title` + 表单页 `.form-section-title` 统一使用此规范

| 属性      | 值                                  | 说明               |
| ------- | ---------------------------------- | ---------------- |
| **字号**  | `13px` → `var(--font-size-base)`   | 二级标题字号           |
| **字重**  | `600` (semibold)                   | 半粗体              |
| **颜色**  | `var(--color-primary)` → `#3685F2` | **主题色统一**（非主文字色） |
| **分割线** | **无**                              | 区块标题下方不显示分割线     |

```css
/* 详情页区块标题 */
.section-title {
  font-size: var(--font-size-base);          /* 13px */
  font-weight: var(--font-weight-semibold);   /* 600 */
  color: var(--color-primary);                /* #3685F2 主题色 */
}

/* 表单页区块标题（与详情页统一）*/
.form-section-title {
  font-size: var(--font-size-base);          /* 13px */
  font-weight: var(--font-weight-semibold);   /* 600 */
  color: var(--color-primary);                /* #3685F2 主题色 */
}
```

#### 描述列表 (Detail List) — 键值对展示

> 用于详情页中字段标签与内容的键值对形式展示

| 属性                   | 值                                                                            | 说明                                            |
| -------------------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| **布局方式**             | CSS Grid                                                                     | **默认3列**（`repeat(3, 1fr)`），支持 `.cols-4` 变体为4列 |
| **行列间距**             | `20px`                                                                       | 行间距与列间距统一 20px                                |
| **Label 字号**         | `12px` → `var(--font-size-sm)`                                               | 小字号                                           |
| **Label 颜色**         | `var(--color-text-secondary)` → `#7C8493`                                    | 次要文字色                                         |
| **Label 字重**         | `400` (regular)                                                              | 常规字重（不加粗）                                     |
| **Value 字号**         | `12px` → `var(--font-size-sm)`                                               | 小字号                                           |
| **Value 颜色**         | `var(--color-text-primary)` → `#141b24`                                      | 主文字色                                          |
| **Value 字重**         | `400` (regular)                                                              | 常规字重（不加粗）                                     |
| **Label 与 Value 间距** | `4px`                                                                        | 紧贴排列                                          |
| **Label 后缀**         | 全角冒号 `：`                                                                     | 通过 `::after` 伪元素添加                            |
| **Value 溢出处理**       | **默认单行省略**（`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`） | 无需手动加 `.truncate` 类，超长文本自动截断显示省略号             |

```css
/* 描述列表网格容器 - 默认3列 */
.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);       /* ⭐ 默认3列等宽 */
  gap: 20px;                                  /* 行列间距统一 20px */
}

/* 4列布局变体（按需使用）*/
.detail-grid.cols-4 {
  grid-template-columns: repeat(4, 1fr);
}

/* 单个描述项 - label 与 value 紧贴 */
.detail-item {
  display: flex;
  flex-direction: row;                        /* 水平排列 */
  align-items: baseline;                      /* 基线对齐 */
  gap: 4px;                                   /* label 与 value 紧密间距 */
  min-width: 0;                               /* ⭐ 允许flex子项收缩 */
  overflow: hidden;                           /* ⭐ 裁剪溢出内容 */
}

.detail-label {
  font-size: var(--font-size-sm);             /* 12px */
  color: var(--color-text-secondary);          /* #7C8493 */
  font-weight: var(--font-weight-regular);     /* 400 不加粗 */
  white-space: nowrap;
  flex-shrink: 0;                             /* ⭐ label不收缩，保持自然宽度 */
}
.detail-label::after {
  content: "：";                              /* 自动添加全角冒号 */
}

.detail-value {
  font-size: var(--font-size-sm);             /* 12px */
  color: var(--color-text-primary);            /* #141b24 */
  font-weight: var(--font-weight-regular);     /* 400 不加粗 */
  flex: 1;                                    /* ⭐ 占据剩余空间 */
  min-width: 0;                               /* ⭐ 允许收缩（关键！否则省略失效）*/
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;                         /* ⭐ 单行溢出显示省略号 */
}
```

#### 标签页 / 选项卡 (Tabs) ⭐ v1.2.0

标签页/选项卡规范详见 [tabs.md](components/tabs.md)

***

### 抽屉详情（Drawer）⭐ v1.0.0 独立规范

> 详情场景的侧滑面板，从右侧滑入展示记录详情。**完整规范** → [components/drawer.md](./components/drawer.md)

| 核心规范      | 值           | 说明                          |
| --------- | ----------- | --------------------------- |
| **使用场景**  | 仅详情查看       | 禁止用于表单编辑/确认提示               |
| **默认宽度**  | `800px`     | 支持 `100vw` 全屏切换             |
| **标题区**   | 主题蓝色背景 + 反白 | 与弹窗标题区一致                    |
| **内部留白**  | `20px`      | 内容区 padding                 |
| **描述列表**  | 默认3列        | `repeat(3, 1fr)` + gap 20px |
| **底部操作栏** | 默认不提供       | 需求要求时才添加                    |

***

### 组件查阅清单

> 📋 **详情页必读（8项）**：导航菜单 → 卡片 → 按钮 → 图标 + 标签 + 描述列表/标签页/详情页参考图
>
> 👉 [完整清单及查阅指引](./components/README.md#2-详情页-detail-page)

***

## 3. 表单页 (Form Page)

> 🔗 **骨架绑定**：必须以 [ASSETS/page-shells/pages/form.html](../ASSETS/page-shells/pages/form.html) + [js/pages/form.js](../ASSETS/page-shells/js/pages/form.js) 为基础复制完整结构（含 STRUCT 锚点），禁止从零写。布局结构检测：`node scripts/layout-scan.mjs <文件>`

### 标准结构

```
┌─────────────────────────────────────────────┐
│              顶部导航栏 (42px)               │
├───────────┬─────────────────────────────────┤
│           │  页面标题                       │
│  侧边栏    │  ┌─────────────────────────┐    │
│  (180px)  │  │  表单项                  │    │
│           │  │  [标签] [输入框]         │    │
│           │  │  [标签] [下拉选择]        │    │
│           │  │  ...                     │    │
│           │  ├─────────────────────────┤    │
│           │  │  取消    提交（主按钮）   │    │
│           │  └─────────────────────────┘    │
└───────────┴─────────────────────────────────┘
```

**必需元素**:

* ✅ 表单标题

* ✅ 表单项（标签 + 输入控件）

* ✅ 操作按钮（取消 + 提交，提交用主按钮）

### 内容区范围规范 ⭐

> **效果示意**：主内容区背景色 `#EBF1F6`，表单卡片区域白色底色 + 10px 外边距 + 铺满屏幕高度

```
┌─────────────────────────────────────────────┐
│              主内容区 (#EBF1F6)              │
│  ┌─────────────────────────────────────┐    │
│  │  表单卡片 (margin: 10px)            │    │ ← background: #FFFFFF
│  │  background: #FFFFFF               │    │
│  │                                     │    │
│  │  表单标题                           │    │
│  │  ┌─────────────────────────────┐   │    │
│  │  │ 表单项                      │   │    │
│  │  │ [标签] [输入框]             │   │    │
│  │  │ [标签] [下拉选择]            │   │    │
│  │  │ ...                         │   │    │
│  │  ├─────────────────────────────┤   │    │
│  │  │ 取消    提交（主按钮）       │   │    │
│  │  └─────────────────────────────┘   │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**CSS 规范**:

```css
/* ===== 表单页内容卡片容器 ===== */
.form-card {
  margin: 10px;                              /* ⭐ 外边距 10px */
  background-color: #FFFFFF;                 /* ⭐ 白色底色 */
  border-radius: 4px;                        /* 圆角 R2 */
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08); /* 轻微阴影 */
  padding: var(--spacing-lg);                /* 内边距 20px */
}
```

**关键要点**:

| 属性      | 值                   | 说明                     |
| ------- | ------------------- | ---------------------- |
| **外边距** | `10px`              | 四周等距，与主内容区边缘保持间距       |
| **背景色** | `#FFFFFF` (白色)      | 与页面背景 `#EBF1F6` 形成层次对比 |
| **圆角**  | `4px` (R2)          | 统一卡片圆角规范               |
| **内边距** | `20px` (spacing-lg) | 表单需要较大操作空间，内边距最大       |

#### 表单页面标题 (.page-title) — 带左侧色块

> 表单页标题采用**左侧色块 + 文字**的视觉样式，与详情页纯文字标题区分

| 属性          | 值                                       | 说明                 |
| ----------- | --------------------------------------- | ------------------ |
| **字号**      | `14px`                                  | 固定值                |
| **字重**      | `600` (semibold)                        | 半粗体                |
| **颜色**      | `var(--color-text-primary)` → `#141b24` | 主文字色               |
| **行高**      | `20px`                                  | 与字号匹配              |
| **左侧色块**    | `3px solid var(--color-primary)`        | 主题色竖线标识            |
| **色块与文字间距** | `8px`                                   | padding-left 控制    |
| **卡片内边距**   | `20px`                                  | `.form-body` 容器内边距 |

```css
/* 表单页大标题 - 左侧色块样式 */
.page-title {
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  padding-left: 8px;                          /* 色块与文字间距 */
  border-left: 3px solid var(--color-primary); /* 左侧主题色块 */
  line-height: 20px;                           /* 行高 */
}

/* 卡片内容区内边距 */
.form-body {
  padding: 20px;                               /* 内边距 20px */
}
```

**表单布局规则**:

| 规则项          | 推荐值                        | 说明                                                             |
| ------------ | -------------------------- | -------------------------------------------------------------- |
| **标签对齐**     | 上对齐（推荐）或左对齐                | 上对齐更移动端友好                                                      |
| **标签与输入框间距** | `var(--spacing-sm)` → 8px  | ⭐ label 必须 `display: block`（inline 元素 margin-bottom 无效）        |
| **标签宽度**     | 固定 80-100px（左对齐时）          | 保持视觉对齐                                                         |
| **表单项间距**    | `var(--spacing-md)` → 16px | 小间距标准                                                          |
| **必填标识**     | 红色星号 `*`，放在标签前             | 颜色: `#FF4D5D`                                                  |
| **输入框宽度**    | **按布局自适应**（flex:1 填满剩余空间）  | 详见 [表单输入框布局自适应规则](./components/form-inputs.md#布局自适应宽度规则v40-更新) |

**完整骨架**: [form.html](../ASSETS/page-shells/pages/form.html) + [form.js](../ASSETS/page-shells/js/pages/form.js)

### 组件查阅清单

> 📋 **表单页必读（9项）**：导航菜单 → 表单输入框 → 按钮 → 图标 → 卡片 + 查询栏(可选) + 输入框/选择器/表单页参考图
>
> 👉 [完整清单及查阅指引](./components/README.md#3-表单页-form-page)

***

## 4. 弹窗/对话框 (Modal)

> 🔗 **骨架绑定**：弹窗片段必须从 [ASSETS/page-shells/pages/modal.html](../ASSETS/page-shells/pages/modal.html) + [js/pages/modal.js](../ASSETS/page-shells/js/pages/modal.js) 提取（含 STRUCT 锚点），禁止从零写。布局结构检测：`node scripts/layout-scan.mjs <文件>`

> **完整规范** → [components/modal.md](./components/modal.md)（含三档尺寸、完整表单元素、交互规范、质量检查清单）

尺寸速查表及完整规范详见 [modal.md](components/modal.md)

**完整骨架**: [modal.html](../ASSETS/page-shells/pages/modal.html) + [modal.js](../ASSETS/page-shells/js/pages/modal.js)

### 组件查阅清单

> 📋 **弹窗必读（10项）**：按钮 → 图标 → 表单输入框 → 卡片 → 标签 + 操作按钮组 + 弹窗/输入框/选择器/弹窗示例参考图
>
> 👉 [完整清单及查阅指引](./components/README.md#4-弹窗对话框-modal)

