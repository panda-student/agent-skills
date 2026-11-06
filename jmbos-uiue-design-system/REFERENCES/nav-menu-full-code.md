# 导航栏与菜单完整代码模板 (Navigation Full Code)

> 📌 **定位**: 本文件为**完整代码模板**，包含可直接复制的 HTML+CSS 代码。
> 📖 **规范指南**（规则要点、结构图、速查表）请查阅 [navigation.md](./components/navigation.md)
>
> ⚠️ **本文件包含完整的 HTML+CSS 代码模板，仅在实现导航栏时阅读**

## 目录

* [顶部导航栏 + 左侧菜单 完整模板](#顶部导航栏--左侧菜单-完整模板)

* [CSS 样式详解](#css-样式详解)

* [Logo 集成规范](#logo-集成规范)

* [尺寸规范速查](#尺寸规范速查)

* [交互状态表](#交互状态表)

***

## 顶部导航栏 + 左侧菜单 完整模板

```html
<!-- ====== 顶部导航栏 (42px) ====== -->
<header class="top-nav">
  <div class="top-nav-left">
    <!-- Logo区域: 纯展示,无交互 (v4.12.0) -->
    <div class="top-nav-brand">
      <svg class="top-nav-logo" viewBox="0 0 180 42" xmlns="http://www.w3.org/2000/svg">
        <!-- 从 ASSETS/brand/logo（支持替换颜色）.svg 复制 -->
        <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
          <g transform="translate(32, 14)" fill="currentColor" fill-rule="nonzero">
            <polygon points="..."></polygon>
            <path d="M..."></path>
          </g>
        </g>
      </svg>
    </div>

    <!-- 导航菜单项: gap:0 + margin-left:0 (v4.19.0) -->
    <nav class="top-nav-menu">
      <a href="#" class="nav-menu-item active">内容管理</a>
      <a href="#" class="nav-menu-item">系统管理</a>
      <a href="#" class="nav-menu-item">权限管理</a>
      <a href="#" class="nav-menu-item">用户管理</a>
    </nav>
  </div>

  <div class="top-nav-right">
    <span class="org-selector">当前组织 ▾</span>
  </div>
</header>

<!-- ====== 左侧菜单栏 (180px) ====== -->
<aside class="sidebar">
  <ul class="sidebar-menu">
    <li><a href="#" class="sidebar-menu-item active"><svg class="sidebar-menu-icon">...</svg><span>首页</span></a></li>
    <li>
      <a href="#" class="sidebar-menu-item expanded"><svg class="sidebar-menu-icon">...</svg><span>二级菜单</span><svg class="sidebar-menu-expand">...</svg></a>
      <ul class="submenu">
        <li><a href="#" class="submenu-item">三级菜单</a></li>
        <li><a href="#" class="submenu-item active">三级菜单(选中)</a></li>
      </ul>
    </li>
  </ul>
</aside>
```

***

## CSS 样式详解

### 1. 顶部导航栏 (42px)

```css
.top-nav {
  position: fixed; top: 0; left: 0; right: 0;
  height: 42px;
  background-color: var(--color-brand);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px 0 0;       /* v4.19.0: 仅右侧padding,左侧无间距 */
  z-index: 1000;
  box-shadow: var(--shadow-s1);
}
.top-nav-left { display: flex; align-items: center; }

/* Logo容器 - 纯展示 */
.top-nav-brand { display: inline-flex; align-items: center; }

/* Logo SVG - 禁止内联width/height属性! */
.top-nav-logo {
  width: 180px; height: auto; display: block;
  color: #FFFFFF;
  transition: color 200ms ease-in-out;
}
.top-nav-light .top-nav-logo { color: #0C328C; }

/* 导航菜单容器 */
.top-nav-menu {
  display: flex; align-items: stretch;
  gap: 0; flex: 1;
  margin-left: 0;            /* v4.19.0: Logo与菜单无间距 */
  height: 100%;
}

/* 导航菜单项 - ⚠️ v5.1.0: 必须严格遵守文字样式规范! */
.nav-menu-item {
  display: flex; align-items: center; justify-content: center;
  padding: 0 16px;
  color: #FFFFFF;  /* ✅ 规范: 100%不透明度白色,禁止使用rgba(255,255,255,0.85) */
  text-decoration: none;
  font-size: 14px;  /* ✅ 规范: 固定14px,禁止使用var(--font-size-body) */
  font-weight: 600;  /* ✅ 规范: 字重600 (SemiBold),禁止400或500 */
  transition: all var(--transition-fast);
  border-radius: 0; white-space: nowrap;
  height: 100%;         /* 继承父容器42px高度 */
  min-height: 42px;     /* ✅ v5.1.1: 关键!确保最小高度42px,防止flex布局塌陷 */
  line-height: 1;       /* ✅ v5.1.1: 关键!重置行高,让align-items居中生效 */
  box-sizing: border-box;  /* ✅ v5.1.1: 关键!padding不撑破高度 */
  cursor: pointer;
}
.nav-menu-item:hover { background-color: rgba(255,255,255,0.10); color: #FFFFFF; }
.nav-menu-item.active { background-color: #FFFFFF; color: var(--color-brand); font-weight: 600; }  /* Active态保持字重600 */

/* 右侧功能区 */
.top-nav-right { display: flex; align-items: center; gap: var(--spacing-md); }
```

### 2. 左侧菜单栏 (180px)

```css
.sidebar {
  position: fixed; top: 42px; left: 0; bottom: 0;
  width: 180px;
  background-color: var(--color-bg-card);
  border-right: 1px solid var(--color-bg-divider);
  overflow-y: auto; z-index: 900;
  padding: 8px 0;
}
.sidebar-menu { list-style: none; padding: 0; margin: 0; }

/* 二级菜单项（左侧菜单从二级起算，顶部导航为一级） */
.sidebar-menu-item {
  display: flex; align-items: center;
  padding: 0 12px;
  color: #141b24;           /* C19: 主文本色,禁止#7C8493 */
  text-decoration: none;
  font-size: var(--font-size-body);
  font-weight: 400;         /* C21: 字重400 */
  transition: all var(--transition-fast);
  height: 32px; cursor: pointer;
}
.sidebar-menu-item:hover {
  background-color: #EDF3FA;   /* E7.9: hover仅背景变色,文字不变色! */
}
/* 展开状态(.expanded)也支持hover背景色!
   禁止设置 .sidebar-menu-item.expanded { background-color: transparent; }
   该规则会覆盖:hover的#EDF3FA，导致展开状态悬停无背景色 */
.sidebar-menu-item.active { background-color: #DEEDFF; color: var(--color-primary); }

/* 二级菜单图标 20x20px */
.sidebar-menu-icon {
  width: 20px; height: 20px; flex-shrink: 0;
  color: #141b24;           /* I8/E7.1.1: 未选中主文本色 */
  margin-right: 8px;
  display: inline-flex; align-items: center; justify-content: center;
}
.sidebar-menu-item.active .sidebar-menu-icon { color: #3685F2; }

/* 展开箭头 16x16px */
.sidebar-menu-expand {
  width: 16px; height: 16px; margin-left: auto;
  color: #141b24; flex-shrink: 0;
  transition: transform 200ms ease-in-out;
}
.sidebar-menu-item.expanded .sidebar-menu-expand { transform: rotate(180deg); }

/* 三级子菜单 - E7.10: 背景通铺+48px缩进 */
.submenu { padding-left: 0; }   /* 容器通铺 */
.submenu-item {
  display: flex; align-items: center;
  padding: 0 12px 0 48px;   /* 文字左侧48px缩进 */
  color: #141b24; text-decoration: none;
  font-size: var(--font-size-body); font-weight: 400;
  height: 32px; cursor: pointer;
  transition: all var(--transition-fast);
}
.submenu-item:hover { background-color: #EDF3FA; }
.submenu-item.active { background-color: #DEEDFF; color: var(--color-primary); }
```

***

## Logo 集成规范

### A. 强制执行场景

* ✅ 列表页 / 详情页 / 表单页 / 弹窗 / 仪表盘

### B. 动态变色核心要求

| 场景   | 导航栏背景色    | Logo显示颜色          | 实现方式                        |
| ---- | --------- | ----------------- | --------------------------- |
| 默认状态 | `#0C328C` | **白色 (#FFFFFF)**  | `color: #FFFFFF`            |
| 浅色模式 | `#FFFFFF` | **品牌色 (#0C328C)** | `color: var(--color-brand)` |

### C. ⚠️ 高频错误点 - Logo尺寸规范 (v4.18.0)

| 错误做法                            | 原因                    | 正确做法                                            |
| ------------------------------- | --------------------- | ----------------------------------------------- |
| `<svg height="24">` 内联属性        | HTML属性优先级>CSS,导致CSS失效 | 仅保留 `class` + `viewBox`                         |
| CSS `width: auto; height: auto` | 部分浏览器对无显式尺寸SVG使用默认小尺寸 | `.top-nav-logo { width: 180px; height: auto; }` |
| form.html 用文字降级                 | 不统一                   | 所有模板统一使用 SVG                                    |

### D. 🆕 降级方案 (v5.0.0) - 必须包含!

当Logo SVG文件缺失或数据损坏时,必须使用以下**三级降级机制**:

#### 方案1: 完整SVG (首选) - 从 ASSETS/brand/logo(支持替换颜色).svg 复制

```html
<div class="top-nav-brand">
  <svg class="top-nav-logo" viewBox="0 0 180 42" xmlns="http://www.w3.org/2000/svg">
    <!-- ✅ 完整的7个路径元素 (J-O-M-O-O-九牧) -->
    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <rect x="0" y="0" width="180" height="42"></rect>
      <g transform="translate(32, 14)" fill="currentColor" fill-rule="nonzero">
        <!-- ... 完整路径数据 ... -->
      </g>
    </g>
  </svg>
</div>
```

#### 方案2: PNG图片降级 - 当SVG不可用时

```html
<div class="top-nav-brand">
  <!-- ⚠️ 注意: PNG不支持动态变色,仅用于降级 -->
  <img class="top-nav-logo" src="../ASSETS/brand/logo（白色）.png" alt="JOMOO九牧" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';">
  <span style="display:none;">JOMOO九牧</span>
</div>
```

#### 方案3: 纯文字降级 - 最终兜底

```html
<div class="top-nav-brand">
  <span class="top-nav-logo-text">JOMOO九牧</span>
</div>
```

**配套CSS样式（必须定义）**：

```css
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

/* 浅色背景下显示品牌色 */
.top-nav-light .top-nav-logo-text {
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

> **⚠️ 强制要求**: 所有页面模板必须至少实现**方案1+方案3**的组合(SVG + 文字fallback)
>
> **⚠️ 关键提示**: `.top-nav-logo-text` 的 `width: 180px` 必须强制设置，否则文字宽度会随内容变化，导致Logo区域宽度不稳定。

***

## 尺寸规范速查

| 属性            | 值                       | 说明             |
| ------------- | ----------------------- | -------------- |
| **导航栏高度**     | **42px**                | 固定值            |
| **Logo宽度**    | **180px**               | viewBox原始宽度    |
| **Logo高度**    | ≈42px                   | 按viewBox比例自动计算 |
| **菜单项高度**     | 42px (100%)             | 继承父容器高度        |
| **菜单项内边距**    | `0 16px`                | 左右各16px        |
| **菜单项间距**     | **0** (`gap:0`)         | 无间距,紧密排列       |
| **Logo与菜单间距** | **0** (`margin-left:0`) | 紧贴排列           |
| **侧边栏宽度**     | **180px**               | 固定值            |
| **菜单项高度**     | **32px**                | 二/三/四级统一       |
| **菜单项内边距**    | `0 12px`                | 二/三级           |
| **子菜单文字缩进**   | **left: 48px**          | 三级/四级          |
| **二级图标尺寸**    | **20×20px**             | 不是16px!        |
| **展开箭头尺寸**    | **16×16px**             | 不是12px!        |

***

## 交互状态表

### 顶部导航菜单项

> ⚠️ **v5.1.0 强制规范: 文字样式必须严格遵守!**

| 状态         | 背景色                      | 文字色                        | 字号       | 字重                 | 说明                  |
| ---------- | ------------------------ | -------------------------- | -------- | ------------------ | ------------------- |
| **默认**     | 透明                       | `#FFFFFF` (100%不透明度)       | **14px** | **600** (SemiBold) | ⚠️ 禁止85%透明度、禁止字重400 |
| **Hover**  | `rgba(255,255,255,0.10)` | `#FFFFFF`                  | 14px     | 600                | 浅白底+纯白字             |
| **Active** | `#FFFFFF` (纯白)           | `var(--color-brand)` (品牌色) | 14px     | **600**            | ⭐ 纯白背景+品牌色文字        |

#### 🆕 文字样式速查表 (v5.1.0新增)

| 属性              | 值                        | 错误示例                                                      | 正确做法                                      |
| --------------- | ------------------------ | --------------------------------------------------------- | ----------------------------------------- |
| **font-size**   | **14px** (固定值)           | `font-size: var(--font-size-body)`                        | `font-size: 14px`                         |
| **font-weight** | **600** (SemiBold)       | `font-weight: 400` / `500` / `var(--font-weight-regular)` | `font-weight: 600`                        |
| **color**       | **#FFFFFF** (100%)       | `color: rgba(255,255,255,0.85)`                           | `color: #FFFFFF`                          |
| **height**      | **42px** (`height:100%`) | `height: auto` / 固定像素值                                    | `height: 100%; min-height: 42px;`         |
| **line-height** | **1** (重置)               | 缺失或设置具体值                                                  | `line-height: 1;` (配合flex居中)              |
| **box-sizing**  | **border-box**           | 缺失 (默认content-box)                                        | `box-sizing: border-box;` (防止padding撑破高度) |

> ⚠️ **v5.1.1 高度问题修复 (重要)**: 仅设置 `height: 100%` 在flex布局中可能不够,必须同时设置以下3个属性才能确保菜单项完全撑满42px:
>
> * `min-height: 42px;` - 防止高度塌陷
>
> * `line-height: 1;` - 重置行高让flex居中生效
>
> * `box-sizing: border-box;` - 确保padding不会增加实际高度

### 左侧菜单项 (⭐ 核心: hover不变色)

| 层级                  | Hover时背景色 | Hover时文字色           | 关键说明                                                       |
| ------------------- | --------- | ------------------- | ---------------------------------------------------------- |
| **二/三级**            | `#EDF3FA` | **不变色** (`#141b24`) | ⭐ 仅背景变色!                                                   |
| **三级/四级**           | `#EDF3FA` | **不变色** (`#141b24`) | 继承二级效果                                                     |
| **展开状态(.expanded)** | `#EDF3FA` | **不变色** (`#141b24`) | 展开状态也支持hover背景色! 禁止设置`background-color:transparent`覆盖hover |
| **选中态(任意层级)**       | `#DEEDFF` | `#3685F2`           | 背景和文字都变                                                    |
| **2级菜单高亮(子级选中)**    | 不变        | `#3685F2`           | ⭐ 文字变主题蓝，不加粗（`.has-active` 类）                              |

> ⭐ **父级菜单高亮规则**：当3级菜单被选中时，其父级2级菜单需添加 `.has-active` 类高亮显示。完整规范和 JS 逻辑 → [page-layout.md §侧边栏菜单高亮规范](./page-layout.md#侧边栏菜单高亮规范-)

> 详细组件规范 → [components.md §导航栏与菜单](./components.md#导航栏与菜单-navigation)
> Logo使用规范 → [ASSETS/brand/README.md](../ASSETS/brand/README.md)

***

## 🆕 完整示例: 左侧菜单 + 图标集成 (v5.2.0)

### ⚠️ 重要: 图标引入方式 (必须先引入 Sprite)

> **在使用图标之前,必须在 HTML 的** **`<body>`** **开头引入 SVG Sprite 文件!**

```html
<body>
  <!-- ⭐ SVG Sprite 图标库(从 ASSETS/icons/icons-sprite.svg 复制完整内容) -->
  <svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
    <symbol id="icon-dashboard" viewBox="0 0 16 16">
      <path d="..." fill="currentColor"/>
    </symbol>
    <symbol id="icon-component" viewBox="0 0 16 16">
      <path d="..." fill="currentColor"/>
    </symbol>
    <!-- ... 其他116个图标 ... -->
  </svg>

  <!-- 页面内容 -->
</body>
```

### 左侧菜单完整 HTML 结构 (使用 Sprite 引用)

```html
<!-- ====== 左侧菜单栏 (180px) ====== -->
<aside class="sidebar">
  <ul class="sidebar-menu">
    <!-- 二级菜单: 首页 -->
    <li>
      <a href="#" class="sidebar-menu-item active">
        <!-- ✅ 使用 SVG Sprite 引用图标 -->
        <svg class="sidebar-menu-icon">
          <use href="#icon-dashboard"></use>
        </svg>
        <span>首页</span>
      </a>
    </li>

    <!-- 二级菜单: 内容管理(带子菜单) -->
    <li>
      <a href="#" class="sidebar-menu-item expanded">
        <svg class="sidebar-menu-icon">
          <use href="#icon-component"></use>
        </svg>
        <span>内容管理</span>
        <!-- 展开箭头 -->
        <svg class="sidebar-menu-expand">
          <use href="#icon-chevron-down"></use>
        </svg>
      </a>
      <ul class="submenu">
        <li><a href="#" class="submenu-item">文章管理</a></li>
        <li><a href="#" class="submenu-item active">分类管理(选中)</a></li>
        <li><a href="#" class="submenu-item">标签管理</a></li>
      </ul>
    </li>

    <!-- 二级菜单: 系统设置 -->
    <li>
      <a href="#" class="sidebar-menu-item">
        <svg class="sidebar-menu-icon">
          <use href="#icon-cog"></use>
        </svg>
        <span>系统设置</span>
      </a>
    </li>

    <!-- 二级菜单: 用户管理 -->
    <li>
      <a href="#" class="sidebar-menu-item">
        <svg class="sidebar-menu-icon">
          <use href="#icon-users"></use>
        </svg>
        <span>用户管理</span>
      </a>
    </li>

    <!-- 二级菜单: 消息中心 -->
    <li>
      <a href="#" class="sidebar-menu-item">
        <svg class="sidebar-menu-icon">
          <use href="#icon-inbox"></use>
        </svg>
        <span>消息中心</span>
      </a>
    </li>
  </ul>
</aside>
```

常用图标详见 [icons/README.md](../ASSETS/icons/README.md) 图标清单

### 图标使用注意事项

| ⚠️ 常见错误                                                | ✅ 正确做法                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| 内联整个SVG路径代码                                            | 使用 `<svg><use href="#icon-xxx"></use></svg>` 引用 Sprite            |
| 使用 `<use xlink:href="icons-sprite.svg#icon-xxx">` 外部引用 | **必须内联 Sprite 到 HTML**,然后使用 `href="#icon-xxx"`                    |
| 硬编码 `width="20" height="20"`                           | 通过 CSS class `.sidebar-menu-icon { width:20px; height:20px; }` 控制 |
| 使用 `<img>` 标签加载SVG                                     | 必须使用 `<svg><use></use></svg>` 以支持 currentColor                    |
| 图标颜色不随状态变化                                             | Sprite 内部已使用 `fill="currentColor"`,通过父元素 `color` 控制颜色             |

> 详细规范指南 → [components/navigation.md](./components/navigation.md)(规则要点、结构图、速查表)
> Logo使用规范 → [ASSETS/brand/README.md](../ASSETS/brand/README.md)

***

## 菜单数据占位约定与替换说明（v10.0 新增）⭐

> **背景**：原型生成时，菜单结构需根据实际业务模块动态调整。本节定义菜单数据的占位约定与替换流程，确保 AI 生成时菜单结构可控、可追溯、不串模块。

### 1. 菜单数据结构格式

菜单数据分三层组织，统一在 `js/common.js` 中配置：

* **一级模块**（`menuItems`）：顶部导航栏菜单项，含 `key`（唯一标识）、`name`、`isDefault`。

* **二级菜单组**（`sidebarConfig[key]`）：侧边栏菜单项，按一级模块 `key` 分组，含 `name`、`icon`（Sprite ID）、`children`。

* **三级菜单**（`sidebarConfig[key].children`）：子菜单项，含 `name`、`pageId`（对应 `pageRoute`）、`isDefault`。

* **页面路由**（`pageRoute`）：`pageId` → `{ name, file }` 映射，`file` 指向 `pages/D-XXX_{页面功能名称}.html`（首页 `index.html`）。

### 2. 数据替换规则

* ⚠️ **禁止原样复制模板菜单**：必须根据实际业务模块替换 `menuItems`、`sidebarConfig`、`pageRoute` 的占位内容。

* 每个页面只归属于**一个一级模块**，禁止跨模块菜单污染。

* 子页面导航由 `js/common.js` 统一渲染，无需单独配置菜单；当前页菜单项须添加 `active` 类，所属二级菜单默认展开。

* 半自定义/全自定义页面通过 `pageRoute` 类型声明（`list`/`detail`/`form`/`custom`/`fullscreen`）控制加载方式与导航显示。

### 3. 替换流程

1. 填写「菜单归属矩阵」→ 确定页面与模块的归属关系
2. 修改 `js/common.js` 的 `menuItems` + `sidebarConfig` + `pageRoute` → 填入实际模块和菜单结构
3. 确认各 `pages/D-XXX_{页面功能名称}.html` 的 `__pageId` → 与 `pageRoute` 的 key 一一对应
4. 设置当前页 `active` 状态 → 菜单项高亮
5. 页面切换验证 → 确认 `switchPage` 正确切换页面内容

> 完整菜单数据示例参见 SKILL.md §3.8 菜单归属矩阵

> ⚠️ **common.js 阅读禁令 + 复制铁律**：该文件约 186KB，其中 86% 为内嵌 SVG 图标（第176~642行），**禁止全量阅读**。菜单配置仅需操作文件开头 1~118 行（`menuItems`/`sidebarConfig`/`pageRoute` 三处），用局部读取或 grep 定位。**搭建环境时必须用 `cp` 命令直接复制**（G6.1），禁止用 Read 读取后用 Write 重写。

> **关联文档**：统一入口配置 → [common.js](../ASSETS/page-shells/js/common.js)（仅局部读取，见上方禁令）｜ 菜单归属矩阵 → [SKILL.md §3.8](../SKILL.md) ｜ 检查项 → [implementation-guide.md § L1-L3](./implementation-guide.md#611-导航系统l1-l3)

***

