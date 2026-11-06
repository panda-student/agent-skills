# 确认对话框 Confirm Dialog

> JMBOS UIUE Design System | 确认对话框独立规范 | v1.2.0
>
> 📌 所有数值必须引用 [design-tokens.css](../../ASSETS/design-tokens.css) 中的 CSS 变量
>
> 🔗 **关联规范**：
> - 按钮 → [buttons.md](buttons.md) + [action-buttons.md](action-buttons.md)
> - 图标 → [icons.md](icons.md)
> - 弹窗 → [modal.md](modal.md)（表单编辑场景专用，与确认对话框边界清晰）

---

## 1. 组件定位

| 属性 | 说明 |
|------|------|
| **使用场景** | 二次确认（删除/批量删除/禁用/启用/提交确认等）、操作前风险提示、关键动作的最终确认、简单编辑（重命名、修改密码等轻量输入场景） |
| **触发方式** | 按钮点击 → `openConfirm(id)` |
| **弹出方式** | 居中弹出，遮罩 + 模态 |
| **层级** | `var(--z-index-modal)` = `1001`（遮罩 1002，覆盖顶部导航） |
| **与弹窗区别** | 弹窗用于**复杂表单编辑/多字段数据录入**（含标题栏+完整表单+底栏）；确认对话框用于**操作前二次确认**及**简单编辑**（重命名/修改密码等单字段场景，图标+标题+描述/输入框+按钮） |
| **与消息提示区别** | 消息提示是**被动通知**（系统主动弹出，无确认按钮）；确认对话框是**主动询问**（需用户决策） |

---

## 2. 结构组成

```
┌─────────────────────────────────────────────┐
│  遮罩层 .confirm-overlay                      │ ← rgba(20,27,36,0.45)
│  ┌───────────────────────────────────────┐  │
│  │  .confirm-dialog (404px, 内容撑高)     │  │ ← 内间距 20px
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ [图标] [标题]         [关闭 X]  │  │  │ ← 标题行
│  │  └─────────────────────────────────┘  │  │
│  │  ─── 12px ───                          │  │ ← 标题与描述间距
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ 描述文字（可多行）               │  │  │ ← 描述区
│  │  └─────────────────────────────────┘  │  │
│  │  ─── 20px ───                          │  │ ← 描述与按钮间距
│  │              ┌────────┐ ┌────────┐    │  │ ← 按钮区（居右）
│  │              │ 取消    │ │ 确定   │    │  │ ← 左次右主
│  │              └────────┘ └────────┘    │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**结构清单**：

| # | 区域 | 类名 | 必需 | 说明 |
|---|------|------|------|------|
| 1 | 遮罩层 | `.confirm-overlay` | ✅ 必需 | 半透明遮罩，点击可关闭 |
| 2 | 容器 | `.confirm-dialog` + 类型修饰符 | ✅ 必需 | 固定宽度 404px，高度依内容撑开 |
| 3 | 标题区 | `.confirm-header` | ✅ 必需 | flex 布局：左=图标+标题，右=关闭按钮 |
| 4 | 图标 | `.confirm-icon` | ✅ 必需 | 20×20px，颜色随类型变体 |
| 5 | 标题文字 | `.confirm-title` | ✅ 必需 | 14px, 字重600, 主文字色 |
| 6 | 关闭按钮 | `.confirm-close` | ✅ 必需 | 图标库 `#icon-remove`，容器 24×24px |
| 7 | 描述区 | `.confirm-body` | ✅ 必需 | 包裹描述文字 |
| 8 | 描述文字 | `.confirm-desc` | ✅ 必需 | 12px, 次要文字色, 行高1.5 |
| 9 | 按钮区 | `.confirm-footer` | ✅ 必需 | flex 布局，居右排列，左次右主 |
| 10 | 取消按钮 | `.btn-secondary` | ✅ 必需 | 次按钮（有边框） |
| 11 | 确定按钮 | `.btn-primary` / `.btn-danger` | ✅ 必需 | 主按钮，颜色遵循按钮规范，高度 28px |

