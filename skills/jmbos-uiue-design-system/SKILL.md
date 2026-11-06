---
name: jmbos-uiue-design-system
description: "JMBOS UI/UE企业级设计系统，用于B端后台页面设计与HTML实现。触发：UIUE/JMBOS/Figma URL/按设计稿/页面生成/样式修改/外部原型导入/原型清洗，或任何UIUE任务（含首次生成与后续修改）。"
skill-version: V1.0.4
---

license: MIT
compatibility:
  - requires: [REFERENCES/components/README.md, REFERENCES/page-layout.md, ASSETS/design-tokens.css]

# JMBOS UI/UE 设计系统

> **使用说明**：8 步工作流（输入→设计→实现→自检→交付），样式值一律基于 `design-tokens.css`。首次生成及后续每次修改均须重新触发本技能，绕过本技能直接改代码会导致版本失控和规范偏离。
>
> **运行环境**：自检脚本基于 Node.js（跨平台 macOS/Windows），版本要求 **v22.13.0 及以上**，调用方式统一为 `node scripts/<脚本名>.mjs`。
>
> **编号体系**：G1-G11 = 全局强制规则（§二）；QG1-QG8 = 工作流阶段关卡（§4.1）。两套编号独立，互不指代。

---

## 一、文档索引

### 1.1 必读文档（每次实现前完整阅读）

| 文件 | 用途 |
| --- | --- |
| [components/README.md](REFERENCES/components/README.md) | 核心组件索引 + 场景化查阅指南 |
| [page-layout.md](REFERENCES/page-layout.md) | 标准布局+防错+模板+QA |
| [page-types.md](REFERENCES/page-types.md) | 列表/详情/表单/弹窗四种页面类型 |
| [page-interactions.md](REFERENCES/page-interactions.md) | 必备交互+switchPage错误处理 |
| [design-tokens.css](ASSETS/design-tokens.css) | 设计变量值（颜色/间距/字号） |

### 1.2 按需查阅

