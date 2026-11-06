# 弹窗/对话框 Modal

> JMBOS UIUE Design System | 弹窗独立规范 | v1.0.0
>
> 📌 所有数值必须引用 [design-tokens.css](../../ASSETS/design-tokens.css) 中的 CSS 变量
>
> 🔗 **关联规范**：
> - 表单元素 → [form-inputs.md](form-inputs.md)（输入框/选择器/多行文本）
> - 复选框 → [checkboxes.md](checkboxes.md)
> - 按钮 → [buttons.md](buttons.md) + [action-buttons.md](action-buttons.md)
> - 图标 → [icons.md](icons.md)
> - 抽屉 → [drawer.md](drawer.md)（详情场景专用，与弹窗标题区样式一致）
> - 确认对话框 → [confirm-dialog.md](confirm-dialog.md)（操作前二次确认场景专用，独立组件）

---

## 1. 组件定位

| 属性 | 说明 |
|------|------|
| **使用场景** | 简单/复杂表单编辑、数据录入、全屏编辑（确认提示请使用 [确认对话框](confirm-dialog.md)） |
| **触发方式** | 按钮点击 → `openModal(id)` |
| **弹出方式** | 居中弹出（小号/中号）；全屏铺满（大号） |
| **层级** | `var(--z-index-modal)` = `1001`（遮罩 1002，覆盖顶部导航） |
| **与抽屉区别** | 弹窗用于表单编辑；抽屉仅用于详情查看。标题区样式统一（蓝色背景+反白） |
| **与确认对话框区别** | 弹窗用于表单编辑/数据录入（含标题栏+表单+底栏）；确认对话框用于操作前二次确认（无表单，仅图标+标题+描述+按钮），见 [confirm-dialog.md](confirm-dialog.md) |

---

## 2. 结构组成

```
┌─────────────────────────────────────────────┐
│  遮罩层 .modal-overlay                        │ ← rgba(20,27,36,0.45)
│  ┌───────────────────────────────────────┐  │
│  │  标题区 .modal-header (固定)            │  │ ← 主题蓝色背景，文字反白，高40px
│  │  [标题文字]                    [关闭X]  │  │
│  ├───────────────────────────────────────┤  │
│  │                                       │  │
│  │  内容区 .modal-body (可滚动)            │  │ ← 16px 留白
│  │  ┌─────────────────────────────┐     │  │
│  │  │ 区块标题                     │     │  │
│  │  │ ┌──────┐ ┌──────┐ ┌──────┐ │     │  │ ← 表单行（2/3/4列）
│  │  │ │表单项 │ │表单项 │ │表单项 │ │     │  │
│  │  │ └──────┘ └──────┘ └──────┘ │     │  │
│  │  └─────────────────────────────┘     │  │
│  │                                       │  │
│  ├───────────────────────────────────────┤  │
│  │  底部操作栏 .modal-footer              │  │ ← 右对齐，按钮间距12px
│  │                        [取消] [保存]  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**结构清单**：

| # | 区域 | 类名 | 必需 | 说明 |
|---|------|------|------|------|
| 1 | 遮罩层 | `.modal-overlay` | ✅ 必需 | 半透明遮罩，点击可关闭 |
| 2 | 弹窗容器 | `.modal` + `.modal-sm`/`.modal-md`/`.modal-lg` | ✅ 必需 | 尺寸修饰符决定宽度 |
| 3 | 标题区 | `.modal-header` | ✅ 必需 | 主题蓝色背景，固定高度40px |
| 4 | 标题文字 | `.modal-title` | ✅ 必需 | H2, 14px, 字重600, 反白 |
| 5 | 关闭按钮 | `.modal-action-btn` | ✅ 必需 | 图标库 `#icon-remove`，容器圆角4px |
| 6 | 内容区 | `.modal-body` | ✅ 必需 | 16px留白，可滚动 |
| 7 | 底部操作栏 | `.modal-footer` | ✅ 必需 | 右对齐，按钮间距12px |

---

## 3. 尺寸规格

### 3.1 三档尺寸

| 弹窗类型 | 固定宽度 | 高度 | 滚动行为 | 使用场景 |
|---------|---------|------|---------|---------|
| **小号弹窗** `.modal-sm` | `588px` | `36vh - 80vh` | ✅ 纵向滚动<br>❌ 禁止横向滚动 | 简单表单、单项操作（确认提示请使用 [确认对话框](confirm-dialog.md)） |
| **中号弹窗** `.modal-md` | `908px` | `36vh - 80vh` | ✅ 纵向滚动<br>❌ 禁止横向滚动 | 复杂表单、数据编辑、多字段输入 |
| **大号弹窗** `.modal-lg` | `100vw`（全屏） | `100vh`（全屏） | ✅ 纵向滚动<br>❌ 禁止横向滚动 | 详情预览、复杂内容、全屏编辑 |

