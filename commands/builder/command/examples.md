# 任务型 Skill 构建示例

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
- ✅ **必须** `disable-model-invocation: true`（作为动作执行者，绝不让 Claude 自作主张触发）
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
context-injection:
  - name: git-branch
    command: git branch --show-current
    description: 当前 Git 分支
  - name: recent-commits
    command: git log -3 --oneline
    description: 最近3次提交记录
  - name: uncommitted-changes
    command: git status --short
    description: 未提交的更改
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

### 上下文注入说明
| 注入项 | 命令 | 用途 |
|--------|------|------|
| git-branch | `git branch --show-current` | 判断是否在正确分支 |
| recent-commits | `git log -3 --oneline` | 查看最近变更 |
| uncommitted-changes | `git status --short` | 检查是否有未提交更改 |

### 关键特征
- ✅ 手动触发，防止误操作
- ✅ **必须** disable-model-invocation: true
- ✅ 精确权限控制，不使用 Bash(*)
- ✅ 包含副作用操作（部署）
- ✅ 动词+最简词命名：run-app
- ✅ **上下文预注入**：定义所需上下文，减少运行时模型调用

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
context-injection:
  - name: project-structure
    command: find . -type f -name "*.ts" -o -name "*.tsx" | head -20
    description: 项目文件结构概览
  - name: package-info
    command: cat package.json
    description: 项目依赖和配置
  - name: lint-errors
    command: npm run lint 2>&1 || true
    description: 当前 lint 错误
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

### 上下文注入说明
| 注入项 | 命令 | 用途 |
|--------|------|------|
| project-structure | `find . -type f ...` | 了解项目结构，针对性审查 |
| package-info | `cat package.json` | 了解技术栈和依赖版本 |
| lint-errors | `npm run lint` | 获取现有 lint 问题作为基准 |

### 关键特征
- ✅ 手动触发
- ✅ **必须** disable-model-invocation: true
- ✅ 只读权限（审查不修改文件）
- ✅ 动词+最简词命名：check-code
- ✅ **上下文预注入**：预加载项目信息，避免重复查询

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
context-injection:
  - name: db-schema
    command: cat schema.sql 2>/dev/null || echo "No schema file found"
    description: 数据库 schema 定义
  - name: db-config
    command: cat .env 2>/dev/null | grep DB_ || echo "No DB config found"
    description: 数据库连接配置（脱敏）
  - name: migrations-list
    command: ls -la migrations/ 2>/dev/null || echo "No migrations folder"
    description: 迁移文件列表
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

### 上下文注入说明
| 注入项 | 命令 | 用途 |
|--------|------|------|
| db-schema | `cat schema.sql` | 了解现有表结构 |
| db-config | `cat .env \| grep DB_` | 获取数据库连接信息 |
| migrations-list | `ls -la migrations/` | 了解迁移历史 |

### 关键特征
- ✅ 手动触发
- ✅ **必须** disable-model-invocation: true
- ✅ 读写权限，包含文件和数据库操作
- ✅ 动词+最简词命名：run-sql
- ✅ **统一流程**：创建临时脚本 → 执行 SQL → 删除临时脚本
- ✅ **上下文预注入**：预加载 schema 和配置，减少确认步骤

---

# 触发场景

## 任务型 Skill 手动触发
```
用户：/make-app
助手：[触发 make-app] 我将帮你创建应用，请选择应用类型...
```

---

# 常见错误示例

## 错误 1：任务型 Skill 缺少 disable-model-invocation: true

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
**问题**：任务型 Skill 是"动作执行者"，必须设置 `disable-model-invocation: true`，绝不让 Claude 自作主张触发

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
**说明**：任务型 Skill 必须由用户显式调用，Claude 不能主动执行

---

## 错误 2：权限配置不当

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

## 错误 3：Description 过于简单

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

## 错误 4：命名不符合规范

### ❌ 错误命名
```
CreateComponent  # 大写字母
create_component  # 下划线
createComp       # 缩写
create-component  # 使用复杂词 component
```

### ✅ 正确命名
```
make-app         # 动词+最简词
run-app          # 动词+最简词
check-code       # 动词+最简词
fix-bug          # 动词+最简词
test-all         # 动词+最简词
```

---

# 完整生成示例

## 任务型 Skill 生成流程

**第1题**：你要创建的 Skill 类型是？
- 用户选择：任务型 Skill（手动斜杠命令触发，执行动作）

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