# GET SHIT DONE (GSD) 使用指南

## 简介

GSD 是一个为 Claude Code 设计的元提示、上下文工程和规格驱动开发系统。它解决了 **context rot** 问题——随着上下文窗口被填满，AI 输出质量逐步下降的问题。

## 核心特性

- **上下文工程**: 自动管理项目上下文，保持输出质量稳定
- **多代理编排**: 研究、规划、执行、验证等专用代理协同工作
- **原子 Git 提交**: 每个任务独立提交，便于追踪和回滚
- **规格驱动开发**: 需求 → 路线图 → 阶段 → 执行 → 验证

---

## 安装

### 全局安装（推荐）

```bash
npx get-shit-done-cc@latest --claude --global
```

### 本地安装（仅当前项目）

```bash
npx get-shit-done-cc@latest --claude --local
```

### 验证安装

```
/gsd:help
```

---

## 工作流程

### 1. 新项目初始化

```
/gsd:new-project
```

系统会：
1. **提问** - 深入理解你的想法（目标、约束、技术偏好）
2. **研究** - 并行代理调研领域知识
3. **需求梳理** - 提取 v1/v2 范围
4. **路线图** - 创建阶段规划

**生成文件**: `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`

### 2. 现有代码库分析

```
/gsd:map-codebase
```

在 `new-project` 前运行，让 GSD 理解你的技术栈、架构和约定。

### 3. 阶段讨论

```
/gsd:discuss-phase 1
```

在规划前收集实现决策，让系统理解你的偏好。

### 4. 阶段规划

```
/gsd:plan-phase 1
```

系统会：
1. 研究实现方式
2. 创建原子化任务计划（XML 结构）
3. 验证计划与需求对照

**生成文件**: `{phase_num}-RESEARCH.md`, `{phase_num}-{N}-PLAN.md`

### 5. 阶段执行

```
/gsd:execute-phase 1
```

系统会：
1. 按 wave 执行计划（并行/顺序）
2. 每个计划使用新上下文
3. 每个任务单独提交
4. 对照目标验证

**生成文件**: `{phase_num}-{N}-SUMMARY.md`, `{phase_num}-VERIFICATION.md`

### 6. 工作验证

```
/gsd:verify-work 1
```

人工验收测试，确认功能是否按预期工作。

### 7. 发布

```
/gsd:ship 1
```

从已验证的工作创建 PR。

---

## 核心命令

### 工作流命令

| 命令 | 说明 |
|------|------|
| `/gsd:new-project` | 初始化新项目 |
| `/gsd:discuss-phase [N]` | 讨论阶段细节 |
| `/gsd:plan-phase [N]` | 规划阶段任务 |
| `/gsd:execute-phase [N]` | 执行阶段任务 |
| `/gsd:verify-work [N]` | 验证工作成果 |
| `/gsd:ship [N]` | 创建 PR 发布 |
| `/gsd:next` | 自动执行下一步 |
| `/gsd:progress` | 查看当前进度 |

### 快速任务

| 命令 | 说明 |
|------|------|
| `/gsd:quick` | 执行临时任务（跳过可选步骤） |
| `/gsd:fast <text>` | 执行琐碎任务（完全跳过规划） |
| `/gsd:do <text>` | 自动路由到正确命令 |

### 里程碑管理

| 命令 | 说明 |
|------|------|
| `/gsd:new-milestone` | 开始新里程碑 |
| `/gsd:complete-milestone` | 完成当前里程碑 |
| `/gsd:audit-milestone` | 审计里程碑完成度 |
| `/gsd:add-phase` | 添加阶段 |
| `/gsd:insert-phase [N]` | 插入紧急阶段 |
| `/gsd:remove-phase [N]` | 删除阶段 |

### 调试与维护

| 命令 | 说明 |
|------|------|
| `/gsd:debug [desc]` | 系统化调试 |
| `/gsd:health` | 检查规划目录健康度 |
| `/gsd:stats` | 显示项目统计 |
| `/gsd:settings` | 配置工作流选项 |

---

## 配置

### 模型 Profile

| Profile | Planning | Execution | Verification |
|---------|----------|-----------|--------------|
| `quality` | Opus | Opus | Sonnet |
| `balanced` (默认) | Opus | Sonnet | Sonnet |
| `budget` | Sonnet | Sonnet | Haiku |
| `inherit` | 继承 | 继承 | 继承 |

切换方式：
```
/gsd:set-profile budget
```

### 工作流设置

通过 `/gsd:settings` 配置：

| 设置 | 默认值 | 说明 |
|------|--------|------|
| `workflow.research` | true | 规划前调研 |
| `workflow.plan_check` | true | 执行前验证计划 |
| `workflow.verifier` | true | 执行后验证交付 |
| `workflow.auto_advance` | false | 自动串联各阶段 |

---

## 文件结构

```
.planning/
├── PROJECT.md          # 项目愿景
├── REQUIREMENTS.md     # 需求规格
├── ROADMAP.md          # 阶段路线图
├── STATE.md            # 当前状态
├── config.json         # 配置文件
├── research/           # 研究文档
├── codebase/           # 代码库映射
├── todos/              # 待办事项
└── quick/              # 快速任务记录
```

---

## 最佳实践

### 1. 推荐启动方式

对于现有代码库：

```
/gsd:map-codebase
/gsd:new-project
```

### 2. 使用自动推进

```
/gsd:next
```

系统会自动检测当前状态并执行下一步。

### 3. 跳过权限确认（推荐）

```bash
claude --dangerously-skip-permissions
```

这是 GSD 的预期用法，避免频繁确认打断工作流。

### 4. 定期更新

```bash
npx get-shit-done-cc@latest
```

GSD 迭代很快，建议定期更新。

---

## 常见问题

### 找不到命令？

- 重启 Claude Code
- 检查 `~/.claude/commands/gsd/` 目录是否存在

### 命令行为不符合预期？

- 运行 `/gsd:help` 确认安装成功
- 重新执行安装命令

### 卸载

```bash
npx get-shit-done-cc --claude --global --uninstall
```

---

## 资源

- **GitHub**: https://github.com/gsd-build/get-shit-done
- **Discord**: https://discord.gg/gsd
- **npm**: https://www.npmjs.com/package/get-shit-done-cc

---

## 版本

当前安装版本: **v1.27.0**