### 3.2 高度计算规则

- **小号/中号弹窗**：最小高度 `36vh`，最大高度 `80vh`
- **大号弹窗（例外）**：`100vh` 全屏高度，不受上述限制
- 弹窗垂直居中显示（小号/中号）；大号弹窗铺满全屏
- 内容超出时，在弹窗内部显示滚动条（仅纵向）

### 3.3 宽度规则

- 小号/中号弹窗使用**固定宽度**（588px / 908px），不随屏幕自适应
- 宽度放大由**整体预览缩放规则**（`body.zoom`）统一处理，弹窗无需单独适配
- **大号弹窗始终全屏（100vw × 100vh）**，用 `calc(100vw / var(--zoom-value))` 抵消 zoom 放大
- 所有弹窗**禁止出现横向滚动条**

### 3.4 大号弹窗特殊定位

| 属性 | 值 | 说明 |
|------|---|------|
| **定位方式** | `position: fixed; top: 0; left: 0` | 脱离文档流，直接相对视口定位 |
| **层级** | `var(--z-index-modal)` = `1001` | ⭐ 覆盖顶部导航栏（z-index: 1000） |
| **圆角** | `0` | 全屏无圆角 |
| **遮罩对齐** | `align-items: stretch; justify-content: stretch` | 非居中铺满 |

> ⭐ 大号弹窗的遮罩层 `.modal-overlay:has(.modal-lg)` 需覆盖居中对齐为拉伸铺满。

### 3.5 表单列数对应

| 弹窗类型 | 表单列数 | 说明 |
|---------|---------|------|
| 小号弹窗 `.modal-sm` | 2列 | `flex` 布局，`gap: 20px` |
| 中号弹窗 `.modal-md` | 3列 | `flex` 布局，`gap: 20px` |
| 大号弹窗 `.modal-lg` | 4列 | `grid: repeat(4, 1fr)`，`gap: 20px` |

> **最后一行间距处理**：`.modal-form-row:last-child` 必须设置 `margin-bottom: 0`，取消底部 20px 间距，避免与 `.modal-section` 或 `.modal-body` 的 padding 叠加产生双层间距。

---

## 4. 样式规范

### 4.1 标题区（与抽屉一致）

> 弹窗标题区与抽屉标题区（`.drawer-header`）样式统一：主题蓝色背景 + 文字/图标反白。

| 属性 | 值 | 说明 |
|------|---|------|
| **背景色** | `var(--color-primary)` → `#3685F2` | 主题蓝色 |
| **文字色** | `var(--color-text-white)` → `#FFFFFF` | 反白 |
| **整体高度** | `40px` | 固定高度 |
| **水平内边距** | `16px` | 左右内边距 |
| **布局** | `flex; align-items: center` | 标题左 + 按钮右 |
| **底部边框** | 无 | 蓝色背景无需分割线 |
| **固定方式** | `flex-shrink: 0` | 不随内容滚动 |
| **标题字号** | `14px` | 固定值 |
| **标题字重** | `600` | 半粗体 |

### 4.2 关闭按钮

| 属性 | 值 | 说明 |
|------|---|------|
| **图标** | `#icon-remove` | 图标库 SVG Sprite |
| **图标尺寸** | `16px` | 固定值 |
| **容器尺寸** | `24px × 24px` | 固定值 |
| **容器圆角** | `var(--radius-r2)` → `4px` | 中圆角 |
| **颜色** | `var(--color-text-white)` → `#FFFFFF` | 反白 |
| **Hover 背景** | `rgba(255, 255, 255, 0.15)` | 半透明白色 |
| **Hover 过渡** | `var(--transition-fast)` | 快速过渡 |

### 4.3 内容区

| 属性 | 值 | 说明 |
|------|---|------|
| **内边距** | `var(--spacing-base)` → `16px` | 上下左右统一 |
| **滚动行为** | `overflow-y: auto; overflow-x: hidden` | 仅纵向滚动 |
| **弹性** | `flex: 1` | 撑满标题区与底栏之间 |
| **最大高度（小/中号）** | `calc(80vh - 110px)` | 预留标题区+底栏高度 |
| **最大高度（大号）** | `calc(100vh - 110px)` | 全屏高度 |
| **背景色** | `var(--color-bg-card)` → `#FFFFFF` | 白色 |

### 4.4 底部操作栏

