# 选项卡/标签页 Tabs

> 版本: v1.2.0 | 最后更新: 2026-08-17

📌 **重要提示**: 本章节所有颜色/尺寸/间距值均来自 [design-tokens.css](../../ASSETS/design-tokens.css)，实现时请优先引用 CSS 变量。
📖 **视觉参考**: [标签页.png](../../ASSETS/component-reference/标签页.png)

## 组件概述

选项卡/标签页（Tabs）用于在同一区域内切换不同视图内容，或对内容进行分类筛选。JMBOS 设计系统中，选项卡组件分为**三种样式**，各有独立的使用场景与样式规则，禁止混用。

### 三种样式总览 ⭐ v1.0.0 核心规则

| 样式 | 类名 | 使用场景 | 可删除 | 容器位置 |
|------|------|---------|--------|---------|
| **标准样式**（默认） | `.tabs` | 卡片或容器内使用，切换不同视图内容 | ❌ 不可删除 | `.page-card` / `.card` 内部 |
| **页签样式** | `.tabs-nav` | 页面卡片容器顶部，作为用户打开过的标签页目录展示 | ✅ 可配置是否可删除 | `.page-card` 外部（其上方） |
| **分类标签** | `.tabs-filter` | 快速筛选标签，横向排列可点击切换 | ❌ 不可删除 | 查询栏区域 / 内容区顶部 |

> **判定原则**：该选项卡是"容器内视图切换"还是"页面级标签目录"还是"快速筛选"？
> - 容器内视图切换 → 标准样式 `.tabs`
> - 页面级标签目录（打开过的页面）→ 页签样式 `.tabs-nav`
> - 快速筛选过滤数据 → 分类标签 `.tabs-filter`

---

## 样式一：标准样式（默认） — 容器内视图切换

**用途**：默认样式，在卡片或容器内使用，用于在同一容器内切换不同视图内容。

**统一类名**：`.tabs`

> ⚠️ **使用限制**：标准样式仅用于卡片（`.page-card` / `.card`）或弹窗/抽屉等容器内部，禁止作为页面级标签目录使用。

### 尺寸规范

| 属性 | 值 | 说明 |
|------|---|------|
| 容器高度 | `40px` | 固定值 |
| 文字字号 | `13px` (--font-size-base) | 与正文一致 |
| 选项间距 | `16px` (--spacing-base) | 选项之间水平间距 |

### 选中选项样式

```css
.tabs .tab-item.is-active {
  font-weight: var(--font-weight-semibold);    /* 600 加粗 */
  color: var(--color-primary);                 /* 主题蓝 #3685F2 */
  /* 无悬停点击交互 */
}
```

### 未选中选项样式

```css
.tabs .tab-item {
  font-weight: var(--font-weight-regular);     /* 400 不加粗 */
  color: var(--color-text-primary);            /* #141b24 一级色 */
}

.tabs .tab-item:not(.is-active):hover {
  color: var(--color-primary-hover);            /* #5E9DF5 悬停态 */
}

.tabs .tab-item:not(.is-active):active {
  color: var(--color-primary-active);           /* #2364CC 点击态 */
}
```

### 底部选中指示线 ⚠️ 高频漏实现项

> 🚨 **AI 实现高频遗漏项**：选中选项底部**必须**显示 `2px` 高度的色块，**与文字等宽**（非整个选项宽度），颜色为主题蓝。此样式为标准样式的核心视觉标识，**禁止漏实现**。

> ⚠️ **色块位置规则**：2px 色块**在容器 40px 高度内部**，位于容器底部。禁止溢出到容器外部。

> ✅ **推荐实现方案**：使用 `border-bottom: 2px solid transparent`（默认透明，选中时变色），**无需 `::after` 伪元素**。色块天然在元素内部，不会溢出，且与文字等宽（前提：左右无内边距）。

