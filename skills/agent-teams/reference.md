# Agent Teams 详细规范

本文档包含 Agent Teams 技能的完整定义和详细规范。

---

## 核心理论

本技能基于三大核心理论构建，详细内容请参考理论文件：

- **[并行执行理论](./theories/parallel-execution.md)**：在保证质量的前提下，通过最大化并行处理来最短时间完成任务
- **[质量保证理论](./theories/quality-guarantee.md)**：定义在并行执行过程中确保代码质量的理论框架
- **[上下文腐化控制理论](./theories/context-decay-control.md)**：定义长时间运行任务中保持上下文质量的机制（WAL + 检查点）

---

## 一、四大基本元素

### 1.1 团队类型 (Team Type)

定义团队的角色构成和职责范围。

| 类型标识 | 类型名称 | 角色构成 | 适用场景 |
|---------|---------|---------|---------|
| `product` | 产品团队 | 产品经理、需求分析师、用户研究员 | 需求分析、产品规划、用户调研 |
| `dev` | 开发团队 | 技术负责人、前端开发、后端开发、架构师 | 功能开发、代码重构、技术实现 |
| `test` | 测试团队 | 测试负责人、测试工程师、QA工程师 | 测试设计、测试执行、质量保证 |
| `review` | 评审团队 | 评审负责人、代码评审员、安全审计员 | 代码评审、质量检查、安全审计 |
| `ops` | 运维团队 | 运维负责人、DevOps工程师、SRE | 部署发布、监控运维、故障处理 |
| `design` | 设计团队 | 设计负责人、UI设计师、UX设计师 | 界面设计、交互设计、视觉设计 |
| `mixed` | 混合团队 | 根据任务动态组合 | 跨职能协作、复杂项目 |

配置文件：`config/elements/team-types.yaml`

---

### 1.2 协作模式 (Collaboration Mode)

定义团队成员之间的信息流动和协作方式。

| 模式标识 | 模式名称 | 描述 | 信息流向 | 适用场景 |
|---------|---------|------|---------|---------|
| `one-way` | 单向协作 | 信息单向传递，无反馈 | A → B | 任务分配、结果汇报 |
| `two-way` | 双向协作 | 双向沟通，有反馈 | A ↔ B | 问题讨论、方案确认 |
| `network` | 网络协作 | 多对多自由沟通 | A ↔ B ↔ C | 复杂问题、创意讨论 |
| `hierarchical` | 层级协作 | 通过中心节点协调 | A → Lead → B | 大型团队、复杂项目 |
| `pipeline` | 流水线协作 | 顺序传递，各司其职 | A → B → C → D | 标准化流程、CI/CD |
| `parallel` | 并行协作 | 多Agent同时独立执行，结果汇总 | Workers → Lead | 代码评审、代码探索、测试执行 |

配置文件：`config/elements/collaboration-modes.yaml`

---

### 1.3 人机协作模式 (Human-AI Mode)

定义用户参与决策的程度和方式。

| 模式标识 | 模式名称 | 用户参与度 | 描述 | 适用场景 |
|---------|---------|-----------|------|---------|
| `auto` | 全自动模式 | 0% | AI 自主完成所有决策 | 低风险任务、标准化流程 |
| `key-node` | 关键节点确认 | 20% | 用户确认关键决策点 | 常规开发、标准项目 |
| `interactive` | 交互式模式 | 50% | 用户频繁参与决策 | 复杂项目、创新需求 |
| `guided` | 引导式模式 | 80% | AI 辅助，用户主导 | 探索性任务、学习场景 |
| `manual` | 手动模式 | 100% | 用户完全控制 | 高风险操作、关键决策 |

配置文件：`config/elements/human-ai-modes.yaml`

---

### 1.4 流程类型 (Workflow Type)

定义任务执行的顺序和并发方式。

| 类型标识 | 类型名称 | 描述 | 执行方式 | 适用场景 |
|---------|---------|------|---------|---------|
| `serial` | 串行流程 | 任务顺序执行 | A → B → C | 有依赖关系的任务 |
| `parallel` | 并行流程 | 任务同时执行 | A, B, C 同时 | 独立任务 |
| `hybrid` | 混合流程 | 串并行结合 | (A, B) → C | 复杂项目 |
| `iterative` | 迭代流程 | 循环执行直到满足条件 | A → B → [条件] → A | 需要反复调整的任务 |
| `conditional` | 条件流程 | 根据条件选择分支 | A → [条件] → B 或 C | 动态决策场景 |

