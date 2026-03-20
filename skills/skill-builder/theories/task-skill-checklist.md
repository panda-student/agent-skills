# 任务型 Skill 七步设计清单

## 第一步：动作定义
确定命令功能，命名简洁直观（make-app、run-app、check-code 等）

### 命名规范（动词+最简词）
- 使用动词+最简词：make-app、run-app、check-code、fix-bug
- 简洁明了：make、run、check、fix、test
- 避免缩写：make-app（不是 ma）
- 记忆口诀：动词=执行
- 简化原则：使用最简单的单词，避免复杂词汇

## 第二步：触发控制
设置 `disable-model-invocation: true`，仅允许用户手动触发

### 配置示例
```yaml
---
name: deploy-service
description: 部署服务到生产环境，通过斜杠命令触发，用于自动化部署流程
user-invocable: true
disable-model-invocation: true
---
```

## 第三步：权限约束
通过 `allowed-tools` 精确授权到子命令，遵循最小权限原则，不使用 `Bash(*)`

### 权限配置示例
```yaml
allowed-tools:
  - Read
  - Write
  - Bash(npm run build)
  - Bash(git push)
```

## 第四步：上下文注入
使用 `!`command`` 预加载分支、变更、日志等关键上下文

### 注入示例
```markdown
当前分支：!`git branch --show-current`
变更文件：!`git diff --name-only`
最近提交：!`git log -5 --oneline`
```

## 第五步：安全 Hooks
配置 `PreToolUse`/`PostToolUse` 等钩子，做校验、日志、格式化等处理

### Hook 配置示例
```yaml
hooks:
  PreToolUse:
    - match: "Bash(git push)"
      command: "echo '确认推送？'"
  PostToolUse:
    - match: "Bash(npm run build)"
      command: "echo '构建完成'"
```

## 第六步：输出隔离
输出量大时，配置 `context: fork` 在子代理中执行，避免污染主上下文

### 隔离配置
```yaml
context: fork
```

## 第七步：模型选型
简单任务用 haiku，复杂任务用 sonnet

### 选型建议
- **haiku**：简单查询、格式化、小范围修改
- **sonnet**：复杂分析、架构设计、大范围重构
