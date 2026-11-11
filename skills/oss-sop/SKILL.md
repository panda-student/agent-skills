---
name: oss-sop
description: "维护开源仓库代码并提交上游 Pull Request 的标准作业流程（SOP）：先读 CONTRIBUTING/AGENTS/PR 模板并按其要求执行、收集齐全 PR 材料（模板各 section、验证证据、截图）后才提交、分支拓扑与旧分支排查、基于最新 upstream/main 建干净 worktree、git apply -3 移植改动、分层验证、Conventional Commits 提交、推送 fork 并在上游开 PR、CI 失败诊断、按仓库惯例用 user-attachments 上传截图、收尾清理。Use when contributing to an open-source repository, reading a project's contribution guidelines or PR template, porting or rebasing a feature branch onto upstream main, preparing or submitting a pull request, diagnosing failing PR checks, uploading screenshots to a PR, or cleaning up after a contribution."
---

# OSS SOP — 开源仓库维护标准流程

面向“在 fork 上开发、向上游仓库提 PR”的场景。目标是：不把旧分支/已合并内容带进 PR，验证可复现，截图符合仓库惯例，失败能定位，收尾不留垃圾。

## 先读项目规范（强制，提交 PR 前必做）

不要先套用通用流程。先找到并读完项目自己的贡献规范，按项目要求执行：

```bash
ls CONTRIBUTING.md CONTRIBUTING* AGENTS.md CLAUDE.md README.md 2>/dev/null
ls .github/pull_request_template.md .github/ISSUE_TEMPLATE 2>/dev/null
ls .github/workflows 2>/dev/null
```

从中提取并落实到本次工作：

- **PR 粒度与标题**：是否要求一个 PR 只解决一个问题；标题是否用 Conventional Commits。
- **关联 issue**：是否必须 `Closes #<n>`，以及 issue 需要先被 maintainer 接受（如 `planned` 标签）。
- **PR 模板**：严格按 `.github/pull_request_template.md` 的 section 写，不增删 section、不留空。
- **验证要求**：项目要求实际跑哪些命令、是否必须 before/after 截图或录屏、后端是否需要日志/输出、是否要求先复现。
- **提交流程**：分支命名、署名行、CLA/DCO、review/merge 方式。
- **CI 必过项**：从 workflow 的 `pull_request` 触发条件、`paths` 过滤和矩阵确认哪些检查会跑、哪些会 skipped。
- **项目专属规则**：i18n/文案目录要求、截图不得提交进功能分支、临时文件/IDE 状态禁止入库、生成文件需提交（如 bindings）等。

规范与通用 SOP 冲突时，**以项目规范为准**；规范缺失或需要产品决策时先问，不要猜。PR 正文和提交信息都要能逐条对应到规范要求。

### PR 提交门禁（硬性，缺一不可）

**资料不齐不得提交 PR**（不得执行 `gh pr create`）。提交前逐项确认：

- [ ] 标题格式符合项目规范；一个 PR 只解决一个问题，无无关改动。
- [ ] 关联 issue 已按要求处理（`Closes #<n>`；项目不要求时也需确认无需关联）。
- [ ] PR 正文严格按模板填写完整，每个 section 都有实质内容。
- [ ] 验证证据齐全：实际命令 + 结果；UI 变更的 before/after 截图或录屏；后端日志/输出（如要求）。
- [ ] 影响面已说明（同因排查、相邻功能确认、未做的验证及原因）。
- [ ] 本地已跑项目要求/CI 会跑的全部检查；已知哪些检查会 skipped 及原因。
- [ ] 署名、CLA/DCO、分支命名等项目流程要求已满足。
- [ ] 截图、临时文件、IDE 状态未进入功能分支。

任何一项缺失：先补齐材料再提交，禁止“先提 PR 再补验证/截图”。

## 先判断仓库拓扑和旧分支是否还有价值

```bash
git remote -v                      # origin=fork，upstream=上游；上游通常 no_push
git fetch upstream --prune
git log --oneline upstream/main..HEAD
git diff --stat upstream/main...HEAD   # 三点：只算 merge-base 之后的净改动
```

判断旧分支能否直接用：

- 分支是否基于**旧 main**？落后多少：`git rev-list --count HEAD..upstream/main`。
- 旧分支的工作是否已被上游**拆分合并**：
  ```bash
  gh pr list --repo <upstream> --author <you> --state all --limit 100
  gh pr view <n> --repo <upstream> --json title,body,state
  ```
- 若旧 PR 已 CLOSED 且同类改动已被多个小 PR 合并，**不要**直接拿旧分支提 PR；从 `upstream/main` 新建分支，只移植本次改动。

