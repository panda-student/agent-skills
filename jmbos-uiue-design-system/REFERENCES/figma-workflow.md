# Figma 设计稿还原流程

> JMBOS UIUE Design System — Figma URL → 高保真 HTML 页面的完整还原指南
>
> **定位**：本文件是 Figma 设计稿还原的**独立完整流程文档**。SKILL.md §1.0 定义入口和强制触发规则，本文件提供完整执行步骤。
>
> **与 SKILL.md 的关系**：Figma 场景路由 `§1 Figma处理 → §3 → §5 → §6 → §7 → §8`（跳过 §2 备份）。

---

## 1. 核心原则

### 1.1 还原原则

> **规范覆盖的部分严格按规范实现；规范未覆盖的部分必须 100% 还原 Figma 设计稿。**

| 层面 | 判定规则 | 实现方式 |
|------|---------|---------|
| 规范已覆盖的组件 | 48个标准组件内 | 100% 用规范代码，Figma 仅提供内容/变体选择 |
| 规范已覆盖的样式值 | design-tokens.css 有对应变量 | 100% 映射到 CSS 变量，禁止硬编码 |
| 规范已覆盖的布局 | page-shells/pages/ 有对应骨架 | 100% 用规范骨架，禁止翻译 Figma 绝对坐标 |
| 规范未覆盖的自定义样式 | Figma 有但规范无定义 | **100% 按 Figma 还原**，优先映射 design-tokens，无匹配则保留原始值并标注 |
| 规范未覆盖的非标组件 | 不在48个标准组件内 | **100% 按 Figma 还原**，遵守 design-tokens 底线 |
| 规范未覆盖的特殊布局 | Dashboard/大屏/混合布局 | **100% 按 Figma 还原**，用 flex/grid 语义化实现 |
| 交互行为 | Figma 通常只有静态态 | 四态（hover/active/focus/disabled）用规范补全；Figma 有标注的按 Figma |
| 技术约束 | 资源内联（Logo/Sprite/Tokens） | 强制遵守，不受 Figma 影响 |

**判定流程**：规范有定义→用规范；无定义→100% 按 Figma 还原（样式值优先映射 design-tokens，布局禁止直接翻译绝对坐标为 position:absolute）。不确定→查阅 components/README.md + design-tokens.css，仍不确定→按"规范未覆盖"处理。

### 1.2 禁止事项

- **禁止**直接将 Figma 绝对定位坐标翻译为 CSS position（用 flex/grid 语义化实现）
- **禁止**对规范未覆盖的内容擅自简化或忽略
- **禁止**跳过规范查阅直接从 Figma 数据生成代码
- **禁止**用规范近似值替代 Figma 中明确不同的设计意图

---

## 2. 流程总览

```
Figma URL → 步骤一：数据获取（MCP）→ 步骤二：组件识别 → 步骤三：规范映射
→ 步骤四：骨架匹配与页面类型判定 → 步骤五：方案确认 → 步骤六：代码生成
→ 步骤七：视觉校验
```

---

## 步骤一：Figma 数据获取

> **强制触发**：用户输入含"按设计稿""按Figma""还原设计稿""照着设计稿"等关键词，或直接提供 Figma URL 时，**必须**执行本步骤。首次生成和后续修改均适用。无 URL 时先查 Figma 链接索引（统一记录在 `01.项目迭代工作区/{迭代}/2.UI/索引.md` 的 `## Figma 链接索引` 章节），有记录则直接使用，无记录则停止并向用户索取。获取数据后**必须更新索引**。详见 SKILL.md §1.0。
>
> **可用 MCP 工具**：`get_figma_data`（获取节点树 JSON）| `download_figma_images`（下载 SVG/PNG/GIF）

### 1.1 解析 Figma URL

```
URL 格式：https://www.figma.com/(file|design)/<fileKey>/...?node-id=<nodeId>
→ fileKey 原样使用；nodeId 中 - 替换为 :（如 123-456 → 123:456）
→ 有 node-id 时必须使用，避免获取整文件
```

### 1.2 获取节点数据（get_figma_data）

