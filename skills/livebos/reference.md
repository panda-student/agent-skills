# 输出规范参考

本文件是 `/livebos` 技能的输出规范,**每节的深度标杆用 T_BenfitM 的真实梳理片段做样例**(不是占位符)。模型执行时照着样例的深度写,不能缩水。

---

## 一、输出模板(8 小节,每次必填)

> 总要求:机械部分(字段表/分支/SQL/联动)用工具输出填,**人工洞察部分必须自己分析填**,不能留空或写"待补充"。每个公式必须写出**完整表达式**,不能只说"有公式"。

### 标题

```
# <对象中文名>(<对象名>)逻辑梳理
```

---

### 第一节:在体系中的位置

**目的**:让读者一眼看懂本对象在业务链里的角色。
**必填要素**:
1. 一张上下游关系图(用文本箭头/代码块画)
2. 一句话说清:数据从哪来 → 本对象 → 汇总到哪去
3. 如果是流程对象,标明它的角色(录入入口/汇总/状态判定/查询展示)

**深度标杆**(T_BenfitM 实例):
```markdown
## 一、在体系中的位置

效益分析是三级汇总 + 一个总账的结构,月明细是最细的一层:

​```
T_PJBenefitFee  计划效益明细表(年度计划,数据源头)
       │  提供年度区间 FStart~FEndTime、年目标 FYearBen、月目标 FMonthBen
       ▼
T_BenfitY  实际年效益明细(按年度汇总实际)
       │  FTYearBen = 年内各月 FMoneyTM 之和;FCut = FTYearBen - FYearBen
       ▼
T_BenfitM  月效益明细(最细粒度,逐月记录)  ← 本次梳理对象
       │  FMoneyTM 逐月累加 → 反哺总账
       ▼
T_PJBenefit  项目效益台账(项目级总账、状态、预测)
​```

**数据流向**:计划表(目标)→ 月明细(实际录入)→ 年效益(年度汇总)→ 台账(项目级总账与状态判定)。
月明细既是录入入口,又是汇总的数据源,所有增删改都会一路联动更新到年效益和台账。
```

**❌ 不合格**:只写"联动了年效益和台账"——没图、没方向、没说角色。

---

### 第二节:字段分类

**目的**:把 overview 命令吐出的几十个字段,按业务含义分类,让人快速抓重点。
**必填要素**:
1. 按 4 类分组(基础派生/录入/计算聚合/状态标志),不要平铺所有字段
2. 计算字段必须写出**完整公式**
3. 文末单独圈出三类关键字段:计算字段、fire-event=1 的字段、引用外部对象的字段

**深度标杆**(T_BenfitM 实例):
```markdown
## 二、字段分类

| 类别 | 字段 | 说明 |
|---|---|---|
| **基础(立项派生)** | FProject, FName, FProNo, FUnits | 全部 `FProject.xxx`,只读 |
| **录入** | FDate(月份), FMoneyM(月目标), FMoneyTM(月实际) | 人工维护 |
| **计算** | FMonthCut | `FMoneyTM - FMoneyM`(>0 超额,<0 未达标) |
| **关联** | FStart, FEndTime | 所属年度计划起止月,定位"这一笔归哪个年度" |

**重点字段**:
- 计算字段:FMonthCut = `FMoneyTM - FMoneyM`
- fire-event=1(触发联动):FMoneyM、FMoneyTM、FMonthCut
- 引用外部对象:FProject→PUB_Project、FUnits→PJ_Funit
```

**❌ 不合格**:把 27 个字段全列出来不分主次,或 FMonthCut 只写"月差异"不写公式。

---

### 第三节:增删改逻辑(核心节)

**目的**:把 steps 命令的树状缩进翻译成人话,让读者看懂分支判定。
**必填要素**:
1. 新增 `_Add`:前置校验 + 分支判定(每个分支的**条件和动作**都要写) + 联动更新了谁
2. 修改 `_Update`:拦截条件 + 联动重算
3. 删除 `_Del`:是否有拦截 + 删除后如何重算汇总
4. 所有计算公式**完整写出**

