---
name: oss-dev-sop
description: "开源项目开发标准流程——编码改动原则 + 向上游提交 Pull Request：先读项目约定、开闭原则能加不改、保留既有命名、逻辑并入已有职责模块、贴合局部写法、显式配置优先于启发式、新增分支必须有回落与回归测试、机制与行为分开提交；以及分支拓扑、基于最新 upstream/main 的干净 worktree、分层验证、Conventional Commits、PR 模板与验证证据、CI 失败诊断、user-attachments 截图上传和收尾清理。当向开源仓库提 PR、修改上游代码、设计扩展点、review 自己的 diff、排查 PR CI、上传 PR 截图或收尾时自动使用，也可通过 /oss-dev-sop 手动触发。Use when contributing to an open-source repository, changing upstream code, designing extension points, reviewing your own diff, preparing or submitting a pull request, diagnosing failing PR checks, uploading screenshots, or cleaning up after a contribution."
---

# OSS Dev SOP — 开源项目开发标准流程

面向“在 fork 上开发、向上游仓库提 PR”的场景。先收敛代码改动,再走提交与 PR 流程。目标是:改动小、贴合项目、可 review;不把旧分支/已合并内容带进 PR;验证可复现;截图符合仓库惯例;失败能定位;收尾不留垃圾。

## 编码改动原则(先于 PR 流程)

- 先读项目约定,再设计机制
- 开闭原则,能加不改
- 保留既有命名
- 放进已负责该职责的模块
- 贴合局部写法
- 显式配置优先于启发式
- 每个新分支都要有回落
- 机制与行为分开提交

判断依据、反模式、自审清单和实战案例见 [coding-principles.md](./coding-principles.md)。

## PR 流程概述

读项目规范 → 查基线与旧分支 → 基于最新 upstream/main 建干净 worktree → 移植/提交 → 分层验证 → 推送 fork 并开 PR → CI 诊断 → 收尾清理。

完整步骤、命令、门禁、截图流程和 Tauri MCP 验证见 [pr-workflow.md](./pr-workflow.md)。

## 提交门禁(硬性)

- 一个 PR 只解决一个问题;标题符合 Conventional Commits
- PR 模板每个 section 有实质内容;`How it was verified` 必填
- 验证证据:实际命令 + 结果;UI 变更 before/after 截图或录屏;未做的验证要写明
- 本地已跑项目要求/CI 会跑的检查;说明哪些检查 skipped 及原因
- 截图、临时文件、IDE 状态未进入功能分支

资料不齐不执行 `gh pr create`;禁止“先提 PR 再补验证/截图”。

## 路由表

| 需求 | 资源 |
|---|---|
| 编码原则、反模式、自审清单 | [coding-principles.md](./coding-principles.md) |
| PR 完整流程、门禁、CI 诊断、收尾 | [pr-workflow.md](./pr-workflow.md) |
| PR 截图上传(user-attachments)细节 | [reference.md](./reference.md) |
| GUI 验证 / Tauri MCP | [tauri-mcp.md](./tauri-mcp.md) |
| 临时 worktree 的创建与回收 | `worktree-ops` 技能 |
| 凭据、登录态 | `vault-ops` / `auth-center` 技能 |

## 安全与沟通

- 不打印 token、密码、Cookie;凭据走 `vault-ops` / `auth-center`
- force push、删分支/release/Pages、关闭 PR、发评论等对外可见操作先确认
- 验证结论必须可复现;旧故障与本次改动无关时单独说明,不混入本次结论

## 使用顺序

先用 [coding-principles.md](./coding-principles.md) 完成设计与自审 → 再按 [pr-workflow.md](./pr-workflow.md) 走基线与提交 → PR 打开后按其 CI 诊断与收尾章节处理。