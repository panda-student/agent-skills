---
name: worktree-ops
description: Git 工作树（worktree）管理规范与操作流程——用 worktrunk（Windows 命令 git-wt）盘点、创建、切换、合并判定与安全清理工作树；检查每个树是否有独有提交、是否脏、分支是否已合并，避免陈旧工作树长期堆积与误删。当需要创建/切换/盘点/清理 worktree、合并推送后回收工作树、发现多棵残留工作树、或并行开发需要隔离目录时使用，也可通过 /worktree-ops 手动触发。
---

# Git 工作树管理（worktree-ops）

> 工具：**worktrunk**（Rust 单二进制，已通过 winget 安装，v0.81.0）。
> Windows 下命令为 `git-wt`，**不要用 `wt`**——它与 Windows Terminal 的 `wt.exe` 冲突，PATH 中优先命中终端程序。

## 核心原则

- **树只服务单一在途任务**：一个任务一棵树；合并推送后同一步回收树与分支
- **不把 worktree 当只读镜像**：看 dev/uat 代码用 `git show origin/dev:路径`，不要为此长期保留 checkout
- **清理判据是"无独有提交 + 工作区干净"**，不是 `git status` 看起来正常
- **删除是敏感操作**：先列表展示、再判定、最后删除；未合并分支默认保留，强删必须经用户确认

## 供其它技能调用的契约

其它技能只描述"建树 / 盘点 / 回收"的意图，不复制具体命令与判定；本技能是 worktree 机械操作的单一来源：

- **建树**：调用方给出仓库路径、分支名、起点；本技能负责路径、默认分支与安全检查，并返回树路径
- **盘点**：返回每棵树的 `ahead`（相对该仓库默认分支的独有提交数）与 `dirty` 状态
- **回收**：只回收「无独有提交 + 工作区干净」的树；未合并分支默认保留，强删须由调用方转交用户确认
- **临时树**：各类提交流程创建的临时树同样走本技能，任务完成即回收
- **策略归属**：同步方向、提交迁移、PR 拓扑、发布闸门等策略留在各自 SOP，不在本技能内定义

## 命令速查

| 目的 | 命令 |
|---|---|
| 列出树与状态（脏文件、ahead/behind、可安全删除项置灰） | `git-wt list` |
| 列表 JSON（脚本化） | `git-wt list --format=json` |
| 创建并切换（新分支） | `git-wt switch -c <branch>` |
| 切换到已有树 | `git-wt switch <branch>` |
| 移除当前树；分支仅在确认已合并时删除 | `git-wt remove` |
| 移除指定树 | `git-wt remove <branch> [<branch>...]` |
| 保留分支只删树 | `git-wt remove --no-delete-branch <branch>` |
| 强删未合并分支（危险） | `git-wt remove -D <branch>` |
| 强删脏树（先备份到 refs/wt-backup） | `git-wt remove --force <branch>` |
| 查看/设置默认分支 | `git-wt config state default-branch [set <branch>]` |

worktrunk 的合并判定覆盖同 commit、祖先关系、三点 diff、tree 相同、模拟 merge、patch-id 六种情况，兼容 squash / rebase 合并；比手写 `rev-list --not` 更可靠。

## 首次使用：设置默认分支

worktrunk 按仓库默认分支判断 ahead/behind 与"是否已合并"。PMS 系仓库的合并目标是 `uat`，**每个仓库单独设置一次**：

```bash
cd D:/IdeaProjects/weekreport/pms && git-wt config state default-branch set uat
cd D:/IdeaProjects/weekreport/pms_frontend && git-wt config state default-branch set uat
```

未设置时它会回退到 `main/master`，会把大量已合入 uat 的树误判为未合并。

## 盘点与清理流程

- **盘点**：在仓库根执行 `git-wt list`，关注 Status 列与 ahead/behind；置灰且无脏文件的行即可安全删除
- **核对**：删除前逐棵确认「无独有提交」——`git -C <worktree> rev-list --count HEAD --not origin/uat` 为 0，且 `git -C <worktree> status --porcelain` 为空
- **删除**：`git-wt remove <branch>`；worktrunk 会在树干净且分支已合并时同时删分支
- **复查**：`git-wt list` 确认目标树消失；`git branch --list "<branch>"` 确认分支已回收
- **元数据兜底**：目录被手工删过时执行 `git worktree prune`
- **多仓库**：pms / pms_frontend / pms_mobile 是独立仓库，各自盘点，不能跨仓库复用同一份 worktree 列表

无工具时的等价审计（PowerShell 环境中用 Git Bash 执行）：

```bash
git worktree list --porcelain | awk '/^worktree /{print $2}' | while read -r w; do
  b=$(git -C "$w" branch --show-current 2>/dev/null)
  [ -z "$b" ] && continue
  ahead=$(git -C "$w" rev-list --count HEAD --not origin/uat 2>/dev/null)
  dirty=$(git -C "$w" status --porcelain 2>/dev/null | wc -l)
  printf '%-52s %-28s ahead=%s dirty=%s\n' "$w" "$b" "$ahead" "$dirty"
done
```

`ahead=0 dirty=0` 的行可回收；其余保留并说明原因。

## 安全红线

- 未确认已合并，禁止 `-D` 强删分支；需要强删时必须先向用户出示分支与独有提交清单并取得确认
- 脏树不得直接 `--force`；先让用户决定提交、导出或确认备份路径
- 只处理当前任务或用户点名的树，禁止批量清理"看起来像临时"的树
- 删除后如目录残留（常见于前端 `node_modules` 软链接），确认残留仅为链接再 `rm -rf` 该目录；`rm -rf` 对软链接不会跟进目标目录
- 代理会话在 worktree 内时，对主仓只用 `git -C <主仓路径> ...`，不切换当前会话目录

## 与现有流程的衔接

- **合并推送完成后**：立即回收本次任务树与分支；有目标分支同步（如 `uat→dev`）时，同步完成后再复查一次
- **收尾检查**：把 `git-wt list` 作为工作区收口项，确认无本次任务遗留树
- **目标分支被占用**：按本技能规则新建临时树，完成后回收；不要强拆他人/他会话的树
- **长期残留树特征**：分支无独有提交、落后目标分支数十个提交、测试整类失败——不要在其上继续开发或把测试结果当验证依据

## 常见问题

| 现象 | 处理 |
|---|---|
| `wt` 打开的是终端而不是 worktrunk | 使用 `git-wt`；或关闭 Windows Terminal 的应用执行别名后再用 `wt` |
| winget 报 `0x8a15005e`（msstore 源证书错误） | 加 `--source winget` 重试 |
| 刚安装后命令找不到 | 新开进程；或使用 `%LOCALAPPDATA%\Microsoft\WinGet\Links\git-wt.exe` |
| `git-wt remove` 后目录仍在 | 检查是否为忽略文件/软链接残留，确认后手工删除空壳目录 |
| 已合并的树没有被判定为可删 | 确认默认分支已设为 `uat`；squash 合并且跨度过大时用 `-D`（须确认） |

## 参考

- worktrunk：<https://github.com/max-sixty/worktrunk>（remove 语义 `https://worktrunk.dev/remove/`，list 列定义 `https://worktrunk.dev/list/`）
- 极简替代：`git-wt`（k1LoW，<https://github.com/k1LoW/git-wt>），`git wt` 列表、`git wt -d <branch>` 安全删除