**深度标杆**(T_BenfitM 的 Add,展示分支深度):
```markdown
## 三、增删改逻辑

### 新增(T_BenfitM_Add)
前置校验:FDate 不得早于台账的效益核算日期 FBenCheT,否则报错退出。

按"这个月归到哪个年度"分四种分支(查 T_PJBenefitFee 和 T_BenfitY 是否有匹配区间):

| 分支 | 计划表有匹配年度? | 年效益表有匹配年度? | 处理 |
|---|---|---|---|
| ① | 否 | 否 | 新建月明细 + 新建年效益"第N年",区间=计划表最后一条+12个月 |
| ② | — | 是 | 新建月明细(起止取年效益的)+ 累加年效益 `FTYearBen += FMoneyTM` |
| ③ | 是 | 否 | 新建月明细 + 新建年效益(年度信息从计划表取) |
| ④ | 否 | 有数据但月份不在区间 | 新建月明细 + 新建下一年效益(第N+1年,区间顺延12个月) |

核心判定 SQL(左闭右开):`to_date(FDate,'yyyy-MM') >= FStart and < FEndTime`

联动台账 T_PJBenefit 重算:
- FTAddBen = `SELECT sum(FMoneyTM) FROM T_BenfitM WHERE FProject=?`
- FSurplusM = `FTMoney - FTAddBen`
- FTBenY(年化) = if 已收<12月:`(FTAddBen/月数)*11.5`;else 最近12个月 sum(FMoneyTM)

### 修改(T_BenfitM_Update)
拦截:若台账 FStutas != 1(已完结或中止)且非管理员 → 提示"已回收完成或效益中止",禁止改。
改 FMoneyTM/FMoneyM/FMonthCut → 重算所属年度 FTYearBen、FCut → 同 Add 那套台账重算。

### 删除(T_BenfitM_Del)
删月明细 → 重算年效益累计与差异 → 重算台账。注意:删除无拦截(风险点,见第八节)。
```

**❌ 不合格**:只写"新增分四个分支"但不写每个分支的条件;或 FTBenY 只说"按公式计算"不给表达式。

---

### 第四节:联动对象清单

**目的**:用一张表穷尽"本对象的增删改会推到哪些对象、改它们的哪些字段"。
**必填要素**:
1. 表格三列:被联动对象 / 改的字段 / 计算公式
2. 公式**完整写出**,不能省略

**深度标杆**(T_BenfitM 实例):
```markdown
## 四、联动对象清单

| 被联动对象 | 改的字段 | 计算公式 |
|---|---|---|
| T_BenfitY(年效益) | FTYearBen | `年内各月 sum(FMoneyTM)` |
| T_BenfitY | FCut | `FTYearBen - FYearBen` |
| T_BenfitY | FStatus | 完结时置 1 |
| T_PJBenefit(台账) | FTAddBen | `SELECT sum(FMoneyTM) FROM T_BenfitM WHERE FProject=?` |
| T_PJBenefit | FSurplusM | `FTMoney - FTAddBen` |
| T_PJBenefit | FTBenY | `if 已收<12月:(FTAddBen/月数)*11.5 else 最近12月 sum` |
| T_PJBenefit | FStutas | `if FSurplusM>0:1 进行中;elif 按时:2;else 3` |
```

**❌ 不合格**:只写"联动了 T_BenfitY 和 T_PJBenefit",不列具体字段和公式。

---

### 第五节:状态机

**目的**:若有状态字段,画出完整迁移图。
**必填要素**:
1. 用文本图/代码块画状态迁移(节点+箭头+条件)
2. 标明每个状态的枚举值含义
3. 无状态字段则写"无",但**必须确认**——不要因为懒而跳过

**深度标杆**(T_PJBenefit 的 FStutas 实例):
```markdown
## 五、状态机(FStutas)

​```
                  增删月明细触发重算
   ┌──────────────────────────────────────────────┐
   ▼                                              │
[1 进行中] ──FTAddBen≥FTMoney 且 按时──► [2 按时完成]
   │                                       
   └───FTAddBen≥FTMoney 且 延期────────► [3 延期完成]

FStutas≠1 时:T_BenfitM_Update 被拦截(不可改),但 _Del 不拦截(风险点)
FStutas∈{2,3} 时:该项目所有 T_BenfitY.FStatus 置 1(年效益完结)
​```
```