| 参数 | 必填 | 说明 |
|------|------|------|
| `fileKey` | 是 | 从 URL 提取 |
| `nodeId` | 有则必用 | 格式 `1234:5678` 或深层实例 `I5666:180910;1:10515`（分号连接是单个节点 ID） |
| `depth` | 禁止使用 | 除非用户明确要求 |

**调用示例**：

```
# 场景A：URL 含 node-id（精确获取）
run_mcp: mcp_Figma_AI_Bridge / get_figma_data
  args: { fileKey: "ABC123XYZ", nodeId: "123:456" }

# 场景B：URL 不含 node-id（获取整个文件，从 document.children 定位目标页面）
run_mcp: mcp_Figma_AI_Bridge / get_figma_data
  args: { fileKey: "ABC123XYZ" }
```

**返回数据关键字段提取**：

| 字段 | 用途 |
|------|------|
| `type` | 节点类型（FRAME/TEXT/RECTANGLE/INSTANCE/VECTOR） |
| `name` | 辅助组件识别（语义命名优先级最高） |
| `children` | 子节点（递归解析嵌套结构） |
| `characters` | TEXT 节点文字内容 |
| `style` | 字号/字重/字族（映射到 design-tokens） |
| `fills` | 背景色/文字色（映射到 design-tokens 颜色变量） |
| `componentId` | INSTANCE 节点的组件来源 |
| `imageRef` | IMAGE 填充图片资源（传递给 download_figma_images） |

**数据解析策略**（按优先级）：①节点名称含语义→直接映射 ②结构特征推断 ③文字内容辅助 ④尺寸比例兜底

**特殊节点**：INSTANCE→读 componentId+componentProperties | IMAGE 填充→提取 imageRef | GIF→提取 gifRef | 深层实例（分号连接）→单个节点 ID | MASK→`clipsContent: true` | 隐藏→`visible: false` 跳过

### 1.3 下载设计稿截图（download_figma_images）

| 参数 | 必填 | 说明 |
|------|------|------|
| `fileKey` | 是 | 同 get_figma_data |
| `nodes` | 是 | 数组，每项含 nodeId/fileName（必填）+ imageRef/gifRef/needsCropping/cropTransform/requiresImageDimensions/filenameSuffix（按需） |
| `localPath` | 是 | 保存目录（相对于 `/Users/jomoo`），如 `Desktop/设计skill/01.产品迭代工作区/{迭代}/2.UI/images/迭代名称`（`images/` 按需创建，无图片资源不创建空文件夹）|
| `pngScale` | 否 | PNG 缩放，默认 2 |

**调用示例**：

```
# 场景A：下载页面截图（PNG）
run_mcp: mcp_Figma_AI_Bridge / download_figma_images
  args: { fileKey: "ABC123XYZ", nodes: [{ nodeId: "123:456", fileName: "列表页.png" }],
          localPath: "Desktop/设计skill/01.产品迭代工作区/{迭代}/2.UI/images/迭代名称", pngScale: 2 }

# 场景B：下载含 imageRef 的图片资源（必须传入 imageRef）
run_mcp: mcp_Figma_AI_Bridge / download_figma_images
  args: { fileKey: "ABC123XYZ", nodes: [{ nodeId: "456:789", fileName: "产品图片.png", imageRef: "abc123" }],
          localPath: "Desktop/设计skill/01.产品迭代工作区/{迭代}/2.UI/images/迭代名称" }
```

> **imageRef vs nodeId**：imageRef=Figma 内嵌位图（从 fills 提取，必须传入才能获取原图）；nodeId=节点渲染为图片（适用于矢量节点导出 SVG/PNG）。节点同时有 IMAGE 填充时必须同时传入两者。SVG 图标无需 imageRef；GIF 必须用 gifRef。

**截图下载策略**：单页面→1张全页 PNG | 多页面→一次调用传入多个 nodes | 弹窗/抽屉→独立 Frame | 图片资源→必须传 imageRef | SVG 图标→无需 imageRef | GIF→必须传 gifRef

### 1.4 数据完整性校验