```css
/* ⭐ 推荐实现：flex 居中方案（彻底解决 line-height + border 导致的 4px 留白） */
.tabs {
  height: 40px;
  display: flex;
  align-items: stretch;              /* ⭐ stretch 让 tab-item 撑满 40px */
  gap: var(--spacing-base);         /* 16px 选项间距 */
  overflow: hidden;
}
.tabs .tab-item {
  display: flex;                     /* ⭐ 用 flex 居中文字，不依赖 line-height */
  align-items: center;               /* ⭐ 文字垂直居中 */
  padding: 0;                        /* ⭐ 左右无内边距，确保色块与文字等宽 */
  font-size: var(--font-size-base); /* 13px */
  font-weight: var(--font-weight-regular);
  color: var(--color-text-primary); /* #141b24 一级色 */
  cursor: pointer;
  border-bottom: 2px solid transparent;  /* ⭐ 默认透明占位，防跳动，在 40px 内部 */
  border-top: none;
  border-left: none;
  border-right: none;
  background: none;
  box-sizing: border-box;            /* ⭐ border 计入 40px */
  transition: color var(--transition-fast), border-color var(--transition-fast);
  white-space: nowrap;
}
/* 选中态：border-bottom 变为主题色 */
.tabs .tab-item.is-active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);  /* ⭐ 2px色块，与文字等宽 */
  font-weight: var(--font-weight-semibold);
}
/* 未选中悬停/点击态 */
.tabs .tab-item:not(.is-active):hover {
  color: var(--color-primary-hover);
}
.tabs .tab-item:not(.is-active):active {
  color: var(--color-primary-active);
}
```

### 底部分割线（可选） ⚠️ v1.2.0 新增

标准样式可配置是否展示底部分割线。

| 配置 | 修饰类 | 说明 |
|------|--------|------|
| 不展示（默认） | — | 无分割线 |
| 展示 | `.tabs-divider` | 底部显示1px分割线 |

> ⚠️ **分割线与选中色块的关系**：分割线在容器底部，选中色块（2px）在分割线上方。由于选中色块用 `border-bottom` 实现，分割线用容器的 `border-bottom` 实现，两者在底部叠加时，选中色块（2px）会覆盖分割线（1px）对应位置。

```css
/* ⚠️ 分割线：容器底部1px边框，与选中色块叠加时色块覆盖分割线 */
.tabs.tabs-divider {
  border-bottom: 1px solid #E4E7F0;  /* 分割线颜色 */
}
```

### 溢出处理（箭头切换）

当选项总宽度超过容器宽度时，展示箭头切换图标（`#icon-chevron-right` / `#icon-chevron-left`）。

```
┌─ .tabs ────────────────────────────────────────────────┐
│ 选项1  选项2  选项3  选项4  选项5... │ ←箭头│   箭头下方白色背景   │
└──────────────────────────────────────────┘  ↑4px内边距留白 │
```

**关键规则**：
- ✅ 超出容器宽度时**且对应方向有隐藏内容时**才展示箭头图标
- ✅ **前方无隐藏内容时不展示左箭头**，后方无隐藏内容时不展示右箭头（按需展示，非恒显）
- ✅ 箭头图标默认颜色为**二级色**（`--color-text-secondary` `#7C8493`）
- ✅ 箭头悬停色为主题色悬停色（`#5E9DF5`），点击色为主题色点击色（`#2364CC`）
- ✅ 箭头下方需有**白色背景**，遮挡住下方的选项（避免内容穿透）
- ✅ 白色背景与箭头之间有 `4px` 内边距作为留白
- ✅ 点击箭头时自动滚动定位，将隐藏的选项**完整露出**
- ✅ 滚动定位后，**后方紧邻的下一个选项也需露出一部分**（不少于选项宽度的1/3），作为"后面还有内容"的视觉提示
- ✅ 选中某选项时，若该选项被部分遮挡，需自动滚动定位使其完整露出

```css
.tabs-arrow {
  background-color: var(--color-bg-card);   /* #FFFFFF 白色背景 */
  padding: var(--spacing-xs);               /* 4px 内边距留白 */
  display: flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
  z-index: 2;
  position: relative;
  /* 图标使用 #icon-chevron-right / #icon-chevron-left */
}
.tabs-arrow .icon {
  color: var(--color-text-secondary);      /* #7C8493 默认二级色 */
}
.tabs-arrow:hover .icon {
  color: var(--color-primary-hover);       /* #5E9DF5 悬停态 */
}
.tabs-arrow:active .icon {
  color: var(--color-primary-active);      /* #2364CC 点击态 */
}
/* 无隐藏内容时隐藏对应箭头（JS 控制 .is-hidden） */
.tabs-arrow.is-hidden { display: none; }
```

> ⚠️ **箭头图标**：必须使用项目标准 `chevron-right.svg` / `chevron-left.svg` 的 path（`#icon-chevron-right` / `#icon-chevron-left`），禁止自行绘制 path（会导致方向画反或粗细不一致）。

