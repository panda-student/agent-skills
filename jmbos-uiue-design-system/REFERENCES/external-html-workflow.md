# 外部 HTML 原型 → MPA 转换流程

> JMBOS UIUE Design System — 外部 HTML 原型（独立 .html / 已转 .js 带污染）→ 规范 MPA 页面的完整清洗转换指南
>
> **定位**：本文件是 SKILL.md §1.0b「不符合规范自动纠正」和 §1.0c「结构合规自动纠正」的**详细映射表与执行流程来源**：①通用纠正的修复映射表（颜色/圆角/内联 style，任何场景检测到不符合时用）②外部原型导入的完整 7 步清洗流程 ③结构合规检测与纠正映射（M1-M14，任何原型通用）。SKILL.md §1.0b/§1.0c 仅留通用规则，详细查本文。
>
> **与 SKILL.md 的关系**：SKILL.md §1.0b 触发自动纠正 → 查本文「步骤二 §2.2」映射表（颜色/圆角就近映射）；SKILL.md §1.0c 触发结构合规纠正 → 查本文「步骤一 §1.3」M1-M14 检测项（纠正由 structure-fix.mjs 自动执行，流程见 §2.5）；外部原型导入额外走本文步骤一\~七 完整 7 步（检测→值级清洗→结构性清洗→三部分分离检测门→组件匹配检测门→资源检测门→校验）。
>
> **适用形态**：
>
> * **形态 A**：独立 `.html` 文件（含完整 `<head>` + `<body>`，内联 CSS/JS/图片）
>
> * **形态 B**：已转 `.js` 的旧 SPA 页面（`window.__renderPage` 结构，带大量污染：内联 style、硬编码值、非标准 class）— 需清洗并纠正为 MPA 独立页面

***

## 0. 改造深度分级（脚本硬信号驱动，动手前必须先判定）

> **总原则（SKILL.md §G11 基底优先）**：凡输入存在可用文件，一律以原文件为基底就地改造，DOM 与业务内容**从源文件搬运，禁止从零重写**。「重新生成」路径已废除。两种输入仅区别于**改造深度**。

### 0.1 判定流程（禁止主观判定）

> ⚠️ **深度判定必须由脚本硬信号驱动**，禁止凭输入来源（"是不是本技能产出的"）或用户措辞（"清洗/整理"）直接判轻量——SPA 结构（JS 内嵌 HTML）外观与普通页面无异，主观判定必然漏判（曾导致清洗跳过三部分分离、结构错误）。

```
第一步（强制）：对每个输入文件执行
  node scripts/structure-fix.mjs --detect <文件>   # M1-M14 结构检测（.js 自动只检 M1/M11）
  node scripts/style-scan.mjs <文件>               # S69 SPA 特征复检

第二步：依硬信号定深度（任一命中 → 深度改造）
  深度硬信号：M1 FAIL ｜ M11 FAIL ｜ S69 FAIL ｜ 输入为 .js 文件 ｜ <body> 无实际 DOM（内容藏在 JS 里）
  → 走完整 7 步：步骤零（flatten 预处理）→ 步骤四（三部分分离）→ 其余步骤

第三步：轻量资格（三条全过才允许轻量）
  ① detect 无 SPA 信号（M1/M11/S69 均 PASS）
  ② 输入为含真实 DOM 的 .html
  ③ detect 仅剩可自动纠正项（值级污染/内联 style/缺失元信息头等）
  → 轻量路径：七步全走，步骤四五六检测门直通（PASS即过），
    实际改造动作仅 步骤一 → 二 → 三 → 七
  ※ 无论判定结果如何，步骤四五六的检测必须执行（误判兜底）
```

### 0.2 深度对照表

| 深度 | 判定依据（脚本硬信号） | 执行路径 | 内容规则 |
| --- | --- | --- | --- |
| **深度改造** | M1/M11/S69 任一 FAIL，或输入 .js，或 body 无实际 DOM | 完整 7 步：步骤零（flatten）→ 一 → 二 → 三 → 四五六（检测门 FAIL，执行拆分/纠正/补资源）→ 七 | DOM 与内容从源文件搬运 |
| **轻量改造** | 0.1 第三步三条全过 | 七步全走，但步骤四五六为**检测门直通**（PASS 即过，输出证据），实际改造动作仅 步骤一 → 二 → 三 → 七 | 内容不动，仅洗规范层 |

> **检测门铁律**：步骤四/五/六的**检测**任何场景必须执行（是深度判定失误的最后兜底）；轻量与深度的区别仅在检测 FAIL 后是否执行拆分等改造动作。"跳过步骤四五六"是被禁止的说法。

> 判定存疑时（如 detect 输出与文件外观矛盾）**一律就高走深度改造**——深度流程对已规范文件同样安全（检测后仅纠正违规项），轻量流程对 SPA 文件则是灾难。

### 改造铁律（违反任一即为失败）

1. **内容搬运**：HTML DOM 结构与业务文案必须与输入文件一一对应，禁止凭记忆/规范重写；"换方案/重新做"按 SKILL.md §1.1「全新创建」处理（先备份旧文件），不在本流程内
2. **文件对应**：轻量改造输入输出文件 1:1 原地修改；深度改造仅允许"单文件搬运式拆分为 MPA 多文件"（内容搬运，非新建重写）
3. **体积守恒**：改造前后行数/字符数基本一致（±15% 内，依 SKILL.md §G2.1）；大幅缩减说明误删或重写了内容
4. **规范读取最小化**：仅需本文 §2.2 污染映射表（颜色/圆角）+ §1.3 M1-M14 表；**禁止全量阅读 components/ 组件规范与 ASSETS/page-shells/ 页面模板**（清洗不引入新组件，模板骨架已存在于待清洗文件中）
5. **逐页串行（默认）**：多页改造默认按页串行原地修改；满足 [SKILL.md §6.8 模式B](../SKILL.md) 三前提（单元独立/规则可注入/试点先行）时可行页面级并行——子代理指令须注入本节规则与 §2.2 污染映射（配方卡，见 [parallel-workflow.md 附录E](parallel-workflow.md)），禁止子代理自行读规范；主代理试点后派发并验收（不信任子代理自检结论，只信脚本输出）。深度拆分类（M1/M11）与公共文件一律串行
6. **资源不动**（仅轻量改造）：已有产物已引用 `common.css`/`common.js`，禁止重复注入或改动资源引用（M7 检测 PASS 即可）

