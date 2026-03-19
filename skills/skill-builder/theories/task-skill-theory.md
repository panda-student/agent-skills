# 任务型 Skills 核心理论

## 1. Skill 类型划分
- **参考型 Skill**：模型自动触发，用于知识/规范补充
- **任务型 Skill**：必须设置 `disable-model-invocation: true`，**仅用户手动触发**，不允许模型主动执行

## 2. Commands 与 Skills 关系
- 斜杠命令已整合为 Skills 子集
- 存放路径：`.claude/commands/`（兼容）、`.claude/skills/`（推荐，功能更完整）
- 同名优先级：Skill > Command

## 3. 作用域
- **项目级**：随 Git 共享，团队共用
- **用户级**：本地全局，跨项目个人使用

## 4. 参数传递
- 单参数：`$ARGUMENTS`
- 多位置参数：`$1、$2…`
- 系统兜底：未定义参数时自动追加输入内容

## 5. 动态上下文注入
- `!`command``：Shell 预执行，结果注入 Prompt
- 价值：减少模型工具调用，省 Token、提效率
- 安全：配合 `allowed-tools` 做权限限制

## 6. Hooks 安全机制
- 三层结构：事件 → 匹配规则 → 执行命令
- 用途：为提交、部署等副作用操作加安全校验

## 7. 核心设计原则
单一职责、清晰命名、权限最小化、显式可控、上下文前置

## 8. 能力协同
任务型 Skill（执行）、参考型 Skill（知识）、Sub-Agent（隔离）互补；大输出用 `context: fork` 隔离上下文
