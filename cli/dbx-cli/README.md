# dbx-cli

数据库 / Redis / Nacos 客户端（DBX）的 CLI 封装。DBX 的 MCP 二进制只讲 MCP 协议，本包经 [mcp-client](../mcp-client/) 与其通信，把常用操作暴露成子命令。

> 2026-11-10 拍板：MCP 形态每次换工具都要重复注册，已从 ZCode `cli/config.json` 移除（备份 `config.json.bak-20261110-mcp-remove`），统一走本 CLI。配套技能见 `skills/dbx-ops/`。

## 用法

```powershell
dbx connections                                   # 连接清单（pms-uat=UAT业务库 sys）
dbx query --conn pms-uat "SELECT …"               # 查询（--rows 1000 --cell 4000 放宽上限）
dbx batch --conn pms-uat "stmt1; stmt2;"          # 方言感知分句的多语句脚本
dbx describe --conn pms-uat TABLE                 # 表结构
dbx call dbx_nacos_get_config '{"connection_name":"pms-uat-nacos","namespace":"pms-uat","data_id":"pms-service.yaml","group":"DEFAULT_GROUP"}'
dbx tools --json                                  # 31 个工具全清单（写 call 参数前先查）
```

连接清单由 DBX 桌面端配置托管，CLI 直接复用；`dbx_execute_and_show` 需要 DBX 桌面端运行中，其余均可无头执行。

## 安装（换机还原）

```powershell
cd ~/.agents/cli/dbx-cli
npm install && npm link     # 依赖同仓库的 ../mcp-client（file: 引用），全局命令落到 /d/nodejs
```

二进制本体随 DBX（`@dbx-app/mcp-win32-x64`）安装位置各自维护；路径变更用环境变量 `DBX_BIN` 覆盖。