***

## 1. 核心原则

### 1.1 清洗原则

> **规范覆盖的部分必须清洗为标准写法；规范未覆盖的部分保留原值并映射 design-tokens。**

| 污染类型      | 判定规则                                       | 清洗方式                                        |
| --------- | ------------------------------------------ | ------------------------------------------- |
| 硬编码颜色（主题色/文字色/中性色场景） | `#xxxxxx` 出现在 UI 组件（按钮/文字/背景等）且不在 design-tokens 色板中 | 替换为 design-tokens 中定义的色值（`var()` 或正确 hex 均可）  |
| 硬编码颜色（多数据/多图表场景） | `#xxxxxx` 出现在图表/数据可视化区域（canvas/svg-path/chart 类名） | **允许保留**（多色区分需求，不强制映射） |
| 硬编码颜色（模糊场景） | `#xxxxxx` 不在色板中且场景无法明确判断 | 提示用户确认是否需要修正 |
| 硬编码颜色（色值匹配色板） | `#xxxxxx` 值等于 design-tokens 中定义的色值 | **PASS**（色值正确，`var()` 形式可选） |
| 非标准圆角     | `border-radius: Npx` 且 N ∉ {0,2,4,8,12,16} | 映射到最近规范值或 `var(--radius-r1~r5)`             |
| 内联 style  | `style="..."` 出现在 HTML 标签                  | 提取为语义化 class + CSS 变量                       |
| 非标准 class | class 名不在规范组件库内                            | 按语义匹配 components/ 规范组件 class                |
| 内联 CSS    | `<style>` 或 `css` 字符串中含硬编码值                | 提取为 design-tokens 变量引用                      |
| 内联 JS     | `<script>` 或函数中含业务逻辑                       | 提取为独立 `js/pages/D-XXX_{页面功能名称}.js`                |
| JS 模板字符串内嵌 HTML | `var html = \`<div>...\`` 等（HTML 藏在 JS 函数中） | 执行 `quick-fix.mjs flatten` 提取为独立 .html 文件 |
| 外链资源      | `<link href>` / `<img src>` 指向外部           | 内联或按需存入 `js/lib/` 与 `images/`（无实际需要不创建空文件夹） |
| 绝对定位      | `position: absolute` + 固定坐标                | 改用 flex/grid 语义化布局                          |

### 1.2 禁止事项

* **禁止**在 UI 组件场景（按钮/文字/背景等）保留非规范色值（必须替换为 design-tokens 色值）

* **禁止**保留任何内联 `style="..."`（必须提取为 class）

* **禁止**直接翻译外部原型的绝对定位坐标为 `position: absolute`（用 flex/grid 语义化）

* **禁止**保留外部原型的非标准 class 名（必须匹配规范组件 class）

* **禁止**跳过污染检测直接交付（必须通过 style-scan S39/S40 + E6 检测项）

* **禁止**用外链 CDN/外链 JS（依 G3，所有 JS 存本地；`js/lib/` 仅在实际需要第三方库时才创建）

> **例外**：多数据/多图表场景允许使用非规范色值（多色区分需求，style-scan S40 自动识别为 SKIP）

***

## 2. 流程总览

```
外部原型（.html / .js）→ 步骤零：flatten 预处理（S69 触发时）→ 步骤一：污染检测（含 M1-M14 结构合规检测）
 步骤二：值级自动清洗 + 结构合规自动纠正 → 步骤三：结构性清洗（内联 style 提取）
 步骤四：HTML/CSS/JS 三部分分离 → 步骤五：规范组件匹配 → 步骤六：资源内联 → 步骤七：校验
```

> **结构合规纠正触发**：当用户进入新迭代、基于历史原型补充需求或导入外部原型时，系统自动执行步骤一 §1.3 的 M1-M14 检测——任何原型（历史产物/外部导入/新产出）只要结构不符合当前规范即自动纠正（步骤二补充），纠正完成后再进入正常工作流。用户无需感知结构变更。

***

## 步骤零：flatten 预处理（JS 模板字符串内嵌 HTML）

> **触发条件**：style-scan S69 FAIL（HTML/CSS 全藏在 JS 模板字符串中，如 `var html = \`<div>...\``，style-scan 无法扫描）

```bash
# 1. 确认触发（S69 FAIL 才需要 flatten）
node scripts/style-scan.mjs --quiet /path/to/external-page.js

# 2. 执行 flatten：提取 JS 模板字符串中的 HTML/CSS → 同目录 .flattened.html
node scripts/quick-fix.mjs flatten /path/to/external-page.js

# 3. 后续步骤一~七均对 .flattened.html 执行
node scripts/validate-design.mjs /path/to/external-page.flattened.html
```

> **注意**：flatten 仅提取 HTML/CSS 结构，JS 业务逻辑仍需在步骤四中手动分离到 `js/pages/D-XXX_{页面功能名称}.js`

***

## 步骤一：污染检测

> **强制触发**：用户输入含"外部原型""导入原型""转换原型""清洗原型"等关键词，或直接提供外部 `.html`/`.js` 文件路径时，**必须**执行本步骤。

