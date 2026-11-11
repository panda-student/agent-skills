# JMBOS 菜单配置直接接口操作参考

> SKILL.md「直接接口操作模式」的完整参考。由 2026-10-19「固定人员配置」菜单全流程 UI 操作抓包梳理而成，所有接口均实测通过。

## 前置参数

### 登录态（token）

- 所有接口需要请求头 `Authorization: Bearer <token>`，token 取登录后的 cookie `nisbos_auth_token`（有效期约 2~4 小时）
- 浏览器 Console 提取：`document.cookie.match(/nisbos_auth_token=([^;]+)/)[1]`
- UAT token 过期需重登（UAT 支持账号密码直登；账号密码按 `vault-ops` 技能检索「PMS 平台 UAT 超管账号」取用）
- 脚本免浏览器登录（2026-10-20 实证）：`GET https://{domain}/api/system/getSystemByDomain/{domain}` → `{systemId, domainApi}`（domainApi 无协议前缀需补 `https://`）→ `POST https://{domainApi}/niscommon/noAuth/loginNew`，请求头 `{Content-Type: application/json;charset=UTF-8, x-noauth: true, systemid: String(systemId)}`，body `{loginType:1, rememberMe:false, systemType:'1', tenantCode:'', usePwd, userCode, uuid:null}` → `data.ssoToken` 即 Bearer token；token 按 systemId 隔离，跨体系不可混用

### 环境域名映射（菜单管理类接口统一走租户网关）

| 环境 | 页面入口 | 接口域名 |
|---|---|---|
| 测试 | https://test-pms.jomoo.com | https://api-tenant-jmbos-dev.jomoo.com |
| UAT | https://uat-pms.jomoo.com | https://api-tenant-uat-jmbos.jomoo.com |

- cookie `url` 的值即当前环境租户 API 域名（可脚本化读取）

### 固定参数（PMS）

- 所属应用 `systemId = 1108598`（项目管理系统-pms，来源 `POST /orgApp/dictAppAndService`）
- UAT 系统注册 `id = 100837377`（删除菜单等接口的 systemId 参数用这个）

## 测试环境建菜单

核心接口 `POST /auth/menu/save`：

```json
{
  "menuType": 2,                                   // 1目录 2页面 3功能 4接口
  "menuName": "固定人员配置",                       // 必填，≤30字
  "path": "/projectPermission/fixedPersonRule",    // 必填，前导斜杠路径
  "pageType": "2",                                 // 页面类型：1配置页面 2自定义（menuType=2 时必填）
  "component": "advanced/fixedPersonRule",         // 自定义组件路径（pageType=2 时必填，^[a-zA-Z0-9/-]+$，相对 src/views/）
  "systemId": 1108598,                             // 必填，PMS=1108598
  "parentId": 2114298358,                          // 父菜单 id，来自 getRouters
  "systemType": 1,                                 // 1管理后台 2用户前台 0移动端
  "funType": "list",                               // list/form/echart
  "status": 1,                                     // 1启用 -1禁用
  "visible": 1,                                    // 1显示 -1隐藏
  "keepAlive": 1,                                  // 1缓存 0不缓存
  "authFlag": 1,                                   // 1需授权 0无需授权
  "sort": 0                                        // 显示排序
}
```

成功响应：`{"success":true,"message":"操作成功","code":0,"data":<新菜单id>}`

辅助接口：

- `POST /auth/menu/getRouters` body `{"noStructure": true}` → 父菜单树，取目标父目录 id
- `POST /auth/menu/appMenuList` body `{"noStructure": true, "currentPage": 1, "pageSize": 20}` → 顶级菜单树（children 含子页面），核实新菜单挂载
- `GET /app-system/getStructure?menuId=1203445` → 添加菜单弹框结构（免开弹窗即可知道 api 与表单校验规则）

常用结构 menuId 表（getStructure 用）：

