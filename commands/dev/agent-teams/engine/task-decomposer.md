# 任务分解器 (Task Decomposer)

任务分解器是并行执行引擎的第一个核心组件，负责将用户请求分解为可并行执行的子任务。

---

## 分解算法

### 算法入口

```
输入: 用户请求 (自然语言描述)
输出: 任务分解表 (Task Decomposition Table)
```

### 分解步骤

```
步骤1: 任务类型识别
    │
    ├── 关键词匹配
    │   - "探索/分析/了解" → 探索类
    │   - "开发/实现/新增" → 开发类
    │   - "修复/解决/bug" → 修复类
    │   - "评审/检查/审查" → 评审类
    │   - "部署/发布/上线" → 部署类
    │
    └── 上下文推断
        - 根据请求内容推断任务类型
        - 复合任务拆分为多个子类型

步骤2: 任务维度分解
    │
    ├── 按文件/模块分解
    │   - 识别涉及的文件范围
    │   - 按文件路径分组
    │
    ├── 按功能维度分解
    │   - 识别功能边界
    │   - 按功能模块分组
    │
    └── 按执行阶段分解
        - 识别执行顺序依赖
        - 按阶段分组

步骤3: 子任务生成
    │
    ├── 确定输入输出
    │   - 每个子任务有明确的输入
    │   - 每个子任务有明确的输出
    │
    ├── 确定文件范围
    │   - 每个子任务有明确的文件范围
    │   - 文件范围不重叠（并行前提）
    │
    └── 评估复杂度
        - 低: 简单查询/读取
        - 中: 分析/修改
        - 高: 复杂逻辑/多文件修改
```

---

## 任务类型分解规则

### 探索类任务

**触发条件**: 用户请求包含"探索"、"分析"、"了解"、"查看"等关键词

**分解维度**: 按文件/目录范围分解

```yaml
exploration_decomposition:
  trigger_keywords:
    - 探索
    - 分析
    - 了解
    - 查看
    - 理解
    - 研究
  
  decomposition_rules:
    - rule: 目录结构探索
      file_scope: "根目录"
      output: "目录树结构说明"
      
    - rule: 核心模块探索
      file_scope: "src/core/, src/main/, lib/"
      output: "核心模块职责说明"
      
    - rule: 依赖关系探索
      file_scope: "package.json, requirements.txt, pom.xml, Cargo.toml"
      output: "依赖图谱"
      
    - rule: 配置文件探索
      file_scope: "*.config.*, *.yaml, *.json, .env*"
      output: "配置项说明"
      
    - rule: 入口文件探索
      file_scope: "main.*, index.*, app.*, server.*"
      output: "入口逻辑说明"
      
    - rule: API接口探索
      file_scope: "api/, routes/, controllers/, handlers/"
      output: "API接口文档"
      
    - rule: 数据模型探索
      file_scope: "models/, entities/, schemas/"
      output: "数据模型说明"
      
    - rule: 测试文件探索
      file_scope: "tests/, test/, __tests__/, *.test.*, *.spec.*"
      output: "测试覆盖说明"
```

**分解示例**:

```
用户请求: "探索这个代码库的架构"

分解结果:
┌─────────────────────────────────────────────────────────────┐
│ 任务ID │ 任务名称        │ 文件范围          │ 输出         │
├────────┼────────────────┼──────────────────┼──────────────┤
│ T1     │ 目录结构探索    │ 根目录            │ 目录树结构    │
│ T2     │ 核心模块探索    │ src/core/         │ 模块职责      │
│ T3     │ 依赖关系探索    │ package.json      │ 依赖图谱      │
│ T4     │ 配置文件探索    │ *.config.*        │ 配置项说明    │
│ T5     │ 入口文件探索    │ main.*, index.*   │ 入口逻辑      │
└─────────────────────────────────────────────────────────────┘

并行性: T1-T5 无依赖，可并行执行
```

---

### 开发类任务

**触发条件**: 用户请求包含"开发"、"实现"、"新增"、"添加"、"重构"等关键词

**分解维度**: 按执行阶段 + 文件范围分解