### 1.1 自动检测（validate-design.mjs + structure-fix.mjs）

```bash
# 形态 A：独立 .html 文件
node scripts/validate-design.mjs /path/to/external-prototype.html

# 形态 B：已转 .js 的 SPA 页面
node scripts/validate-design.mjs /path/to/external-page.js

# 结构合规检测（M1-M14，检测历史原型是否使用已废弃的结构）
node scripts/structure-fix.mjs --detect /path/to/external-prototype.html
```

**重点检测项**：

| 检测项 | 含义          | 清洗责任        |
| --- | ----------- | ----------- |
| style-scan S40 | 硬编码颜色值（三级策略：色板匹配→PASS，UI场景→FAIL，图表→SKIP，模糊→WARN） | 值级自动清洗（步骤二） |
| style-scan S39 | 非标准圆角值      | 值级自动清洗（步骤二） |
| style-scan S69 | JS 模板字符串内嵌 HTML 结构 | flatten 预处理（步骤零） |
| E6 | 内联 style 污染（Sprite 容器 `display:none` 行级白名单豁免——官方固有模式，hidden 属性对 SVG 无效） | 结构性清洗（步骤三）  |
| structure-fix M1-M14 | 结构合规检测（详见 §1.3） | 结构性纠正（步骤二补充） |

### 1.2 检测输出解读

E6 输出三段信息，对应三步处理：**内联 style 清单**（行号+内容）→ 步骤三提取为 class；**硬编码颜色清单** → 步骤二自动映射；**非标准圆角清单** → 步骤二报告 + 步骤三手动确认。

### 1.3 结构合规检测（M1-M14）

> **触发时机**：①读取历史原型文件时（迭代区/知识图谱拉取） ②用户指定目录批量扫描时 ③§1 增量模式读取历史时 ④外部原型导入时

> **工具**：`node scripts/structure-fix.mjs [--detect] [--basic] <文件或目录>`
>
> - `--basic`：仅纠正**基础必要项**（M1-M4/M7-M9/M12），跳过骨架导航项——用于**路径C 全自定义页**及用户明确要求保留自定义结构时
> - 默认（无 `--basic`）：全量检测纠正（M1-M14）——用于**路径A 标准页/路径B 半自定义页/外部原型导入**

> **纠正原则**：纠正属于重大修改，按 §G2 执行备份后再纠正。纠正完成后须依次通过 `structure-fix.mjs --detect` + `validate-design.mjs` + `layout-scan.mjs`（路径C 跳过）+ `style-scan.mjs` 校验全 PASS，方可进入正常工作流。

**分级纠正规约**（按 §3.7 页面类型判定，避免对自定义页过度纠正）：

| 级别 | 检测项 | 适用范围 |
| --- | --- | --- |
| 基础必要项 | M1-M4 / M7-M9 / M12 | 路径A/B/C 全部强制 |
| 骨架导航项 | M5 导航壳挂载点 / M6 布局骨架 / M10 `.page-card` | 路径A 强制；路径B 按骨架匹配部分适用；**路径C 跳过**（仅报告，保留用户自定义结构） |
| 仅报告项 | M4 文件命名 / M11 SPA挂载 | 所有路径均不自动纠正，须手动处理 |

| 编号 | 级别 | 检测项 | 不符合规范的结构 | 当前标准 | 自动纠正 | 需手动 |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | 基础 | SPA→MPA 结构 | `window.__renderPage` / JS 模板字符串内嵌 HTML | MPA 独立 HTML + 配套 JS | flatten 提取 | 四部分分离+组件匹配 |
| M2 | 基础 | 缺失元信息头 | `<head>` 内无产物编号注释 | 元信息头（产物编号/页面名称/页面类型等） | ✅ 从 `<title>` 推断注入 | 补充 D-XXX 编号/模块 |
| M3 | 基础 | 缺失 `__pageId` | 无路由ID声明 | `<script>window.__pageId='路由ID';</script>` | ✅ 从文件名生成 kebab-case | — |
| M4 | 报告 | 旧文件命名 | 任意文件名 | `D-XXX_{页面功能名称}.html` | ❌ 仅报告 | 重命名+更新引用 |
| M5 | 骨架 | 缺失导航壳挂载点 | 无 `#header` / `#sidebar` | `<div id="header"></div>` + `<aside id="sidebar">` | ✅ 注入挂载点 | — |
| M6 | 骨架 | 缺失布局骨架 | 无 `.main-wrapper` / `.main-content` | 标准布局骨架容器 | ✅ 随 M5 联动 | — |
| M7 | 基础 | 缺失 common 引用 | 无 common.css / common.js | `<link>` + `<script src>` 引用 | ✅ 自动判断路径注入 | — |
| M8 | 基础 | 旧卡片类名 | `.content-card`（已废弃） | `.page-card` | ✅ 全局替换 | — |
| M9 | 基础 | 内联业务 JS | `<body>` 内 `<script>` 含业务逻辑 | 独立 `js/pages/D-XXX_{名称}.js` | ✅ 提取为独立文件 | — |
| M10 | 骨架 | 缺失 `.page-card` | 无内容区大卡片容器 | `<div class="page-card">` | ✅ 注入容器 | — |
| M11 | 报告 | SPA 注入式挂载 | `mountPage` / `renderApp` / `createApp` | MPA `location.href` + `sessionStorage` | ❌ 仅报告 | 手动重构为 MPA |
| M12 | 基础 | 四部分组织完整性 | 缺少四部分中的任意项 | 元信息头+CSS+HTML+JS引用+路由ID | M2-M7 汇总 | — |
| M13 | 结构 | 配套JS存放位置（G3） | `pages/` 下出现 `.js` 文件 | 配套 JS → `js/pages/D-XXX_{名称}.js`，`pages/` 只放 `.html` | ✅ 移动至 `js/pages/` + 全项目修正引用 | — |
| M14 | 结构/报告 | 命名子页未独立成子页 HTML（G1 MPA） | `js/pages/D-XXX_*.js` 无对应 `pages/D-XXX_*.html`；或任意 HTML 引用 `pages/*.js` | 命名子页独立成 `pages/D-XXX_*.html`，页面内容不滞留在 `index.html` | ❌ 仅报告 | 搬运式拆分（G11，禁止重写） |