| 检查项 | 不通过处理 |
|--------|-----------|
| 节点树非空 | 检查 fileKey/nodeId |
| 包含页面级 FRAME | 指定更具体的 nodeId |
| 文字内容可提取 | 截图作为补充 |
| 截图下载成功 | 重试或降低 pngScale |
| 图片资源完整 | 补充调用 download_figma_images |

### 1.5 MCP 工具调用时序

```
1. get_figma_data → 解析节点树 → 提取结构/文字/样式 → 收集需下载资源（页面Frame ID/imageRef/gifRef/VECTOR）
2. download_figma_images → 一次调用传入所有节点 → 验证下载结果 → 进入步骤二
```

### 1.6 还原模式选择

| 模式 | 适用条件 | 数据来源 | 校验方式 |
|------|---------|---------|---------|
| **图片增强模式** | 模型可读取图片 | JSON + 截图 + 规范参考图 | 截图视觉比对（§7.2） |
| **纯数据模式** | 模型无法读取图片 | 仅 JSON 节点树 | 数据逐项校验（§7.3） |

> 两种模式的核心流程（步骤二~六）完全相同，差异仅在数据利用深度和校验方式。

**纯数据模式增强策略**：递归遍历所有 TEXT 节点构建完整文案清单 | 每节点 fills/strokes/effects/style 全量提取 | 用父子/兄弟关系+空间位置还原布局语义 | 提取 Auto Layout 属性映射为 flex/grid | 追踪 INSTANCE 的 componentId+componentProperties | 输出《Figma 数据描述文档》（含页面概况/区域划分/文字清单/样式清单/组件实例清单）

> 纯数据模式仍需下载截图保存到本地供用户人工查看，但不参与自动化流程。

### 1.7 Figma 链接索引规则

> 用户提供过 Figma 链接后，**必须**记录到迭代目录的 UI 索引文件中，后续修改时优先从索引查找，避免重复索取。

- **索引文件路径**：`01.项目迭代工作区/{迭代}/2.UI/索引.md`（即 SKILL.md §8 完成输出中统一维护的 UI 索引文件）
- **文件不存在时**：自动创建（同时包含 UI 产出物目录和 Figma 链接索引两个章节）
- **记录格式**：在索引文件中追加 `## Figma 链接索引` 章节，表格形式记录：

```markdown
## Figma 链接索引

| 日期 | 页面/区域 | Figma URL | fileKey | nodeId | 备注 |
|------|----------|-----------|---------|--------|------|
| 2026-07-09 | 列表页 | https://www.figma.com/design/ABC123/...?node-id=123-456 | ABC123 | 123:456 | 首次提供 |
| 2026-07-09 | 查询栏修改 | https://www.figma.com/design/ABC123/...?node-id=789-012 | ABC123 | 789:012 | 修改时提供 |
```

- **查找规则**：用户未提供 URL 时，先查索引文件 `## Figma 链接索引` 章节中是否有对应页面/区域的记录。有→直接使用并告知用户"从索引中找到链接"；无→停止并向用户索取
- **更新时机**：每次获取新的 Figma URL 后立即追加记录到该章节
- **索引同步**：归档到知识图谱时，UI 索引文件（含 Figma 链接索引章节）一并归档

---

## 步骤二：组件识别与区域划分

> **核心目标**：从 Figma 节点树中识别"设计意图"——哪些区域是查询栏、表格、操作按钮组。

### 2.1 页面类型识别

| 页面类型 | 识别特征 |
|---------|---------|
| 列表页 | 顶部输入控件区 + 中部表格 + 底部分页 |
| 详情页 | 返回按钮 + 标题 + 多个信息卡片 |
| 表单页 | 大量表单控件 + 底部操作按钮 |
| 弹窗 | 遮罩层 + 居中容器 + 关闭按钮 |
| 半自定义 | 标准骨架 + 自定义模块（图表/统计卡） |

**识别方法**（按优先级）：①节点名称含语义 ②结构特征 ③文字内容 ④尺寸比例

### 2.2 区域划分

从上到下、从外到内划分功能区域。导航区域固定（顶导42px + 侧边180px），内容区域弹性。弹窗/抽屉识别为嵌入式组件，不与主页面区域混合。

