# GSD 配置参考

> 完整配置架构、工作流开关、模型配置文件和 git 分支选项。如需功能背景，请参阅 [功能参考](FEATURES.md)。

---

## 配置文件

GSD 在 `.planning/config.json` 中存储项目设置。在 `/gsd:new-project` 期间创建，通过 `/gsd:settings` 更新。

### 完整架构

```json
{
  "mode": "interactive",
  "granularity": "standard",
  "model_profile": "balanced",
  "model_overrides": {},
  "planning": {
    "commit_docs": true,
    "search_gitignored": false
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": false,
    "nyquist_validation": true,
    "ui_phase": true,
    "ui_safety_gate": true,
    "node_repair": true,
    "node_repair_budget": 2,
    "research_before_questions": false,
    "discuss_mode": "discuss",
    "skip_discuss": false,
    "text_mode": false
  },
  "hooks": {
    "context_warnings": true,
    "workflow_guard": false
  },
  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },
  "git": {
    "branching_strategy": "none",
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "milestone_branch_template": "gsd/{milestone}-{slug}",
    "quick_branch_template": null
  },
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  }
}
```

---

## 核心设置

| 设置 | 类型 | 选项 | 默认值 | 描述 |
|---------|------|---------|---------|-------------|
| `mode` | 枚举 | `interactive`, `yolo` | `interactive` | `yolo` 自动批准决策；`interactive` 在每步确认 |
| `granularity` | 枚举 | `coarse`, `standard`, `fine` | `standard` | 控制阶段数量：`coarse`（3-5），`standard`（5-8），`fine`（8-12） |
| `model_profile` | 枚举 | `quality`, `balanced`, `budget`, `inherit` | `balanced` | 每个 Agent 的模型层级（见 [模型配置文件](#模型配置文件)） |

> **注意：** `granularity` 在 v1.22.3 中从 `depth` 重命名。现有配置会自动迁移。

---

## 工作流开关

所有工作流开关遵循 **缺失 = 启用** 模式。如果配置中缺少某个键，则默认为 `true`。

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `workflow.research` | 布尔值 | `true` | 规划每个阶段前的领域调查 |
| `workflow.plan_check` | 布尔值 | `true` | 计划验证循环（最多3次迭代） |
| `workflow.verifier` | 布尔值 | `true` | 针对阶段目标的执行后验证 |
| `workflow.auto_advance` | 布尔值 | `false` | 自动链式执行 discuss → plan → execute，无需暂停 |
| `workflow.nyquist_validation` | 布尔值 | `true` | 计划阶段研究期间的测试覆盖率映射 |
| `workflow.ui_phase` | 布尔值 | `true` | 为前端阶段生成 UI 设计契约 |
| `workflow.ui_safety_gate` | 布尔值 | `true` | 在计划阶段为前端阶段提示运行 /gsd:ui-phase |
| `workflow.node_repair` | 布尔值 | `true` | 验证失败时的自主任务修复 |
| `workflow.node_repair_budget` | 数值 | `2` | 每个失败任务的最大修复尝试次数 |
| `workflow.research_before_questions` | 布尔值 | `false` | 在讨论问题之前而非之后进行研究 |
| `workflow.discuss_mode` | 字符串 | `'discuss'` | 控制 `/gsd:discuss-phase` 如何收集上下文。`'discuss'`（默认）逐一提问。`'assumptions'` 先读取代码库，生成带有置信度的结构化假设，只要求您纠正错误的部分。v1.28 新增 |
| `workflow.skip_discuss` | 布尔值 | `false` | 当为 `true` 时，`/gsd:autonomous` 完全跳过讨论阶段，从 ROADMAP 阶段目标编写最小化的 CONTEXT.md。适用于开发者偏好已完全记录在 PROJECT.md/REQUIREMENTS.md 中的项目。v1.28 新增 |
| `workflow.text_mode` | 布尔值 | `false` | 用纯文本编号列表替换 AskUserQuestion TUI 菜单。Claude Code 远程会话（`/rc` 模式）必需，因为 TUI 菜单无法渲染。也可以在 discuss-phase 中使用 `--text` 标志按会话设置。v1.28 新增 |

### 推荐预设

| 场景 | mode | granularity | profile | research | plan_check | verifier |
|----------|------|-------------|---------|----------|------------|----------|
| 原型开发 | `yolo` | `coarse` | `budget` | `false` | `false` | `false` |
| 正常开发 | `interactive` | `standard` | `balanced` | `true` | `true` | `true` |
| 生产发布 | `interactive` | `fine` | `quality` | `true` | `true` | `true` |

---

## 规划设置

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `planning.commit_docs` | 布尔值 | `true` | `.planning/` 文件是否提交到 git |
| `planning.search_gitignored` | 布尔值 | `false` | 在广泛搜索中添加 `--no-ignore` 以包含 `.planning/` |

### 自动检测

如果 `.planning/` 在 `.gitignore` 中，无论 config.json 如何设置，`commit_docs` 都会自动变为 `false`。这可以防止 git 错误。

---

## 钩子设置

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `hooks.context_warnings` | 布尔值 | `true` | 通过上下文监控钩子显示上下文窗口使用警告 |
| `hooks.workflow_guard` | 布尔值 | `false` | 当文件编辑发生在 GSD 工作流上下文之外时发出警告（建议使用 `/gsd:quick` 或 `/gsd:fast`） |

提示注入保护钩子（`gsd-prompt-guard.js`）始终处于活动状态，无法禁用——这是一个安全功能，而非工作流开关。

### 私有规划设置

要将规划产物排除在 git 之外：

1. 设置 `planning.commit_docs: false` 和 `planning.search_gitignored: true`
2. 将 `.planning/` 添加到 `.gitignore`
3. 如果之前已跟踪：`git rm -r --cached .planning/ && git commit -m "chore: 停止跟踪规划文档"`

---

## 并行化设置

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `parallelization.enabled` | 布尔值 | `true` | 同时运行独立的计划 |
| `parallelization.plan_level` | 布尔值 | `true` | 在计划级别并行化 |
| `parallelization.task_level` | 布尔值 | `false` | 在计划内并行化任务 |
| `parallelization.skip_checkpoints` | 布尔值 | `true` | 并行执行期间跳过检查点 |
| `parallelization.max_concurrent_agents` | 数值 | `3` | 最大同时运行的 Agent 数 |
| `parallelization.min_plans_for_parallel` | 数值 | `2` | 触发并行执行的最小计划数 |

> **预提交钩子和并行执行**：启用并行化时，执行器 Agent 使用 `--no-verify` 提交，以避免构建锁争用（例如 Rust 项目中的 cargo 锁争斗）。编排器在每波完成后验证一次钩子。STATE.md 写入受文件级锁定保护，防止并发写入损坏。如果需要每次提交都运行钩子，请设置 `parallelization.enabled: false`。

---

## Git 分支

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `git.branching_strategy` | 枚举 | `none` | `none`、`phase` 或 `milestone` |
| `git.phase_branch_template` | 字符串 | `gsd/phase-{phase}-{slug}` | 阶段策略的分支名称模板 |
| `git.milestone_branch_template` | 字符串 | `gsd/{milestone}-{slug}` | 里程碑策略的分支名称模板 |
| `git.quick_branch_template` | 字符串或null | `null` | `/gsd:quick` 任务的可选分支名称模板 |

### 策略比较

| 策略 | 创建分支 | 范围 | 合并点 | 适用场景 |
|----------|---------------|-------|-------------|----------|
| `none` | 从不 | 不适用 | 不适用 | 独立开发，简单项目 |
| `phase` | 在 `execute-phase` 开始时 | 一个阶段 | 用户在阶段后合并 | 每阶段代码审查，细粒度回滚 |
| `milestone` | 在第一个 `execute-phase` | 里程碑中的所有阶段 | 在 `complete-milestone` 时 | 发布分支，每个版本一个 PR |

### 模板变量

| 变量 | 可用于 | 示例 |
|----------|-------------|---------|
| `{phase}` | `phase_branch_template` | `03`（零填充） |
| `{slug}` | 两个模板 | `user-authentication`（小写，连字符） |
| `{milestone}` | `milestone_branch_template` | `v1.0` |
| `{num}` / `{quick}` | `quick_branch_template` | `260317-abc`（快速任务 ID） |

快速任务分支示例：

```json
"git": {
  "quick_branch_template": "gsd/quick-{num}-{slug}"
}
```

### 里程碑完成时的合并选项

| 选项 | Git 命令 | 结果 |
|--------|-------------|--------|
| Squash 合并（推荐） | `git merge --squash` | 每个分支一个干净的提交 |
| 保留历史合并 | `git merge --no-ff` | 保留所有单独提交 |
| 不合并直接删除 | `git branch -D` | 丢弃分支工作 |
| 保留分支 | （无） | 稍后手动处理 |

---

## 门控设置

控制工作流期间的确认提示。

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `gates.confirm_project` | 布尔值 | `true` | 在最终确定前确认项目详情 |
| `gates.confirm_phases` | 布尔值 | `true` | 确认阶段分解 |
| `gates.confirm_roadmap` | 布尔值 | `true` | 在继续前确认路线图 |
| `gates.confirm_breakdown` | 布尔值 | `true` | 确认任务分解 |
| `gates.confirm_plan` | 布尔值 | `true` | 在执行前确认每个计划 |
| `gates.execute_next_plan` | 布尔值 | `true` | 在执行下一个计划前确认 |
| `gates.issues_review` | 布尔值 | `true` | 在创建修复计划前审查问题 |
| `gates.confirm_transition` | 布尔值 | `true` | 确认阶段转换 |

---

## 安全设置

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `safety.always_confirm_destructive` | 布尔值 | `true` | 确认破坏性操作（删除、覆盖） |
| `safety.always_confirm_external_services` | 布尔值 | `true` | 确认外部服务交互 |

---

## 钩子设置

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `hooks.context_warnings` | 布尔值 | `true` | 在会话期间显示上下文窗口使用警告 |

---

## 模型配置文件

### 配置文件定义

| Agent | `quality` | `balanced` | `budget` | `inherit` |
|-------|-----------|------------|----------|-----------|
| gsd-planner | Opus | Opus | Sonnet | 继承 |
| gsd-roadmapper | Opus | Sonnet | Sonnet | 继承 |
| gsd-executor | Opus | Sonnet | Sonnet | 继承 |
| gsd-phase-researcher | Opus | Sonnet | Haiku | 继承 |
| gsd-project-researcher | Opus | Sonnet | Haiku | 继承 |
| gsd-research-synthesizer | Sonnet | Sonnet | Haiku | 继承 |
| gsd-debugger | Opus | Sonnet | Sonnet | 继承 |
| gsd-codebase-mapper | Sonnet | Haiku | Haiku | 继承 |
| gsd-verifier | Sonnet | Sonnet | Haiku | 继承 |
| gsd-plan-checker | Sonnet | Sonnet | Haiku | 继承 |
| gsd-integration-checker | Sonnet | Sonnet | Haiku | 继承 |
| gsd-nyquist-auditor | Sonnet | Sonnet | Haiku | 继承 |

### 单 Agent 覆盖

在不更改整个配置文件的情况下覆盖特定 Agent：

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "gsd-executor": "opus",
    "gsd-planner": "haiku"
  }
}
```

有效覆盖值：`opus`、`sonnet`、`haiku`、`inherit`，或任何完全限定的模型 ID（例如 `"openai/o3"`、`"google/gemini-2.5-pro"`）。

### 非 Claude 运行时（Codex、OpenCode、Gemini CLI）

当为非 Claude 运行时安装 GSD 时，安装程序会自动在 `~/.gsd/defaults.json` 中设置 `resolve_model_ids: "omit"`。这会导致 GSD 为所有 Agent 返回空的模型参数，因此每个 Agent 使用运行时配置的任何模型。默认情况无需额外设置。

如果您希望不同的 Agent 使用不同的模型，请使用您的运行时识别的完全限定模型 ID 进行 `model_overrides`：

```json
{
  "resolve_model_ids": "omit",
  "model_overrides": {
    "gsd-planner": "o3",
    "gsd-executor": "o4-mini",
    "gsd-debugger": "o3",
    "gsd-codebase-mapper": "o4-mini"
  }
}
```

其意图与 Claude 配置层级相同——在规划和调试中使用更强的模型（推理质量最重要），在执行和映射中使用更便宜的模型（计划已包含推理）。

**何时使用哪种方法：**

| 场景 | 设置 | 效果 |
|----------|---------|--------|
| 非 Claude 运行时，单一模型 | `resolve_model_ids: "omit"`（安装程序默认） | 所有 Agent 使用运行时的默认模型 |
| 非 Claude 运行时，分层模型 | `resolve_model_ids: "omit"` + `model_overrides` | 指定 Agent 使用特定模型，其他使用运行时默认 |
| Claude Code 配合 OpenRouter/本地提供商 | `model_profile: "inherit"` | 所有 Agent 遵循会话模型 |
| Claude Code 配合 OpenRouter，分层 | `model_profile: "inherit"` + `model_overrides` | 指定 Agent 使用特定模型，其他继承 |

**`resolve_model_ids` 值：**

| 值 | 行为 | 使用场景 |
|-------|----------|----------|
| `false`（默认） | 返回 Claude 别名（`opus`、`sonnet`、`haiku`） | 配合原生 Anthropic API 的 Claude Code |
| `true` | 将别名映射到完整 Claude 模型 ID（`claude-opus-4-0`） | 配合需要完整 ID 的 API 的 Claude Code |
| `"omit"` | 返回空字符串（运行时选择其默认值） | 非 Claude 运行时（Codex、OpenCode、Gemini CLI） |

### 配置文件理念

| 配置文件 | 理念 | 使用场景 |
|---------|-----------|-------------|
| `quality` | 所有决策使用 Opus，验证使用 Sonnet | 配额充足，关键架构工作 |
| `balanced` | 仅规划使用 Opus，其他全部使用 Sonnet | 正常开发（默认） |
| `budget` | 代码编写使用 Sonnet，研究/验证使用 Haiku | 大量工作，不太关键的阶段 |
| `inherit` | 所有 Agent 使用当前会话模型 | 动态模型切换，**非 Anthropic 提供商**（OpenRouter、本地模型） |

---

## 环境变量

| 变量 | 用途 |
|----------|---------|
| `CLAUDE_CONFIG_DIR` | 覆盖默认配置目录（`~/.claude/`） |
| `GEMINI_API_KEY` | 被上下文监控器检测以切换钩子事件名称 |
| `WSL_DISTRO_NAME` | 被安装程序检测以处理 WSL 路径 |

---

## 全局默认值

为未来项目保存设置为全局默认值：

**位置：** `~/.gsd/defaults.json`

当 `/gsd:new-project` 创建新的 `config.json` 时，它会读取全局默认值并将其合并作为起始配置。每个项目的设置始终覆盖全局设置。