> ⚠️ **滚动定位 JS 实现要点**（高频出错项）：
> 1. **禁止用 `item.offsetLeft`** 计算位置。`offsetLeft` 是相对 `offsetParent` 的，而 `offsetParent` 可能是 `.tabs` 容器而非 `.tabs-scroll` 滚动容器，导致位置计算错误。
> 2. ✅ **必须用 `getBoundingClientRect()`** 计算相对位置：
>    ```js
>    var containerRect = scrollContainer.getBoundingClientRect();
>    var itemRect = item.getBoundingClientRect();
>    var itemLeft = scrollContainer.scrollLeft + (itemRect.left - containerRect.left);
>    var itemRight = itemLeft + itemRect.width;
>    ```
> 3. ✅ 左侧被遮挡：`scrollTo({ left: Math.max(0, itemLeft - 4) })`，前方留 4px 边距
> 4. ✅ 右侧被遮挡：`scrollTo({ left: itemRight - containerWidth + peekWidth + 4 })`，后方紧邻选项露出不少于 1/3 宽度
> 5. ✅ `.tabs-scroll` 用 `overflow: hidden` + `width: max-content` 的 `.tabs` 实现编程滚动（hidden 仍支持 `scrollTo`/`scrollBy`）
> 6. ✅ 箭头按需展示：监听 `scroll` 事件，`scrollLeft > 2` 显示左箭头，`scrollLeft < maxScroll - 2` 显示右箭头

---

## 样式二：页签样式 — 页面卡片容器顶部标签目录

**用途**：仅使用于页面卡片容器顶部，作为用户打开过的标签页目录展示，可配置是否可删除功能。

**统一类名**：`.tabs-nav`

> ⚠️ **使用限制**：页签样式目前**仅使用于页面卡片容器顶部**，位于 `.page-card` **外部**（作为其上方兄弟节点，紧邻卡片之上），展示用户打开过的标签页目录。

> ⚠️ **系统级交互**：页签是**整个系统级**的交互逻辑，不是某一个页面的示例。页签的添加、切换、关闭由 `common.js` 统一管理（`addTab` / `closeTab` / `renderTabs`），所有页面共享同一套页签逻辑。页面本身只需关注自身内容渲染，无需关心页签状态。

> ⚠️ **背景色规则**：`.page-card` 本身有白色卡片背景；`.tabs-nav` 容器**不设置背景色**（透明），由 `.nav-item` 各自背景决定视觉效果：
> - 选中 `.nav-item` 背景白色（`#FFFFFF`）→ 与紧邻下方的 `.page-card` 白色卡片背景自然衔接，无分割线
> - 未选中 `.nav-item` 背景 `#F4F7F9`（灰色）→ 与选中项自然区分
> - ❌ **禁止**给 `.tabs-nav` 容器整体设置背景色（会破坏选中页签与下方卡片的衔接效果）

> ⚠️ **与卡片左对齐规则**：`.tabs-nav` 容器 `padding: 0`，**无左边距留白**，页签直接与下方 `.page-card` 左对齐。禁止给页签容器添加 `padding-left` 或 `margin-left`。

> ⚠️ **有页签时卡片圆角规则**：当系统配置了页签（即 `.main-content` 有 `.has-tabs` 类）时，`.page-card` 的**左上角圆角为 0**（`border-top-left-radius: 0`），使页签与卡片在左上角无缝衔接。无页签时卡片保持正常圆角。

### 尺寸规范

| 属性 | 值 | 说明 |
|------|---|------|
| 选项卡高度 | `32px` | 固定值 |
| 顶部圆角 | `4px` (--radius-r2) | 仅顶部有圆角 |
| 底部圆角 | `0` | 底部无圆角 |
| 内部间距（左右） | `12px` (--spacing-md) | 左右留白 |
| 内部间距（上下） | `8px` (--spacing-sm) | 上下留白 |
| 选项间距 | `4px` (--spacing-xs) | 选项之间水平间距 |
| 文字字号 | `12px` (--font-size-sm) | 小字 |

### 选中选项样式

```css
.tabs-nav .nav-item.is-active {
  background-color: var(--color-bg-card);     /* #FFFFFF 白色背景 */
  border: 1px solid var(--color-bg-card);    /* ⚠️ 1px 白色边框（占位防跳动） */
  border-bottom: none;                        /* 底部无边框 */
  font-weight: var(--font-weight-semibold);   /* 600 加粗 */
  color: var(--color-primary);                 /* 主题蓝 #3685F2 */
  /* 无悬停点击交互 */
}
```

> ⚠️ **防跳动核心规则**：选中项用 `border: 1px solid var(--color-bg-card)`（白色边框）而非 `border: none`。未选中项有 `1px` 边框，若选中项无边框，切换时选中项会比未选中项宽 `2px`，导致位置跳动。白色边框占位确保宽度一致。

