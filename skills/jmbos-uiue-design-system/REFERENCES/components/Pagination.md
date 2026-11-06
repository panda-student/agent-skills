# 分页组件


## 一、组件概述

分页组件用于表格数据列表的页码切换，包含总条数信息和页码控制按钮。适用于弹窗内表格、列表页表格等场景。

**组件结构**：分页信息栏（共X条） + 分页控制区（上一页/页码/省略号/下一页）

---

## 二、Design Token 映射

| CSS 变量 | 实际值 | 用途 |
|---------|--------|------|
| `--color-text-primary` | `#141B24` | 默认文字颜色（分页信息、页码按钮文字） |
| `--color-text-white` | `#FFFFFF` | 激活页码按钮文字颜色 |
| `--color-primary` | `#3685F2` | 主色（激活按钮背景/边框、总条数高亮、hover文字/边框） |
| `--color-bg-card` | `#FFFFFF` | 按钮默认背景 |
| `--color-bg-border` | `#D2D7E1` | 按钮默认边框、图标禁用 |
| `--font-weight-semibold` | `600` | 总条数高亮文字粗细 |
| `--transition-fast` | `150ms ease-in-out` | 按钮 hover 过渡动画 |

---

## 三、HTML 结构

```html
<!-- 分页控件 -->
<div class="pagination-bar">
    <!-- 分页信息：共X条 -->
    <div class="pagination-info">
        共 <strong>128</strong> 条
    </div>
    <!-- 分页控制按钮 -->
    <div class="pagination-controls">
        <!-- 上一页（首页时 disabled） -->
        <button class="page-btn" disabled title="上一页">
            <svg style="width:14px;height:14px;"><use href="#icon-chevron-left"></use></svg>
        </button>
        <!-- 页码按钮（当前页加 active 类） -->
        <button class="page-btn active">1</button>
        <button class="page-btn">2</button>
        <button class="page-btn">3</button>
        <!-- 省略号 -->
        <button class="page-btn"><svg><use href="#icon-more"></use></svg></button>
        <!-- 末页 -->
        <button class="page-btn">9</button>
        <!-- 下一页 -->
        <button class="page-btn" title="下一页">
            <svg style="width:14px;height:14px;"><use href="#icon-chevron-right"></use></svg>
        </button>
    </div>
</div>
```

---

## 四、图标依赖

分页组件使用以下 SVG Sprite 图标，需确保页面已内联对应的 `<symbol>` 定义：

| 图标 ID | 用途 | viewBox |
|---------|------|---------|
| `icon-chevron-left` | 上一页箭头 | `0 0 16 16` |
| `icon-chevron-right` | 下一页箭头 | `0 0 16 16` |
| `icon-more` | 页码省略号（...） | `0 0 16 16` |

---

## 五、交互状态

| 状态 | 类名/属性 | 视觉表现 |
|------|----------|---------|
| **默认** | `.page-btn` | 白色背景、`#D2D7E1` 边框、`#141B24` 文字 |
| **hover** | `.page-btn:hover` | 边框和文字变为主色 `#3685F2` |
| **激活（当前页）** | `.page-btn.active` | 主色背景 `#3685F2`、白色文字、主色边框 |
| **切换页禁用** | `.page-btn:disabled` | 图标颜色变为 `#D2D7E1`、禁止光标 |

---

## 六、布局规则

| 属性 | 值 | 说明 |
|------|---|------|
| 容器对齐 | `justify-content: flex-end` | 分页控制区右对齐 |
| 信息位置 | `margin-right: auto` | 分页信息（共X条）推至左侧 |
| 按钮间距 | `gap: 4px` | 页码按钮之间间距 |
| 按钮尺寸 | `24px × 24px`（min-width × height） | 最小宽24px，高24px |
| 按钮内边距 | `0 4px` | 左右4px（适应数字宽度） |
| 容器上边距 | `padding: 12px 0 0` | 与上方表格间距12px |
| 字号 | `12px` | 分页信息和页码按钮统一12px |
| 列表页固定底部 | `flex-shrink: 0` | ⭐ 列表页场景：分页固定在容器底部，不随表格滚动 |