配置文件：`config/elements/workflow-types.yaml`

---

## 二、预设配置模板

### 2.1 标准开发流程 (standard-dev)

```yaml
team:
  type: dev
  members: [lead:1, frontend:1, backend:1]
collaboration:
  mode: hierarchical
human_ai:
  mode: key-node
workflow:
  type: hybrid
  stages: [需求分析, 开发实现, 集成测试]
```

配置文件：`config/templates/standard-dev.yaml`

---

### 2.2 Bug修复流程 (bug-fix)

```yaml
team:
  type: mixed
  members: [lead:1, dev:2, qa:1]
collaboration:
  mode: network
human_ai:
  mode: interactive
workflow:
  type: iterative
  stages: [问题复现, 根因分析, 假设验证, 修复实施, 验证测试]
```

配置文件：`config/templates/bug-fix.yaml`

---

### 2.3 代码评审流程 (code-review)

```yaml
team:
  type: review
  members: [lead:1, reviewer:2]
collaboration:
  mode: parallel
human_ai:
  mode: key-node
workflow:
  type: conditional
  stages: [评审准备, 评审执行, 评审决策]
```

配置文件：`config/templates/code-review.yaml`

---

### 2.4 全自动CI/CD流程 (auto-cicd)

```yaml
team:
  type: ops
  members: [lead:1, devops:2]
collaboration:
  mode: pipeline
human_ai:
  mode: auto
workflow:
  type: serial
  stages: [代码检出, 代码检查, 构建, 测试, 打包, 部署预发, 部署生产, 通知]
```

配置文件：`config/templates/auto-cicd.yaml`

---

### 2.5 代码探索流程 (code-exploration)

```yaml
team:
  type: mixed
  members: [lead:1, explorer:3]
collaboration:
  mode: network
human_ai:
  mode: guided
workflow:
  type: parallel
  stages: [目录结构, 核心模块, 依赖关系, 配置文件, 入口文件]
```

配置文件：`config/templates/code-exploration.yaml`

---

## 三、配置模板间调用关系

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
            ┌───────────────┐                            │
            │ standard_dev  │                            │
            │   标准开发     │                            │
            │ 输出: 代码实现  │                            │
            └───────┬───────┘                            │
                    │ 开发完成后                          │
                    ▼                                    │
            ┌───────────────┐                            │
            │  code_review  │                            │
            │  代码评审      │                            │
            │ 输出: 评审报告  │                            │
            └───────┬───────┘                            │
                    │                                    │
        ┌───────────┼───────────┐                        │
        │           │           │                        │
        ▼           ▼           ▼                        │
   ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
   │ 通过    │ │ 需修改  │ │ 不通过  │                   │
   │         │ │         │ │         │                   │
   │ 任务完成 │ │ bug_fix │ │standard │                   │
   │         │ │ 修复    │ │  _dev   │                   │
   └─────────┘ └────┬────┘ └────┬────┘                   │
                    │           │                        │
                    ▼           └────────────────────────┘
            ┌───────────────┐
            │   bug_fix     │
            │  Bug修复       │
            │ 输出: 修复代码  │
            └───────┬───────┘
                    │ 修复完成后
                    ▼
            返回 code_review