---

## 3. 类型变体（四态）

> 通过容器类名修饰符切换类型，图标颜色随类型变化。主按钮颜色遵循按钮规范，通用/成功型用 `.btn-primary`（蓝色），危险型用 `.btn-danger`（红色）。警告型为特殊规则，允许使用橙色 `.btn-warning`（与图标同色）。

| 类型 | 修饰符类名 | 图标 | 图标颜色 | 主按钮类名 | 主按钮背景色 | 适用场景 |
|------|----------|------|---------|---------|------------|---------|
| **通用型** | `.confirm-info` | `#icon-circle-info` | `var(--color-primary)` `#3685F2` 蓝色 | `.btn-primary` | `var(--color-primary)` `#3685F2` | 普通确认（启用/停用/提交/切换状态） |
| **成功型** | `.confirm-success` | `#icon-circle-info` | `var(--color-primary)` `#3685F2` 蓝色 | `.btn-primary` | `var(--color-primary)` `#3685F2` | 成功后引导确认（如"操作已完成，是否继续"） |
| **警告型** | `.confirm-warning` | `#icon-warning` | `var(--color-warning)` `#FF813B` 橙色 | `.btn-warning` | `var(--color-warning)` `#FF813B` | 风险提示（禁用/取消操作/不可逆但非删除） |
| **危险型** | `.confirm-danger` | `#icon-warning` | `var(--color-error)` `#FF4D5D` 红色 | `.btn-danger` | `var(--color-error)` `#FF4D5D` | 危险操作（删除/批量删除/清空数据） |

> ⭐ **核心规则**：主按钮颜色遵循 [buttons.md](buttons.md) 按钮规范。通用/成功型用 `.btn-primary`（蓝色），危险型用 `.btn-danger`（红色）。**警告型为特殊规则**，允许使用橙色 `.btn-warning`（与图标同色），以视觉强化风险提示。绿色（`.btn-success`）禁止使用。

---

## 4. 样式规范

### 4.1 容器

| 属性 | 值 | 说明 |
|------|---|------|
| **宽度** | `404px` | 固定宽度，不随屏幕自适应 |
| **高度** | 自适应内容 | 内容撑开，不设固定高度 |
| **背景色** | `var(--color-bg-card)` → `#FFFFFF` | 白色 |
| **圆角** | `var(--radius-r2)` → `4px` | 中圆角 |
| **阴影** | `var(--shadow-s3)` | 强阴影 |
| **内边距** | `var(--spacing-lg)` → `20px` | 上下左右统一 |
| **布局** | `flex; flex-direction: column` | 纵向排列 |
| **入场动画** | `confirmSlideIn`（translateY(-20px)→0 + opacity 0→1） | 与弹窗一致 |
| **过渡** | `var(--transition-base)` → `250ms ease-in-out` | 入场动画 |
| **定位** | 居中（遮罩层 flex 居中） | — |

### 4.2 标题区

| 属性 | 值 | 说明 |
|------|---|------|
| **布局** | `flex; align-items: center; justify-content: space-between` | 左：图标+标题；右：关闭按钮 |
| **间距** | `gap: var(--spacing-xs)` → `4px` | 图标与标题间距 |
| **图标组容器** | `.confirm-title-group`（flex + gap:4px + flex:1 + min-width:0） | 包裹图标和标题 |

### 4.3 图标

| 属性 | 值 | 说明 |
|------|---|------|
| **尺寸** | `20×20px` | 大于按钮图标（16px），强调视觉引导 |
| **颜色** | 随类型变体（见 §3） | 通过父级 `.confirm-*` 类控制 |
| **flex-shrink** | `0` | 不被压缩 |

### 4.4 标题文字

| 属性 | 值 | 说明 |
|------|---|------|
| **字号** | `var(--font-size-lg)` → `14px` | 与弹窗标题一致 |
| **字重** | `var(--font-weight-semibold)` → `600` | 半粗体 |
| **颜色** | `var(--color-text-primary)` → `#141b24` | 主文字色 |
| **行高** | `1.4` | 紧凑行高 |
| **弹性** | `flex: 1; min-width: 0` | 撑满标题区，允许省略 |

