# 审批人配置规则（assignee）

节点审批人通过样本 JSON 的 `assignee` 字段配置。本文档说明 4 种 source 类型、XML 模板、占位符规范。

> 基于 `samples/dynamic-assignee-demo.json`（纯占位符示例）+ 真实导出包逆向验证。

## assignee 字段格式

支持**单对象**或**数组**（数组 = 多规则，对应真实 cacl 的 `;` 分隔）：

```jsonc
// 单规则（兼容旧格式）
{ "assignee": { "source": "var", "varName": "managerUser" } }

// 多规则（如"取 S6-1 或 S6-2 汇报关系"，任一有值即可）
{ "assignee": [
  { "source": "hrScript", "role": "S6-1" },
  { "source": "hrScript", "role": "S6-2" }
]}

// 不配 assignee：默认 source=start（发起人）
```

## 4 种 source 类型

### 1. `start` — 发起人（默认）

不配 `assignee` 即默认此类型。也可显式声明。

```jsonc
{ "source": "start" }
```

**生成的 XML**（extProcess 内）：
```xml
<cusers source="start"></cusers>
```

### 2. `spec` — 指定用户

固定指派某人审批。**会签**（多人同时审）场景把 `logicCal` 设为 `and`。

```jsonc
// 单人
{ "source": "spec", "userName": "<USER_NAME>", "userId": "<USER_ID>", "account": "<ACCOUNT>" }

// 会签（多人都用 and；此处演示同节点多人，实际写多条 spec）
{ "source": "spec", "userName": "<USER_NAME>", "userId": "<USER_ID>", "account": "<ACCOUNT>", "logicCal": "and" }
```

| 字段 | 必填 | 说明 |
|---|---|---|
| userName | 是 | 用户姓名 |
| userId | 是 | 用户ID（雪花号，19位数字） |
| account | 是 | 工号 |
| logicCal | 否 | 默认 `or`；会签用 `and` |

**生成的 XML**：
```xml
<cusers source="spec">
  <members account="<ACCOUNT>" userId="<USER_ID>" userName="<USER_NAME>"/>
</cusers>
```

### 3. `var` — 流程变量取人 ⭐ 最常用

从流程变量动态取审批人（真实业务里约 60% 节点用此类型）。变量名必须在 `variables` 里声明。

```jsonc
{
  "source": "var",
  "varName": "deptManagerUser",     // 必填：变量 key（需在 variables 定义）
  "userValType": "account",          // 可选：默认 account（账号）
  "executorType": "user",            // 可选：默认 user
  "desc": "[变量]部门负责人",        // 可选：描述，默认 [变量]+varName
  "logicCal": "or"                   // 可选：默认 or
}
```

| 字段 | 必填 | 默认 | 说明 |
|---|---|---|---|
| varName | 是 | — | 流程变量 key，必须与 variables 里的 key 一致 |
| userValType | 否 | `account` | 值类型：account / userId / userName |
| executorType | 否 | `user` | 执行者类型 |
| desc | 否 | `[变量]varName` | 人读描述（进 nodeDispose 节点级 description 和 XML userRule description，如"一级会签人员"） |

**生成的 cacl JSON**（平台标准形态：嵌套 `var` 对象，cacl 内 description 固定为 `flowVar[user:x]`，与人读 desc 分离）：
```json
{"extract":"extract","pluginType":"cusers","var":{"userValType":"account","executorType":"user","groupValType":"","name":"deptManagerUser","source":"flowVar","dimension":""},"description":"flowVar[user:deptManagerUser]","source":"var","logicCal":"or","userName":"","userId":"","account":""}
```

**生成的 XML**：
```xml
<cusers source="var">
  <var executorType="user" name="deptManagerUser" source="flowVar" userValType="account"/>
</cusers>
```

> 系统运行时：表单/前置节点把审批人工号写入 `deptManagerUser` 变量，本节点读取该变量确定审批人。

### 4. `hrScript` — 人员脚本（汇报关系）⭐ 真实业务 30% 节点用

通过 HR 脚本按汇报关系取人（如"取发起人的三级组织负责人 S3"）。支持**双脚本变体**，scriptId/方法名/参数描述/默认组织纬度全部从 `config.json` 的 `hrScript` 段自动填充，无需手写：

```jsonc
{
  "source": "hrScript",
  "role": "S3",                  // 必填：流程角色码（见下表）
  "scriptVariant": "byId",       // 可选：byCode（默认）/ byId，见下表
  "userVar": "startorAccount",   // 可选：基准用户变量，默认内置变量 startorAccount（发起人工号）
  "userVarDesc": "发起人工号",   // 可选：变量的人读描述，内置变量自动从 config 取
  "orgDim": "jomoo-zuhu_EG",     // 可选：组织纬度ID，默认取 config.json 的 hrScript.orgDim
  "logicCal": "or"               // 可选：默认 or
}
```

