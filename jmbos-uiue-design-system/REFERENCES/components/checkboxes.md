# 复选框 Checkbox

> 📌 **重要提示**: 所有 CSS 变量（如 `var(--color-text-tertiary)`、`var(--color-primary)` 等）均定义在 [design-tokens.css](../../ASSETS/design-tokens.css) 中，使用时需确保正确引入该文件。

> 🚫 **禁止使用原生 `accent-color` 方案**（见 [Anti-pattern #7](../implementation-guide.md#anti-pattern--7-复选框使用原生-input--accent-color)）。`accent-color` 只能控制选中态颜色，未选中态边框由浏览器默认渲染（深色/黑色），无法通过 CSS 变量统一控制。

## 适用范围

本规范适用于所有复选框场景：

| 场景 | CSS 类名 | 说明 |
|------|---------|------|
| 表单内复选框 | `.checkbox-item` | 表单、详情页选项 |
| 表格内复选框 | `.checkbox-cell` | 列表表格行选择 |

## 实现原理

隐藏原生 input 外观（`appearance: none`），使用 CSS 伪元素 `::after` 绘制选中对勾，完整控制五态视觉。

## 交互状态五态

| 状态 | 边框颜色 | 背景色 | 对勾 | 说明 |
|------|---------|--------|------|------|
| **Default（默认）** | `#B9BFCB` | `#FFFFFF` | 无 | 未选中态，边框使用文字-3 |
| **Hover（悬停）** | `#5E9DF5` | `#FFFFFF` | 无 | 边框变为主题色悬停态 |
| **Checked（选中）** | `#3685F2` | `#3685F2` | 白色对勾 | 背景与边框均变为主题色 |
| **Disabled（禁用）** | `#B9BFCB` | `#F4F7F9` | 无 | 背景变灰，cursor: not-allowed |
| **Disabled+Checked（禁用且选中）** | `#AFCEFA` | `#AFCEFA` | 白色对勾 | 使用主题色禁用态 |

### CSS 变量映射

| 状态 | 边框变量 | 背景变量 |
|------|---------|---------|
| Default | `var(--color-text-tertiary)` | `var(--color-bg-card)` |
| Hover | `var(--color-primary-hover)` | `var(--color-bg-card)` |
| Checked | `var(--color-primary)` | `var(--color-primary)` |
| Disabled | `var(--color-text-tertiary)` | `var(--color-bg-header)` |
| Disabled+Checked | `var(--color-primary-disabled)` | `var(--color-primary-disabled)` |

## HTML 结构

```html
<!-- 表单内使用 -->
<label class="checkbox-item">
  <input type="checkbox">
  <span>选项文本</span>
</label>

<!-- 表格内使用 -->
<td class="checkbox-cell">
  <input type="checkbox">
</td>
```

## CSS 实现

> 完整样式已预定义在 [design-tokens.css §11 多选框样式](../../ASSETS/design-tokens.css) 中，引入该文件即可直接使用。

```css
/* 基础样式 */
.checkbox-item input[type="checkbox"],
.checkbox-cell input[type="checkbox"] {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border: 1px solid var(--color-text-tertiary);  /* #B9BFCB 未选中边框（文字-3）*/
  border-radius: 2px;
  background-color: var(--color-bg-card);        /* #FFFFFF 背景 */
  cursor: pointer;
  position: relative;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

/* 表格多选框垂直居中 */
.checkbox-cell input[type="checkbox"] {
  vertical-align: middle;
}

/* 悬停态 */
.checkbox-item input[type="checkbox"]:hover,
.checkbox-cell input[type="checkbox"]:hover {
  border-color: var(--color-primary-hover);      /* #5E9DF5 */
}

/* 选中态 */
.checkbox-item input[type="checkbox"]:checked,
.checkbox-cell input[type="checkbox"]:checked {
  background-color: var(--color-primary);        /* #3685F2 选中背景 */
  border-color: var(--color-primary);            /* #3685F2 选中边框 */
}

/* 选中态对勾（伪元素绘制）*/
.checkbox-item input[type="checkbox"]:checked::after,
.checkbox-cell input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 8px;
  border: solid #FFFFFF;
  border-width: 0 2px 2px 0;
  border-radius: 1px;
  transform: translate(-42%, -58%) rotate(45deg);
}

/* 禁用态 */
.checkbox-item input[type="checkbox"]:disabled,
.checkbox-cell input[type="checkbox"]:disabled {
  background-color: var(--color-bg-header);      /* #F4F7F9 */
  border-color: var(--color-text-tertiary);      /* #B9BFCB */
  cursor: not-allowed;
}

/* 禁用且选中态 */
.checkbox-item input[type="checkbox"]:disabled:checked,
.checkbox-cell input[type="checkbox"]:disabled:checked {
  background-color: var(--color-primary-disabled); /* #AFCEFA */
  border-color: var(--color-primary-disabled);
}
```

## 表格中的复选框

表格复选框除上述基础样式外，还需配合列样式：

```css
/* 复选框列 */
.col-checkbox,
.table-selectable td:first-child {
  width: 40px;
  text-align: center;
  padding: 10px 8px;
}
```

表格中选择框使用 `.row-select` / `#select-all` 类名时，样式与 `.checkbox-cell input[type="checkbox"]` 一致，详见 [tables.md §类型2：可选择表格](./tables.md#类型2可选择表格-v42修正)。

## 关联检查项

- [C1](../implementation-guide.md#phase-3-component-compliance-组件合规每个组件写入时--27项)：禁止 `<input type="checkbox">` + `accent-color`
- [C2](../implementation-guide.md#phase-3-component-compliance-组件合规每个组件写入时--27项)：未勾选态边框 = `#B9BFCB`
- [S35](../style-fix-cheatsheet.md)：复选框实现方式检查

## 视觉参考

| 资源 | 路径 |
|------|------|
| 多选框参考图 | `ASSETS/component-reference/多选框.png` |

***