---

## 七、CSS 样式

```css
/* ====== 分页组件 ====== */
.pagination-bar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 12px 0 0;
    flex-shrink: 0;
}

.pagination-info {
    font-size: 12px;
    color: var(--color-text-primary);
    margin-right: auto;
}

.pagination-info strong {
    color: var(--color-primary);
    font-weight: var(--font-weight-semibold);
}

.pagination-controls {
    display: flex;
    align-items: center;
    gap: 4px;
}

.page-btn {
    min-width: 24px;
    height: 24px;
    padding: 0 4px;
    border: 1px solid var(--color-bg-border);
    border-radius: 4px;
    background: var(--color-bg-card);
    color: var(--color-text-primary);
    font-size: 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
}

.page-btn svg {
    display: block;
    width: 14px;
    height: 14px;
}

.page-btn:hover:not(:disabled):not(.active) {
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.page-btn.active {
    background-color: var(--color-primary);
    color: var(--color-text-white);
    border-color: var(--color-primary);
}

.page-btn:disabled {
    color: var(--color-bg-border);
    cursor: not-allowed;
}
```

---

## 八、使用示例

### 8.1 基础用法（嵌入弹窗 modal-body 末尾）

```html
<div class="modal-body">
    <!-- 表格内容 -->
    <div class="table-container">...</div>

    <!-- 分页控件 -->
    <div class="pagination-bar">
        <div class="pagination-info">
            共 <strong>128</strong> 条
        </div>
        <div class="pagination-controls">
            <button class="page-btn" disabled title="上一页">
                <svg style="width:14px;height:14px;"><use href="#icon-chevron-left"></use></svg>
            </button>
            <button class="page-btn active">1</button>
            <button class="page-btn">2</button>
            <button class="page-btn">3</button>
            <button class="page-btn"><svg><use href="#icon-more"></use></svg></button>
            <button class="page-btn">9</button>
            <button class="page-btn" title="下一页">
                <svg style="width:14px;height:14px;"><use href="#icon-chevron-right"></use></svg>
            </button>
        </div>
    </div>
</div>
```

### 8.2 页码较少时（无省略号）

```html
<div class="pagination-bar">
    <div class="pagination-info">
        共 <strong>35</strong> 条
    </div>
    <div class="pagination-controls">
        <button class="page-btn" disabled title="上一页">
            <svg style="width:14px;height:14px;"><use href="#icon-chevron-left"></use></svg>
        </button>
        <button class="page-btn active">1</button>
        <button class="page-btn">2</button>
        <button class="page-btn">3</button>
        <button class="page-btn">4</button>
        <button class="page-btn" title="下一页">
            <svg style="width:14px;height:14px;"><use href="#icon-chevron-right"></use></svg>
        </button>
    </div>
</div>
```

---

## 九、组件变体 — 条目数选择器

在分页控制区左侧添加每页条数下拉选择器，允许用户切换每页显示条数。来源于设计规范列表页骨架模板 `page-shells/pages/list.js`。

### 9.1 新增 CSS

```css
/* 条目数选择器 */
.page-size-select {
    height: 24px;
    padding: 0 28px 0 8px;
    border: 1px solid var(--color-bg-border);
    border-radius: var(--radius-r2);
    font-size: var(--font-size-sm);
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2.57573593,5.07573593 C2.78401555,4.86745631 3.10732483,4.84431413 3.3411666,5.00630939 L3.42426407,5.07573593 L8,9.651 L12.5757359,5.07573593 C12.7840156,4.86745631 13.1073248,4.84431413 13.3411666,5.00630939 L13.4242641,5.07573593 C13.6325437,5.28401555 13.6556859,5.60732483 13.4936906,5.8411666 L13.4242641,5.92426407 L8.42426407,10.9242641 C8.21598445,11.1325437 7.89267517,11.1556859 7.6588334,10.9936906 L7.57573593,10.9242641 L2.57573593,5.92426407 C2.34142136,5.68994949 2.34142136,5.31005051 2.57573593,5.07573593 Z' fill='%237C8493' fill-rule='nonzero'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 6px center;
    background-size: 10px;
    cursor: pointer;
    margin-right: var(--spacing-sm);
}
```

