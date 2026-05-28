# Skill 构建参考规范

## ⚠️ 核心原则：SKILL.md 路由定位

**在创建和优化其他技能时，必须额外关注 SKILL.md 的路由定位：**

### 路由定位的重要性
SKILL.md 是技能的**智能路由器**，其质量直接决定：
- 用户能否快速找到所需资源
- AI 能否准确理解技能结构
- 技能的可维护性和扩展性

### 路由定位的关键要素
1. **高信息密度的路由表**：明确触发条件、资源路径、内容预期
2. **精确的锚点链接**：支持快速跳转到具体章节
3. **清晰的流程指引**：在关键步骤提供路由引导
4. **分层的内容组织**：遵循渐进式披露原则

### 路由定位检查清单
- [ ] 路由表是否覆盖所有主要功能？
- [ ] 每个路由是否有明确的触发条件？
- [ ] 资源路径是否准确可访问？
- [ ] 内容预期是否具体明确？
- [ ] 是否在关键流程中提供路由指引？
- [ ] 是否使用锚点链接支持跳转？

---

## 📋 快速导航

| 需求 | 跳转链接 |
|------|---------|
| **了解 Skill 类型判断逻辑** | [Skill 类型自动判断](#skill-类型自动判断) |
| **对比参考型 vs 任务型** | [Skill 类型对比](#skill-类型对比) |
| **参考型 Skill 规范** | [参考型 Skill 规范](#参考型-skill-规范) |
| **任务型 Skill 规范** | [任务型 Skill 规范](#任务型-skill-规范) |
| **命名规则** | [命名规则](#命名规则) |
| **Description 编写** | [Description 编写公式](#description-编写公式) |
| **权限配置** | [权限控制配置](#权限控制配置) |
| **目录结构** | [目录结构标准](#目录结构标准) |
| **cc-switch 同步** | [cc-switch 技能管理工具](#cc-switch-技能管理工具) ⚠️ 重要 |
| **最佳实践** | [最佳实践建议](#最佳实践建议) |

---

# 核心理论

本技能基于核心理论构建，详细内容请参考理论文件：

- **[渐进式披露架构核心理论](./theories/progressive-disclosure.md)**：分层按需加载知识与资源，解决 Token 爆炸问题
- **[参考型 Skills 核心理论](./theories/reference-skill-theory.md)**：参考型 Skill 设计原则与最佳实践
- **[任务型 Skills 核心理论](./theories/task-skill-theory.md)**：任务型 Skill 设计原则与核心概念
- **[任务型 Skill 七步设计清单](./theories/task-skill-checklist.md)**：任务型 Skill 实践指南
- **[单一职责原则](./theories/single-responsibility.md)**：每个文件只负责一个明确的功能领域
- **[依赖抽象原则](./theories/dependency-inversion.md)**：技能依赖功能接口而非具体技能名称

---

# ⚠️ Skill 类型核心区别

**创建前必须明确的最关键差异：**

| 类型 | 触发方式 | 调用者 | 典型场景 |
|------|---------|-------|---------|
| **双模式型** | **AI自动 + 用户手动** | Claude主动触发 / 用户 `/命令` | 通用技能（推荐） |
| **参考型** | **AI 自动识别调用** | Claude 主动触发 | 纯知识规范 |
| **任务型** | **用户手动调用** | 用户用 `/命令` 触发 | 敏感操作 |

## 双模式型（推荐，同时支持两种调用）

```
用户：我想设计一个登录 API
AI：[自动加载 api-rule] 根据 API 规范，建议使用 POST /auth/login...

用户：/api-rule
AI：[触发 api-rule] 请描述你的 API 需求...
```

- **触发方式**：AI 识别到相关话题时自动加载，用户也可通过 `/命令` 主动触发
- **适合场景**：大多数技能，既可提供知识参考，也可执行操作
- **配置特征**：设置 `user-invocable: true`，**不设置** `disable-model-invocation`
- **命名规范**：根据主要功能选择（规范类用名词，操作类用动词）

## 参考型（纯知识规范，仅 AI 自动调用）

```
用户：我想设计一个登录 API
AI：[自动加载 api-rule] 根据 API 规范，建议使用 POST /auth/login...
```

- **触发方式**：AI 识别到相关话题时自动加载，用户无需主动触发
- **适合场景**：纯知识规范、标准、指南、最佳实践（不执行任何操作）
- **配置特征**：不设置 `disable-model-invocation` 和 `user-invocable`
- **命名规范**：名词+最简词（api-rule、style-guide、git-flow）

## 任务型（敏感操作，仅用户手动调用）

```
用户：/make-component
AI：[触发 make-component] 请输入组件名称...
```

- **触发方式**：用户显式输入斜杠命令才能触发
- **适合场景**：敏感操作、文件修改、部署、测试（需要用户明确意图）
- **配置特征**：必须设置 `disable-model-invocation: true` 和 `user-invocable: true`
- **命名规范**：动词+最简词（make-app、run-app、check-code）

---

# Skill 类型自动判断 {#skill-类型自动判断}

## 判断原理

基于用户描述的功能关键词，自动识别 Skill 类型：

**核心判断逻辑**：
- 描述包含"执行动作产生结果"→ **任务型**
- 描述包含"提供知识指导决策"→ **参考型**

## 任务型关键词（动词导向）

| 关键词分类 | 具体词汇 | 典型场景 |
|-----------|---------|---------|
| **创建类** | 创建、生成、构建、编写、制作 | 产生新内容 |
| **执行类** | 部署、运行、执行、启动、发布 | 执行操作 |
| **变更类** | 修改、更新、删除、重构、迁移 | 变更操作 |
| **检查类** | 检查、测试、审查、验证、诊断 | 质量操作 |
| **配置类** | 安装、配置、初始化、设置 | 环境操作 |

## 参考型关键词（名词导向）

| 关键词分类 | 具体词汇 | 典型场景 |
|-----------|---------|---------|
| **规范类** | 规范、标准、规则、约定、准则 | 约束性知识 |
| **指导类** | 指南、流程、架构、模式、策略 | 指导性知识 |
| **风格类** | 风格、惯例、最佳实践、约定 | 经验性知识 |
| **领域类** | API规范、代码风格、Git流程、安全规范 | 领域知识 |

## 判断流程

```
用户描述
    ↓
提取关键词
    ↓
包含任务型关键词？ ──是──→ 任务型
    │
    否
    ↓
包含参考型关键词？ ──是──→ 参考型
    │
    否
    ↓
根据上下文推断或询问澄清
```

## 判断示例

| 用户描述 | 类型判断 | 判断依据 |
|---------|---------|---------|
| "创建一个API设计规范，提供RESTful接口指导" | 参考型 | 包含"规范"、"指导" |
| "创建一个生成组件的命令，自动创建组件文件" | 任务型 | 包含"生成"、"创建" |
| "创建一个部署脚本，执行构建和发布流程" | 任务型 | 包含"部署"、"执行" |
| "创建一个代码风格规范，定义命名和格式化规则" | 参考型 | 包含"规范"、"定义规则" |
| "检查代码质量并提供建议" | 任务型 | 包含"检查" |
| "提供项目架构指南" | 参考型 | 包含"指南" |

## 边界情况处理

### 混合型描述
优先根据**主要目的**判断：
- "创建一个组件生成器，遵循项目规范" → 任务型（主要目的是生成组件）
- "定义API规范，并提供示例代码生成" → 参考型（主要目的是提供规范）

### 模糊描述
根据**预期触发方式**判断：
- 需要用户主动调用 → 任务型
- 需要自动触发提供参考 → 参考型

---

# Skill 类型对比 {#skill-类型对比}

## 核心区别：user-invocable 和 disable-model-invocation 组合

**这是区分三种 Skill 类型的决定性配置：**

| 类型 | user-invocable | disable-model-invocation | 本质 |
|------|---------------|-------------------------|------|
| **双模式型** | `true` | 不设置或 `false` | 通用技能（AI可调用 + 用户可调用） |
| **参考型** | 不设置 | 不设置或 `false` | 纯知识提供者（仅AI可调用） |
| **任务型** | `true` | `true` | 敏感操作执行者（仅用户可调用） |

## 详细对比

| 特征 | 双模式型 Skill | 参考型 Skill | 任务型 Skill |
|------|---------------|-------------|-------------|
| AI自动调用 | ✅ 是 | ✅ 是 | ❌ 否 |
| 用户手动调用 | ✅ 是 (`/命令`) | ❌ 否 | ✅ 是 (`/命令`) |
| 适用场景 | 通用技能 | 纯知识/规范 | 敏感操作/部署 |
| 权限配置 | 只读或读写 | 只读权限 | 读写权限 |
| 副作用 | 可选 | 无 | 可能有 |
| user-invocable | 必须设置 `true` | 不需要 | 必须设置 `true` |
| disable-model-invocation | 不设置 | 不设置 | 必须设置 `true` |
| 推荐度 | ⭐⭐⭐ 推荐 | ⭐⭐ 特定场景 | ⭐⭐ 特定场景 |

## 配置示例

### 双模式型（推荐）
```yaml
---
name: skill-name
description: 功能描述 + 执行方式 + 触发场景
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
---
```

### 参考型（纯知识）
```yaml
---
name: skill-name
description: 功能描述 + 执行方式 + 触发场景
allowed-tools:
  - Read
  - Grep
  - Glob
---
```

### 任务型（敏感操作）
```yaml
---
name: skill-name
description: 功能描述 + 执行方式 + 触发场景
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
---
```

---

# 双模式 Skill 规范 {#双模式-skill-规范}

## 核心特征

- **触发方式**：双模式触发，AI 识别相关话题时自动加载，用户也可通过 `/命令` 主动触发
- **适用场景**：大多数技能，既可提供知识参考，也可执行操作
- **核心特点**：灵活性最高，用户和 AI 都能使用
- **推荐度**：⭐⭐⭐ 默认推荐此类型

## Frontmatter 配置

```yaml
---
name: skill-name
description: 功能描述 + 执行方式 + 触发场景
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
---
```

**关键配置**：
- **必须设置** `user-invocable: true`（允许用户调用）
- **不设置** `disable-model-invocation`（默认允许 AI 自动调用）

## 命名规范

根据主要功能选择：
- **知识导向**：名词+最简词（api-rule、style-guide）
- **操作导向**：动词+最简词（make-app、run-app）

---

# 参考型 Skill 规范 {#参考型-skill-规范}

## 核心特征

- **触发方式**：语义自动触发，当用户讨论相关话题时自动加载
- **适用场景**：规范、知识、风格、约定、API 设计规范、代码风格规范
- **核心特点**：无执行步骤，提供参考信息，无副作用操作

## Frontmatter 配置

```yaml
---
name: skill-name
description: 功能描述 + 执行方式 + 触发场景
allowed-tools:
  - Read
  - Grep
  - Glob
---
```

**注意**：参考型 Skill **不需要** `disable-model-invocation` 和 `user-invocable` 配置

## 命名规范（名词+最简词）

- **词性组合**：名词+最简词，强调知识领域
- **示例**：`api-rule`（API规则）、`style-guide`（风格指南）、`git-flow`（Git流程）
- **记忆口诀**：名词=知识
- **简化原则**：使用最简单的单词（rule、guide、flow），避免复杂词汇

---

# 任务型 Skill 规范 {#任务型-skill-规范}

## 核心特征

- **触发方式**：斜杠命令手动触发，用户必须使用 `/xxx` 命令显式调用
- **适用场景**：**敏感操作**、文件修改、部署、测试、删除等需要用户明确意图的操作
- **核心特点**：包含具体执行步骤和操作指令，可能有副作用，需要用户确认
- **推荐度**：⭐⭐ 仅用于敏感操作场景

## Frontmatter 配置

```yaml
---
name: skill-name
description: 功能描述 + 执行方式 + 触发场景
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
---
```

## 必需字段

| 字段 | 必需 | 说明 |
|------|------|------|
| disable-model-invocation | **是** | 必须设置为 true（禁止 AI 自动调用） |
| user-invocable | **是** | 必须设置为 true（允许用户手动调用） |

## 适用场景判断

**何时使用任务型？**
- 操作可能产生不可逆后果（删除、重置）
- 涉及敏感资源（部署、发布、权限变更）
- 需要用户明确确认意图的操作

**何时使用双模式型？**
- 知识查询、规范参考
- 代码生成（不涉及删除/部署）
- 一般性文件操作（创建、修改）

## 命名规范（动词+最简词）

- **词性组合**：动词+最简词，强调执行动作
- **示例**：`make-app`（创建应用）、`run-app`（运行应用）、`check-code`（检查代码）
- **记忆口诀**：动词=执行
- **简化原则**：使用最简单的单词（make、run、check、fix、test），避免复杂词汇

---

# 命名规则 {#命名规则}

## 基本原则
- 使用小写字母
- 使用连字符分隔单词
- 避免缩写和数字

## 命名示例对比

| 类型 | ✅ 正确 | ❌ 错误 |
|------|---------|---------|
| 参考型 | `api-rule`、`style-guide`、`git-flow` | `APIConvention`, `api_convention`, `api-convention` |
| 任务型 | `make-app`、`run-app`、`check-code` | `CreateApp`, `create_app`, `create-application` |

---

# Description 编写公式 {#description-编写公式}

**标准公式**：`功能描述 + 执行方式 + 触发场景`

## 优化原则：提高自动触发概率

### 1. 关键词覆盖策略
- **同义词覆盖**：包含多个同义词，提高匹配概率
- **场景关键词**：描述用户可能的使用场景

### 2. 触发时机关键词
- 参考型：明确说明何时自动触发
- 任务型：明确说明通过斜杠命令触发

## 示例对比

### 参考型
- ✅ `定义项目 RESTful API 设计规范，包含URL命名、响应格式、状态码与鉴权规则，在编写/审查接口、设计新API、确定请求响应格式时自动使用`
- ❌ `API 规范`（过于简单，触发概率低）

### 任务型
- ✅ `创建符合项目规范的 React 组件，通过斜杠命令触发，用于快速生成标准化组件代码`
- ❌ `创建组件`（过于简单）

---

# 权限控制配置 {#权限控制配置}

## 参考型 Skill（只读）

```yaml
allowed-tools:
  - Read
  - Grep
  - Glob
```

## 任务型 Skill（读写）

### 基础读写权限
```yaml
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
```

### 精确权限控制（推荐）
```yaml
allowed-tools:
  - Read
  - Write
  - Bash(npm run build)
  - Bash(git push)
```

**原则**：不使用 `Bash(*)`，遵循最小权限原则

---

# 上下文注入配置 {#上下文注入配置}

## 概述

上下文注入（Context Injection）允许在 Skill 加载时预执行命令并注入上下文。

## 配置格式

```yaml
context-injection:
  - name: context-name        # 上下文标识符（唯一）
    command: shell-command    # 要执行的命令
    description: 用途说明      # 该上下文的用途描述
```

## 设计原则

### 1. 相关性原则
注入的上下文应与 Skill 的知识领域直接相关

### 2. 轻量化原则
命令输出应保持简洁，避免大量输出消耗 Token

### 3. 容错性原则
命令应具备容错能力，避免因环境差异导致加载失败

```yaml
# ✅ 正确：提供默认值
context-injection:
  - name: lint-config
    command: cat .eslintrc.* 2>/dev/null || echo "No lint config"
    description: lint 配置
```

### 4. 安全性原则
避免注入敏感信息，对敏感数据进行脱敏处理

---

# 目录结构标准 {#目录结构标准}

```
.claude/skills/
├── [skill-name]/
│   ├── SKILL.md          # 主入口文件（必需，≤500行）
│   ├── reference.md      # 参考文档（可选）
│   ├── examples.md       # 示例文档（可选）
│   ├── theories/         # 理论文件（可选）
│   └── templates/        # 模板文件（可选）
```

## 文件职责（遵循单一职责原则）
- **SKILL.md**：智能路由器，只负责路由和核心提示
- **reference.md**：详细规范，只负责规范说明
- **examples.md**：示例文档，只负责示例展示
- **theories/**：理论文件，只负责理论阐述
- **templates/**：模板文件，只负责模板定义

---

# 最佳实践建议 {#最佳实践建议}

## 1. 遵循渐进式披露原则
SKILL.md 定位为智能路由器，只包含核心提示和路由表

## 2. 遵循单一职责原则
每个文件只负责一个明确的功能领域

## 3. 遵循依赖抽象原则
技能依赖功能接口而非具体技能名称，详见 [依赖抽象原则](./theories/dependency-inversion.md)

## 4. 遵循最小权限原则
精确授权到子命令，不使用 `Bash(*)`

## 5. 合理拆分内容
- 高频核心语义 → SKILL.md（内联）
- 低频细节、示例、数据 → reference.md、examples.md（外置）
- 核心理论 → theories/（独立管理）
- 可复用模板 → templates/

## 6. 定期维护更新
随着项目发展，及时更新 Skill 内容以保持其有效性

## 7. 遵循行数规范
- SKILL.md：≤500 行
- reference.md、examples.md：按需设置

---

# cc-switch 技能管理工具 {#cc-switch-技能管理工具}

## ⚠️ 关键原则

**任何技能的名称和描述更新后，必须同步更新 cc-switch 数据库！**

cc-switch 使用 SQLite 数据库管理技能信息，**不会自动从 SKILL.md 同步**，需要手动执行数据库更新。

---

## cc-switch 架构

| 项目 | 说明 |
|------|------|
| npm 包 | `@aravhawk/cc-switch` |
| 数据库位置 | `~/.cc-switch/cc-switch.db`（SQLite） |
| 技能表 | `skills` |
| 关键字段 | `name`, `description`, `directory`, `id`, `enabled_claude` |

---

## skills 表结构

```sql
CREATE TABLE skills (
    id TEXT PRIMARY KEY,           -- 技能ID，格式：local:<name>
    name TEXT NOT NULL,            -- 技能名称
    description TEXT,              -- 技能描述（从 SKILL.md frontmatter）
    directory TEXT NOT NULL,       -- 技能目录名
    repo_owner TEXT,               -- 来源仓库 owner（本地技能为 NULL）
    repo_name TEXT,                -- 来源仓库 name（本地技能为 NULL）
    repo_branch TEXT DEFAULT 'main',
    readme_url TEXT,
    enabled_claude BOOLEAN NOT NULL DEFAULT 0,
    enabled_codex BOOLEAN NOT NULL DEFAULT 0,
    enabled_gemini BOOLEAN NOT NULL DEFAULT 0,
    enabled_opencode BOOLEAN NOT NULL DEFAULT 0,
    installed_at INTEGER NOT NULL DEFAULT 0
);
```

---

## 常用更新操作

### 更新技能名称

```python
import sqlite3
conn = sqlite3.connect('~/.cc-switch/cc-switch.db')
cursor = conn.cursor()
cursor.execute('UPDATE skills SET name = ?, directory = ?, id = ? WHERE name = "old-name"',
               ('new-name', 'new-name', 'local:new-name'))
conn.commit()
conn.close()
```

### 更新技能描述

```python
import sqlite3
import re

conn = sqlite3.connect('~/.cc-switch/cc-switch.db')
cursor = conn.cursor()

# 从 SKILL.md 提取 description
skill_path = '~/.agents/skills/<skill-name>/SKILL.md'
with open(skill_path, 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'description:\s*(.+?)\n', content)
if match:
    description = match.group(1).strip()
    cursor.execute('UPDATE skills SET description = ? WHERE name = "<skill-name>"', (description,))
    conn.commit()
conn.close()
```

---

## 常见问题

### 问题：cc-switch 中看不到技能描述

**原因**：cc-switch 导入技能时未正确解析 SKILL.md frontmatter，导致 description 字段为 NULL

**解决方案**：手动从 SKILL.md 提取 description 并更新数据库

```bash
# 查询验证
python -c "
import sqlite3
conn = sqlite3.connect('~/.cc-switch/cc-switch.db')
cursor = conn.cursor()
cursor.execute('SELECT name, description FROM skills WHERE description IS NULL')
print([r[0] for r in cursor.fetchall()])
"
```

---

# 技能仓库同步规范 {#技能仓库同步规范}

## 仓库位置

| 项目 | 路径 | 说明 |
|------|------|------|
| 本地技能目录 | `C:\Users\JOMOO\.agents\skills` | Claude Code 实际使用的技能 |
| 技能仓库 | `D:\TraeProjects\agent-skills` | Git 管理的技能仓库 |

## 同步触发条件

以下操作完成后必须检查并同步：
- 创建新技能 → 检查仓库是否已有，没有则添加
- 修改技能文件 → 同步到仓库对应目录
- 删除技能 → 从仓库移除对应目录

## 同步操作

```bash
# 单文件同步
cp [本地技能路径]/[文件] [仓库路径]/skills/[技能名]/

# 整个技能目录同步
cp -r [本地技能路径]/[技能名] [仓库路径]/skills/
```

## README.md 更新

当新增或删除技能时，更新 `D:\TraeProjects\agent-skills\README.md` 的技能列表表格。

## 同步检查清单

- [ ] 技能文件已复制到仓库对应目录
- [ ] 仓库 README.md 技能列表已更新（如有新增/删除）
- [ ] 确认仓库中文件内容与本地一致