### 4.5 关闭按钮

| 属性 | 值 | 说明 |
|------|---|------|
| **图标** | `#icon-remove` | 图标库 SVG Sprite |
| **图标尺寸** | `16×16px` | 固定值 |
| **容器尺寸** | `20×20px` | 固定值 |
| **容器圆角** | `var(--radius-r2)` → `4px` | 中圆角 |
| **默认色** | `var(--color-text-secondary)` → `#7C8493` | 次要文字色 |
| **Hover 背景** | `var(--color-bg-hover)` → `#EDF3FA` | 悬停背景 |
| **Hover 图标色** | `var(--color-primary)` → `#3685F2` | 主题蓝色 |
| **Hover 过渡** | `var(--transition-fast)` | 快速过渡 |
| **flex-shrink** | `0` | 不被压缩 |

### 4.6 描述区

| 属性 | 值 | 说明 |
|------|---|------|
| **上边距** | `var(--spacing-md)` → `12px` | 标题行与描述间距 |
| **字号** | `var(--font-size-sm)` → `12px` | 小字号 |
| **颜色** | `var(--color-text-secondary)` → `#7C8493` | 次要文字色 |
| **行高** | `var(--line-height-base)` → `1.5` | 正常行高 |
| **外边距** | `margin: 0` | 重置 p 标签默认外边距 |

### 4.7 按钮区

| 属性 | 值 | 说明 |
|------|---|------|
| **布局** | `flex; justify-content: flex-end` | 居右排列 |
| **按钮间距** | `var(--spacing-md)` → `12px` | 中间距 |
| **上边距** | `var(--spacing-lg)` → `20px` | 描述与按钮间距 |
| **按钮顺序** | `[取消] [确定]` | 左次右主 |
| **取消按钮** | `.btn-secondary` | 次按钮（有边框，灰色），高度 28px |
| **确定按钮** | 类型对应主按钮（见 §3），高度 28px | 颜色遵循按钮规范 |

### 4.8 遮罩层

| 属性 | 值 | 说明 |
|------|---|------|
| **背景色** | `rgba(20, 27, 36, 0.45)` | 半透明深色，与弹窗一致 |
| **层级** | `calc(var(--z-index-modal) + 1)` = `1002` | 高于容器和顶部导航 |
| **对齐** | `align-items: center; justify-content: center` | 居中弹窗 |
| **显示控制** | `display: none` → `.show { display: flex }` | 类名切换 |

---

## 5. 设计令牌引用表

| 令牌 | 变量名 | 值 | 用途 |
|------|--------|---|------|
| 主题色 | `--color-primary` | `#3685F2` | 通用型/成功型图标 + 主按钮（`.btn-primary`） |
| 警告色 | `--color-warning` | `#FF813B` | 警告型图标 + 主按钮（`.btn-warning`，特殊规则） |
| 错误色 | `--color-error` | `#FF4D5D` | 危险型图标 + 主按钮（`.btn-danger`） |
| 卡片背景 | `--color-bg-card` | `#FFFFFF` | 容器背景 |
| 主文字 | `--color-text-primary` | `#141b24` | 标题文字 |
| 次要文字 | `--color-text-secondary` | `#7C8493` | 描述文字 |
| 三级文字 | `--color-text-tertiary` | `#B9BFCB` | 关闭按钮默认色 |
| 悬停背景 | `--color-bg-hover` | `#EDF3FA` | 关闭按钮 hover |
| 大间距 | `--spacing-lg` | `20px` | 容器内边距/描述与按钮间距 |
| 中间距 | `--spacing-md` | `12px` | 标题与描述间距/按钮间距 |
| 超小间距 | `--spacing-xs` | `4px` | 图标与标题间距 |
| 大字号 | `--font-size-lg` | `14px` | 标题字号 |
| 小字号 | `--font-size-sm` | `12px` | 描述字号 |
| 半粗 | `--font-weight-semibold` | `600` | 标题字重 |
| 正常行高 | `--line-height-base` | `1.5` | 描述行高 |
| 中圆角 | `--radius-r2` | `4px` | 容器圆角/关闭按钮圆角 |
| 强阴影 | `--shadow-s3` | `0 12px 30px rgba(20,27,36,0.18)` | 容器阴影 |
| 弹窗层级 | `--z-index-modal` | `1001` | 容器层级 |
| 基础过渡 | `--transition-base` | `250ms ease-in-out` | 入场动画 |
| 快速过渡 | `--transition-fast` | `150ms` | 关闭按钮 hover 过渡 |

