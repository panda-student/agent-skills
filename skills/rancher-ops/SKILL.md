---
name: rancher-ops
description: Jomoo Rancher 容器平台操作指南——通过 rancher MCP 查看 Pod 日志、确认 CI 部署是否生效、查镜像 tag、核实 ConfigMap 注入配置、排查事件与容器健康度、集群容量概览。当需要排查线上 Pod/服务问题、验证部署结果、查 K8s 资源、判断 Pod Running 但功能异常、管理 Rancher API Token 时使用。容器内 Execute Shell 等未开放操作走浏览器兜底。
---

# Rancher 容器平台操作指南（rancher MCP）

## MCP 接入状态

- Trae 已配置 `rancher` MCP（`@futuretea/rancher-mcp-server`，全局 `D:\nodejs\rancher-mcp-server.cmd`），日常操作**优先走 MCP，不再开浏览器**
- 安全默认：`read_only=true`（无创建/修改/删除），Secret 值默认脱敏（`***`），容器 exec/文件上传下载未开启
- 需要放开容器执行时：mcp.json 的 `args` 增加 `--read-only=false --enable-container-exec`（先与用户确认）

## 环境常量

- Rancher Server：`https://rancher.jomoo.com`（v2.13.9-ent），API 端点 `/v3`
- 集群：`c-9g5pt`（jm-c1-non-prod，RKE2 v1.33.12）
- PMS 相关 namespace：`pms-uat` / `pms-dev`
- 认证：Bearer Token 存 `vault-ops` 条目「Rancher API Token (Trae MCP)」（TTL 90 天，约 2027-02-02 过期）；取用按 `vault-ops` 技能，常驻配置只允许占位符注入，禁止手输、回显或提交仓库

## 场景 → 工具映射

- 看容器日志：`kubernetes_logs`——支持 tail 行数、时间范围、时间戳、**关键词搜索**；支持 label selector 聚合多 Pod 日志（排查 Deployment 全实例时用）
- 确认 CI 部署是否生效：`kubernetes_get` 查 Deployment/Pod 镜像 tag（格式 `日期-流水号`，如 `20261016-26484`）+ Pod 启动时间；前端项目结合 dist 资源 hash（如 `index-fXGSY3Z6.js`）判断线上是否为新构建；`kubernetes_rollout_history` 看发布历史
- 核实注入配置：`kubernetes_get` / `kubernetes_describe` 查 namespace 下 ConfigMap（如 `nacos-registry` 的 `PMS_NACOS_ADDR`/`PMS_NACOS_NAMESPACE`、JAVA_OPTS 等）；`kubernetes_get_all` 一把梭列全量资源
- 排查异常事件：`kubernetes_events`（按 namespace/对象/kind 过滤）+ `kubernetes_event_summary`（按 reason/kind/频次归并，识别重复性问题）
- 健康度判断：`kubernetes_workload_health`（Deployment/StatefulSet/DaemonSet ready/desired 比例）+ `kubernetes_top`（按 CPU/内存/重启次数排名）+ `kubernetes_node_analysis` / `kubernetes_capacity`（节点与集群容量水位）+ `kubernetes_inspect_pod`（Pod 与父工作负载、指标、日志一站式）
- 资源详情与血缘：`kubernetes_describe`（含关联事件，等价 kubectl describe）+ `kubernetes_dep`（依赖/被依赖树）
- 版本对比与监听：`kubernetes_diff` / `kubernetes_resource_diff`（两版本 git 风格 diff）+ `kubernetes_watch`（周期监听变更）
- 全局视角：`cluster_list`（多集群列表）+ `project_list`（Rancher 项目）

## 关键判断原则

- **Pod `Running` ≠ 功能正常**：obs-service 容器一直存活，但每次调 S3 都 SSL 失败。判断服务是否真健康必须看日志中的业务报错（`kubernetes_logs`），不能只看容器状态
- **部署生效判定**：镜像 tag 变化 + Pod 启动时间晚于本次代码推送时间，两者同时满足才算新版本已生效；Pod 创建时间早于推送时间 = 仍跑旧代码。实例：2026-10-21 工程采购删列，推送 19:51:28，新 Pod 19:53:32（tag `20261021-27688`）启动后才执行 `DROP COLUMN`
- **接口特征自证生效（MCP/token 均不可用时的替代路径，2026-11-02 实证）**：若本次新代码引入**响应独有特征**（新字段/字段取值来源变化），直接对线上接口发请求、响应含新特征即可自证新代码已生效，不必强等确认 Pod 镜像。实例：需求台账实时化改造，`page` 接口响应 `id==sourceDetailId`（新代码独有，旧代码 id 为物化表主键）+ `budgetSubjectName` 回填生效 → 新代码在线上运行。证据链三件套：① 响应特征字段 ② 库源表逐字段对照（接口行值=SQL 直查源表行值）③ 全量行数对照（库去重行数=接口 `total`）
- **容器重启只重建应用容器**，解决不了依赖端问题（对象存储、数据库、证书、网络）。重启前先想清楚根因在哪个端

## 典型排查案例

- 附件上传全环境 500，相关 Pod 全部 Running：obs-service 日志发现 `SSLHandshakeException`（`CertificateExpiredException` 或 `PKIX path building failed`）→ 根因在对象存储网关证书，与服务容器无关。补充：浏览器验证证书「生效」不可靠（浏览器有 AIA fetching 自动补链），JVM/Node 不做 AIA，服务器必须下发完整证书链（叶子+中间证书），验证方法为对端点做严格 TLS 握手（`rejectUnauthorized: true`，回传证书数应 ≥2）
- 疑似「服务没注册到正确环境」：MCP 查 ConfigMap 核实 Nacos 地址与 namespace 配置（服务注册侧排查见 nacos-ops 技能）

## Token 管理与轮换

- Token 过期症状：MCP 工具调用报 401/Unauthorized
- 轮换流程：浏览器登录 Rancher → 头像 → Account and API Keys → 创建新 Key（No Scope，90 天）→ 按 `vault-ops` 技能把新值以占位符注入 `C:\Users\JOMOO\AppData\Roaming\Trae CN\User\mcp.json` 的 `RANCHER_MCP_RANCHER_TOKEN`（先写占位符骨架，禁止手输明文）→ 同步更新 `vault-ops` 条目 → 重启 Trae 或刷新 MCP
- 旧 token 惰性清理：Account and API Keys 列表删除失效条目

## 浏览器兜底路径（仅 MCP 覆盖不了时）

- 进容器 Execute Shell：MCP 的 exec 未开启，需浏览器 `https://rancher.jomoo.com/dashboard/c/c-9g5pt/explorer/pod/<namespace>/<pod名>#containers`（JDK 自带 keytool，Ubuntu 镜像带 openssl）
- 全量 Pod 列表入口：`https://rancher.jomoo.com/dashboard/c/c-9g5pt/explorer/pod`（**此入口最稳**；注意 `.../explorer/pod/<namespace>` 不带 pod 名可能整页空白，不要用它判断部署状态）
- 注意：Rancher OIDC 会话过期时浏览器自动化会被挡登录页，此时优先用 MCP（API Token 不受 OIDC 会话影响）或「接口特征自证」路径
