# PR 工作流

> 本文件按 Dev Flow Core 的 PR 循环组织；通用方法与纪律见 `dev-flow-core` 技能，本文件只保留 OSS / 上游 / PR 的具体操作与项目命令。

| PR 循环 | 本文件章节 |
|---|---|
| Define 立单 | 读项目规范 · 要不要先开 issue · 判断仓库拓扑与旧分支 |
| Slice 切片 | 开干净 worktree · 移植已有改动 |
| Prove 自证 | 分层验证 · CI 失败诊断 |
| Own 认领 | 提交（含提交前自审） |
| Trace 留痕 | 推送并创建 PR · 截图上传 · 提交后跟进 · 收尾清理 |

## 【Define】先读项目规范（强制，提交 PR 前必做）

不要先套用通用流程。先找到并读完项目自己的贡献规范，按项目要求执行：

```bash
ls CONTRIBUTING.md CONTRIBUTING* AGENTS.md CLAUDE.md README.md 2>/dev/null
ls .github/pull_request_template.md .github/ISSUE_TEMPLATE 2>/dev/null
ls .github/workflows 2>/dev/null
```

从中提取并落实到本次工作：

- **PR 粒度与标题**：是否要求一个 PR 只解决一个问题；标题是否用 Conventional Commits。
- **关联 issue**：是否要求 `Closes #<n>`、是否要求 issue 先被接受（如 `planned` 标签）。
- **PR 模板**：严格按 `.github/pull_request_template.md` 的 section 写，不增删 section、不留空。
- **验证要求**：项目要求实际跑哪些命令、是否必须 before/after 截图或录屏、后端是否需要日志/输出、是否要求先复现。
- **提交流程**：分支命名、署名行、CLA/DCO、review/merge 方式。
- **CI 必过项**：从 workflow 的 `pull_request` 触发条件、`paths` 过滤和矩阵确认哪些检查会跑、哪些会 skipped。
- **项目专属规则**：i18n/文案目录要求、截图不得提交进功能分支、临时文件/IDE 状态禁止入库、生成文件需提交（如 bindings）等。

规范与通用 SOP 冲突时，**以项目规范为准**；规范缺失或需要产品决策时先问，不要猜。PR 正文和提交信息都要能逐条对应到规范要求。

### PR 提交门禁（硬性，缺一不可）

**资料不齐不得提交 PR**（不得执行 `gh pr create`）。提交前逐项确认：

- [ ] 一个 PR 只做一个可独立解释、可独立回滚的变更，没有顺手改的无关内容；标题符合项目规范。
- [ ] issue 已按仓库规范处理：已有对应 issue 就在正文写 `Closes #<n>`；仓库要求 issue-first 就先走 issue；都不要求则确认无需关联。
- [ ] PR 正文严格按模板填写完整，每个 section 都有实质内容。
- [ ] 验证证据齐全：实际命令 + 结果；UI 变更的 before/after 截图或录屏；后端日志/输出（如要求）。
- [ ] 影响面已说明（同因排查、相邻功能确认、未做的验证及原因）。
- [ ] 本地已跑项目要求/CI 会跑的全部检查；已知哪些检查会 skipped 及原因。
- [ ] 署名、CLA/DCO、分支命名等项目流程要求已满足。
- [ ] 截图、临时文件、IDE 状态未进入功能分支。

任何一项缺失：先补齐材料再提交，禁止“先提 PR 再补验证/截图”。

## 【Define】要不要先开 issue

看仓库规范：需要就开，不需要就直接提。

先搜现有 issue：有正好对应你要解决的问题，就在 PR 正文关联 `Closes/Fixes/Resolves #<n>`（标题里的 `#123` 不生效）；没有需要关联的，按仓库规范决定是否新开 issue。

## 【Define】判断仓库拓扑和旧分支是否还有价值

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

## 【Slice】基于最新 upstream/main 开干净 worktree

按 `worktree-ops` 在该仓库创建并切换到任务树（分支 `<type>/<slug>`，起点 `upstream/main`）；建树、回收与合并判定以该技能为准，本节只保留仓库拓扑与分支命名策略。

```bash
cd <worktree-ops 返回的任务树路径>
pnpm install --frozen-lockfile        # 按项目实际包管理器
```

- 每个任务一个 worktree；保留原验证 worktree 不动，避免切换分支打断正在运行的应用。
- 分支名用 Conventional 前缀：`feat/`、`fix/`、`test/`、`chore/`。
- 不要在旧分支上“就地 reset”来提 PR；旧分支留作对照。

## 【Slice】移植已有改动

```bash
git -C <old-worktree> diff > <scratch>/task.patch
git apply -3 <scratch>/task.patch
```