| 属性 | 值 | 说明 |
|------|---|------|
| **对齐** | `justify-content: flex-end` | 右对齐 |
| **按钮间距** | `var(--spacing-md)` → `12px` | 中间距 |
| **内边距** | `12px 16px` | 上下12px，左右16px |
| **顶部边框** | `1px solid var(--color-bg-divider)` | 分割线 |
| **固定方式** | `flex-shrink: 0` | 不随内容滚动 |
| **按钮顺序** | `[取消] [保存/确定]` | 次按钮左，主按钮右 |

### 4.5 弹窗容器

| 属性 | 小号/中号 | 大号 |
|------|---------|------|
| **背景色** | `var(--color-bg-card)` → `#FFFFFF` | 同左 |
| **圆角** | `var(--radius-r2)` → `4px` | `0`（全屏无圆角） |
| **阴影** | `var(--shadow-s3)` | 无（全屏铺满） |
| **布局** | `flex; flex-direction: column` | 同左 |
| **最小高度** | `36vh` | `100vh` |
| **最大高度** | `80vh` | `none`（全屏） |
| **定位** | 居中（遮罩层 `flex` 居中） | `fixed; top: 0; left: 0` |
| **入场动画** | `modalSlideIn`（`translateY(-20px)→0` + `opacity 0→1`） | 同左 |
| **过渡** | `var(--transition-base)` → `250ms ease-in-out` | 同左 |

### 4.6 遮罩层

| 属性 | 值 | 说明 |
|------|---|------|
| **背景色** | `rgba(20, 27, 36, 0.45)` | 半透明深色 |
| **层级** | `calc(var(--z-index-modal) + 1)` = `1002` | 高于弹窗容器和顶部导航 |
| **对齐（小/中号）** | `align-items: center; justify-content: center` | 居中弹窗 |
| **对齐（大号）** | `align-items: stretch; justify-content: stretch` | 铺满全屏 |
| **显示控制** | `display: none` → `.show { display: flex }` | 类名切换 |

### 4.7 区块标题（内容区内）

| 属性 | 值 | 说明 |
|------|---|------|
| **类名** | `.modal-section-title` | 区块标题 |
| **字号** | `var(--font-size-sm)` → `12px` | 小字号 |
| **字重** | `var(--font-weight-semibold)` → `600` | 半粗体 |
| **颜色** | `var(--color-primary)` → `#3685F2` | 主题色 |
| **下边距** | `12px` | 与表单项间距 |
| **区块间距** | `24px` | `.modal-section { margin-bottom: 24px }` |

---

## 5. 表单布局规范

### 5.1 表单行

| 属性 | 值 | 说明 |
|------|---|------|
| **类名** | `.modal-form-row` | 表单行容器 |
| **布局** | `flex` | 横向排列 |
| **间距** | `var(--spacing-base)` → `16px` | 表单项间距 |
| **行间距** | `var(--spacing-base)` → `16px` | `margin-bottom` |

### 5.2 表单项

| 属性 | 值 | 说明 |
|------|---|------|
| **类名** | `.modal-form-item` | 单个表单项 |
| **弹性** | `flex: 1; min-width: 0` | 等宽分配 |
| **标签字号** | `var(--font-size-sm)` → `12px` | 小字号 |
| **标签颜色** | `var(--color-text-primary)` → `#141b24` | 主文字色 |
| **必填标记** | `*` 前缀，`color: var(--color-error)` | `.required::before` |
| **输入框高度** | `28px` | 固定值 |
| **输入框边框** | `1px solid var(--color-bg-border)` | 默认边框 |
| **输入框圆角** | `var(--radius-r2)` → `4px` | 中圆角 |
| **聚焦边框** | `var(--color-primary)` + `box-shadow: 0 0 0 2px rgba(54,133,242,0.2)` | 主题色聚焦 |
| **占位符颜色** | `var(--color-text-tertiary)` → `#B9BFCB` | 三级文字色 |

### 5.3 表单元素清单

| 元素 | 类名 | 说明 |
|------|------|------|
| 文本输入框 | `.modal-form-input` | 单行文本 |
| 下拉选择器 | `.modal-form-select` | 自定义箭头图标 |
| 多行文本 | `.modal-form-textarea` | `min-height: 60px`，`resize: vertical` |
| 日期范围 | `.date-range-wrapper` | 两个输入框 + `~` 分隔符 |
| 带单位输入 | `.input-with-unit` | 输入框 + `.input-unit` 后缀 |
| 单选组 | `.radio-group` | `gap: 16px`，`input[type="radio"]` 14px |
| 多选组 | `.checkbox-group` | 自定义复选框样式（见 [checkboxes.md](checkboxes.md)） |
| 标签选择 | `.tag-select` | 已选标签 + `.tag-select-add` 追加按钮 |
| 文件上传 | `.file-upload-btn` + `.file-list` | 上传按钮 + 文件列表 |
| 富文本 | `.rich-editor` | 工具栏 + 可编辑区域 |
| 子表格 | `.data-table` | 弹窗内嵌表格 |
| 数字输入 | `.modal-form-input` | 同文本输入框 |

