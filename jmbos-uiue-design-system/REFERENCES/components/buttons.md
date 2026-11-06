# 按钮样式 Buttons

> 版本: v4.20.0 | 来源: components.md | 最后更新: 2026-06-02

📌 **重要**: 所有数值必须引用 [design-tokens.css](../ASSETS/design-tokens.css) 中的 CSS 变量

---

## 按钮样式

本文件包含 **4 种按钮的基础 CSS 样式代码**。关于**如何在业务场景中使用这些按钮**（如列表页工具栏、表单、弹窗等），请参阅 [操作按钮组规范](./action-buttons.md)。

### 主按钮 Primary Button

**用途**: 主要操作按钮，如"提交"、"确认"等（适用于所有场景）

```css
.btn-primary {
  background-color: var(--color-primary);        /* #3685F2 */
  color: var(--color-text-white);                /* #FFFFFF */
  border: none;
  border-radius: var(--radius-r2);               /* 4px */
  padding: 6px 12px;
  font-size: var(--font-size-body);              /* 12px */
  font-weight: var(--font-weight-regular);       /* 400 */
  cursor: pointer;
  transition: all var(--transition-fast);        /* 150ms ease-in-out */
}

/* 悬停态 (Hover) */
.btn-primary:hover {
  background-color: var(--color-primary-hover);  /* #5E9DF5 */
}

/* 点击态 (Active) */
.btn-primary:active {
  background-color: var(--color-primary-active); /* #2364CC */
}

/* 禁用态 (Disabled) */
.btn-primary:disabled {
  background-color: var(--color-primary-disabled); /* #AFCEFA */
  cursor: not-allowed;
}
```

**四态颜色对照**:

| 状态       | 颜色值       | CSS变量                      | 说明   |
| -------- | --------- | -------------------------- | ---- |
| Default  | `#3685F2` | `--color-primary`          | 默认状态 |
| Hover    | `#5E9DF5` | `--color-primary-hover`    | 鼠标悬停 |
| Active   | `#2364CC` | `--color-primary-active`   | 鼠标按下 |
| Disabled | `#AFCEFA` | `--color-primary-disabled` | 不可用  |

***

### 次按钮 Secondary Button

**用途**: 次要操作按钮，如"取消"、"重置"、"返回"等（适用于**表单、弹窗、查询栏**）