### 2.3 输出《组件识别表》

```
《组件识别表》— {页面名称}

| # | 区域 | 推断组件 | 规范来源 | 置信度 | Figma 依据 |
|---|------|---------|---------|--------|-----------|
| 1 | 顶部 | 顶部导航栏 | navigation.md | 高 | 固定结构 |
| 2 | 区域1 | 查询栏 | query-bar.md | 高 | 含"查询""重置"按钮 |
| 3 | 区域2 | 操作按钮组 | action-buttons.md | 高 | 含"新增""导出"按钮 |
| 4 | 区域3 | 数据表格 | tables.md | 高 | 网格结构+表头 |
| 5 | 区域4 | 分页器 | page-types.md | 中 | 含"共X条"文字 |

置信度：高=结构明确 / 中=需确认 / 低=有歧义需询问
```

> **低置信度项必须向用户确认**，禁止凭猜测直接实现。

---

## 步骤三：规范映射

> **核心目标**：建立 Figma 数据 → 规范代码的映射关系。

### 3.1 样式值归一化

将 Figma 样式值映射到 design-tokens.css 变量。**映射规则**：先精确匹配变量；匹配不到找最接近的；仍匹配不到保留 Figma 原始值并标注"自定义值：来源 Figma"。**规范未覆盖的样式值必须 100% 还原 Figma，禁止擅自用规范近似值替代。**

> 完整的颜色/字号/间距/圆角映射表见 [design-tokens.css](../ASSETS/design-tokens.css)。常用映射：#3685F2→--color-primary | 13px→--font-size-base | 12px→--spacing-md | 4px→--radius-r2

### 3.2 组件→规范文档映射

| Figma 组件特征 | 规范组件 | 规范文档 |
|--------------|---------|---------|
| 搜索图标+输入框+查询/重置按钮 | 查询栏 | query-bar.md |
| 主色/次色/危险按钮 | 按钮 | buttons.md |
| "新增""导出""更多操作"按钮行 | 操作按钮组 | action-buttons.md |
| 表头+数据行+复选框+操作列 | 数据表格 | tables.md |
| "共X条"+页码+每页条数 | 分页器 | page-types.md |
| 标签文字+彩色背景 | 标签 | tags.md |
| 输入框+下拉框+日期选择 | 表单输入 | form-inputs.md |
| 遮罩+居中容器+关闭按钮 | 弹窗 | modal.md |
| 侧滑面板 | 抽屉 | drawer.md |
| 键值对信息展示 | 描述列表 | cards.md |
| **非标组件**（图表/统计卡/自定义业务组件） | **无规范对应** | **100% 按 Figma 还原** |

### 3.2.1 组件样式匹配度校验（关键步骤）

> **核心问题**：Figma 组件可能与规范中**同名组件的样式不一致**。差异分两个层面：形态分类级（组件样式分类/形态完全不同，规范未覆盖）和数值级（具体数值不同）。**先判断形态分类是否在规范覆盖范围内，再做数值级比对。**

**匹配度分级与处理策略**：

| 匹配级别 | 形态分类 | 数值校验（9维度） | 处理策略 | 典型示例 |
|---------|---------|------------------|---------|---------|
| 完全匹配 | 规范已覆盖 | 全部一致 | 用规范代码，Figma 仅提供内容/变体 | 下划线型选项卡、主/次/危险按钮 |
| 数值级部分匹配 | 规范已覆盖 | 个别差异 | 规范维度用规范代码；差异维度逐项决策 | 按钮圆角 2px vs 规范 4px |
| 形态分类不匹配 | 规范未覆盖 | — | **100% 按 Figma 还原该形态**，样式值映射 design-tokens | 胶囊型选项卡、渐变按钮、斑马纹表格 |
| 完全不匹配 | 规范未覆盖 | 完全不同 | 视为非标组件，100% 按 Figma 还原 | 自定义业务组件 |

> **9个数值校验维度**：颜色（fills/strokes）、字号（style.fontSize）、字重（style.fontWeight）、间距（itemSpacing/padding）、圆角（cornerRadius）、尺寸（boundingBox）、布局方向（layoutMode）、边框（strokes+strokeWeight）、阴影（effects）。