**❌ 不合格**:只写"状态有 1/2/3 三个值"不画迁移条件。

---

### 第六节:查询/视图/报表

**目的**:梳理查询侧(列表视图、报表 SQL)的筛选和权限逻辑。
**必填要素**:
1. 列出相关视图(V_*)和报表(SQL_*)文件
2. 视图/报表的筛选条件 + 权限过滤逻辑用 `view` 命令机械提取(`<condition>` 的 statement 全文照抄,尤其按用户/角色过滤的),不要凭印象手写
3. 用 `buttons` 命令枚举对象与视图的**全部按钮**(新增/修改/删除/导入/导出/批量删除/维护入口),逐个给迁移标记(迁/不迁/待确认)——按钮只配在 `<display-options><commands>`,不看必漏

**深度标杆**(T_BenfitM 的报表实例):
```markdown
## 六、查询/视图/报表

- **V_BenfitM**:T_BenfitM 的列表视图,按项目排序。
- **页面按钮**(`buttons` 命令输出):视图 = 新增/修改/删除/导入/导出;对象另有 批量删除 + 6 个维护入口
  (初始化/部分初始化/更新月目标/初始化年效益/春节折半/更新月差异)。维护入口对应第七节流程;
  **批量删除、导入需求未写 → 待确认**,导出按钮旧系统实有(`V_BenfitM.xml` commands 配 ToExcel/LoadExcel)。
- **SQL_NOReachBM / VO_NOReachBM**(未达成月目标效益报表):
  - 筛选:`FMoneyTM < FMoneyM`(月差异为负)且台账 `FStutas=1`(进行中)
  - **权限过滤**:必须是该项目的经理/PMO/助理/其他用户,用 `instr` 匹配 PUB_Project 的 FProjMng/FProPMO/FProAssistant/FOUser/FOTHERUSER 字段
  - 二次筛选:支持按项目编号、所属单位过滤
```

**❌ 不合格**:只列视图名不写筛选条件,尤其漏掉权限过滤。

---

### 第七节:初始化/维护类流程

**目的**:梳理运维类流程(初始化、批量更新、特殊处理),这些往往是"坑"的来源。
**必填要素**:
1. 表格:流程名 / 触发时机 / 作用
2. 特别标注"硬编码"或"需手动触发"的流程(这些是运维盲区)

**深度标杆**(T_BenfitM 实例):
```markdown
## 七、初始化/维护类流程

| 流程 | 触发时机 | 作用 |
|---|---|---|
| T_BenfitM_UFMonthCut | 运维手动 | 全表刷月差异:`UPDATE ... SET FMonthCut=FMoneyTM-FMoneyM` |
| T_BenfitM_M | 运维手动 | 月目标回填:按年度区间把 FMoneyM 设为计划表 FMonthBen |
| T_BenfitM_Spring | **需手动触发** | 春节月目标折半:`FMoneyM = FMoneyM/2`,春节月来自 T_Spring.FYearM |

⚠ T_BenfitM_Spring 不会自动触发——若春节月目标没折半,数据会偏高。
```

**❌ 不合格**:只列流程名不写作用,或不标注"需手动触发"的风险流程。

---

### 第八节:值得注意的点(人工洞察,价值最高)

**目的**:本节是梳理的核心价值,机械部分填不出,必须人工分析。
**必填要素**:**至少 4 条**,覆盖以下 4 个固定维度,每个维度至少 1 条:

| 维度 | 要找什么 |
|---|---|
| **业务约定** | 左闭右开、特殊系数(如 11.5)、节日处理、时间窗口规则等业务侧的隐式约定 |
| **数据一致性风险** | 删除没拦截、公式不一致(增删改路径算出不同值)、状态锁缺失等 |
| **边界情况** | 空值、跨年、闰月、并发、首次无数据等边界 |
| **性能或权限** | 全表扫描、N+1 查询、权限过滤缺失、硬编码等 |