> 📌 **使用场景说明**：次按钮专门用于需要视觉强调的场景（有边框）。列表页工具栏请使用 [普通按钮 (.btn-default)](#普通按钮-default-button-⭐-来自-design-md--v42-更新)

```css
.btn-secondary {
  background-color: var(--color-bg-card);         /* #FFFFFF */
  color: var(--color-text-secondary);             /* #7C8493 */
  border: 1px solid var(--color-bg-border);       /* #D2D7E1 */
  border-radius: var(--radius-r2);                /* 4px */
  padding: 6px 12px;
  font-size: var(--font-size-body);               /* 12px */
  transition: all var(--transition-fast);         /* 150ms ease-in-out */
}

/* 悬停态 */
.btn-secondary:hover {
  border-color: var(--color-primary-hover);       /* #5E9DF5 */
  color: var(--color-primary-hover);              /* #5E9DF5 */
}

/* 点击态 */
.btn-secondary:active {
  border-color: var(--color-primary-active);      /* #2364CC */
  color: var(--color-primary-active);             /* #2364CC */
}

/* 禁用态 */
.btn-secondary:disabled {
  border-color: var(--color-bg-divider);          /* #E4E7F0 */
  color: var(--color-text-disabled);              /* #D2D7E1 */
  cursor: not-allowed;
}
```

***

### 危险按钮 Danger Button

**用途**: 警示性操作按钮，如"删除"、"禁用"、"撤销"等

```css
.btn-danger {
  background-color: var(--error);           /* #FF4D5D */
  color: var(--color-text-white);                 /* #FFFFFF */
  border: none;
  border-radius: var(--radius-r2);                /* 4px */
  padding: 6px 12px;
  font-size: var(--font-size-body);               /* 12px */
  font-weight: var(--font-weight-regular);        /* 400 */
  cursor: pointer;
  transition: all var(--transition-fast);         /* 150ms ease-in-out */
}

/* 悬停态 */
.btn-danger:hover {
  background-color: #FF717D;                      /* 警示-2 悬停 */
}

/* 点击态 */
.btn-danger:active {
  background-color: #D93649;                      /* 警示-3 点击 */
}
```

**⚠️ 使用原则**:

- 一个按钮组中**最多只能有1个**危险按钮
- 危险按钮应放在按钮组的最右侧或单独成行
- 建议配合二次确认弹窗使用

***

### 普通按钮 Default Button ⭐ （v4.2 更新）

**用途**: 列表页工具栏操作按钮组的**专用样式**（小号尺寸），适用于"导出"、"导入"、"打印"、"刷新"、**"新增"**等操作按钮。

> **⚠️ 重要**：普通按钮 (.btn-default) **仅用于列表页工具栏**，使用**小号尺寸** (`padding: 4px 8px`)。
>
> **表单/弹窗/查询栏场景请使用次按钮 (.btn-secondary)**

```css
.btn-default {
  background-color: #FFFFFF;                        /* 纯白 */
  color: #7C8493;                                   /* 文字-2 次要信息 */
  border: none;                                     /* 无边框 ⭐ */
  border-radius: 4px;                                /* 圆角 */
  padding: 4px 8px;                                 /* ⭐ 小号尺寸（列表页工具栏专用）*/
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  display: inline-flex;
  align-items: center;
  gap: 4px;                                         /* 图标与文字间距 */
  white-space: nowrap;
}

/* 悬停态 (Hover) - 主色 10% 不透明度背景 tint */
.btn-default:hover {
  background-color: rgba(54, 133, 242, 0.10);       /* #3685F2 @ 10% */
}

/* 点击态 (Active) - 主色 20% 不透明度背景 tint */
.btn-default:active {
  background-color: rgba(54, 133, 242, 0.20);       /* #3685F2 @ 20% */
}

/* 禁用态 (Disabled) */
.btn-default:disabled {
  color: #B9BFCB;                                   /* 文字-3 置灰信息 */
  cursor: not-allowed;
  opacity: 0.6;
}
```

**四态颜色对照**:

| 状态       | 背景色                     | 文字色       | 边框 | 说明              |
| -------- | ----------------------- | --------- | -- | --------------- |
| Default  | `#FFFFFF`               | `#7C8493` | 无  | 默认状态            |
| Hover    | `rgba(54,133,242,0.10)` | `#7C8493` | 无  | 鼠标悬停（背景淡蓝 tint） |
| Active   | `rgba(54,133,242,0.20)` | `#7C8493` | 无  | 鼠标按下（背景深蓝 tint） |
| Disabled | `#FFFFFF`               | `#B9BFCB` | 无  | 不可用             |

***

## 尺寸与场景规范汇总 ⭐

| 按钮 CSS 类名 | **padding** | **适用场景** | **边框** | **典型示例** |
|-------------|------------|------------|---------|------------|
| `.btn-default` | `4px 8px` (小号) | **列表页工具栏** | 无 | 新增、导出、导入、打印 |
| `.btn-secondary` | `6px 12px` (默认) | **表单/弹窗/查询栏** | 有 (`1px solid #D2D7E1`) | 取消、重置、返回 |
| `.btn-primary` | `6px 12px` 或 `6px 16px` | 所有场景通用 | 无 | 提交、确认、保存 |

> 📌 **详细使用规范、HTML 示例和最佳实践** → [操作按钮组规范](./action-buttons.md)

***

## 按钮类型快速对比

| 属性       | `.btn-primary` (主按钮) | `.btn-secondary` (次按钮) | `.btn-default` (普通按钮) | `.btn-danger` (危险按钮) |
| ---------- | --------------------- | ------------------------- | -------------------------- | ------------------------ |
| **背景色**     | `#3685F2` (主题蓝)      | `#FFFFFF` (白色)           | `#FFFFFF` (白色)           | `#FF4D5D` (红色)        |
| **文字色**     | `#FFFFFF` (白色)       | `#7C8493` (灰色)           | `#7C8493` (灰色)           | `#FFFFFF` (白色)        |
| **边框**       | 无                    | `1px solid #D2D7E1`      | 无                         | 无                       |
| **Hover 效果** | 背景变浅蓝             | 边框+文字变蓝             | 背景淡蓝 tint              | 背景变浅红               |
| **padding**    | `6px 12px`            | `6px 12px`                | `4px 8px` (小号)           | `6px 12px`               |
| **主要场景**   | 所有场景               | 表单/弹窗/查询栏          | **列表页工具栏**          | 警示操作                 |

***

## 相关规范文档

### 📚 操作按钮组使用指南

> 本文件提供的是**按钮的 CSS 样式代码**。如果你需要了解：
>
> - ✅ **列表页工具栏**如何组合使用 `.btn-default`
> - ✅ **表单/弹窗**如何组合使用 `.btn-secondary` + `.btn-primary`
> - ✅ **"更多操作"按钮**的实现方式
> - ✅ **最佳实践**和**常见错误**
>
> 👉 请参阅：[**操作按钮组规范 (Action Button Group)**](./action-buttons.md)

### 📚 表格操作列规则

表格内的操作按钮组（编辑、查看、删除）与页面工具栏的操作按钮组是**不同的概念**：

| 特征          | **操作列** (表格内)                     | **操作按钮组** (页面工具栏)              |
| ------------- | -------------------------------------- | -------------------------------------- |
| **位置**      | 表格数据行最右侧                        | 页面顶部/卡片标题栏/表格上方               |
| **最大可见数** | 3 个                                  | 6 个                                   |
| **超出处理**   | 水平三点图标 `···`                     | "更多操作"按钮 (文字+chevron-down图标)     |
| **详细规范**   | [表格样式-操作列](./tables.md#类型3带操作列表格-⭐⭐⭐-最常用) | [操作按钮组规范](./action-buttons.md)   |

### 📎 按钮间距参考

| 场景                  | 间距值                        |
| --------------------- | --------------------------- |
| 默认尺寸按钮之间       | `var(--spacing-md)` → 12px |
| 小号尺寸按钮之间       | `var(--spacing-sm)` → 8px  |