| 文件 | 何时读 |
| --- | --- |
| [figma-workflow.md](REFERENCES/figma-workflow.md) | Figma URL / 关键词触发 |
| [external-html-workflow.md](REFERENCES/external-html-workflow.md) | 原型导入/转换 + 已有产物清洗/规范化（§0 硬信号判定深度：深度7步搬运式改造 或 轻量 一→二→三→七，原地搬运禁止重建）｜结构合规纠正（§1.0c 触发，M1-M14 映射） |
| [requirement-extraction.md](REFERENCES/requirement-extraction.md) | 需求文档/PRD 输入（§3需求分析+§7.5覆盖校验） |
| [implementation-paths.md](REFERENCES/implementation-paths.md) | §6.1 选定路径后 |
| [parallel-workflow.md](REFERENCES/parallel-workflow.md) | §6.8 并行协调时（填充/改造双模式分工+模板） |
| [nav-menu-full-code.md](REFERENCES/nav-menu-full-code.md) | 实现导航时 |
| [implementation-guide.md](REFERENCES/implementation-guide.md) | §7 自检时 |
| [style-fix-cheatsheet.md](REFERENCES/style-fix-cheatsheet.md) | §7 扫描出问题/修复FAIL时（含脚本导航） |
| [icons/README.md](ASSETS/icons/README.md) | 使用图标时 |
| [ASSETS/README.md](ASSETS/README.md) | 识别组件时 |
| [ASSETS/page-shells/](ASSETS/page-shells/) | 选模板时（pages/*.html 页面模板 + js/pages/*.js 配套JS） |

### 1.3 关键数值速查

| 项目 | 数值 | 项目 | 数值 |
| --- | --- | --- | --- |
| 画布尺寸 | 1280×720 | 间距/圆角单位 | 8px / 4px |
| 主色 | #3685F2 | 正文/标题字号 | 13px / 16px |
| 顶导高度/侧边宽度 | 42px / 180px | 预览缩放 | 基准1280px，上限120%（1536px封顶） |

> 原型预览自适应由 `common.js` 内置 zoom 逻辑实现，不影响设计数值；全屏组件用 `calc(100vw / var(--zoom-value))` 抵消放大。已有页面优化时强制检查缩放规则（§6.1）。

---

## 二、全局规则（G1-G11）

### 2.1 工程结构（G1-G3）

#### G1 MPA 结构

每页独立 HTML：`index.html`（入口）+ `pages/D-XXX_{页面功能名称}.html`（业务页），配套 JS → `js/pages/D-XXX_{页面功能名称}.js`，公共资源 `css/common.css` + `js/common.js`。验证针对各 `.html` 与 `js/pages/*.js`。弹窗/抽屉为嵌入式组件，提取 HTML/CSS 片段嵌入父页面；其余页面均为独立 `.html`。

> **index.html 一律为重定向壳**（单页面/多页面统一，不因页面数少而合并）：
> - **内容形态**：元信息头（编号 INDEX）+ `common.css`/`common.js` 引用 + `<script>location.replace('pages/{默认首页}.html')</script>`，**禁止搭载任何业务 DOM/样式/交互**（无 `__pageId`/导航壳挂载点/骨架/页面内容，structure-fix 对壳页自动豁免 M3/M5/M6/M9/M10/M12）
> - **默认首页**：菜单第一项对应的 `pages/D-XXX_*.html`；`js/common.js` 的 `pageRoute` 中所有页面 file 均指向 `pages/` 下的 HTML
> - **禁止**把业务页面内容直接堆在 index.html（M14 拦截）；**禁止**用 index.html 复制一份业务页内容充当首页

**G1.1 页面文件四部分组织**（强制）：

0. **元信息头（必填）** — `<head>` 第一行为 JMBOS 产物元信息注释（产物编号 D-{序号}/页面名称/页面类型/所属模块/路由ID/需求来源/所属迭代/最后更新），格式见归档技能 [design-delivery-template.md](../jmbos-uiue-design-archive/references/design-delivery-template.md) §1.1
1. **页面CSS** — 内联于 `<head>` 的 `<style>` 块（专用样式，开发可直接复制）
2. **页面HTML** — `<body>` 完整 DOM（含 `#header`/`#sidebar` 挂载点 + `.main-wrapper` 内容区）
3. **配套JS引用** — `<script>window.__pageId='内部路由ID';</script>` + `common.js` + 配套页面JS（首页用 `css/` 与 `js/`，子页用 `../css/` 与 `../js/`）。命名规则见 §8

> ⚠️ 禁止 `<style>` 块混入 JS 逻辑；禁止 `<body>` 内联业务 JS（必须独立成 `js/pages/D-XXX_{页面功能名称}.js` 引用）

**G1.2 页面配套JS**：函数定义（`function handleXxx() {...}`）+ IIFE 初始化（`(function initXxx(){...})()`）。无需注入 CSS/HTML（已在 HTML 文件中），仅负责交互逻辑绑定与初始化。示例 `ASSETS/page-shells/js/pages/list.js`

#### G2 版本备份

重大修改前备份到 `2.UI/tmp/{原名}_v{n}.{ext}`（保留原扩展名 `.html`/`.js`）；轻微修改/全新创建无需备份；未备份禁止编码；全部默认保存本地，不依赖 git 仓库。

**G2.1 内容丢失自动升级**：任何修改（含轻微/删除意图）执行前，预期内容减少 >15%（行数或字符数任一）→ 自动升级重大修改，按 G2 打编号备份。此规则优先于 §1.1 风险分级。

**G2.2 自动保存**：修改写入文件前，必须先覆盖式复制到 `2.UI/tmp/.autosave/{原名}.{ext}`（与 G2 正式备份区分）。回滚从自动保存恢复。

#### G3 JS 存储

所有 JS 存本地文件夹，禁止 CDN/外链。配套 JS → `js/pages/D-XXX_{页面功能名称}.js`，通用脚本 → `js/`，外部资源 → `js/lib/`（仅当实际涉及第三方库时才创建）。

### 2.2 质量保证（G4-G6）

#### G4 规范读取证明

格式：`组件名 / 规范文件 / 行数(须wc -l验证) / 关键数值1 / 关键数值2 / 关键数值3 / [OK]`

> 硬约束：①**关键数值必须是具体值**（如"顶导42px""侧边180px""卡片无阴影无边框"），禁止泛泛要点 ②**须完整读取**（`wc -l` 验证行数，禁止只读片段）③**禁止凭记忆**，每次任务重新读取 ④**空项禁止继续**，任一关键数值为空禁止进入下一步
>
> 例外：「已有产物清洗」按 §3.6 清洗豁免最小化读取，免本证明（清洗不引入新组件）。

#### G5 菜单归属

每页归属唯一一级模块；侧边栏仅展示当前模块菜单；顶部 active=一级模块，侧边 active=当前页。

#### G6 脚本优先

样式偏差类问题（颜色/圆角/间距）检测不符 → 自动触发脚本修复并重检（映射见 §7.0），仅无脚本的项才查 [style-fix-cheatsheet.md](REFERENCES/style-fix-cheatsheet.md) S编号条目手动改。资源类问题（Token/Sprite/Logo/缩放）由 `common.css`/`common.js` 统一提供，搭建环境时从 ASSETS 复制。

> **G6.1 公共资源文件复制铁律**：`common.css`/`common.js`/`icons-sprite.svg` 等公共资源文件**必须用 `cp` 命令直接复制**（如 `cp ASSETS/page-shells/js/common.js js/common.js`），**禁止用 Read 读取后用 Write 重写**。原因：`common.js` 约 186KB，86%为内嵌 SVG Sprite，Read+Write 重写必然丢失内容或超出读取限制。仅复制后需修改菜单配置（`menuItems`/`sidebarConfig`/`pageRoute`，文件开头 1~118 行）时，才用局部读取 + Edit 局部替换。

### 2.3 输入处理（G7-G8）

#### G7 需求完整性

需求文档/PRD/文字描述输入 → 按 [requirement-extraction.md](REFERENCES/requirement-extraction.md) 五维度(F/D/I/S/E)提取并产出《需求完整清单》，自检阶段执行覆盖校验(§7.5)。Figma 输入走 figma-workflow.md 不受此约束。

#### G8 系统级页签

中后台系统默认实现系统级页签（已打开页面以页签展示在 `.page-card` 上方，`common.js` 统一管理 `addTab`/`closeTab`/`renderTabs`）。不实现仅限：①前台/大屏类系统 ②用户明确要求不要页签。页签规范见 [tabs.md 样式二](REFERENCES/components/tabs.md)。

### 2.4 防跳步（G9-G10）

#### G9 流程进度追踪

工作流启动（§1 后）创建追踪表，每步完成后更新。输出至 `2.UI/` 前确认所有应执行步骤 ☑。状态：☐未执行｜☑已完成｜⏭已跳过(注明原因)｜🚫禁用。

```
《流程进度追踪表》— {任务名称}
场景路由：{类型}｜应执行：{如 1→3→4→5→6→7→8}｜跳过：{如 2}
| 步骤 | 任务（子步骤） | 状态 | 产出物 |
|------|--------------|------|--------|
| §1 | 输入解析（1.0/1.0b/1.0c/1.1） | ☐/☑/⏭ | 风险等级+追踪表 |
| §2 | 历史判断与备份 | ☐/☑/⏭ | 备份路径/跳过原因 |
| §3 | 需求分析（3.1-3.8） | ☐/☑/⏭ | 需求完整清单 |
| §4 | 设计策略 | ☐/☑ | 策略说明 |
| §5 | 方案确认（核心关卡） | ☐/☑ | 用户确认记录 |
| §6 | 实现输出（6.0-6.8） | ☐/☑ | HTML/JS文件 |
| §7 | 自检与矫正（7.0-7.6） | ☐/☑ | 自检完成证明 |
| §8 | 完成输出 | ☐/☑ | 产出物清单 |
```

> 与 QG1-QG8 关卡的对应关系见 §4.1。

#### G10 步骤完成证明

每个关键步骤（§1-§8）完成后强制输出，未输出禁止进入下一步；跳过步骤也须输出（⏭+原因）。§5 核心关卡不可跳过。

```
### ✅ 步骤{N}完成证明
- 产出：{产出物/路径，或"无（跳过）"}｜关卡 QG{X}：PASS / ⏭跳过（原因）｜追踪表 §{N} → ☑
- 执行方式：{cp 命令复制 / Edit 局部修改 / Write 新建文件}（§6 涉及公共资源文件时必填）
```

> **G10.1 复制优先检查**：§6 完成证明须注明 `common.css`/`common.js` 获取方式，`Read+Write 重写`即为 FAIL（G6.1）。

### 2.5 执行策略（G11）

#### G11 基底优先（最高优先级）

凡输入存在可用文件（历史产物/外部原型/上一版产出），一律以原文件为基底**就地改造**，「重新生成」路径废除。

- **内容搬运**：DOM 结构与业务文案必须与输入文件一一对应，从源文件搬运，禁止凭记忆或规范从零重写
- **改造动作白名单**：值替换（硬编码→变量）、class 替换、内联 style/JS 提取、结构合规纠正（M1-M14）、文件拆分（单文件搬运式拆为 MPA 多文件）、资源引用修正
- **SPA 拆分澄清**：JS 内嵌 HTML（M1/M11/S69 FAIL）**必须** flatten + 三部分分离——属「文件拆分」搬运式改造，禁止以 G11 为由跳过拆分保留 SPA 形态
- **禁止**：删除旧文件后重写同内容页面｜另起新文件重造｜按"全新页面"流程重做已有内容
- **"换方案/重新做"归属**：用户明确放弃现有布局方案时按「全新创建」处理（旧文件按 G2 备份后新建）
- **违反判定**：§7.6 内容完整性校验发现输出与输入 DOM/文案无对应关系即为重写，按内容丢失处理（从自动保存恢复）

---

## 三、场景路由

> "跳过"列仅指主流程可跳，"补偿检查点"仍须执行；跳过步骤须在 G9 标注 ⏭+原因。

| 场景 | 入口 | 跳过 | 补偿检查点（仍须执行） |
| --- | --- | --- | --- |
| 轻微样式调整（≤3处） | §1.1快速通道 → §5简化确认 → §6 → §7 | 2,3,4 | §3.6规范预读取｜§5简化确认（仍须AskUserQuestion）｜§6.1强制检查缩放规则 |
| 全新页面 | §1 → §3 → §4 → §5 → §6 → §7 → §8 | 2 | — |
| 重大修改/深度改造 | 完整 §1~§8（先备份），产出方式依 G11 就地改造 | — | 多文件改造满足 §6.8 模式B 三前提时可行页面级并行（试点先行）；公共文件与深度拆分保持串行 |
| Figma URL / 关键词触发 | §1.0 强制触发 → §1 → §3(figma-workflow替代) → §5 → §6 → §7 → §8 | 2 | §3 由 figma-workflow 步骤二~三替代，须输出《组件识别表》+《规范映射表》 |
| 外部原型导入/转换 + **已有产物清洗** | §1.0b 强制触发 → §3.6 最小化预读取 → [external-html-workflow.md](REFERENCES/external-html-workflow.md) §0.1 硬信号判定深度 → §7 → §8 | 2,3,4,5,6 | 深度判定禁止主观（SPA外观与普通页无异）｜步骤四五六检测门任何场景必做并输出PASS证据｜原文件原地修改（G11，深度拆分除外）｜§5 由 external 步骤五+七替代 |
| 并行生成 | §1 → §3 → §4 → §5 → §6.1~6.4 → §6.8 → §7 → §8 | 2 | — |
| 新迭代基于历史修改 | §1.0c 结构合规纠正 → 先触发归档技能拉取历史 → `--update`模式进入 §1~§8 | — | §1.0c：读取历史文件时自动执行 `structure-fix.mjs --detect`，纠正至全 PASS 后进入工作流 |

> ⚠️ §5 核心关卡不可跳过；轻微样式调整也须简化版确认（修改范围+影响评估+受影响组件清单）。

---

## 四、工作流（8步）

> 严格按顺序执行，禁止跳步。防跳步三重保障：G9 追踪表 + G10 完成证明 + QG1-QG8 关卡。样式值一律基于 `design-tokens.css`。

### 4.1 工作流阶段总览

| 阶段 | 步骤 | 主要任务 | 关卡（进入下一阶段前须 PASS） |
| --- | --- | --- | --- |
| A 准备 | 1-2 | 输入解析/Figma触发/意图识别/历史备份 | **QG1** 意图+风险分级+场景路由已判定+追踪表已建 → **QG2** 备份已执行或判定无需（重大三项✅/轻微两项✅/全新两项✅） |
| B 设计 | 3-5 | 需求分析/设计策略/方案确认（核心关卡） | **QG3** 需求清单+规范读取证明+页面类型+菜单归属矩阵已产出 → **QG4** 设计策略已确定 → **QG5** 方案确认已通过（AskUserQuestion，核心关卡不可跳过） |
| C 实现 | 6 | 路径选择/组件查阅/页面结构/交互/并行协调 | **QG6** HTML+JS已产出+交互清单已产出+validate-design.mjs 初检全PASS |
| D 交付 | 7-8 | 六道门禁自检/完成输出/更新索引 | **QG7** 六道门禁全PASS+自检完成证明 → **QG8** 追踪表全☑+交付物完整+索引已更新 |

> ⚠️ 关卡不通过禁止进入下一阶段。每步 PASS 后按 G10 输出证明并更新 G9 追踪表。

### 阶段A：输入与准备（步骤 1-2）

#### 1. 输入解析

> **强制触发**：首次生成及后续每次修改必须重新触发本技能。完成后按 G9 创建追踪表（确定场景路由+应执行/跳过步骤）。

**支持输入**：Figma URL / 需求名称 / 文件路径 / 粘贴文本 / `--update`增量模式
**路径**：需求 `01.项目迭代工作区/{迭代}/1.产品/需求/{名称}.md`｜输出 `2.UI/`｜草稿 `2.UI/tmp/`
**增量模式**：读取历史 → 变更分析 → 跳过步骤2-3 → 进入步骤4。历史来源：迭代区→直接读取；知识图谱→先触发归档技能反向拉取；均无→全新创建。

##### 1.0 Figma 强制触发（最高优先级）

> 输入含"按设计稿/按Figma/还原设计稿"等关键词或粘贴 Figma URL 时**强制**通过 MCP 获取数据。首次生成和后续修改均适用。

流程：①有URL→解析fileKey+nodeId；无URL→先查Figma链接索引（[figma-workflow.md §1.7](REFERENCES/figma-workflow.md)），无记录则停止向用户索取 → ②`get_figma_data`获取节点树 → ③`download_figma_images`下载截图+资源 → ④更新链接索引 → ⑤进入[figma-workflow.md](REFERENCES/figma-workflow.md) 7步还原

**禁止**：跳过MCP仅凭文字描述生成｜跳过截图下载｜未提供URL且索引无记录时自行假设｜单独创建 `figma-links.md`。**还原原则**：规范覆盖部分严格按规范，未覆盖部分100%还原Figma设计稿。

##### 1.0b 不符合规范自动纠正（通用机制 — 值层）

> 任何阶段检测到不符合 JMBOS 规范（含用户提出）→ 立即自动纠正并重检至全 PASS，禁止只报告不修复。

闭环：`node scripts/validate-design.mjs <文件>` 检测 → `node scripts/quick-fix.mjs ...` 自动修复（映射见 §7.0）→ 重检循环至全 PASS。详见 [external-html-workflow.md](REFERENCES/external-html-workflow.md)。
外部原型导入/已有产物清洗（"外部原型/导入/转换/清洗/整理/规范化"关键词或提供 `.html`/`.js` 文件）→ 额外按 §3.6 最小化预读取 → 走 external §0 硬信号判定深度的清洗流程（深度7步或轻量）。
**禁止**：跳过检测直接交付｜保留硬编码颜色或内联 `style="..."`｜只报告不修复｜直接翻译绝对定位为 `position: absolute`（用 flex/grid 语义化）

##### 1.0c 结构合规自动纠正（通用机制 — 结构层，任何原型）

> 原型（历史产物/外部导入/新产出）结构不符合当前规范 → 自动检测并纠正，用户无需感知。触发：读取历史原型｜导入外部原型｜指定目录批量扫描｜§1 增量模式读取历史。

**分级纠正规约**（按 §3.7 页面类型判定，避免对自定义页过度纠正）：

| 级别 | 检测项 | 适用范围 |
| --- | --- | --- |
| 基础必要项（所有页面强制） | M1 SPA→MPA / M2 元信息头 / M3 `__pageId` / M4 文件命名 / M7 common引用 / M8 废弃类名 / M9 内联JS / M12 四部分组织 | 路径A/B/C 全部强制 |
| 骨架导航项（标准结构约束） | M5 导航壳挂载点 / M6 布局骨架 / M10 `.page-card` 容器 | 路径A 标准页强制；路径B 半自定义按骨架匹配部分适用；**路径C 全自定义跳过**（仅报告，保留用户自定义结构） |
| 仅报告项 | M11 SPA注入式挂载 | 所有路径均不自动纠正，须手动重构 |
| 工程结构项（文件树布局审计） | M13 配套JS存放位置（G3）/ M14 命名子页未独立成子页HTML（G1） | 目录级审计始终执行，不受 `--basic` 影响；M13 自动移动+修正引用，M14 仅报告须搬运拆分 |

闭环：`node scripts/structure-fix.mjs --detect <文件>` → 按分级执行 `node scripts/structure-fix.mjs <文件>`（路径C 加 `--basic` 仅纠正基础必要项）→ 四道校验（structure-fix --detect + validate-design.mjs + layout-scan.mjs + style-scan.mjs）全 PASS（路径C 跳过 layout-scan）→ 进入正常工作流。纠正属重大修改，按 G2 先备份。M1-M14 检测项与纠正映射详见 [external-html-workflow.md](REFERENCES/external-html-workflow.md) §1.3。

##### 1.1 意图识别

| 意图 | 判定信号 | 执行策略 |
| --- | --- | --- |
| **原地改造（默认）** | 存在历史文件/原型，信号："改""调整""优化""修复""清洗""整理""规范化""按规范梳理""结构改造""合规整改""导入""转换" | 依 G11 以原文件为基底就地修改，内容搬运禁止重写；清洗/规范化/导入/转换统一走 §三「外部原型导入/已有产物清洗」路由，深度由 external §0.1 脚本硬信号判定（禁止按措辞/来源判定） |
| 全新创建 | 无历史文件 / "新建""新增"，或用户明确放弃现有布局方案（"换方案""重新做"） | 旧文件按 G2 备份后生成新文件 |

> ⚠️ **「重新生成」路径已废除（G11 基底优先）**：凡有基底文件一律结构改造。"换方案/重新做"按「全新创建」处理（先备份旧文件）。

**风险分级**：轻微（文案/单值微调≤3处）→ ❌备份，走快速通道跳过§2和§6.0；重大（结构调整/多组件替换/交互变更）→ ✅备份。

> **QG1**：意图+风险分级+场景路由已判定，G9 追踪表已创建。

#### 2. 历史判断与备份

依据 §1.1 风险分级判定：重大修改 → 按 G2 执行备份；轻微修改/新增 → 跳过。未备份禁止进入步骤3。

> **QG2**：备份已执行或判定无需（重大三项✅/轻微两项✅/全新两项✅）。

### 阶段B：需求与设计（步骤 3-5）

#### 3. 需求分析

> Figma 输入走 [figma-workflow.md](REFERENCES/figma-workflow.md)，本节仅适用需求文档/文字描述/PRD 输入。详见 [requirement-extraction.md](REFERENCES/requirement-extraction.md)。

**3.1-3.2 五维度提取 + 需求完整清单**

| 维度 | 提取内容 | 防遗漏下限 |
| --- | --- | --- |
| F 功能 | 业务功能点（CRUD/批量/定时/权限） | 列表≥3/详情≥1/表单≥1/弹窗≥1 |
| D 字段 | 表单字段+表格列+详情字段（含类型/必填/校验/选项源） | 列表列≥4/详情≥5/表单≥4/弹窗≥2 |
| I 交互 | 标准(IX1-12)+自定义(跳转/弹窗/联动/拖拽) | 列表≥5/详情≥2/表单≥1/弹窗≥1 |
| S 状态 | 数据状态+页面状态(空/加载/错误)+按钮/表单状态 | 列表≥2/详情≥1/表单≥1/弹窗≥1 |
| E 异常 | 校验失败/接口异常/权限不足/数据冲突 | 列表≥2/详情≥1/表单≥3/弹窗≥2 |

> 任一维度为空须在《疑点清单》说明，禁止默认"无"。按五维度逐条产出《需求完整清单》，未产出禁止进入步骤4。

**3.3-3.5 疑点清单 + 页面范围 + 跨页面交互**
疑点（需求模糊/缺失/矛盾/超出规范）→ 向用户确认｜页面范围清单确认页面归属和边界｜存在跨页面交互时必执行 → 输出《交互矩阵》（触发页/动作/目标页/类型/参数传递）

**3.6 规范预读取（未完成禁止进入步骤4）**

按页面类型查阅 [components/README.md](REFERENCES/components/README.md) 场景必读清单（列表≥7/详情≥5/表单≥6/弹窗≥6），逐个提取3-5要点 → 全量扫描补漏（14组件速查表+[ASSETS/README.md](ASSETS/README.md) 48组件清单）→ 按 G4 输出《规范读取证明》。

> **清洗场景豁免（唯一权威定义，后续 §6.2/§6.5 均以本条为准）**：「外部原型导入/已有产物清洗」路由降级为仅读取 [external-html-workflow.md §2.2](REFERENCES/external-html-workflow.md) 污染映射表（颜色/圆角）+ §1.3 M1-M14 表，**免 components 全量阅读、页面模板阅读与 G4 证明**（清洗不引入新组件）。该读取**一次完成后全局复用**，禁止逐页重复读取。

**3.7-3.8 页面类型判定 + 菜单归属**

| 类型 | 判定依据 | 路径 |
| --- | --- | --- |
| 标准页面 | 骨架匹配+组件全覆盖 | A |
| 半自定义 | 骨架匹配+有自定义模块 | B（A+C） |
| 全自定义 | 骨架不匹配 | C |

菜单归属矩阵（依 G5）：页面/一级模块/二级菜单组/三级菜单。

> **QG3**：需求完整清单+疑点清单+规范读取证明+页面类型判定+菜单归属矩阵均已产出。

#### 4. 设计策略

| 层级 | 生成方式 | 规范依据 |
| --- | --- | --- |
| 页面骨架 | 严格遵循标准骨架 | page-layout.md |
| 标准模块 | 严格基于组件规范 | components/README.md |
| 自定义模块 | 仅遵守Design Token | design-tokens.css |

**代码复制原则**：标准区域从规范源件逐行复制，禁止凭记忆编码。

> **QG4**：页面骨架策略+各模块生成方式已确定。

#### 5. 方案确认（核心关卡 — 工作流唯一用户确认关卡，任何场景不可跳过，未通过禁止进入步骤6）

**确认项**：需求完整清单 / 页面类型判定 / 整体布局 / 所有组件及变体 / 规范未覆盖项 / 模糊矛盾取舍
**强制产出**：《需求完整清单》呈现确认 + 《组件完整清单》（#/组件名/位置/变体/规范来源/状态☐→☑）

**5.1 确认操作（强制执行）**：①**呈现**：强制产出清单+页面类型判定+整体布局概述+规范未覆盖项处理方案+疑点取舍说明，整合向用户完整呈现 → ②**确认**：使用 `AskUserQuestion` 发起确认 → ③**响应处理**：通过→进入步骤6；提出修改→回退§3/4修订后重新确认；部分确认→就未确认项继续沟通直至全部☑

> **QG5（核心关卡，不可跳过）**：AskUserQuestion 已发起 + 所有确认项☑ + 《组件完整清单》状态☑。轻微样式调整也须简化版确认（修改范围+影响评估）。

### 阶段C：实现输出（步骤 6）

#### 6. 实现输出

> 前置：步骤5.1确认操作已通过（所有确认项☑）。发现遗漏→暂停→回退步骤5补确认。

**6.0-6.1 版本门禁 + 路径选择**
- 6.0 版本安全门禁：按 G2 执行（重大三项✅/轻微两项✅/全新两项✅）
- 6.1 选择路径 & 搭建环境：依据 §3.7 选择路径A/B/C，详见 [implementation-paths.md](REFERENCES/implementation-paths.md)。**已有页面优化强制检查缩放规则**：`grep -c "applyResponsiveZoom" js/common.js`（输出 ≥1 即 PASS），缺失则按路径A补全

> ⚠️ **common.js 阅读禁令 + 复制铁律（G6.1）**：复制用 `cp`，检测用 `grep`，改配置（`menuItems`/`sidebarConfig`/`pageRoute`，1~118行）用局部读取+Edit。禁止全量阅读（186KB，86% SVG Sprite）或 Read+Write 重写。页面模板（45KB+）同理按需局部读取。

**6.2 组件规范查阅（强制输出证明，路径C/清洗场景豁免）**

按 G4 输出证明，空项禁止进入6.3。各页面证明项数：列表9/详情8/表单9/弹窗10（清单位置：[components/README.md](REFERENCES/components/README.md) #1-4）。证明后必填**⭐关键样式值抽取清单**（按 G4 填入实现备忘录，数值来源 [design-tokens.css](ASSETS/design-tokens.css) + 组件规范，禁止模糊值），未填禁止进入 §6.3。
清洗场景按 §3.6 豁免规范阅读；但 external 步骤五的 **M8 class 合规检测门不豁免**——那是结构检测，PASS 证据仍须输出。

**6.3 实现页面结构**

前置门禁：§5清单全☑ + 6.2证明已输出 + 关键样式值清单已填 + `validate-design.mjs` 全PASS（FAIL→`quick-fix.mjs all`修复重验）
- **导航栏**：代码见 [nav-menu-full-code.md](REFERENCES/nav-menu-full-code.md)，规范见 [navigation.md](REFERENCES/components/navigation.md)。菜单数据按 §3.8 矩阵替换，禁止原样复制模板菜单
- **内容区**：按页面类型查阅组件规范（列表→query-bar+tables+pagination / 表单→form-inputs+checkboxes / 详情→cards / 弹窗→buttons+action-buttons）。所有样式值用CSS变量，禁止硬编码
- **四部分组织**：按 G1.1 强制执行（命名规则见 §8）。模板参考 `ASSETS/page-shells/pages/list.html` + `ASSETS/page-shells/js/pages/list.js`。⚠️ **模板按需读取**：只读目标页面类型的 **1 个**模板（单模板 45KB+），禁止一次读全部 4 个；优先用 Grep 提取所需片段（骨架容器/组件段落）
- **⭐ 卡片两层规则**（cards.md v5.0/v5.1）：大卡片（`.page-card`）无阴影无边框；子卡片（`.card`）有S1阴影无边框；头部内容（标题/描述/返回/操作按钮）必须作为 `.page-card` 第一个子元素包裹在卡片内。自检项：S47-S50

**6.4-6.5 图标 + 输出控制**
- 6.4 图标：[icons.md](REFERENCES/components/icons.md)｜[icons/README.md](ASSETS/icons/README.md)
- 6.5 输出控制：按 G1 MPA 产出独立 `.html` + 配套 `js/pages/D-XXX_{页面功能名称}.js`。**分段模式**（逐页生成）：第2页起须重新执行规范读取，禁止复用上下文；并行生成改走 §6.8。清洗场景例外：规范读取按 §3.6 一次完成后全局复用；多页清洗满足 §6.8 模式B 三前提时可并行，否则逐页串行原地修改

**6.6-6.7 跨页面交互 + 页面内交互**
- 6.6 跨页面交互联动（存在跨页面交互且5.1已确认时执行）：跳转用 `switchPage(pageId, module)`（`common.js` 实现 `location.href` + sessionStorage 持久化），传参用 `localStorage`/URL 查询参数，缺后端用Mock。错误处理见 [page-interactions.md §7](REFERENCES/page-interactions.md)
- 6.7 页面内交互规范（所有页面强制）：补全按钮交互，深度=视觉态+轻模拟（纯前端）

| 编号 | 交互 | 适用 | 编号 | 交互 | 适用 |
| --- | --- | --- | --- | --- | --- |
| IX1-2 | 查询/重置 | 列表页 | IX7 | 表单保存 | 表单/弹窗 |
| IX3-5 | 新增/编辑/删除 | 列表页 | IX8-10 | 导航切换/侧边展开收起 | 含导航页 |
| IX6 | 分页 | 列表页 | IX11-12 | 表格行更多操作/标签页切换 | 列表/详情页 |

> 完整实现详见 [page-interactions.md](REFERENCES/page-interactions.md)。输出《页面内交互清单》，任一未实现禁止进入步骤7。

**6.8 并行协调（多页面/多文件任务的并行提效机制，两种模式；单文件/小任务直接串行）**

> ⚠️ **无护栏并行一律禁止**：子代理上下文独立，自行读规范会 token 成倍放大、易走样为"从零重写"（违反 G11）。任何场景启用并行必须满足本节护栏；不满足前提时保持串行原地修改。分工与模板详见 [parallel-workflow.md](REFERENCES/parallel-workflow.md)。
>
> ⚠️ **同文件写入权唯一（两模式通用硬边界）**：任何时刻一个文件只允许一个执行者（主代理或唯一子代理），禁止两个执行者同时写同一文件——直接双写会互相覆盖导致内容失效/丢失。**同页面多模块并行仅限模式A片段返回制**（子代理只返回片段，写入由主代理串行合并+清点）；同文件多模块的修改一律串行。

**模式A 并行填充（全新页面）**：①串行产出《布局契约文档》→ ②并行填充（铁律：禁止改骨架/自定义卡片样式/直接写文件，只返回片段）→ ③串行合并写入+清点 → ④整合校验（C1-C5，任一FAIL→修正→重验）。详见 parallel-workflow.md §2A+§3.1+附录A/B/C

**模式B 并行改造（修改场景通用）**：三前提缺一不可——**P1 单元独立**（一文件=一子代理）｜**P2 规则可注入**（改造规则固化为《改造配方卡》，子代理零规范阅读）｜**P3 试点先行**（主代理串行改造首个文件并脚本全PASS后派发）。流程：R1规则固化→R2试点→R3任务划分→R4并行发起→R5子代理原地修改+自检→R6主代理验收。详见 parallel-workflow.md §2B+§3.2+附录D/E

**禁止并行（保持串行）**：同文件任何形式的直接双写（子代理直接编辑页面文件 = 违规，仅模式A片段返回制例外）｜深度拆分类改造（M1/M11 SPA→MPA，输出由单一源文件派生）｜单文件内多模块改造｜公共文件（common.css/common.js/icons-sprite/索引/导航数据）｜试点未通过/配方未锁定。

> **QG6**：HTML+JS 已产出（G1.1 四部分组织）+《页面内交互清单》已产出 + `validate-design.mjs` 初检全PASS。

### 阶段D：自检与交付（步骤 7-8）

#### 7. 自检与矫正

> 路径A/B全量执行六道门禁；路径C 仅执行7.0+7.1+7.3+7.4+7.5+7.6（7.2 结构层⏭，与 §1.0c 分级纠正规约一致——全自定义页不强求标准骨架）。未通过禁止输出至 `2.UI/`（tmp除外）。逐道执行输出 `✅ 7.X PASS` 或 `❌ FAIL → 矫正中`，禁止合并跳过。

| 门禁 | 脚本 | 范围 | FAIL处理 |
| --- | --- | --- | --- |
| 7.0 资源层 | `validate-design.mjs` | E1-E6（含E6内联style污染；Sprite容器行级白名单见lib.mjs，官方common.js已于v5.1.3修正过时内联样式） | 自动 `quick-fix.mjs`（E1-E4注入资源，E6清洗）→ 重检循环至PASS；样式类问题转 style-scan.mjs |
| 7.1 样式层 | `style-scan.mjs` | S01-S68（含S58-S65选项卡/页签，S66-S68外部污染） | 详见 [style-fix-cheatsheet.md](REFERENCES/style-fix-cheatsheet.md) |

> **MPA 模式**：S01/S02 资源类项自动跳过（在 common.css/common.js 中，输出 INFO 非 FAIL）。组件样式在页面 `<style>` 块中检测。
| 7.2 结构层 | `layout-scan.mjs` | L1-L12 | FAIL→从 `ASSETS/page-shells/pages/` 对应模板**仅复制骨架容器段**（用 Grep 提取 `#header`/`.main-wrapper`/`.page-card` 片段，禁止整文件阅读），禁止从零写（路径C⏭，全自定义页不强求标准骨架） |
| 7.3 矫正 | — | 按§7.0映射自动修复 | 无脚本项查S编号条目手动改→重验 |
| 7.4 交互验证 | `interaction-scan.mjs` | IX清单逐项+导航壳 | 人工对照IX清单+双击index.html验证 |

> **MPA 模式**：须同时检测 HTML + 配套 JS（`interaction-scan.mjs pages/*.html` + `js/pages/*.js`）。`addEventListener` 绑定的按钮报 WARN 非 FAIL（需人工确认）。
| 7.5 需求覆盖 | — | 对照《需求完整清单》 | 未实现项❌禁止输出，须补全或用户确认延期（路径C⏭） |
| 7.6 内容完整性 | — | 行数/字符数对比 | 减少>15%且未触发G2.1→FAIL→从自动保存恢复→用户决定 |

> 六道门禁全PASS→步骤8；任一FAIL→矫正后重跑。全部PASS后输出：

```
### ✅ 步骤7自检完成证明
- 7.0 资源层：PASS | 7.1 样式层：PASS | 7.2 结构层：PASS
- 7.3 矫正：已执行 | 7.4 交互验证：PASS | 7.5 需求覆盖：PASS（路径C⏭）
- 7.6 内容完整性：PASS | 关卡 QG7：PASS → 进入 §8
```

> **QG7**：六道门禁全PASS +《自检完成证明》已产出。

#### 8. 完成输出

**输出位置**：自检通过+最终确认→`2.UI/`｜未通过/待确认/用户跳过→`2.UI/tmp/`

```
2.UI/
├── index.html（重定向壳，G1） + pages/D-XXX_{名称}.html  # 入口 + 各业务页面（MPA，四部分组织 G1.1）
├── css/common.css                        # 公共样式（Design Tokens+导航壳+页签+切页淡入兜底）
├── js/common.js                          # 导航壳+switchPage+sessionStorage持久化+zoom+切页预载（配 @view-transition crossfade）
├── js/pages/D-XXX_{名称}.js              # 配套JS（交互逻辑+IIFE初始化）
├── js/lib/、images/                      # （按需）外部资源/图片，禁止CDN/外链
├── 索引.md                               # 产出物目录指引 + Figma链接索引
└── tmp/                                  # 草稿区（不推送git）
    ├── {原名}_v{n}.{ext}                 # G2正式备份（重大修改，打编号）
    └── .autosave/{原名}.{ext}            # G2.2自动保存（所有修改前，覆盖式）
```

**命名规则**：页面文件名（`.html`+配套`.js`）统一用 `D-{序号}_{页面功能名称}`（如 `D-001_新增用户.html`），HTML与配套JS同编号同名，**禁止用kebab-case内部ID作为文件名**。内部通过 `<script>window.__pageId='xxx';</script>` 声明路由ID（kebab-case，如 `user-list`），对用户不可见。产物编号在各迭代/项目内唯一递增（D-001、D-002…），与归档技能体系一致。`js/lib/` 与 `images/` 仅当实际涉及第三方库或图片时创建。

**交付物清单**：①各页面`.html`（四部分组织G1.1）②`js/pages/D-XXX_{名称}.js` ③`index.html`（重定向壳，含元信息头）④`css/common.css` ⑤`js/common.js`

**更新索引**：产出后同步更新 `2.UI/索引.md`（不存在则新建），纯目录指引每条一行：`- {文件名} — {一句话用途说明}`，tmp不纳入。格式详见归档技能 index-template.md §三 L2。

**QG8（输出前最终关卡）**：按 G9 呈现追踪表最终版，确认6项全☑后输出至 `2.UI/`：①追踪表应执行步骤全☑ ②QG1-QG7完成证明已输出 ③§5核心关卡确认记录存在 ④§7六道门禁全PASS ⑤交付物完整 ⑥索引已更新。

---

## 五、闭环与迭代

- **修改即触发**：每次修改按 §1.1 重新进入本技能，重新执行步骤7自动修复（§7.0/§7.3），循环至全 PASS
- **回退机制**：①迭代区内→从tmp正式备份恢复（`_v{n}.{ext}`）②知识图谱→从本地备份恢复（须用户明确要求）③§7.6 FAIL→从G2.2自动保存恢复
- **本地预览**：双击 `index.html` 即可打开，无需服务器

---

## 附录：核心术语速查

| 术语 | 定义 | 关键值 |
| --- | --- | --- |
| Design Tokens / SSOT | 设计系统数值真源，禁止硬编码 | `design-tokens.css`，引用CSS变量 |
| 四态/五态 | 按钮/输入框交互状态 | Default/Hover/Active/Disabled（+Focus/Error） |
| 主题色三态 | 主题蓝Hover/Active变体 | `-1`#3685F2 → `-2`#5E9DF5 → `-3`#2364CC |
| currentColor | SVG图标颜色继承 | `fill="currentColor"` + 父元素`color` |
| 方案B | 表格溢出最佳实践 | overflow:hidden+text-ellipsis+max-width:540px+hover显示全部 |
| SVG Sprite | 图标合并为单文件`<symbol>`+`<use>`引用 | `icons/icons-sprite.svg`, ≥113个 |
