# 图标规范 Icons — 完整规范

> 图标总数: 113 个 | 版本: v7.1.0 | 最后更新: 2026-05-29
>
> 📌 **定位**: 本文件为**完整技术规范文档**，包含详细代码示例、完整颜色体系、检查清单。
> 📖 **快速指南**: 规则速查表、场景索引、图标清单请查阅 [icons/README.md](../ASSETS/icons/README.md)
> 🎨 **CSS样式**: 图标基础样式已内置到 [design-tokens.css v4.19.0](../ASSETS/design-tokens.css)（第10章），引入该文件后自动生效，无需手动复制CSS。
>
> 预览页面 → [sprite-preview.html](../ASSETS/icons/sprite-preview.html)

📌 **重要提示**:
1. **图标CSS样式已内置**：`design-tokens.css` 已包含 `.icon / .icon-nav / .icon-lg` 等所有图标基础类（v4.19.0+），只需在 `<head>` 引入 `design-tokens.css` 即可，**不需要手动复制图标CSS代码**。
2. 本章节所有颜色值均来自 [design-tokens.css](../design-tokens.css) 中的 `--color-*` 变量系列，实现时请优先引用 CSS 变量而非硬编码色值。

---

## 概述

JMBOS UI/UE 设计系统提供 **113 个**精心设计的 SVG 图标，采用 **SVG Sprite** 方式统一管理。所有图标已标准化为 `16×16px` 默认尺寸，通过 `<use href="#icon-xxx">` 引用。

#### 核心优势

- ✅ 支持 `currentColor` 动态变色（hover/focus 等交互效果）
- ✅ 代码简洁，避免硬编码 path 数据
- ✅ 统一引用图标库，维护方便
- ✅ 图标更新时无需修改页面代码
- ✅ 浏览器缓存优化，仅加载一次 Sprite 文件

#### ⭐ 图标选择原则（核心规范）

> **默认优先使用标准图标库，允许按需自定义**

| 优先级 | 选择策略 | 说明 |
|--------|---------|------|
| **P0 - 首选** | **标准图标库（113个）** | 所有图标需求**优先**从现有图标库中查找和使用 |
| **P1 - 备选** | **自行生成/获取外部图标** | 当标准库**无法满足**业务需求时，可按照实际需要自行生成或使用其他来源的图标 |

**详细规则**：

1. ✅ **默认必须使用标准图标库**
   - 标准库包含 113 个精心设计的 SVG 图标，覆盖绝大多数业务场景
   - 使用方式：`<svg><use href="#icon-{图标名称}"/></svg>`
   - 完整图标清单：[icons/README.md — 图标清单](../ASSETS/icons/README.md)

2. ✅ **允许使用非标准库图标的场景**
   - 标准库中**不存在**所需图标时
   - 业务场景需要**特殊行业图标**（如医疗⚕️、金融💰、教育📚等）
   - 需要**品牌定制图标**（如企业 Logo 图标化）

