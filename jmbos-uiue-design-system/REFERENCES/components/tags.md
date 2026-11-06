# 标签/徽章 Tags


📌 **重要提示**: 本章节所有颜色值均来自 [design-tokens.css](../design-tokens.css) 中的 `--color-tag-*` 变量系列，实现时请优先引用 CSS 变量。

## 标签/徽章 Tags

**用途**: 状态标识、分类标记、属性标签

### 基础样式

```css
.tag {
  display: inline-block;
  border-radius: var(--radius-r2);                /* 4px (R2) */
  padding: 2px 8px;
  font-size: var(--font-size-body);               /* 12px （与正文一致）*/
  font-weight: var(--font-weight-regular);        /* 400 */
  border: none;                                   /* 默认无边框 */
}
```

**标签规范 (DESIGN.md 4.6)**:

| 属性  | 值           | 说明             |
| --- | ----------- | -------------- |
| 圆角  | `4px` (R2)  | 使用中圆角          |
| 内边距 | `2px 8px`   | 紧凑型            |
| 字号  | `12px`      | 与正文一致          |
| 字重  | `400`       | 常规字重           |
| 边框  | **无边框**（默认） | 默认无边框，可叠加边框变体  |

### 边框变体

标签支持两种边框样式，通过修饰类切换：

| 变体 | 修饰类 | 说明 |
| --- | --- | --- |
| 无边框（默认） | — | 仅背景色 + 文字色 |
| 有边框 | `.tag-bordered` | 额外添加 1px solid 边框 |

```css
.tag-bordered {
  border-style: solid;
  border-width: 1px;
}
```

### 标签颜色变体（完整版）

#### 1. 灰色标签 - 普通/未激活状态

```css
.tag-default {
  background-color: var(--color-tag-default-bg);    /* #EBF1F6 */
  color: var(--color-tag-default-text);             /* #7C8493 */
}

.tag-default.tag-bordered {
  border-color: var(--color-tag-default-border);    /* #B9BFCB */
}
```

**使用场景**: 默认状态、未激活、普通信息

#### 2. 蓝色标签 - 信息/可点击状态

```css
.tag-info {
  background-color: var(--color-tag-info-bg);       /* #DEEDFF */
  color: var(--color-tag-info-text);                /* #3685F2 */
}

.tag-info.tag-bordered {
  border-color: var(--color-tag-info-border);       /* #3685F2 */
}
```

**使用场景**: 可点击链接、信息提示、主要状态

#### 3. 绿色标签 - 成功/已完成状态

```css
.tag-success {
  background-color: var(--color-tag-success-bg);    /* #E6FBF5 */
  color: var(--color-tag-success-text);             /* #04D999 */
}

.tag-success.tag-bordered {
  border-color: var(--color-tag-success-border);    /* #04D999 */
}
```

**使用场景**: 成功状态、已完成、启用状态

#### 4. 橙色标签 - 警告/进行中状态

```css
.tag-warning {
  background-color: var(--color-tag-warning-bg);    /* #FFF7E8 */
  color: var(--color-tag-warning-text);             /* #FF813B */
}

.tag-warning.tag-bordered {
  border-color: var(--color-tag-warning-border);    /* #FF813B */
}
```

**使用场景**: 警告状态、进行中、待处理

#### 5. 红色标签 - 错误/危险状态

```css
.tag-error {
  background-color: var(--color-tag-error-bg);      /* #FFEDEF （警示-6 浅色背景）*/
  color: var(--color-tag-error-text);               /* #FF4D5D （警示-1 常规）*/
}

.tag-error.tag-bordered {
  border-color: var(--color-tag-error-border);      /* #FF4D5D （警示-1 常规）*/
}
```

**使用场景**: 错误状态、失败、禁用、危险操作

### 标签使用示例

```html
<!-- 无边框（默认） -->
<span class="tag tag-success">在售</span>
<span class="tag tag-warning">缺货</span>
<span class="tag tag-error">已下架</span>
<span class="tag tag-info">新品</span>
<span class="tag tag-default">草稿</span>

<!-- 有边框 -->
<span class="tag tag-bordered tag-success">在售</span>
<span class="tag tag-bordered tag-warning">缺货</span>
<span class="tag tag-bordered tag-error">已下架</span>
<span class="tag tag-bordered tag-info">新品</span>
<span class="tag tag-bordered tag-default">草稿</span>
```

***