> **纠正优先级**：P0（M1 SPA→MPA / M5 导航壳挂载点）→ P1（M2 元信息头 / M3 `__pageId` / M7 公共资源引用）→ P2（M6 布局骨架 / M10 page-card / M8 旧类名 / M9 内联JS）→ P3（M4 文件命名 / M11 SPA挂载 / M12 汇总 / M13 JS存放位置 / M14 页面拆分）
>
> **工程结构级审计说明**：M1-M12 均为「文件内容级」检测器，M13/M14 为「工程结构级」审计（文件树布局），补齐内容级检测的盲区——页面内容堆在 index.html、JS 放错 pages/ 等违规不会触发 M1-M12 任一 FAIL，由 M13/M14 拦截。审计在逐文件检测前对项目根执行一次（单文件位于 `pages/` 下时自动上溯至项目根）。
>
> **纠正执行**：自动项由 `structure-fix.mjs` 执行（流程见 §2.5）；每项定义与纠正方式同时见脚本 header 注释。

***

## 步骤二：值级自动清洗（硬编码值 → CSS 变量）

> **工具**：`node scripts/quick-fix.mjs pollution <文件>` 自动映射硬编码颜色到 design-tokens 变量
>
> **⚠️ var() 转换为可选优化**：S40 三级色值策略下，色值匹配 design-tokens 色板即 PASS，var() 转换非必须。本步骤适用于需要主题切换支持的场景。
>
> **多数据/多图表场景例外**：图表/数据可视化区域的非规范色值允许保留，不强制映射。

### 2.1 执行自动清洗

```bash
# 形态 A / 形态 B 通用
node scripts/quick-fix.mjs pollution /path/to/external-prototype.html
# 或
node scripts/quick-fix.mjs pollution /path/to/external-page.js
```

### 2.2 自动映射规则

**颜色映射表**（来源：`ASSETS/design-tokens.css`）：

| 硬编码值      | 上下文               | 映射目标                          |
| --------- | ----------------- | ----------------------------- |
| `#3685F2` | 通用                | `var(--color-primary)`        |
| `#5E9DF5` | 通用                | `var(--color-primary-hover)`  |
| `#2364CC` | 通用                | `var(--color-primary-active)` |
| `#0C328C` | 通用                | `var(--color-brand)`          |
| `#141b24` | 通用                | `var(--color-text-primary)`   |
| `#7C8493` | 通用                | `var(--color-text-secondary)` |
| `#B9BFCB` | 通用                | `var(--color-text-tertiary)`  |
| `#EBF1F6` | 通用                | `var(--color-bg-page)`        |
| `#F4F7F9` | 通用                | `var(--color-bg-header)`      |
| `#EDF3FA` | 通用                | `var(--color-bg-hover)`       |
| `#E4E7F0` | 通用                | `var(--color-bg-divider)`     |
| `#04D999` | 通用                | `var(--color-success)`        |
| `#FF813B` | 通用                | `var(--color-warning)`        |
| `#FF4D5D` | 通用                | `var(--color-error)`          |
| `#FFFFFF` | color             | `var(--color-text-white)`     |
| `#FFFFFF` | background/border | `var(--color-bg-card)`        |
| `#D2D7E1` | color             | `var(--color-text-disabled)`  |
| `#D2D7E1` | background/border | `var(--color-bg-border)`      |

**上下文敏感映射**：`#FFFFFF` 和 `#D2D7E1` 按属性区分（color → 文字色变量；background/border → 背景/边框变量）。

**大小写不敏感**：`#141b24` 与 `#141B24` 等价，统一按大写比较。

### 2.3 自动清洗范围

| 污染类型               | 自动处理          | 手动处理           |
| ------------------ | ------------- | -------------- |
| 硬编码颜色（色值匹配色板） | — | 不需处理（PASS，var() 可选） |
| 硬编码颜色（UI 组件场景，非规范色值） | ✅ 自动映射 | — |
| 硬编码颜色（图表/多数据场景） | ❌ 跳过（允许保留） | — |
| 硬编码颜色（模糊场景） | ❌ 只报告 | ✅ 用户确认是否修正 |
| 非标准圆角              | ✅ 自动就近映射（见下表） | — |
| 内联 style 值级（颜色/圆角） | ✅ 自动映射        | — |
| 内联 style 结构性污染     | ❌ 只报告位置       | ✅ 步骤三提取为 class |

**非标准圆角就近映射表**（规范值 `0/2/4/8/12/16px` 或 `var(--radius-r1~r5)`，r1=2/r2=4/r3=8/r4=12/r5=16px）：

| 原值                | 映射目标        | 等价变量               |
| ----------------- | ----------- | ------------------ |
| 1px / 3px         | 2px         | `var(--radius-r1)` |
| 5px               | 4px         | `var(--radius-r2)` |
| 6px / 7px         | 8px         | `var(--radius-r3)` |
| 9px / 10px / 11px | 8px         | `var(--radius-r3)` |
| 13px              | 12px        | `var(--radius-r4)` |
| 14px / 15px       | 16px        | `var(--radius-r5)` |
| ≥17px             | 16px（或视觉判断） | `var(--radius-r5)` |