## 基于最新 upstream/main 开干净 worktree

```bash
git worktree add ../<task> -b <type>/<slug> upstream/main
cd ../<task>
pnpm install --frozen-lockfile        # 按项目实际包管理器
```

- 每个任务一个 worktree；保留原验证 worktree 不动，避免切换分支打断正在运行的应用。
- 分支名用 Conventional 前缀：`feat/`、`fix/`、`test/`、`chore/`。
- 不要在旧分支上“就地 reset”来提 PR；旧分支留作对照。

## 移植已有改动

```bash
git -C <old-worktree> diff > <scratch>/task.patch
git apply -3 <scratch>/task.patch
```

- `-3` 会用 blob 历史做三方合并，能保留上游同名区域的新改动（例如字段改名、`answerKey`）。
- 冲突要逐个核对：**保留上游新逻辑，再叠加本次改动**，不要整段覆盖。
- 移植后重新格式化、重新跑测试；不要把旧 base 的格式化噪声带进来。
- 若改动跨多个文件且有测试，先改实现再同步测试，最后跑目标测试文件。

## 分层验证

按“越靠内越快”的顺序：

- 目标单测：`pnpm vitest run <changed test>`
- 受影响包/目录全量：`pnpm vitest run src/features/<area>`
- 类型检查：`pnpm typecheck`
- 格式/静态检查：`oxfmt --check <changed files>`、`pnpm lint`
- i18n/文案目录测试（新增用户可见文本必须同时补 `en` 和 `zh`）：`pnpm vitest run src/platform/locales`
- GUI 验证（有 UI 变更时）：统一走 Tauri MCP —— 方案、安装配置、依赖与已知坑见 [tauri-mcp.md](./tauri-mcp.md)，工具未配置时按其「安装与配置」一节指导补齐；agent-browser / Computer Use 仅在 MCP 不可用时兜底。先 focus 窗口，再截图；多步骤交互要有前后对比图或录屏
- 记录**实际执行的命令 + 结果**，写进 PR 的 “How it was verified”

定量验证优于“看起来正常”：例如切换 tab 时记录容器高度/位置是否恒定，而不是只截一张图。

## 提交

- 提交前先做一次代码审查/简化（例如 `/simplify`），把审查发现的问题在**同一提交**里修掉。
- Conventional Commits：
  ```
  feat(agents): page multiple questions with tabs and a stable height

  说明用户可见变化与原因，必要时列出实现要点。
  ```
- 按环境要求加署名行；提交后检查 `git status` 是否为 clean。
- lint-staged/hook 可能自动格式化并重新 staging；用 `git show --stat HEAD` 核对最终内容。
- 不要把截图、`.openidea/`、IDE 状态、临时脚本提交进功能分支。

## 推送 fork 并创建 PR

**门禁**：先完成「PR 提交门禁」清单。材料不齐时只准备分支与正文草稿，不执行 `gh pr create`。

```bash
git push -u origin <branch>

gh pr create \
  --repo <upstream> \
  --base main \
  --head <fork>:<branch> \
  --title "<type>(<scope>): <summary>" \
  --body-file <scratch>/pr-body.md
```

PR 正文模板（保持简短）：

```markdown
## What and why
2–4 句：用户看到的变化 + 根因。

## How it was verified
- 实际命令与结果；
- 还影响了什么、如何确认没坏；
- UI 变更的 before/after 截图或录屏。

## Review focus
需要 reviewer 重点看的地方。
```

- 一个 PR 只解决一个问题；解决 issue 时写 `Closes #<n>`。
- 网络异常：`github.com` 的 DNS/TLS 不通、但 `api.github.com` 正常时，可用本地 CONNECT 代理连接可达的 GitHub edge IP；**不要**改系统 hosts/代理。推送完成后立即停掉代理。

## PR 截图：用 user-attachments 上传

先看几个已合并 PR 的正文图片域名，确认仓库惯例：

- 新版：`https://github.com/user-attachments/assets/<uuid>`
- 旧版：`https://user-images.githubusercontent.com/<user-id>/...`

`gh` / REST API **不能**上传到 user-attachments；`gh release upload` 产生的是 `releases/download/...`，不是 PR 正文惯例，且下载 CDN 可能 504。

本机有可直接复用的登录态：agent-browser + auth-center 统一 Edge profile（`C:\Users\Administrator\.auth-center\edge-profile`）长期保持 GitHub 网页登录。先用它，不要直接判定“没有可控的已登录浏览器”：

```bash
agent-browser --profile "C:\Users\Administrator\.auth-center\edge-profile" --session pr-<n> open "<pr-url>"
agent-browser --session pr-<n> eval "document.querySelector('meta[name=user-login]')?.content"
```