| menuId | 页面 | 关键 api |
|---|---|---|
| 1203444 | 菜单列表页 | /auth/menu/appMenuList |
| 1203445 | 添加菜单弹框 | /auth/menu/save |
| 1203446 | 编辑菜单弹框 | /auth/menu/save |
| 1924485865 | 一键发布弹框 | /auth/sync-master/save |
| 2114252365 | 发布确认列表页 | /auth/sync-master/page、/auth/sync-master/changeTaskExecuteStatus |

## 菜单 id 核实（改结构前必做）

`GET /auth/menu-structure/get` 的 `menuId` 是菜单记录 id，不是页面路径，取错就是 500：

- 取值接口：`POST /auth/menu/appMenuList` body `{"noStructure": true, "currentPage": 1, "pageSize": 50}`，或 `POST /auth/sync-master/getRouters` body `{"systemId": 1108598}`；按 `path`（如 `/engineeringProject/list`）+ `component` 匹配目标页面
- **同功能菜单在各环境 id 不同**：实测工程项目采购申请汇总页 测试 2114297929 / UAT 2114298901，禁止跨环境套用 id
- 核实方法：先 `GET /auth/menu-structure/get?menuId=<核实到的 id>`，返回 200 才动手；返回 500 先怀疑 id 无效

## 页面结构编辑（menu-structure）

低代码页面（bos-saas-page）的列/查询/按钮配置存于菜单结构，可脚本直改（2026-10-20 实证：工程项目采购申请汇总页会签列 prop 由 coSigners 改 coSignerNames，测试环境改完一键发布到 UAT；测试 2114297929 / UAT 2114298901）：

- 读结构：`GET /auth/menu-structure/get?menuId=<页面菜单id>` → `data.structure` 为 JSON 字符串
- 写结构：`POST /auth/menu-structure/save` body `{menuId, structure: "<JSON字符串>"}` → 保存后 app-system 运行时结构（`GET /app-system/getStructure?menuId=`）自动同步
- auth 侧结构顶层键 `pageType/queryDom/btnsDom/table`，列在 table 下（数组或 `{dom:[...]}` 对象两种形状，遍历需兼容）；运行时侧才叫 tableDom
- 修改后复核链：auth 侧 get 回读 → app-system 运行时 getStructure → 列表接口出参核对

**列绑定 prop 判定（列恒空的第一嫌疑）**

- 列 `prop` 必须与列表接口出参字段名**完全一致**；后端 `@JsonIgnore` / `@PersonField` 会改变出参字段名（`coSigners` 被 `@JsonIgnore` 后出参只有 `coSignerNames`）
- prop 绑错时详情页正常、接口 JSON 正常、只有列表列恒空 → 极易误判成「没保存下来」（2026-10-20 实例）
- 改动前先调一次列表接口看真实出参字段名，再改 prop

**列头筛选漏斗的渲染条件（2026-10-23 实证，BosTable 源码定版）**

- `table.searchType=3`（列头筛选模式）下，BosTable 对每列在 `queryDom.dom` 里找**同 prop 的查询条件**：匹配 → `filters=[{data:''}]` + `filterDom=查询条件配置` → 列头漏斗；失配 → `filters=null` → 无漏斗。源码关键：`e.filter(u => u.prop == s.prop)`，`r.length>0 ? (s.filters=s.filters||[{data:""}], s.filterDom=r[0]) : s.filters=null`
- 推论：**列改绑翻译名字段（prop 改成 xxxName）会丢失列头筛选**——翻译名与查询条件（绑码值 prop）必然失配。列显中文与列头筛选在 searchType=3 下不能同时靠改绑实现
- 两全恢复模式（同「效益是否异常」列）：后端该字段 `@DictField replace=true` 出参原位翻译中文 + 列 prop 保持绑码值字段（与查询条件一致）。筛选面板渲染 filterDom（查询条件的字典下拉），选中后发码值查询，链路自洽
- 反向修法（列 prop 正确、queryDom 绑错时，2026-10-30 实证）：项目变更页申请人列 prop=creatorId，queryDom 原为 creatorName → 申请人列无漏斗；把 queryDom 该项 prop 直接改成 creatorId（列 prop 不动）即恢复漏斗，且筛选值按 creatorId 提交、后端按工号/姓名反查匹配
- 顶部查询区筛选（queryDom）不受列 prop 影响，始终可用；丢失的只是列头漏斗入口