---

## 6. 设计令牌引用表

| 令牌 | 变量名 | 值 | 用途 |
|------|--------|---|------|
| 主题色 | `--color-primary` | `#3685F2` | 标题区背景/区块标题色/聚焦边框 |
| 白色文字 | `--color-text-white` | `#FFFFFF` | 标题/图标反白 |
| 卡片背景 | `--color-bg-card` | `#FFFFFF` | 弹窗容器/内容区背景 |
| 分割线 | `--color-bg-divider` | `#E4E7F0` | 底栏顶部边框 |
| 主文字 | `--color-text-primary` | `#141b24` | 标签文字 |
| 次要文字 | `--color-text-secondary` | `#7C8493` | 占位符/辅助文字 |
| 三级文字 | `--color-text-tertiary` | `#B9BFCB` | 占位符 |
| 边框 | `--color-bg-border` | `#D2D7E1` | 输入框边框 |
| 表头背景 | `--color-bg-header` | `#F4F7F9` | 输入框单位背景/子表头 |
| 错误色 | `--color-error` | `#FF4D5D` | 必填标记/校验错误 |
| 基础间距 | `--spacing-base` | `16px` | 内容区留白/表单项间距 |
| 中间距 | `--spacing-md` | `12px` | 底栏按钮间距/底栏上下padding |
| 小间距 | `--spacing-sm` | `8px` | 标签下边距 |
| 超大间距 | `--spacing-xl` | `24px` | 区块间距 |
| 小字号 | `--font-size-sm` | `12px` | 区块标题/标签/输入框文字 |
| 半粗 | `--font-weight-semibold` | `600` | 标题/区块标题字重 |
| 中圆角 | `--radius-r2` | `4px` | 弹窗圆角/按钮容器/输入框圆角 |
| 强阴影 | `--shadow-s3` | `0 12px 30px rgba(20,27,36,0.18)` | 弹窗阴影 |
| 弹窗层级 | `--z-index-modal` | `1001` | 弹窗容器层级 |
| 基础过渡 | `--transition-base` | `250ms ease-in-out` | 入场动画 |
| 快速过渡 | `--transition-fast` | `150ms` | 按钮hover过渡 |
| 画布宽度 | `--canvas-width` | `1280px` | 宽度适配基准 |

---

## 7. 完整 CSS 代码

> 以下代码可直接复制到页面 `.html` 的 `<style>` 块中。所有值使用 CSS 变量，禁止硬编码。

