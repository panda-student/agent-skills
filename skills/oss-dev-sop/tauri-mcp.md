# Tauri MCP：驱动 OpenIDEA 应用做 GUI 验证

oss-dev-sop 的 GUI 验证统一走本方案。项目侧规范（AGENTS.md）也要求 Tauri MCP 优先，agent-browser / Computer Use 只在 MCP 不可用时兜底。

## 方案与依赖

MCP server 用社区的 `@hypothesi/tauri-mcp-server`，配合应用内嵌的 `tauri-plugin-mcp-bridge`（`src-tauri/Cargo.toml` 已声明，无需另装）。

| 依赖 | 说明 |
|---|---|
| 应用侧插件 | `tauri-plugin-mcp-bridge`，随应用编译自带；版本见 `src-tauri/Cargo.toml`（当前 0.13 系） |
| MCP server | `@hypothesi/tauri-mcp-server`（npm），**版本与插件同 minor**（当前 0.13.x），不匹配会告警 |
| 运行时 | Node（建议固定安装 server 到本地目录；也可 `npx` 按需拉起） |
| 起应用 | `pnpm dev:app`（不是 `pnpm tauri dev`）：GUI 验证要在 `execute_js` 里用 `window.__TAURI__` 全局 API，只有 `dev:app` 开启它 |

## 安装与配置（工具没有时照此指导）

按客户端把条目加到用户级配置（对所有 worktree 生效、不进仓库）：

- Claude Code：`~/.claude.json` → `mcpServers`
- ZCode：`~/.zcode/cli/config.json` → `mcp.servers`

```json
"tauri": {
  "type": "stdio",
  "command": "D:/nodejs/node.exe",
  "args": ["D:/mcp/tauri/node_modules/@hypothesi/tauri-mcp-server/dist/index.js"]
}
```

- 版本号按「与插件同 minor」原则对齐后固定（当前 `@hypothesi/tauri-mcp-server@0.13.2`）；应用升级插件后同步改。
- 也可用 `cmd /c npx -y @hypothesi/tauri-mcp-server@0.13.2`，但 Windows 上 `npx` 冷启动/路径更易出问题；固定安装到本地目录再指向 `dist/index.js` 更稳（`npm i --prefix D:/mcp/tauri @hypothesi/tauri-mcp-server@0.13.2 @modelcontextprotocol/sdk`）。
- MCP 工具在**会话启动时**绑定：配置后本会话看不到工具，新开会话自动连接（也可在 设置 → MCP 确认状态）。