**业务列表接口 host（与菜单接口不同）**

- 低代码页面业务接口走页面同源 api 域：UAT `https://api-uat-pms.jomoo.com/pms/pms-service/pms/project/common/queryListByPage/engineeringProcurement`
- 用租户网关 `https://api-tenant-uat-jmbos.jomoo.com` 调业务接口会 404（网关只转发 auth/app-system 等平台接口）
- 接口路径从菜单结构里取：结构中的 `api` 字段即业务接口路径

限制与风险：

- **structure ≤30000 字符**：必须用压缩 `JSON.stringify(structure)`——美化格式（`null, 2`）32074 字符报「页面JSON结构长度不能超过30000」，压缩后 18749 通过
  - **环境差异（2026-10-22 实证）**：**UAT 强制校验，test 无此限制**——同一结构 test 保存成功、UAT 报错；UAT 库里存量超限结构（如 30799/34761 字符）是当初经 test→UAT 同步路径写入绕过了校验
  - **读回的是美化 JSON，压缩即缩至 6 折（2026-10-30 实证）**：`menu-structure/get` 返回 `data.structure` 为带缩进的美化字符串（30739 字符），`JSON.parse` 后 `JSON.stringify` 压成 17989 字符——先压缩再比对 30000 阈值，多数页面**无需 strip 空值**即可过关，别看到 3 万+ 就直接上瘦身逻辑
  - **超限瘦身：递归 strip 空值字段**（null/''/[] 剔除，缺省等价于空值不影响运行时渲染）——实证未按期回收项目页 30799→22874、台账页 34757→25534，主因是 queryDom 内大量 null/空值字段；strip 后保存、运行时同步、UI 列渲染均验证正常。strip 逻辑：对象递归遍历，值为 null/''/空数组/空对象则删键；数组逐项 strip 后过滤 undefined
- **接口返回 500 多半是 menuId 无效，不是环境故障**：无效 id 服务端抛 500 而非 404（2026-10-20 误判实录：测试环境 menu-structure 一直返回 500，真实原因是 menuId 取成了 2114297529，实际为 2114297929；改正后测试环境读写全通、测试→UAT 发布也走得通）→ 先核实 menuId 再下结论，**禁止据此断言「某环境只能手工改」**
- **测试→UAT 发布会整体覆盖结构**：sync-master 发布菜单会把测试侧页面结构整体覆盖 UAT → UAT 上的结构修改必须同步改测试环境，否则下次发布会回滚
  - **账号环境隔离会卡住「顺手同步 test」（2026-10-30 实证）**：`pms_frontend/e2e/.env.local` 通常只配 UAT 账号（test-pms 与 UAT 登录账号不同），想在同一轮里直存 test 侧结构会卡在登录失败（`code:12003 登录账号或密码不正确`）——UAT 直存后把「test 侧待同步」作为遗留风险明确上报，不要静默留下回滚隐患
- **坑：test→UAT 发布 success 但结构未落地（2026-10-22 实证，根因未明）**：对存量页面只改结构后按目录发布（dataIds=[目录id]）与 dataIds=[0] 两次均 batch success，但 UAT auth 侧结构回读与页面运行时均仍旧绑定，也无重复菜单产生——**结构级修改不要依赖 test→UAT 发布路径，直接在 UAT 侧 menu-structure/save 直存**（直存超限时用上述 strip 瘦身）；直存后必须 auth get 回读 + app-system getStructure 运行时复核 + 真实页面 UI 终验

## 按钮配置（btnStructure）——按钮渲染的真正数据源（2026-10-21 实测定版）

**核心机制：低代码页面的按钮渲染数据源 = 页面下 menuType=3 子菜单记录的 `btnStructure` 字段，不是页面 structure 的 btnsDom**

