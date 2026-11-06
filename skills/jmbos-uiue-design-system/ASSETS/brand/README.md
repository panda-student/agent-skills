# Logo 图片使用规范

> **版本**: v2.5.0
> **最后更新**: 2026-05-28
> **状态**: ✅ 正式生效

---

## 📌 核心定位

本规范定义了 JMBOS UIUE 设计系统中 Logo 图片的**存放位置**、**命名规则**、**尺寸要求**、**调用方式**和**动态变色功能**,确保所有生成的页面原型统一展示品牌标识,并支持在不同导航状态下自动切换颜色。

---

## 📁 1. 存放目录规范

### 1.1 官方指定目录

```
jmbos-uiue-design-system/
└── ASSETS/
    └── brand/                    ← 🎯 Logo专用目录(新建)
        ├── logo（支持替换颜色）.svg  ← 主Logo文件(矢量格式,支持动态变色)
        ├── logo.svg             ← 主Logo文件(标准命名,可选)
        ├── logo.png             ← 主Logo文件(位图格式,备用)
        └── README.md            ← 本文件
```

### 1.2 目录创建命令

```bash
# 在 ASSETS 目录下创建 brand 子目录
mkdir -p jmbos-uiue-design-system/ASSETS/brand

# 上传你的Logo图片到该目录
# 支持格式: .svg (推荐,支持动态变色) / .png / .jpg
```

### 1.3 为什么放在 `ASSETS/brand/` 目录?

| 原因 | 说明 |
|------|------|
| **资源统一管理** | ASSETS 是所有设计资产的根目录 |
| **语义清晰** | `brand` 明确表示品牌相关资源 |
| **避免混淆** | 与 icons/(图标) 和 component-reference/(组件图) 分离 |
| **便于维护** | 未来可扩展 favicon、brand-guidelines 等 |

---

## 📐 2. Logo 规格要求

### 2.1 推荐规格

| 属性 | 推荐值 | 必须遵守 |
|------|--------|----------|
| **文件格式** | **🥇 SVG (矢量,首选)** / 🥈 PNG (透明底,降级) | ✅ 优先使用SVG |
| **显示尺寸** | **使用图片原始尺寸** (不强制缩放) | ✅ v1.3.0更新 |
| **文件大小** | SVG ≤ 50KB / PNG ≤ 100KB | ⚠️ 建议 |
| **颜色模式** | 支持透明通道 (Alpha) + **支持filter处理** | ✅ 强制 |
| **背景色** | **透明背景** (非白色) | ✅ 强制 |
| **颜色特性** | **必须支持动态变色** (CSS filter方案) | ⭐ v2.5.0更新 |

