# 上下文管理器 v2.2（简化版）

> 基于 v2.1 评审结果简化，移除持续性心跳和选举机制，专注 WAL + 检查点核心功能。

---

## 1. 版本变更

| 版本 | 主要变更 |
|------|---------|
| v1.0 | 初始设计 |
| v2.0 | 事件驱动、Leader-Writer、批量写入 |
| v2.1 | WAL持久化、心跳选举、操作模板 |
| v2.2 | **简化版**：移除心跳选举，保留 WAL + 检查点 |

---

## 2. 模块架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        上下文管理器 v2.2（简化版）                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        WAL 持久化层                                  │   │
│  │  • 状态变更立即追加写入                                              │   │
│  │  • 崩溃可恢复                                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        批量写入层                                    │   │
│  │  • 内存缓冲区                                                        │   │
│  │  • 事件触发批量写入                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        检查点层                                      │   │
│  │  • 阶段完成时创建                                                    │   │
│  │  • 支持恢复                                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        存储层                                        │   │
│  │  • core/     L0 核心层                                              │   │
│  │  • active/   L1 活跃层                                              │   │
│  │  • history/  L2 历史层                                              │   │
│  │  • workers/  Worker 独立状态                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心功能

### 3.1 功能清单

| 功能 | 描述 | 触发方式 |
|------|------|---------|
| **WAL 写入** | 状态变更追加写入日志 | 状态变更时 |
| **检查点管理** | 创建、校验、恢复检查点 | 阶段完成/用户请求 |
| **状态外化** | 批量写入状态到文件 | 缓冲区满/阶段完成 |
| **状态合并** | 合并所有 Worker 状态 | Leader 执行 |

### 3.2 文件结构

```
.claude/context/
│
├── core/                          # L0 核心层
│   ├── mission.md                 # 任务目标
│   ├── constraints.md             # 约束条件
│   └── decisions.md               # 决策日志
│
├── active/                        # L1 活跃层
│   ├── state.yaml                 # 全局状态
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

---

## 4. WAL 持久化机制

### 4.1 WAL 文件格式

```
# workers/[agent-id]/wal.log
# 每行一个 JSON 条目，追加写入

{"ts":"2026-03-25T10:30:00Z","seq":1,"type":"task_start","data":{"task":"task-1"}}
{"ts":"2026-03-25T10:30:05Z","seq":2,"type":"progress","data":{"percent":10}}
{"ts":"2026-03-25T10:30:10Z","seq":3,"type":"task_complete","data":{"task":"task-1"}}
{"ts":"2026-03-25T10:30:15Z","seq":4,"type":"decision","data":{"id":"D001","content":"使用JWT"}}
```

### 4.2 WAL 操作类型

| 类型 | 说明 | data 字段 |
|------|------|----------|
| `task_start` | 任务开始 | task_id, task_name |
| `task_complete` | 任务完成 | task_id, result |
| `progress` | 进度更新 | percent, message |
| `decision` | 决策记录 | id, content, reason |
| `error` | 错误记录 | error_type, message |
| `file_modify` | 文件修改 | file_path, action |

### 4.3 WAL 写入步骤

```markdown
## WAL 写入（每次状态变更时执行）

### 步骤 1：读取序列号
```
读取 workers/[agent-id]/status.yaml
获取 last_seq 字段
新序列号 = last_seq + 1
```

### 步骤 2：构造 JSON 条目
```json
{
  "ts": "2026-03-25T10:30:00Z",
  "seq": 15,
  "type": "task_complete",
  "data": {
    "task_id": "task-1",
    "result": "完成前端登录页面"
  }
}
```

### 步骤 3：追加写入 WAL
```
追加到 workers/[agent-id]/wal.log 文件末尾
确保单行写入（不含多余换行）
```

### 步骤 4：更新状态文件
```yaml
# 更新 workers/[agent-id]/status.yaml
last_seq: 15
last_updated: "2026-03-25T10:30:00Z"
```

### 步骤 5：检查触发条件
```
读取 buffer_count（从状态文件或内存）
如果 buffer_count >= 10：
    通知 Leader 进行状态同步
```
```

### 4.4 WAL 恢复步骤

```markdown
## 从 WAL 恢复（Worker 崩溃后重启）

### 步骤 1：读取 WAL 文件
```
读取 workers/[agent-id]/wal.log
逐行解析 JSON 条目
```

### 步骤 2：找到未处理条目
```
读取 status.yaml 中的 last_processed_seq
筛选 seq > last_processed_seq 的条目
```