3. ✅ **自定义图标推荐来源**
   - [Iconfont](https://www.iconfont.cn/) （阿里巴巴图标库，中文场景首选）
   - [Feather Icons](https://feathericons.com/) （开源线性图标，风格一致性好）
   - [Heroicons](https://heroicons.com/) （Tailwind CSS 官方推荐）
   - [Phosphor Icons](https://phosphoricons.com/) （多重量量级可选）
   - AI 生成工具：Midjourney / DALL-E / Stable Diffusion / Iconify AI

4. ⚠️ **自定义图标必须遵循的技术规范**
   - 使用 SVG 格式（支持 `currentColor` 动态变色）
   - 默认尺寸：16×16px（与标准库保持一致）
   - `fill` 或 `stroke` 属性使用 `currentColor`（不要硬编码颜色值）
   - 风格统一：线性/面性需与系统整体协调
   - **必须存入产出物 `2.UI/images/` 目录**并命名规范（如 `{name}.svg`），含 AI 生成图标。标准库源文件在 `ASSETS/icons/individual/`（仅供 Sprite 生成参考，非产出物目录）

#### 图标分类统计

| 分组        | 数量   | 说明                   |
| --------- | ---- | -------------------- |
| **P0 必需** | 15 个 | 核心功能图标，高频使用场景必备      |
| **P1 常用** | 35 个 | 常用操作和状态图标，覆盖主要业务场景   |
| **P2 其他** | 57 个 | 特定场景使用的图标，按需引入       |
| **中文命名**  | 11 个 | 中文命名的特殊图标（建议后续统一为英文） |

> 完整 P0/P1/P2 图标清单请查阅 [icons/README.md — 图标清单](../ASSETS/icons/README.md)

---

## ⭐ SVG Sprite 引用方式（唯一推荐）

> **适用场景**：所有使用图标的场景（组件开发、页面模板等）
>
> **核心优势**：
> - ✅ 支持 `currentColor` 动态变色
> - ✅ 代码简洁，易于维护
> - ✅ 统一引用，避免硬编码 path
> - ✅ 图标库更新时无需修改页面代码

### 使用步骤

#### 步骤 1：在页面 `<body>` 开头内联引入 Sprite 文件（唯一方式）

> **⚠️ 必须使用内联方式**
>
> **原因**：浏览器安全策略阻止 `file://` 协议下的跨文件加载。如果使用外部引用 `<use xlink:href="...">`，在本地双击 HTML 打开时图标会完全不显示。
>
> **解决方案**：将 icons-sprite.svg 的完整内容直接复制到 HTML 的 `<body>` 开头。

**操作步骤**：

1. 打开文件：`ASSETS/icons/icons-sprite.svg`
2. 复制从 `<svg xmlns="http://www.w3.org/2000/svg" ...>` 到 `</svg>` 的全部内容
3. 粘贴到您 HTML 文件的 `<body>` 标签后第一行

```html
<body>
  <!-- SVG Sprite 图标库（内联引入） -->
  <svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
    <!-- 从 ASSETS/icons/icons-sprite.svg 复制完整内容到这里 -->
    <symbol id="icon-Open" viewBox="0 0 16 16">
      <path d="M11.000608,2.86311341 C12.8505033,3.9304197..." fill-rule="nonzero" fill="currentColor"/>
    </symbol>
    <symbol id="icon-TV" viewBox="0 0 16 16">
      <path d="M11.2906639,2.34632062 L13.4185229,2.79972914..." fill-rule="nonzero" fill="currentColor"/>
    </symbol>
    <!-- ... 其他116个图标 symbol ... -->
  </svg>

  <!-- 页面其他内容... -->
</body>
```

| 方案 | 兼容性 | 文件大小 | 使用场景 | 推荐度 |
|------|--------|---------|---------|--------|
| **A: 内联 Sprite** | ✅ 100%（file:// + HTTP均支持） | 增大50-100KB | 生产交付、离线查看 | ⭐⭐⭐⭐⭐ **唯一推荐** |
| **B: HTTP服务器** | ✅ 仅HTTP协议（本地file://不可用！） | 不增加 | 开发调试阶段 | ⚠️ 仅限开发环境 |

> ⛔ **重要提醒**：
> - **禁止**使用 `<object>` 标签引入 SVG（创建独立文档上下文，`currentColor` 无法从父元素继承，图标不能动态变色）
> - **禁止**使用 `<img>` 标签引入 SVG（同上，无法支持 CSS 颜色控制）
> - **禁止**使用外联 `<use xlink:href="...">` 引用 Sprite 文件（浏览器安全策略阻止 `file://` 协议下的跨文件加载）
> - **禁止**在 Sprite 块外内联 `<path d="...">` 作为图标使用（丢失图标命名关系，无法追溯对应资源文件，S04 会持续报错）
>
> **唯一正确的方式**：将 `icons-sprite.svg` 的完整内容内嵌到 HTML 的 `<body>` 开头（见上方步骤1代码示例）

---

#### 步骤 2：使用图标（通过 `<use href="#icon-{名称}">` 引用）

> ✅ **确认**：完成步骤1的内联后，下方使用方式即可正常工作

```html
<!-- 示例：侧边栏菜单图标 -->
<a href="#" class="sidebar-menu-item">
  <svg class="sidebar-menu-icon">
    <use href="#icon-cog"></use>  <!-- 齿轮图标 → 系统设置 -->
  </svg>
  <span>系统设置</span>
</a>

<!-- 示例：操作按钮图标 -->
<button class="link-btn">
  <svg class="icon">
    <use href="#icon-edit"></use>  <!-- 编辑图标 -->
  </svg>
  编辑
</button>

<!-- 示例：通过 CSS 控制颜色（支持 hover 等交互效果）-->
<style>
  .sidebar-menu-item {
    color: #333333;  /* 默认深灰色 */
    transition: color 0.2s;
  }

  .sidebar-menu-item:hover {
    color: #3685F2;  /* hover 时自动变蓝色 */
  }
</style>
```

### 图标 ID 命名规则

| 原始文件名 | Sprite ID | 说明 |
|-----------|-----------|------|
| `cog.svg` | `#icon-cog` | 齿轮 |
| `component.svg` | `#icon-component` | 组件 |
| `edit.svg` | `#icon-edit` | 编辑 |
| `trash.svg` | `#icon-trash` | 删除 |
| `search.svg` | `#icon-search` | 搜索 |
| `chevron-down.svg` | `#icon-chevron-down` | 下箭头 |
| `save 2.svg` | `#icon-save-2` | 空格替换为连字符 |
| `flow path.svg` | `#icon-flow-path` | 空格替换为连字符 |
| ... (共113个) | `#icon-{文件名}` | 完整列表见 [icons-sprite.svg](../ASSETS/icons/icons-sprite.svg) |

### 从 `<img>` / 内联 SVG 迁移到 `<use>` 引用

> ⚠️ **核心原则：迁移过程中必须保留图标命名关系，确保可追溯对应资源文件。**
>
> ✅ **用户自定义图标允许使用**：当 113 个标准图标无法满足业务需求时，允许用户自行补充图标。但必须将图标命名在代码中暴露（通过 `<symbol id="icon-名称">` + `<use href="#icon-名称">`），禁止内联 `<path d=>` 隐藏命名。

| 原始写法 | ❌ 错误迁移（丢失命名） | ✅ 正确迁移（保留命名） |
|---------|----------------------|----------------------|
| `<img src="edit.svg">` | `<svg class="icon"><path d="M3..." fill="currentColor"/></svg>` | `<svg class="icon"><use href="#icon-edit"></use></svg>` |
| `<img src="custom-chart.svg">` | 同上内联 path | 先在 Sprite 块添加 `<symbol id="icon-custom-chart">`，再用 `<use href="#icon-custom-chart">` |

**迁移步骤**：
1. 从 `<img src="文件名.svg">` 提取文件名（去掉 `.svg` 后缀，空格转连字符）
2. 检查该名称是否已存在于 Sprite 的 113 个 symbol 中
3. **已存在**：直接替换为 `<svg class="icon"><use href="#icon-文件名"></use></svg>`
4. **不存在（用户自定义图标）**：① 将 SVG 文件存入 `2.UI/images/{文件名}.svg`（含 AI 生成图标，必须本地有文件）；② 在 Sprite 块（`<!-- JMBOS-SVG-SPRITE -->` 区域内）添加 `<symbol id="icon-文件名" viewBox="0 0 16 16">` 定义；③ 用 `<use href="#icon-文件名">` 引用。命名在代码中暴露，可追溯

### Sprite 文件说明

`icons-sprite.svg` 已预生成，包含全部 113 个图标的 `<symbol>` 定义，直接引入使用即可。如新增自定义图标，需在 sprite 文件中手动添加对应的 `<symbol>` 定义。

---

## 图标颜色控制

### 工作原理

SVG Sprite 内部的 symbol 使用 `fill="currentColor"`，当父元素设置 `color` 属性时，`currentColor` 会继承该颜色，从而实现图标变色。

### 9 种常用颜色场景

| 场景       | 颜色值         | CSS 变量                         | 使用位置                       |
| -------- | ----------- | ------------------------------ | -------------------------- |
| **主题蓝色** | `#3685F2`   | `var(--color-primary)`         | **操作列/导航默认态**              |
| **默认灰色** | `#7C8493`   | `var(--color-text-secondary)`  | 一般信息展示                     |
| **主文字色** | `#141b24`   | `var(--color-text-primary)`    | 重要信息                       |
| **文字-3** | `#B9BFCB` | `var(--color-text-tertiary)` | **搜索框/输入框/placeholder默认态** |
| **禁用色**  | `#D2D7E1` | `var(--color-text-disabled)` | **仅可操作图标禁用时**              |
| **成功绿色** | `#04D999`   | `var(--color-success)`         | 成功状态                       |
| **警告橙色** | `#FF813B`   | `var(--color-warning)`         | 警告状态                       |
| **错误红色** | `#FF4D5D`   | `var(--color-error)`           | 错误状态                       |
| **白色**   | `#FFFFFF`   | `var(--color-text-white)`      | 深色背景                       |

### 三条核心颜色规则

##### 规则 1：操作列与导航 - 使用主题蓝色

```html
<!-- 操作列图标默认使用主题蓝 -->
<button class="link-btn">
  <svg class="icon">
    <use href="#icon-edit"></use>
  </svg>
  编辑
</button>

<!-- 导航菜单图标默认使用主题蓝（仅二级）-->
<a href="#" class="sidebar-menu-item active">
  <svg class="icon menu-icon icon-nav">
    <use href="#icon-dashboard"></use>
  </svg>
  工作台
</a>
```

##### 规则 2：搜索框/输入框 - 使用文字-3

```html
<!-- 搜索框图标默认使用文字-3（不是禁用色！）-->
<div class="search-wrapper">
  <input type="text" placeholder="请输入关键词...">
  <svg class="icon search-icon">
    <use href="#icon-search"></use>
  </svg>
</div>
```

##### 规则 3：禁用色 - 跟随组件设定

```html
<!-- 可操作图标禁用时，颜色跟随所属组件的禁用色规范 -->
<!-- 可能是背景色-1 #D2D7E1 或 主题色-4 #AFCEFA/#78AEFF -->
<button class="link-btn" disabled>
  <svg class="icon">
    <use href="#icon-edit"></use>
  </svg>
  编辑
</button>
```

***

## 🎨 图标颜色完整规范 (A/B/C/D 体系)

> **核心原则**: 图标颜色必须与背景形成足够对比度,确保可读性和可访问性

##### A. 深色背景 → 必须使用白色图标 `#FFFFFF`

| 组件类型            | 背景色                               | 图标色       | 使用场景            |
| --------------- | --------------------------------- | --------- | --------------- |
| **顶部导航栏-品牌色版**  | `#0C328C` (九牧蓝) / `#2468F2` (乐石蓝) | `#FFFFFF` | 消息、设置、用户头像边框、通知 |
| **主按钮 Primary** | `#3685F2` (九牧) / `#2468F2` (乐石)   | `#FFFFFF` | 查询、提交、确认按钮内的图标  |
| **警示按钮 Danger** | `#FF4D5D`                         | `#FFFFFF` | 删除、危险操作按钮内的图标   |

> ⚠️ **重要提醒**: 所有深色背景(品牌色、主题色、功能色)的按钮和组件,其内部图标**必须使用白色 #FFFFFF**,禁止使用深色或灰色图标!

##### B. 浅色/白色背景 → 使用深色或主题色图标

**B1. 常规信息图标**

| 位置                           | 背景色                             | 图标色      | 色值                        |
| ---------------------------- | ------------------------------- | -------- | ------------------------- |
| **左侧菜单-未选中状态**               | `#FFFFFF`                       | **主文字色** | **`#141b24`** ⭐ v4.19.0修正 |
| **左侧菜单-选中状态**                | `#DEEDFF` (九牧) / `#E8F5FF` (乐石) | 主题蓝色     | `#3685F2` / `#2468F2`     |
| **工具栏操作按钮** (新增/删除/编辑/导出/导入) | 透明或 `#FFFFFF`                   | **主文字色** | **`#141b24`**             |
| **表格操作链接** (编辑/删除)           | `#FFFFFF`                       | 主题蓝色     | `#3685F2` / `#2468F2`     |

**B2. 功能性图标**

| 位置              | 背景色       | 图标色  | 色值        |
| --------------- | --------- | ---- | --------- |
| **输入框内图标** (右侧) | `#FFFFFF` | 弱提示灰 | `#B9BFCB` |
| **下拉选择箭头**      | `#FFFFFF` | 弱提示灰 | `#B9BFCB` |
| **表格排序图标** (表头) | `#F4F7F9` | 次要灰色 | `#7C8493` |
| **子菜单展开/收起箭头**  | `#FFFFFF` | 主文字色 | `#141b24` |
| **分页器图标**       | `#FFFFFF` | 次要灰色 | `#7C8493` |
| **"更多操作"下拉箭头**  | 透明/白色     | 次要灰色 | `#7C8493` |

##### C. 特殊状态图标颜色

| 状态               | 图标色           | 色值                                                          | 应用场景     |
| ---------------- | ------------- | ----------------------------------------------------------- | -------- |
| **默认态 Default**  | 常规色           | 根据组件类型选择                                                    | 初始显示状态   |
| **悬停态 Hover**    | 主题悬停色         | `#5E9DF5` (九牧) / `#4F90FF` (乐石)                             | 鼠标悬停时的图标 |
| **点击态 Active**   | 主题点击色         | `#2364CC` (九牧) / `#144BCC` (乐石)                             | 点击按下时的图标 |
| **禁用态 Disabled** | **跟随组件禁用色设定** | 根据所属组件的禁用色规范（可能是背景色-1 `#D2D7E1` 或主题色-4 `#AFCEFA`/`#78AEFF`） | 不可用状态的图标 |
| **聚焦态 Focus**    | 主题常规色 + 外发光   | `#3685F2` + 20%不透明度光晕                                       | 键盘焦点状态   |

##### D. 常见错误及正确示例

❌ **错误1: 主按钮中的图标未反白**

```css
/* 错误: 蓝色背景上使用深色图标 */
.btn-primary {
  background-color: #3685F2;
}
.btn-primary .icon {
  color: #7C8493;  /* ❌ 对比度不足,几乎不可见 */
}
```

✅ **正确1: 主按钮中使用白色图标**

```css
/* 正确: 蓝色背景上使用白色图标 */
.btn-primary {
  background-color: #3685F2;
}
.btn-primary .icon {
  color: #FFFFFF;  /* ✅ 符合规范,清晰可见 */
}
```

❌ **错误2: 顶部导航栏使用非白色图标**

```css
/* 错误: 深色导航栏使用灰色图标 */
.top-nav {
  background-color: #0C328C;
}
.top-nav .icon {
  color: #7C8493;  /* ❌ 对比度极低,无法识别 */
}
```

✅ **正确2: 顶部导航栏使用白色图标**

```css
/* 正确: 深色导航栏使用白色图标 */
.top-nav {
  background-color: #0C328C;
}
.top-nav .icon {
  color: #FFFFFF;  /* ✅ 清晰可见,符合无障碍标准 */
}
```

#### 代码示例

```html
<!-- 默认灰色图标 -->
<svg class="icon">
  <use href="#icon-dashboard"></use>
</svg>

<!-- 主题蓝色图标（悬停时）-->
<button class="link-btn">
  <svg class="icon">
    <use href="#icon-edit"></use>
  </svg>
  编辑
</button>
<style>
.link-btn:hover .icon {
  color: var(--color-primary);  /* Hover 时变蓝 */
}
</style>

<!-- 白色图标（深色背景按钮）-->
<button class="btn-primary">
  <svg class="icon">
    <use href="#icon-plus"></use>
  </svg>
  新增
</button>

<!-- 成功状态的绿色图标 -->
<span style="color: #04D999;">
  <svg class="icon">
    <use href="#icon-circle-check"></use>
  </svg>
  操作成功
</span>
```

***

## 尺寸规范

所有图标原始尺寸为 **16×16px**，支持以下标准尺寸：

| 尺寸类别     | 宽高 (px)   | 使用场景           | CSS 类        |
| -------- | --------- | -------------- | ------------ |
| **默认**   | **16×16** | 按钮、分页器、表格、表单、弹窗关闭 | `.icon`      |
| **导航菜单** | **20×20** | 二级导航菜单 + 顶部导航右侧功能区图标 | `.icon-nav`  |
| **大图标**  | 24×24     | 卡片标题、详情页       | `.icon-lg`   |

**⚠️ 重要规则**：

- ✅ 按钮内图标使用 **16px**（不是 14px）
- ✅ 分页器图标使用 **16px**
- ✅ 导航菜单图标使用 **20px**（`.icon-nav`）：二级导航菜单 + 顶部导航右侧功能区图标
- ❌ 一级、三级、四级导航菜单**禁止使用图标**

***

## 颜色控制方式（CSS 动态变色）

> **✨ 推荐方式**：使用 **SVG Sprite**，**可通过 CSS** **`color`** **属性动态改变图标颜色**！
>
> **工作原理**：
>
> - SVG Sprite 内部使用 `fill="currentColor"`，会自动继承父元素的 `color` 值
> - 通过设置父元素的 `color` 属性即可控制图标颜色
> - 无需准备多套颜色变体文件，一套图标适配所有场景

#### 图标颜色说明

以下是各场景的推荐做法：

| 场景          | 推荐方案           | 说明                                                       |
| ----------- | -------------- | -------------------------------------------------------- |
| **默认状态**    | 继承父元素 color    | 默认次要色 #7C8493                                            |
| **主色调按钮**   | 白色图标           | 通过 `style="color: white;"` 设置                            |
| **悬停态**     | CSS `color` 属性 | `.btn:hover .icon { color: var(--color-primary); }`      |
| **禁用态**     | CSS `color` 属性 | `.disabled .icon { color: var(--color-text-disabled); }` |
| **成功/错误状态** | 继承父元素颜色        | 父元素设置对应语义色即可                                             |

**CSS 示例**：

```css
/* 悬停时图标变色 */
.btn-primary:hover .icon {
  color: #5E9DF5;  /* 比默认蓝更亮 */
}

/* 禁用时图标变灰 */
.disabled .icon {
  color: #D2D7E1;  /* 禁用文字色 */
}

/* 状态图标自动继承 */
.alert-success .icon {
  color: inherit;  /* 继承 .alert-success 的绿色 */
}
```

**HTML 示例（Sprite 方式）**：

```html
<!-- 默认灰色图标 -->
<svg class="icon">
  <use href="#icon-dashboard"></use>
</svg>

<!-- 蓝色图标（主题色）-->
<span style="color: #3685F2;">
  <svg class="icon">
    <use href="#icon-edit"></use>
  </svg>
</span>

<!-- 绿色图标（成功状态）-->
<div class="alert alert-success">
  <svg class="icon">
    <use href="#icon-circle-check"></use>
  </svg>
  操作成功！
</div>
```

***

## 图标与文字间距

图标与相邻文字之间应保持适当的间距：

| 场景          | 间距值      | CSS 变量              | 说明                   |
| ----------- | -------- | ------------------- | -------------------- |
| 图标 + 文字（按钮） | **4px**  | `var(--spacing-xs)` | 紧凑排列                 |
| 图标 + 文字（导航） | **8px**  | `var(--spacing-sm)` | 舒适间距（二级导航 / 顶部导航右侧功能区）      |
| **操作列按钮之间** | **12px** | `--`                | **按钮组间距**            |
| 搜索框图标距右     | **8px**  | `--`                | **距输入框右边框**          |

**实现方式**:
```css
/* 图标 + 文字容器 */
.icon-text-group {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);        /* 4px 默认间距 */
}

/* 按钮内图标与文字间距 */
.btn .icon + span,
.btn span + .icon {
  margin-left: var(--spacing-xs); /* 4px */
}

/* 导航栏图标与文字间距（二级导航 / 顶部导航右侧功能区）*/
.nav-item.level-2 .icon + .nav-label {
  margin-left: var(--spacing-sm); /* 8px */
}

/* 操作列按钮之间间距 */
.action-links {
  gap: 12px;  /* 按钮之间 12px */
}
```

***

## 常用图标速查表（Top 20）

| 序号 | 图标 ID                | 文件名               | 典型场景                 | 优先级 |
| -- | -------------------- | ----------------- | -------------------- | --- |
| 1  | `icon-edit`          | edit.svg          | 编辑按钮、修改操作            | P0  |
| 2  | `icon-trash`         | trash.svg         | 删除按钮、移除操作 (= delete) | P0  |
| 3  | `icon-search`        | search.svg        | 搜索框、查找功能             | P0  |
| 4  | `icon-more`          | more.svg          | 更多操作菜单（水平三点）         | P0  |
| 5  | `icon-chevron-down`  | chevron-down.svg  | 下拉选择器、折叠面板           | P0  |
| 6  | `icon-eye`           | eye.svg           | 查看详情、预览功能            | P0  |
| 7  | `icon-plus`          | plus.svg          | 新增按钮、添加项             | P0  |
| 8  | `icon-remove`        | remove.svg        | 关闭弹窗、清除输入            | P0  |
| 9  | `icon-tick`          | tick.svg          | 确认完成、勾选状态            | P0  |
| 10 | `icon-warning`       | warning.svg       | 警告提示、注意事项            | P0  |
| 11 | `icon-copy`          | copy.svg          | 复制内容、克隆条目            | P1  |
| 12 | `icon-export`        | export.svg        | 导出数据、下载报表            | P1  |
| 13 | `icon-import`        | import.svg        | 导入数据、上传文件            | P1  |
| 14 | `icon-refresh`       | refresh.svg       | 刷新列表、重新加载            | P1  |
| 15 | `icon-filter`        | filter.svg        | 筛选条件、过滤数据            | P1  |
| 16 | `icon-sort`          | sort.svg          | 排序切换、升降序             | P1  |
| 17 | `icon-download-file` | download-file.svg | 下载附件、保存文件            | P1  |
| 18 | `icon-upload-file`   | upload-file.svg   | 上传文件、导入图片            | P1  |
| 19 | `icon-save`          | save.svg          | 保存草稿、暂存数据            | P1  |
| 20 | `icon-users`         | users.svg         | 用户管理、成员列表            | P1  |

---

## 场景示例代码

> 快速定位各场景规则要点请查阅 [icons/README.md — 场景索引](../ASSETS/icons/README.md)，下方为**完整可直接复制的代码示例**。

### 示例 1：操作列图标组合（编辑 + 查看 + 删除 + ··· 更多）⭐

表格操作列的标准实现，包含编辑、查看、删除和更多操作：

```html
<td class="action-col">
  <div class="action-links">
    <!-- 最多显示 3 个可见按钮 -->
    <button class="link-btn" title="编辑">
      <svg class="icon">
        <use href="#icon-edit"></use>
      </svg>
      编辑
    </button>

    <button class="link-btn" title="查看">
      <svg class="icon">
        <use href="#icon-eye"></use>
      </svg>
      查看
    </button>

    <button class="link-btn" title="删除">
      <svg class="icon">
        <use href="#icon-trash"></use>
      </svg>
      删除
    </button>

    <!-- 第 4 个起收纳至"更多"-->
    <button class="btn-more" title="更多操作">
      <svg class="icon">
        <use href="#icon-more"></use>
      </svg>
    </button>
  </div>
</td>

<style>
.action-column {
  text-align: right;
  padding-right: 12px;
}

.action-links {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;                        /* 操作列按钮间距 12px */
  min-width: 220px;                /* 增大最小宽度以容纳3个按钮 */
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;                         /* 图标与文字间距 4px */
  border: none;
  background: none;
  cursor: pointer;
  color: #3685F2;                   /* 主题蓝色（默认态） */
  font-size: var(--font-size-body); /* 12px */
  padding: 2px 6px;
  border-radius: var(--radius-r1);  /* 2px */
  transition: all var(--transition-fast);
}

.link-btn:hover {
  background-color: var(--color-bg-hover); /* #EDF3FA 悬停背景 */
}

.link-btn .icon {
  width: 16px;                      /* 按钮内图标 16px */
  height: 16px;
}

.btn-more {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-more:hover .icon {
  color: #0C328C;  /* Hover 加深 */
}
</style>
```

**效果说明**：
- ✅ 最多显示 **3 个可见按钮**（编辑 + 查看 + 删除）
- ✅ 第 **4** 个按钮使用"···"三点图标收纳更多操作
- ✅ 图标与文字间距为 **4px**
- ✅ **按钮之间间距为 12px**
- ✅ 默认颜色为**主题蓝色 #3685F2**
- ✅ 使用 **SVG Sprite**，**支持颜色控制**

***

### 示例 2：搜索框右侧图标定位 ⭐

带图标的输入框实现，图标固定在右侧：

```html
<div class="search-wrapper">
  <input type="text" class="input-field search-input" placeholder="请输入关键词搜索...">
  <svg class="icon search-icon">
    <use href="#icon-search"></use>
  </svg>
</div>

<style>
.search-input-wrapper {
  position: relative;
  display: inline-block;
  max-width: 320px;
}

.search-field {
  width: 100%;
  padding-right: 32px;               /* 为图标预留空间 */
  box-sizing: border-box;
}

.search-icon {
  position: absolute;
  right: 8px;                        /* 距右边框 8px（不是10px！）*/
  top: 50%;
  transform: translateY(-50%);       /* 垂直居中 */
  width: 16px;
  height: 16px;
  color: #B9BFCB;                    /* 文字-3（不是禁用色！）*/
  pointer-events: none;              /* 不影响输入交互 */
}

/* ⚠️ 重要：无 Focus 状态变色！保持文字-3色不变 */
</style>
```

**效果说明**：
- ✅ 图标严格位于输入框**右侧**
- ✅ 图标大小为 **16×16px**
- ✅ 图标距边框 **8px**（不是 10px）
- ✅ 输入框预留 **32px** 右侧内边距
- ✅ 默认显示**文字-3色 #B9BFCB**（**不是禁用色！**）
- ❌ **无 Focus 状态变色**（保持文字-3色不变）
- ✅ 图标不影响输入交互 (`pointer-events: none`)

***

### 特殊说明

#### 重要注意事项

1. **trash.svg = 删除图标**
   - `trash.svg` 即删除/回收站图标
   - 通常配合红色 (`--color-error`) 使用
   - 建议二次确认后执行删除操作
2. **所有图标 fill 已统一为 currentColor**
   - Sprite 中的 symbol 已设置 `fill="currentColor"`
   - 通过父元素的 `color` 属性控制图标颜色
   - 无需在每个图标上单独设置颜色
3. **中文命名图标（11个）**
   - 包括：历史记录、取消编辑、同步、已保存、投影仪、数据、智慧屏、暂停、运行、预览、验证码
   - 这些是历史遗留的中文命名，建议后续迁移为英文命名以保持一致性
   - 当前仍可正常使用，symbol id 格式为 `icon-xxx`（保留中文）
4. **图标命名规范**
   - 使用 kebab-case（短横线分隔）：`icon-chevron-down`
   - 多单词间用连字符连接：`icon-pie-chart`、`icon-flow-path`
   - 带数字的后缀用连字符：`icon-save-2`
   - 避免空格
5. **SVG Sprite 使用规范**
   - 必须在页面 `<body>` 开头引入 Sprite 文件
   - 使用 `<svg><use href="#icon-xxx"></use></svg>` 引用图标
   - **必须包含** **`viewBox`** **属性**：确保图标正确缩放
   - 建议设置 `pointer-events: none` 避免干扰点击事件
   - 通过父元素 `color` 属性 + SVG 内部 `fill="currentColor"` 实现颜色继承
6. **浏览器兼容性**
   - ✅ 所有现代浏览器完美支持 SVG Sprite
   - ✅ Chrome 4+ / Firefox 2+ / Safari 3.1+ / Edge 12+
7. **性能优化建议**
   - 使用 **SVG Sprite**（仅需加载一次 Sprite 文件）
   - 浏览器会缓存 Sprite 文件，提升加载性能
   - 标准库源文件存放在 `ASSETS/icons/individual/` 目录（仅供生成 Sprite 参考）；自定义/AI 生成图标存入产出物 `2.UI/images/` 目录

***

## 图标运用规则

> **重要**: 本章节定义了图标在不同组件中的具体运用规范，所有开发人员必须严格遵守

### 1. 按组件类型的图标运用规范

#### 1.1 操作列按钮图标 ⭐

**标准操作列**：编辑 + 查看 + 删除 + ··· 更多（最多3个可见）

```html
<td class="action-col">
  <div class="action-links">
    <button class="link-btn">
      <svg class="icon">
        <use href="#icon-edit"></use>
      </svg>
      编辑
    </button>
    <button class="link-btn">
      <svg class="icon">
        <use href="#icon-eye"></use>
      </svg>
      查看
    </button>
    <button class="link-btn">
      <svg class="icon">
        <use href="#icon-trash"></use>
      </svg>
      删除
    </button>
    <!-- 第 4 个起收纳至更多 -->
    <button class="btn-more" title="更多操作">
      <svg class="icon">
        <use href="#icon-more"></use>
      </svg>
    </button>
  </div>
</td>

<style>
.action-links {
  display: flex;
  gap: 12px;              /* 操作列按钮间距 12px */
  justify-content: flex-end;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;               /* 图标与文字间距 */
  border: none;
  background: none;
  cursor: pointer;
}

.btn-more {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
}
</style>
```

**规则要点**：
- ✅ 最多显示 **3 个可见按钮**（编辑 + 查看 + 删除）
- ✅ 第 **4** 个起收纳至"更多"
- ✅ 更多按钮使用 `more.svg`，**无文字**
- ✅ 图标与文字间距：**4px**
- ✅ 图标尺寸：**16×16px**（`.icon`）
- ✅ 按钮之间间距：**12px**（`gap: 12px`）
- ✅ 默认颜色：**主题蓝色 #3685F2**

#### 1.2 搜索框图标 ⭐

```html
<div class="search-wrapper">
  <input type="text" class="input-field search-input" placeholder="请输入关键词搜索...">
  <svg class="icon search-icon">
    <use href="#icon-search"></use>
  </svg>
</div>

<style>
.search-wrapper {
  position: relative;
  display: inline-block;
}

.search-input {
  width: 100%;
  padding-right: 32px;
  box-sizing: border-box;
}

.search-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #B9BFCB;
  pointer-events: none;
  width: 16px;
  height: 16px;
}
</style>
```

**规则要点**：
- 图标位置：输入框右侧，距右边界 **8px**
- 默认颜色：**#B9BFCB 文字-3**（**不是禁用色！**）
- ❌ **无 Focus 状态变色**（保持文字-3色不变）

#### 1.3 表单标签前缀图标

```html
<div class="form-item">
  <label class="form-label">
    <svg class="icon label-icon">
      <use href="#icon-org-user"/>
    </svg>
    用户名
  </label>
  <input type="text" class="input-field" placeholder="请输入用户名">
</div>

<style>
.label-icon {
  margin-right: var(--spacing-xs);
  color: var(--color-text-secondary);
}
</style>
```

**规则要点**：可选使用，位于标签文字左侧，间距 4px，颜色 `#7C8493`

#### 1.4 按钮图标（带图标的按钮）

```html
<button class="btn-primary btn-with-icon">
  <svg class="icon">
    <use href="#icon-plus"></use>
  </svg>
  新增数据
</button>

<style>
.btn-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.btn-with-icon .icon {
  width: 16px;
  height: 16px;
}
</style>
```

**规则要点**：`display: inline-flex` + `gap: 4px`，图标 16px，在文字左侧

#### 1.5 导航菜单图标 ⭐（二级导航 + 顶部导航右侧功能区）

```html
<a href="#" class="sidebar-menu-item active">
  <svg class="icon icon-nav">
    <use href="#icon-dashboard"></use>
  </svg>
  工作台
</a>

<style>
.menu-icon {
  margin-right: 8px;
}
.sidebar-menu-item.active .menu-icon {
  color: #3685F2;
}
</style>
```

**规则要点**：二级导航菜单 + 顶部导航右侧功能区图标可用，20px (`.icon-nav`)，间距 8px，主题蓝 `#3685F2`

#### 1.6 弹窗关闭按钮

```html
<div class="modal-header">
  <h3 class="modal-title">弹窗标题</h3>
  <button class="modal-close" aria-label="关闭">
    <svg class="icon">
      <use href="#icon-remove"/>
    </svg>
  </button>
</div>

<style>
.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: 4px;
  border-radius: var(--radius-r1);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.modal-close:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}
.modal-close .icon {
  width: 16px;
  height: 16px;
}
</style>
```

**规则要点**：标题栏右侧，16×16px 或 12×12px，Hover 有背景+颜色变化

#### 1.7 状态图标（成功/警告/错误/信息）

```html
<div class="alert alert-success">
  <svg class="icon alert-icon">
    <use href="#icon-circle-check"/>
  </svg>
  <span>操作成功！数据已保存。</span>
</div>

<style>
.alert {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-base);
  border-radius: var(--radius-r2);
  font-size: var(--font-size-body);
}
.alert-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}
.alert-success {
  background-color: var(--color-tag-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-tag-success-border);
}
</style>
```

### 2. 图标运用的禁止事项

1. **不要硬编码图标颜色**
   ```css
   .icon { fill: #7C8493; }  /* ❌ 错误 */
   .icon { fill: currentColor; }  /* ✅ 正确（已在 Sprite 中设置）*/
   ```
2. **不要混合使用不同风格的图标** — 同一页面内所有图标应来自同一图标库
3. **不要过度使用图标** — 不是每个按钮都需要图标，主要操作可加图标
4. **不要改变图标的语义** — 搜索图标只能用于搜索，删除图标不能用于"清空"
5. **不要让图标变形或模糊** — 保持原始宽高比，使用整数像素值
6. **不要使用 `<img>` 或 `<object>` 标签** — 必须使用 SVG Sprite 方式

***

## 检查清单

### 图标运用检查清单

| 检查项               | 要求                               | 通过条件                                |
| ----------------- | -------------------------------- | ----------------------------------- |
| 图标尺寸              | 按场景选择                            | 按钮/分页器16px，导航20px（仅二级）              |
| 图标颜色              | `currentColor`                   | 无硬编码 `fill` 值（Sprite 已统一设置）             |
| 图标间距              | 按钮 4px / 导航 8px（仅二级）/ 操作列按钮 12px | `gap` 或 `margin` 符合规范               |
| 水平三点              | 直接使用                             | `.more-icon` **无** `transform` ✅    |
| 搜索框图标             | 右侧定位 + **无Focus变色**              | `position:absolute` + 保持文字-3色       |
| 搜索框距右             | **8px**（不是10px）                  | `right: 8px`                        |
| 搜索框颜色             | **文字-3 #B9BFCB**（不是禁用色）          | `color: #B9BFCB`                    |
| 操作列数量             | **最多3个可见**（不是2个）                 | 第4个收至更多                             |
| 操作列间距             | **12px**（不是8px）                  | `gap: 12px`                         |
| 操作列颜色             | **主题蓝 #3685F2**（不是灰色）            | `color: #3685F2`                    |
| 导航图标层级            | **仅二级允许**                        | 一级/三级/四级禁止                          |
| 导航图标尺寸            | **20px**（不是16px）                 | `.icon-nav`                         |
| 禁用色使用             | **仅可操作图标禁用**                     | 不是搜索框/placeholder                   |
| 关闭按钮              | Hover 效果                         | 有 `background/color` 过渡             |
| 无障碍               | `aria-label`                     | 仅有图标的按钮有标签                          |
| Sprite 引用          | 页面 body 开头引入                     | 已正确引入 `icons-sprite.svg`               |

### 操作按钮组检查清单（v4.1.0）

操作列vs操作按钮组对比详见 [action-buttons.md](action-buttons.md)

---

*最后更新: 2026-05-29 | 版本: v7.0.0（修复 file:// 协议下图标不显示问题，统一为内联方式）*
