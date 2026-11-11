---
name: gitlab-operate
description: GitLab CI/CD流水线管理。触发流水线、轮询状态、查看作业日志、按依赖顺序部署多服务。支持AI自动调用和用户通过斜杠命令 `/gitlab-operate` 手动触发，用于GitLab流水线管理、CI诊断、服务部署场景
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

你是 GitLab CI/CD 流水线管理专家。当用户需要管理流水线、诊断CI失败、部署服务时，提供标准化操作。

## 双模式触发说明

- **AI 自动调用**：当用户讨论CI/CD、流水线、部署、构建失败等话题时自动加载
- **用户手动调用**：用户可使用 `/gitlab-operate` 命令主动触发

## 核心原则

- **依赖顺序优先**：多服务部署必须按依赖关系串行触发，不可并发
- **依赖顺序动态计算**：根据本次代码修改范围实时调整部署顺序，不是固定顺序
- **Runner缓存感知**：CI Runner本地Maven仓库可能缓存不一致，失败时重试
- **逐层推进**：先部署基础依赖层，成功后再部署上层服务

## 凭据获取（vault-ops）

GitLab 地址与 Token 按 `vault-ops` 技能取用，本节只声明 GitLab 的条目匹配规则：

- **检索**：按 `vault-ops` 技能检索 `gitlab` 条目，候选需具备 Token
- **选择**：条目 `url` / `services[].url` 与目标 GitLab 一致；JPM SOA 内网优先取 `environment` 为「PMS项目」的条目；多个候选无法区分时问用户，不猜
- **取用**：从条目 `url` 得到 API base = `{url}/api/v4`，按 `vault-ops` 技能取用 Token 后放入 `PRIVATE-TOKEN` 请求头
- **清理**：用完立即删除临时文件，不打印、不提交

> 密文红线：Token 不得出现在对话输出、终端回显或 git 记录中。

## API 参考

| 操作 | 方法 | 路径 |
|------|------|------|
| 触发流水线 | POST | `/api/v4/projects/{id}/pipeline` body: `{"ref":"<branch>"}` |
| 查流水线状态 | GET | `/api/v4/projects/{id}/pipelines/{pipeline_id}` |
| 查流水线作业 | GET | `/api/v4/projects/{id}/pipelines/{pipeline_id}/jobs` |
| 查作业日志 | GET | `/api/v4/projects/{id}/jobs/{job_id}/trace` |
| 列项目 | GET | `/api/v4/projects?membership=true&per_page=50` |
| 重试作业 | POST | `/api/v4/projects/{id}/jobs/{job_id}/retry` |

## 执行流程

### 1. 诊断CI失败

```
1. 列出所有项目最近流水线状态
2. 识别失败流水线，获取失败作业ID
3. 拉取作业日志，提取编译错误摘要
4. 分析根因：依赖顺序 / 代码错误 / Runner缓存
```

### 2. 按依赖顺序部署

**依赖顺序不是固定的，根据代码修改范围动态计算：**

1. **分析修改范围**：检查哪些项目有代码变更（git diff / commit log）
2. **计算依赖图**：从变更项目向上追溯所有依赖方，按依赖层级拓扑排序
3. **分层部署**：每层内部可并行，层间必须等前层全部成功
4. **轮询状态**：每20秒检查一次，直到所有流水线完成
5. **处理失败**：Runner缓存问题直接重试，代码问题报错退出

### 3. Runner缓存问题处理

当错误信息包含以下模式时，为Runner缓存问题：
- `No such file or directory` + `/data/maven/repository/`
- `unable to access file` + `.jar`

**处理方式**：直接重触发流水线（可能分配到不同Runner节点），最多重试3次

## 错误诊断模式

| 错误特征 | 根因 | 处理方式 |
|---------|------|---------|
| `package X does not exist` + 多服务同时报 | 依赖顺序问题 | 按依赖顺序重触发 |
| `No such file or directory` + `/data/maven/repository/` | Runner缓存缺失 | 重触发流水线 |
| `Compilation failure` + 单服务报 | 代码编译错误 | 修复代码后重触发 |
| `bad class file` + `unable to access` | Runner本地jar损坏 | 重触发流水线 |

详细规范请参考 [reference.md](./reference.md)