> ⚠️ **去除边框变色跳动**：未选中项悬停/点击时**仅文字变色**，**边框颜色不变**（保持 `#D2D7E1`）。禁止悬停时改变边框颜色，否则会产生边框闪烁跳动效果。

### 未选中选项样式

```css
.tabs-nav .nav-item {
  background-color: var(--color-bg-header);           /* #F4F7F9 */
  font-weight: var(--font-weight-regular);            /* 400 不加粗 */
  color: var(--color-text-primary);                   /* #141b24 一级色 */
  border: 1px solid var(--color-bg-border);           /* #D2D7E1 */
  border-bottom: none;                                /* ⚠️ 底部无边框 */
  border-radius: var(--radius-r2) var(--radius-r2) 0 0;/* 仅上左右圆角 */
}

.tabs-nav .nav-item:not(.is-active):hover {
  color: var(--color-primary-hover);                  /* #5E9DF5 悬停态 */
}

.tabs-nav .nav-item:not(.is-active):active {
  color: var(--color-primary-active);                 /* #2364CC 点击态 */
}
```

> ⚠️ **边框规则核心**：未选中选项边框为 `1px solid #D2D7E1`，但**底部无边框**（`border-bottom: none`），仅上左右展示边框。这是为了与下方内容区无缝衔接。

### 溢出处理（截断遮挡 + 定位露出）

当选项超出容器宽度时，**被截断遮挡**（不展示箭头），通过点击靠后/靠前定位将隐藏选项露出。

**关键规则**：
- ✅ 超出宽度时直接截断遮挡（与标准样式的箭头切换不同）
- ✅ 点击靠后/靠前（后面或前面有隐藏标签时）需自动滚动定位将隐藏的选项**完整露出**
- ✅ 滚动定位后，**后方紧邻的下一个选项也需露出一部分**（不少于选项宽度的1/3），作为"后面还有内容"的视觉提示
- ✅ 选中某选项时，若该选项被部分遮挡，需自动滚动定位使其完整露出

### 可删除配置

页签样式支持可删除功能，通过修饰类控制：

| 配置 | 修饰类 | 说明 |
|------|--------|------|
| 不可删除（默认） | — | 仅展示标签文字，无关闭按钮 |
| 可删除 | `.tab-closable` | 标签右侧显示关闭按钮（`#icon-remove` 图标） |

#### 删除按钮样式

可删除页签的文字后面 `4px` 间距出现关闭图标（`#icon-remove`）。

```css
.tabs-nav .nav-item.tab-closable .close-icon {
  margin-left: var(--spacing-xs);    /* 4px 与文字间距 */
  /* 使用 #icon-remove 图标 */
}
```

> ⚠️ **关闭图标**：必须使用项目标准 `remove.svg` 的 path（`#icon-remove`），禁止自行绘制（会导致图标过粗）。

#### 删除按钮颜色与交互（统一规则）

> ⚠️ **核心规则**：不论选项是否选中，关闭图标的颜色和交互**统一**为：
> - 默认颜色：二级色（`--color-text-secondary` `#7C8493`）
> - 悬停态：主题色悬停色（`--color-primary-hover` `#5E9DF5`）
> - 点击态：主题色点击色（`--color-primary-active` `#2364CC`）

> ⚠️ **热区判断规则**：关闭图标的颜色变化**仅响应图标自身的悬停/点击热区**，不响应整个 `.nav-item` 的悬停/点击。
> - 鼠标悬停在**关闭图标区域**时，图标变色
> - 鼠标悬停在**文字区域**时，图标**不变色**（仅文字按选项规则变色）
> - **双向独立**：鼠标从文字滑到图标时，**文字必须恢复未悬停态**（不能保持悬停色）；鼠标从图标滑回文字时，图标恢复默认色，文字变悬停色
> - 实现方式：`.close-icon` 的 `:hover/:active` 独立于 `.nav-item`，且需 `e.stopPropagation()` 阻止冒泡触发选项切换