```

---

## 四、质量保证机制

详细理论请参考 [theories/quality-guarantee.md](theories/quality-guarantee.md)

### 4.1 强制性验证检查

| 检查项 | 优先级 | 命令示例 | 通过标准 |
|--------|--------|----------|----------|
| **代码编译** | P0 | `npm run build` / `mvn compile` | 无编译错误 |
| **类型检查** | P0 | `npm run typecheck` / `tsc --noEmit` | 无类型错误 |
| **代码规范** | P1 | `npm run lint` / `eslint .` | 无规范错误 |
| **单元测试** | P0 | `npm test` / `mvn test` | 所有测试通过 |

### 4.2 验证检查执行原则

1. **强制性**: 所有检查项必须通过，缺一不可
2. **并行性**: 质量检查可并行执行
3. **完整性**: 不能跳过任何检查项
4. **可追溯**: 记录所有检查结果到日志
5. **失败处理**: 任何检查失败必须修复后重新执行所有检查

### 4.3 质量门位置

1. **每个并行组完成后** → 立即验证
2. **阶段转换时** → 验证上一阶段
3. **最终交付前** → 并行执行所有检查

### 4.4 禁止行为

在验证检查通过前，禁止：
1. ❌ 报告任务完成
2. ❌ 提交代码到版本库
3. ❌ 切换到其他配置
4. ❌ 结束当前任务
5. ❌ 忽略验证失败

---

## 五、目录结构

### 5.1 技能目录结构（技能固有配置）

```
skills/agent-teams/                # 技能根目录
├── SKILL.md                       # 技能入口（智能路由）
├── reference.md                   # 详细规范（本文档）
├── examples.md                    # 使用示例
├── config/                        # 技能配置（随技能分发）
│   ├── elements/                  # 基本元素定义
│   │   ├── team-types.yaml        # 团队类型
│   │   ├── collaboration-modes.yaml  # 协作模式
│   │   ├── human-ai-modes.yaml    # 人机协作模式
│   │   └── workflow-types.yaml    # 流程类型
│   └── templates/                 # 预设模板
│       ├── standard-dev.yaml      # 标准开发流程
│       ├── bug-fix.yaml           # Bug修复流程
│       ├── code-review.yaml       # 代码评审流程
│       ├── code-exploration.yaml  # 代码探索流程
│       └── auto-cicd.yaml         # 全自动CI/CD流程
├── engine/                        # 执行引擎
│   ├── README.md                  # 引擎概述
│   ├── task-decomposer.md         # 任务分解器
│   ├── dependency-analyzer.md     # 依赖分析器
│   └── parallel-scheduler.md      # 并行调度器
├── theories/                      # 理论基础
│   ├── parallel-execution.md      # 并行执行理论
│   └── quality-guarantee.md       # 质量保证理论
└── templates/                     # 输出模板
    ├── plan-template.md           # 执行计划模板
    └── report-template.md         # 执行报告模板
```

### 5.2 工作目录结构（运行时生成）

```
.claude/                           # 工作目录根目录（项目级）
├── deliverables/                  # 交付物留存目录
│   ├── requirements/              # 需求文档
│   ├── designs/                   # 设计文档
│   ├── plans/                     # 执行计划
│   ├── reports/                   # 执行报告
│   └── reviews/                   # 评审报告
│
├── logs/                          # 执行日志目录
│   ├── executions/                # 执行日志
│   ├── decisions/                 # 决策日志
│   └── quality/                   # 质量检查日志
│
└── instances/                     # 执行实例数据
    └── [实例ID]/
        ├── instance.yaml          # 实例配置
        ├── status.yaml            # 实例状态
        └── metrics.yaml           # 执行指标
```

---

## 六、动态组合规则

### 6.1 组合决策树

```
任务类型?
├── 开发类 → 团队:dev | 协作:层级 | 人机:关键节点 | 流程:混合
├── 修复类 → 团队:mixed | 协作:网络 | 人机:交互式 | 流程:迭代
├── 评审类 → 团队:review | 协作:并行 | 人机:关键节点 | 流程:条件
├── 探索类 → 团队:mixed | 协作:网络 | 人机:引导式 | 流程:并行
└── 部署类 → 团队:ops | 协作:流水线 | 人机:全自动 | 流程:串行
```

### 6.2 风险调整

| 风险等级 | 人机协作调整 | 流程调整 |
|---------|-------------|---------|
| 高 | interactive | conditional |
| 中 | key-node | hybrid |
| 低 | auto | serial |

### 6.3 团队规模调整

| 规模 | 协作模式调整 |
|------|-------------|
| 小型 (≤3人) | network |
| 中型 (4-6人) | hierarchical |
| 大型 (>6人) | hierarchical + hybrid |

---

## 七、核心设计原则

| 原则 | 描述 |
|------|------|
| **并行优先** | 执行实例时最大化并行处理，在保证质量的前提下最短时间完成任务 |
| **质量优先** | 质量是底线，所有质量门必须通过才能继续 |
| **文件隔离** | 每个Teammate操作不同的文件集，避免冲突 |
| **模块隔离** | 每个Teammate负责不同的模块，职责清晰 |
| **状态同步** | Lead实时监控任务状态，及时处理异常 |
| **灵活组合** | 支持基本元素自由组合，适应不同场景需求 |