---

## 6. 完整 CSS 代码

> 以下代码可直接复制到页面 `.html` 的 `<style>` 块中。所有值使用 CSS 变量，禁止硬编码。

```css
/* ===== 确认对话框样式 ===== */

/* 遮罩层 */
.confirm-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(20, 27, 36, 0.45);
  z-index: calc(var(--z-index-modal, 1001) + 1);
  display: none;
  align-items: center; justify-content: center;
}
.confirm-overlay.show { display: flex; }

/* 容器：固定宽度 404px，高度自适应内容 */
.confirm-dialog {
  width: 404px;
  background-color: var(--color-bg-card, #FFFFFF);
  border-radius: var(--radius-r2, 4px);
  box-shadow: var(--shadow-s3, 0 12px 30px rgba(20, 27, 36, 0.18));
  padding: var(--spacing-lg, 20px);
  display: flex; flex-direction: column;
  position: relative;
  animation: confirmSlideIn var(--transition-base, 0.25s) ease-in-out;
}
@keyframes confirmSlideIn {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* 标题区 */
.confirm-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--spacing-sm, 8px);
}
.confirm-title-group {
  display: flex; align-items: center; gap: var(--spacing-xs, 4px);
  flex: 1; min-width: 0;
}
.confirm-icon {
  width: 20px; height: 20px;
  flex-shrink: 0;
}
.confirm-title {
  font-size: var(--font-size-lg, 14px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary, #141b24);
  margin: 0; line-height: 1.4;
  flex: 1; min-width: 0;
}

/* 关闭按钮 */
.confirm-close {
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer; padding: 0;
  color: var(--color-text-secondary, #7C8493);
  border-radius: var(--radius-r2, 4px);
  transition: all var(--transition-fast, 0.15s);
  flex-shrink: 0;
}
.confirm-close:hover {
  background-color: var(--color-bg-hover, #EDF3FA);
  color: var(--color-primary, #3685F2);
}
.confirm-close .icon { width: 16px; height: 16px; }

/* 描述区 */
.confirm-body {
  margin-top: var(--spacing-md, 12px);
}
.confirm-desc {
  font-size: var(--font-size-sm, 12px);
  color: var(--color-text-secondary, #7C8493);
  line-height: var(--line-height-base, 1.5);
  margin: 0;
}

/* 按钮区：居右排列，左次右主 */
.confirm-footer {
  display: flex; justify-content: flex-end;
  gap: var(--spacing-md, 12px);
  margin-top: var(--spacing-lg, 20px);
}

/* ===== 四态类型变体（图标颜色随类型变化，主按钮颜色遵循按钮规范） ===== */

/* 通用型 - circle-info + 蓝色图标，主按钮 .btn-primary */
.confirm-info .confirm-icon { color: var(--color-primary, #3685F2); }

/* 成功型 - circle-info + 蓝色图标，主按钮 .btn-primary */
.confirm-success .confirm-icon { color: var(--color-primary, #3685F2); }

/* 警告型 - warning + 橙色图标，主按钮 .btn-warning（特殊规则：与图标同色） */
.confirm-warning .confirm-icon { color: var(--color-warning, #FF813B); }
.confirm-warning .btn-warning {
  background-color: var(--color-warning, #FF813B);
  color: var(--color-text-white, #FFFFFF);
  border: none;
}
.confirm-warning .btn-warning:hover { background-color: var(--color-warning-hover, #FFAE81); }
.confirm-warning .btn-warning:active { background-color: var(--color-warning-active, #D46B08); }

/* 危险型 - warning + 红色图标，主按钮 .btn-danger */
.confirm-danger .confirm-icon { color: var(--color-error, #FF4D5D); }
.confirm-danger .btn-danger {
  background-color: var(--color-error, #FF4D5D);
  color: var(--color-text-white, #FFFFFF);
  border: none;
}
.confirm-danger .btn-danger:hover { background-color: var(--color-error-hover, #FF717D); }
.confirm-danger .btn-danger:active { background-color: var(--color-error-active, #D93649); }
```