```css
/* 关闭图标默认态（不论选中与否，统一二级色） */
.tabs-nav .nav-item.tab-closable .close-icon {
  color: var(--color-text-secondary);    /* #7C8493 二级色 */
  cursor: pointer;
  pointer-events: auto;                    /* ⭐ 确保图标自身可响应 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  transition: color var(--transition-fast);
}

/* ⚠️ 关闭图标热区独立：仅鼠标在图标上时变色，不随 .nav-item 悬停而变色 */
.tabs-nav .nav-item.tab-closable .close-icon:hover {
  color: var(--color-primary-hover);     /* #5E9DF5 悬停态 */
}

.tabs-nav .nav-item.tab-closable .close-icon:active {
  color: var(--color-primary-active);    /* #2364CC 点击态 */
}

/* ⭐ 悬停在关闭图标上时，恢复 .nav-item 文字颜色为未悬停态 */
/* 原因：鼠标从文字滑到图标时仍在 .nav-item 内，.nav-item:hover 仍生效，文字保持悬停色 */
/* 解决：用 :has() 检测 .close-icon 是否被悬停，是则恢复 .nav-item 文字颜色 */
.tabs-nav .nav-item.tab-closable:not(.is-active):hover:has(.close-icon:hover) {
  color: var(--color-text-primary);       /* 恢复为一级色（未悬停态） */
}
.tabs-nav .nav-item.tab-closable:not(.is-active):active:has(.close-icon:active) {
  color: var(--color-text-primary);       /* 点击图标时，恢复文字颜色 */
}
```

> ⚠️ **关闭图标实现要点**（高频出错项）：
> 1. ✅ `.close-icon` 必须显式设置 `color: var(--color-text-secondary)`，**不要依赖继承**（父级 `.nav-item` 的 color 在不同状态下会变化，继承会导致图标颜色随选项状态变化）
> 2. ✅ `.close-icon` 添加 `pointer-events: auto` 确保图标自身响应鼠标事件（即使父级有其他事件拦截）
> 3. ✅ `.close-icon` 用 `display: inline-flex; align-items: center; justify-content: center` 让 SVG 图标在 16×16 容器内居中
> 4. ✅ **不要**为选中态单独写覆盖规则，"不论选中与否统一规则"意味着选中态也用同一套 hover/active 规则
> 5. ✅ JS 点击事件需 `e.stopPropagation()` 阻止冒泡，否则会同时触发选项切换
> 6. ✅ **必须实现"双向独立"**：鼠标在图标上时，用 `:has(.close-icon:hover)` 让 `.nav-item` 文字恢复未悬停态（否则文字会保持悬停色，违反"热区独立"原则）

#### 是否显示删除图标的判断规则

| 页签数量 | 是否显示关闭图标 | 说明 |
|---------|----------------|------|
| 1 个 | ❌ 不显示 | 仅一个页签时不可关闭 |
| ≥2 个 | ✅ 显示 | 允许关闭页签 |

> ⚠️ **判定规则**：如果只有一个页签，不展示关闭图标；2个及以上时可允许关闭页签。此规则由 JS 逻辑**自动判断**（`renderTabs` 函数中 `openTabs.length >= 2`），无需手动配置。当用户打开新页面使页签数量从1变为2时，关闭图标**自动出现**；当关闭页签使数量从2变为1时，关闭图标**自动消失**。

---

## 样式三：分类标签 — 快速筛选

**用途**：快速筛选标签时使用，横向排列，点击切换筛选条件。

**统一类名**：`.tabs-filter`

> ⚠️ **使用限制**：分类标签专用于快速筛选场景，通常位于查询栏区域或内容区顶部，用于切换筛选条件。

### 分类标签组名称（可选）

可选择是否展示分类标签组名称。

```css
.tabs-filter-label {
  font-size: var(--font-size-sm);           /* 12px */
  color: var(--color-text-secondary);       /* #7C8493 二级色 */
  margin-right: var(--spacing-base);        /* 16px 与标签选项间距 */
}
```

> ⚠️ **换行对齐规则**：配置组名称时，换行后选项的展示位置**必须与第一行选项的起始位置一致**（即与组名称右侧的标签起始位置对齐），**禁止**直接与组名称左侧对齐。
> - 组名称独占左侧位置，选项统一从组名称右侧16px处开始排列
> - 换行时选项缩进与第一行选项起始位置保持一致
> - 实现方式：`.filter-row` 用 `display: flex`，组名称用 `flex-shrink: 0` 固定宽度，`.filter-items-wrap` 用 `flex: 1` 占据右侧剩余空间。这样换行后选项会从 `.filter-items-wrap` 左侧开始，即组名称右侧对齐
> - ❌ **禁止**组名称和选项在同一个 flex 容器内（换行后第二行会从容器最左侧开始，与组名称左对齐）
> - ❌ **禁止**同时使用 `gap` 和 `margin-right` 控制选项间距（间距会叠加成 16px 而非 8px），选项间距统一只用 `gap: 8px`

