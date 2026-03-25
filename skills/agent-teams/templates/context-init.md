# 上下文初始化模板

> 用于初始化上下文管理器的目录结构和文件模板。

## 目录初始化

```bash
# 创建上下文管理目录
mkdir -p .claude/context/core
mkdir -p .claude/context/active
mkdir -p .claude/context/history/checkpoints
mkdir -p .claude/context/history/summaries
mkdir -p .claude/context/workers
```

## 核心文件模板

### core/mission.md

```markdown
# 任务目标

## 任务ID
mission-001

## 目标描述
[描述任务目标]

## 成功标准
- [ ] 标准1
- [ ] 标准2
- [ ] 标准3

## 开始时间
[ISO时间戳]

## 预计完成
[ISO时间戳]
```

### core/constraints.md

```markdown
# 约束条件

## 技术约束
- [约束1]
- [约束2]

## 业务约束
- [约束1]
- [约束2]

## 不可变规则
- [规则1]
- [规则2]
```

### core/decisions.md

```markdown
# 决策日志

## 决策统计
- 总数: 0
- 已采纳: 0
- 待定: 0

---

## 决策列表

（暂无决策）
```

### active/state.yaml

```yaml
version: 1
last_updated: "[ISO时间戳]"
leader_id: ""

mission:
  id: ""
  goal: ""
  type: ""
  status: "pending"

execution:
  phase: ""
  stage: ""
  started_at: ""

progress:
  total_tasks: 0
  completed: 0
  in_progress: 0
  pending: 0
  percentage: 0

workers: []

decisions: []

files_modified: []

metrics:
  time_elapsed_minutes: 0
```

### index.md

```markdown
# 上下文索引

## 快速导航

| 层级 | 文件 | 内容 | 更新时间 |
|------|------|------|---------|
| L0 | [core/mission.md](core/mission.md) | 任务目标 | - |
| L0 | [core/constraints.md](core/constraints.md) | 约束条件 | - |
| L0 | [core/decisions.md](core/decisions.md) | 决策日志 | - |
| L1 | [active/state.yaml](active/state.yaml) | 当前状态 | - |
| L2 | [history/checkpoints/](history/checkpoints/) | 检查点 | - |

## 任务概览
- **目标**: [待填写]
- **状态**: pending
- **进度**: 0%

## 最近检查点
（暂无检查点）
```

## Worker 状态模板

### workers/[agent-id]/status.yaml

```yaml
agent_id: "[agent-id]"
role: ""
status: "idle"
last_updated: "[ISO时间戳]"

last_seq: 0
last_processed_seq: 0

current_task: null

progress:
  tasks_completed: 0
  percentage: 0
  files_modified: []

buffer_count: 0
```

## WAL 文件

### workers/[agent-id]/wal.log

```
（空文件，追加写入 WAL 条目）
```

## 初始化命令

```bash
# 初始化上下文目录
/init-context

# 或手动执行
mkdir -p .claude/context/{core,active,history/{checkpoints,summaries},workers}
```