> 圆角就近映射取视觉差异最小的规范值；如设计意图明确需保留原值，可在清洗后手动覆盖并备注。

### 2.4 验证清洗结果

```bash
# 重新检测，style-scan S40 应 PASS，E6 仍会 FAIL（内联 style 未提取）
node scripts/validate-design.mjs /path/to/external-prototype.html
```

### 2.5 结构合规自动纠正（M1-M14 FAIL 时触发）

> **触发条件**：步骤一 §1.3 检测到 M1-M14 中任一 FAIL 项
>
> **工具**：`node scripts/structure-fix.mjs [--basic] <文件>`（自动检测+纠正）
>
> - **路径A/B 标准或半自定义页**：全量纠正（默认模式，含 M5/M6/M10 骨架导航项）
> - **路径C 全自定义页**：加 `--basic` 仅纠正基础必要项，M5/M6/M10 跳过（仅报告），保留用户自定义结构

```bash
# 自动纠正（检测到不合规项自动修复，全量模式）
node scripts/structure-fix.mjs /path/to/external-prototype.html

# 自动纠正（基础必要项模式，路径C 全自定义页）
node scripts/structure-fix.mjs --basic /path/to/external-prototype.html

# 纠正后重检确认
node scripts/structure-fix.mjs --detect /path/to/external-prototype.html
```

**自动纠正范围**：见 §1.3 M1-M14 表「自动纠正」列（M2/M3/M5/M6/M7/M8/M9/M10/M13 自动；`--basic` 模式跳过骨架项 M5/M6/M10 仅报告，M13/M14 工程结构审计不受 `--basic` 影响始终执行；M1 flatten 为生成中间文件、M14 仅报告须模型搬运拆分）。

> **不自动纠正的项**（需手动处理）：
> - M1 SPA→MPA：flatten 后需手动完成步骤四三部分分离 + 步骤五组件匹配
> - M4 文件重命名：需用户确认，避免破坏引用关系
> - M11 SPA 挂载方式：需手动重构为 MPA `switchPage` 跳转
> - M14 页面拆分：页面内容从 index.html 等滞留文件搬运为独立 `pages/D-XXX_*.html`，依 G11 搬运式拆分禁止重写；M13 自动移动 JS 后 M14 会持续 FAIL 直至子页 HTML 建立

***

## 步骤三：结构性清洗（内联 style → class）

> **手动执行**：内联 style 提取需要语义判断，无自动工具。本步骤将 E6 报告的内联 style 逐条提取为语义化 class。

### 3.1 提取流程

对 E6 报告的每条内联 style：

1. **分析语义**：该 style 服务的元素角色（空状态、对齐、间距、强调等）
2. **命名 class**：按语义命名（如 `.empty-state`、`.cell-center`、`.text-secondary`）
3. **提取到 CSS**：将 style 内容移入第1段「页面CSS」的 class 定义
4. **替换 HTML**：`style="..."` → `class="语义名"`
5. **映射变量**：style 中的硬编码值按步骤二规则映射到 design-tokens

### 3.2 常见内联 style 清洗模式

| 内联 style 模式                                    | 语义 class               | CSS 提取                                                                                 |
| ---------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------- |
| `text-align:center;padding:32px;color:#7C8493` | `.empty-state`         | `.empty-state { text-align:center; padding:32px; color:var(--color-text-secondary); }` |
| `text-align:center;padding:40px 0`             | `.cell-center-padded`  | `.cell-center-padded { text-align:center; padding:40px 0; }`                           |
| `color:#141b24`                                | `.text-primary`（已有则复用） | `.text-primary { color:var(--color-text-primary); }`                                   |
| `background:#FFFFFF`                           | `.bg-card`（已有则复用）      | `.bg-card { background:var(--color-bg-card); }`                                        |
| `border-radius:6px`                            | `.radius-md`（按规范值修正）   | `.radius-md { border-radius:var(--radius-r2); }`                                       |

### 3.3 清洗后验证

```bash
# E6 应 PASS（所有内联 style 已提取为 class）
node scripts/validate-design.mjs /path/to/external-prototype.html
```

***

## 步骤四：HTML/CSS/JS 三部分分离（结构检测门：全场景必检，PASS 即过）

> **⚠️ 本步骤任何场景不得跳过**——这是深度判定失误的最后兜底（SPA 误判轻量时在此拦截）。
>
> **检测门逻辑**：`node scripts/structure-fix.mjs --detect <文件>`
>
> * **M1/M11 PASS 且 M12 四部分组织完整** → 输出《结构合规证据》（粘贴 detect 的 M1/M11/M12 三行结果）→ **直接进入步骤五**，无需任何改造（轻量场景通常在此直通）
> * **M1/M11 任一 FAIL（SPA/JS 内嵌 HTML）或 M12 FAIL** → 执行下方搬运式拆分，完成后重跑 detect 至 PASS
>
> **搬运式拆分（§G11）**：拆分是"把源文件已有内容搬进新文件结构"，DOM 与文案逐段从源文件复制，禁止借助规范重写任何业务内容。**形态 B**（旧 SPA `.js`）必须执行拆分；**形态 A**（独立 .html）仅在有内嵌结构问题时拆分。

### 4.1 拆分为四部分

将外部原型的 HTML/CSS/JS 清洗为 MPA 独立页面：HTML 主体清洗后存为 `pages/D-XXX_{页面功能名称}.html`，`<style>` 内联到 `<head>`，JS 提取到 `js/pages/D-XXX_{页面功能名称}.js`，原 `window.__renderPage` 挂载改为 `<script>window.__pageId='路由ID';</script>` 声明：

