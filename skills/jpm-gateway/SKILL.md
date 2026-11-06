---
name: jpm-gateway
description: JPM（集团项目管理）系统网关入口与环境规律参考——UAT/SIT 直连域名、PMS 相关 EX 接口契约、经 API 中心的调用链排查。当需要直连 JPM 验证数据、排查 PMS→JPM 取数为空、核对里程碑/交付物接口返回时使用
user-invocable: false
---

# jpm-gateway：JPM 网关入口与环境规律

## 环境域名（办公网可直连，无需内网跳板）

- UAT：`http://jpm-uat.jomoo.cn`
- SIT：`http://jpm-test.jomoo.cn`
- **必须用 http**，https 连接失败（实测）

## PMS 相关 EX 接口（免鉴权直连可用）

- `POST /api/project/ex/pms/getMilestoneByProjectIds` —— 按项目查里程碑
- `POST /api/project/ex/pms/getDeliverableByProjectIds` —— 按项目查交付物
- 请求体：项目 ID 字符串数组 `["id1","id2"]`
- 返回：按项目 ID 分 key 的 Map，字段含 `firstMilestonePlanStartDate` / `firstMilestoneRealStartDate` / `lastMilestonePlanEndDate` / `lastMilestoneRealEndDate` / `milestones` 明细数组

## 生产调用链与排查

- 链路：PMS → API 中心 → JPM
- 直连通而经 API 中心断时，优先查 API 中心转发配置与**订阅环境绑定**（API 中心环境切换后订阅需重新上下架刷新，见 api-center-register 技能硬约束第 9 条）
- 空数据先分层验证：JPM 直连 → API 中心在线调试 → PMS 透传接口（方法见 use-yaak 技能 examples.md「跨系统数据链路断点排查法」）

## 数据表速查（UAT 库 172.17.95.157/tc11test @ JOMOOGPM_UAT）

- 里程碑：`T_PLN_MILSTN`（项目ID / 序号 SN / 里程碑名 / 计划起止 / `REALENDDATE`；实际开始日期不在本表，接口的 realStartDate 从任务侧取）
- 运行项目：`T_RUN_PROJECT`（项目编码/ID）
- ⚠️ `ORDER BY PROJECTID` 是十六进制字符串排序，勿凭查询输出顺序臆断多项目的归属对应关系（实案踩坑：把两个项目的里程碑归属判断反了）

## 实测案例（2026-10 结项汇总里程碑断点）

- 直连 UAT：HTTP 200，ee9a2045 项目返回完整里程碑（实际开始 2026-10-20 / 实际结束 2026-10-28）
- API 中心在线调试同报文：code:500「网络繁忙」executionTime=0 → 断点在转发层
- 根因：API 中心接口环境切换（test→uat）后订阅未重新上下架刷新，调用仍路由旧环境
