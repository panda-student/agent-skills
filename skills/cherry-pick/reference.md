# cherry-pick 详细参考

> 规则以 SKILL.md 为入口；本文件承载多仓库完整流程、冲突处理、实战示例等低频细节。

## 目录导航

| 需求 | 跳转链接 |
|------|---------|
| 识别已合并提交（判重） | [识别已合并提交](#识别已合并提交判重) |
| 多仓库完整流程 | [多仓库操作](#多仓库操作soa微服务项目) |
| dev↔uat 双向同步 | [dev↔uat 双向同步](#devuat-双向同步) |
| 冲突处理 | [冲突处理](#冲突处理) |
| 冲突后核验注解/import | [冲突解决后的核验](#冲突解决后的核验注解import-可能被静默丢失) |
| 编译验证 | [编译验证](#编译验证) |
| 实战示例 | [跨5仓库同步禅道19794](#跨5仓库同步禅道19794实战示例) / [uat→master 判重同步](#uatmaster-判重同步实战示例) |
| 命令速查 | [命令速查表](#命令速查表) |

---

## 识别已合并提交（判重）

> cherry-pick 前「列出待同步提交」最易踩的坑：初筛命令会把**已合并的提交**也列进来，导致拿到一份掺杂已合并提交的假清单。必须判重去伪。

### 为什么初筛会误报

| 命令 | 原理 | 盲区 |
|------|------|------|
| `git log <feature> --not <target>` | 按 commit 链（祖先关系）判断 | 已 cherry-pick 到 target 的提交（hash 不同、内容相同）不在 target 的祖先链上，仍被列入 |
| `git cherry -v <target> <feature>` | 按 patch-id（去空白后 diff 哈希）去重 | 两分支对同一逻辑改动的代码上下文/演进路径不同时，diff 不同 → patch-id 不同 → 已合并提交仍标 `+` |

**关键认知**：patch-id 相同 ⇒ 已合并（充分条件）；patch-id 不同 ⇏ 未合并（非必要条件）。

### 正确判重方法（多重核验）

对初筛出的每个提交，逐一确认目标分支是否已有等价提交：

1. **按主题词 grep**（最直接）：`git log <target> --oneline --no-merges -i --grep "<提交主题词>"`
2. **文件级 patch-id 对比**：算出该提交的 patch-id，再与目标分支上所有 touch 同一文件的提交逐一比 patch-id
   ```bash
   pid=$(git show <hash> | git patch-id --stable | awk '{print $1}')
   git log <target> --oneline --no-merges -- "<文件>" | while read line; do
     h=$(echo "$line" | awk '{print $1}')
     [ "$(git show "$h" | git patch-id --stable | awk '{print $1}')" = "$pid" ] && echo "MATCH: $h"
   done
   ```
3. **目标分支是否碰过该文件**：若目标分支历史上从未 touch 过该文件，则该提交必然缺失（`git log <target> --oneline -- "<文件>"` 无输出）

### 判重示例（uat→master 实战）

- `git log uat --not master` 列出 108 个，其中 `71415d9 feat(dify): 增强Dify平台输入参数支持` 实际已在 master（`2daf5af`，hash 不同）
- `git cherry -v master uat` 仍把 `71415d9` 标 `+`（误报）—— 因 uat 在「移除缓存」前改动、master 在之后改动，同一逻辑 diff 上下文不同，patch-id 不同（`03ab7dc2` vs `465de18d`）
- 正确判重：`git log master --grep "增强Dify平台输入参数支持"` 找到 `2daf5af` → 确认已合并，排除

---

## 多仓库操作（SOA微服务项目）

### 识别独立 git 仓库

主仓库常把各服务模块目录加入 `.gitignore`，它们是嵌套的独立 git 仓库：

```bash
# 识别哪些子目录是独立git仓库（带.git的）
for d in */; do [ -d "$d/.git" ] && echo "[GIT] $d"; done
```

### 逐仓库检查

```bash
# 用 git -C 操作各仓库（无需cd）
git -C <repo> branch --show-current                                    # 当前分支
git -C <repo> status --short                                           # 工作区状态
git -C <repo> branch --list "*<关键词>*"                               # 是否有特性分支
git -C <repo> log <feature> --not <target> --oneline --no-merges --reverse  # 待同步提交
```

### 逐仓库 cherry-pick

```bash
git -C <repo> cherry-pick <hash1> <hash2> ...
```

### 多仓库要点

1. **各仓库独立**：每个仓库独立检查分支/状态/提交清单，不能假设状态一致
2. **分支缺失**：部分仓库可能没有该特性分支（如 operation-services 无 19794 分支），跳过即可，不算异常
3. **哈希独立**：各仓库的提交哈希不同，不能跨仓库复用哈希值
4. **并行加速**：仓库多时可用并行子代理（Agent 工具）分头收集各仓库的提交清单，但 cherry-pick 执行仍建议串行确认
5. **工作区未跟踪文件**：各仓库常有 `.project`/`.settings/` 等未跟踪 Eclipse 文件，不影响 cherry-pick

---

## dev↔uat 双向同步

> dev 与 uat 是长期互相同步的长期分支，最高频同步场景。初筛假清单问题最严重——长期互 cherry-pick 产生大量「hash 不同、内容相同」的提交，判重去伪（见 [识别已合并提交](#识别已合并提交判重)）是重中之重。

### 流程要点（与标准流程的差异）

| 差异点 | 做法 |
|--------|------|
| 方向必须先问清 | dev→uat（提测）/ uat→dev（修复回流），用 AskUserQuestion 确认；范围（全量/仅我的/仅指定编号或主题）一并确认 |
| 本地分支常陈旧 | 先 `git fetch origin`，初筛与判重一律用 `origin/dev`、`origin/uat`，避免漏判/误判 |
| 目标分支常非当前分支 | `git checkout <target> && git pull`；工作区脏或有未推送提交时先与用户确认处理方式 |
| push 询问必做 | dev/uat 同步通常伴随提测/部署流水线，完成后必须主动询问是否 push |

### 命令模板（以 dev→uat 为例）

```bash
git fetch origin
# 初筛（早→晚）
git log origin/dev --not origin/uat --oneline --no-merges --reverse
# 作者分布（确认归属过滤维度）
git log origin/dev --not origin/uat --format='%an' | sort | uniq -c
# 判重（对初筛清单逐一执行）
git log origin/uat --oneline --no-merges -i --grep "<主题词>"
# 切换到目标分支
git checkout uat && git pull
# 保序执行
git cherry-pick <h1> <h2> ...
# 收尾
git log --oneline -N && git status --short
```

### 与多仓库叠加

多仓库项目做 dev↔uat 同步时与「多仓库操作」章节叠加：逐仓库 fetch、逐仓库对比 `origin/dev`/`origin/uat`、逐仓库确认清单与执行。方向与范围确认一次即可全仓库复用。

---

## 冲突处理

### 区分自动合并与冲突

| 现象 | 含义 | 处理 |
|------|------|------|
| `Auto-merging <file>` | 正常自动合并，git 已解决 | 无需处理，继续 |
| `CONFLICT (content)` | 真正冲突，需人工介入 | 暂停，手动解决 |

### 冲突解决流程

```bash
# 1. 查看冲突文件
git status                           # 查看双方修改的文件

# 2. 手动编辑冲突文件，解决 <<<<<<< ======= >>>>>>> 标记

# 3. 标记已解决
git add <resolved-file>

# 4. 继续 cherry-pick
git cherry-pick --continue

# 或放弃整个 cherry-pick 序列
git cherry-pick --abort
```

### 跳过单个冲突提交

```bash
# 跳过当前冲突提交，继续下一个（慎用，可能丢失必要依赖）
git cherry-pick --skip
```

### 冲突解决后的核验（注解/import 可能被静默丢失）

cherry-pick 冲突时，**类声明行和注解（如 `@Slf4j`、`@Override`）若两边上下文不同，不会进入冲突块**，会被目标分支版本静默覆盖丢失。若源提交的改动依赖该注解（如用 `log.error` 依赖 `@Slf4j`），丢失后编译失败。

解决冲突标记后，必须核验：
1. 源提交用到的注解是否在目标文件就位（如 `@Slf4j` 是否加在类上）
2. 源提交新增的 import 是否保留
3. 目标分支自身的关键演进是否保留（如方法名 `postDifySse` 不应被源的 `postSse` 覆盖）

```bash
grep -nE "@Slf4j|import.*ExceptionUtils|postDifySse" <文件>   # 核验关键元素就位
grep -nE "^<<<<<<<|^=======|^>>>>>>>" <文件>                  # 确认无残留冲突标记
```

### 编译验证

冲突解决 + `git cherry-pick --continue` 后，必须编译验证：

```bash
mvn -pl <模块> -am clean compile -DskipTests
```

⚠️ **必须用 `clean compile`，不是 `compile`**：
- `mvn compile` 增量编译，未改动时显示 `Nothing to compile - all classes are up to date`，用旧 class 缓存，**不是真验证**
- `mvn clean compile` 先删 target 再编，显示 `Changes detected - recompiling the module!`，才真正重编源文件

WARNING（deprecation/unchecked）通常无害，是泛型原始类型使用的常规警告，非本次引入。

---

## 跨5仓库同步禅道19794（实战示例）

**任务**：把禅道 19794 特性分支的提交同步到 `release/master-0709`，涉及5个仓库。

### 执行过程

| 仓库 | 提交数 | 处理要点 |
|------|:---:|------|
| jpm_soa_code（后端汇总文档） | 8 | 排除夹带的1个禅道19809提交（新增技能集） |
| jomoo_frontend（前端） | 13 | i18n 文件（locale/en.js、zh.js）多处 Auto-merge，无冲突 |
| common-core | 3 | 跳过1个纯 .gitignore 提交，仅同步3个业务提交（核验无依赖后跳过） |
| plugins-service | 1 | 单个业务提交 |
| project-service | 11 | 含 ES 聚合根因修复+策略模式重构+单元测试，强演进依赖必须保序 |

**总计 36 个提交，全部无冲突。**

### 关键经验

1. **编号核对价值**：jpm_soa_code 的 19794 分支夹了 1 个 19809 提交（新增 JPM 技能集），通过逐个核对识别并排除
2. **保序价值**：project-service 的提交链「策略模式重构 → 查询口径对齐 → 测试」「ES composite 聚合修复」有强演进依赖，颠倒必冲突
3. **Auto-merging 价值**：前端 i18n 公共文件在多个提交中被反复修改，触发多次 Auto-merge，均自动解决
4. **跳过 chore 价值**：common-core 用户选「仅业务」，核验后安全跳过 .gitignore 提交，不破坏业务提交链
5. **收尾验证价值**：每个仓库执行后用 `test -f .git/CHERRY_PICK_HEAD` 确认非进行中状态

---

## uat→master 判重同步（实战示例）

**任务**：把 uat 分支上「我（sunzhiqiang）提交的、master 没有的」提交同步到 master。

### 执行过程

| 步骤 | 操作 | 结果 |
|------|------|------|
| 初筛 | `git log uat --not master --reverse` | 列出 108 个（含大量已合并提交，假清单） |
| 归属过滤 | `git log ... --format='%an' \| sort \| uniq -c` | 5 个作者，sunzhiqiang 4 条 |
| patch-id 去重 | `git cherry -v master uat` | 11 个标 +，其中 71415d9 误报 |
| 判重去伪 | grep 主题词 + 文件级 patch-id | 71415d9 已在 master(2daf5af)，排除；剩 3 个真缺失 |
| 确认范围 | 与用户确认 | 3 个业务提交（排除 71415d9 误报） |
| cherry-pick | `git cherry-pick 9c18a30 fca21c4 a8ce6e7` | 前2个成功，第3个 AiPlatformService.java 冲突 |
| 冲突解决 | 手工解决4处冲突 + 补回丢失的 @Slf4j 注解 | 编译依赖注解，不补会失败 |
| 编译验证 | `mvn -pl server -am clean compile` | BUILD SUCCESS，116 文件真重编 |

**总计 108 → 3，1 个冲突手工解决，编译通过。**

### 关键经验

1. **归属过滤优先**：108 条里先按作者缩到 4 条，再判重。jpm 类项目按禅道编号，本项目（无编号）按作者——先确认提交信息格式再选维度
2. **判重是核心**：`--not` 和 `git cherry` 都会误报已合并提交，必须 grep 主题词 + 文件级 patch-id 多重核验。71415d9 因两分支演进路径不同 patch-id 不同，被 git cherry 误标 +
3. **注解静默丢失**：冲突时 `@Slf4j` 注解因类声明上下文不同不进冲突块被覆盖，手工补回才避免编译失败
4. **clean compile 才是真验证**：`mvn compile` 命中缓存显示 Nothing to compile，`clean compile` 才真重编

---

## 命令速查表

| 场景 | 命令 |
|------|------|
| 当前分支 | `git branch --show-current` |
| 找特性分支 | `git branch -a --list "*<关键词>*"` |
| 同步远端最新（dev/uat同步必做） | `git fetch origin` |
| dev/uat 差异初筛（用origin/对比） | `git log origin/<source> --not origin/<target> --oneline --no-merges --reverse` |
| 按作者过滤提交 | `git log <feature> --not <target> --author "姓名" --oneline --no-merges --reverse` |
| 查看作者分布 | `git log <feature> --not <target> --format='%an' \| sort \| uniq -c` |
| 列待同步提交（早→晚，✅用这个） | `git log <feature> --not <target> --oneline --no-merges --reverse` |
| patch-id 去重对比 | `git cherry -v <target> <feature>`（`+` 为疑似未合并，但有盲区） |
| 算提交 patch-id | `git show <hash> \| git patch-id --stable` |
| 按主题词判重 | `git log <target> --oneline --no-merges -i --grep "<主题词>"` |
| 查看提交改动文件 | `git show --stat --oneline <hash>` |
| 执行 cherry-pick | `git cherry-pick <h1> <h2> <h3> ...` |
| 是否进行中 | `test -f .git/CHERRY_PICK_HEAD && echo 进行中 \|\| echo 已完成` |
| 继续冲突解决后 | `git cherry-pick --continue` |
| 放弃整个序列 | `git cherry-pick --abort` |
| 跳过当前冲突提交 | `git cherry-pick --skip` |
| 强制重编验证 | `mvn -pl <模块> -am clean compile -DskipTests` |
| 多仓库操作 | `git -C <repo> <命令>` |

---

## 与 commit 技能的边界

| 技能 | 职责 | 触发 |
|------|------|------|
| `cherry-pick` | 把已有提交跨分支/跨仓库同步过来 | 「同步特性分支」「搬提交过来」 |
| `commit` | 分析暂存区变更，分类创建新提交 | 「提交代码」`/commit` |

cherry-pick 同步的是**已存在的提交**（保留原作者/日期/信息）；commit 创建的是**新提交**。两者不重叠。