> ⚠️ **组名称与标签间距的实现差异**（高频出错项）：
> - **场景一（无展开收起，`.tabs-filter`）**：组名称和选项在**同一个 flex 容器**内，`gap: 8px` 会作用于组名称和第一个选项之间，所以组名称 `margin-right: 8px` + `gap: 8px` = **16px**
> - **场景二（带展开收起，`.filter-row`）**：组名称和 `.filter-items-wrap` 是**兄弟元素**，`.filter-row` 无 `gap`，组名称需独立撑足间距，`margin-right: 16px` = **16px**
> - ❌ **禁止**在 `.filter-row` 场景中用 `margin-right: 8px`（无 gap 补足，实际只有 8px，违反 16px 规范）

### 标签选项样式

```css
.tabs-filter .filter-item {
  height: 24px;                              /* 固定高度 */
  border-radius: var(--radius-r2);           /* 4px 圆角 */
  padding: 0 var(--spacing-md);              /* 左右12px 内边距 */
  font-weight: var(--font-weight-regular);   /* 400 不加粗 */
  margin-right: var(--spacing-sm);           /* 8px 选项间距 */
}
```

> ⚠️ **选择器覆盖**：`.filter-item` 基础样式需在 `.tabs-filter .filter-item` 与 `.filter-items-wrap .filter-item` 两种上下文下都匹配（展开收起场景选项位于 `.filter-items-wrap` 内），否则展开收起时选项样式失效。

### 选中标签样式

```css
.tabs-filter .filter-item.is-active {
  background-color: var(--color-primary);    /* 主题色 #3685F2 */
  color: var(--color-text-white);            /* #FFFFFF 白色文字 */
  font-weight: var(--font-weight-regular);   /* 400 不加粗 */
  border: 1px solid var(--color-primary);   /* ⚠️ 1px 主题色边框占位防跳动 */
  /* 无悬停点击交互 */
}
```

> ⚠️ **防跳动核心规则**：选中项用 `border: 1px solid var(--color-primary)`（主题色边框）而非 `border: none`。未选中项有 `1px` 边框，若选中项无边框，切换时会产生 `2px` 的宽度跳动。主题色边框占位确保宽度一致。

### 未选中标签样式

```css
.tabs-filter .filter-item:not(.is-active) {
  background-color: var(--color-bg-card);     /* #FFFFFF 白色 */
  border: 1px solid var(--color-bg-border);  /* #D2D7E1 */
  color: var(--color-text-secondary);        /* #7C8493 二级色 */
}

.tabs-filter .filter-item:not(.is-active):hover {
  border-color: var(--color-primary-hover);  /* #5E9DF5 边框变悬停色 */
  color: var(--color-primary-hover);         /* #5E9DF5 文字变悬停色 */
}

.tabs-filter .filter-item:not(.is-active):active {
  border-color: var(--color-primary-active); /* #2364CC 边框变点击色 */
  color: var(--color-primary-active);        /* #2364CC 文字变点击色 */
}
```

> ⚠️ **分类标签可改变边框颜色**（与页签样式不同）：因为分类标签是独立的小标签，边框变色不会导致位置跳动（边框宽度始终为1px，只是颜色变化）。页签样式因紧邻排列，边框变色会产生视觉闪烁跳动，故仅文字变色。

### 展开收起规则

标签默认展示一行，如超出一行则展示「展开+箭头」「收起+箭头」按钮。

**关键规则**：
- ✅ 默认展示**一行**，超出部分隐藏
- ✅ 单行模式下，仅展示能**完整显示**的选项，**不能完整显示的选项直接隐藏**（禁止显示半个选项）
- ✅ 展开按钮**独立占据空间**，与选项不重叠，固定在第一行右侧
- ✅ 按钮与最后一个完整选项之间留白 `12px` (--spacing-md)
- ✅ 点击「展开」后全部选项换行展示，按钮变为「收起」
- ✅ 点击「收起」恢复单行模式
- ✅ 展开状态下按钮仍固定在第一行右侧（不跟随最后一行）

> ⚠️ **完整显示规则**（高频出错项）：
> - 收起态下，第一行最后一个标签**必须能完整显示**，如无法完整显示则**直接隐藏**（`display: none`）
> - ❌ **禁止**用 `overflow: hidden` 裁切（会显示半个选项，不符合规范）
> - ✅ **必须用 JS 计算**：遍历所有选项，累计宽度，如果累计宽度 + 当前选项宽度 > 容器宽度，则隐藏该选项及之后的所有选项
> - ✅ 展开态下显示所有选项（移除 `is-hidden` 类）
> - ✅ 监听窗口 `resize` 事件，重新计算（防抖 100ms）