### 9.2 HTML 结构

```html
<div class="pagination-controls">
    <!-- 条目数选择器 -->
    <select class="page-size-select">
        <option>20条/页</option>
        <option>10条/页</option>
        <option>50条/页</option>
        <option>100条/页</option>
    </select>
    <!-- 页码按钮（同基础用法） -->
    <button class="page-btn" disabled title="上一页">
        <svg style="width:14px;height:14px;"><use href="#icon-chevron-left"></use></svg>
    </button>
    <button class="page-btn active">1</button>
    <button class="page-btn">2</button>
    <!-- ... -->
    <button class="page-btn" title="下一页">
        <svg style="width:14px;height:14px;"><use href="#icon-chevron-right"></use></svg>
    </button>
</div>
```

### 9.3 样式说明

| 属性 | 值 | 说明 |
|------|---|------|
| 高度 | `24px` | 与页码按钮同高 |
| 内边距 | `0 28px 0 8px` | 左8px文字、右28px留给箭头 |
| 下拉箭头 | 内联SVG（`#7C8493`） | `appearance: none` 后用 `background-image` 自定义箭头 |
| 箭头位置 | `right 6px center`，尺寸 `10px` | 右侧居中 |
| 右边距 | `var(--spacing-sm)`（8px） | 与后方页码按钮间距 |
| 字号 | `var(--font-size-sm)`（12px） | 统一12px |

---

## 十、组件变体 — 跳转页

在分页控制区右侧添加跳页输入框，允许用户直接输入页码跳转。来源于设计规范列表页骨架模板 `page-shells/pages/list.js`。

### 10.1 新增 CSS

```css
/* 跳转页 */
.page-jump {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-left: var(--spacing-sm);
}

.page-jump-input {
    width: 40px;
    height: 24px;
    text-align: center;
    border: 1px solid var(--color-bg-border);
    border-radius: var(--radius-r2);
    font-size: var(--font-size-sm);
}
```

### 10.2 HTML 结构

```html
<div class="pagination-controls">
    <!-- 页码按钮（同基础用法） -->
    <button class="page-btn" disabled title="上一页">
        <svg style="width:14px;height:14px;"><use href="#icon-chevron-left"></use></svg>
    </button>
    <button class="page-btn active">1</button>
    <!-- ... -->
    <button class="page-btn" title="下一页">
        <svg style="width:14px;height:14px;"><use href="#icon-chevron-right"></use></svg>
    </button>
    <!-- 跳转页 -->
    <div class="page-jump">
        <span>前往</span>
        <input type="text" class="page-jump-input" value="1">
        <span>页</span>
    </div>
</div>
```

### 10.3 样式说明

| 属性 | 值 | 说明 |
|------|---|------|
| 布局 | `flex` + `align-items: center` | "前往 [输入框] 页" 水平排列 |
| 间距 | `gap: var(--spacing-xs)`（4px） | 文字与输入框间距 |
| 左边距 | `var(--spacing-sm)`（8px） | 与前方页码按钮间距 |
| 输入框宽度 | `40px` | 固定窄宽度，仅容纳页码数字 |
| 输入框高度 | `24px` | 与页码按钮同高 |
| 文字对齐 | `text-align: center` | 输入框内数字居中 |
| 文字颜色 | `var(--color-text-secondary)`（`#7C8493`） | "前往""页"辅助文字 |
| 字号 | `var(--font-size-sm)`（12px） | 统一12px |

---

## 十一、列表页场景完整示例

列表页场景使用设计规范标准骨架的分页布局，与弹窗场景的主要差异：