---

## 7. 完整 HTML 结构

### 7.1 通用型（确认启用/停用/提交）

```html
<div class="confirm-overlay confirm-info" id="confirmEnable" onclick="closeConfirmOnOverlay(event, 'confirmEnable')">
  <div class="confirm-dialog confirm-info">
    <div class="confirm-header">
      <div class="confirm-title-group">
        <svg class="icon confirm-icon"><use href="#icon-circle-info"></use></svg>
        <h3 class="confirm-title">确认启用该账号？</h3>
      </div>
      <button class="confirm-close" onclick="closeConfirm('confirmEnable')" title="关闭">
        <svg class="icon"><use href="#icon-remove"></use></svg>
      </button>
    </div>
    <div class="confirm-body">
      <p class="confirm-desc">启用后该用户可正常登录系统，此操作可随时撤销。</p>
    </div>
    <div class="confirm-footer">
      <button class="btn btn-secondary" onclick="closeConfirm('confirmEnable')">取消</button>
      <button class="btn btn-primary" onclick="handleEnableConfirm()">确定</button>
    </div>
  </div>
</div>
```

### 7.2 危险型（删除确认）

```html
<div class="confirm-overlay" id="confirmDelete" onclick="closeConfirmOnOverlay(event, 'confirmDelete')">
  <div class="confirm-dialog confirm-danger">
    <div class="confirm-header">
      <div class="confirm-title-group">
        <svg class="icon confirm-icon"><use href="#icon-warning"></use></svg>
        <h3 class="confirm-title">确认删除该记录？</h3>
      </div>
      <button class="confirm-close" onclick="closeConfirm('confirmDelete')" title="关闭">
        <svg class="icon"><use href="#icon-remove"></use></svg>
      </button>
    </div>
    <div class="confirm-body">
      <p class="confirm-desc">删除后数据将无法恢复，请谨慎操作。</p>
    </div>
    <div class="confirm-footer">
      <button class="btn btn-secondary" onclick="closeConfirm('confirmDelete')">取消</button>
      <button class="btn btn-danger" onclick="handleDeleteConfirm()">确定删除</button>
    </div>
  </div>
</div>
```

### 7.3 警告型（禁用/取消操作）

```html
<div class="confirm-overlay" id="confirmDisable" onclick="closeConfirmOnOverlay(event, 'confirmDisable')">
  <div class="confirm-dialog confirm-warning">
    <div class="confirm-header">
      <div class="confirm-title-group">
        <svg class="icon confirm-icon"><use href="#icon-warning"></use></svg>
        <h3 class="confirm-title">确认禁用该账号？</h3>
      </div>
      <button class="confirm-close" onclick="closeConfirm('confirmDisable')" title="关闭">
        <svg class="icon"><use href="#icon-remove"></use></svg>
      </button>
    </div>
    <div class="confirm-body">
      <p class="confirm-desc">禁用后该用户将无法登录系统，但历史数据保留。</p>
    </div>
    <div class="confirm-footer">
      <button class="btn btn-secondary" onclick="closeConfirm('confirmDisable')">取消</button>
      <button class="btn btn-warning" onclick="handleDisableConfirm()">确定</button>
    </div>
  </div>
</div>
```

### 7.4 成功型（操作后引导）