> 💡 **格式选择指南**:
> - **95%场景**: 使用 `.svg` 文件 + `img` 标签 + CSS filter ([方案C](#方案c-img标签引用-svg--css-filter-⭐⭐⭐--首选推荐--v250))
> - **5%场景**: 仅当SVG不可用时,才使用 `.png` / `.jpg` ([方案B](#方案b-img标签引用-pngjpg-⭐-降级方案--不支持动态变色))

### 2.2 Logo 尺寸说明 (v1.3.0更新)

> **核心原则**: Logo按照**图片原始尺寸**展示,不进行强制缩放

- Logo会根据SVG/PNG的**原始viewBox或尺寸**自动渲染
- 无需设置固定的 `height` 或 `width` 值
- 如需调整Logo大小,请修改**源文件**本身,而非通过CSS缩放
- 这确保了Logo在不同场景下的**清晰度和一致性**

### 2.3 ⭐ 动态变色要求 (v1.1.0核心功能)

#### A. 为什么需要动态变色?

| 场景 | 背景颜色 | Logo应该显示的颜色 |
|------|---------|------------------|
| **默认状态** (深色导航栏) | `#0C328C` (品牌蓝) | **白色 (#FFFFFF)** |
| **浅色模式/其他场景** | 白色/浅灰色 | **品牌色 (#0C328C)** |
| **悬停状态** | 保持原背景 | 可选轻微透明度变化 |

#### B. 技术实现方案 (按推荐顺序)

**方案4: CSS filter (⭐⭐⭐ 首选推荐 - v2.5.0)**

> ✅ **核心优势**: 无需修改SVG源文件 + 代码极简 + 性能优秀 + 维护成本低

```css
/* 深色背景 → 白色Logo (推荐用于 #0C328C 导航栏背景) */
.top-nav-logo {
  filter: brightness(0) invert(1);
}

/* 浅色背景 → 品牌色Logo (显示SVG原始fill颜色) */
.light-background .top-nav-logo {
  filter: none;
}
```

**技术原理**:
- `brightness(0)`: 将所有颜色转为黑色
- `invert(1)`: 将黑色反转为白色（完整反转颜色通道）
- 组合效果: **任何颜色的Logo都能变成白色**

---

> 💡 **历史备选方案** (已不推荐): 早期版本曾支持 `currentColor`、CSS变量(`var(--logo-color)`)、直接修改`fill`属性等方式实现动态变色,但这些方案均需修改SVG源文件或使用内联SVG,维护成本较高。
>
> ✅ **当前首选**: 以上述 **方案4 CSS filter** 为唯一推荐方案

**优势对比**:

| 对比维度 | currentColor方案 | **CSS filter方案(首选)** |
|---------|-----------------|------------------------|
| **代码量** | 需修改SVG源文件(fill="currentColor") | 一行CSS搞定 |
| **文件依赖** | 必须使用特制版SVG | 可使用原始Logo文件 |
| **维护成本** | 更换Logo需重新修改fill属性 | 只需替换文件 |
| **浏览器性能** | 极优 | 极优 (GPU加速) |
| **兼容性** | IE9+ | IE9+ |
| **精确度** | ⭐⭐⭐ 精确控制 | ⭐⭐ 足够精准(单色Logo) |

**适用场景**:
- ✅ **95%的场景**: 推荐使用 **方案4 CSS filter** (简洁高效)
- ⚠️ **特殊情况**: 如需精细控制SVG内部元素动画,才考虑方案1 currentColor

---

## 🔧 3. 调用方式规范

### 3.1 ⭐ 强制调用位置

**所有包含顶部导航栏的页面必须默认加载 Logo!**

适用场景:
- ✅ 列表页 (list.html)
- ✅ 详情页 (detail.html)
- ✅ 表单页 (form.html)
- ✅ 弹窗页面 (modal.html, 如有顶部导航)
- ✅ 仪表盘 (dashboard)

### 3.2 HTML 调用代码 (标准写法 - 支持动态变色 + 纯展示无交互)

> ⚠️ **重要 (v1.2.0)**: Logo区域为**纯展示性元素**,不包含点击跳转、悬停效果等任何交互行为!

#### 方案A: SVG 内联方式 + currentColor (仅特殊场景使用)

> **当前状态**: 骨架模板已统一使用 [方案C](#方案c-img标签引用-svg--css-filter-⭐⭐⭐--首选推荐--v250)（img+filter）
>
> **保留原因**: 仅当需精细控制 SVG 内部元素动画时才考虑此方案。实现方式：将 SVG 内容内联 + `fill="currentColor"` + CSS `color` 属性控制颜色。
>
> **迁移建议**: 新页面请直接使用方案C，无需再手动内联 SVG path 数据。

> 📎 **导航栏完整布局规范** → [components.md §顶部导航栏](../REFERENCES/components.md#顶部导航栏-top-navigation) (v4.19.0)

#### 方案B: img标签引用 PNG/JPG (⭐ 降级方案 - 不支持动态变色)

> ⚠️ **格式优先级**: **PNG/JPG (位图) - 仅当SVG不可用时使用**
>
> ⚠️ **注意**: 位图格式**不支持动态变色** (filter会整体反转,效果不理想),仅作为**降级方案**

**适用场景**:
- ❌ 无SVG文件时临时替代
- ❌ Logo不需要变色功能时
- ❌ 兼容性测试或快速原型

```html
<header class="top-nav">
  <div class="top-nav-left">
    <!-- Logo区域: 使用img标签引用PNG (降级方案) -->
    <div class="top-nav-brand">
      <img
        src="../ASSETS/brand/logo.png"
        alt="JOMOO九牧"
        class="top-nav-logo"
      >
    </div>
  </div>
</header>
```

> 💡 **建议**: 尽快替换为 [方案C (SVG格式)](#方案c-img标签引用-svg--css-filter-⭐⭐⭐--首选推荐--v250) 以获得更好的显示效果和动态变色支持

#### 方案C: img标签引用 SVG + CSS filter (⭐⭐⭐ **首选推荐** - v2.5.0)

> ✅ **格式优先级**: **SVG (矢量) > PNG/JPG (位图)**
>
> ✅ **核心优势**: 代码简洁 + 支持动态变色 + 解决Logo显示不全和额外间距问题

**适用场景**:
- ✅ 所有需要显示Logo的页面 (**SVG格式首选方案**)
- ✅ 特别适合AI自动生成场景
- ✅ 需要动态变色功能 (深色背景↔浅色背景)
- ✅ 解决实战中发现的Logo显示不全问题

**HTML结构**:
```html
<div class="top-nav-brand">
  <img
    class="top-nav-logo"
    src="../ASSETS/brand/logo（支持替换颜色）.svg"
    alt="JOMOO九牧"
  >
</div>
```

**CSS样式**:
```css
.top-nav-brand {
  display: inline-flex;
  align-items: center;
  padding: 0;  /* 明确无内边距，防止额外间距 */
}

.top-nav-logo {
  width: 180px;           /* viewBox=0 0 180 42, 原始宽度 */
  height: auto;           /* 高度按比例 ≈ 42px */
  display: block;

  /* 动态变色：深色背景反转为白色 */
  filter: brightness(0) invert(1);
}

/* 浅色背景场景：显示SVG原始颜色(品牌蓝#0C328C) */
.light-background .top-nav-logo {
  filter: none;
}
```

> 📎 **路径说明**: `src` 属性需根据实际项目结构调整相对路径
> 📎 **导航栏完整布局规范** → [components.md §顶部导航栏](../REFERENCES/components.md#顶部导航栏-top-navigation)

### 3.3 CSS 样式规范 (v2.5.0: 以img+filter方案为主)

```css
/* ===== 顶部导航栏 Logo 样式 (v2.5.0: img+filter首选方案) ===== */

/* Logo容器 - 纯展示性元素 */
.top-nav-brand {
  display: inline-flex;
  align-items: center;
  padding: 0;  /* v2.5.0明确：无内边距，防止Logo区域产生额外间距 */
}

/* ⭐ 首选方案: img标签 + CSS filter */
.top-nav-logo {
  width: 180px;                  /* viewBox=0 0 180 42, 原始宽度 (v2.1.0) */
  height: auto;                 /* 高度按比例 ≈ 42px */
  display: block;

  /* 深色背景反转为白色 */
  filter: brightness(0) invert(1);
}

/* ===== 场景切换 ===== */

/* 浅色背景：显示SVG原始颜色(品牌蓝#0C328C) */
.light-background .top-nav-logo {
  filter: none;
}

/* 禁用状态 (可选) */
.disabled .top-nav-logo {
  opacity: 0.5;
}

/* ⭐ 文字Logo降级方案 (v2.6.1更新) */
.top-nav-logo-text {
  width: 180px;           /* ⭐ 关键：保持与SVG Logo一致的180px宽度 */
  height: 42px;           /* 与导航栏高度一致 */
  display: flex;
  align-items: center;
  justify-content: center; /* ⭐ 文字水平居中 */
  color: #FFFFFF;         /* 深色背景下白色文字 */
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;          /* 左右留点内边距 */
  box-sizing: border-box;
}

/* 浅色背景下文字Logo显示品牌色 */
.light-background .top-nav-logo-text {
  color: #0C328C;
}

/* ⭐ 浅色导航栏背景色 */
.top-nav-light {
  background: #FFFFFF;
  border-bottom: 1px solid #E0E0E0;
}

.top-nav-light .top-nav-brand {
  border-right-color: rgba(0,0,0,0.1);
}
```

> 💡 **备选说明**: 如需使用SVG内联+currentColor方案（不推荐），请参考[方案A](#方案a-svg-内联方式--currentcolor--备选方案---不推荐)
>
> 💡 **文字Logo说明**: 当SVG Logo不可用时，使用 `<span class="top-nav-logo-text">JOMOO九牧</span>` 作为降级方案，必须定义 `width: 180px` 以保持Logo区域宽度稳定。

### 3.4 ⭐ Logo集成指南 (v2.5.0: 推荐img+filter方案)

#### 方式1: 使用img+filter (⭐⭐⭐ 首选 - 无需修改SVG源文件)

**步骤**: 直接使用原始Logo文件 + CSS filter控制颜色

```html
<!-- HTML: 使用img标签 -->
<img class="top-nav-logo" src="../ASSETS/brand/logo.svg" alt="JOMOO九牧">
```

```css
/* CSS: 通过filter控制颜色 */
.top-nav-logo {
  width: 180px;
  height: auto;
  display: block;
  filter: brightness(0) invert(1);  /* 深色背景→白色 */
}

.light-background .top-nav-logo {
  filter: none;  /* 浅色背景→显示原色 */
}
```

> ✅ **优势**: 零修改SVG文件,一行CSS搞定,维护成本最低
>
> 💡 **备选说明**: 如需了解currentColor等备选方案,请参考[§2.3 技术实现方案](#23-动态变色要求-v110核心功能)

## 🎨 4. 动态变色应用场景详解

### 4.1 场景矩阵

| 应用场景 | 背景色 | Logo颜色 | CSS类名示例 |
|---------|--------|---------|------------|
| **顶部导航栏-默认** | `#0C328C` (深蓝) | `#FFFFFF` (白色) | `.top-nav-logo { filter: brightness(0) invert(1); }` |
| **顶部导航栏-浅色模式** | 白色/浅灰 | `#0C328C` (品牌蓝) | `.top-nav-light .top-nav-logo { filter: none; }` |
| **侧边栏-选中态** | `#EBF1F6` (浅灰蓝) | `#0C328C` (品牌蓝) | `.sidebar-active .top-nav-logo { filter: none; }` |
| **登录页面** | `#FFFFFF` (白色) | `#0C328C` (品牌蓝) | `.login-page .top-nav-logo { filter: none; }` |
| **打印/导出PDF** | `#FFFFFF` (白色) | `#000000` (黑色) | `@media print { .top-nav-logo { filter: brightness(0) invert(1); } }` |
| **高对比度模式** | 取决于主题 | 自动适应 | `@media (prefers-contrast: high)` |

### 4.2 代码示例: 完整的响应式变色系统 (v2.5.0: img+filter方案)

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<style>
  /* 基础样式 - 使用img+filter方案 */
  .top-nav-logo {
    width: 180px;   /* viewBox=0 0 180 42, 原始宽度 (v2.1.0) */
    height: auto;   /* 高度按比例 ≈ 42px */
    display: block;
  }

  /* 场景1: 深色导航栏 (默认) → 白色Logo */
  .top-nav-dark .top-nav-logo {
    filter: brightness(0) invert(1);
  }

  /* 场景2: 浅色导航栏 → 品牌色Logo(显示原色) */
  .top-nav-light .top-nav-logo {
    filter: none;
  }

  /* Logo为纯展示元素,无交互 (v4.12.0) */

  /* 场景3: 高对比度无障碍模式 */
  @media (prefers-contrast: high) {
    .top-nav-logo {
      filter: brightness(0) invert(1);  /* 强对比白色 */
    }
  }
</style>
</head>
<body>
  <!-- 深色导航栏 -->
  <header class="top-nav top-nav-dark">
    <div class="top-nav-brand">
      <img class="top-nav-logo" src="../ASSETS/brand/logo.svg" alt="JOMOO九牧">
    </div>
  </header>

  <!-- 浅色导航栏 (其他页面) -->
  <header class="top-nav top-nav-light">
    <div class="top-nav-brand">
      <img class="top-nav-logo" src="../ASSETS/brand/logo.svg" alt="JOMOO九牧">
    </div>
  </header>
</body>
</html>
```

---

## ⚙️ 5. Skill 生成时的强制行为

### 5.1 AI 生成页面时的 Checklist

当使用 JMBOS UIUE Design System Skill 生成页面时,**必须**执行以下操作:

- [ ] **Step 1**: 检查 `ASSETS/brand/` 目录是否存在 Logo 文件
- [ ] **Step 2**: **优先选择 SVG 格式** (🥇首选) → 检查是否存在 `.svg` 文件
  - ✅ 存在 `.svg` → 使用 [方案C: img+filter](#方案c-img标签引用-svg--css-filter-⭐⭐⭐--首选推荐--v250)
  - ⚠️ 仅存在 `.png/.jpg` → 使用 [方案B: 降级方案](#方案b-img标签引用-pngjpg-⭐-降级方案--不支持动态变色)
  - ❌ 无Logo文件 → 使用 [降级方案A: 显示文字](#降级方案a无logo文件--显示文字)
- [ ] **Step 3**: 集成到顶部导航栏时,**使用 `<img>` 标签 + CSS filter 方案** (v2.5.0标准)
  - **SVG格式** (95%场景):
    - 深色背景 (#0C328C) → `filter: brightness(0) invert(1)` (白色Logo)
    - 浅色背景 (#FFFFFF/#EBF1F6) → `filter: none` (品牌色Logo,显示原始fill颜色)
  - **PNG/JPG格式** (5%降级场景):
    - 直接使用固定颜色,不推荐使用filter(效果不理想)
- [ ] **Step 4**: 确保 Logo 使用**图片原始尺寸** (`width: 180px; height: auto;`)
- [ ] **Step 5**: 明确设置容器 **无内边距** (`.top-nav-brand { padding: 0; }`) 防止额外间距
- [ ] **Step 6**: 根据**文件格式和当前页面背景色**设置正确的样式
  - **SVG + 深色背景** → `filter: brightness(0) invert(1)`
  - **SVG + 浅色背景** → `filter: none`
  - **PNG/JPG** → 不使用filter,保持原样

### 5.2 降级方案 (当 Logo 文件不存在或不支持动态变色时)

#### 降级方案A: 无Logo文件 → 显示文字

```html
<div class="top-nav-left">
  <div class="top-nav-brand">JOMOO九牧</div>
</div>
```

#### 降级方案B: 有PNG文件但不支持变色 → 使用固定颜色 + 提示

```html
<img src="../ASSETS/brand/logo.png" alt="JOMOO九牧" class="top-nav-logo">
```

> ⚠️ **重要提示**: 即使使用降级方案,也应在生成日志中提示用户:  
> *"建议上传支持动态变色的 SVG Logo 到 `ASSETS/brand/` 目录以提升品牌一致性"*

---

## 🎨 6. Logo 设计建议

### 6.1 视觉适配性

由于 Logo 会显示在**不同颜色的背景**上 (这是v1.1.0的核心改进):

| 要求 | 说明 |
|------|------|
| **颜色** | **必须是单色或可单色化**的设计 (避免渐变、多色组合) |
| **复杂度** | 简洁为主,避免过于复杂的细节 (原始尺寸下清晰可辨) |
| **留白** | Logo 本身应有适当的内边距 (padding) |
| **可变性** | 支持CSS filter处理 (无需修改fill属性) |

### 6.2 文件准备检查清单 (v1.1.0更新版)

- [ ] 背景是否透明?
- [ ] 是否为 **SVG矢量格式**? (PNG/JPG不支持动态变色)
- [ ] 使用**原始尺寸**显示后是否仍可识别?
- [ ] 文件大小是否合理 (≤100KB)?
- [ ] **⭐ 是否支持CSS filter动态变色?** (单色Logo效果最佳)
- [ ] **⭐ 在白色背景下是否清晰可见?** (测试品牌色显示效果)
- [ ] **⭐ 在深蓝色背景下是否清晰可见?** (测试白色显示效果)
- [ ] 是否为正版授权素材?

### 6.3 推荐的Logo设计原则

为了完美支持动态变色,Logo设计应遵循以下原则:

#### ✅ 推荐做法

1. **单色设计**: 整个Logo使用同一颜色
2. **纯形状**: 使用path/polygon/text等矢量元素
3. **无渐变**: 避免linearGradient/radialGradient
4. **无图片嵌入**: 避免image标签嵌入位图
5. **清晰的层次**: 主要图形元素清晰可辨

#### ❌ 禁止做法

1. **多色组合**: 不同元素使用不同固定颜色
2. **复杂渐变/多色组合**: filter反转后颜色不可控
3. **位图嵌入**: image标签引用的外部图片无法获得矢量级的清晰度

---

## 🚀 7. 快速上手指南

### 7.1 第一次配置 (3步搞定)

```bash
# Step 1: 创建目录
mkdir -p jmbos-uiue-design-system/ASSETS/brand

# Step 2: 复制Logo文件到目录 (推荐使用支持动态变色的SVG)
cp "logo（支持替换颜色）.svg" jmbos-uiue-design-system/ASSETS/brand/

# Step 3: 验证文件存在
ls -la jmbos-uiue-design-system/ASSETS/brand/
```

### 7.2 验证集成效果

1. 打开任意生成的 HTML 页面 (如 list.html)
2. 检查顶部导航栏左侧是否显示 Logo
3. 确认 Logo 使用**原始尺寸**显示 (width: 180px; height: auto;)
4. **⭐ 测试动态变色 (v2.5.0: filter方案)**
   - 默认状态: 应显示**白色** (在深蓝背景上,应用了 `brightness(0) invert(1)`)
   - 尝试修改CSS中的 `filter` 值为 `none`,确认Logo变为品牌色(原色)
   - 检查浅色背景页面是否正确显示品牌色Logo

### 7.3 快速验证动态变色功能 (v2.5.0: 基于filter)

打开浏览器开发者工具 (F12),执行以下步骤:

1. 选中Logo元素 (`.top-nav-logo`) - 应该是 `<img>` 标签
2. 在Styles面板中找到 `filter` 属性
3. 修改 `filter` 值:
   - 输入 `brightness(0) invert(1)` → Logo应变**白色**
   - 输入 `none` → Logo应变**品牌色**(显示SVG原始颜色)
   - 输入 `brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(175deg)` → Logo变**红色** (测试灵活性)
4. 如果颜色成功跟随变化 → ✅ 动态变色功能正常!

> 💡 **提示**: filter方案比currentColor更灵活,可以实现任意颜色变换!

---

## ❓ 8. FAQ (常见问题) - v1.1.0更新版

### Q1: 可以同时支持 SVG 和 PNG 吗?

**A**: 可以。优先级: **🥇 SVG (矢量,支持filter动态变色) > 🥈 PNG/JPG (位图,固定颜色)**。
强烈推荐使用 `.svg` 格式配合 CSS `filter` 方案 ([详见方案C](#方案c-img标签引用-svg--css-filter-⭐⭐⭐--首选推荐--v250))。

### Q2: Logo 必须是白色的吗?

**A**: **不是!** 这是v1.1.0的核心改进。Logo颜色会**根据背景自动切换**:
- 深色背景 → 白色 (#FFFFFF)
- 浅色背景 → 品牌色 (#0C328C)
- 其他场景 → 通过CSS自定义

### Q3: 我现有的Logo如何改造为支持动态变色?

**A**: **推荐方式 (v2.5.0)**: 无需修改Logo文件! 直接使用img+filter方案:

```css
.top-nav-logo {
  filter: brightness(0) invert(1);  /* 深色背景→白色 */
}
```

**备选方式**: 如果必须使用currentColor,需将SVG中所有的 `fill="#固定颜色"` 替换为 `fill="currentColor"`,然后通过CSS的 `color` 属性控制。

详细教程见: [第3.4节](#34-logo集成指南-v250推荐imgfilter方案)

### Q4: 可以为不同页面设置不同 Logo 吗?

**A**: 当前规范要求**全局统一Logo**,但**允许不同页面使用不同颜色**。例如:
- 列表页/详情页: 白色Logo (深色导航栏)
- 登录页: 品牌色Logo (白色背景)

### Q5: 上传 Logo 后需要重启服务吗?

**A**: 不需要。HTML 页面会直接引用文件路径,刷新浏览器即可看到更新。

### Q6: CSS filter 兼容性如何? (v2.5.0更新)

**A**: **极佳!** `filter` 是CSS标准属性,支持情况:
- ✅ 所有现代浏览器 (Chrome/Firefox/Safari/Edge)
- ✅ IE9+ ( ancient but supported )
- ✅ 移动端浏览器 (iOS Safari/Chrome Mobile)
- ✅ 无需polyfill或前缀
- ✅ **GPU加速**,性能优秀

> 💡 **对比**: 相比currentColor方案,filter方案无需修改SVG源文件,兼容性同样出色

### Q7: 动态变色会影响性能吗? (v2.5.0更新)

**A**: **几乎不会!** 推荐的CSS `filter` 方案具有以下性能优势:
- ✅ **GPU加速**: filter属性由GPU硬件加速处理
- ✅ **极低开销**: 比currentColor方案更轻量
- ✅ **优于图片切换**: 比使用多张不同颜色的图片方案**性能更好**
- ✅ **无重绘开销**: 不会触发页面布局重计算

> 💡 **实测**: 在主流浏览器中,filter操作的性能开销可忽略不计,即使在高频动画场景下也表现优秀

### Q8: 为什么推荐使用 `<img>` 标签而非内联SVG? (v2.5.0)

**A**: 基于实战经验,`<img>` 标签方案有以下**核心优势**:

| 对比维度 | 内联SVG方案 | img标签方案 |
|---------|------------|------------|
| **代码量** | 大量path/polygon数据 (~100行+) | 单行 `<img>` 标签 |
| **维护成本** | 修改Logo需改多处代码 | 只需替换SVG文件 |
| **缓存性能** | 无法单独缓存 | 浏览器可缓存SVG文件 |
| **复用性** | 每处都需复制完整SVG | 多处引用同一文件 |
| **可读性** | HTML被大量SVG数据污染 | 结构清晰简洁 |

**适用场景**:
- ✅ **95%的场景**: 推荐使用 `<img>` + CSS filter (简洁高效)
- ⚠️ **特殊情况**: 如需精细控制SVG内部元素动画,才考虑内联

**迁移指南**:
从内联SVG迁移到img标签只需3步:
1. 将内联SVG内容保存为独立文件 `logo.svg`
2. 替换为 `<img src="logo.svg">`
3. 添加 `filter: brightness(0) invert(1)` 控制颜色

---

## 📝 9. 变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| **v2.5.0** | **2026-05-28** | **⭐ 新增img+filter推荐方案: 解决Logo显示不全+额外间距问题,禁止内联硬编码,padding:0明确化,方案C成为首选** (v4.21.0) | System |
| **v2.4.0** | **2026-05-27** | **✅ 修复示例代码: 将省略号(...)替换为完整的真实JOMOO九牧Logo SVG路径数据,确保文档与实际代码一致** (v4.20.0) | System |
| **v2.3.0** | **2026-05-26** | **🧹 职责边界清晰化: 移除导航布局CSS(归属components.md),新增引用链接,专注Logo专用规范** (v4.19.0) | System |
| **v2.2.0** | **2026-05-26** | **📐 移除Logo两侧间距: 左侧padding移除+菜单margin-left改为0 (v4.19.0)** | System |
| **v2.1.0** | **2026-05-26** | **📐 Logo宽度修正: 168px→180px（使用viewBox原始宽度,Logo区域总宽度=180px）** (v4.18.0) | System |
| **v2.0.0** | **2026-05-26** | **🐛 修复规范文档残留错误: 移除margin-right:8px（Logo与菜单间距应为0）** (v4.17.0) | System |
| **v1.9.0** | **2026-05-25** | **⭐ 修复Logo显示不全: width:168px+height:auto,清理残留旧样式,form.html同步Logo SVG** (v4.16.0) | System |
| **v1.8.0** | **2026-05-25** | **⭐ 修复Logo显示不全: 移除SVG内联width/height属性,form.html同步Logo** (v4.16.0) | System |
| **v1.7.0** | **2026-05-25** | **⭐ 修正规范错误: Logo原始尺寸/三级菜单48px间距/移除残留hover代码** | System |
| **v1.5.0** | **2026-05-25** | **⭐ 子菜单(三/四级)继承二级hover效果:仅背景变色,文字不变色** (v4.14.0补完) | System |
| **v1.4.0** | **2026-05-25** | **⭐ 左侧菜单hover不变色 + Logo与菜单间距为0** (v4.14.0) | System |
| **v1.3.0** | **2026-05-25** | **⭐ Logo使用原始尺寸展示 + 菜单项无间距** (v4.13.0) | System |
| **v1.2.0** | **2026-05-25** | **⭐ Logo区域改为纯展示,移除所有交互(点击/悬停)** (v4.12.0) | System |
| **v1.1.0** | **2026-05-25** | **⭐ 新增Logo动态变色功能** (currentColor/CSS变量方案) | System |
| v1.0.0 | 2026-05-25 | 初始版本,定义Logo基础规范 | System |

---

*最后更新: 2026-05-28 | 版本: v2.5.0 (新增img+filter推荐方案) | 维护者: JMBOS UIUE Design Team*
