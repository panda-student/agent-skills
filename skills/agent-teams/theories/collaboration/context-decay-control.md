# 上下文腐化控制理论 v2.2（简化版）

> 基于 v2.1 评审结果简化，移除持续性心跳和选举机制，保留 WAL + 检查点核心机制。

## 1. 核心定义

上下文腐化控制理论定义了在长时间运行任务中保持上下文质量和一致性的理论框架。

## 2. 设计原则

### 2.1 事件驱动原则

**所有触发条件必须可检测且可执行**：

| 触发条件 | 类型 | 检测方式 | 动作 |
|---------|------|---------|------|
| 阶段完成 | 事件驱动 | 调度器事件 | 创建检查点 + 写入状态 |
| 质量门通过 | 事件驱动 | 验证成功 | 创建检查点 |
| 任务完成 | 事件驱动 | 任务结束 | 写入 WAL + 更新状态 |
| 状态变更 | 事件驱动 | 操作发生 | 写入 WAL |
| 用户请求 | 显式触发 | `/checkpoint save` | 创建检查点 |

**已移除**：~~上下文>70%~~、~~定时触发~~、~~心跳超时~~、~~选举~~

### 2.2 三层分层原则

```
┌─────────────────────────────────────────────────────────────┐
│ L0 核心层 - 永不腐化                                         │
│ • 任务目标、成功标准、约束条件                                │
│ • 核心决策索引                                               │
│ 存储：core/ 目录                                             │
├─────────────────────────────────────────────────────────────┤
│ L1 活跃层 - 阶段结束时压缩                                   │
│ • 当前执行状态、近期操作摘要                                  │
│ • 待处理问题                                                 │
│ 存储：active/ 目录，Leader 写入                              │
├─────────────────────────────────────────────────────────────┤
│ L2 历史层 - 只保留索引                                       │
│ • 已完成工作摘要、历史检查点引用                              │
│ 存储：history/ 目录                                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 WAL 持久化原则

**状态变更立即写入 WAL，确保数据不丢失**：

```
状态变更流程：
1. 构造 WAL 条目（JSON格式）
2. 追加写入 WAL 文件
3. 更新内存缓冲区
4. 检查是否触发批量写入

即使崩溃，也可从 WAL 恢复
```

### 2.4 简化并发原则

**Worker 独立 + Leader 统一**：

```
┌─────────────────────────────────────────────────────────────┐
│                   简化并发架构                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │  Worker-1   │   │  Worker-2   │   │  Worker-3   │       │
│  │  独立WAL    │   │  独立WAL    │   │  独立WAL    │       │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘       │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │workers/a1/  │   │workers/a2/  │   │workers/a3/  │       │
│  │ status.yaml │   │ status.yaml │   │ status.yaml │       │
│  │ wal.log     │   │ wal.log     │   │ wal.log     │       │
│  └─────────────┘   └─────────────┘   └─────────────┘       │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                  │
│                           ▼                                  │
│                  ┌─────────────────┐                        │
│                  │  Leader         │  ← 调度器指定          │
│                  │  (并行调度器)    │                        │
│                  └────────┬────────┘                        │
│                           │                                  │
│                           ▼                                  │
│                  ┌─────────────────┐                        │
│                  │ active/         │                        │
│                  │ state.yaml      │                        │
│                  └─────────────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**关键设计**：
- Leader 由调度器指定，无需选举
- Worker 写入独立文件，无冲突
- Leader 在阶段完成时合并状态

## 3. 核心机制

### 3.1 WAL 持久化机制

```yaml
# WAL 文件格式（每行一个 JSON）
# workers/[agent-id]/wal.log

{"ts":"2026-03-25T10:30:00Z","seq":1,"type":"task_start","data":{"task":"task-1"}}
{"ts":"2026-03-25T10:30:05Z","seq":2,"type":"progress","data":{"percent":10}}
{"ts":"2026-03-25T10:30:10Z","seq":3,"type":"task_complete","data":{"task":"task-1"}}
{"ts":"2026-03-25T10:30:15Z","seq":4,"type":"decision","data":{"id":"D001","content":"使用JWT"}}

# WAL 条目字段
fields:
  ts: "ISO时间戳"
  seq: "递增序列号"
  type: "操作类型"
  data: "操作数据"

# 操作类型列表
types:
  - task_start      # 任务开始
  - task_complete   # 任务完成
  - progress        # 进度更新
  - decision        # 决策记录
  - error           # 错误记录
  - file_modify     # 文件修改
```

### 3.2 检查点机制

```yaml
# 检查点结构
checkpoint:
  id: "cp-001"
  type: "phase_complete"       # phase_complete | quality_gate | manual
  timestamp: "2026-03-25T10:30:00Z"

  # 轻量校验
  validation:
    file_size: 1024
    line_count: 50

  # 快照内容
  snapshot:
    mission: { goal: "...", progress: 43 }
    completed: [...]
    pending: [...]
    decisions: [...]

# 保留策略
retention:
  phase_complete: 5            # 最近 5 个
  quality_gate: 3              # 最近 3 个
  manual: 2                    # 最近 2 个
```

### 3.3 批量写入机制

```yaml
# 批量写入策略
batch_write:
  buffer_size: 10              # 缓冲区大小

  # 触发条件
  triggers:
    - phase_complete           # 阶段完成
    - quality_gate_pass        # 质量门通过
    - buffer_full              # 缓冲区满
    - user_request             # 用户请求

  # 写入流程
  flow:
    1_merge: "合并所有 Worker 状态"
    2_write_temp: "写入临时文件"
    3_commit: "原子重命名为 state.yaml"
    4_cleanup_wal: "清理已处理的 WAL"
```