```html
<!-- pages/D-XXX_{页面功能名称}.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <!--
    ============================================================
    JMBOS UI/UE 设计产物
    ============================================================
    产物编号: D-XXX
    页面名称: {页面功能名称}
    页面类型: 列表页 | 表单页 | 详情页 | 弹窗 | 抽屉 | 其他
    所属模块: {功能模块名称}
    路由ID: {kebab-case路由ID，与 __pageId 一致}
    需求来源: {PRD编号} / {UC编号}
    所属迭代: {YYYYMMDD-迭代名称}
    最后更新: YYYY-MM-DD
    ============================================================
  -->
  <meta charset="UTF-8">
  <title>[页面标题] - JOMOO九牧</title>
  <style>
    /* 从原型 <style> 提取的 CSS，硬编码值已映射为 design-tokens */
  </style>
</head>
<body>
  <script>window.__pageId='路由ID';</script>
  <!-- 从原型 <body> 提取的 DOM 结构，内联 style 已提取为 class -->

  <script src="../js/pages/D-XXX_{页面功能名称}.js"></script>
</body>
</html>
```

```javascript
// js/pages/D-XXX_{页面功能名称}.js
// 从原型 <script> 提取的 JS 逻辑（函数定义 + IIFE 初始化，无需注入 CSS/HTML）
function handleXxx() { /* ... */ }
(function init() { /* ... */ })();
```

### 4.2 四部分分离约束

* ⚠️ 元信息头必填：每个页面 `<head>` 内第一行为 JMBOS 设计产物元信息注释（格式见上，规范见归档技能 design-delivery-template.md §1.1）

* ⚠️ `<style>` 块禁止混入 JS 逻辑

* ⚠️ `<body>` 禁止内联业务 JS（业务 JS 必须独立成 `js/pages/D-XXX_{页面功能名称}.js`）

* ⚠️ `__pageId` 用 kebab-case 路由ID（如 `user-list`），对用户不可见

### 4.3 文件命名与位置

* 命名：`D-XXX_{页面功能名称}.html` + `js/pages/D-XXX_{页面功能名称}.js`（依 G1，文件名用 `D-{序号}_{页面功能名称}` 格式，HTML 与配套 JS 同编号同名；`__pageId` 用 kebab-case 内部ID对用户不可见）

* 位置：`2.UI/pages/D-XXX_{页面功能名称}.html` + `2.UI/js/pages/D-XXX_{页面功能名称}.js`

* 验证：`node scripts/validate-design.mjs 2.UI/pages/D-XXX_{页面功能名称}.html`

***

## 步骤五：规范组件匹配（class 合规检测门：全场景必检，PASS 即过）

> **检测门逻辑**：`node scripts/structure-fix.mjs --detect <文件>` 看 M8
>
> * **M8 PASS（无废弃/非标准类名）** → 输出证据行 → **直接进入步骤六**（轻量场景通常在此直通）
> * **M8 FAIL** → 下方原地替换纠正。仅替换 class 名与必要的结构标签，组件内业务内容（文案/数据/嵌套内容）原样保留，禁止重写组件实现（§G11）
>
> 注：本步骤的纠正动作如需查阅 components/ 规范，仅查 M8 报告中列出的具体组件，禁止全量阅读（§0 铁律4）。

### 5.1 组件匹配流程

1. **查阅规范**：按页面类型查阅 [components/README.md](./components/README.md) 场景必读清单
2. **识别组件**：扫描原型 HTML，识别规范已覆盖的组件（按钮、表格、表单等）
3. **替换 class**：将非标准 class 替换为规范组件 class
4. **提取规范代码**：从 [components/](./components/) 对应规范文件提取标准实现

### 5.2 常见组件匹配

| 原型非标准 class                    | 规范组件  | 规范文件                                                           |
| ------------------------------ | ----- | -------------------------------------------------------------- |
| `.btn-primary` / `.button`     | 按钮    | [components/buttons.md](./components/buttons.md)               |
| `.table` / `.data-grid`        | 表格    | [components/tables.md](./components/tables.md)                 |
| `.form-input` / `.input-field` | 表单输入  | [components/form-inputs.md](./components/form-inputs.md)       |
| `.modal` / `.dialog`           | 弹窗    | [components/modal.md](./components/modal.md)                   |
| `.drawer` / `.slide-panel`     | 抽屉    | [components/drawer.md](./components/drawer.md)                 |
| `.tag` / `.badge`              | 标签    | [components/tags.md](./components/tags.md)                     |
| `.pagination` / `.pager`       | 分页    | [components/Pagination.md](./components/Pagination.md)         |
| `.tabs` / `.tab-bar`           | 页签    | [components/tabs.md](./components/tabs.md)                     |
| `.nav` / `.menu`               | 导航    | [components/navigation.md](./components/navigation.md)         |
| `.card` / `.panel`             | 卡片    | [components/cards.md](./components/cards.md)                   |
| `.query-form` / `.filter-bar`  | 查询栏   | [components/query-bar.md](./components/query-bar.md)           |
| `.action-group` / `.toolbar`   | 操作按钮组 | [components/action-buttons.md](./components/action-buttons.md) |
| `.checkbox` / `.check`         | 复选框   | [components/checkboxes.md](./components/checkboxes.md)         |
| `.icon` / `.svg-icon`          | 图标    | [components/icons.md](./components/icons.md)                   |

### 5.3 匹配原则

* 规范覆盖的部分 → 100% 用规范代码（依 [figma-workflow.md §1.1](./figma-workflow.md)）

* 规范未覆盖的部分 → 保留原型语义，遵守 design-tokens 底线

* 不确定 → 查阅 components/README.md + design-tokens.css

***

## 步骤六：资源内联（资源引用检测门：全场景必检，PASS 即过）

