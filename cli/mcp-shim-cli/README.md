# mcp-shim-cli

把「只讲 MCP 协议（stdio JSON-RPC）」的二进制封装成本地 CLI。当前承载两个 profile：

| 全局命令 | 底层二进制 | 用途 | 配套技能 |
|---|---|---|---|
| `vault` | `D:/vault/vault.exe --mcp` | 凭据密码库（搜索/读元数据/密文落文件） | `skills/vault-ops/` |
| `dbx` | `@dbx-app/mcp-win32-x64/bin/dbx-mcp.exe` | 数据库 / Redis / Nacos 客户端 | `skills/dbx-ops/` |

> 背景（2026-11-10 拍板）：MCP 形态每次换工具（ZCode/Trae/其他）都要重复注册，已从 ZCode `cli/config.json` 移除（备份 `config.json.bak-20261110-mcp-remove`），统一走本 CLI。

## 用法速览

```powershell
# dbx（数据库）
dbx connections                                   # 连接清单（pms-uat=UAT业务库 sys）
dbx query --conn pms-uat "SELECT …"               # 查询（--rows 1000 --cell 4000 放宽上限）
dbx batch --conn pms-uat "stmt1; stmt2;"          # 多语句脚本
dbx describe --conn pms-uat TABLE                 # 表结构
dbx call dbx_nacos_get_config '{"connection_name":"pms-uat-nacos","namespace":"pms-uat","data_id":"pms-service.yaml","group":"DEFAULT_GROUP"}'
dbx tools --json                                  # 31 个工具全清单（写 call 参数前先查）

# vault（凭据）
vault search pms --tag pms                        # 搜条目（只出元数据，永不出密文）
vault fill <id> --field password --file out.txt   # 密文写入文件（不回显）
vault tools --json
```

## 结构

- `bin/cli.js` — profile 路由 + 别名子命令（query/batch/describe/tables/connections/search/get/fill/tools/call）
- `bin/vault.js` / `bin/dbx.js` — 入口（各传自己的 profile）
- `lib/mcp-client.js` — 最小 MCP stdio 客户端（spawn 二进制 → initialize → tools/list → tools/call，按行分隔 JSON-RPC）

## 安装（换机还原）

```powershell
cd ~/.agents/cli/mcp-shim-cli
npm link        # 全局命令落到 /d/nodejs
```

二进制本体不在本仓库：vault.exe 与 DBX 安装目录随机器各自维护；路径变更用环境变量 `VAULT_BIN` / `DBX_BIN` 覆盖，无需改代码。

## 新增 profile

在 `bin/cli.js` 的 `PROFILES` 加一项 + `bin/<name>.js` 一行入口 + package.json bin 声明，然后 `npm link`。