### 3.4 状态合并机制

```yaml
# 合并策略
merge_strategy:
  # 数值求和
  tasks_completed: sum
  files_modified_count: sum

  # 取最大值
  progress_percentage: max

  # 取最新值
  current_phase: latest
  current_stage: latest

  # 合并去重
  files_modified: merge_unique
  decisions: merge_unique
```

## 4. 触发矩阵（全自动）

> 所有触发条件由AI自动检测，无需用户干预。

| 事件 | WAL | 检查点 | 状态写入 | 自动检测方式 |
|------|-----|--------|---------|-------------|
| 状态变更 | ✅ 立即 | - | - | 操作发生时自动检测 |
| 任务完成 | ✅ | - | ✅ 批量 | Agent报告完成状态 |
| 缓冲区满 | - | - | ✅ 批量 | buffer_count >= 10 |
| 阶段完成 | ✅ | ✅ | ✅ 强制 | 任务树遍历判断 |
| 质量门通过 | ✅ | ✅ | ✅ 强制 | 验证命令返回值判断 |

### 自动触发原则

```yaml
auto_trigger_principle:
  rule: "事件驱动，自动执行"
  principle: "AI检测到触发条件后自动执行对应动作，用户无感知"

  user_experience:
    - 用户只需输入任务
    - 系统自动保存进度
    - 崩溃后自动恢复
    - 全程无需手动命令
```

## 5. 文件结构

```
.claude/context/
│
├── core/                          # L0 核心层
│   ├── mission.md                 # 任务目标
│   ├── constraints.md             # 约束条件
│   └── decisions.md               # 决策日志
│
├── active/                        # L1 活跃层
│   ├── state.yaml                 # 全局状态（Leader写入）
│   └── pending.md                 # 待办事项
│
├── history/                       # L2 历史层
│   ├── checkpoints/               # 检查点
│   │   ├── cp-001.yaml
│   │   └── cp-002.yaml
│   └── summaries/                 # 阶段摘要
│
├── workers/                       # Worker 独立状态
│   ├── agent-1/
│   │   ├── status.yaml            # 状态文件
│   │   └── wal.log                # WAL 日志
│   └── agent-2/
│       ├── status.yaml
│       └── wal.log
│
└── index.md                       # 上下文索引
```

## 6. 操作模板

### 6.1 WAL 写入模板

```markdown
## WAL 写入步骤（每次状态变更时执行）

**步骤 1：读取序列号**
- 读取 workers/[agent-id]/status.yaml 中的 last_seq
- 新序列号 = last_seq + 1

**步骤 2：构造 WAL 条目**
```json
{"ts":"当前ISO时间","seq":新序列号,"type":"操作类型","data":{操作数据}}
```

**步骤 3：追加写入**
- 追加到 workers/[agent-id]/wal.log 末尾

**步骤 4：更新状态文件**
- 更新 status.yaml 中的 last_seq

**步骤 5：检查触发**
- 如果缓冲区 >= 10 条，通知 Leader
```

### 6.2 检查点创建模板

```markdown
## 检查点创建步骤（阶段完成时执行）

**步骤 1：读取状态**
- 读取 active/state.yaml
- 读取所有 workers/[id]/status.yaml

**步骤 2：合并状态**
- 按合并策略合并所有状态

**步骤 3：生成检查点**
- 分配 ID：cp-XXX
- 记录类型和时间戳

**步骤 4：计算校验**
- 记录文件大小和行数

**步骤 5：写入文件**
- 写入 history/checkpoints/cp-XXX.yaml

**步骤 6：更新索引**
- 更新 index.md

**步骤 7：清理旧检查点**
- 按保留策略清理
```

### 6.3 状态恢复模板

```markdown
## 从 WAL 恢复步骤

**步骤 1：读取 WAL**
- 读取 workers/[agent-id]/wal.log

**步骤 2：找到未处理条目**
- 读取 status.yaml 中的 last_processed_seq
- 筛选 seq > last_processed_seq 的条目

**步骤 3：重放条目**
- 按 seq 顺序执行操作
- 更新内存状态

**步骤 4：更新状态**
- 写入 status.yaml
- 更新 last_processed_seq

---

## 从检查点恢复步骤

**步骤 1：列出检查点**
- 读取 history/checkpoints/ 目录
- 按时间降序排列

**步骤 2：校验检查点**
- 检查必填字段
- 验证文件大小

**步骤 3：读取内容**
- 解析 snapshot 数据

**步骤 4：合并最新状态**
- 扫描所有 Worker 状态
- 合并到恢复的状态

**步骤 5：继续执行**
- 更新 active/state.yaml
- 开始执行
```

## 7. 效果指标

| 指标 | 无控制 | v2.2 简化版 | 改善 |
|------|--------|------------|------|
| 数据丢失风险 | 高 | 低（WAL） | ✅ |
| 并发冲突 | 有 | 无（独立文件） | ✅ |
| I/O 开销 | 高 | 低（批量写入） | ✅ |
| 操作复杂度 | - | 中（模板化） | 可接受 |
| 架构复杂度 | - | 低（移除心跳选举） | ✅ |

## 8. 最佳实践

1. **状态变更立即写 WAL**，确保数据不丢失
2. **阶段完成时创建检查点**，作为稳定恢复点
3. **Leader 由调度器指定**，无需选举
4. **使用操作模板**，按步骤执行
5. **定期清理旧检查点**，避免文件累积