```html
<div class="confirm-overlay" id="confirmSuccess" onclick="closeConfirmOnOverlay(event, 'confirmSuccess')">
  <div class="confirm-dialog confirm-success">
    <div class="confirm-header">
      <div class="confirm-title-group">
        <svg class="icon confirm-icon"><use href="#icon-circle-info"></use></svg>
        <h3 class="confirm-title">提交成功</h3>
      </div>
      <button class="confirm-close" onclick="closeConfirm('confirmSuccess')" title="关闭">
        <svg class="icon"><use href="#icon-remove"></use></svg>
      </button>
    </div>
    <div class="confirm-body">
      <p class="confirm-desc">数据已保存成功，是否继续新增下一条记录？</p>
    </div>
    <div class="confirm-footer">
      <button class="btn btn-secondary" onclick="closeConfirm('confirmSuccess')">返回列表</button>
      <button class="btn btn-primary" onclick="handleContinueAdd()">继续新增</button>
    </div>
  </div>
</div>
```

---

## 8. 完整 JS 交互代码

```javascript
/* ============================================================
 * 确认对话框交互（打开/关闭/ESC/遮罩关闭）
 * 与弹窗（modal.js）独立，互不干扰
 * ============================================================ */

// 打开确认对话框
function openConfirm(id) {
  document.getElementById(id).classList.add('show');
  document.body.style.overflow = 'hidden';
}

// 关闭确认对话框
function closeConfirm(id) {
  document.getElementById(id).classList.remove('show');
  document.body.style.overflow = '';
}

// 点击遮罩关闭
function closeConfirmOnOverlay(event, id) {
  if (event.target === event.currentTarget) {
    closeConfirm(id);
  }
}

// ESC 关闭所有确认对话框
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.confirm-overlay.show').forEach(function(dialog) {
      dialog.classList.remove('show');
    });
    document.body.style.overflow = '';
  }
});

// 挂载到 window
window.openConfirm = openConfirm;
window.closeConfirm = closeConfirm;
window.closeConfirmOnOverlay = closeConfirmOnOverlay;
```

---

## 9. 交互规范

| 交互项 | 触发元素 | 行为 | 函数 |
|--------|---------|------|------|
| **打开** | 删除/禁用/提交等按钮 | 显示对话框 + 遮罩 + 禁止 body 滚动 | `openConfirm(id)` |
| **关闭-×按钮** | 右上角关闭图标 | 隐藏对话框 + 遮罩 + 恢复 body 滚动 | `closeConfirm(id)` |
| **关闭-遮罩** | `.confirm-overlay` | 点击遮罩区域关闭 | `closeConfirmOnOverlay(event, id)` |
| **关闭-ESC** | `document` | 按 ESC 键关闭所有确认对话框 | `keydown` 监听 |
| **关闭-取消** | `.btn-secondary` | 取消按钮关闭 | `closeConfirm(id)` |
| **确定** | `.btn-primary` / `.btn-warning` / `.btn-danger` | 执行业务回调 + 关闭 | 业务函数（如 `handleDeleteConfirm()`） |

> **四种关闭方式**：×按钮、遮罩点击、ESC键、取消按钮。交付前必须全部可用。

---

## 10. 使用指引

### 10.1 何时使用确认对话框

| 场景 | 推荐组件 | 原因 |
|------|---------|------|
| 删除单条/批量删除 | ✅ `.confirm-danger` | 不可逆操作需二次确认 |
| 禁用/启用账号 | ✅ `.confirm-warning` / `.confirm-info` | 状态变更需用户确认 |
| 提交表单前确认 | ✅ `.confirm-info` | 重要操作前提示 |
| 清空数据/重置配置 | ✅ `.confirm-danger` | 不可恢复操作 |
| 操作成功后引导 | ✅ `.confirm-success` | 成功反馈 + 下一步引导 |
| 重命名/修改密码等简单编辑 | ✅ `.confirm-info` | 单字段轻量编辑，无需弹窗 |
| 复杂表单/多字段数据录入 | ❌ 弹窗 [modal.md](modal.md) | 弹窗用于复杂表单编辑 |
| 被动通知（无确认） | ❌ 消息提示 | 消息提示无需用户决策 |

### 10.2 确认对话框 vs 弹窗