**形态分类参考**（规范已覆盖→进入数值级校验 | 规范未覆盖→100% 按 Figma 还原，样式值优先映射 design-tokens，无匹配保留原始值标注"自定义形态"）：
- 选项卡/标签页：✅ 下划线型 | ❌ 胶囊型、卡片型、分段控制器型
- 按钮：✅ 主/次/危险/默认+图标按钮 | ❌ 胶囊按钮、无边框文字按钮、渐变按钮
- 标签：✅ 5色变体+R1圆角+有/无边框 | ❌ 胶囊标签、描边标签、带图标标签
- 表格：✅ 标准/树形/嵌套 | ❌ 斑马纹、卡片式、虚拟滚动
- 输入框：✅ 单行/多行+五态 | ❌ 带前缀图标、标签输入框、搜索型
- 弹窗：✅ 3种尺寸居中 | ❌ 全屏、侧边、底部抽屉式
- 导航菜单：✅ 顶导42px+侧边180px | ❌ 折叠式侧边、抽屉式、底部Tab栏
- 卡片：✅ S1/S2阴影+无边框 | ❌ 带边框、带标题栏、可折叠
- 分页器：✅ 标准（共X条+页码+跳转） | ❌ 简约型、加载更多型
- 复选框：✅ 伪元素五态 | ❌ 开关型、卡片选择型

**数值差异决策**：在规范变体范围内→用规范变体 | 设计意图（Figma 明确用了不同值）→100% 还原 Figma 值标注"自定义值" | 设计误差/不确定→向用户确认

> **关键原则**：差异项不能默默忽略，**必须**在《规范映射表》中列出并标注处理方式。需确认的项在步骤五提出。

### 3.3 布局→骨架模板映射

| Figma 布局特征 | 页面类型 | 骨架模板 |
|--------------|---------|---------|
| 查询+工具栏+表格+分页 | 列表页 | page-shells/pages/list.html + js/pages/list.js |
| 返回+标题+卡片+描述列表 | 详情页 | page-shells/pages/detail.html + js/pages/detail.js |
| 标题+表单+操作按钮 | 表单页 | page-shells/pages/form.html + js/pages/form.js |
| 遮罩+弹窗容器+表单 | 弹窗 | page-shells/pages/modal.html + js/pages/modal.js |
| 标准区域+图表/统计卡 | 半自定义 | 对应标准模板+自定义区域 |

### 3.4 输出《规范映射表》

```
《规范映射表》— {页面名称}

## 样式映射
| Figma 值 | 映射变量 | 映射结果 | 备注 |
|---------|---------|---------|------|
| #3685F2 | --color-primary | ✅ 精确匹配 | 主色 |
| #E8EDF3 | — | ⚠️ 自定义值 | 无匹配变量，Figma 特有色 |

## 组件映射
| # | Figma 区域 | 规范组件 | 规范文档 | 状态 |
|---|-----------|---------|---------|------|
| 1 | 查询区 | 查询栏 | query-bar.md | ☐ |
| 2 | 数据区 | 数据表格 | tables.md | ☐ |

## 组件样式匹配度校验
### 形态分类级
| # | 组件 | Figma 形态 | 规范覆盖形态 | 匹配度 | 处理方式 |
|---|------|-----------|-------------|--------|---------|
| 1 | 选项卡 | 胶囊型 | 仅下划线型 | 形态不匹配 | 100%还原Figma形态 |

### 数值级
| # | 组件 | 校验维度 | Figma 值 | 规范值 | 匹配度 | 处理方式 |
|---|------|---------|---------|--------|--------|---------|
| 1 | 按钮 | 圆角 | 2px | 4px(--radius-r2) | 不匹配 | 还原Figma→--radius-r1 |

## 布局映射
| 项目 | Figma 特征 | 映射结果 |
|------|-----------|---------|
| 页面类型 | 查询+表格+分页 | 列表页 |
| 骨架模板 | — | page-shells/pages/list.html + js/pages/list.js |
| 实现路径 | 标准结构 | 路径A |
```

---

