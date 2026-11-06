# 实现路径详解（路径A/B/C）

> SKILL.md §6.1 的详细步骤外迁文档。SKILL.md 仅保留路径选择决策表，本文件提供每条路径的完整执行步骤。

## 路径A — 标准页面

### 步骤一：选择模板

| 类型 | 模板 |
|------|------|
| 列表页 | `page-shells/pages/list.html` + `page-shells/js/pages/list.js` |
| 表单页 | `page-shells/pages/form.html` + `page-shells/js/pages/form.js` |
| 详情页 | `page-shells/pages/detail.html` + `page-shells/js/pages/detail.js` |
| 弹窗 | `page-shells/pages/modal.html` + `page-shells/js/pages/modal.js`（参考模板，提取片段嵌入父页面 .html）→ 规范见 [components/modal.md](components/modal.md) |
| 抽屉 | `page-shells/pages/list.html`（抽屉片段嵌入父页面 .html）→ 规范见 [components/drawer.md](components/drawer.md) |

> `pages/modal.html` 是弹窗样式参考（含三种尺寸），提取HTML/CSS嵌入父页面 .html 文件，不生成独立弹窗HTML。
> 抽屉为嵌入式组件，提取HTML/CSS/JS嵌入父页面 .html 文件，不生成独立抽屉HTML。完整规范见 [drawer.md](components/drawer.md)。

### 步骤二：搭建环境

统一MPA架构，每个页面独立 HTML + 独立 JS，按以下流程：

1. **文件级复制公共资源**（G6.1 铁律 — 禁止 Read+Write 重写）：
   ```bash
   cp ASSETS/page-shells/css/common.css css/common.css
   cp ASSETS/page-shells/js/common.js js/common.js
   ```
   ⚠️ `common.js` 约 186KB（86%为内嵌 SVG Sprite），**必须用 `cp` 命令直接复制，禁止用 Read 读取后用 Write 重写**——Read+Write 必然丢失内容或超限。
2. 按 §3.8 矩阵替换 `js/common.js` 三处配置：`menuItems`/`sidebarConfig`/`pageRoute`
3. 生成 `pages/D-XXX_{页面功能名称}.html`：页面 HTML 主体（含完整 `<head>` + `<body>`），在 `<body>` 开头声明 `<script>window.__pageId='路由ID';</script>`（路由ID 用 kebab-case，如 `user-list`），在 `</body>` 前引入 `js/pages/D-XXX_{页面功能名称}.js`。页面 CSS 内联于 `<head>` 的 `<style>` 块
4. 生成 `js/pages/D-XXX_{页面功能名称}.js`：页面配套 JS，函数定义 + IIFE 初始化（无需注入 CSS/HTML）
5. 生成 `index.html`：重定向壳（依 G1）——元信息头（编号 INDEX）+ common 引用 + `<script>location.replace('pages/{默认首页}.html')</script>`，禁止搭载业务内容；业务页面全部放 `pages/D-XXX_{页面功能名称}.html`

依据 §G3，所有页面 JS 存放于 `js/pages/`。

> **修改原则**：改页面内容/样式 → 只改 `pages/D-XXX_{页面功能名称}.html`（含内联 `<style>`）或 `js/pages/D-XXX_{页面功能名称}.js`；改导航菜单 → 只改 `js/common.js`。

> **图标**：`js/common.js` 已内联 `icons-sprite.svg`（113个全部），用 `<use href="#icon-xxx">`。

> **放大适配已内置**：`js/common.js` 已包含响应式 zoom 逻辑（基准1280px，上限120%），所有MPA页面无需额外处理缩放。

---

## 路径B — 半自定义页面

**组合策略**：标准区域严格走路径A流程，自定义区域走路径C规则。

**执行顺序**：
1. 先按路径A完成标准区域（选择模板→搭建环境→填充标准组件）
2. 再按路径C在自定义区域补充内容（仅遵守Design Token）
3. 两类区域合并到同一页面：自定义区域的 CSS 归入页面 .html 的 `<style>` 块、HTML 归入 `<body>`、交互归入 `js/pages/D-XXX_{页面功能名称}.js`

**关键约束**：标准区域必须逐行复制规范代码；自定义区域颜色/字体/间距/圆角/阴影/动画必须用CSS变量，布局和实现可灵活。

---

## 路径C — 全自定义页面 / 半自定义的自定义区域

**适用**：Dashboard大屏、可视化报表、特殊交互页、或标准骨架中嵌入的自定义模块。

> **统一MPA架构**：路径C 同样产出独立 `pages/D-XXX_{页面功能名称}.html` + `js/pages/D-XXX_{页面功能名称}.js`。与路径A的区别仅在于：不使用标准模板（list/form/detail/modal），页面内容从零编写，布局和组件可自由设计。

### 步骤一：搭建MPA环境

与路径A步骤二一致：
1. **文件级复制公共资源**（G6.1 铁律 — 禁止 Read+Write 重写）：
   ```bash
   cp ASSETS/page-shells/css/common.css css/common.css
   cp ASSETS/page-shells/js/common.js js/common.js
   ```
   ⚠️ `common.js` 约 186KB（86%为内嵌 SVG Sprite），**必须用 `cp` 命令直接复制，禁止用 Read 读取后用 Write 重写**。
2. 按 §3.8 矩阵替换 `js/common.js` 三处配置：`menuItems`/`sidebarConfig`/`pageRoute`
3. 生成 `pages/D-XXX_{页面功能名称}.html`：页面 HTML 主体，在 `<body>` 开头声明 `<script>window.__pageId='路由ID';</script>`，CSS 内联于 `<head>` 的 `<style>` 块
4. 生成 `js/pages/D-XXX_{页面功能名称}.js`：配套 JS（函数定义 + IIFE 初始化）
5. 生成 `index.html`：重定向壳（依 G1）——元信息头 INDEX + common 引用 + `location.replace` 到默认首页（pages/ 下第一个业务页），禁止搭载业务内容

> **与路径A区别**：不要求选择标准模板、逐行复制组件代码、匹配4种标准布局。仅保证 Design Token（CSS变量）使用和视觉一致性。全屏页面可在 `js/common.js` 的 `menuItems` 中设置 `fullscreen: true`，自动启用全屏模式（隐藏侧边栏）。

### 步骤二：验证

```bash
node scripts/validate-design.mjs pages/D-XXX_{页面功能名称}.html
```

检测：E2 硬编码颜色（应使用CSS变量）。Tokens/Sprite/Zoom 由 `common.css`/`common.js` 提供。FAIL 时检查 common.css/common.js 是否从 ASSETS 正确复制。

> **验证**：`node scripts/validate-design.mjs pages/D-XXX_{页面功能名称}.html`