| 对比项 | 确认对话框 | 弹窗 |
|--------|-----------|------|
| 使用场景 | 操作前二次确认 / 简单编辑（重命名/修改密码） | 复杂表单编辑/多字段数据录入 |
| 内容 | 图标+标题+描述/输入框+按钮 | 标题栏+完整表单+底栏 |
| 尺寸 | 固定 404px | 三档（588/908/全屏） |
| 表单元素 | ✅ 简单（单字段输入框） | ✅ 完整表单（多字段） |
| 标题栏 | 无蓝色标题栏 | 蓝色标题栏 40px |
| 类型变体 | 4态（通用/成功/警告/危险） | 无类型变体 |
| 调用方式 | `openConfirm(id)` | `openModal(id)` |
| 层级 | 与弹窗同级（1001/1002） | 同左 |

### 10.3 类型选择决策

```
普通确认（启用/停用/提交）        → 通用型 .confirm-info（蓝色图标 + btn-primary）
成功后引导（是否继续）            → 成功型 .confirm-success（蓝色图标 + btn-primary）
风险提示（禁用/取消/不可逆非删除）  → 警告型 .confirm-warning（橙色图标 + btn-warning）
危险操作（删除/批量删除/清空数据）  → 危险型 .confirm-danger（红色图标 + btn-danger）
```

---

## 11. 质量检查清单

> 每次使用确认对话框时逐项检查，全部通过后方可交付。

### 11.1 结构检查
- [ ] 包含 `.confirm-overlay` 遮罩层
- [ ] 容器使用 `.confirm-dialog` + 类型修饰符（`.confirm-info`/`.confirm-success`/`.confirm-warning`/`.confirm-danger`）
- [ ] 标题区使用 `.confirm-header`，包含 `.confirm-title-group`（图标+标题）和 `.confirm-close`
- [ ] 图标使用 `.confirm-icon`，20×20px，图标 ID 正确
- [ ] 标题使用 `.confirm-title`，14px + 字重600
- [ ] 关闭按钮使用 `.confirm-close`，图标为 `#icon-remove`，图标 16×16px，容器 20×20px
- [ ] 描述区使用 `.confirm-body` > `.confirm-desc`
- [ ] 按钮区使用 `.confirm-footer`，居右排列，左次右主
- [ ] 按钮高度 28px（默认尺寸）

### 11.2 尺寸与间距检查
- [ ] 容器宽度 `404px`（固定）
- [ ] 容器内边距 `20px`（上下左右统一）
- [ ] 标题与描述间距 `12px`（`.confirm-body { margin-top: 12px }`）
- [ ] 描述与按钮间距 `20px`（`.confirm-footer { margin-top: 20px }`）
- [ ] 按钮间距 `12px`（`.confirm-footer { gap: 12px }`）
- [ ] 图标与标题间距 `4px`（`.confirm-title-group { gap: 4px }`）
- [ ] 按钮高度 `28px`（默认尺寸）

### 11.3 颜色检查
- [ ] 图标颜色与类型修饰符对应（通用/成功=蓝、警告=橙、危险=红）
- [ ] 主按钮颜色遵循按钮规范：通用/成功型用 `.btn-primary`（蓝色），警告型用 `.btn-warning`（橙色，特殊规则），危险型用 `.btn-danger`（红色）
- [ ] 禁止使用 `.btn-success`（绿色）等非标准按钮颜色
- [ ] 描述文字使用 `var(--color-text-secondary)`
- [ ] 关闭按钮默认色 `var(--color-text-secondary)`，hover 图标色 `var(--color-primary)`（主题蓝）
- [ ] 所有样式值使用 CSS 变量，无硬编码

### 11.4 交互检查
- [ ] `openConfirm(id)` 能正确打开
- [ ] `closeConfirm(id)` 能正确关闭
- [ ] 点击遮罩可关闭
- [ ] ESC 键可关闭
- [ ] 取消按钮可关闭
- [ ] 确定按钮绑定业务回调函数
- [ ] 关闭后 body overflow 恢复