## 步骤四：骨架匹配与页面类型判定

### 4.1 骨架匹配度判定

```
Figma 页面布局
    ├── 完全匹配标准骨架（区域结构一致）→ 标准页面 → 路径A
    ├── 部分匹配（骨架主体匹配+额外区域）→ 半自定义 → 路径B
    ├── 骨架类型匹配但布局结构不同 → 骨架变体 → §4.1.1
    └── 完全不匹配（Dashboard/大屏）→ 全自定义 → 路径C
```

#### 4.1.1 骨架变体处理

> **场景**：功能上属于列表页/详情页/表单页/弹窗，但布局结构与规范内置骨架不同。

| 标准骨架 | 标准布局 | 骨架变体（示例） | 差异 |
|---------|---------|----------------|------|
| 列表页 | 上下排列 | 左右分栏（树形+表格）/查询栏内嵌表头/无查询栏/多表格并列 | 布局方向/区域合并/缺失/重复 |
| 详情页 | 卡片纵向 | 左右分栏（目录+内容）/时间轴+卡片混合 | 布局方向/区域类型变化 |
| 表单页 | 上下排列 | 左右分栏（编辑+预览）/分步表单 | 布局方向/交互结构变化 |
| 弹窗 | 居中弹窗 | 侧边抽屉/全屏弹窗 | 弹出方向/尺寸变化 |

**处理策略**：骨架变体归入**路径B**——**标准组件用规范代码，布局结构按 Figma 还原**。不复制标准骨架模板，按 Figma 布局方向用 flex/grid 自行搭建。禁止直接翻译 Figma 绝对坐标为 position:absolute。组件仍必须查规范文档。

### 4.2 页面类型与实现路径

| 类型 | 判定依据 | 路径 | 规范遵循度 |
|------|---------|------|-----------|
| 标准页面 | 骨架完全匹配+组件全覆盖 | 路径A | 100% |
| 半自定义 | 骨架部分匹配/骨架变体/有自定义模块 | 路径B | 标准组件100%+布局按Figma+自定义区仅Token |
| 全自定义 | 骨架完全不匹配 | 路径C | 仅 Design Token 底线 |

| 页面类型 | 模板选择 |
|---------|---------|
| 标准页面 | 复制对应 page-shells/pages/ 模板 |
| 半自定义-标准区 | 复制对应模板 |
| 半自定义-骨架变体 | **不复制模板**，按 Figma 布局用 flex/grid 搭建 |
| 半自定义-自定义区/全自定义 | 无模板，仅遵守 Design Token |

> 详细路径执行步骤见 [implementation-paths.md](implementation-paths.md)。

---

## 步骤五：方案确认

> **核心关卡**——未通过禁止进入步骤六。

### 5.1 确认项清单

| # | 确认项 | 来源 |
|---|--------|------|
| 1 | 页面类型判定（标准/半自定义/全自定义） | 步骤四 |
| 2 | 整体布局与 Figma 一致 | 步骤二 |
| 3 | 组件完整清单及变体 | 步骤二+三 |
| 4 | 规范未覆盖的特殊处理 | 步骤三 |
| 5 | 模糊/矛盾取舍 | 步骤三 |
| 6 | 自定义样式值（无法映射 design-tokens） | 步骤三 |
| 7 | **组件样式差异**（名称匹配但样式不匹配） | 步骤三 §3.2.1 |

### 5.2 强制产出《组件完整清单》

```
《组件完整清单》— {页面名称}
| # | 组件名 | 使用位置 | 变体 | 规范来源 | 状态 |
|---|--------|---------|------|---------|------|
| 1 | 查询栏 | 页面顶部 | 单行3条件 | query-bar.md | ☐ |
| 2 | 数据表格 | 页面中部 | 含复选框+操作列 | tables.md | ☐ |
```

> 初始均 ☐，步骤六逐一打勾。

### 5.3 主动确认场景

Figma 模糊→列疑点 | 多种实现→说明优劣 | 规范未明确→提建议 | Figma 与规范冲突→按还原原则处理

---

## 步骤六：代码生成

> **核心策略**：规范覆盖的部分用规范实现 + 规范未覆盖的部分 100% 还原 Figma + 交互规范补全