**深度标杆**(T_BenfitM 实例):
```markdown
## 八、值得注意的点

1. **业务约定**:`FMoneyM`(月目标)来自计划表自动回填,`FMoneyTM`(月实际)靠人工录入——
   月差异本质是"实际 vs 计划"的偏差。年化系数 `×11.5` 而非 ×12,按"一年有效回收 11.5 个月"算(扣春节等)。
2. **业务约定**:年度区间**左闭右开**(`>=FStart and <FEndTime`)是整个体系判定月份归属的统一约定,
   改任何一处都要保持一致。
3. **数据一致性风险**:`FTBenY` 公式在新增流程用 `FTAddBen/月数×11.5`,删除流程用最近12个月回算,
   两条路径算出的年化值可能不同。删除流程没有 Update 那样的状态拦截,完结后仍可删月明细,
   会导致台账 FTAddBen 退回、状态可能从完结回退到进行中。
4. **边界情况**:`T_PJBenefit_Add` 里 2 月顺延写死 `'2020-02'`,只对 2020 春节有效。
   若系统跨多年运行,后续春节不会自动顺延——靠 T_Spring 表 + T_BenfitM_Spring 折半流程才是一般化处理。
   两套机制并存,容易混淆。
```

**❌ 不合格**:只写"有一些风险"不给具体例子;或 4 条都挤在"业务约定"维度,其他维度空白。

---

## 二、质量检查清单(输出前自检)

文档落盘前,逐项确认:

- [ ] 第一节有上下游图(不是纯文字描述)
- [ ] 第二节按 4 类分组,计算字段写出完整公式
- [ ] 第三节每个分支都写了**条件和动作**,所有公式完整展开
- [ ] 第四节联动表覆盖了增删改推到的所有对象,公式完整
- [ ] 第五节状态机画了迁移图(若有状态字段)
- [ ] 第六节报表写了筛选条件 + 权限过滤
- [ ] 第六节用 `buttons` 枚举了对象/视图全部按钮,逐个给迁移标记(需求未写的标"待确认")
- [ ] 第七节标注了"需手动触发"的风险流程
- [ ] 第八节至少 4 条,覆盖业务约定/一致性风险/边界/性能权限 4 个维度
- [ ] 全文无"..."占位符或"待补充"

---

## 三、常见陷阱