**两种脚本变体**（环境常量在 config.json 的 `hrScript.scriptVariants`）：

| scriptVariant | 脚本名 | 方法 | arg0 绑定 | 典型用法 |
|---|---|---|---|---|
| `byId`   | 根据用户Id获取指定汇报关系 | `getUserByFlowUser` | `id` | QT04010 搭配 startUser 在用（留观，勿改） |
| `byCode`（默认） | 根据用户code获取指定用户的汇报关系 | `getUserByFlowUserCode` | `account` | S3（三级组织负责人）、S6-1（分管副总裁） |

> 环境约定（真实导出包验证）：S3 和 S6-1 均搭配 `byCode` 变体（scriptId=`1559561472816123904`，方法 `getUserByFlowUserCode`）。新角色码不确定时先问用户或参照同环境已有流程。

**平台内置流程变量**（无需在 variables 声明，清单在 config.json 的 `builtinVars`）：

| 变量名 | 含义 |
|---|---|
| `startorAccount` | 发起人工号 |
| `startUser` | 发起人内部 id（QT04010 五条 byId 规则实测配对；PMS 后端无赋值代码，疑为平台内置上下文变量，2026-10-28 排查留观结论：非误配不动） |

| 字段 | 必填 | 说明 |
|---|---|---|
| role | 是 | 流程角色码（宏天标准枚举，见下） |
| scriptVariant | 否 | `byCode`（默认）/ `byId` |
| userVar | 否 | 基准用户变量名，默认 `startorAccount` |
| userVarDesc | 否 | 变量人读描述（进 params.description 和顶层 description），内置变量自动取 |
| orgDim | 否 | 组织纬度ID，默认 config.json 的 `hrScript.orgDim` |
| scriptId | 否 | 默认按 scriptVariant 从 config.json 取；显式指定可覆盖 |

**常用角色码**（宏天标准，非业务数据）：
| code | 含义 |
|---|---|
| Z1 | 直属上级（一级汇报） |
| S1 | 总经理 |
| S2 | 副总经理 |
| S3 | 三级组织负责人 |
| S6-1 / S6-2 | 分管副总裁（两个维度取一） |
| S7 | 执行总裁 |

**生成的 cacl JSON**（平台标准形态，键序固定：scriptId 首位，无顶层 source/userName/userId/account；常量参数的 value 和 description 均带引号）：
```json
{"scriptId":"1559561472816123904","extract":"extract","pluginType":"hrScript","description":"[人员脚本]【根据用户code获取指定用户的汇报关系】参数:(用户账号account:发起人工号 ,流程角色code:\"S3\" ,组织纬度ID:\"jomoo-zuhu_EG\" )","logicCal":"or","params":"[...]","script":"jiuMooUserScript.getUserByFlowUserCode(startorAccount ,\"S3\" ,\"jomoo-zuhu_EG\" )"}
```

**生成的 XML**（完整，含脚本内容/参数；CDATA 内一律原文不做实体转义）：
```xml
<hrScript extract="extract" logicCal="or">
  <content><![CDATA[jiuMooUserScript.getUserByFlowUserCode(startorAccount ,"S3" ,"jomoo-zuhu_EG" )]]></content>
  <description><![CDATA[[人员脚本]【根据用户code获取指定用户的汇报关系】参数:(用户账号account:发起人工号 ,流程角色code:"S3" ,组织纬度ID:"jomoo-zuhu_EG" )]]></description>
  <scriptId><![CDATA[1559561472816123904]]></scriptId>
  <params><![CDATA[[{arg0},{arg1},{arg2}]]]></params>
</hrScript>
```

> scriptId/orgDim 已从 config.json 自动填充真实值，不再需要导入前人工替换。**换环境**时从目标环境【系统脚本管理】查两个脚本的新 ID、从组织架构查纬度 ID，更新 config.json 即可。

## 占位符规范

示例样本（如 `dynamic-assignee-demo.json`）的所有业务值统一用尖括号占位符，**导入前必须替换**：

| 占位符 | 含义 | 替换来源 |
|---|---|---|
| `<USER_ID>` | 用户ID（19位雪花号） | 系统用户管理查询 |
| `<ACCOUNT>` | 工号 | 同上 |
| `<USER_NAME>` | 用户姓名 | 同上 |
| `<TYPE_ID>` | 流程分类ID | 系统流程分类管理 |
| `<SYSTEM_ID>` | 系统ID | 目标系统标识 |
| `<TENANT_ID>` | 租户ID | 目标租户 |
| `<var_name>` | 流程变量名（小写） | 需与 variables 定义一致，自行命名 |