### 6.1 搭建骨架

| 路径 | 骨架搭建方式 |
|------|------------|
| 路径A（标准） | 复制对应 page-shells/pages/ 模板 |
| 路径B-骨架变体 | **不复制模板**，按 Figma 布局用 flex/grid 搭建，组件用规范代码 |
| 路径B-自定义区 | 仅遵守 Design Token |
| 路径C（全自定义） | 按 Figma 结构自行搭建，仅遵守 Design Token 底线 |

**路径B-骨架变体搭建步骤**：①识别 Figma 实际布局结构（区域+方向+比例）→②用 flex/grid 搭建骨架（禁止翻译绝对坐标）→③内联 Design Tokens/SVG Sprite/Logo→④运行 validate-design.mjs→⑤每个区域用规范组件代码填充

**禁止**：将 Figma 绝对坐标翻译为 position:absolute | 用 x/y/width/height 硬编码布局 | 擅自简化或套用标准骨架方向 | 骨架变体中跳过组件规范查阅

### 6.2 填充内容（Figma 数据）

| 内容类型 | 数据来源 | 实现方式 |
|---------|---------|---------|
| 文字内容 | Figma TEXT 节点 characters | 填入规范组件对应位置 |
| 查询条件/表格列定义/按钮组合/标签变体/弹窗字段 | Figma 对应区域数据 | 按规范组件 .md 实现，内容/数量/文字从 Figma 取 |
| Mock 数据 | Figma 表格示例数据 | 提取 Figma 真实数据行 |
| **非标组件** | Figma 节点结构+样式 | **100% 按 Figma 还原**，遵守 design-tokens 底线 |
| **自定义样式** | Figma 样式属性 | **100% 按 Figma 还原**，优先映射 design-tokens，无匹配保留原始值 |

**内容填充检查**：C1 文字与 Figma 一致 | C2 组件变体匹配 | C3 表格列名/顺序一致 | C4 按钮文字/类型一致 | C5 标签颜色变体匹配

### 6.3 补全交互（规范补全）

Figma 有明确交互标注的按 Figma 还原；Figma 未覆盖的交互状态用规范补全。

| 交互类型 | 规范补全来源 |
|---------|------------|
| 按钮 hover/active/disabled | buttons.md 四态 |
| 输入框 focus/error/disabled | form-inputs.md 五态 |
| 表格行 hover/选中 | tables.md 行交互 |
| 导航菜单 hover/active | navigation.md 状态 |
| 弹窗打开/关闭/遮罩 | page-interactions.md 弹窗交互 |
| 查询/重置/新增/编辑/删除/分页 | page-interactions.md IX1-IX6 |
| 导航切换/侧边展开收起 | page-interactions.md IX8-IX10 |

### 6.4 样式校准（design-tokens）

**校准流程**：遍历 CSS 属性值→是 design-tokens 值→替换为 var() | 否→是 Figma 特有值→保留原始值标注"自定义值：来源 Figma" | 否→可能硬编码→映射到最接近变量→运行 style-scan.mjs→按 style-fix-cheatsheet.md 修复规范覆盖部分（规范外自定义值不纳入偏差项）

| 偏差类型 | 错误做法 | 正确做法 |
|---------|---------|---------|
| 规范内颜色/字号/间距/圆角/阴影硬编码 | 硬编码值 | 替换为 var(--variable) |
| **规范外自定义值** | **用规范近似值替代** | **保留 Figma 原始值，标注"自定义值：来源 Figma"** |

---

## 步骤七：视觉校验

> **两种校验模式**：根据 §1.6 选择的还原模式使用对应方式。

### 7.1 自动化扫描（两种模式共用）

按 SKILL.md §7 执行三道门禁：`validate-design.mjs`（资源）→ `style-scan.mjs`（样式）→ `interaction-scan.mjs`（交互）。全 PASS→进入比对；有 FAIL→先修复。

### 7.2 图片增强模式：逐区域视觉比对