- **对象名多前缀**:对象名同时是多个前缀时(如 `WO_PM02001`/`WF_PM02001`/`T_PM02001`),先 `locate` 确认,别选错
- **UI 参数副本折叠**:`overview` 默认折叠 UI 参数副本只显示主字段——如需看 UI 弹窗字段,直接读对应 `_Param_UI.lbz`
- **中文搜索**:必须用工具(python 解码后搜),**不要用 shell grep 搜中文**(gb2312 会乱码)
- **高频字段 refs**:`refs` 高频字段(FProject、FType)会命中几十上百个文件,工具已自动聚合+限量,直接看输出即可
- **超大文件**:`steps` 对超大 workflow(如 WF_PM02001 619KB)只抽 `<step name>` 审批链;对超大 WO 对象跑 `--compact` 避免爆炸
- **忘了设 LBZ_WORKSPACE**:工具会从自身位置推导默认值(可能不对),导致找不到文件——务必显式设置环境变量或 `-r` 参数
- **⚠ 弹窗字段表达式在 method parameter,不在 object column**(高频踩坑):LiveBOS 新增/修改弹窗的字段计算表达式挂在**流程方法(method type=12)的 `<parameters>`** 里对应字段的 `<expression>`,而非对象 `<columns>`。`overview`/`fields` 只解析 object columns,**会漏看 method parameter 的 expression**,导致误判"字段无公式/带不出"。排查弹窗字段联动(如"选项目带出某字段")正确姿势:① 看该字段的 `_Param_UI.lbz` 事件里 `evalExpression` 标记哪些字段重算(`flag=true`);② 再去对象 xml 里对应 **Add/Update 方法的 `<parameters>`** 找这些字段的 `<expression>`(可含 `<%@ livebos language='javascript' %>` 脚本或 SQL)。两处结合才是完整链路。**实例**:`T_BenfitM` 的 FMoneyM(月目标回收值)在 `<columns>` 里 expression 为空,但在 `T_BenfitM_Add` 方法的 `<parameters>` 里有完整的"查计划表 `T_PJBenefitFee.FMonthBen` + 春节月折半 + fallback"带出脚本——曾因此两度误判"选项目带不出月目标"
- **⚠ 页面按钮在 display-options/commands,不在 .lbz**(高频踩坑):新增/修改/删除/导入(LoadExcel)/导出(ToExcel)/批量删除(BatchDel)/维护流程入口,全部配置在对象/视图 XML 的 `<display-options><commands>` 块,`steps`/`formulas` 都看不到,**必须跑 `buttons` 命令**。2026-08-18 效益模块查缺补漏实证:台账 12 个按钮、月明细 13 个按钮全漏,月明细还误判"LiveBOS 视图无导出配置"(实有 ToExcel/LoadExcel)。另注意:①流程对象(WO_*)所在目录的每个汇总页变体(CLZ处理中/GLST管理视图/WCY我参与/WDSQ我的申请/YWC已完成)各有独立按钮配置;②同目录可能藏着独立遗留对象(如 `PM_ImportTest`),`buttons` 的目录级扫描能一并暴露
- **跨模块写入链靠反向引用发现**:对象被谁改不能只看本目录——用对象名(纯 ASCII,GBK 文件 grep 安全)全工作区反查引用,再 `steps` 确认读/写。2026-08-18 实证:项目变更流程(`WO_QT04001_UPJBen`/`UpdateProName`/`UpdateFProjMng`)会刷效益台账冗余字段、删计划明细重建,效益目录内完全看不到
- **导出 .lbz 可能不完整**:字段写入逻辑可能在线上未导出的流程/平台元数据/数据库直填。若某字段"无写入入口却有值"(如 `T_PJBenefitFee.FStart/FEndTime`),需用**生产数据交叉验证**,并全局搜特征函数(如 `add_months(`)定位真实源头(本次靠此锁定 `WO_QT04006_IntoBenefit` 的 `add_months(FBenCheT,(年度序号-1)*12)`)
- **⚠ XML 结构解析禁用裸正则分块(高频踩坑,2026-10-14 实证)**:LiveBOS 导出 XML 格式化不规整(标签与属性间双空格/跨行,如 `<column  name="ID"`),单空格正则 `<column name=` 匹配 0 次**不报错**,直接得出"无节点字段权限"的错误结论——正则 0 匹配≠不存在,先怀疑模式再下结论。结构类解析一律用 ET 树级解析:GBK 解码 → 正则去 `<?xml?>` 声明(多字节声明 ET 不支持) → 重编码 UTF-8 → `ET.fromstring`。当解析结论与领域常识矛盾(低代码平台必然有节点显隐/权限配置)时,必须先复核解析器再坚持结论
- **⚠ 节点字段权限在 WF 每个 step 内嵌 `<object><columns>`**(高频漏看,2026-10-14 实证):审批流每个节点对该表单有独立的字段三态配置——`disabled="false"+hidden="false"`=可编辑、`disabled="true"`=锁定可见、`hidden="true"`=隐藏;子表字段以 column 内嵌套 `<object>` 配置。`steps` 命令现已输出每节点「字段权限[对象]: 可编辑(N): … | 锁定可见(N) | 隐藏(N): …」+「子表权限」行。需求文档里"某字段某环节才开始显示/编辑"的实证来源就在这里(如工程采购:采购预算附件仅采购预算编制节点可编辑、采购进度明细装修采购主管选人/供方开发执行填进度、基建项目编号仅分管副总裁可编辑、费用归属子表全部审核节点可修正)
- **⚠ XML 引用函数/对象查无定义 ≠ 解析遗漏,先裁"悬空引用"(2026-10-22 平迁实证)**:对象 XML 的 constraint/expression 引用 `fn_PUB_GetFlowProject`/`PUB_FlowCustomProject`,而库里(直调 ORA-00904)与平台元数据全找不到定义时,**决定性裁决=对比库中 `LBOBJECTDEFS` 该对象 definition CLOB 与工作区 XML**——库定义(id=6104 PM_CloseApply)不含此引用而工作区 XML 含 → 工作区快照是含废弃引用的旧版本,该功能已在生产废弃,不是漏解析。勿急于断言"连接的库不对"让用户换连接(本次曾误判,被用户质疑"源码和数据库就这一份"后穷尽排查才定案)
- **全工作区搜索三大盲区(Grep 工具覆盖不到,2026-10-22 实证)**:①ripgrep/Grep 默认跳过**点开头隐藏目录**(`.component`/`.RESOURCE`/`.SQLLITEDB` 等)——livebos-prod 有 38 个顶层目录,别以为只有业务模块;②**二进制文件**被按二进制跳过——`.SQLLITEDB/studio.db` 是 Studio 缓存(表:studiotreenode/referenceitem/objectmethod),用 python `sqlite3.connect('file:...?mode=ro&immutable=1', uri=True)` 只读查;③彻底搜索用 `python os.walk` 字节级扫描所有文件(`data.find(b'关键字')`,函数名/对象名是 ASCII 可直接 bytes 搜,覆盖隐藏目录+zip+二进制全部)。注:`.lbz` 就是 XML 文本,ripgrep 可搜,**非盲区**;无扩展名文件多为 XML(head=`3c3f786d6c`=`<?xml ve`)
- **函数/对象存在性最快验证=运行时直调**:`SELECT fn_xxx(NULL,...) FROM dual` 报 `ORA-00904 invalid identifier` 即不存在,比遍历 dba_objects/dba_source 更决定性;验证物理表用 `user_tab_columns/user_objects`,验证平台对象用 `lbobjectdefs WHERE UPPER(tablename) LIKE ...`

