---
name: dev-flow-core
description: 面向 PR 编程的通用开发流程核心——把 PR（变更单元）当作人的思考边界与 AI 的交付接口，防止 AI 编码时代代码变黑盒。核心循环：Define 立单（先写 What/Why/验收再写代码）→ Slice 切片（机制与行为分离、最小可读 diff）→ Prove 自证（TDD + 分层验证 + 验证证据）→ Own 认领（reviewer 视角读 diff、解释不了不合入）→ Trace 留痕（变更信息即考古层）。含编码改动纪律、提交前自审、AI 以 diff 交付的协作协议与反模式。修改任何代码、设计扩展点、用 AI 生成代码、自审 diff、准备提交、分层验证、收尾时自动使用；也可 /dev-flow-core 手动触发。渠道操作（上游 PR/CI vs 公司禅道/UAT）见对应领域 SOP。
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
---

# Dev Flow Core — 面向 PR 编程

AI 编码时代，代码产出速度超过人的理解速度。本技能把 **PR（变更单元）当作编码的第一公民**：它既是人的**思考边界**（先定义再实现），也是 AI 的**交付接口**（AI 出 diff，人审 diff）。所有交付渠道复用同一循环，只是变更单元载体不同（开源 = PR；公司 = MR / 提交集 / 提测单）。

## PR 循环

Define 立单 → Slice 切片 → Prove 自证 → Own 认领 → Trace 留痕

方法、规则、AI 协作协议、反模式与检查表见 [pr-oriented-programming.md](./pr-oriented-programming.md)。

## 三个支点

- 意图先于实现（人的思考边界）
- 切片小到可读（可审的交付单元）
- 理解责任在人（AI 出 diff，人审并认领每一处）

## 编码改动纪律（摘要）

先读项目约定再设计机制 · 开闭原则能加不改 · 保留既有命名 · 逻辑并入已负责该职责的模块 · 贴合局部写法 · 显式配置优先于启发式 · 每个新分支都要有回落 · 机制与行为分开提交。判断依据、反模式与提交前自审清单见 [coding-principles.md](./coding-principles.md)。

## 路由表

| 需求 | 资源 |
|---|---|
| 面向 PR 编程方法、PR 循环、AI 协作协议、反模式、检查表 | [pr-oriented-programming.md](./pr-oriented-programming.md) |
| 编码原则、反模式、提交前自审清单 | [coding-principles.md](./coding-principles.md) |
| worktree 建树 / 盘点 / 回收 | `worktree-ops` 技能 |
| 代码评审 / 简化 | `simplify` 技能 |

## 边界

本技能定义与渠道无关的方法与纪律，不绑定具体工具命令。仓库专属规范、上游 PR 流程、公司工具（dbx / yaak / zentao 等）、部署后终验由对应领域 SOP 或项目规则提供；渠道 SOP 引用本技能，而不复写。