- 页面 auth 侧 structure.btnsDom 只影响菜单管理编辑器视图，改它不改变页面按钮渲染——排查「按钮不渲染」先查子菜单 btnStructure
- runtime（`GET {PMS网关}/app-system/getStructure?menuId=<页面id>`）的按钮项由平台遍历页面 menuType=3 子菜单、按各自 btnStructure 物化生成，每个子菜单贡献一个按钮
- **物化自动重映射 id**：btnStructure 里存 test 侧 id 引用（domApi/menuId 指 test 菜单 id）没关系，物化时平台按 uuid 映射自动重映射为本环境 id；同一份 btnStructure 在 test/UAT 通用

**写 btnStructure 的正确姿势（两步保存）**

- 第一步：`POST /auth/menu/save` 建按钮子菜单（menuType=3），拿菜单 id
- 第二步：`POST /auth/menu-structure/save` 写按钮配置，**body = appMenuList 树里的完整菜单记录**，改两处：`id → menuId`、`btnStructure = 完整按钮JSON字符串`，**必须 delete pageType**（否则 code:1000）；保存后 runtime 立即重新物化
- 完整 btnStructure 关键字段（照抄正常按钮子菜单的即可）：`config:{size:"mini",type:"export",...,"icon":"bosui-icon-upload2"}`、`site:5`（工具栏）、`component:"Button"`、`tagIcon:"button"`、`key`（页面内唯一）、`event.clickFunc`

**陷阱**

- 对已有 id 的菜单重发 `POST /auth/menu/save`（整记录）会走**新建**分支误产出重复子菜单（data 返回新 id 即中招），且 btnStructure 不落库（必须走第二步 menu-structure/save）；误建的用 `POST /auth/menu/delete` 清理
- test→UAT 全量同步时 runtime 从源端物化结果拷贝，**源端（test）配置必须先用正确机制配好**，坏的 btnStructure 会原样带过去

**「按钮不渲染」排查路径**

- 比对渲染正常按钮与故障按钮的 runtime 项；残缺项特征 = `site=1`、无 config/component/key/event/tagIcon、多 `icon:""`/`showBtnArr:[]`/`custom:false` 模板默认值
- 对应根因 = 子菜单 btnStructure 是空壳模板（appMenuList 树里 btnStructure 长度 169 vs 完整 538）

## 一键发布 → UAT

核心接口 `POST /auth/sync-master/save`：

```json
{
  "systemId": 1108598,
  "syncType": "menu",              // menu菜单 / dict字典 / portal门户数据
  "targetEnv": "uat",              // uat / test
  "versionRemark": "固定人员配置菜单", // 必填，≤255字
  "dataIds": [2114298358, 2114298751] // 菜单权限树节点 id 数组
}
```

成功响应：`{"success":true,"message":"操作成功","code":0,"data":true}`

- dataIds 勾父目录会连带其下子节点（幂等无害）；只推单个新菜单也可只传该菜单 id
- **改页面结构时 dataIds 只传目标页面菜单 id**（如 `[2114297929]`）做最小化发布，避免连带用测试侧结构覆盖 UAT 上其它页面

辅助接口：

- `POST /auth/sync-master/getEnvConfigMap` → 环境列表 `[{label:"测试环境",value:"test"},{label:"UAT环境",value:"uat"}]`
- `POST /auth/sync-master/getRouters` body `{"systemId":1108598}` → 可勾选的菜单权限树（dataIds 取这里的 id）

## UAT 确认

- 查待确认批次：`POST /auth/sync-master/page` body `{"currentPage": 1, "pageSize": 20}` → `data.records[]` 按 versionRemark/batchNo/`status:"init"` 找目标行，取 id 与 batchNo
  - status 语义：init=待确认（pull 拉取）、processing=执行中、success=成功、fail=失败
- 确认执行：`POST /auth/sync-master/changeTaskExecuteStatus` body `{"id": 1424506597, "batchNo": "d0936675-…"}` → `{"success":true,"message":"操作成功","code":0,"data":null}`
- 确认后批次自动执行，轮询 page 接口直到 `status:"success"`

## 核实 UAT 菜单

- UAT 域名 + UAT token 调 `POST /auth/menu/getRouters` body `{"noStructure": true}`
- **UAT 菜单 id 与测试环境不同**（按 uuid 映射落库，实测测试 2114298751 → UAT 2114300413），核实按 menuName/path/component 匹配