---

## 四、LiveBOS 文件格式约定

(执行流程中需要时查此节)

- `.lbz` 就是 XML(按 XML 解析,**不要当二进制**)
- 编码 **gb2312**,工具已内置容错解码
- 文件名前缀语义:
  - `T_*/PM_*/PUB_*` 业务对象(`<object>`)
  - `WF_*` 流程(`<workflow>`/`<process>`)
  - `V_*/VO_*` 视图、`SQL_*` 查询
  - `Dialog_*` 弹窗对象、`View_*` 对象型查询/导出视图(`<parent>` 挂宿主对象,如 View_DC 是子表导出视图)、`PAGE_*` 页面定义(`<expage>`)
  - `*_Add/_Del/_Update.lbz` 增删改流程
- 按钮配置在对象/视图 XML 的 `<display-options><commands>` 块(`<command type>`:2=内置命令,5=流程/方法调用)

### 标签覆盖矩阵(2026-08-18 效益域 127 标签全量盘点)

**机械解析(工具输出直接含其逻辑)**

| 载体 | 标签 | 解析模块 |
|---|---|---|
| 字段 | `column`(name/describe/type/ref-object/expression/enabled/fire-event + unique/nullable/check-type/validation/default)、`columns`、`constraint`(type+SQL+refColumn,候选过滤如选项目条件——2026-10-22 补齐,曾误归"无逻辑"导致平迁梳理全漏) | parsers/fields |
| 按钮 | `display-options`/`commands`/`command`/`define`/`item`/`is-default` | parsers/buttons |
| 视图 | `parent`、`condition`(args+statement)、`properties`(73=可排序字段集,推断) | parsers/views |
| 业务流程 | `process` 头、`invoke`/`arg`、`if`/`elseif`/`else`/`forEach`/`sequence`、`response`/`message`/`retvalue`、`assign`、`copy`(from/to)、if/elseif 的 `conditions` 表达式(cond 摘要) | parsers/process_steps 等 |
| 审批定义 | `workflow`、`step`、`meta`(finish)、`dynOwner`(动态办理人 CDATA)、`unconditional-result`(流转规则)、WF 级 `pre/post-functions`(业务挂接 processName)、step 内嵌 `object/columns`(节点字段三态:可编辑/锁定可见/隐藏,子表嵌套 object 单列) | parsers/workflow_steps |
| SQL | `arg name="SQL"`、内联 select/ABS_SQLVALUE | parsers/sqls |
| 表达式 | `expression` | parsers/formulas |

**盘点后判定无逻辑/低价值,不解析**
- `extend-buttons`(效益域 36 文件全为空标签)、`uiforward`/`url`(固定 `LB_StartWorkflowURI` 转发模式)
- 布局展示类:`orders`/`restrictions`/`datasource-name`/`templet`/`panels`/`subdivisions`/`tb-items`/`grid-*`/`ctrl-width`/`summary-type`/`source`(`constraint` **已移出本类**——它是候选过滤业务逻辑,见机械解析表)
- 每列必有的纯结构属性(空值为主):`length`/`scale`/`biz-type`/`control`/`primary-property`/`visible`/`option`/`meta-column`/`category`/`real-type`/`comment`/`attribute`/`order-direction`
- 流程图布局文件:`layouts`/`pools`/`cell`/`dimension`/`label`/`bendpoint`