```css
/* ===== 弹窗/对话框样式 ===== */

/* 遮罩层 */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(20, 27, 36, 0.45);
  z-index: calc(var(--z-index-modal, 1001) + 1);
  display: none; align-items: center; justify-content: center;
}
/* 大号弹窗遮罩：全屏铺满，不居中 */
.modal-overlay:has(.modal-lg) {
  align-items: stretch; justify-content: stretch;
}
.modal-overlay.show { display: flex; }

/* 弹窗容器 */
.modal {
  background-color: var(--color-bg-card);
  border-radius: var(--radius-r2, 4px);
  box-shadow: var(--shadow-s3, 0 12px 30px rgba(20, 27, 36, 0.18));
  display: flex; flex-direction: column;
  position: relative;
  animation: modalSlideIn var(--transition-base, 0.25s) ease-in-out;
  min-height: 36vh; max-height: 80vh;
}
@keyframes modalSlideIn {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* 尺寸修饰符 */
.modal-sm { width: 588px; }
.modal-md { width: 908px; }

/* 大号弹窗：全屏 */
.modal-lg {
  position: fixed; top: 0; left: 0;
  width: 100vw; height: 100vh;
  max-height: none;
  border-radius: 0;
  z-index: var(--z-index-modal, 1001);
}

/* 标题区 - 主题蓝色背景，文字/图标反白 */
.modal-header {
  background-color: var(--color-primary);
  color: var(--color-text-white);
  height: 40px; padding: 0 16px;
  display: flex; align-items: center;
  flex-shrink: 0;
}
.modal-title {
  font-size: 14px; font-weight: 600;
  color: var(--color-text-white); flex: 1;
}
.modal-actions { display: flex; align-items: center; gap: 4px; }
.modal-action-btn {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer; padding: 0;
  color: var(--color-text-white);
  border-radius: var(--radius-r2, 4px);
  transition: background-color var(--transition-fast, 0.15s);
}
.modal-action-btn:hover { background-color: rgba(255, 255, 255, 0.15); }
.modal-action-btn svg { width: 16px; height: 16px; }

/* 内容区 */
.modal-body {
  padding: var(--spacing-base, 16px);
  overflow-y: auto; overflow-x: hidden;
  flex: 1;
  max-height: calc(80vh - 110px);
}
.modal-lg .modal-body { max-height: calc(100vh - 110px); }

/* 底部操作栏 */
.modal-footer {
  display: flex; justify-content: flex-end;
  gap: var(--spacing-md, 12px);
  padding: 12px 16px;
  border-top: 1px solid var(--color-bg-divider);
  flex-shrink: 0;
}

/* ===== 表单区块 ===== */
.modal-section { margin-bottom: 24px; }
.modal-section:last-child { margin-bottom: 0; }
.modal-section-title {
  font-size: var(--font-size-sm, 12px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-primary, #3685F2);
  margin-bottom: 12px;
}

/* 表单行 */
.modal-form-row { display: flex; gap: var(--spacing-base, 16px); margin-bottom: var(--spacing-base, 16px); }
.modal-form-item { flex: 1; min-width: 0; }

/* 表单标签 */
.modal-form-label {
  display: block; font-size: var(--font-size-sm, 12px);
  color: var(--color-text-primary, #141b24);
  margin-bottom: var(--spacing-sm, 8px); line-height: 1;
}
.modal-form-label.required::before {
  content: '*'; color: var(--color-error, #FF4D5D); margin-right: 2px;
}

/* 输入框 */
.modal-form-input {
  width: 100%; height: 28px; padding: 6px 8px;
  border: 1px solid var(--color-bg-border, #D2D7E1);
  border-radius: var(--radius-r2, 4px);
  font-size: 12px; color: #141b24;
  font-family: inherit;
  transition: all var(--transition-fast, 0.15s);
}
.modal-form-input::placeholder { color: var(--color-text-tertiary, #B9BFCB); }
.modal-form-input:focus {
  outline: none; border-color: var(--color-primary, #3685F2);
  box-shadow: 0 0 0 2px rgba(54, 133, 242, 0.2);
}

/* 下拉选择器 */
.modal-form-select {
  width: 100%; height: 28px; padding: 6px 8px; padding-right: 28px;
  border: 1px solid var(--color-bg-border, #D2D7E1);
  border-radius: var(--radius-r2, 4px);
  font-size: 12px; color: #141b24;
  appearance: none; background-color: var(--color-bg-card);
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2.57573593,5.07573593 C2.78401555,4.86745631 3.10732483,4.84431413 3.3411666,5.00630939 L3.42426407,5.07573593 L8,9.651 L12.5757359,5.07573593 C12.7840156,4.86745631 13.1073248,4.84431413 13.3411666,5.00630939 L13.4242641,5.07573593 C13.6325437,5.28401555 13.6556859,5.60732483 13.4936906,5.8411666 L13.4242641,5.92426407 L8.42426407,10.9242641 C8.21598445,11.1325437 7.89267517,11.1556859 7.6588334,10.9936906 L7.57573593,10.9242641 L2.57573593,5.92426407 C2.34142136,5.68994949 2.34142136,5.31005051 2.57573593,5.07573593 Z' fill='%237C8493' fill-rule='nonzero'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 8px center; background-size: 12px;
  cursor: pointer; font-family: inherit;
}

/* 多行文本 */
.modal-form-textarea {
  width: 100%; min-height: 60px; padding: 8px 12px;
  border: 1px solid var(--color-bg-border, #D2D7E1);
  border-radius: var(--radius-r2, 4px);
  font-size: var(--font-size-sm, 12px); color: var(--color-text-primary, #141b24);
  resize: vertical; font-family: inherit; line-height: 1.5;
}
.modal-form-textarea:focus {
  outline: none; border-color: var(--color-primary, #3685F2);
  box-shadow: 0 0 0 2px rgba(54, 133, 242, 0.2);
}

/* 日期范围 */
.date-range-wrapper { display: flex; align-items: center; gap: 8px; }
.date-range-wrapper .modal-form-input { flex: 1; }
.date-range-sep { color: var(--color-text-secondary, #7C8493); }

/* 带单位输入 */
.input-with-unit { display: flex; align-items: center; }
.input-with-unit .modal-form-input { flex: 1; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.input-unit {
  height: 32px; padding: 0 12px;
  border: 1px solid var(--color-bg-border, #D2D7E1); border-left: none;
  border-radius: 0 var(--radius-r2, 4px) var(--radius-r2, 4px) 0;
  font-size: var(--font-size-sm, 12px); color: var(--color-text-secondary, #7C8493);
  background-color: var(--color-bg-header, #F4F7F9);
  display: flex; align-items: center; white-space: nowrap;
}

/* 单选/多选组 */
.radio-group { display: flex; gap: 16px; align-items: center; padding-top: 4px; }
.radio-item { display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; }
.radio-item input[type="radio"] { width: 14px; height: 14px; cursor: pointer; }
.checkbox-group { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; padding-top: 4px; }
.checkbox-item { display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; }

/* 标签选择 */
.tag-select {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; height: 28px;
  background-color: var(--color-bg-header, #F4F7F9);
  border: 1px solid var(--color-bg-border, #D2D7E1);
  border-radius: var(--radius-r2, 4px);
  font-size: var(--font-size-sm, 12px); color: var(--color-text-primary, #141b24);
  cursor: pointer;
}
.tag-select .close-tag {
  width: 14px; height: 14px;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-secondary, #7C8493); cursor: pointer;
  border-radius: var(--radius-circle);
}
.tag-select .close-tag:hover { background-color: rgba(0, 0, 0, 0.1); }
.tag-select-add {
  display: inline-flex; align-items: center; padding: 2px 8px; height: 28px;
  background-color: var(--color-bg-header, #F4F7F9);
  border: 1px dashed var(--color-bg-border, #D2D7E1);
  border-radius: var(--radius-r2, 4px);
  font-size: var(--font-size-sm, 12px); color: var(--color-text-secondary, #7C8493);
  cursor: pointer;
}

/* 文件上传 */
.file-upload-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 12px; height: auto;
  background-color: var(--color-primary, #3685F2); color: var(--color-text-white, #FFFFFF);
  border: none; border-radius: var(--radius-r2, 4px);
  font-size: var(--font-size-sm, 12px); cursor: pointer; font-family: inherit;
}
.file-upload-hint { font-size: var(--font-size-sm, 12px); color: var(--color-text-secondary, #7C8493); margin-top: var(--spacing-sm, 8px); }
.file-list { margin-top: var(--spacing-sm, 8px); }
.file-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; margin-bottom: var(--spacing-xs, 4px);
  background-color: var(--color-bg-header, #F4F7F9);
  border-radius: var(--radius-r2, 4px);
}
.file-name { font-size: var(--font-size-sm, 12px); color: var(--color-text-primary, #141b24); display: flex; align-items: center; gap: 6px; }
.file-remove { width: 16px; height: 16px; cursor: pointer; color: var(--color-text-secondary, #7C8493); }
.file-remove:hover { color: var(--color-error, #FF4D5D); }
```