```yaml
development_decomposition:
  trigger_keywords:
    - 开发
    - 实现
    - 新增
    - 添加
    - 重构
    - 修改
    - 创建
  
  decomposition_rules:
    - stage: 需求分析
      tasks:
        - name: 需求分析
          file_scope: "docs/"
          output: "需求文档"
          
    - stage: 设计
      tasks:
        - name: API设计
          file_scope: "docs/api/"
          output: "API文档"
        - name: 数据库设计
          file_scope: "docs/db/"
          output: "数据库设计"
        - name: UI设计
          file_scope: "docs/ui/"
          output: "UI设计稿"
          
    - stage: 开发
      tasks:
        - name: 前端开发
          file_scope: "src/frontend/"
          output: "前端代码"
        - name: 后端开发
          file_scope: "src/backend/"
          output: "后端代码"
          
    - stage: 测试
      tasks:
        - name: 单元测试
          file_scope: "tests/unit/"
          output: "测试代码"
        - name: 集成测试
          file_scope: "tests/integration/"
          output: "测试代码"
```

**分解示例**:

```
用户请求: "开发用户登录功能"

分解结果:
┌─────────────────────────────────────────────────────────────┐
│ 任务ID │ 任务名称        │ 文件范围          │ 输出         │
├────────┼────────────────┼──────────────────┼──────────────┤
│ T1     │ 需求分析        │ docs/             │ 需求文档      │
│ T2     │ API设计         │ docs/api/         │ API文档       │
│ T3     │ 数据库设计      │ docs/db/          │ 数据库设计    │
│ T4     │ UI设计          │ docs/ui/          │ UI设计稿      │
│ T5     │ 前端开发        │ src/frontend/     │ 前端代码      │
│ T6     │ 后端开发        │ src/backend/      │ 后端代码      │
│ T7     │ 单元测试        │ tests/unit/       │ 测试代码      │
└─────────────────────────────────────────────────────────────┘

依赖关系:
- T1 → T2, T3, T4
- T2, T3, T4 → T5, T6
- T5, T6 → T7
```

---

### 修复类任务

**触发条件**: 用户请求包含"修复"、"解决"、"bug"、"问题"、"错误"等关键词

**分解维度**: 按分析维度 + 执行阶段分解

```yaml
fix_decomposition:
  trigger_keywords:
    - 修复
    - 解决
    - bug
    - 问题
    - 错误
    - 缺陷
    - 异常
  
  decomposition_rules:
    - stage: 分析
      tasks:
        - name: 日志分析
          file_scope: "logs/"
          output: "错误日志摘要"
        - name: 代码分析
          file_scope: "相关代码文件"
          output: "代码问题定位"
        - name: 数据分析
          file_scope: "database/"
          output: "数据状态检查"
        - name: 环境分析
          file_scope: "config/"
          output: "环境配置检查"
          
    - stage: 修复
      tasks:
        - name: 修复实施
          file_scope: "相关代码文件"
          output: "修复代码"
          
    - stage: 验证
      tasks:
        - name: 验证测试
          file_scope: "tests/"
          output: "测试结果"
        - name: 回归测试
          file_scope: "tests/"
          output: "回归测试结果"
```

**分解示例**:

```
用户请求: "修复登录失败的问题"

分解结果:
┌─────────────────────────────────────────────────────────────┐
│ 任务ID │ 任务名称        │ 文件范围          │ 输出         │
├────────┼────────────────┼──────────────────┼──────────────┤
│ T1     │ 日志分析        │ logs/             │ 错误日志摘要  │
│ T2     │ 代码分析        │ auth.*            │ 代码问题定位  │
│ T3     │ 数据分析        │ database/         │ 数据状态检查  │
│ T4     │ 环境分析        │ config/           │ 环境配置检查  │
│ T5     │ 修复实施        │ auth.*            │ 修复代码      │
│ T6     │ 验证测试        │ tests/            │ 测试结果      │
│ T7     │ 回归测试        │ tests/            │ 回归结果      │
└─────────────────────────────────────────────────────────────┘

依赖关系:
- T1, T2, T3, T4 (并行分析)
- T1-T4 → T5
- T5 → T6, T7
```

