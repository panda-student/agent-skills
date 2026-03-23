# 参考型 Skill 构建示例

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
context-injection:
  - name: existing-api-files
    command: find . -type f \( -name "*api*" -o -name "*route*" \) | head -10
    description: 现有 API 文件列表
  - name: api-base-url
    command: cat .env 2>/dev/null | grep API_BASE || echo "No API base URL defined"
    description: API 基础 URL 配置
---

你是项目的 API 设计规范专家。当用户讨论 API 设计、接口定义或 RESTful 规范时，提供符合项目标准的指导。

## 核心原则
- 遵循 RESTful 设计规范
- 使用统一的响应格式
- 实施版本控制策略
- 保证接口安全性

详细规范请参考 [reference.md](./reference.md)
```

### 上下文注入说明
| 注入项 | 命令 | 用途 |
|--------|------|------|
| existing-api-files | `find . -name "*api*"` | 了解现有 API 结构，保持一致性 |
| api-base-url | `cat .env \| grep API_BASE` | 获取 API 基础配置 |

### 关键特征
- ✅ 自动触发，无需用户手动调用
- ✅ 只读权限，无副作用操作
- ✅ 提供知识、规范、标准
- ✅ **不设置** `disable-model-invocation`（作为知识提供者）
- ✅ 名词+最简词命名：api-rule
- ✅ **上下文预注入**：预加载现有 API 结构，提供针对性建议

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
context-injection:
  - name: lint-config
    command: cat .eslintrc.* 2>/dev/null || cat .prettierrc* 2>/dev/null || echo "No lint config found"
    description: 现有 lint 配置
  - name: tsconfig
    command: cat tsconfig.json 2>/dev/null || echo "No tsconfig found"
    description: TypeScript 配置
  - name: existing-style-patterns
    command: find . -name "*.ts" -o -name "*.tsx" | head -5 | xargs head -50 2>/dev/null
    description: 现有代码风格样本
---

你是项目的代码风格规范专家。当用户讨论代码风格、命名约定或格式化规则时，提供符合项目标准的指导。

## 核心规范
- 命名约定：驼峰命名、常量大写
- 格式化：缩进、空格、换行
- 注释标准：函数注释、行内注释
- 最佳实践：单一职责、DRY 原则

详细规范请参考 [reference.md](./reference.md)
```

### 上下文注入说明
| 注入项 | 命令 | 用途 |
|--------|------|------|
| lint-config | `cat .eslintrc.*` | 了解现有代码规范配置 |
| tsconfig | `cat tsconfig.json` | 了解 TypeScript 配置 |
| existing-style-patterns | `find . -name "*.ts"` | 分析现有代码风格模式 |

### 关键特征
- ✅ 知识导向，自动触发
- ✅ 只读权限
- ✅ 名词+最简词命名：style-guide
- ✅ **上下文预注入**：预加载配置和代码样本，提供一致性建议

---

## 示例 3：Git 工作流规范

### SKILL.md
```markdown
---
name: git-flow
description: 定义项目 Git 工作流规范，包含分支策略、提交规范、合并流程，在使用Git、创建分支、提交代码、合并请求时自动使用
allowed-tools:
  - Read
  - Grep
  - Glob
context-injection:
  - name: current-branch
    command: git branch --show-current 2>/dev/null || echo "Not a git repo"
    description: 当前分支
  - name: branch-list
    command: git branch -a 2>/dev/null | head -10 || echo "No branches"
    description: 分支列表
  - name: recent-commits
    command: git log --oneline -5 2>/dev/null || echo "No commits"
    description: 最近提交记录
---

你是项目的 Git 工作流规范专家。当用户讨论 Git 工作流、分支策略或提交规范时，提供符合项目标准的指导。

## 核心规范
- 分支策略：main、develop、feature、hotfix
- 提交规范：feat、fix、docs、style、refactor
- 合并流程：PR 审核、CI 通过、Squash 合并

详细规范请参考 [reference.md](./reference.md)
```

### 上下文注入说明
| 注入项 | 命令 | 用途 |
|--------|------|------|
| current-branch | `git branch --show-current` | 了解当前工作上下文 |
| branch-list | `git branch -a` | 了解项目分支结构 |
| recent-commits | `git log --oneline -5` | 了解最近提交风格 |

