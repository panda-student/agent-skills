# use-yaak 覆盖恢复说明（自定义，非 CLI 生成）

> 定位（2026-11-04）：接口任务经验（SOP/验证方法论/执行规则/踩坑）已**全部迁至 `yaak-ops` 技能（经验 SSOT）**，本文件不再承载经验内容，仅保留 CLI 覆盖还原说明。
> **注意（2026-11-04 实证）：`yaak agent install`（2026.9.1 起）会清空整个技能目录并重写 SKILL.md，本文件会一并被删除**（此前「只覆盖 SKILL.md」的认知作废）。
> **权威备份**：`d:\IdeaProjects\jomoo-ai-coding\code_workspace\.trae\skills\use-yaak-reference.md`——本文件变更后必须同步备份；`yaak agent install` 后从此处复制还原。

## 覆盖还原步骤

`yaak agent install` 清空技能目录后，还原两处：

- SKILL.md description：在原文末尾追加中文触发词 `接口相关任务（接口联调、验证接口、请求调试、接口自动化、接口测试、导出文件校验、跨系统数据断点排查）一律使用 yaak 处理：构建、发送、保存复用、链式依赖、批量执行、环境切换全走 yaak；执行 SOP 与验证方法论见 yaak-ops 技能。`
- SKILL.md 尾部按原样还原 `## 自定义规约入口（自定义，非 CLI 生成，覆盖后需还原）` 两条 bullet：
  - 接口任务 SOP、验证方法论、执行规则、踩坑经验**全部在 `yaak-ops` 技能维护（经验 SSOT）**，动手前先读它；本技能只承载 yaak 命令/字段细节，以 CLI 自描述为准
  - `yaak agent install`（2026.9.1 起）会清空整个技能目录：本段落与 description 中文触发词会被删——还原方法见 [reference.md](./reference.md)（权威备份 `d:\IdeaProjects\jomoo-ai-coding\code_workspace\.trae\skills\use-yaak-reference.md`）
- 本文件（reference.md）：从权威备份复制回技能目录

## 经验维护去向

- SOP/方法论/执行规则/踩坑 → `yaak-ops` 技能（SSOT，不受 CLI 覆盖影响）
- yaak 命令/字段/模板函数 → 以 CLI 自描述为准（`yaak <command> --help`）；CLI 版本升级后重跑 `yaak agent install` 刷新本技能
