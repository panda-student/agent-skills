# vault-cli

本机凭据密码库（vault.exe）的 CLI 封装。vault.exe 是纯 MCP 二进制（`--mcp` 才起协议），本包经 [mcp-stdio-client](../mcp-stdio-client/) 与其通信，把常用操作暴露成子命令。

> 2026-11-10 拍板：MCP 形态每次换工具都要重复注册，已从 ZCode `cli/config.json` 移除（备份 `config.json.bak-20261110-mcp-remove`），统一走本 CLI。配套技能见 `skills/vault-ops/`。

## 用法

```powershell
vault search pms --tag pms                # 搜条目（只出元数据，永不出密文）
vault get <id>                            # 按 id 读元数据（groups[].id / revision）
vault fill <id> --field password --file out.txt [--mode create|replace] [--group GID]
vault call <tool> '<json>'                # 其余 MCP 工具原样透传
vault tools --json                        # 工具全清单
```

安全设计：密文永不回显、只落目标文件；`--mode replace` 只替换文件中一个 `{{credential}}` 占位符。

## 安装（换机还原）

```powershell
cd ~/.agents/cli/vault-cli
npm install && npm link     # 依赖同仓库的 ../mcp-stdio-client（file: 引用），全局命令落到 /d/nodejs
```

二进制本体 `D:/vault/vault.exe` 与凭据数据 `D:/vault/data` 不随本仓库走；路径变更用环境变量 `VAULT_BIN` 覆盖。