- `-3` 会用 blob 历史做三方合并，能保留上游同名区域的新改动（例如字段改名、`answerKey`）。
- 冲突要逐个核对：**保留上游新逻辑，再叠加本次改动**，不要整段覆盖。
- 移植后重新格式化、重新跑测试；不要把旧 base 的格式化噪声带进来。
- 若改动跨多个文件且有测试，先改实现再同步测试，最后跑目标测试文件。

## 【Prove】分层验证

分层原则与「验证证据」口径见 `dev-flow-core`；以下为该项目的具体命令。

- 目标单测：`pnpm vitest run <changed test>`
- 受影响包/目录全量：`pnpm vitest run src/features/<area>`
- 类型检查：`pnpm typecheck`
- 格式/静态检查：`oxfmt --check <changed files>`、`pnpm lint`
- i18n/文案目录测试（新增用户可见文本必须同时补 `en` 和 `zh`）：`pnpm vitest run src/platform/locales`
- GUI 验证（有 UI 变更时）：统一走 Tauri MCP。方案、安装配置、操作流程、真机断言要求与已知坑见 [tauri-mcp.md](./tauri-mcp.md)；工具未配置时按其「安装与配置」一节补齐，agent-browser / Computer Use 仅在 MCP 不可用时兜底。
- 记录**实际执行的命令 + 结果**，写进 PR 的 “How it was verified”。

## 【Own】提交（含提交前自审）

- 提交前先做一次代码审查/简化（例如 `/simplify`），把审查发现的问题在**同一提交**里修掉。
- 真机验证发现的问题优先在同提交修复；确实无法自动化的路径，写进 PR 的 “How it was verified” 并说明原因。
- Conventional Commits：
  ```
  feat(agents): page multiple questions with tabs and a stable height

  说明用户可见变化与原因，必要时列出实现要点。
  ```
- 按环境要求加署名行；提交后检查 `git status` 是否为 clean。
- lint-staged/hook 可能自动格式化并重新 staging；用 `git show --stat HEAD` 核对最终内容。
- 不要把截图、`.openidea/`、IDE 状态、临时脚本提交进功能分支。

## 【Trace】推送 fork 并创建 PR

**门禁**：先完成「PR 提交门禁」清单。材料不齐时只准备分支与正文草稿，不执行 `gh pr create`。

**门禁齐备即执行**：门禁清单逐项满足后，直接推送并创建 PR，不再就「要不要推 / 要不要提 PR / 要不要关联 issue」征求同意——用户调用 `/oss-dev-sop` 并选定方案，已经授权这条流水线。技能只要求确认的是 force push、close PR、删 release/tag 等破坏性动作。门禁材料确实补不齐，或出现产品决策分歧时才停下交回用户。

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

- 网络异常：`github.com` 的 DNS/TLS 不通、但 `api.github.com` 正常时，可用本地 CONNECT 代理连接可达的 GitHub edge IP；**不要**改系统 hosts/代理。推送完成后立即停掉代理。

## 【Trace】PR 截图：用 user-attachments 上传

先看几个已合并 PR 的正文图片域名，确认仓库惯例：新版 `https://github.com/user-attachments/assets/<uuid>`，旧版 `https://user-images.githubusercontent.com/<user-id>/...`。`gh` / REST API 无法上传到 user-attachments，`gh release upload` 产生的是 `releases/download/...`，不符合 PR 正文惯例。

登录态复用 auth-center 统一 Edge profile（路径以 auth-center 配置为准，不要复制 cookie）。在新编辑器 "Paste, drop, or click to add files" 上传，提取 `user-attachments/assets` URL 后取消草稿，再用 `gh pr edit --body-file` 写回正文。完整脚本、校验方法与常见坑见 [reference.md](./reference.md)。

- Edge 157+ 对**默认 profile** 禁止 `--remote-debugging-port`；统一 profile 是非默认 profile，可直接复用。需要账号密码时按 `vault-ops` 技能注入，2FA/安全密钥交还用户，**任何环节都不打印明文**。

## 【Trace】提交后跟进：轮询到合并

**`gh pr create` 成功返回 PR 链接后，立即在同一轮里创建 `/loop`**，不需要任何额外确认。默认每 10 分钟检查一次，直到 PR 合并到 main（或确认关闭）。

每轮检查：

```bash
gh pr view <n> --repo <upstream> --json state,mergedAt,mergeable,reviewDecision,statusCheckRollup,comments,reviews
gh api repos/<upstream>/pulls/<n>/comments --paginate   # 行内 review 评论
gh pr checks <n> --repo <upstream>
```