**含逻辑但走"人工读"条款(容器清单)**
- `methods`/`method`/`parameters`——弹窗字段表达式(高频踩坑,见常见陷阱)
- 对象级 `pre-functions`/`post-functions`/`ui-logics`/`events`/`event`/`variables`/`workflow-bind`/`services`(WF 流程级的 pre/post-functions 已机械解析,**对象 method 级**的仍需人工读)
- **超大文件别整读**(`WF_PM02001.xml` 619KB 等),一律用本技能内置工具抽取

### XML 解析实现要点(parsers/renderers,2026-10-14 新增)

#### 1. WF 节点字段权限(workflow_steps 双轨解析)

**数据流**:readers 解出 GBK 全文 → `parse_workflow_def(data)`——

1. **骨架走正则**(step/meta/dynOwner/流转/挂接):模式统一用 `[^>]*`/`re.S` 容忍空白与跨行,只做"单标签内属性/文本"的局部提取,不做跨层结构判断;
2. **结构类信息一律 ET 树级**(`_node_fields`):`_strip_decl` 正则去 `<?xml?>` 声明(GB2312/GBK 多字节声明 ET 不支持)→ 重编码 UTF-8 → `ET.fromstring` → 遍历 `steps/step`,取 step **直接子级** `<object name=主对象>` → `_columns_of` 递归:按 `hidden="true"→隐藏`、`disabled="true"→锁定可见`、其余→可编辑三态分类,column 内嵌套 `<object>`(子表)递归为 `sub`,并同时采集 `editAttribute` 原值(节点间有差异,语义未实证,原样输出供比对);
3. **失败不静默**:ET 解析异常返回 `{'__error__':...}`,渲染层输出「⚠ 节点字段权限解析失败: <原因>」——禁止解析器静默吞异常后返回空结果(空结果会被误读为"无配置",正是 2026-10-14 双空格误判的教训);
4. **渲染取舍**:可编辑/隐藏列全名单(核心业务语义),锁定可见仅计数(默认态量大,PM02007 单节点即 40+ 列);按 step name 与审批链对齐输出「字段权限[对象]」+「子表权限」行。

#### 2. 字段级显隐三属性(fields)

`parse_column` 在原有校验属性外新增 `visible`/`invisible-expression`/`disable-expression` 三个采集项;渲染由 `_visibility_summary` 输出「显隐: 」行:

- `visible in (false/0/N)` → `静态隐藏(visible=false)`;
- `invisible-expression` 非空 → `动态隐藏: <compact_expr>`;`disable-expression` 非空 → `动态锁定: <compact_expr>`;
- 自闭合空标签(如 `<invisible-expression/>`)正则无闭合对自然匹配不到 → 空值不输出,无需特判;
- 动态表达式常为多行 JS,统一过 `compact_expr` 压缩,`--compact` 时表内 40 字符截断(与公式全文策略一致)。

#### 3. FormUI 目标字段双形态(invokes)

`parse_invoke` 的「改字段」名单对 `<arg flag="field">` 参数分两型处理——

- **字面量型**(`type=""`,changeNullable/changeState/resetOption 的目标字段):名单追加 `字段名=值`(值截 40 字符),正则用负向先行 `(?![^>]*type="expression")` 排除表达式型;
- **表达式型**(`type="expression"`,FormSetOperate/update、FormUI/setValue 的赋值):仍由原有 `name=...type="expression"` 通用正则提取纯字段名,**不拼值**——首轮实现漏了这层区分,回归 diff 抓到 `FTMoney=V_2.FTMoney` 冗余、setValue 把整段 JS 拼进名单,靠夹具对拍拦下。

#### 4. 基线传导注意

`overview` 命令内嵌字段表渲染,**复用 renderers/fields**——改 fields 输出格式后,除 fields 外必须同步 `regression.py baseline overview`(本轮 fields/process/workflow/overview 四模块 9 个用例全部刷新)。

