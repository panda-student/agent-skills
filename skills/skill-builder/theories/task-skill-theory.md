# 任务型 Skills 核心理论

## 1. Skill 类型划分

**核心区别：disable-model-invocation 决定 Skill 本质**

| 类型 | disable-model-invocation | 本质 |
|------|-------------------------|------|
| **参考型** | `false` 或不设置 | 知识提供者（Claude 可主动调用） |
| **任务型** | `true` | 动作执行者（必须用户手动触发） |

任务型 Skill 绝不让 Claude 自作主张触发，必须由用户显式调用。

- **参考型 Skill**：不设置 `disable-model-invocation`，作为知识提供者允许 Claude 主动调用，使用名词+最简词命名
- **任务型 Skill**：必须设置 `disable-model-invocation: true`，作为动作执行者仅用户手动触发，使用动词+最简词命名

## 2. 命名规范（动词+最简词）
- **词性组合**：动词+最简词，强调执行动作
- **示例**：`make-app`（创建应用）、`run-app`（运行应用）、`check-code`（检查代码）
- **记忆口诀**：动词=执行
- **命名模式**：`[动作]-[对象]`，如 `build-app`、`fix-bug`、`test-all`
- **简化原则**：使用最简单的单词（make、run、check、fix、test），避免复杂词汇

## 3. Commands 与 Skills 关系
- 斜杠命令已整合为 Skills 子集
- 存放路径：`.claude/commands/`（兼容）、`.claude/skills/`（推荐，功能更完整）
- 同名优先级：Skill > Command

## 4. 作用域
- **项目级**：随 Git 共享，团队共用
- **用户级**：本地全局，跨项目个人使用

## 5. 参数传递
- 单参数：`$ARGUMENTS`
- 多位置参数：`$1、$2…`
- 系统兜底：未定义参数时自动追加输入内容

## 6. 动态上下文注入
- `!`command``：Shell 预执行，结果注入 Prompt
- 价值：减少模型工具调用，省 Token、提效率
- 安全：配合 `allowed-tools` 做权限限制

## 7. Hooks 安全机制
- 三层结构：事件 → 匹配规则 → 执行命令
- 用途：为提交、部署等副作用操作加安全校验

## 8. 核心设计原则
单一职责、清晰命名、权限最小化、显式可控、上下文前置

## 9. 能力协同
任务型 Skill（执行）、参考型 Skill（知识）、Sub-Agent（隔离）互补；大输出用 `context: fork` 隔离上下文