---

## 8. 完整 HTML 结构

### 8.1 小号弹窗（2列表单）

```html
<!-- 弹窗遮罩 + 容器 -->
<div class="modal-overlay" id="smallModal" onclick="closeModalOnOverlay(event, 'smallModal')">
  <div class="modal modal-sm">
    <!-- 标题区：主题蓝色背景 + 反白，高40px -->
    <div class="modal-header">
      <h2 class="modal-title">新增</h2>
      <div class="modal-actions">
        <button class="modal-action-btn" onclick="closeModal('smallModal')" title="关闭">
          <svg class="icon"><use href="#icon-remove"></use></svg>
        </button>
      </div>
    </div>
    <!-- 内容区：16px留白，可滚动 -->
    <div class="modal-body">
      <div class="modal-section">
        <h2 class="modal-section-title">基本信息</h2>
        <div class="modal-form-row">
          <div class="modal-form-item">
            <label class="modal-form-label required">姓名</label>
            <input type="text" class="modal-form-input" placeholder="请输入">
          </div>
          <div class="modal-form-item">
            <label class="modal-form-label">手机号码</label>
            <input type="text" class="modal-form-input" placeholder="请输入">
          </div>
        </div>
      </div>
    </div>
    <!-- 底部操作栏：右对齐，按钮间距12px -->
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal('smallModal')">取消</button>
      <button class="btn btn-primary" onclick="saveModal('smallModal')">保存</button>
    </div>
  </div>
</div>
```

### 8.2 大号弹窗（4列全屏）

```html
<div class="modal-overlay" id="largeModal" onclick="closeModalOnOverlay(event, 'largeModal')">
  <div class="modal modal-lg">
    <div class="modal-header">
      <h2 class="modal-title">新增</h2>
      <div class="modal-actions">
        <button class="modal-action-btn" onclick="closeModal('largeModal')" title="关闭">
          <svg class="icon"><use href="#icon-remove"></use></svg>
        </button>
      </div>
    </div>
    <div class="modal-body">
      <!-- 4列网格布局 -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
        <div class="modal-form-item">
          <label class="modal-form-label required">姓名</label>
          <input type="text" class="modal-form-input" placeholder="请输入">
        </div>
        <!-- 更多表单项... -->
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal('largeModal')">取消</button>
      <button class="btn btn-primary" onclick="saveModal('largeModal')">保存</button>
    </div>
  </div>
</div>
```