## UAT 清理遗留菜单（按需）

- 推送按菜单 uuid 幂等同步，**不会删除** UAT 侧多余菜单——历史遗留菜单需手动删
- `POST /auth/menu/delete` body `{"id": <菜单id>, "systemId": 100837377}`（UAT 域名 + UAT token）
- 先删子功能再删页面，逐条调用，最后 getRouters 复核只剩正规菜单

## 实测案例时间线（2026-10-19 固定人员配置）

- 测试环境 `POST /auth/menu/save` → 菜单 2114298751（权限管理 2114298358 下，与离职人员管理同级）
- 测试环境 `POST /auth/sync-master/save` → 批次 d0936675-…（dataIds 含权限管理目录 5 节点）
- UAT `POST /auth/sync-master/page` → 行 id=1424506597，status=init
- UAT `POST /auth/sync-master/changeTaskExecuteStatus` → success
- UAT `getRouters` 核实新菜单 2114300413 就位；`/auth/menu/delete` 清理旧遗留菜单 2114300403 及其 4 个子按钮

## 实测案例时间线（2026-10-20 会签人员列修复）

- 定位：列表页会签列恒空，详情页正常 → 根因是列 `prop=coSigners`，而 ListVO 的 `coSigners` 被 `@JsonIgnore`，出参只有 `coSignerNames`
- 核实 id：`POST /auth/menu/appMenuList` 取到测试环境汇总页 id **2114297929**（UAT 为 2114298901）
- 测试环境 `GET /auth/menu-structure/get?menuId=2114297929` → 200，46 列，structure 32070 字符；改 prop → 压缩 18749 → `POST /auth/menu-structure/save` → 操作成功
- 复核：auth 侧 get 回读（coSigners 0 / coSignerNames 1）+ `GET /app-system/getStructure?menuId=2114297929` 运行时已同步
- 一键发布：`POST /auth/sync-master/save` body `{systemId:1108598, syncType:"menu", targetEnv:"uat", versionRemark:"工程项目采购申请会签人员列修复", dataIds:[2114297929]}`
- UAT `POST /auth/sync-master/page` → 行 id=1424506607、batchNo 20684ba2-…、status=init → `changeTaskExecuteStatus` → 轮询至 `success`
- UAT 复核：结构 coSignerNames 1 / coSigners 0，运行时结构含 coSignerNames；列表接口 `https://api-uat-pms.jomoo.com/pms/pms-service/pms/project/common/queryListByPage/engineeringProcurement` 出参 coSignerNames 10/10 行有值
- UI 复核：汇总页第 39 列表头「会签人员」scrollIntoView 后截图确认（丁佳阳/00207295、杨建华/00097778、多人顿号分隔）

## 实测案例时间线（2026-10-21 效益报告导出按钮）

- 现象：test 配好导出按钮并全量同步 UAT 后，页面无「导出」按钮（API 层 runtime 有按钮项但字段空壳）
- 定位：runtime 按钮项 = 遍历 menuType=3 子菜单按各自 btnStructure 物化；导出子菜单 btnStructure 仅 169 字符空壳模板（site=1、无 config/component），正常按钮 538 字符完整
- 修复：test 2114298768 / UAT 2114300475 两个导出子菜单按「两步保存」写入完整 btnStructure（config.type=export、site=5、component=Button），两端 runtime 均物化出 `导出(site=5,config=Y)`
- 中途踩坑：menu/save 整记录重发误建重复子菜单（test 2114298771 / UAT 2114300477），已 delete 清理
- 验证：UAT 页面渲染出导出按钮，E2E 点击下载 + xlsx 内容断言全绿（pms_frontend e2e/helpers/xlsx.ts）
- 同步拍板（用户）：此后 test→UAT 菜单同步一律多选根目录全量同步，禁止单点发布（单点 sync-master dataIds 只传单菜单会造成 auth 侧与 runtime 半同步）

## 实测案例时间线（2026-10-22 效益报表列改绑码值→翻译名）

