# 表单输入框 Form Inputs

> 版本: v4.0 | 来源: components.md | 最后更新: 2026-06-02

> 📌 **重要提示**: 本文档中的所有 CSS 变量（如 `var(--color-bg-border)`、`var(--radius-r2)` 等）均定义在 `design-tokens.css` 中，使用时需确保正确引入该文件。

## 表单输入框

### 适用范围

本规范适用于以下所有**文本输入类组件**：

| 组件类型 | CSS类名示例 | 说明 |
|---------|------------|------|
| 基础输入框 | `.input-field` | 表单、详情页 |
| 搜索框 | `.search-input` | 列表页顶部搜索栏 |
| 查询输入框 | `.query-input` | 查询筛选区域 |
| 下拉选择框 | `.query-select` | 查询筛选区域 |

> **重要**：以上所有组件均需遵循本规范的基础样式、交互状态和图标规则。

### 基础样式

```css
.input-field {
  border: 1px solid var(--color-bg-border);       /* #D2D7E1 */
  border-radius: var(--radius-r2);                /* 4px */
  height: 28px;                                    /* 固定高度 */
  padding: 6px 8px;
  font-size: var(--font-size-body);               /* 12px */
  color: var(--color-text-primary);               /* #141b24 */
  background-color: var(--color-bg-card);         /* #FFFFFF */
  transition: all var(--transition-fast);         /* 150ms ease-in-out */
}

.input-field::placeholder {
  color: var(--color-text-tertiary);              /* #B9BFCB 文字-3（v4.0 更新）*/
}
```

### 布局自适应宽度规则（v4.0 更新）

> **原则**: 输入框宽度支持两种模式——**用户自定义固定宽度** 或 **按布局列数自适应分配宽度**。

#### 自适应宽度计算公式

在查询栏、表单等多列布局场景中，输入框宽度应自动填满剩余空间：

```
输入框宽度 = (容器总宽度 ÷ 列数) - 标题(label)宽度 - 间距(gap)
```

#### 常见布局示例

| 布局场景 | 列数 | 说明 |
|---------|------|------|
| **查询栏-标准** | 4列 | 输入框宽度 = 容器宽度的 1/4 - label宽 - gap |
| **查询栏-扩展** | 3列 | 输入框宽度 = 容器宽度的 1/3 - label宽 - gap |
| **表单-标准** | 2列 | 输入框宽度 = 容器宽度的 1/2 - label宽 - gap |
| **表单-单列** | 1列 | 输入框宽度 = 容器宽度 - label宽 - gap |

#### CSS 实现建议

```css
/* 查询栏 4 列布局示例 */
.query-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);   /* 4等分 */
  gap: 16px;                                /* 列间距 */
}

.query-item {
  display: flex;
  align-items: center;
}

.query-label {
  flex-shrink: 0;          /* 标题不压缩 */
  width: 70px;             /* 固定标题宽度 */
  margin-right: 8px;       /* 标题与输入框间距 */
}

.query-input {
  flex: 1;                 /* 输入框自适应填满剩余空间 */
  min-width: 0;            /* 防止内容撑破网格 */
}
```

**关键要点**:
- 使用 `flex: 1` 让输入框自动填充剩余空间
- 标题(`label`)设置 `flex-shrink: 0` 避免被压缩
- 输入框必须设置 `min-width: 0` 防止内容溢出网格容器
- 用户仍可通过 `style="width: xxx"` 覆盖默认自适应行为

### 交互状态五态 (DESIGN.md 4.2)

| 状态               | 边框颜色      | 背景        | 文字颜色      | 特殊效果                     |
| ---------------- | --------- | --------- | --------- | ------------------------ |
| **Default（默认）**  | `#D2D7E1` | `#FFFFFF` | `#141b24` | 无                        |
| **Hover（悬停）**    | `#5E9DF5` | `#FFFFFF` | `#141b24` | 边框变为主题色悬停态               |
| **Focus（聚焦）**    | `#2364CC` | `#FFFFFF` | `#141b24` | 边框变为主题色聚焦态               |
| **Disabled（禁用）** | `#D2D7E1` | `#F4F7F9` | `#7C8493` | 背景变灰，cursor: not-allowed |
| **Error（错误）**    | `#FF4D5D` | `#FFFFFF` | `#141b24` | 边框变为红色                   |

**CSS 实现**:

```css
/* Hover 态 */
.input-field:hover {
  border-color: var(--color-primary-hover);       /* #5E9DF5 */
}

/* Focus 态 */
.input-field:focus {
  border-color: var(--color-primary-active);      /* #2364CC */
  outline: none;

/* Disabled 态 */
.input-field:disabled {
  background-color: var(--color-bg-header);       /* #F4F7F9 （背景-3 表头背景）*/
  color: var(--color-text-secondary);             /* #7C8493 （文字1-2 次要信息）*/
  cursor: not-allowed;
}

/* Error 态 */
.input-field.error {
  border-color: var(--color-error);               /* #FF4D5D （警示-1常规）*/
}
```

### 图标规则（v4.0 更新）

**位置限制**: 图标只能出现在**右侧**

**规格要求（v4.0 更新）**:

- 图标大小：**16×16px**
- 图标颜色：`#B9BFCB`（**文字-3，不是禁用色！**）
- 图标与边框距离：**8px**

```html
<!-- 正确示例：图标在右侧 -->
<div class="input-wrapper">
  <input type="text" class="input-field" placeholder="请输入...">
  <svg class="icon search-icon" style="color: #B9BFCB;">
    <use href="#icon-search"></use>
  </svg>  <!-- ✅ 右侧 + 文字-3 -->
</div>

<style>
.input-wrapper {
  position: relative;
  display: inline-block;
}

.input-icon {
  position: absolute;
  right: 8px;                    /* 距右边框8px */
  top: 50%;
  transform: translateY(-50%);
  color: #B9BFCB;                /* 文字-3（v4.0 更新）*/
  pointer-events: none;          /* 不影响输入 */
}

/* 为图标预留右侧内边距 */
.input-field {
  padding-right: 28px;           /* 8px(图标左边距) + 16px(图标宽) + 4px(间距) */
}
</style>
```

***

## 复选框 Checkbox

> 参见 [checkboxes.md](./checkboxes.md)

***