### 步骤 3：重放条目
```
按 seq 升序排列
依次执行每个 type 对应的操作：
- task_start: 更新当前任务
- task_complete: 更新完成列表
- progress: 更新进度
- decision: 追加决策
```

### 步骤 4：更新状态
```
写入更新后的 status.yaml
更新 last_processed_seq 为最大 seq
```
```

---

## 5. 检查点机制

### 5.1 检查点文件格式

```yaml
# history/checkpoints/cp-001.yaml
id: "cp-001"
type: "phase_complete"           # phase_complete | quality_gate | manual
timestamp: "2026-03-25T10:30:00Z"

# 轻量校验
validation:
  file_size: 1024
  line_count: 50

# 快照内容
snapshot:
  mission:
    goal: "实现用户登录功能"
    status: "in_progress"
    progress: 43

  execution:
    phase: "development"
    stage: "backend"
    started_at: "2026-03-25T10:00:00Z"

  progress:
    total_tasks: 7
    completed: 3
    in_progress: 2
    pending: 2
    percentage: 43

  completed:
    - id: "task-1"
      name: "需求分析"
      result: "完成用户故事"
    - id: "task-2"
      name: "API设计"
      result: "完成登录接口设计"

  pending:
    - id: "task-3"
      name: "前端开发"
      status: "in_progress"
    - id: "task-4"
      name: "后端开发"
      status: "pending"

  decisions:
    - id: "D001"
      content: "使用JWT认证"
    - id: "D002"
      content: "使用bcrypt加密"

  files_modified:
    - "src/api/auth.ts"
    - "docs/api-design.md"

  metrics:
    time_elapsed_minutes: 30
```

### 5.2 检查点创建步骤

```markdown
## 检查点创建（阶段完成时执行）

### 步骤 1：读取当前状态
```
读取 active/state.yaml
读取所有 workers/[id]/status.yaml
```

### 步骤 2：合并状态
```
按合并策略合并：
- tasks_completed: sum
- progress_percentage: max
- files_modified: merge_unique
- decisions: merge_unique
```

### 步骤 3：生成检查点 ID
```
列出 history/checkpoints/ 目录
获取最大编号 N
新 ID = cp-{N+1}（如 cp-003）
```

### 步骤 4：记录元信息
```
type: phase_complete | quality_gate | manual
timestamp: 当前 ISO 时间
```

### 步骤 5：计算校验
```
序列化为 YAML 字符串
计算文件大小（字节数）
计算行数
```

### 步骤 6：写入文件
```
写入 history/checkpoints/cp-XXX.yaml
```

### 步骤 7：更新索引
```
更新 index.md 中的检查点列表
```

### 步骤 8：清理旧检查点
```
按保留策略：
- phase_complete: 保留最近 5 个
- quality_gate: 保留最近 3 个
- manual: 保留最近 2 个
删除超出数量的旧检查点
```
```

### 5.3 检查点恢复步骤

```markdown
## 从检查点恢复

### 步骤 1：列出检查点
```
读取 history/checkpoints/ 目录
按 timestamp 降序排列
```

### 步骤 2：校验检查点
```
读取检查点文件
检查必填字段：id, type, timestamp, snapshot
验证 file_size 和 line_count（可选）
```

### 步骤 3：读取快照
```
解析 snapshot 数据
```

### 步骤 4：合并最新状态
```
扫描所有 workers/[id]/status.yaml
读取 WAL 中未处理的条目
合并到快照状态
```

### 步骤 5：恢复全局状态
```
写入 active/state.yaml
更新 index.md
```

### 步骤 6：继续执行
```
根据恢复的状态继续任务执行
```
```

---

## 6. 批量写入机制

### 6.1 写入触发条件

| 触发条件 | 检测方式 | 动作 |
|---------|---------|------|
| 缓冲区满 | 计数 >= 10 | 批量写入状态文件 |
| 阶段完成 | 调度器事件 | 强制写入 + 创建检查点 |
| 质量门通过 | 验证成功 | 强制写入 + 创建检查点 |
| 用户请求 | `/checkpoint save` | 强制写入 + 创建检查点 |

### 6.2 原子写入流程

```markdown
## 状态文件写入（Leader 执行）

### 步骤 1：准备变更数据
```
收集所有 Worker 的缓冲区条目
按合并策略合并状态
```

### 步骤 2：构造新状态
```
读取当前 version
新 version = version + 1
构造完整状态数据
```

