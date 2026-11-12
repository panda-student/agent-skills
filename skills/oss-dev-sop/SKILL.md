---
name: oss-dev-sop
description: 开源项目开发标准流程——以 PR 为人的思考边界与 AI 的交付接口，按 Dev Flow Core 的 PR 循环交付到上游：Define 先读项目约定并立 PR 草稿 → Slice 基于最新 upstream/main 建干净 worktree、机制与行为分离提交 → Prove 分层验证并留证 → Own 自审完整 diff → Trace 按模板开 PR、CI 诊断、截图与收尾。当向开源仓库提 PR、修改上游代码、设计扩展点、review 自己的 diff、排查 PR CI、跟进 PR review 意见直到合并、上传 PR 截图或收尾时自动使用，也可通过 /oss-dev-sop 手动触发。Use when contributing to an open-source repository, changing upstream code, designing extension points, reviewing your own diff, preparing or submitting a pull request, diagnosing failing PR checks, following up on review until merged, uploading screenshots, or cleaning up after a contribution.
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Write
  - Edit
---

# OSS Dev SOP — 开源项目开发标准流程

面向「在 fork 上开发、向上游仓库提 PR」的场景，是 Dev Flow Core「面向 PR 编程」循环在开源渠道上的落地。PR 在这里是字面意义的变更单元：先立 PR 草稿定义意图，再切片实现，最后自证与留痕。目标是：改动小、贴合项目、可 review；不把旧分支/已合并内容带进 PR；验证可复现；截图符合仓库惯例；失败能定位；收尾不留垃圾。

> 通用方法与纪律（PR 循环、编码改动原则、AI 以 diff 交付、提交前自审、验证证据、安全红线）由 `dev-flow-core` 技能提供；本文件只保留开源渠道的具体操作，不复写通用内容。

## 流程概览

Define 读项目规范、立 PR 草稿 → Slice 基于最新 upstream/main 开干净 worktree → Prove 分层验证并留证 → Own 自审完整 diff → Trace 按模板开 PR、诊断 CI、跟进 review 直到合并、收尾清理。

编码设计与自审纪律见 `dev-flow-core`；完整命令、门禁清单、截图流程、Tauri MCP 验证见 [pr-workflow.md](./pr-workflow.md)。

## 提交门禁(硬性)

资料不齐不得执行 `gh pr create`；禁止“先提 PR 再补验证/截图”。逐项清单见 [pr-workflow.md](./pr-workflow.md) 的「PR 提交门禁」。

## 路由表

| 需求 | 资源 |
|---|---|
| 面向 PR 编程方法、PR 循环、AI 协作协议、反模式 | `dev-flow-core` 技能 |
| 编码改动纪律、提交前自审 | `dev-flow-core` 技能 |
| PR 完整流程、门禁、提交后跟进、CI 诊断、收尾 | [pr-workflow.md](./pr-workflow.md) |
| PR 截图上传(user-attachments)细节 | [reference.md](./reference.md) |
| GUI 验证 / Tauri MCP | [tauri-mcp.md](./tauri-mcp.md) |
| 临时 worktree 的创建与回收 | `worktree-ops` 技能 |
| 凭据、登录态 | `vault-ops` / `auth-center` 技能 |

## 安全与沟通

- 通用红线（不打印 token/密码/Cookie、对外操作先确认、验证结论可复现）见 `dev-flow-core`；凭据走 `vault-ops` / `auth-center`
- OSS 特有：截图、临时文件、IDE 状态不得进入功能分支；close PR / force push / 删 release 等先确认
