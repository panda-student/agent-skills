# Agent Skills

个人使用的 Agent 技能集合，每个技能是一个独立文件夹，包含 `SKILL.md` 定义文件。

## 技能列表

### 代码与交付

| 技能 | 说明 | 文档 |
|------|------|------|
| [pms-dev-sop](skills/pms-dev-sop/) | PMS 项目开发交付 SOP：受理分诊 → 方案 → TDD 实施 → 评审 → 合并推送 → 禅道闭环 | [查看](skills/pms-dev-sop/SKILL.md) |
| [simplify](skills/simplify/) | 代码审查工具，分级策略 + 多维度并行审查（复用/单一职责/质量/性能） | [查看](skills/simplify/SKILL.md) |
| [vitest](skills/vitest/) | 前端 vitest 单测经验（.vue 组件测试配置与依赖隔离） | [查看](skills/vitest/SKILL.md) |
| [cherry-pick](skills/cherry-pick/) | 按禅道编号挑选特性分支提交同步到当前分支 | [查看](skills/cherry-pick/SKILL.md) |
| [gitlab-operate](skills/gitlab-operate/) | GitLab CI/CD 流水线触发、轮询、日志查看与按序部署 | [查看](skills/gitlab-operate/SKILL.md) |
| [start-pms-backend](skills/start-pms-backend/) | 本地正确启动 PMS 后端（pms-service） | [查看](skills/start-pms-backend/SKILL.md) |
| [pms-menu-config](skills/pms-menu-config/) | JMBOS 平台菜单配置 SOP，使前端新页面的动态路由可访问 | [查看](skills/pms-menu-config/SKILL.md) |
| [livebos](skills/livebos/) | 梳理 LiveBOS 工作区中业务对象/流程的逻辑（需显式 `/livebos`） | [查看](skills/livebos/SKILL.md) |

### 问题验证与测试

| 技能 | 说明 | 文档 |
|------|------|------|
| [verify-issue](skills/verify-issue/) | PMS 缺陷受理验证与同类问题排查 | [查看](skills/verify-issue/SKILL.md) |
| [e2e-ops](skills/e2e-ops/) | 通用 E2E / 自动化验证方法论（分层验证） | [查看](skills/e2e-ops/SKILL.md) |

### 接口与运维

| 技能 | 说明 | 文档 |
|------|------|------|
| [yaak-ops](skills/yaak-ops/) | 接口任务的执行 SOP 与验证方法（基于 yaak CLI） | [查看](skills/yaak-ops/SKILL.md) |
| [api-ops](skills/api-ops/) | 接口联调相关执行 SOP，统一以 yaak 处理 | [查看](skills/api-ops/SKILL.md) |
| [api-center-register](skills/api-center-register/) | 九牧 API 中心后台通过浏览器自动化注册接口 | [查看](skills/api-center-register/SKILL.md) |
| [rancher-ops](skills/rancher-ops/) | Rancher 容器平台：查看 Pod 日志、确认部署是否生效 | [查看](skills/rancher-ops/SKILL.md) |
| [nacos-ops](skills/nacos-ops/) | Nacos 注册中心：入口拓扑与服务注册状态排查 | [查看](skills/nacos-ops/SKILL.md) |
| [ibpm-ops](skills/ibpm-ops/) | 通过 ibpm-cli 查询/修改宏天 IBPM 流程定义与运行时实例 | [查看](skills/ibpm-ops/SKILL.md) |
| [manage-ibpm-flow](skills/manage-ibpm-flow/) | 通过 ibpm-cli 查询/修改/新建 IBPM 流程定义 | [查看](skills/manage-ibpm-flow/SKILL.md) |

### 文档、工时与办公

| 技能 | 说明 | 文档 |
|------|------|------|
| [daily-report](skills/daily-report/) | 整理标准日报，自动拉取 PMS 三仓库当天提交 | [查看](skills/daily-report/SKILL.md) |
| [weekly-report](skills/weekly-report/) | 周报/日报/下周计划全流程，并生成禅道工时补录草稿 | [查看](skills/weekly-report/SKILL.md) |
| [issue-sop](skills/issue-sop/) | 腾讯文档问题跟进 SOP（PMS 内部测试问题表与 UAT 问题清单） | [查看](skills/issue-sop/SKILL.md) |
| [anyshare-ops](skills/anyshare-ops/) | 通过 anyshare CLI 操作爱数 AnyShare 文档云 | [查看](skills/anyshare-ops/SKILL.md) |
| [qqmail-ops](skills/qqmail-ops/) | 通过脚本操作 QQ 邮箱：读收件箱、搜索邮件 | [查看](skills/qqmail-ops/SKILL.md) |

### 认证

| 技能 | 说明 | 文档 |
|------|------|------|
| [auth-center](skills/auth-center/) | 统一登录与 token 管理入口，覆盖禅道、PMS、AnyShare、IBPM、腾讯文档、API 中心等 | [查看](skills/auth-center/SKILL.md) |

### 元技能（技能管理）

| 技能 | 说明 | 文档 |
|------|------|------|
| [skill-builder](skills/skill-builder/) | 技能的创建、优化、审查与诊断 | [查看](skills/skill-builder/SKILL.md) |
| [learn](skills/learn/) | 会话复盘，把经验教训固化到项目规则或记忆 | [查看](skills/learn/SKILL.md) |
| [cc-switch-sync](skills/cc-switch-sync/) | 修改技能名称/描述后同步 cc-switch 数据库 | [查看](skills/cc-switch-sync/SKILL.md) |
| [task-wrapup](skills/task-wrapup/) | 开发任务收尾：遗留事项登记、临时文件清理与仓库收口 | [查看](skills/task-wrapup/SKILL.md) |
| [oss-sop](skills/oss-sop/) | 维护开源仓库并提交上游 PR 的标准作业流程 | [查看](skills/oss-sop/SKILL.md) |

## CLI 与库

被技能调用的命令行工具与库位于 `cli/`：

| 目录 | 说明 |
|------|------|
| [cli/auth-center](cli/auth-center/) | 统一登录与 token 管理 |
| [cli/pms-cli](cli/pms-cli/) | PMS 命令行 |
| [cli/anyshare-cli](cli/anyshare-cli/) | AnyShare 文档云命令行 |
| [cli/ibpm-cli](cli/ibpm-cli/) | 宏天 IBPM 流程命令行 |
| [cli/zentao-cli](cli/zentao-cli/) | 禅道命令行 |

## 目录结构

```
.agents/
├── skills/                 # 技能，每个技能一个文件夹
│   └── <技能名>/
│       ├── SKILL.md        # 技能定义（必需）
│       ├── references/     # 参考文档（可选）
│       └── scripts/        # 脚本（可选）
├── cli/                    # 技能依赖的 CLI / 库
└── README.md
```

## 添加新技能

1. 在 `skills/` 下创建以技能名命名的文件夹
2. 添加 `SKILL.md`（frontmatter 中填写 `name` 与 `description`）
3. 在本文件对应分组中补充一行

## 安装技能

```bash
# 克隆仓库
git clone https://github.com/panda-student/agent-skills.git ~/.agents

# 将需要的技能复制到你所用 Agent 的技能目录（以 Claude Code 为例）
cp -r ~/.agents/skills/<技能名> ~/.claude/skills/
```