**维护约定**:改 parsers/renderers 后先 `python regression.py check workflow`(夹具 WF_QT04009 含 step 内嵌 columns + 子表嵌套,天然覆盖新路径);输出格式有意变更先 `python regression.py baseline <模块>` 刷新快照再全量 `check`。新增解析能力时沿用双轨原则:**跨层结构用树级,文本提取用容错正则**。

**字段显隐全场景覆盖(2026-10-14 补齐后)**:显隐共四层,全部机械解析——

| 层级 | 机制 | 工具输出 |
|---|---|---|
| 对象静态 | 字段 `enabled=false`(禁用)/`visible=false`(隐藏) | `fields` 表头 `en` 列 + 「显隐: 静态隐藏」行 |
| 对象动态 | 字段 `invisible-expression`(动态隐藏,如历史日期规则)/`disable-expression`(动态锁定) | `fields` 「显隐: 动态隐藏/动态锁定: <表达式>」行 |
| 流程节点 | step 内嵌 `object/columns` 三态 + 子表 `editAttribute` | `steps` 「字段权限[对象]」+「子表权限」行 |
| 运行时 UI 事件 | `_UI.lbz` 的 `FormUI/changeNullable/changeState/resetOption` 目标字段(字面量型 `flag="field"` 参数) | `steps` 「改字段: FJoin=false」形态;注意 `type="expression"` 的 field 参数(FormSetOperate/setValue 赋值)走通用提取,不拼值,二者勿混 |

## 五、连库核对速查(工作区无实证的平台配置,2026-10-14 九牧生产库实证)

梳理中遇到"规则配置在平台/数据库端"时按此定位(JMBPM schema,`database-operate` 技能连库):

| 待核对项 | 表 | 关键列/示例 |
|---|---|---|
| 表单编号规则 | `T_SYS_OBJECTNO` | OBJECTTABLE=WO_PM02007、FOBJECTFIELDCODE=WO_PM02007.FNO、FSTEP=WF_PM02007.0.3(生成节点)、DQBH=当前编号(GCXMCG-202610-0004);编号按模式串前缀+按月重置流水 |
| 数据字典(`$D{编码}`) | `TXTDM`(物理表,对象叫 PUB_TXTDM) | FLDM=字典编码(如 PM02002_KFZXZT)、FLMC=字典名、CBM=代码值、NOTE=显示文本、IBM=排序;`Sys_IS`=系统自带是否字典(0否/1是) |
| 库端流程定义比对 | `OS_WORKFLOWDEFS` | WF_NAME/WF_DEFINITION(CLOB);`DBMS_LOB.GETLENGTH` 与设计器导出字符数一致=库端与工作区同步 |
| **平台对象定义** | `LBOBJECTDEFS` | TABLENAME/TYPE/DEFINITION CLOB/OBJECTDESCRIBE(九牧 2334 对象);关联表:`LBBIZFUNCTIONDEFS`(业务函数,本环境空表)、`LBDESIGNEDOBJECTS`、`T_SYS_OBJECTMAP`;搜 CLOB 用 `DBMS_LOB.INSTR`(**区分大小写,驼峰/大写各搜一遍**;勿用 `DBMS_LOB.SUBSTR(def,32000,1)` 会 ORA-06502) |
| 函数存在性验证 | 运行时直调 | `SELECT fn_xxx(...) FROM dual` → ORA-00904=不存在(最快);库中对象定义是否含某引用:`SELECT DBMS_LOB.INSTR(definition,'关键字') FROM lbobjectdefs WHERE UPPER(tablename) LIKE ...` |
| 字典值域反查 | 业务表 DISTINCT | 字典表找不到编码时直接 `SELECT DISTINCT 字段 FROM WO_对象` 看实际值域 |

**已实证为空/无关,勿再探**(九牧环境):`LBCOLUMNPERMISSION`(节点字段权限不在库端,就在 WF XML step 内嵌 columns)、`LBWORKFLOWPROPERTY`、`T_SYS_CODECONFIG`、`SYS_DICT`、`T_DICT`、`TCUSTOMSERIAL`(编号计数不在这)、`JOMOOHR.SYS_DATA_DICTIONARY`(HR 专用)。