---

## 9. 完整 JS 交互代码

```javascript
/* ============================================================
 * 弹窗交互（打开/关闭/保存校验）
 * ============================================================ */

// 打开弹窗
function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
  document.body.style.overflow = 'hidden';
}

// 关闭弹窗
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
  document.body.style.overflow = '';
}

// 点击遮罩关闭
function closeModalOnOverlay(event, modalId) {
  if (event.target === event.currentTarget) {
    closeModal(modalId);
  }
}

// ESC 关闭所有弹窗
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(function(modal) {
      modal.classList.remove('show');
    });
    document.body.style.overflow = '';
  }
});

// 保存（含必填校验）
function saveModal(modalId) {
  var requiredFields = document.querySelectorAll('#' + modalId + ' [required]');
  var isValid = true;
  requiredFields.forEach(function(field) {
    if (!field.value.trim()) {
      field.style.borderColor = 'var(--color-error)';
      isValid = false;
    } else {
      field.style.borderColor = '';
    }
  });
  if (!isValid) {
    alert('请填写所有必填项');
    return;
  }
  closeModal(modalId);
  alert('保存成功');
}

// 挂载到 window
window.openModal = openModal;
window.closeModal = closeModal;
window.closeModalOnOverlay = closeModalOnOverlay;
window.saveModal = saveModal;
```

---

## 10. 交互规范

| 交互项 | 触发元素 | 行为 | 函数 |
|--------|---------|------|------|
| **打开** | 新增/编辑按钮 | 显示弹窗 + 遮罩 + 禁止body滚动 | `openModal(id)` |
| **关闭-×按钮** | 右上角关闭图标 | 隐藏弹窗 + 遮罩 + 恢复body滚动 | `closeModal(id)` |
| **关闭-遮罩** | `.modal-overlay` | 点击遮罩区域关闭 | `closeModalOnOverlay(event, id)` |
| **关闭-ESC** | `document` | 按 ESC 键关闭所有弹窗 | `keydown` 监听 |
| **关闭-取消** | `.btn-secondary` | 取消按钮关闭 | `closeModal(id)` |
| **保存** | `.btn-primary` | 必填校验 → 提示 → 关闭 | `saveModal(id)` |

> **四种关闭方式**：×按钮、遮罩点击、ESC键、取消按钮。交付前必须全部可用。

---

## 11. 使用指引

### 11.1 何时使用弹窗

| 场景 | 推荐组件 | 原因 |
|------|---------|------|
| 确认提示（删除/禁用/启用等）| ✅ [确认对话框](confirm-dialog.md) | 独立组件，函数式调用，四态变体，专用于二次确认 |
| 简单表单（2-3个字段） | ✅ 小号弹窗 | 不离开当前页面即可编辑 |
| 复杂表单（多字段、多区块） | ✅ 中号弹窗 | 3列布局容纳更多字段 |
| 全屏编辑（大量字段+子表格） | ✅ 大号弹窗 | 4列全屏，空间充足 |
| 查看记录详情 | ❌ 抽屉 | 弹窗用于编辑，抽屉用于详情 |
| 复杂数据录入（需独立页面） | ❌ 表单页 | 独立页面更合适 |

> ⭐ 确认提示场景统一使用 [确认对话框](confirm-dialog.md)，不再使用小号弹窗承载。

### 11.2 弹窗 vs 抽屉 vs 确认对话框

| 对比项 | 弹窗 | 抽屉 | 确认对话框 |
|--------|------|------|-----------|
| 弹出方式 | 居中弹出 | 右侧滑入 | 居中弹出 |
| 使用场景 | 表单编辑 | 详情查看 | 操作前二次确认 |
| 尺寸档位 | 3档（小588/中908/大全屏） | 2档（800px/全屏） | 1档（固定404px） |
| 表单元素 | ✅ 完整表单 | ❌ 无表单 | ❌ 无表单 |
| 标题栏 | 蓝色背景40px | 蓝色背景40px | 无标题栏（图标+标题+关闭） |
| 类型变体 | 无 | 无 | 4态（通用/成功/警告/危险） |
| 调用方式 | `openModal(id)` | `openDrawer(id)` | `openConfirm(id)` |
| 尺寸切换 | ❌ 不支持 | ✅ 支持（放大/缩小按钮） | ❌ 不支持 |
| 底部操作栏 | ✅ 默认提供 | ❌ 默认不提供 | ✅ 默认提供（左次右主） |
| 标题区样式 | 主题蓝色背景 + 反白 | 主题蓝色背景 + 反白（一致） | 无标题栏（图标+标题+关闭） |
| 标题区高度 | 40px | 40px（一致） | 自适应内容 |
| 关闭按钮图标 | `#icon-remove` | `#icon-remove`（一致） | `#icon-remove`（一致） |
| 关闭按钮圆角 | 4px | 4px（一致） | 4px（一致） |
| 底部按钮间距 | 12px | 12px（一致） | 12px（一致） |