#### 展开收起按钮样式

```css
.filter-toggle-btn {
  flex-shrink: 0;                            /* ⭐ 不被压缩 */
  margin-left: var(--spacing-md);           /* 12px 与选项留白 */
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);                  /* 文字与箭头4px间距 */
  font-size: var(--font-size-sm);          /* 12px */
  color: var(--color-primary);              /* 默认主题蓝色 */
  cursor: pointer;
  height: 24px;
  border: none;                              /* ⭐ 无边框 */
  white-space: nowrap;
  background: none;                           /* ⭐ 无背景遮挡 */
  transition: color var(--transition-fast);
}
.filter-toggle-btn:hover {
  color: var(--color-primary-hover);        /* #5E9DF5 悬停色 */
}
.filter-toggle-btn:active {
  color: var(--color-primary-active);       /* #2364CC 点击色 */
}
```

#### 单行/多行切换实现要点 ⚠️ 高频出错项

> 🚨 **AI 实现高频出错项**：按钮用 `position: absolute` 会遮挡选项，必须用 **flex 子项独立占据空间**方案。

```css
/* 行容器：flex 布局，组名称+选项容器+按钮 三栏 */
.filter-row {
  display: flex;
  align-items: flex-start;       /* ⭐ 顶部对齐，按钮在第一行右侧 */
}
.filter-row .tabs-filter-label {
  flex-shrink: 0;
  margin-right: var(--spacing-base);   /* 16px 与标签间距 */
}
.filter-items-wrap {
  display: flex;
  flex-wrap: wrap;                /* 默认换行 */
  gap: var(--spacing-sm);         /* 8px 间距，统一用 gap */
  flex: 1 1 0;                    /* ⭐ 占据中间剩余空间 */
  min-width: 0;                   /* ⭐ 允许收缩到 0 */
  width: 0;                       /* ⭐ 从 0 开始 grow，避免 flex 计算异常导致按钮被挤压 */
  /* ⭐ 不用 overflow:hidden，改用 JS 计算哪些 item 能完整显示，不能完整显示的 display:none */
}
/* ⭐ 收起状态：单行不换行 */
.filter-row.collapsed .filter-items-wrap {
  flex-wrap: nowrap;
  max-height: 24px;
}
/* ⭐ 展开状态：换行显示 */
.filter-row.expanded .filter-items-wrap {
  flex-wrap: wrap;
  max-height: none;
}
/* ⭐ filter-item 不收缩，保持完整宽度 */
.filter-items-wrap .filter-item {
  flex-shrink: 0;
}
/* ⭐ JS 控制：不能完整显示的 item 隐藏 */
.filter-items-wrap .filter-item.is-hidden {
  display: none;
}
```

```js
// ⭐ 收起态：计算哪些 item 能完整显示，不能完整显示的 display:none
function updateFilterItems(row) {
  var wrap = row.querySelector('.filter-items-wrap');
  if (!wrap) return;
  var items = wrap.querySelectorAll('.filter-item');

  // 展开态：显示所有 item
  if (row.classList.contains('expanded')) {
    items.forEach(function(item) { item.classList.remove('is-hidden'); });
    return;
  }

  // 收起态：先显示所有 item（用于计算宽度）
  items.forEach(function(item) { item.classList.remove('is-hidden'); });

  var containerWidth = wrap.clientWidth;
  var gap = 8;  // gap: 8px
  var cumulativeWidth = 0;

  for (var i = 0; i < items.length; i++) {
    var itemWidth = items[i].offsetWidth;
    // 当前 item 的 right 边界 = cumulativeWidth + itemWidth
    // 如果超过容器宽度，该 item 及之后的所有 item 都隐藏
    if (cumulativeWidth + itemWidth > containerWidth) {
      for (var j = i; j < items.length; j++) {
        items[j].classList.add('is-hidden');
      }
      return;
    }
    cumulativeWidth += itemWidth + gap;
  }
}

// 初始化 + 监听 resize（防抖 100ms）
document.querySelectorAll('.filter-row').forEach(function(row) {
  updateFilterItems(row);
});
var resizeTimer = null;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function() {
    document.querySelectorAll('.filter-row').forEach(function(row) {
      updateFilterItems(row);
    });
  }, 100);
});
// 切换展开/收起后重新计算
document.querySelectorAll('.filter-toggle-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var row = btn.closest('.filter-row');
    // ... 切换 collapsed/expanded 类 ...
    updateFilterItems(row);
  });
});
```