| 差异点 | 弹窗场景（第七节CSS） | 列表页场景（本节） |
|--------|---------------------|-------------------|
| 容器类名 | `.pagination-bar` | `.pagination-wrapper` |
| 容器对齐 | `justify-content: flex-end` | `justify-content: space-between` |
| 上边框 | 无 | 无 |
| 容器内边距 | `12px 0 0` | `var(--spacing-md) var(--spacing-base)` |
| 按钮尺寸 | `24px × 24px` | `24px × 24px` |
| 条目数选择 | 无 | 有 |
| 跳转页 | 无 | 有 |
| 信息文字色 | `--color-text-primary` | `--color-text-primary` |

### 11.1 列表页场景 CSS

```css
/* ====== 列表页分页（完整变体） ====== */
.pagination-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-base);
    flex-shrink: 0;                                /* ⭐ 固定底部，不被压缩 */
}

.pagination-wrapper .pagination-info {
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
}

.pagination-wrapper .pagination-info .count {
    color: var(--color-primary);
    font-weight: var(--font-weight-semibold);
}

.pagination {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
}

/* 列表页页码按钮（24px，与弹窗场景一致） */
.pagination .page-btn {
    min-width: 24px;
    height: 24px;
    padding: 0 4px;
    border: 1px solid var(--color-bg-border);
    border-radius: var(--radius-r2);
    background-color: var(--color-bg-card);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    font-family: inherit;
}

.pagination .page-btn:hover:not(.active):not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.pagination .page-btn.active {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-text-white);
}

.pagination .page-btn:disabled {
    color: var(--color-bg-border);
    cursor: not-allowed;
}

/* 条目数选择器（见第九节） */
.page-size-select { /* ... */ }

/* 跳转页（见第十节） */
.page-jump { /* ... */ }
.page-jump-input { /* ... */ }
```

### 11.2 列表页场景 HTML

```html
<!-- 列表页分页：条目数选择 + 页码 + 跳转页 -->
<div class="pagination-wrapper">
    <!-- 左侧：总条数 -->
    <div class="pagination-info">
        共有 <span class="count">128</span> 条
    </div>
    <!-- 右侧：条目数选择 + 页码 + 跳转页 -->
    <div class="pagination">
        <!-- 条目数选择器 -->
        <select class="page-size-select">
            <option>20条/页</option>
            <option>10条/页</option>
            <option>50条/页</option>
            <option>100条/页</option>
        </select>
        <!-- 上一页 -->
        <button class="page-btn" disabled title="上一页">
            <svg class="icon"><use href="#icon-chevron-left"></use></svg>
        </button>
        <!-- 页码 -->
        <button class="page-btn active">1</button>
        <button class="page-btn">2</button>
        <button class="page-btn">3</button>
        <button class="page-btn">4</button>
        <button class="page-btn">5</button>
        <button class="page-btn">6</button>
        <button class="page-btn"><svg><use href="#icon-more"></use></svg></button>
        <button class="page-btn">20</button>
        <!-- 下一页 -->
        <button class="page-btn" title="下一页">
            <svg class="icon"><use href="#icon-chevron-right"></use></svg>
        </button>
        <!-- 跳转页 -->
        <div class="page-jump">
            <span>前往</span>
            <input type="text" class="page-jump-input" value="1">
            <span>页</span>
        </div>
    </div>
</div>
```

### 11.3 列表页场景布局示意

```
┌──────────────────────────────────────────────────────────────┐
│  共有 128 条          [20条/页 ▼] [<] 1 2 3 4 5 6 ··· 20 [>]  前往 [_] 页  │
└──────────────────────────────────────────────────────────────┘
   ←── 左侧(space-between) ──→  ←────────── 右侧(gap:4px) ──────────────────→
```

> **说明**：列表页分页固定在容器底部（`.pagination-wrapper { flex-shrink: 0 }`），不随表格内容滚动。表格区域（`.table-container`）独立滚动（`overflow-y: auto; flex: 1; min-height: 0`），分页始终可见。分页组件上方无分割线。弹窗场景分页紧贴表格下方无分割线、不带条目数选择和跳转页。两种场景页码按钮尺寸均为24px。