- 背景：未按期回收项目/台账页「是否按期回收」列绑 `onScheduleRecycle`（码值 4），后端已新增 `onScheduleRecycleName` 翻译字段，需改列 prop
- test 侧：appMenuList 核实 id（R1 2114280544 / 台账 2114280463），get → 改 prop → save（test 无 30000 限制，34761 字符也过）→ 回读复核 Name=1/code=0
- UAT 发布失效：test→UAT sync-master 发布两次 success（dataIds=[0] 与 [目录id]）但 UAT 结构未变 → 改走 UAT 直存
- UAT 直存卡 30000：UAT id（R1 2114295549 / 台账 2114295483）存量结构 30799/34761 字符超限，直存报「页面JSON结构长度不能超过30000」
- strip 瘦身：递归剔除 null/''/[] 后 22874/25534 → 基于各自环境结构最小 diff 改 prop（勿用 test 结构整体覆盖，btnsDom 可能含 test id 引用）→ 直存成功 → 回读 Name=1/code=0 → 运行时 getStructure 同步（queryDom 查询条件保持绑码值 onScheduleRecycle 是正确的——查询发码值、列显翻译名）
- UI 终验：UAT 真实页面两页「是否按期回收」列显示中文（未按期完成回收/提前回收/未到目标回收期），「效益是否异常」列显示「否」（后端 @DictField 原位翻译，列绑定无需改）

## 踩坑记录

- **wujie 微前端 iframe blob 沙箱**：菜单页页面 JS 跑在 iframe 沙箱里，主文档 hook XHR prototype 抓不到页面请求，页面内直接 fetch API 域名会 Detached/挂起——**直接接口操作一律用 Node 脚本带 Bearer token 调网关域名**，毫秒级返回
- 弹框类 UI 自动化的替代路径：getStructure 拿结构 → 直接调结构里的 api，无需操作弹窗
- browser_evaluate 多语句脚本需包 IIFE 并 return；必须显式传 viewId（字符串类型），否则操作的是「最后交互 tab」而非 active tab
- 低代码表格数组列渲染：bos-pc 表格 getColumnData 对无字典映射的数组值用 `join("、")` 渲染 → `List<String>` 人员姓名字段（如 coSignerNames）直接绑定列即可显示顿号分隔，无需 formatter
- **低代码表格列在横向远端，UI 验证必须滚到位**：46 列的表里目标列可能在第 39 列，先 `th.scrollIntoView({block:'nearest', inline:'center'})` 把目标表头滚进视口再截图；截图要表头与单元格内容同时在画面内
- **浏览器代理的文字结论不算证据**：代理报告「该列有值」但截图里根本没有那一列的情况出现过，必须自己看截图确认；列序号用 `thead th` 序号定位取值
- **改页面 structure.btnsDom 加按钮是无效操作**：按钮渲染数据源是 menuType=3 子菜单的 btnStructure（见「按钮配置」章节），只改页面 btnsDom 按钮永远不渲染——2026-10-21 效益报告导出按钮排查半天的根因
- **menu/save 重发已有 id 的整记录 = 误建重复子菜单**：data 返回新 id 就是走了新建分支，及时 delete 清理
- **test 与 UAT 的 PMS 登录密码互相独立**：同一账号两环境密码不同，UAT 通不代表 test 通（反之亦然）

## bosui 组件 UI 自动化技巧（UI 模式用）

- vue-treeselect 需三连才同步 form：`ts.select(node)` + `w.$emit('change', node.id, node)` + `w.$emit('input', node.id)`
- bosui select 赋值可 dispatch click 到隐藏的 `.bosui-select-dropdown__item`（Vue 事件绑定不依赖面板可见）
- textarea 用 HTMLTextAreaElement 原型 setter + input/change 事件
- BosDialogAdd 表单数据在 `vm.form`，保存调 `vm.handleSubmit()`；组件链 BosDialogAdd→BosuiDialog→BosuiForm→BosuiRow→BosuiCol→BosFormItem(V1/V2)→BosuiFormItem→BosSelect/BosTree/BosInput