### 11.3 尺寸选择决策

```
字段数量 ≤ 5 → 小号弹窗（588px, 2列）
字段数量 6~15 → 中号弹窗（908px, 3列）
字段数量 > 15 或含子表格 → 大号弹窗（全屏, 4列）
```

---

## 12. 质量检查清单

> 每次使用弹窗时逐项检查，全部通过后方可交付。

### 12.1 结构检查
- [ ] 包含 `.modal-overlay` 遮罩层
- [ ] 弹窗容器使用 `.modal` + 尺寸修饰符（`.modal-sm`/`.modal-md`/`.modal-lg`）
- [ ] 标题区使用 `.modal-header`，背景为 `var(--color-primary)`，高度40px
- [ ] 标题文字使用 `.modal-title`，14px + 字重600 + 反白
- [ ] 关闭按钮使用 `.modal-action-btn`，图标为 `#icon-remove`，容器圆角4px
- [ ] 内容区使用 `.modal-body`，padding 为 16px
- [ ] 底部操作栏使用 `.modal-footer`，右对齐，按钮间距12px

### 12.2 尺寸检查
- [ ] 小号弹窗宽度 `clamp(360px, 46vw, 706px)`
- [ ] 中号弹窗宽度 `clamp(480px, 71vw, 1090px)`
- [ ] 大号弹窗 `100vw × 100vh`，`position: fixed`，圆角0
- [ ] 小/中号弹窗最大高度 `80vh`，大号 `100vh`
- [ ] 大号弹窗遮罩 `stretch`（非居中）

### 12.3 表单检查
- [ ] 小号弹窗表单2列，中号3列，大号4列
- [ ] 表单行间距和项间距均为 16px
- [ ] 必填字段有 `required` 类 + `*` 前缀
- [ ] 输入框高度28px，圆角4px
- [ ] 聚焦状态有主题色边框 + box-shadow

### 12.4 交互检查
- [ ] `openModal(id)` 能正确打开
- [ ] `closeModal(id)` 能正确关闭
- [ ] 点击遮罩可关闭
- [ ] ESC 键可关闭
- [ ] 取消按钮可关闭
- [ ] 保存按钮有必填校验
- [ ] 所有样式值使用 CSS 变量，无硬编码

---

## 13. 视觉参考

| 参考图 | 路径 | 说明 |
|--------|------|------|
| 弹窗组件参考 | `ASSETS/component-reference/弹窗（对话框）.png` | 组件视觉规范 |
| 小号弹窗示例 | `ASSETS/page-examples/表单弹窗/上下布局/小号弹窗（2列）.png` | 2列上下布局 |
| 中号弹窗示例 | `ASSETS/page-examples/表单弹窗/上下布局/中号弹窗（3列）.png` | 3列上下布局 |
| 大号弹窗示例 | `ASSETS/page-examples/表单弹窗/上下布局/大号弹窗 （4列）.png` | 4列上下布局 |
| 左右布局-小号 | `ASSETS/page-examples/表单弹窗/左右布局/小号弹窗（2列）.png` | 2列左右布局 |
| 左右布局-中号 | `ASSETS/page-examples/表单弹窗/左右布局/中号弹窗（3列）.png` | 3列左右布局 |
| 左右布局-大号 | `ASSETS/page-examples/表单弹窗/左右布局/大号弹窗 （4列）.png` | 4列左右布局 |
| 完整骨架 | `ASSETS/page-shells/pages/modal.js` | 可运行的完整弹窗页面 |

---

## 14. 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| **v1.1.0** | 2026-08-31 | 将"确认提示"场景拆分至独立组件 [confirm-dialog.md](confirm-dialog.md)：从组件定位、小号弹窗使用场景、何时使用弹窗表格、弹窗vs抽屉对比表中移除"确认提示"承载，改为指向新组件。新增弹窗vs抽屉vs确认对话框三方对比表 |
| **v1.0.0** | 2026-07-30 | **初始独立规范**：从 page-list.md §2.4 弹窗章节 + modal.js + modal.html 中抽取整合。涵盖三档尺寸（小588/中908/大全屏）、标题区蓝色背景40px、完整表单元素规范、12种表单组件、交互规范（四种关闭方式）、质量检查清单 |

---

*最后更新: 2026-08-31 | v1.1.0 | 弹窗独立规范（确认提示场景拆分至 confirm-dialog.md）*
