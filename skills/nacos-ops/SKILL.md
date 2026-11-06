---
name: nacos-ops
description: Jomoo Nacos 注册中心操作参考——dev/uat 环境入口拓扑、服务注册状态排查、无登录 HTTP API 拉取配置、Feign「无实例」排查。当需要查 Nacos 服务注册状态、排查 Feign 报 No instances available/无实例、拉取某服务运行配置（数据库/S3 endpoint 等）、区分 dev 与 uat Nacos 集群、确认服务是否注册到正确环境时使用。
---

# Nacos 注册中心操作参考

## 环境入口拓扑（关键，防误判）

| 环境 | 入口 | 说明 |
|------|------|------|
| UAT Nacos（推荐） | `http://uat-pms.jomoo.com/nacos` | Ingress 入口，办公网可达；namespace 选 `pms-uat` |
| UAT Nacos（集群内） | `http://10.215.38.125:8848/nacos` | ClusterIP，办公网不可达；NodePort `37712`（节点 IP 直连） |
| dev Nacos（外部入口） | `http://10.1.12.33:36032/nacos` | 真实地址 `10.215.221.227`，tenant/namespace 含 `pms-dev`、`pms-uat` 等 |

**最大坑：dev Nacos 外部入口里也有 `pms-uat` 命名空间，但它是空的（正常现象）**。UAT 服务注册在 UAT 集群内的独立 Nacos（10.215.38.125），与 dev Nacos 完全隔离。在 `10.1.12.33:36032` 的 pms-uat 看到 0 个服务 ≠ UAT 没注册服务，查 UAT 注册状态必须走 `uat-pms.jomoo.com/nacos`。

CI 按 dev/uat 分支把服务注册到各自的 Nacos（部署 ConfigMap `nacos-registry` 里 `PMS_NACOS_ADDR`/`PMS_NACOS_NAMESPACE` 可核实），不存在「uat 分支注册到 dev」的情况。

## 常用操作

- 查服务注册：控制台左侧「命名空间」选 `pms-uat`（或 dev 对应 tenant）→ 服务管理 → 服务列表，核对实例 IP 与健康状态。服务注册成功日志格式：`nacos registry, DEFAULT_GROUP <服务名> <IP>:<端口> register finished`
- HTTP API 拉配置（无需登录）：`GET {nacos入口}/nacos/v1/cs/configs?dataId=<服务名>.yaml&group=DEFAULT_GROUP&tenant=<namespace>`，例如拉 `obs-service.yaml` 可拿到 S3 endpoint、数据库地址等运行配置，是排查环境差异的利器

## 排查路径

- Feign 报「No instances available」/「无实例」：先到**目标环境的** Nacos 确认被调服务是否注册、实例是否健康，再查应用侧 Nacos 地址/namespace 配置
- 本地开发服务 Feign 调 obs 等基础服务报无实例：本地连的是 dev Nacos 入口（10.1.12.33:36032），该入口的 pms-uat tenant 本来就没有实例——不是故障，是拓扑
