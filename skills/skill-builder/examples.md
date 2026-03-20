# Skill 构建示例

# 参考型 Skill 示例

## 示例 1：API 规范

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
- ✅ 提供知识、规范、标准
- ✅ 无需 disable-model-invocation
- ✅ 名词+最简词命名：api-rule

---

## 示例 2：代码风格规范

### SKILL.md
```markdown
---
name: style-guide
description: 定义项目代码风格规范，包含命名约定、格式化规则、注释标准，在编写代码、代码审查、格式化代码时自动使用
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是项目的代码风格规范专家。当用户讨论代码风格、命名约定或格式化规则时，提供符合项目标准的指导。

## 核心规范
- 命名约定：驼峰命名、常量大写
- 格式化：缩进、空格、换行
- 注释标准：函数注释、行内注释
- 最佳实践：单一职责、DRY 原则

详细规范请参考 [reference.md](./reference.md)
```

### 关键特征
- ✅ 知识导向，自动触发
- ✅ 只读权限
- ✅ 名词+最简词命名：style-guide

---

# 任务型 Skill 示例

## 示例 1：创建应用

### 目录结构
```
.claude/skills/
└── make-app/
    ├── SKILL.md
    ├── reference.md
    └── templates/
        └── component.tsx
```

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

## 应用规范
- 使用函数式组件和 Hooks
- 遵循单一职责原则
- 组件文件不超过 300 行
- 使用 TypeScript 类型定义

详细规范和模板请参考 [reference.md](./reference.md) 和 [templates/](./templates/)
```

### 关键特征
- ✅ 手动触发，必须使用斜杠命令
- ✅ **必须** disable-model-invocation: true
- ✅ 读写权限，包含文件修改操作
- ✅ 动词+最简词命名：make-app
- ✅ 包含执行步骤和流程

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

当前分支：!`git branch --show-current`
最近提交：!`git log -3 --oneline`
```

### 关键特征
- ✅ 手动触发，防止误操作
- ✅ **必须** disable-model-invocation: true
- ✅ 精确权限控制，不使用 Bash(*)
- ✅ 包含副作用操作（部署）
- ✅ 动词+最简词命名：run-app
- ✅ 使用动态上下文注入

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

## 输出格式
### 审查报告
- 文件：[文件路径]
- 问题等级：🔴 严重 | 🟡 警告 | 🔵 建议
- 问题描述：[具体描述]
- 改进建议：[具体建议]
- 代码位置：[行号范围]

审查标准请参考 [reference.md](./reference.md)
```

### 关键特征
- ✅ 手动触发
- ✅ **必须** disable-model-invocation: true
- ✅ 只读权限（审查不修改文件）
- ✅ 动词+最简词命名：check-code

---

## 示例 4：数据库操作

### SKILL.md
```markdown
---
name: run-sql
description: 执行数据库操作，通过斜杠命令触发，用于创建表、插入数据、执行查询等
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Bash(mysql)
  - Bash(psql)
  - Bash(sqlite3)
---

你是数据库操作专家。当用户使用 `/run-sql` 命令时，执行数据库相关操作。

## 执行流程
1. 确认数据库类型和连接信息
2. 创建临时 SQL 脚本文件
3. 执行 SQL 语句
4. **删除临时脚本文件**（安全清理）
5. 返回执行结果

## 安全规范
- 临时脚本存放在 `.tmp/` 目录
- 执行完毕后立即删除临时文件
- 敏感信息（密码）不写入脚本文件
- 生产环境操作需二次确认

## 临时文件清理
```bash
# 执行后自动清理
rm -f .tmp/query_*.sql
```

详细规范请参考 [reference.md](./reference.md)
```

### 关键特征
- ✅ 手动触发
- ✅ **必须** disable-model-invocation: true
- ✅ 读写权限，包含文件和数据库操作
- ✅ 动词+最简词命名：run-sql
- ✅ **统一流程**：创建临时脚本 → 执行 SQL → 删除临时脚本

---

# 触发场景对比

## 参考型 Skill 自动触发
```
用户：我想设计一个用户登录的 API 接口
助手：[自动触发 api-rule] 根据 API 规范，建议使用 POST /auth/login...
```

## 任务型 Skill 手动触发
```
用户：/make-app
助手：[触发 make-app] 我将帮你创建应用，请选择应用类型...
```

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
**问题**：任务型 Skill 必须设置 `disable-model-invocation: true`，防止模型主动执行部署操作

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
  - Bash(docker build)
---
```