> **检测门逻辑**：`node scripts/structure-fix.mjs --detect <文件>` 看 M7（或 `node scripts/validate-design.mjs <文件>` 看 E1-E4）
>
> * **M7 PASS（common.css/common.js 引用已就位）** → 输出证据行 → **直接进入步骤七**（轻量场景通常在此直通）
> * **M7 FAIL** → 按下方规则补资源引用/内联外链资源。轻量场景禁止改动已正确的资源引用（§0 铁律6）。

### 6.1 资源处理规则

| 资源类型          | 处理方式                                                        |
| ------------- | ----------------------------------------------------------- |
| Logo          | 从 `ASSETS/` 复制规范 Logo（依 common.js）                          |
| SVG Sprite    | 从 `ASSETS/icons-sprite.svg` 复制完整 sprite（依 common.js）        |
| Design Tokens | 从 `ASSETS/design-tokens.css` 引用（依 common.css）               |
| 图片资源          | 下载到 `2.UI/images/` 或内联为 base64（`images/` 按需创建，无图片资源不创建空文件夹） |
| 字体            | 内联或按需存 `js/lib/`（无实际需要不创建）                                  |
| 外链 JS         | 按需下载到 `js/lib/`，禁止 CDN（`js/lib/` 仅在实际需要第三方库时才创建）            |

### 6.1b 图标引入方式转换（重要）

> 外部原型中的图标引入方式通常不符合本系统规范，必须在清洗阶段统一转换。

| 原型中的写法 | 转换为 | 说明 |
|---------|-------|------|
| `<img src="icon.svg">` | `<svg class="icon"><use href="#icon-文件名"></use></svg>` | 文件名即图标名（去掉 .svg 后缀，空格转连字符） |
| `<object data="icon.svg">` | 同上 | 同上 |
| 内联 `<svg><path d="...">` | 同上 | 从 path 中无法获取命名，需根据图标外观查标准库（113个）找到对应名称 |
| 标准库中无对应图标 | ① SVG 文件存入 `2.UI/images/{名称}.svg`（含 AI 生成图标，必须本地有文件）；② 在 Sprite 块中添加 `<symbol id="icon-名称" viewBox="0 0 16 16">`；③ 用 `<use href="#icon-名称">` 引用 | 用户自定义图标允许使用，但命名必须在代码中暴露且本地有对应文件 |

> ⛔ 禁止保留内联 `<path d="...">` 作为图标使用（丢失命名关系，S04 会报错）
> ✅ AI 生成图标也必须存入 `2.UI/images/` 目录，禁止仅内联 path 数据而无本地文件

### 6.2 MPA 架构资源（由 common.css/common.js 提供）

MPA 页面不需要内联以下资源（由 common.css/common.js 统一提供）：

* Design Tokens CSS 变量 → `css/common.css`

* SVG Sprite → `js/common.js`

* Logo → `js/common.js`

* 预览缩放脚本 → `js/common.js`

只需确保 `2.UI/` 目录下有从 `ASSETS/` 复制的 `css/common.css` 和 `js/common.js`。

> ⚠️ **G6.1 复制铁律**：必须用 `cp` 命令直接复制，**禁止用 Read 读取后用 Write 重写**：
> ```bash
> cp ASSETS/page-shells/css/common.css 2.UI/css/common.css
> cp ASSETS/page-shells/js/common.js  2.UI/js/common.js
> ```
> `common.js` 约 186KB（86%为内嵌 SVG Sprite），Read+Write 必然丢失内容或超限。清洗场景下若 `common.css`/`common.js` 已存在于交付目录且 M7 检测 PASS，禁止重复复制或改动（§0 铁律6）。

***

## 步骤七：校验

### 7.1 全量校验

```bash
# 1. 结构合规检测（M1-M14）
node scripts/structure-fix.mjs --detect 2.UI/pages/D-XXX_{页面功能名称}.html

# 2. 设计令牌合规性校验（E1-E6）
node scripts/validate-design.mjs 2.UI/pages/D-XXX_{页面功能名称}.html

# 3. 布局骨架检测（L1-L12）
node scripts/layout-scan.mjs 2.UI/pages/D-XXX_{页面功能名称}.html
```

### 7.2 校验通过标准

| 检测项          | 通过标准                           |
| ------------ | ------------------------------ |
| structure-fix M1-M14 | ✅ PASS（结构已纠正完成，详见 §1.3） |
| style-scan S40 硬编码颜色     | PASS/SKIP（UI 色值已修正或匹配色板；图表场景 SKIP 允许） |
| style-scan S39 非标准圆角     | PASS（圆角值为规范值或变量）             |
| style-scan S69 JS 模板字符串 | PASS（HTML 结构已提取为独立文件） |
| E6 内联 style | ✅ PASS（所有内联 style 已提取为 class）  |
| L1-L12 布局骨架  | ✅ PASS（骨架结构与 page-shells 模板一致） |

### 7.3 清洗失败处理

* structure-fix M1-M14 FAIL → 重跑步骤二 §2.5 `structure-fix.mjs`

* style-scan S40 FAIL → 重跑步骤二 `quick-fix.mjs pollution`

* E6 FAIL → 重跑步骤三提取内联 style

* 三部分分离未通过 → 重跑步骤四 HTML/CSS/JS 三部分分离

* L1-L12 FAIL → 从 `ASSETS/page-shells/pages/` 对应模板**仅复制骨架容器段**：用 Grep 提取 `#header` / `.main-wrapper` / `.main-content` / `.page-card` 片段（禁止整文件阅读，单模板45KB+）。**轻量改造通常不适用本项**——骨架已存在于待清洗文件中，FAIL 多为容器缺失，按 M5/M6/M10 注入即可

***

## 附录 A：完整清洗示例