### 关键特征
- ✅ 自动触发，无需用户手动调用
- ✅ 只读权限
- ✅ 名词+最简词命名：git-flow
- ✅ **上下文预注入**：预加载 Git 状态，提供上下文相关建议

---

## 示例 4：安全规范

### SKILL.md
```markdown
---
name: security-rule
description: 定义项目安全规范，包含认证授权、数据加密、漏洞防护，在编写安全代码、设计认证系统、处理敏感数据时自动使用
allowed-tools:
  - Read
  - Grep
  - Glob
context-injection:
  - name: auth-config
    command: find . -name "*auth*" -o -name "*security*" | head -5
    description: 现有认证相关文件
  - name: env-template
    command: cat .env.example 2>/dev/null || echo "No .env.example"
    description: 环境变量模板（脱敏）
  - name: dependency-audit
    command: npm audit --json 2>/dev/null | head -50 || echo "No audit data"
    description: 依赖安全审计结果
---

你是项目的安全规范专家。当用户讨论安全相关话题时，提供符合项目标准的指导。

## 核心原则
- 认证授权：JWT、OAuth2、RBAC
- 数据加密：AES、RSA、Hash
- 漏洞防护：XSS、CSRF、SQL注入

详细规范请参考 [reference.md](./reference.md)
```

### 上下文注入说明
| 注入项 | 命令 | 用途 |
|--------|------|------|
| auth-config | `find . -name "*auth*"` | 了解现有安全实现 |
| env-template | `cat .env.example` | 了解安全配置模板 |
| dependency-audit | `npm audit --json` | 了解依赖安全状态 |

### 关键特征
- ✅ 自动触发
- ✅ 只读权限
- ✅ 名词+最简词命名：security-rule
- ✅ **上下文预注入**：预加载安全配置和审计结果，提供针对性建议

---

# 触发场景

## 参考型 Skill 自动触发
```
用户：我想设计一个用户登录的 API 接口
助手：[自动触发 api-rule] 根据 API 规范，建议使用 POST /auth/login...
```

---

# 常见错误示例

## 错误 1：参考型 Skill 使用了 disable-model-invocation: true

### ❌ 错误配置
```yaml
---
name: api-rule
description: API 设计规范
disable-model-invocation: true
---
```
**问题**：参考型 Skill 应作为"知识提供者"，不应禁用模型调用

### ✅ 正确配置
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
**说明**：不设置 `disable-model-invocation`，允许 Claude 作为知识提供者主动调用

---

## 错误 2：权限配置不当

### ❌ 错误配置
```yaml
allowed-tools:
  - Bash
```
**问题**：参考型 Skill 应该使用只读权限，不应包含写操作权限

### ✅ 正确配置
```yaml
allowed-tools:
  - Read
  - Grep
  - Glob
```

---

## 错误 3：Description 过于简单

### ❌ 错误 Description
```yaml
description: API 规范
```
**问题**：缺少触发场景，自动触发概率低

### ✅ 正确 Description
```yaml
description: 定义项目 RESTful API 设计规范，包含URL命名、响应格式、状态码与鉴权规则，在编写/审查接口、设计新API、确定请求响应格式时自动使用
```

---

## 错误 4：命名不符合规范

### ❌ 错误命名
```
APIConvention  # 大写字母
api_convention  # 下划线
apiRef          # 缩写
api-convention  # 使用复杂词 convention
```

### ✅ 正确命名
```
api-rule        # 名词+最简词
style-guide     # 名词+最简词
git-flow        # 名词+最简词
arch-guide      # 名词+最简词
```

---

# 完整生成示例

## 参考型 Skill 生成流程

**第1题**：你要创建的 Skill 类型是？
- 用户选择：参考型 Skill（自动触发，规范/知识/标准）

**第2题**：Skill 的主要用途是？
- A. API 设计规范
- B. 代码风格规范
- C. Git 工作流规范
- 用户选择：A. API 设计规范

**第3题**：Skill 名称？
- 系统建议：`api-rule`
- 用户确认：是

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