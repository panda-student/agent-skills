# Skill 构建示例

# 参考型 Skill 示例

## 示例：API 规范

### 目录结构
```
.claude/skills/
└── api-rule/
    ├── SKILL.md
    └── reference.md
```

### SKILL.md
```markdown
---
name: api-rule
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

### 关键特征
- ✅ 自动触发，无需用户手动调用
- ✅ 只读权限，无副作用操作
- ✅ 名词+最简词命名：api-rule

---

# 任务型 Skill 示例

## 示例 1：创建应用

### SKILL.md
```markdown
---
name: make-app
description: 创建符合项目规范的应用，通过斜杠命令触发，用于快速生成标准化应用代码
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
---

你是应用创建专家。当用户使用 `/make-app` 命令时，引导用户创建符合项目规范的应用。

## 执行流程
1. 询问应用名称和类型
2. 确认应用功能需求
3. 生成应用代码文件
4. 创建对应的样式文件
5. 生成测试文件（可选）

详细规范和模板请参考 [reference.md](./reference.md) 和 [templates/](./templates/)
```

### 关键特征
- ✅ 手动触发，必须使用斜杠命令
- ✅ **必须** disable-model-invocation: true
- ✅ 动词+最简词命名：make-app

---

## 示例 2：部署应用

### SKILL.md
```markdown
---
name: run-app
description: 部署应用到生产环境，通过斜杠命令触发，用于自动化部署流程
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Bash(npm run build)
  - Bash(docker build)
  - Bash(docker push)
  - Bash(kubectl apply)
---

你是应用部署专家。当用户使用 `/run-app` 命令时，执行标准化的部署流程。

## 部署流程
1. 构建项目：`npm run build`
2. 构建 Docker 镜像：`docker build -t ...`
3. 推送镜像：`docker push ...`
4. 应用 Kubernetes 配置：`kubectl apply -f ...`

## 安全检查
- 确认当前分支为 main
- 确认所有测试通过
- 确认无未提交的更改
```

### 关键特征
- ✅ 精确权限控制，不使用 Bash(*)
- ✅ 包含副作用操作（部署）
- ✅ 动词+最简词命名：run-app

---

## 示例 3：检查代码

### SKILL.md
```markdown
---
name: check-code
description: 执行代码质量审查并提供改进建议，通过斜杠命令触发，用于提升代码质量
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是专业的代码审查专家。当用户使用 `/check-code` 命令时，对指定代码进行全面审查。

## 审查维度
1. **代码质量**：可读性、可维护性、复杂度
2. **安全性**：潜在漏洞、敏感信息泄露
3. **性能**：性能瓶颈、资源浪费
4. **规范性**：编码规范、最佳实践
```

### 关键特征
- ✅ 只读权限（审查不修改文件）
- ✅ 动词+最简词命名：check-code

---

# 常见错误示例

## 错误 1：任务型 Skill 缺少 disable-model-invocation

### ❌ 错误配置
```yaml
---
name: deploy-service
description: 部署服务到生产环境
user-invocable: true
allowed-tools:
  - Bash
---
```

### ✅ 正确配置
```yaml
---
name: deploy-service
description: 部署服务到生产环境，通过斜杠命令触发，用于自动化部署流程
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Bash(npm run build)
---
```

---

## 错误 2：权限配置不当

### ❌ 错误配置
```yaml
allowed-tools:
  - Bash(*)
```

### ✅ 正确配置
```yaml
allowed-tools:
  - Read
  - Bash(npm run build)
  - Bash(git push)
```

---

## 错误 3：Description 过于简单

### ❌ 错误 Description
```yaml
description: 创建组件
```

### ✅ 正确 Description
```yaml
description: 创建符合项目规范的 React 组件，通过斜杠命令触发，用于快速生成标准化组件代码
```

---

## 错误 4：命名不符合规范

### ❌ 错误命名
```
CreateComponent  # 大写字母
create_component  # 下划线
createComp       # 缩写
api-convention   # 使用复杂词 convention
```

### ✅ 正确命名
```
api-rule        # 参考型：名词+最简词
style-guide     # 参考型：名词+最简词
make-app        # 任务型：动词+最简词
run-app         # 任务型：动词+最简词
check-code      # 任务型：动词+最简词
```

---

# 知识预编译封装示例

## 验证检查类封装

### 场景
项目需要频繁执行代码质量检查。

### 封装方案
```json
// package.json
{
  "scripts": {
    "lint": "eslint src/ --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "test": "jest --passWithNoTests",
    "test:all": "npm run lint && npm run typecheck && npm run test"
  }
}
```

### Skill 中使用
```markdown
## 代码检查
执行完整检查：`npm run test:all`
```

---

## 构建部署类封装

### 场景
项目需要标准化构建流程。

### 封装方案
```bash
#!/bin/bash
# scripts/build.sh
set -e
echo "🔨 开始构建..."
npm run test:all
rm -rf dist/
npm run build
echo "{\"version\": \"$(git describe --tags)\"}" > dist/version.json
echo "✅ 构建完成"
```

### Skill 中使用
```markdown
## 构建流程
执行构建：`./scripts/build.sh`
```

---

## 封装决策示例

| 场景 | 频率 | 确定性 | 决策 | 封装方式 |
|------|------|--------|------|---------|
| 代码检查 | 高 | 高 | P0 优先封装 | npm script |
| 项目构建 | 高 | 高 | P0 优先封装 | shell 脚本 |
| 组件生成 | 中 | 高 | P2 建议封装 | shell 脚本 |
| 环境配置 | 低 | 高 | P3 可选封装 | shell 脚本 |
| 架构建议 | 中 | 低 | P4 不封装 | AI 推理 |