- **合并即停**：`state=MERGED`（或 `mergedAt` 非空）→ 停止 loop，进入「收尾清理」。
- **关闭未合并**：`state=CLOSED` → 停止 loop，确认关闭原因并如实告知，不要重开 PR 硬推。
- **有修改意见**：直接改并 push 到同一分支；不要新开 PR、不要空提交。改完在该条评论下回复（行内评论用 replies 接口），说明改了什么；不打算改的说明理由。同一意见只回复一次。
- **有提问/讨论**：先回答；涉及产品决策或方向分歧时转给用户，不要自行拍板。
- **CI 失败**：按「CI 失败诊断」一节处理；分支落后或冲突先 rebase，再判断是否本 PR 引入。
- **无变化**：不评论、不催合并、不重复 push。合并时机由 maintainer 决定。
- **卡住**：同一问题连续两轮仍未解决，或意见互相冲突，停止自动修改并交回用户决定。

```text
/loop 10m 检查 <upstream> PR <n> 的 review 和 CI：有修改意见就改并 push，在该评论下回复；
CI 失败按「CI 失败诊断」处理；merged 或 closed 后停止 loop 并汇报。
分支 <branch>，worktree <path>。
```

- `/loop` 在创建它的会话内执行，回复自然回到原会话；不要在别的会话或外部调度里重建这个任务。
- prompt 里带 PR 坐标（仓库、PR 号、分支、worktree），上下文被压缩后仍能接着做。
- 每轮先核对 `gh pr view` 的 repo / number / headRefName / headRefOid 与记录一致；不一致或没有上下文时立即停手核对。
- review 回复走 `gh pr comment` / replies 接口写回 PR，不靠聊天会话传递。
- 合并或关闭后停止 loop，进入「收尾清理」。

## 【Prove】CI 失败诊断

```bash
gh pr checks <n> --repo <upstream>
gh pr checks <n> --repo <upstream> --watch          # 后台等待全部完成
gh pr view <n> --repo <upstream> --json statusCheckRollup
gh run view <run-id> --repo <upstream> --json conclusion
gh run view <run-id> --repo <upstream> --job <job-id> --log-failed
```

- 先看 run 的 `conclusion`,不要把 `cancelled` 当代码失败:`gh pr checks` 会把 cancelled 显示成 fail;cancelled 的 job 没有步骤日志(`log not found`),`gh api` 的 job 记录也是空 steps。
- 再分类:代码失败 / 外部基础设施(下载 504、LSP 超时、镜像不可达)/ 路径过滤跳过 / run 被取消。
- `skipping` 常见于 path filter:纯前端改动跳过 Rust、插件、远端等任务,属正常。
- 没有上游写权限时 `gh run rerun` 会被拒绝;优先 close → reopen PR(workflow 触发包含 `reopened` 时会重跑),不要先 force-push 或加空提交。
- 连续 cancelled 常与维护者发布/仓库活动重叠;如实说明是外部取消,并请维护者 rerun,不要写成代码问题。
- 分支基线落后 `upstream/main` 时先 rebase 再判断失败:上游可能已经合入修复你本地或 CI 失败的提交(例如 clippy 新 lint、Windows 测试修复)。
- 本地全量测试失败先归因:`git diff upstream/main -- <失败文件>` 确认是否本 PR 改动;隔离复跑;Windows 的路径分隔符、符号链接实体化、并发超时会制造假失败。
- 不要把外部 504 或既有测试失败写成“代码问题”;PR 正文/回复里如实标注,并说明需要维护者 rerun。

## 【Trace】收尾清理

- 删除本次产生的临时文件：代理脚本、patch、Cookie 副本、`curl -o` 误落在仓库根目录的 html/json、中转脚本。
- 删除仅为截图创建的临时 release/tag、assets 分支、GitHub Pages（确认 PR 正文已改为 user-attachments 后再删）。
- PR 未合并前保留 PR worktree；合并后按 `worktree-ops` 回收（判定与删除命令以该技能为准）。
- 如果重启/关闭过用户的浏览器或进程：明确告知影响与恢复方式（如 `Ctrl+Shift+T` 恢复标签页）；绝不批量杀用户进程。
- 停止 PR 跟进的 `/loop`（在循环中 stop），确认不再轮询。
- 最终检查：PR worktree `git status` clean、提交已推送、PR 正文链接可访问、CI 状态已说明。

## 【附录】快速命令清单

> 速查用；上下文与说明见上文对应章节。

```bash
# 拓扑与旧分支
git fetch upstream --prune
git log --oneline upstream/main..HEAD
git diff --stat upstream/main...HEAD
gh pr list --repo <upstream> --author <you> --state all

# 干净 worktree + 移植（先按 worktree-ops 基于 upstream/main 建任务树，再在树内执行）
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