将 Figma 截图与生成页面逐区域比对：导航栏（高度/颜色/Logo/菜单项）| 查询栏（标签/输入控件/按钮）| 工具栏（按钮数量/文字/类型/间距）| 数据表格（列名/列数/行高/操作列）| 分页器（布局/文字）| 弹窗（尺寸/字段/按钮）| 颜色（取色比对）| 间距（像素测量）

**常见偏差**：间距偏差→检查 spacing 变量 | 字号偏差→检查 font-size 变量 | 颜色偏差→检查 color 变量 | 组件缺失→回步骤二检查 | 布局偏差→回步骤二检查

### 7.3 纯数据模式：数据逐项校验

> 用 Figma JSON 数据作为"基准真值"，逐项校验生成页面的 HTML/CSS。

| 校验维度 | 比对内容 | 通过标准 |
|---------|---------|---------|
| 文字内容 | Figma characters vs HTML 文本 | 100% 一致，无遗漏无多余 |
| 样式值 | Figma fills/style/effects vs CSS | 精确匹配或正确映射到 design-tokens |
| 组件结构 | 识别表组件 vs HTML 组件 | 全部存在，顺序/层级/变体/类名正确 |
| 布局结构 | Figma 区域 vs HTML 区域 | 区域数量/比例/方向/对齐一致 |

> **纯数据模式局限**：无法校验视觉效果（渐变/阴影渲染/字体渲染），需提示用户人工确认。

### 7.4 输出《还原度报告》

**图片增强模式**：

```
《还原度报告》— {页面名称}（图片增强模式）
整体还原度：XX%
逐区域评分：| # | 区域 | 还原度 | 偏差项 | 修复建议 |
未还原项：| # | 项目 | 原因 | 处理方式 |
自定义值清单：| # | 属性 | Figma 值 | 使用位置 | 原因 |
```

**纯数据模式**：

```
《还原度报告》— {页面名称}（纯数据模式）
整体还原度：XX%（基于数据校验，不含视觉效果评估）
数据校验汇总：| 校验维度 | 通过/总数 | 通过率 |
偏差项清单：| # | 维度 | 偏差描述 | Figma 值 | 实际值 | 修复建议 |
未还原项 + 自定义值清单 + 需人工确认项
```

---

## 附录

### A. Figma 节点类型速查

FRAME→`<div>`/`<section>` | GROUP→`<div>` | VECTOR/BOOLEAN/STAR/POLYGON→`<svg>` | LINE→`<hr>`/border | ELLIPSE→border-radius:50% | RECTANGLE→`<div>` | TEXT→`<span>`/`<p>`/`<label>` | INSTANCE→对应规范组件

### B. Figma 布局模式识别

水平排列+均匀间距→`flex; gap:Xpx` | 垂直排列→`flex-direction:column; gap:Xpx` | 网格→`grid; grid-template-columns:repeat(N,1fr)` | 左右分布→`justify-content:space-between` | 居中→`align-items:center; justify-content:center` | 固定+弹性→`flex:0 0 Xpx` + `flex:1`

### C. Figma 数据常见问题

节点树过深→指定 nodeId | 文字缺失→截图辅助/检查 name 推断 | 组件名无语义→靠结构+内容推断 | Auto Layout 丢失→用布局模式识别推断 | 颜色不在规范→保留原始值标注 | 交互缺失→规范补全 | 图片未导出→download_figma_images 单独导出 | 模型无法读图→纯数据模式

### D. 相关文档

| 文档 | 路径 |
|------|------|
| SKILL.md（主工作流） | [SKILL.md](../SKILL.md) |
| Design Tokens | [design-tokens.css](../ASSETS/design-tokens.css) |
| 组件规范索引 | [components/README.md](components/README.md) |
| 页面布局规则 | [page-layout.md](page-layout.md) / [page-types.md](page-types.md) / [page-interactions.md](page-interactions.md) |
| 实现路径详解 | [implementation-paths.md](implementation-paths.md) |
| 实现检查清单 | [implementation-guide.md](implementation-guide.md) |
| 样式偏差修复 | [style-fix-cheatsheet.md](style-fix-cheatsheet.md) |
| 视觉参考图 | [ASSETS/README.md](../ASSETS/README.md) |

---