配置后冒烟验证（不依赖任何客户端，直接 stdio 握手）：

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.1"}}}' | npx -y @hypothesi/tauri-mcp-server@0.13.2 | head -c 300
```

返回 `serverInfo.name: mcp-server-tauri` 即通。连 ZCode 工具都没有（新会话之前）也可以用裸 stdio JSON-RPC 驱动它：`tools/list` 拿工具清单，`tools/call` 逐个调用，每个调用加超时，`initialize` 后先发 `notifications/initialized`。

## 客户端没有 MCP 工具时：脚本驱动（已验证）

当前会话看不到 MCP 工具时，不必等新会话：用 MCP SDK 起一个客户端脚本直接驱动 server。把脚本放在仓库外（如 `D:/mcp/tauri/tool.mjs`），每次调用一个工具：

```js
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const [name, json] = process.argv.slice(2);
const transport = new StdioClientTransport({
  command: "D:/nodejs/node.exe",
  args: ["D:/mcp/tauri/node_modules/@hypothesi/tauri-mcp-server/dist/index.js"],
  cwd: "D:/mcp/tauri", stderr: "pipe",
});
const client = new Client({ name: "verify", version: "1.0.0" });
await client.connect(transport);
if (name !== "driver_session") await client.callTool({ name: "driver_session", arguments: { action: "start" } });
const r = await client.callTool({ name, arguments: JSON.parse(json || "{}") });
console.log(r.content.map((c) => c.type === "text" ? c.text : `[${c.type}]`).join("\n"));
await client.close();
```

用法：`node tool.mjs webview_screenshot '{"format":"png","filePath":"D:/mcp/tauri/shot.png"}'`、`node tool.mjs webview_interact '{"action":"click","selector":"ref=e24"}'`、`node tool.mjs webview_execute_js '{"script":"(() => document.title)()"}'`。

- **session 存在 server 进程内**：每个脚本进程都是新的 server，必须自己先 `driver_session start`；不能复用上一个脚本的连接。
- 会话中途新增的 MCP 配置对当前会话不生效，脚本驱动是绕过这个限制的标准手段。

## 使用流程

```text
pnpm dev:app（后台起应用）
→ pnpm dev:status（轮询到 bridges[].appIdentifier，端口 9223 起）
→ driver_session start（带 appIdentifier）
→ manage_window focus（截图/计时敏感步骤前必须，否则后台窗口节流、截图可能黑屏）
→ webview_execute_js / webview_dom_snapshot / webview_interact / webview_screenshot …
→ driver_session stop（必须带 appIdentifier；server 是多会话共享的，不带会停掉别人的）
```

常用工具：`driver_session`、`webview_execute_js`、`webview_dom_snapshot`、`webview_interact`、`webview_keyboard`、`webview_wait_for`、`webview_screenshot`（可 `filePath` 落盘）、`manage_window`、`ipc_execute_command`、`read_logs`。

就绪判定：应用日志出现 `[MCP][WS_SERVER] WebSocket server listening on: 127.0.0.1:9223` 或 `netstat -ano | grep 9223` 见 `LISTENING`；`dev:status` 在监听前可能仍报 `bridges: []`，别据此判失败。

项目专属细节（CodeMirror/xterm 不吃 MCP `type`、点击 `event.detail===0`、坐标换算 0.9 等）以仓库内 `.agents/skills/verify` 为准。

## 功能验证（不止截图）

截到 UI 外壳不算验证。UI 变更要驱动到真实交互，并**断言内容**：

- 找到承载该功能的真实数据：agent 相关功能用 `ipc_execute_command` 调 `agent_create`（参数形状见 `src/bindings.ts` 的 `NewAgentTask`）造一个 `isolation: "worktree"` 任务；长命令可能超过 bridge 的 ~2s JS 请求超时，但任务通常已在后端建好——用 Agents 列表 DOM 确认，别当失败。
- 不必等 agent 真跑完：直接在任务 worktree（`<父目录>/<仓库名>.worktrees/<slug>`）里从 shell 写文件/`git commit`，模拟任务改动。注意该 worktree 有仓库自己的 hook，可能触发 `pnpm install` 等，属正常。
- 断言方式：`webview_dom_snapshot` 拿 `ref`，`webview_interact` 点开目标行/菜单，再用 `webview_execute_js` 读 `innerText`、行数、`aria-*` 等关键值；每一步留 before/after 截图。
- **必须打开真实内容**：例如双击 commit 打开 diff 后，断言 diff 正文出现预期新增行，而不是只看 tab 标题。
- 交互链路要覆盖：默认视图、切换视图（View Options）、提交后自动刷新（worktree 内 commit 经 `.git/worktrees/<name>/HEAD` 触发 `vcsChanged`）、展开 commit、回滚范围。
- 真机暴露的集成缺陷（单测覆盖不到的宿主/仓库注册、路径解析等）要当场回补代码 + 回归测试，并入同一个提交，再重跑断言。

## 已知坑

- 杀掉 `pnpm dev:app` 包装进程不会带走应用：残留的 `openidea.exe` 要按 PID 定点清理（先 `tasklist` 查 PID，再 `taskkill /pid <pid> /t /f`），绝不用进程名批量杀；Vite 死了应用还开着时，webview 一刷新就是空白页，重启会话。
- 每个工具调用都要带 `appIdentifier`（`pnpm dev:status` 报的端口）；多个 worktree 同时跑时端口不固定。
- `execute_js` 检查 `window.__TAURI__` 前提是应用用 `dev:app` 起的。
- 会话中途才配置的 MCP 不生效，重启会话；或在当前会话用「脚本驱动」绕过。
- 脚本驱动时 session 在 server 进程内：每个脚本进程都要先 `driver_session start`。
- `ipc_execute_command` 有约 2s 的 webview 请求超时：`agent_create` 这类慢命令会报 “Script execution timeout”，但后端往往已完成；用 DOM 确认结果，必要时重试或改走 UI。
- `vcs_file_at(path, rev)` 只认项目仓库或已登记的 external log。agent worktree 在项目根之外，**rev 侧 diff 会报 “path is not in an open Git log”**：打开这类 diff 前先调 `vcs_open_external_log(task.cwd)` 登记，否则 diff 正文空白/报错（这正是真机才能暴露、单测覆盖不到的问题）。
- 同一 `diff key` 的旧 tab 会缓存上次的失败结果：修好读取逻辑后，要关掉该 tab 或 reload webview，再重新打开才能看到新结果。
- `webview_find_element` 的 `strategy:"text"` 常命中整棵树容器（命中 innermost interactive ancestor）：先 `webview_dom_snapshot` 取 `ref`，或用 XPath 精确定位 `[class*=_title_]` 之类的具体元素。
- `IconButton` 的可访问名在 `aria-label`（`title` 属性为空）：选择器写 `button[aria-label="View Options"]`，多个同名时用 `nth` 选可见的那个。