> hrScript 的 scriptId / orgDim **不再是占位符**，已从 config.json 自动填充（见 §4）。
> role 角色码（S1/Z1 等）、XML 标签名、命名空间等**系统标准枚举不算业务数据**，直接写真实值。

## 多规则的语义（`logicCal`）

一个节点配多条规则时，每条规则生成一个 `<userRule>`：

| logicCal | 含义 | 场景 |
|---|---|---|
| `or`（默认） | 任一规则取到人即可 | S6-1 或 S6-2（取得到哪个用哪个） |
| `and` | 所有规则都必须取到人（会签） | 多人同时审批 |

> 注意：`logicCal` 是**单条规则内部**的 calc 逻辑（多个 cusers/hrScript 之间）。多条 userRule 之间的关系由系统按 groupNo 处理。

## 节点行为属性（propers）

真实导出包的 `ext:userNode` 在 `ext:buttons` 之后可带 `<ext:propers><ext:item .../></ext:propers>`（52 个节点行为属性，控制回退/通知/审批区域/空审批人等行为）。

**最常用：`executorIsEmpty="jump"` = 审批人为空时自动跳过该节点**。适用"仅选择了人员才触发，无则跳过"的可空会签/执行人节点（此类需求不需要 BPMN 网关，用该属性即可）。

spec 用法（节点级，仅 userTask 支持）：

```jsonc
{ "id": "UserTask_countersign2", "type": "userTask", "name": "二级会签",
  "assignee": { "source": "var", "varName": "secondCoSigner" },
  "propers": { "executorIsEmpty": "jump" } }
```

行为约定（真实导出包验证）：

- 节点不声明 `propers` → 不输出 `<ext:propers>` 块（平台对该节点无行为配置）
- 声明后生成器输出**完整 52 属性模板**（键序/默认值对齐平台导出），spec 里只写要覆盖的键
- `executorIsEmpty` 默认 `""`（不跳过）；`"jump"` = 空则跳过。跳过目标为流程后继路径，无需额外配置
- 其余常用键：`backMode`（退回模式）、`notifyType`（通知方式）、`approvalArea`（审批区域，默认全选 `approvalOpinion,zFile,file,processRecord,imageBpm`）
- 更精细的控制仍可在导入后于节点配置界面调整

### allowInterfaceApproval（允许接口审批）

引擎对 openapi 接口代办（complete）按节点 propers **三态校验**（2026-10-08 UAT 实测）：

| 节点 propers 状态 | openapi complete 行为 |
|---|---|
| 无 `<ext:propers>` 块 | **放行**（引擎不校验） |
| 显式 `allowInterfaceApproval="false"` | **拒绝**，报「{节点名}未配置允许接口审批」 |
| 显式 `allowInterfaceApproval="true"` | 放行 |

**生成器默认 `true`（2026-10-08 起）**：声明 propers 的节点显式输出 `allowInterfaceApproval="true"`；未声明 propers 的节点无块、引擎同样放行——即生成的流程所有节点天然支持接口代办，spec 无需手写。仅当显式覆盖 `"allowInterfaceApproval": false` 时该节点才拒绝接口代办（人工 UI 审批不受影响）。

> 历史坑（生成器默认改 true 之前）：声明 propers（哪怕只为 `executorIsEmpty: "jump"`）会连带模板默认 `false`，导致该节点无法接口代办。历史导入的流程若命中，用 `configuring-ibpm-interface-approval` 技能在线补救（改前查 → saveDefConf → 改后复验，热生效）。

```jsonc
{ "id": "UserTask_countersign2", "type": "userTask", "name": "二级会签",
  "assignee": { "source": "var", "varName": "secondCoSigner" },
  "propers": { "executorIsEmpty": "jump" } }  // allowInterfaceApproval 默认已 true，无需写
```

## 生成器行为约定

1. **未知 source 降级**：遇到不识别的 `source` 值，自动降级为 `start`（发起人）并控制台告警，不中断生成。
2. **占位符不替换**：`<USER_ID>` 等用户类占位符原样进入生成的 XML——这是预期行为，导入后由人工填真实值。hrScript 的 scriptId/orgDim 例外：从 config.json 自动填充。
3. **未知 scriptVariant 降级**：遇到 config.json 里没有的 scriptVariant，告警并降级为 byCode 形态的占位模板（scriptId=`<SCRIPT_ID>`）。
4. **varName 不校验**：`var` 型的 varName 是否在 `variables` 里声明，生成器不强制校验（建议人工核对，否则系统运行时取不到值）。内置变量（如 `startorAccount`）无需声明。
