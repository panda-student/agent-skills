---
name: cherry-pick
description: 把特性分支的提交（通常按禅道编号筛选）同步到当前分支的通用工作流，支持 dev/uat 双向差异提交同步（提测/修复回流）、单仓库与多仓库（SOA微服务/前端嵌套独立git仓库）场景。支持 AI 自动调用和用户通过斜杠命令 `/cherry-pick` 手动触发，在特性分支同步、dev与uat差异同步、禅道编号提交迁移、跨服务模块搬运提交时使用
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(git *)
  - AskUserQuestion
---

你是 Git cherry-pick 工作流专家。当用户需要把某特性分支的提交同步到当前分支时，或使用 `/cherry-pick` 命令时，执行标准化的同步流程。

## 触发说明

- **AI 自动调用**：用户提到「cherry-pick」「把XX分支的提交搬过来」「同步特性分支」「同步dev和uat」「dev和uat差异」「提测到uat」「uat修复回流dev」「禅道XXX的提交迁移」时自动加载
- **用户手动调用**：使用 `/cherry-pick` 命令

## 核心原则

1. **保序**：必须按提交时间从早到晚 cherry-pick，否则演进依赖会冲突
2. **归属过滤**：先按禅道编号/作者过滤出"要同步的提交"，再判重——不盲目搬运特性分支全部提交
3. **判重去伪**：`--not` 和 patch-id 都有盲区，列出待同步提交后必须判重确认目标分支真正缺失，否则会拿到掺杂已合并提交的假清单
4. **最小改动**：与用户确认范围（全部 / 仅业务 / 仅特定提交），不擅自决定
5. **验证收尾**：执行后确认非进行中状态、工作区干净、编译通过，改动未推送需告知用户

## 执行流程

### 第1步：定位分支与当前状态
```bash
git branch --show-current          # 确认目标分支
git status --short                 # 确认工作区（未跟踪文件不影响cherry-pick）
git branch -a --list "*<关键词>*"  # 按禅道编号/关键词找特性分支
```

### 第2步：按归属过滤提交清单（关键）
不同项目提交规范不同，先确认本项目提交信息格式再选过滤维度：
- **带禅道编号**（如 jpm 类项目）：`git log <feature> --not <target> --grep "#编号" --oneline --no-merges --reverse`
- **无编号、自然语言**（如 jomoo-service-portal）：按作者过滤 `git log <feature> --not <target> --author "姓名" --oneline --no-merges --reverse`
- 用 `git log <feature> --not <target> --format='%an' | sort | uniq -c` 查看作者分布，确认过滤维度