---

## 错误 2：参考型 Skill 使用了 disable-model-invocation

### ❌ 错误配置
```yaml
---
name: api-convention
description: API 设计规范
disable-model-invocation: true
---
```
**问题**：参考型 Skill 不应该禁用模型调用，应该允许模型主动加载和引用

### ✅ 正确配置
```yaml
---
name: api-convention
description: 定义项目 RESTful API 设计规范，包含URL命名、响应格式、状态码与鉴权规则，在编写/审查接口、设计新API、确定请求响应格式时自动使用
allowed-tools:
  - Read
  - Grep
  - Glob
---
```

---

## 错误 3：权限配置不当

### ❌ 错误配置
```yaml
allowed-tools:
  - Bash(*)
```
**问题**：使用 `Bash(*)` 违反最小权限原则，存在安全风险

### ✅ 正确配置
```yaml
allowed-tools:
  - Read
  - Bash(npm run build)
  - Bash(git push)
```

---

## 错误 4：Description 过于简单

### ❌ 错误 Description
```yaml
description: 创建组件
```
**问题**：缺少执行方式和触发场景

### ✅ 正确 Description
```yaml
description: 创建符合项目规范的 React 组件，通过斜杠命令触发，用于快速生成标准化组件代码
```

---

## 错误 5：命名不符合规范

### ❌ 错误命名
```
CreateComponent  # 大写字母
create_component  # 下划线
createComp       # 缩写
api-ref          # 使用 -ref 后缀（旧规则）
do-create        # 使用 do- 前缀（旧规则）
api-convention  # 使用复杂词 convention
create-component  # 使用复杂词 component
```

### ✅ 正确命名
```
api-rule        # 参考型：名词+最简词
style-guide     # 参考型：名词+最简词
make-app         # 任务型：动词+最简词
run-app          # 任务型：动词+最简词
check-code       # 任务型：动词+最简词
```

---

# 完整生成示例

## 参考型 Skill 生成流程

**第1题**：你要创建的 Skill 类型是？
- 用户选择：A. 参考型 Skill（自动触发，规范/知识/标准）

**第2题**：Skill 的主要用途是？
- A. API 设计规范
- B. 代码风格规范
- C. Git 工作流规范
- 用户选择：A. API 设计规范

**第3题**：Skill 名称？
- 系统建议：`api-rule`
- 用户确认：是

**第4题**：权限配置？
- A. 只读工具（Read、Grep、Glob）
- 用户选择：A. 只读工具

**生成结果**：
```yaml
---
name: api-rule
description: 定义项目 RESTful API 设计规范，包含URL命名、响应格式、状态码与鉴权规则，在编写/审查接口、设计新API、确定请求响应格式时自动使用
allowed-tools:
  - Read
  - Grep
  - Glob
---
```

---

## 任务型 Skill 生成流程

**第1题**：你要创建的 Skill 类型是？
- 用户选择：B. 任务型 Skill（手动斜杠命令触发，执行动作）

**第2题**：Skill 的主要用途是？
- A. 创建应用
- B. 部署应用
- C. 检查代码
- 用户选择：A. 创建应用

**第3题**：Skill 名称？
- 系统建议：`make-app`
- 用户确认：是

**第4题**：权限配置？
- A. 只读工具（Read、Grep、Glob）
- B. 读写工具（Read、Write、Edit）
- C. 完整工具（包含 Bash）
- 用户选择：B. 读写工具

**第5题**：是否需要禁用模型调用？
- A. 是（推荐，防止模型主动执行）
- 用户选择：A. 是

**生成结果**：
```yaml
---
name: make-app
description: 创建符合项目规范的应用，通过斜杠命令触发，用于快速生成标准化应用代码
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - AskUserQuestion
---
```