### 步骤 3：写入临时文件
```
序列化为 YAML
写入 active/.state.tmp.yaml
```

### 步骤 4：校验临时文件
```
检查文件大小 > 0
检查必填字段存在
```

### 步骤 5：原子提交
```
重命名 .state.tmp.yaml → state.yaml
（文件系统保证原子性）
```

### 步骤 6：通知清理 WAL
```
通知各 Worker 清理已处理的 WAL 条目
保留最近 10 条用于审计
```
```

---

## 7. 状态合并机制

### 7.1 合并规则

```yaml
# 字段级合并规则
merge_rules:
  # 数值求和
  sum:
    - tasks_completed
    - files_modified_count

  # 取最大值
  max:
    - progress_percentage

  # 取最新值
  latest:
    - current_phase
    - current_stage
    - last_updated

  # 合并去重
  merge_unique:
    - files_modified
    - decisions
    - errors_resolved
```

### 7.2 合并示例

```yaml
# Worker-1 状态
tasks_completed: 2
progress_percentage: 30
files_modified:
  - src/api/auth.ts
decisions:
  - id: D001
    content: 使用JWT

# Worker-2 状态
tasks_completed: 1
progress_percentage: 20
files_modified:
  - src/components/Login.tsx
decisions:
  - id: D002
    content: 使用bcrypt

# 合并后
tasks_completed: 3              # sum
progress_percentage: 30         # max
files_modified:                 # merge_unique
  - src/api/auth.ts
  - src/components/Login.tsx
decisions:                      # merge_unique
  - id: D001
    content: 使用JWT
  - id: D002
    content: 使用bcrypt
```

---

## 8. 状态文件格式

### 8.1 全局状态文件

```yaml
# active/state.yaml
version: 5
last_updated: "2026-03-25T10:30:00Z"
leader_id: "agent-1"

mission:
  id: "mission-001"
  goal: "实现用户登录功能"
  type: "development"
  status: "in_progress"

execution:
  phase: "development"
  stage: "backend"
  started_at: "2026-03-25T10:00:00Z"

progress:
  total_tasks: 7
  completed: 3
  in_progress: 2
  pending: 2
  percentage: 43

workers:
  - id: "agent-1"
    role: "leader"
    status: "coordinating"
    last_updated: "2026-03-25T10:30:00Z"
  - id: "agent-2"
    role: "frontend-dev"
    status: "coding"
    last_updated: "2026-03-25T10:29:55Z"

decisions:
  - id: "D001"
    content: "使用JWT认证"
  - id: "D002"
    content: "使用bcrypt加密"

files_modified:
  - "src/api/auth.ts"
  - "docs/api-design.md"

metrics:
  time_elapsed_minutes: 30
```

### 8.2 Worker 状态文件

```yaml
# workers/[agent-id]/status.yaml
agent_id: "agent-2"
role: "frontend-dev"
status: "coding"
last_updated: "2026-03-25T10:30:00Z"

# WAL 相关
last_seq: 15                    # 最后写入的 WAL 序列号
last_processed_seq: 12          # 已处理的 WAL 序列号

# 当前任务
current_task:
  id: "task-3"
  name: "前端开发"
  started_at: "2026-03-25T10:15:00Z"

# 进度
progress:
  tasks_completed: 1
  percentage: 30
  files_modified:
    - "src/components/Login.tsx"

# 缓冲区
buffer_count: 3                 # 当前缓冲区计数
```

---

## 9. 自动触发逻辑（全自动）

> 所有操作全自动执行，无需用户手动干预。

### 9.1 自动触发矩阵

```yaml
auto_trigger_matrix:
  # 阶段完成 → 自动创建检查点
  phase_complete:
    detect: "调度器检测到并行组全部完成"
    auto_action:
      - 创建检查点 (type: phase_complete)
      - 更新索引
      - 输出提示: "【进度已保存】"

  # 质量门通过 → 自动创建检查点
  quality_gate_pass:
    detect: "所有质量检查命令返回 PASS"
    auto_action:
      - 创建检查点 (type: quality_gate)
      - 输出提示: "【检查点已创建】"

  # 任务完成 → 自动写入WAL
  task_complete:
    detect: "Agent报告任务完成"
    auto_action:
      - 写入 WAL (type: task_complete)
      - 更新 workers/[id]/status.yaml
      - 检查 buffer_count，满则触发同步

  # 状态变更 → 自动写入WAL
  state_change:
    detect: "任何状态变更事件"
    auto_action:
      - 写入 WAL (追加写入)
      - 更新 last_seq

  # 缓冲区满 → 自动同步状态
  buffer_full:
    detect: "buffer_count >= 10"
    auto_action:
      - Leader 执行状态合并
      - 批量写入 active/state.yaml
      - 清理已处理 WAL
      - 重置 buffer_count
