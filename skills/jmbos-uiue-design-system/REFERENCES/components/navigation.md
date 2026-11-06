# 导航栏与菜单 Navigation — 规范指南

> 版本: v5.1.1 | 最后更新: 2026-05-27
>
> 📌 **定位**: 本文件为**导航组件规范指南**，提供规则要点、结构图和速查表。
> 📖 **完整代码模板**（可直接复制）请查阅 [nav-menu-full-code.md](./nav-menu-full-code.md)

📌 **重要提示**: 本章节所有颜色/尺寸/间距值均来自 [design-tokens.css](../design-tokens.css)，实现时请优先引用 CSS 变量而非硬编码数值。

## 导航栏与菜单 (Navigation) ⭐ v5.1.1

> 页面级布局组件：**顶部导航栏 (42px)** + **左侧菜单栏 (180px)**

### 目录

- [顶部导航栏 Top Navigation](#顶部导航栏-top-navigation)
  - [布局结构](#布局结构)
  - [尺寸规范](#尺寸规范)
  - [Logo区域](#logo区域)
  - [导航菜单项 v5.1.0 强制规范](#导航菜单项--v510-强制规范)
  - [右侧功能区](#右侧功能区)
  - [交互状态表](#交互状态表)
- [左侧菜单栏 Sidebar Menu](#左侧菜单栏-sidebar-menu)
  - [布局结构](#布局结构-1)
  - [尺寸规范](#尺寸规范-1)
  - [菜单层级与图标规则](#菜单层级与图标规则)
  - [交互状态（⭐核心：hover不变色）](#交互状态核心hover不变色)
- [图标集成](#图标集成)

***

## 顶部导航栏 Top Navigation

### 布局结构

```
┌─────────────────────────────────────────────────────────────────┐
│ [Logo 180px] │ 菜单1│菜单2│菜单3│...│          │ [功能区]      │ ← 42px高
└─────────────────────────────────────────────────────────────────┘
↑无padding     ↑gap:0 ↑margin-left:0                      ↑padding-right:20px
```

| 区域 | CSS类 | 说明 |
|------|-------|------|
| 整体容器 | `.top-nav` | `position:fixed; height:42px; background:#0C328C` |
| 左侧区域 | `.top-nav-left` | 包含Logo + 菜单项，`display:flex` |
| Logo容器 | `.top-nav-brand` | 纯展示，无点击/悬停交互 |
| Logo图片 | `.top-nav-logo` | SVG内联，width:180px，支持动态变色 |
| 菜单容器 | `.top-nav-menu` | `flex:1; gap:0; margin-left:0` |
| 菜单项 | `.nav-menu-item` | height:100%撑满42px，border-radius:0 |
| 右侧功能区 | `.top-nav-right` | 图标按钮、组织选择器等 |

📖 [→ 完整 HTML 模板 + CSS 代码](./nav-menu-full-code.md#顶部导航栏--左侧菜单-完整模板)

### 尺寸规范

| 属性 | 值 | 说明 |
|------|-----|------|
| **高度** | **42px** | 固定值 |
| **Logo宽度** | **180px** | viewBox原始宽度，禁止缩放 |
| **Logo高度** | ≈42px | 按viewBox比例(180:42)自动计算 |
| **菜单项高度** | 42px (100%) | 继承父容器高度 |
| **菜单项内边距** | `0 16px` | 左右各16px |
| **菜单项间距** | **0** (`gap:0`) | 无间距，紧密排列 |
| **Logo与菜单间距** | **0** (`margin-left:0`) | 紧贴排列 |
| **导航栏左padding** | **0** | Logo紧贴浏览器左边缘 |
| **导航栏右padding** | **20px** | 给功能区留空间 |

> ⚠️ **高频错误**: 之前版本使用 `margin-left:24px` 或 `padding:0 20px`，已修正为左右不对称padding + 零间距

### Logo区域

📖 [→ 完整规范（含三级降级方案+代码）](./nav-menu-full-code.md#logo-集成规范)

| 属性 | 规范 |
|------|------|
| **文件来源** | `ASSETS/brand/logo（支持替换颜色）.svg` |
| **格式** | SVG（支持currentColor动态变色） |
| **显示方式** | 原始尺寸展示（width:180px, height:auto） |
| **交互** | **纯展示** — 无点击、无悬停效果 |
| **动态变色** | 深色背景→白色(#FFF) / 浅色背景→品牌蓝(#0C328C) |

**技术要点**:

- ❌ **绝对禁止** 在 `<svg>` 标签上写内联 `width/height` 属性（HTML属性优先级>CSS）
- ✅ 仅保留 `class="top-nav-logo"` + `viewBox="0 0 180 42"`
- ✅ 通过CSS `color` 属性控制SVG内部 `fill="currentColor"` 的颜色

**降级方案 (v5.0.0)**：

| 方案 | 适用场景 | 实现方式 |
|------|---------|---------|
| **方案1：完整SVG**（首选） | 正常情况 | 从 ASSETS/brand 复制完整路径元素 |
| **方案2：PNG图片降级** | SVG不可用时 | PNG + onerror 切换到文字 |
| **方案3：纯文字降级** | 最终兜底 | 显示 "JOMOO九牧" 文本 |

> **⚠️ 强制要求**: 所有页面模板必须至少实现**方案1+方案3**的组合（SVG + 文字fallback）

### 导航菜单项 — v5.1.0 强制规范

📖 [→ 完整 CSS 代码](./nav-menu-full-code.md#css-样式详解)

> ⚠️ **v5.1.0 重要更新：文字样式必须严格遵守！**

| 属性 | ✅ 正确值 | ❌ 错误值 | 说明 |
|------|---------|---------|------|
| **font-size** | **14px**（固定值） | `var(--font-size-body)` / 12px / 16px | 禁止使用变量或非14px值 |
| **font-weight** | **600**（SemiBold） | 400 / 500 / `var(--font-weight-regular)` | 禁止字重不足 |
| **color** | **#FFFFFF**（100%不透明） | `rgba(255,255,255,0.85)` | 禁止85%透明度 |
| **height** | **42px** (`height:100%`) | `height: auto` / 固定像素值 | 必须继承父容器高度 |
| **line-height** | **1**（重置） | 缺失或设置具体值 | 配合flex居中生效 |
| **box-sizing** | **border-box** | 缺失（默认content-box） | 防止padding撑破高度 |

**⚠️ v5.1.1 高度问题修复（重要）**:
仅设置 `height: 100%` 在flex布局中可能不够，必须同时设置以下3个属性：
- `min-height: 42px;` — 防止高度塌陷
- `line-height: 1;` — 重置行高让flex居中生效
- `box-sizing: border-box;` — 确保padding不会增加实际高度

### 右侧功能区

| 元素 | 说明 |
|------|------|
| 组织选择器 | 下拉切换，4px圆角，hover时浅白底 |
| 图标按钮 | 20×20px，白色，8px间距(`gap:spacing-md`) |

### 交互状态表

| 状态 | 背景色 | 文字色 | 字号 | 字重 | 说明 |
|------|--------|--------|------|------|------|
| **默认** | 透明 | **#FFFFFF** (100%不透明) | **14px** | **600** (SemiBold) | ⚠️ 禁止85%透明度、禁止字重400 |
| **Hover** | `rgba(255,255,255,0.10)` | **#FFFFFF** | 14px | 600 | 浅白底+纯白字 |
| **Active(当前页)** | **#FFFFFF** (纯白) | `var(--color-brand)` (品牌色) | 14px | **600** | ⭐ 纯白背景+品牌色文字 |

**视觉特征**：圆角 **0**（无圆角矩形块），字体 **14px / 600**（SemiBold）（固定值）

***

## 左侧菜单栏 Sidebar Menu

### 布局结构

```
┌──────┐
│ 首页  │  ← 二级菜单: padding 0 12px, 高度32px（顶部导航为一级）
│ ──── │
│ ▸三级│  ← 三级菜单: 有展开箭头(16×16px), 可有20×20px图标
│  ├四级│  ← 四级子菜单: padding-left 48px(通铺+缩进)
│  ├四级│
│  └四级│
│ ▸三级│
└──────┘
 ↑width:180px
 ↑position:fixed, top:42px(导航栏下方)
```

📖 [→ 完整 HTML 结构 + CSS 代码](./nav-menu-full-code.md#css-样式详解)

### 尺寸规范

| 属性 | 值 | 说明 |
|------|-----|------|
| **宽度** | **180px** | 固定值 |
| **位置** | fixed, top:42px, left:0 | 紧贴顶部导航下方 |
| **背景色** | `#FFFFFF` (卡片背景) | |
| **右边框** | 1px solid 分割线色 | |
| **菜单项高度** | **32px** | 二/三/四级统一 |
| **菜单项字号** | **13px** | 二/三/四级统一 |
| **菜单项内边距** | `0 12px` | 二/三级 |
| **子菜单文字缩进** | **left: 48px** | 四/五级（= 12px基础 + 36px额外） |
| **子菜单容器padding** | **left: 0** | 背景色通铺全宽 |
| **容器上下padding** | `8px 0` | 顶部和底部留白 |
| **溢出处理** | `overflow-x: hidden` + 文本 `text-overflow: ellipsis` | 禁止横向滚动，长文本省略号截断 |

### 菜单层级与图标规则

| 层级 | 图标 | 展开箭头 | 说明 |
|------|------|---------|------|
| **二级** | ❌ 禁止 | ❌ 无 | 纯文字菜单项 |
| **三级** | ✅ 允许(**20×20px**) | ✅ 有(**16×16px**) | 可折叠，箭头在右侧 |
| **四级** | ❌ 禁止 | ❌ 无 | 子菜单项，继承三级hover效果 |
| **五级** | ❌ 禁止 | ❌ 无 | 同四级 |

**图标规范（仅三级菜单）**:

| 属性 | 值 |
|------|-----|
| 尺寸 | **20×20px**（不是16px！）|
| 与文字间距 | **8px** (`margin-right`) |
| 默认颜色 | `#141b24`（主文本色，**不是 #7C8493**）|
| 选中态颜色 | `#3685F2`（主题蓝色）|

### 交互状态（⭐核心：hover不变色）

> **这是本系统最重要的交互规则之一**

| 层级 | Hover时背景色 | Hover时文字色 | 关键说明 |
|------|-------------|-------------|---------|
| **二/三级** | `#EDF3FA`（浅蓝灰） | **不变色**（保持`#141b24`） | 仅背景变色！ |
| **四/五级** | `#EDF3FA`（浅蓝灰） | **不变色**（保持`#141b24`） | 继承三级效果 |
| **展开状态(.expanded)** | `#EDF3FA`（浅蓝灰） | **不变色**（保持`#141b24`） | 展开状态也支持hover背景色 |
| **选中态(任意层级)** | `#DEEDFF`（更深的浅蓝） | `#3685F2`（主题蓝） | 背景和文字都变 |

**✅ 正确示例**：

```css
.sidebar-menu-item:hover {
  background-color: #EDF3FA;   /* ✅ 只有背景变色 */
}
```

**❌ 错误示例（禁止）**：

```css
.sidebar-menu-item:hover {
  background-color: #EDF3FA;
  color: #3685F2;   /* ❌ 禁止！hover时文字不能变色 */
}

/* ❌ v5.1.2 禁止！展开状态设置transparent会覆盖hover背景色 */
.sidebar-menu-item.expanded {
  background-color: transparent;  /* ❌ 导致展开状态hover无背景色 */
}
```

📖 [→ 完整 CSS 代码（sidebar 全部样式）](./nav-menu-full-code.md#2-左侧菜单栏-180px)

---

## 图标集成

📖 **完整 HTML 代码（含具体 SVG path）+ 图标映射表 → [nav-menu-full-code.md §完整示例](./nav-menu-full-code.md#-完整示例左侧菜单--图标集成-v500)**

左侧菜单的二级菜单项支持 20×20px 图标，常用图标映射：

| 菜单项 | 推荐图标 | 备注 |
|--------|---------|------|
| 首页/仪表盘 | `dashboard.svg` | |
| 内容管理 | `component.svg` | |
| 系统设置 | `cog.svg` / `scheme.svg` | |
| 用户管理 | `users.svg` / `org-user.svg` | |
| 消息通知 | `comment.svg` / `inbox.svg` | |
| 数据统计 | `pie chart.svg` | 文件名含空格 |
| 流程管理 | `flow path.svg` | 文件名含空格 |

> 📖 **完整 20 行图标映射表 + 使用注意事项** → [nav-menu-full-code.md §常用图标映射表](./nav-menu-full-code.md#常用图标映射表完整版)

---

## 相关文件

| 文件 | 用途 |
|------|------|
| **[nav-menu-full-code.md](./nav-menu-full-code.md)** | **完整代码模板**（HTML+CSS 可直接复制、Logo 三级降级代码、完整侧边栏 HTML 含 SVG、图标映射表） |
| [icons/README.md](../ASSETS/icons/README.md) | 图标快速指南（#5 导航菜单图标场景） |
| [components/icons.md](./icons.md) | 图标完整规范 |
| [design-tokens.css](../design-tokens.css) | 设计令牌（CSS 变量定义） |
| [brand/README.md](../ASSETS/brand/README.md) | Logo 资源与规范 |

---

*最后更新: 2026-05-27 | 版本: v5.1.1（重构为规范指南，完整代码已迁移至 nav-menu-full-code.md）*
