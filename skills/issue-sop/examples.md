# 示例：项目变更问题表闭环

## 场景

用户说：我是孙志强，腾讯文档里我名下待处理的问题帮我梳理。

目标不是只列出问题，而是逐条给出：属实/误报、根因、修复归属、验证结果，最后回写文档。

## 读取与筛选

PMS 固定维护两份文档，梳理时必须两份都查、全部 tab 都查：

- 读取 `config/issue_docs.json`，按配置里的 `file_id`、`tabs`、`header_row`、`responsibility_column`、`status_column` 执行。
- 默认遍历全部 tab（含隐藏），责任列筛选 `match_person`（孙志强）。
- URL 里的 `?tab=` 只是打开时定位，不是扫描范围。

步骤：

- 对两份文档分别 `sheet_get_sheet_info`，遍历配置里的全部子表（含隐藏）。
- 每个子表按配置的 `header_row` 定位表头，再按表头名称找责任列和状态列。
- `sheet_get_cell_data` 读取数据行，`return_csv=true`。
- 筛选责任列包含「孙志强」的行；状态按需过滤（待处理 / 待解决 / 待确认）。
- 汇总时标明文档 / 子表 / 行号；UAT1 隐藏副本按问题描述去重。

注意：如果用户昵称和表内姓名对不上，先用 AskUserQuestion 确认，不要猜。

## 逐条验证

对每条问题收集证据：

- 规格：Excel 逐格看 `cell.font.strike`，确认需求是否作废。
- 代码：codegraph 找 Controller/Service/前端组件，Grep 精确读关键行。
- 数据库：DBX 查 `t_node_field_permission` 的真实 `is_required / is_readonly / is_hidden / condition`。
- 单据数据：查 `t_wf_project_change` 对应表单号，确认字段实际值。

示例结论：

- 某条「退回后提示某字段必填」：后端节点保存取数未过滤 `condition`，配置里条件字段全被当成无条件必填；属实，后端 + 配置。
- 某条「项目编号应置灰」：前端输入框只绑了 `readonly`，没有 `:disabled`；属实，纯前端。
- 某条「区域展示」：配置已按节点控制，但前端门禁用错字段；部分属实。
- 某条「加签总裁条件」：字段权限已配，但“仅混合变更”逻辑未落地；需流程包或前端。
- 某条「人员自动带出」：接口已返回 `currentPersonnel / plannedSavingPersonnel / isPersonnelOptimization`，前端 `setProjectData` 未映射；前端。

## 修复与验证

- 后端：改取数口径，编译 + 定向单测。
- 配置：条件字段加 `condition='Y'`，保留 `is_required='Y'` 让前端可见时仍必填。
- E2E：拿现有单走详情 → `afterSave`（申请人提交）→ `complete`；确认 `current_node_id` 从 `T_Applicant` 流转到下一个节点。
- 部署：确认流水线成功；否则代码修复不生效。

## 回写备注

备注只追加，前缀是备注作者本人：

```text
这个项目是没有IT项目经理，不知道和这个有没有关系
孙志强2026-11-07：后端必填取数已统一（节点保存补齐 condition 分流），UAT/TEST 字段权限已对齐。
孙志强2026-11-09：E2E XMBG-202611-0040 申请人重新提交成功，已流转至主管节点，未再提示「变更后IT经理必填」。
```

责任人列如果是「常欢」，备注仍写「孙志强」——**责任人 ≠ 备注作者**。规则是：谁回复/谁操作，备注就署谁。

## 回写责任人列

按 `tencent-docs` 的人员列规则执行清空 → 写入 → 读回；本技能只决定是否改、改成谁。

## 收尾

- 列出仍未闭环的项及归属（前端/后端/流程包）。
- 清理临时脚本、登录 token 缓存。
- 复核 git 工作区，不提交未授权改动。
- 用户确认后再改状态为「关闭」。