> 以下示例均为**深度改造**；轻量改造七步全走，步骤四五六检测门直通（PASS 即过），实际改造动作仅 步骤一→二→三→七（在**原文件内**完成同类替换，不新建文件）。两场景均遵守 §0 内容搬运铁律。
> 四部分完整模板见 §4.1，示例中省略。

### A.1 形态 A：独立 .html 清洗

**输入**（external.html）：

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .container { background: #FFFFFF; border-radius: 6px; }
    .title { color: #141b24; font-size: 14px; }
    .empty { text-align:center; padding:32px; color:#7C8493; }
  </style>
</head>
<body>
  <div class="container">
    <h2 class="title">用户列表</h2>
    <div class="empty" style="text-align:center;padding:32px;color:#7C8493;">暂无数据</div>
  </div>
</body>
</html>
```

**步骤二（颜色映射）**：`#FFFFFF`→`var(--color-bg-card)`、`#141b24`→`var(--color-text-primary)`、`#7C8493`→`var(--color-text-secondary)`。

**步骤三（内联 style 提取）**：`.empty` 的内联 style 与 class 定义重复，直接删除内联属性（§3.2 模式1）。

**最终输出**（步骤四四部分分离后，`pages/D-001_用户列表.html` + `js/pages/D-001_用户列表.js`）：

```html
<!-- pages/D-001_用户列表.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <!-- 元信息头（完整格式同 §4.1）：D-001/用户列表/列表页/用户管理/user-list -->
  <meta charset="UTF-8">
  <title>用户列表 - JOMOO九牧</title>
  <style>
    .container { background: var(--color-bg-card); border-radius: var(--radius-r2); }
    .title { color: var(--color-text-primary); font-size: 14px; }
    .empty { text-align:center; padding:32px; color:var(--color-text-secondary); }
  </style>
</head>
<body>
  <script>window.__pageId='user-list';</script>
  <div class="container">
    <h2 class="title">用户列表</h2>
    <div class="empty">暂无数据</div>
  </div>
  <script src="../js/pages/D-001_用户列表.js"></script>
</body>
</html>
```

### A.2 形态 B：已转 .js 清洗（纠正为 MPA）

**输入**（external-page.js，旧 SPA 单文件带污染，CSS/HTML 以字符串形式内嵌）：

```javascript
(function() {
  var css = `
    <style>
      .card { background: #FFFFFF; border-radius: 1px; }
      .label { color: #7C8493; }
    </style>
  `;
  var html = `
    <div class="card" style="padding:20px;">
      <span class="label" style="color:#141b24;">标签</span>
    </div>
  `;
  // ... 挂载到目标容器（旧 SPA 注入式）
})();
```

**步骤二自动清洗**：颜色映射（`#FFFFFF`→`var(--color-bg-card)`，`#7C8493`→`var(--color-text-secondary)`，`#141b24`→`var(--color-text-primary)`），圆角报告不动。

**步骤三手动清洗**：提取 `style="padding:20px;"` → `.card-padding { padding:20px; }`，圆角 `1px` → `var(--radius-r1)`（2px）。

**最终输出**（纠正为 MPA 独立页面 标签卡片.html + js/pages/标签卡片.js）：

```html
<!-- pages/标签卡片.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>标签卡片 - JOMOO九牧</title>
  <style>
    .card { background: var(--color-bg-card); border-radius: var(--radius-r1); }
    .card-padding { padding: 20px; }
    .label { color: var(--color-text-secondary); }
    .label-primary { color: var(--color-text-primary); }
  </style>
</head>
<body>
  <script>window.__pageId='tag-card';</script>
  <div class="card card-padding">
    <span class="label label-primary">标签</span>
  </div>
  <script src="../js/pages/标签卡片.js"></script>
</body>
</html>
```

***

## 附录 B：清洗检查清单

> **按深度裁剪**：深度改造 → 全部 11 项；轻量改造（§0.1 三条资格全过）→ 仅勾选 ①S40 ②S39 ③S69 ⑤E6 ⑩M1-M14 共 5 项 + 检测门证据（步骤四五六的 M1/M11/M12、M8、M7 PASS 行）+ 铁律自查（§0）。检测门证据缺失视为未走流程。
> **各项通过标准**见步骤七 §7.2 表，此处仅列勾选项。

转换完成后逐项确认：

* [ ] ①S40 硬编码颜色　* [ ] ②S39 非标准圆角　* [ ] ③S69 JS模板字符串　* [ ] ④三部分分离　* [ ] ⑤E6 内联style
* [ ] ⑥L1-L12 布局骨架　* [ ] ⑦资源内联　* [ ] ⑧规范组件匹配　* [ ] ⑨design-tokens 引用　* [ ] ⑩M1-M14 结构合规　* [ ] ⑪检测门证据（四五六 PASS 行）

***

## 附录 C：相关文档

[SKILL.md](../SKILL.md)（索引入口/全局规则）｜ [figma-workflow.md](./figma-workflow.md)（Figma 还原）｜ [style-fix-cheatsheet.md](./style-fix-cheatsheet.md)（S40/S39 修复手册）｜ [page-types.md](./page-types.md)（页面类型）｜ [components/README.md](./components/README.md)（组件索引）｜ [ASSETS/design-tokens.css](../ASSETS/design-tokens.css)（令牌来源）｜ [ASSETS/page-shells/pages/list.html](../ASSETS/page-shells/pages/list.html) + [list.js](../ASSETS/page-shells/js/pages/list.js)（MPA 模板）

> **M1-M14 完整纠正规则**：由 `scripts/structure-fix.mjs` 自动执行（脚本 header 注释含全部检测项定义与纠正方式），本文件 §1.3 为速查表，§2.5 为纠正执行流程。

