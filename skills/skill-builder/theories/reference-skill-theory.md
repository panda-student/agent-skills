# 参考型 Skills 核心理论

## 1. 核心定义
参考型 Skill 是 Claude Code Skills 体系中的知识型技能，用于提供规范、知识、风格、约定等参考信息，由模型自动触发，无需用户手动调用。

## 2. 核心特征
- **触发方式**：语义自动触发
- **适用场景**：规范、知识、风格、约定
- **特点**：无执行步骤，提供参考信息
- **示例**：api-convention、code-style、git-workflow

## 3. 设计要点
- 不需要 `disable-model-invocation` 配置
- 允许模型主动加载和引用
- 内容以知识、规范、标准为主
- 无副作用操作

## 4. 权限配置
参考型 Skill 默认使用只读权限，确保不会对项目产生副作用：

```yaml
allowed-tools:
  - Read
  - Grep
  - Glob
```

## 5. 命名规范
- 使用名词短语：`api-convention`、`code-style`
- 强调知识领域：`architecture-guide`、`security-standard`
- 避免动词开头（与任务型区分）

## 6. Frontmatter 配置
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

## 7. 触发机制
参考型 Skill 通过语义自动触发，当用户讨论相关话题时，模型会自动加载对应的 Skill：

```
用户：我想设计一个用户登录的 API 接口
助手：[自动触发 api-convention] 根据 API 规范，建议使用 POST /auth/login...
```

## 8. 与任务型 Skill 的区别

| 特征 | 参考型 Skill | 任务型 Skill |
|------|-------------|-------------|
| 触发方式 | 语义自动触发 | 斜杠命令手动触发 |
| 适用场景 | 规范/知识/标准 | 执行操作/部署/脚本 |
| 权限配置 | 只读权限 | 读写权限 |
| 关键配置 | 无需 disable-model-invocation | **必须** disable-model-invocation: true |
| 命名规范 | 名词短语 | 动词开头 |
| 副作用 | 无 | 可能有（文件修改、部署等） |

## 9. 最佳实践

### 9.1 内容组织
- 核心原则内联于 SKILL.md
- 详细规范外置于 reference.md
- 示例代码外置于 examples.md

### 9.2 Description 编写
遵循公式：`功能描述 + 执行方式 + 触发场景`

**示例**：
- ✅ `定义项目 RESTful API 设计规范，包含URL命名、响应格式、状态码与鉴权规则，在编写/审查接口、设计新API、确定请求响应格式时自动使用`
- ❌ `API 规范`（过于简单）

### 9.3 渐进式披露
参考型 Skill 同样遵循渐进式披露原则：
- **目录层**：仅加载 description，用于语义匹配
- **路由层**：加载 SKILL.md，提供核心原则
- **附录层**：按需加载 reference.md、examples.md

## 10. 典型示例

### API 规范 Skill
```yaml
---
name: api-convention
description: 定义项目 RESTful API 设计规范，包含URL命名、响应格式、状态码与鉴权规则，在编写/审查接口、设计新API、确定请求响应格式时自动使用
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是项目的 API 设计规范专家。当用户讨论 API 设计、接口定义或 RESTful 规范时，提供符合项目标准的指导。

## 核心原则
- 遵循 RESTful 设计规范
- 使用统一的响应格式
- 实施版本控制策略
- 保证接口安全性

详细规范请参考 [reference.md](./reference.md)
```
