---
name: jmbos-product-prd-generator
description: "生成、更新和验证PRD需求文档，输出含YAML元数据头部。当用户请求创建/修改/验证需求文档，或提及需求+功能且要求输出完整文档时调用。不响应模糊关键词询问。"
skill-version: V1.0.1
---

# PRD生成器

> **Freedom Level: High** — 文档指导型技能，提供分步流程、规则引用和模板，不包含可执行脚本。

## When to Use

- 用户请求创建、修改或验证产品需求文档（PRD）
- 用户提及「需求」+「功能」且要求输出完整文档
- 不响应模糊关键词询问，仅在有明确文档输出需求时触发

## 与 archiver 的区别

本技能负责文档的**创建/修改/验证**，archiver 负责文档的**归档/拆解/索引**。生成的 PRD 含 YAML 元数据头部，可直接被 jmbos-product-prd-archiver 归档到产品知识图谱。

## 工作流程（4阶段）

### 阶段一：准备

1. **迭代版本识别** → 无PRD则新建，有PRD则调优（详见 [iteration-workflow.md](references/iteration-workflow.md)）
2. **深度策略选择** → 主动询问用户选择 精简版 / 标准版 / 完整版，并说明三种深度的差异（详见 [prd-generation.md](references/prd-generation.md)）
3. **作者信息获取** → 按以下顺序确定 PRD 文档「作者」字段取值（写入 1.1 文档信息表与 1.2 修改记录的「修改人」列）：
   - 优先读取 git 账号信息（执行 `git config user.name` 获取用户名，`git config user.email` 获取邮箱，取 `user.name` 作为作者写入）；
   - 若 git 账号不存在或为空，则询问用户工号，将工号作为作者信息写入需求文档；
   - 全局作者信息在阶段一确定后，后续新建需求文档、章节/修改记录复用，不再重复询问。
4. **输入分析与澄清** → 提取产品名称、目标用户、功能需求、非功能需求、迭代版本，信息不足时主动询问

### 阶段二：生成

按深度策略和模板逐章节生成PRD，每章节写入后立即执行 L1 快速校验。

核心生成规则详见 [prd-generation.md](references/prd-generation.md)，模板结构详见 [prd-template.md](references/prd-template.md)。

关键规则速查：
- EARS映射：主要流程按"操作意图"映射，异常流程按"独立条件"映射，业务规则仅核心约束映射（详见 prd-generation.md「EARS映射规则」）
- 模块划分：单一维度+单一职责+高内聚低耦合+粒度适中（详见 prd-generation.md「功能模块划分原则」）
- 功能点ID复用：入口不变+流程不变+类型不变→复用已有ID（详见 prd-generation.md「功能点粒度与ID复用」）
- 页面字段说明：覆盖用户可见的所有关键字段（输入型/展示型/纯操作类），说明列仅描述字段独有约束（详见 prd-generation.md「页面字段说明处理原则」）
- 验收标准：使用 EARS 格式，包含关联功能点ID+预期结果，不含验收方法（详见 prd-generation.md「第7章」）

### 阶段三：验证修复

使用 [rules-engine.md](references/rules-engine.md) L2 标准规则增量验证，逐项修复。

- **变更范围判定**与**修复优先级/流程**详见 [validation-workflow.md](references/validation-workflow.md)
- Critical/High 立即修复，Medium/Low 自动修复并标注。单问题重试次数以 [rules-engine.md](references/rules-engine.md#修复机制) 为准，不可修复标记"需人工介入"。L3 仅 Full 深度可选执行。

### 阶段四：确认输出

- **确认级别**（自动/快速/完整）与**触发条件**详见 [confirmation-workflow.md](references/confirmation-workflow.md)
- 确认后：写入文件 → 生成索引文件 → 显示摘要 → 报告修复 → 标记待确认
- **文档命名**：`{系统名称}-{模块/功能描述}-需求说明书-{迭代版本}.md`
- **索引文件**：与PRD文档同目录，固定命名 `索引.md`

## 参考资源

| 文件 | 用途 | 何时读取 |
|------|------|---------|
| [iteration-workflow.md](references/iteration-workflow.md) | 迭代版本识别、缓存策略、调优路径 | 阶段一 |
| [prd-generation.md](references/prd-generation.md) | 生成指南、深度策略、模块划分、EARS规则（含映射规则） | 阶段一二 |
| [prd-template.md](references/prd-template.md) | 模板结构+功能点示例 | 阶段二 |
| [validation-workflow.md](references/validation-workflow.md) | 验证规则、修复流程、报告格式 | 阶段三 |
| [confirmation-workflow.md](references/confirmation-workflow.md) | 确认策略、输出规范、命名规则 | 阶段四 |
| [rules-engine.md](references/rules-engine.md) | 统一规则引擎（L1/L2/L3三层验证） | 阶段二三 |
| [ears-syntax.md](references/ears-syntax.md) | EARS需求语法规范 | 编写功能需求时 |

## 常见问题处理

| 问题 | 解决方案 |
|------|---------|
| 用户输入非常简略 | 先提取关键信息，询问确认后再生成 |
| 用户要求非常复杂 | 拆分为多个PRD或聚焦本次需求范围 |
| 既有PRD结构不同 | 以本模板为准补充缺失章节 |
| 用户不同意自动修复 | 标记问题，由用户手动修改 |
| 多个功能相互依赖 | 在同一功能模块内描述依赖关系 |
| 功能归属不明确 | 按"功能入模块判定规则"逐条判定，若仍不确定则询问用户 |
| 模块数量过多或过少 | 检查粒度过细需合并同领域功能，过粗需按实体/角色拆分 |
| git 账号缺失 | 阶段一执行 `git config user.name` 为空时，主动询问用户工号作为作者信息写入 |