```

### 9.2 自动检测逻辑

```yaml
# 阶段完成检测（AI自动执行）
phase_complete_detection:
  trigger: "每次 task_complete 事件后"
  logic:
    1. 读取任务树结构
    2. 获取当前阶段的所有任务
    3. 检查是否所有任务 status ∈ {complete, pending}
    4. 如果是 → 触发 phase_complete

# 质量门通过检测（AI自动执行）
quality_gate_detection:
  trigger: "阶段完成时"
  logic:
    1. 执行质量检查命令 (build, test, lint)
    2. 检查所有命令返回值
    3. 全部通过 → 触发 quality_gate_pass

# 缓冲区满检测（AI自动执行）
buffer_full_detection:
  trigger: "每次 WAL 写入后"
  logic:
    1. 读取 buffer_count
    2. 如果 buffer_count >= 10 → 触发 buffer_full
```

### 9.3 崩溃恢复（全自动）

```yaml
crash_recovery:
  trigger: "任务中断/Agent崩溃后重启"
  auto_action:
    1. 扫描 history/checkpoints/ 获取最新检查点
    2. 读取 workers/[id]/wal.log 获取未处理条目
    3. 从检查点恢复基础状态
    4. 重放 WAL 未处理条目
    5. 更新 active/state.yaml
    6. 输出提示: "【已恢复进度，继续执行】"
```

### 9.4 用户可见输出（仅进度提示）

用户只会看到以下友好提示，无需理解内部机制：

```
【进度已保存】        ← 阶段完成时
【检查点已创建】      ← 质量门通过时
【已恢复进度】        ← 崩溃恢复时
```

---

## 10. 与其他模块集成

### 10.1 与任务分解器集成

```yaml
# 任务分解完成后
on_decompose_complete:
  1. 写入 core/mission.md       # 任务目标
  2. 写入 core/constraints.md   # 约束条件
  3. 初始化 active/state.yaml   # 初始状态
  4. 创建初始检查点             # cp-000
```

### 10.2 与并行调度器集成

```yaml
# 调度器作为 Leader
scheduler_as_leader:
  on_phase_start:
    - 更新 active/state.yaml (phase, stage)

  on_task_assign:
    - 初始化 workers/[id]/status.yaml

  on_phase_complete:
    - 执行状态同步
    - 创建检查点

  on_quality_gate_pass:
    - 创建检查点
```

### 10.3 与 Worker Agent 集成

```yaml
# Worker Agent 行为
worker_behavior:
  on_task_start:
    - 写入 WAL (task_start)
    - 更新 status.yaml

  on_progress_update:
    - 写入 WAL (progress)

  on_task_complete:
    - 写入 WAL (task_complete)
    - 更新 status.yaml

  on_decision:
    - 写入 WAL (decision)
```

---

## 11. 性能优化

### 11.1 I/O 开销

| 操作 | 开销 | 说明 |
|------|------|------|
| WAL 写入 | ~1-5ms | 追加写入，顺序 I/O |
| 检查点创建 | ~10-50ms | 取决于状态大小 |
| 状态合并 | ~5-20ms | 取决于 Worker 数量 |
| WAL 恢复 | ~10-100ms | 取决于条目数量 |

### 11.2 存储开销

| 内容 | 大小估算 |
|------|---------|
| WAL 条目 | ~100-500 bytes/条 |
| 检查点文件 | ~1-10 KB/个 |
| 状态文件 | ~1-5 KB |
| 总计（10个检查点）| ~20-100 KB |

---

## 12. 错误处理

### 12.1 WAL 写入失败

```
处理流程：
1. 重试写入（最多 3 次）
2. 记录错误日志
3. 继续执行（不阻塞主流程）
4. 下次操作时补写
```

### 12.2 检查点创建失败

```
处理流程：
1. 删除临时文件
2. 记录错误日志
3. 继续执行
4. 下个阶段完成时重试
```

### 12.3 恢复失败

```
处理流程：
1. 尝试上一个检查点
2. 如果全部失败，从 core/ 重建
3. 记录恢复日志
```