---

### 评审类任务

**触发条件**: 用户请求包含"评审"、"检查"、"审查"、"审计"等关键词

**分解维度**: 按评审维度分解

```yaml
review_decomposition:
  trigger_keywords:
    - 评审
    - 检查
    - 审查
    - 审计
    - review
  
  decomposition_rules:
    - dimension: 代码质量
      file_scope: "src/"
      output: "代码质量报告"
      checks:
        - 代码规范
        - 代码复杂度
        - 代码重复
        
    - dimension: 安全审计
      file_scope: "src/"
      output: "安全审计报告"
      checks:
        - 敏感信息泄露
        - 注入漏洞
        - 权限控制
        
    - dimension: 性能分析
      file_scope: "src/"
      output: "性能分析报告"
      checks:
        - 性能瓶颈
        - 资源使用
        - 算法效率
        
    - dimension: 架构评审
      file_scope: "src/"
      output: "架构评审报告"
      checks:
        - 模块划分
        - 依赖关系
        - 扩展性
```

**分解示例**:

```
用户请求: "评审这个模块的代码"

分解结果:
┌─────────────────────────────────────────────────────────────┐
│ 任务ID │ 任务名称        │ 文件范围          │ 输出         │
├────────┼────────────────┼──────────────────┼──────────────┤
│ T1     │ 代码质量评审    │ src/              │ 质量报告      │
│ T2     │ 安全审计        │ src/              │ 安全报告      │
│ T3     │ 性能分析        │ src/              │ 性能报告      │
│ T4     │ 架构评审        │ src/              │ 架构报告      │
└─────────────────────────────────────────────────────────────┘

并行性: T1-T4 无依赖，可并行执行
```

---

### 部署类任务

**触发条件**: 用户请求包含"部署"、"发布"、"上线"、"CI/CD"等关键词

**分解维度**: 按部署阶段分解

```yaml
deployment_decomposition:
  trigger_keywords:
    - 部署
    - 发布
    - 上线
    - CI/CD
    - pipeline
    - deploy
  
  decomposition_rules:
    - stage: 构建
      tasks:
        - name: 代码检查
          file_scope: "src/"
          output: "检查结果"
        - name: 单元测试
          file_scope: "tests/"
          output: "测试结果"
        - name: 构建
          file_scope: "项目根目录"
          output: "构建产物"
          
    - stage: 部署
      tasks:
        - name: 部署预发
          file_scope: "配置文件"
          output: "预发环境"
        - name: 部署生产
          file_scope: "配置文件"
          output: "生产环境"
          
    - stage: 验证
      tasks:
        - name: 健康检查
          file_scope: "监控配置"
          output: "健康状态"
        - name: 冒烟测试
          file_scope: "tests/"
          output: "测试结果"
```

---

## 分解输出格式

### 标准输出模板

```markdown
📋 任务分解完成

**任务类型**: [探索/开发/修复/评审/部署]
**分解维度**: [文件/模块/阶段]
**子任务数量**: [N]

| 任务ID | 任务名称 | 输入 | 输出 | 文件范围 | 预估复杂度 |
|--------|---------|------|------|---------|-----------|
| T1 | ... | ... | ... | ... | 低/中/高 |
| T2 | ... | ... | ... | ... | 低/中/高 |
| ... | ... | ... | ... | ... | ... |

**文件隔离检查**:
- T1 文件范围: [...] → 无冲突 ✅
- T2 文件范围: [...] → 无冲突 ✅
- ...

**下一步**: 执行依赖分析
```

---

## 分解原则

| 原则 | 描述 | 强制性 |
|------|------|--------|
| **粒度适中** | 子任务不过大也不过小 | ✅ 必须 |
| **边界清晰** | 每个子任务有明确的输入输出 | ✅ 必须 |
| **文件隔离** | 不同子任务的文件范围不重叠 | ✅ 必须 |
| **可独立执行** | 每个子任务可独立完成 | ✅ 必须 |
| **可验证** | 每个子任务的输出可验证 | ✅ 必须 |