### 第3步：对比源分支与当前分支 + 判重去伪（关键）
```bash
# 初筛（新→旧会列已合并提交，--reverse 得早→晚）
git log <feature> --not <target> --oneline --no-merges --reverse
```
⚠️ `--not` 按 commit 链判断，"已 cherry-pick 到目标分支但 hash 不同"的提交也会被列入，会冒出大量已合并提交。**必须判重去伪**，详见 [reference.md - 识别已合并提交（判重）](./reference.md#识别已合并提交判重)。只保留目标分支真正缺失的提交。

### 第4步：列出待合并内容，与用户确认范围
展示过滤+判重后的最终清单（hash|时间|类型|说明|改动文件），确认：
- 全部 / 仅业务 / 仅特定提交
- 是否含 chore（如 .gitignore）

`.gitignore` 等纯 chore 与业务代码无依赖，选「仅业务」时可安全跳过（跳过前 `git show --stat` 核验）。

### 第5步：按从早到晚执行 cherry-pick
```bash
# 多个提交一次性传入，按从早到晚顺序
git cherry-pick <hash1> <hash2> <hash3> ...
```
- 输出含 `Auto-merging` 是**正常自动合并，非冲突**
- 真正冲突会暂停，需手动解决后 `git cherry-pick --continue`，或 `git cherry-pick --abort` 放弃
- **abort 后的回退验证必须全库核对**：用 `git log --oneline -3` 或 `git rev-parse <分支> origin/<分支>` 对比确认，禁止用 `git log -- <目录>` 验证——不涉及该目录的已 pick 提交会漏看，造成"已回退"误判（2026-10-27 实证：多提交 pick 序列 abort 后，src-only 提交被 `git log -- dist/` 漏判，本地 dev 残留该提交，与远端 dev 分叉后被迫 reset --soft 返工）
- 冲突解决后必须核验注解/import 是否被静默丢失，详见 [reference.md - 冲突解决后的核验](./reference.md#冲突解决后的核验注解import-可能被静默丢失)

### 第6步：编译验证（关键）
```bash
mvn -pl <模块> -am clean compile -DskipTests
```
⚠️ **必须用 `clean compile`，不是 `compile`**：后者增量编译命中缓存时显示 `Nothing to compile - all classes are up to date` 用旧 class，不是真验证；`clean compile` 才会 `Changes detected - recompiling the module!` 真正重编。详见 [reference.md - 编译验证](./reference.md#编译验证)。

### 第7步：验证收尾 + push 前清点
```bash
test -f .git/CHERRY_PICK_HEAD && echo "进行中(异常)" || echo "已完成"
git log --oneline -N              # 确认顺序与内容
git status --short                # 工作区应干净（排除未跟踪IDE文件）
```
⚠️ cherry-pick 只改本地，执行 `git push` 前按 git worktree 合并推送闸门清点待推提交（`git log origin/<目标分支>..<目标分支> --oneline`），确认只含本次同步相关提交；发现其他任务的提交 → 停下问用户（一起推 / 摘除重排），禁止静默推送。

## dev↔uat 双向同步（高频场景）

dev 与 uat 是长期互相同步的长期分支。归属过滤、判重去伪、保序、确认范围、编译验证与标准流程完全一致，仅 3 个差异点：

### 差异1：先问清方向（必须）
用户说「同步dev和uat」时通常没说方向，必须用 AskUserQuestion 确认，范围（全量差异 / 仅我的提交 / 仅指定禅道编号或主题）一并确认：
- **dev → uat**：功能提测，把 dev 上新开发/修复的提交搬到 uat
- **uat → dev**：修复回流，把 uat 测试期修复的提交搬回 dev

### 差异2：fetch 后用 origin/ 分支对比
本地 dev/uat 常落后远端，直接比本地分支会漏判：
```bash
git fetch origin
git log origin/<source> --not origin/<target> --oneline --no-merges --reverse
```

### 差异3：目标分支常不是当前分支，需切换
```bash
git checkout <target> && git pull   # 切换前确认工作区干净，有未提交改动先与用户确认处理方式
```
若目标分支恰为当前分支，跳过切换但仍需 `git pull` 对齐最新。
⚠️ `checkout` 报目标分支已被 worktree 占用时，禁止强拆他人树：按项目约定的标准路径新建临时树挂载目标分支（`git worktree add <标准路径>\<target> <target>`），在树内完成 pull + cherry-pick + push 后回收临时树。

### 差异4：双线演进同名功能，先做文件级终态对比（2026-10-26 实证）
dev 与 uat 曾**各自独立实现同一功能**（同名 API 文件、同名页面）时，`git cherry` 因 patch-id 不同把大量等价提交标 `+`，逐条 pick 必然冲突（add/add、content 冲突泥潭）。正确姿势：
- 先 `git diff origin/<target> origin/<source> --stat -- . ":(exclude)dist"` 做**文件级终态对比**：diff 只剩实质差异文件时，只 pick 真正缺失的提交，其余等价提交整体跳过
- pick 中途报 `empty`（patch-id 误报）用 `git cherry-pick --skip` 跳过，不要 `--allow-empty`
- 同步完成校验：`git diff origin/<target> origin/<source> -- . ":(exclude)dist"` 为空（文件级一致）为准；`rev-list --count` 对 cherry-pick 同步永远不为 0（hash 链不同），不能作为内容校验依据
执行后 cherry-pick 只改本地，dev/uat 同步通常伴随提测/部署流水线，**必须主动询问是否 push**。

完整差异说明与命令模板见 [reference.md - dev↔uat 双向同步](./reference.md#devuat-双向同步)。

### 硬约束：dev/uat 同步必须 cherry-pick，禁止 merge 整个分支（2026-10-23 实证）

uat→dev（含反向）同步**必须用 cherry-pick 逐个拣选源码提交，禁止 `git merge` 整个 uat 分支**。merge 的实际危害（pms_frontend 实证）：
- dist 全量哈希产物 rename/rename 冲突，被迫「删除待重建」，产生无意义的大 diff
- `public/sso.js` hostname、`vite.config.js` 的 `/service` `/api` 代理 target 被 uat 侧覆盖，dev 环境指向被污染
- 前端 dist 提交不 cherry-pick（哈希产物基线不同必冲突），统一在目标分支本地 build 重建后独立提交

已发生 merge 污染的修复路径：逆序 revert 错误提交链（merge 提交用 `git revert -m 1 <merge_hash>`）→ cherry-pick 功能提交 → 核实三件套指向（见下节）→ 用 dev 源码重建 dist 独立提交 → 统一 push。

同步前必须先对齐本地分支：`git fetch origin dev` 后核对 `git log dev..origin/dev`，非空先 `git merge --ff-only origin/dev` 对齐（fast-forward 安全）再 pick——本地落后时直接 pick 会基于过期基线，pick 后 push 被拒还得返工。同步完成校验 `git rev-list --count dev..origin/uat` 为 0。

同步与推送结束后切回源分支：`git checkout <source> && git branch --show-current`（pms 系仓库即切回 uat）。目标分支只作同步镜像，留在目标分支上继续操作会把后续提交误提进目标分支。

### 环境指向类提交同步后必须做环境回归（2026-10-23 实证）

uat→dev 同步时，若差异提交含**环境指向类**改动（pms_frontend 的 `public/sso.js` hostname、`vite.config.js` 的 `/service` 与 `/api` 代理 target），直接 pick 会把 uat 指向带入 dev，破坏 dev 本地联调。正确顺序：

- pick 全部实质提交 → 检查三处环境指向（sso.js hostname / vite `/service` / vite `/api`，dev 应为 `test-pms.jomoo.com` 系）→ 错向则紧跟一个「环境指向回归」提交 → 用 dev 源码重建 dist 独立提交 → 统一 push
- 实证：pms_frontend 同步 5 条后 sso.js 与双代理均被带成 uat-pms 指向，回归提交修复后 dist 重建覆盖

## 多仓库场景

SOA 微服务项目常含多个嵌套独立 git 仓库（被主仓库 `.gitignore` 忽略）。详见 [reference.md - 多仓库操作](./reference.md#多仓库操作soa微服务项目)。

要点：
- 用 `git -C <repo>` 操作各仓库，无需 cd
- 每个仓库独立检查分支/状态/提交清单
- 部分仓库可能无该特性分支，跳过即可
- 各仓库提交哈希不同，不能跨仓库复用

## 避坑提醒

| 坑 | 应对 |
|----|------|
| 顺序颠倒致冲突 | 永远用 `--reverse`，按从早到晚 |
| 禅道编号/作者混入 | 先按归属过滤，逐个核对，与用户确认 |
| `git log --not` 列入已合并提交 | 已 cherry-pick 过（hash 不同内容相同）的也会列出，必须判重去伪，见 [reference 判重章节](./reference.md#识别已合并提交判重) |
| 本地 dev/uat 陈旧漏判 | dev/uat 同步前先 `git fetch origin`，对比一律用 `origin/dev`、`origin/uat` |
| patch-id 不同误判未合并 | 两分支对同一改动代码上下文不同时 patch-id 不同，已合并仍标 `+`；patch-id 相同⇒已合并，不同⇏未合并 |
| Auto-merging 误判为冲突 | 是正常自动合并，输出正常即已解决 |
| 冲突解决后注解丢失 | 类声明/注解（如 `@Slf4j`）上下文不同时不进冲突块被覆盖丢失，致编译失败；解决后核验注解/import 就位 |
| `mvn compile` 命中缓存非真验证 | `Nothing to compile` 用旧 class，必须 `clean compile` 强制重编 |
| 未跟踪 IDE 文件担忧 | `.project`/`.settings` 等不影响 cherry-pick |
| 误以为已推送 | cherry-pick 只改本地，push 前先清点待推提交（见第7步），再确认推送 |

详细规范、多仓库完整流程与实战示例请参考 [reference.md](./reference.md)。
