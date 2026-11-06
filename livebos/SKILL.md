---
name: "livebos"
description: "梳理 LiveBOS 项目管理工作区里某个业务对象/流程的逻辑。仅当用户显式使用 /livebos 命令时触发,不会自动调用。自动跑提取脚本拿机械输出(字段表/步骤链/SQL/反向引用),按固定 8 小节模板输出完整梳理草稿,人工只补'联动解读'和'注意点'。"
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Bash
  - Read
  - Glob
---

你是 LiveBOS 项目管理系统的梳理专家。**仅当用户显式输入 `/livebos` 命令时**按本流程产出完整梳理草稿。用户只是提到对象名或说"看一下 XX"时不触发——那只是普通问答。

## 路由表

| 需求 | 跳转 |
|---|---|
| **输出深度规范(每节嵌真实样例)** | [reference.md - 输出模板](./reference.md#一输出模板8-小节每次必填) |
| **落盘前自检清单** | [reference.md - 质量检查清单](./reference.md#二质量检查清单输出前自检) |
| **常见陷阱** | [reference.md - 常见陷阱](./reference.md#三常见陷阱) |
| **LiveBOS 文件格式约定** | [reference.md - 文件格式约定](./reference.md#四livebos-文件格式约定) |
| **工具命令速查** | 见本文档"工具命令速查"小节 |
| **工具源码**(需扩展时) | `scripts/lbz_inspect/`:locators(定位/枚举/文件名语义)/readers(解码读取)/text_utils + `parsers/`(一逻辑一模块:fields/buttons/views/invokes/sqls/process_header/process_steps/workflow_steps/formulas)+ `renderers/`(同粒度镜像)+ dispatcher(唯一调度,组合定位→读取→解析→渲染)+ cli(argparse 入口) |
| **改完工具代码后回归** | `cd scripts && python regression.py check`(全量 18 用例);可带模块名只跑相关域——改 `parsers/fields.py` → `check fields`,改 `parsers/workflow_steps.py` → `check workflow`。输出**有意**变更后先 `python regression.py baseline <模块>` 刷新快照。模块:fields/buttons/views/process/workflow/locate/overview |

## 本技能自包含

提取工具包内置于 `scripts/lbz_inspect/`(纯 Python 标准库,无需安装依赖)。整个技能文件夹可独立迁移,不依赖工作区里的任何工具文件。
回归测试同样自包含:`scripts/tests_fixture/` 是迷你 LiveBOS 工作区(7 个真实样本文件),快照对拍不依赖任何外部数据。

---

## 执行流程

### 第 0 步:确定工作区根

**工作区根 = 用户当前 shell 目录**(用 `pwd` 获取)。把它存为变量 `WS`,后续命令的环境变量都引用它。

### 第 1 步:定位目标对象

用户参数可能是对象名(如 `T_BenfitM`)、中文描述(如"项目月效益明细")、或文件路径。

- 中文名 → 先在 `$WS` 下 `find` 到对应目录再确定对象名
- 对象名是多前缀歧义时(如 `WO_PM02001`/`WF_PM02001`)→ 先 `locate` 确认
- 确认后,`OBJ` = 主对象名

### 第 2 步:跑提取命令拿机械输出

**并行**跑以下命令(独立 Bash 调用放一个消息里)。`SKILL_DIR` = 本 SKILL.md 所在目录:

```bash
SKILL_DIR="<本技能目录>"    # 通常 ~/.agents/skills/livebos
WS="<工作区根>"             # 第 0 步获取的 pwd
OBJ="<目标对象名>"

LBZ_WORKSPACE="$WS" PYTHONPATH="$SKILL_DIR/scripts" python -m lbz_inspect overview "$OBJ"
LBZ_WORKSPACE="$WS" PYTHONPATH="$SKILL_DIR/scripts" python -m lbz_inspect buttons  "$OBJ"
LBZ_WORKSPACE="$WS" PYTHONPATH="$SKILL_DIR/scripts" python -m lbz_inspect steps    "$WS/<同目录/_Add.lbz>"
LBZ_WORKSPACE="$WS" PYTHONPATH="$SKILL_DIR/scripts" python -m lbz_inspect steps    "$WS/<同目录/_Update.lbz>"
LBZ_WORKSPACE="$WS" PYTHONPATH="$SKILL_DIR/scripts" python -m lbz_inspect steps    "$WS/<同目录/_Del.lbz>"
LBZ_WORKSPACE="$WS" PYTHONPATH="$SKILL_DIR/scripts" python -m lbz_inspect refs     "<关键联动字段>"
```

说明:
- `overview` 的“关联流程”清单会列出该对象有哪些 `.lbz`,从中挑核心的跑 `steps`(不必全跑)
- `steps` 对 WF 会输出每节点的**字段权限三态**(`字段权限[对象]: 可编辑/锁定可见/隐藏` + 子表权限)——需求文档里"某字段某环节才显示/编辑"的实证来源;解析用 ET 树级(教训见 reference.md 常见陷阱:裸正则对 XML 空白敏感会静默漏配)
- `buttons` 输出对象所在目录(一个目录=一个页面/模块)全部 XML 的按钮配置;`overview` 也会带一节「页面按钮」摘要
- `view` 解析视图逻辑(父对象/筛选与权限条件/属性/展示列)——对 `V_*/VO_*` 与汇总页视图跑,其 statement 就是第六节"筛选条件+权限过滤"的机械来源
- 大对象加 `--compact`:`python -m lbz_inspect --compact overview "$OBJ"`
- 也可用 `-r "$WS"` 代替 `LBZ_WORKSPACE` 环境变量,二选一
- ⚠ **`overview`/`fields` 只解析对象 `<columns>`,不覆盖流程方法 `<parameters>` 的字段表达式**。梳理“弹窗字段联动/带出”类问题(如“选项目带出某字段”)时,必须额外手动读对象 xml 里 Add/Update 方法的 `<parameters>`,找对应字段的 `<expression>`(常含 javascript/SQL 带出脚本),否则会漏看带出逻辑、得出错误结论。同类需人工读的容器全集:`methods`/`method`/`parameters`/对象级 `pre-functions`/`post-functions`/`ui-logics`/`events`/`variables`(见 reference.md「标签覆盖矩阵」)。详见 reference.md「常见陷阱」。
- ⚠ **页面按钮在 `<display-options><commands>`,不在 .lbz**。新增/修改/删除/导入(LoadExcel)/导出(ToExcel)/批量删除(BatchDel)/维护流程入口全配在这块——必须跑 `buttons` 命令逐个枚举并给迁移标记,漏看会得出"无导出配置"之类错误结论(2026-08-18 效益模块曾因此漏掉台账 12 个按钮)。

### 第 3 步:按模板输出草稿

**严格按 [reference.md - 输出模板](./reference.md#一输出模板8-小节每次必填)** 组织 8 小节。reference.md 里**每一节都嵌了 T_BenfitM 的真实片段作为深度标杆**——照着那个深度写,不能缩水。

关键要求(详见 reference.md):
- 机械部分(字段表/分支/SQL/联动)用第 2 步输出填
- 所有计算公式**完整展开**,不能只说"有公式"
- 第八节至少 4 条洞察,覆盖业务约定/一致性风险/边界/性能权限 4 个维度
- 落盘前对照 [reference.md - 质量检查清单](./reference.md#二质量检查清单输出前自检) 逐项自检

### 第 4 步:输出梳理文档

把第 3 步的草稿写成 Markdown 文档,保存到 **`$WS/docs/` 目录**下:

- 文件名:`<对象名>-逻辑梳理.md`(如 `T_BenfitM-逻辑梳理.md`)
- 若 `docs/` 不存在则创建
- 文档标题用 `<对象中文名>(<对象名>)逻辑梳理`

文档内容即第 3 步的 8 小节草稿,完整保存,供后续查阅。

---

## 工具命令速查

格式:`LBZ_WORKSPACE=<工作区> PYTHONPATH=<技能>/scripts python -m lbz_inspect <命令> <参数>`

| 命令 | 作用 |
|---|---|
| `overview <对象名>` | 头+主字段+关联流程清单+页面按钮摘要(UI 副本折叠) |
| `buttons <对象名\|路径>` | 页面按钮清单(对象所在目录全部 XML 的 `<commands>`) |
| `view <对象名\|路径>` | 视图逻辑:父对象 / 筛选与权限条件(`<condition>`) / 属性 / 展示列 |
| `fields <对象名>` | 字段表(name/描述/type/ref/公式/引用/fire-event + 校验:unique/必填/check-type/validation/default + **显隐:静态隐藏/动态隐藏/动态锁定表达式** + **候选过滤:constraint SQL(引用字段的弹窗候选限制,如选项目状态/类型条件)**) |
| `steps <流程.lbz>` | 流程步骤链(invoke/if/elseif/else/forEach 分支 + copy + 字段 + SQL 展开;WF 审批定义含动态办理人/流转/业务挂接/**节点字段权限三态**) |
| `formulas <文件>` | 文件内所有公式/SQL 去重 |
| `refs <字段名>` | 该字段出现在哪些对象(按对象聚合,默认限 40) |
| `locate <对象名>` | 定位对象文件(含 package 信息) |

选项:`--compact` 折叠长公式;`-r <path>` 指定工作区根(替代环境变量)。

输出质量要求和常见陷阱见 **[reference.md](./reference.md)**。