---

## 规范速查表

### 三种样式对比

| 属性 | 标准样式 `.tabs` | 页签样式 `.tabs-nav` | 分类标签 `.tabs-filter` |
|------|----------------|---------------------|----------------------|
| 使用场景 | 卡片/容器内视图切换 | 页面卡片顶部标签目录 | 快速筛选标签 |
| 容器位置 | `.page-card` / `.card` 内部 | `.page-card` 外部（其上方） | 查询栏 / 内容区顶部 |
| 可删除 | ❌ | ✅（可配置） | ❌ |
| 默认选中态 | ✅ 支持选中态 | ✅ 支持选中态 | ✅ 支持选中态 |

### 各样式关键数值

| 属性 | 标准样式 `.tabs` | 页签样式 `.tabs-nav` | 分类标签 `.tabs-filter` | 来源 |
|------|---------|---------|---------|------|
| 容器/选项高度 | 40px | 32px | 24px | - |
| 字号 | 13px (--font-size-base) | 12px (--font-size-sm) | 12px (--font-size-sm) | --font-size-* |
| 选中字重 | 600 (--font-weight-semibold) | 600 (--font-weight-semibold) | 400 (--font-weight-regular) | --font-weight-* |
| 未选中字重 | 400 (--font-weight-regular) | 400 (--font-weight-regular) | 400 (--font-weight-regular) | --font-weight-* |
| 选项间距 | 16px (--spacing-base) | 4px (--spacing-xs) | 8px (--spacing-sm) | --spacing-* |
| 内边距 | - | 左右12px / 上下8px | 左右12px | --spacing-* |
| 圆角 | - | 顶部4px / 底部0 | 4px (--radius-r2) | --radius-* |
| 选中文字色 | #3685F2 (--color-primary) | #3685F2 (--color-primary) | #FFFFFF (--color-text-white) | - |
| 选中背景 | - | #FFFFFF (--color-bg-card) | #3685F2 (--color-primary) | - |
| 选中边框 | - | 1px solid #FFFFFF（白色占位防跳动） | 1px solid #3685F2（主题色占位防跳动） | - |
| 未选中文字色 | #141b24 (--color-text-primary) | #141b24 (--color-text-primary) | #7C8493 (--color-text-secondary) | --color-text-* |
| 未选中背景 | - | #F4F7F9 (--color-bg-header) | #FFFFFF (--color-bg-card) | - |
| 未选中边框 | - | 1px #D2D7E1（仅上左右，底部无边框） | 1px #D2D7E1 | --color-bg-border |
| 悬停文字色 | #5E9DF5 (--color-primary-hover) | #5E9DF5 (--color-primary-hover) | #5E9DF5 (--color-primary-hover) | --color-primary-hover |
| 点击文字色 | #2364CC (--color-primary-active) | #2364CC (--color-primary-active) | #2364CC (--color-primary-active) | --color-primary-active |
| 悬停边框变色 | - | ❌ 不变（仅文字变色，防跳动） | ✅ 变（#5E9DF5） | - |
| 选中态交互 | ❌ 无 | ❌ 无 | ❌ 无 | - |
| 底部指示线 | ✅ 2px 与文字等宽（在40px内部） | ❌ 无 | ❌ 无 | - |
| 底部分割线 | ✅ 可选（1px #E4E7F0，在40px内部，层级在色块后） | ❌ 无 | ❌ 无 | - |
| 溢出处理 | 箭头切换（按需展示+白色背景+4px留白+默认二级色+自动定位露出） | 截断遮挡+自动定位露出 | 展开收起按钮（独立空间+chevron-down/up+无边框文字+JS计算完整显示） | - |

---

## 与其他组件的关系

- **卡片 `.page-card`**：页签样式 `.tabs-nav` 位于 `.page-card` 外部（作为其上方兄弟节点）；标准样式 `.tabs` 可在 `.page-card` / `.card` 内部任意位置使用
- **标签 `.tag`**：标签组件用于状态标识，选项卡/标签页用于视图切换/筛选，两者用途不同，禁止混用
- **查询栏 `.query-bar`**：分类标签 `.tabs-filter` 可位于查询栏区域，作为快速筛选条件
- **图标 `.icon`**：标准样式使用 `#icon-chevron-right` / `#icon-chevron-left` 箭头图标（溢出切换）；页签样式使用 `#icon-remove` 关闭图标；分类标签使用 `#icon-chevron-down` / `#icon-chevron-up` 展开/收起图标

---