新 GitHub 编辑器没有 `#fc-new_comment_field`：用 `agent-browser ... get cdp-url` 取 CDP 地址，Playwright `connectOverCDP` 后监听 `filechooser`，上传到 "Edit description" 的 "Paste, drop, or click to add files" 按钮；提取 `user-attachments/assets` URL，取消编辑，再用 `gh pr edit --body-file` 写回正文。完整脚本、校验与常见坑见 [reference.md](./reference.md)。

- 提取后必须 Cancel/丢弃草稿，不要误发评论。
- 校验渲染：重新打开 PR 页面读 `img.naturalWidth`；GitHub 会把附件改写为 `private-user-images.githubusercontent.com` 的签名 URL。
- 批量上传可能在最后一个文件完成前返回 URL；404 的单个文件重传并替换正文中的链接。
- 不要用 Playwright `context.request` 校验附件：请求超时会打印带 Cookie 的请求头。
- 用完后 `agent-browser --session pr-<n> close`，删除临时上传脚本；临时 assets 分支在正文改用 user-attachments 后删除。
- Edge 157+ 对**默认 profile** 禁止 `--remote-debugging-port`；统一 profile 是非默认 profile，可直接复用。需要账号密码时用 vault 注入，2FA/安全密钥交还用户，**任何环节都不打印明文**。

## CI 失败诊断

```bash
gh pr checks <n> --repo <upstream>
gh pr view <n> --repo <upstream> --json statusCheckRollup
gh run view <run-id> --repo <upstream> --job <job-id> --log-failed
```

- 先分类：代码失败 / 外部基础设施（下载 504、LSP 超时、镜像不可达）/ 路径过滤跳过。
- `skipping` 常见于 path filter：纯前端改动跳过 Rust、插件、远端等任务，属正常。
- 没有上游写权限时 `gh run rerun` 会被拒绝；可：
  - close → reopen PR（若 workflow 触发包含 `reopened`，会重跑）；
  - 或在分支追加提交触发 `synchronize`。
- 不要把外部 504 写成“代码问题”；PR 正文/回复里如实标注，并说明需要维护者 rerun。

## 收尾清理

- 删除本次产生的临时文件：代理脚本、patch、Cookie 副本、`curl -o` 误落在仓库根目录的 html/json、中转脚本。
- 删除仅为截图创建的临时 release/tag、assets 分支、GitHub Pages（确认 PR 正文已改为 user-attachments 后再删）。
- PR 未合并前保留 PR worktree；合并后再 `git worktree remove ../<task>`。
- 如果重启/关闭过用户的浏览器或进程：明确告知影响与恢复方式（如 `Ctrl+Shift+T` 恢复标签页）；绝不批量杀用户进程。
- 最终检查：PR worktree `git status` clean、提交已推送、PR 正文链接可访问、CI 状态已说明。

## 安全与沟通约定

- 不在对话中打印 token、密码、Cookie；凭据走 vault/auth-center。
- 破坏性或对外可见操作（force push、删分支/release/Pages、关闭 PR、发评论）先确认。
- 验证结论必须可复现：命令、结果、未做的验证（例如“未做 GUI 实机验证”）都要写清楚。
- 遇到旧故障与本次改动无关时，单独说明是 HEAD/上游既有问题，不混入本次结论。

## 快速命令清单

```bash
# 拓扑与旧分支
git fetch upstream --prune
git log --oneline upstream/main..HEAD
git diff --stat upstream/main...HEAD
gh pr list --repo <upstream> --author <you> --state all

# 干净 worktree + 移植
git worktree add ../<task> -b <type>/<slug> upstream/main
git -C <old> diff > /tmp/task.patch
git apply -3 /tmp/task.patch

# 验证
pnpm vitest run <path>
pnpm typecheck
pnpm exec oxfmt --check <files>
pnpm lint

# GUI 验证（统一走 Tauri MCP，细节见 tauri-mcp.md）
pnpm dev:app    # 起应用；execute_js 要用 window.__TAURI__ 时必须用它而非 pnpm tauri dev
pnpm dev:status # 查本 worktree 桥接端口，之后 driver_session start 带上该 appIdentifier

# 提交与 PR
git push -u origin <branch>
gh pr create --repo <upstream> --base main --head <fork>:<branch> --title ... --body-file ...

# CI 诊断
gh pr checks <n> --repo <upstream>
gh run view <run> --repo <upstream> --job <job> --log-failed

# 最终检查
git status --short
gh pr view <n> --repo <upstream> --json state,mergeable,url
```
