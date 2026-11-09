# api-center-register 参考规范

> 在九牧 API 中心（api-portal-jmbos-uat.jomoo.com）管理后台，通过**浏览器自动化**完成接口的注册、参数补全、更新、上架与在线调试。
> **硬前提**：用户浏览器已登录 API 中心（登录态由浏览器 Cookie 会话维持；禁止用离线抓取的 token 裸调后端 API，会因会话失效返回 10001 登录已过期）。

## 1. 环境与目标

| 项 | 值 |
|---|---|
| 门户 | `https://api-portal-jmbos-uat.jomoo.com` |
| 注册入口 | 菜单「API服务管理 → API接口注册」（url: `/api-regist`），服务需选对 `项目管理系统-pms` |
| 浏览器能力 | 智能体可用的浏览器控制工具（DOM 快照、元素点击、文本输入、页面 JS 执行、网络请求捕获）；执行前先完成浏览器连接检查（若工具链要求） |
| 会话前提 | 用户已登录；**不要**尝试用 token/Cookie 直接调后端 |

## 2. 前置检查（必做）

1. 列出浏览器标签页，找到已打开的 API 中心页面；若无，导航到门户。
2. 取页面快照确认渲染出菜单（「API接口注册」等）。
3. **若为登录页**：按登录配置自动登录（配置文件 `d:\IdeaProjects\pms\.claude\config\api-center-login.md`，含账号/密码/表单元素特征/自动登录步骤）；配置文件不存在或登录失败时，停下请用户手动登录。
4. **后台标签页久置 Debugger 断连**（快照可用但页面 JS 执行报 Bridge error）：先激活该标签页，再重新导航刷新页面后重试。

## 3. 数据模型与编码速查

### 3.1 请求参数 dataType 编码（注册表单「数据类型」下拉）

| 编码 | 类型 | 编码 | 类型 |
|---|---|---|---|
| 1 | String | 4 | Date |
| 2 | Integer | 5 | Boolean |
| 3 | Long | 6 | Double |
| | | 7 | Float |

### 3.2 其它取值约定

- `requiredFlag`（必填）：下拉选「是/否」（表单层面，非数字）
- `paramType`（参数位置）：请求=1，响应=2
- 复杂嵌套参数：父/子结构，子项 `parentUUID` 指向父项 uuid
- `interfaceType=1`（HTTP）、`requestType=1`（POST）、`functionType=2`（写入）、`safeLevel=1`（公开接口）

## 4. 操作流程（浏览器 UI）

> 通用交互范式：取快照 → 点击/输入 → 等待(1~3s) → 重新取快照获得新引用。任何页面变更后元素引用失效，必须重新取快照。

### 4.1 打开注册列表并定位接口

1. 进入「API接口注册」列表页。
2. 可按接口名/请求路径「查询」过滤；或在页面执行 JS 遍历 `table tr`，按 `textContent.includes(编号/名称)` 定位目标行。

### 4.2 新增注册（interfaceRegister 的 UI 等价）

1. 点列表「新增」按钮 → 打开编辑抽屉。
2. 填基本信息：
   - 接口名称（必填）、所属服务（选对应服务名）、请求类型（选 POST）、功能类型（选 写入）、请求地址 `/pms/pms-service/{模块}/...`、服务地址 `https://api-test-pms.jomoo.com`、接口安全级别（公开接口）。
3. 填「请求示例」「响应示例」「异常响应示例」及「接口描述」「接口备注」。
4. 填「请求参数」表（逐行：参数名 `name`、数据类型 `dataType`、必填、备注），新增行点表格内「+」。
5. 填「响应参数」表（同理；嵌套项通过子行/子表格维护 `parentUUID`）。
6. 填「返回状态码」表（code / description / remark）。
7. 点「保存」，列表新增一行（状态=已保存/草稿），记录其**编号 id**。

### 4.3 参数补全或更新（interfaceRegisterUpdate 的 UI 等价）

> 更新接口按**全量覆盖**处理：编辑页回显数据库已存字段，改完保存会把整份 body 覆盖回去。**新增项用新 uuid，已有项保留其 id**，删除项直接从表格移除。

1. 列表行点「编辑」→ 抽屉回显全量字段（含系统生成字段、参数列表、状态码）。
2. 修改需变更字段：参数表新增/删除行、改必填/备注、重填报文示例。
3. 点「保存」→ `updateDate` 刷新、变更生效。可通过捕获网络请求观察 `apiInterfaceDetailForUpdate` / `getRequestParmsByInterfaceId` / `getResponseParmsByInterfaceId` 请求确认回显来源。

### 4.4 上架

列表行点「上架」→ 确认弹窗 → 状态变「已上架」。变更前先确认用户授权（上架对外可见）。

### 4.5 在线调试

> ⚠️ 本节所有结论均为实测沉淀（2695 接口在线调试），与旧版描述差异较大：执行按钮文字是「**执行**」，不是"发送/测试"；面板是 **Ace 编辑器**，不是普通输入框；**面板执行一次后 Vue 组件会销毁重建**。

#### 4.5.1 行级精确定位「在线测试」入口（禁止全局固定坐标）

每行的「...」更多菜单是 `div.bosui-dropdown`，菜单内 `<li>在线测试</li>` 自带点击处理（可直接 click，不必等浮层弹出）。**必须按目标行的 top 坐标匹配，禁止用全局固定 top 点击**——相邻行 top 仅差 40px 左右，固定坐标极易点开相邻接口的面板（实测 top=360 误中相邻行 2593，目标 2695 行 top≈317）。

```javascript
// 1) 先量出目标行「...」图标/触发器的 top（行号取首单元格文本精确相等）
var rows=document.querySelectorAll('.el-table__body-wrapper tbody tr, table tbody tr');
for(var i=0;i<rows.length;i++){
  var c0=rows[i].cells&&rows[i].cells[0];
  if(c0 && c0.textContent.trim()==='2695'){
    var icon=rows[i].querySelector('i.bosui-icon-more');
    var r=icon.getBoundingClientRect();
    // 记录 r.top（如 321；dropdown 触发器本体 top 通常比图标小几 px，如 317）
    break;
  }
}
// 2) 按 top 容差 ±8 找到该行 dropdown，直接点其中 li「在线测试」
var dd=document.querySelectorAll('div.bosui-dropdown');
for(var i=0;i<dd.length;i++){
  var r=dd[i].getBoundingClientRect();
  if(r.height>0 && Math.abs(Math.round(r.top)-317)<=8 && dd[i].textContent.indexOf('在线测试')>=0){
    var lis=dd[i].querySelectorAll('li');
    for(var j=0;j<lis.length;j++){
      if(lis[j].textContent.trim()==='在线测试'){lis[j].click();break;}
    }
    break;
  }
}
```

#### 4.5.2 面板结构与报文填写

- 面板节点：`document.querySelectorAll('.bosui-dialog')[2]`（高约 875px）。
- 内含 **2 个 `.ace_editor`**：索引 0=请求 Body，索引 1=响应结果。
- 填报文必须用 Ace API（设普通 input.value 无效）：

```javascript
var d=document.querySelectorAll('.bosui-dialog')[2];
window.ace.edit(d.querySelectorAll('.ace_editor')[0]).setValue(JSON.stringify(payload,null,2), -1);
// -1 = 光标置尾且不选中
```

- 执行：在面板内找可见按钮文本为「**执行**」的 button 点击；响应通常 1~6 秒返回，从编辑器 1 读值：

```javascript
window.ace.edit(document.querySelectorAll('.bosui-dialog')[2].querySelectorAll('.ace_editor')[1]).getValue()
```

- Vue 组件层级（需要时可用）：面板内首个 `__vue__` 向上为 `BosuiCard → BosuiDialog → BosDialog → ApiLineTest`（字段 `apiFormData`=请求模型、`resuiltData`=响应、`tabIndex`、`dialogDom`）。

#### 4.5.3 打开后必做：二次确认开的是正确接口

新面板会预置该接口注册时的「请求示例」。填报文前先读编辑器 0 的开头内容，与目标接口示例核对（如 2695 预置 changeId 为 `a1b2c3d4-...` 的 JSON；相邻的人员接口 2593 预置的是工号数组 `["10001","10086"]`）。发现不符说明开错了行，立即关闭重来。

#### 4.5.4 ⚠️ 面板重建坑：不同报文必须刷新重开面板

点一次「执行」后，面板 Vue 组件会**销毁重建**。重建后的 Ace 编辑器显示的是新 setValue 的文本，视觉正常，但**提交模型仍绑定重建前的旧报文**——再次执行实际发的是旧报文（实测：把 changeId 从 01 改成 02 再执行，响应仍返回 01 的 idempotent=true）。

规则：
- **同一报文重放**：不修改编辑器，直接再点「执行」即可（首次报文仍在模型中）。
- **要发不同报文**：必须先关闭面板 → 重新导航刷新 `/api-regist` → 重新行级定位打开**全新面板** → 填一次 → 执行一次。
- 关闭面板的「×」(`button.bosui-dialog__headerbtn`) 点击后常残留空壳（高度仍 875 但内容已卸载，textContent 缩到几个字符），Escape 无效；**最稳的关闭方式就是 navigate 重新加载 `/api-regist`**。

#### 4.5.5 结果校验

1. 读响应 JSON，按本接口契约校验（PMS 系接口成功信封常见为 `{"code":200,"data":...,"executionTime":N,"traceId":"..."}`；GPM 等其它系统信封以实际为准）。
2. 写接口必须配合 DB 回查，不能只看面板 200（完整零污染序列见 §11）。
3. 业务 400（如「xxx不能为空」）证明网关已放行且请求到达后端，与 401（被鉴权拦截）性质完全不同。

## 5. 契约提取（从计划文档）

用户给出计划文档路径（如 `docs/plan/xxx-接口接入与注册计划.md`），从中提取：

| 要提取 | 计划文档对应位置 |
|---|---|
| 接口名称/请求路径/请求类型 | §接口契约 → 基本信息 |
| 请求参数（字段/类型/必填/备注） | §接口契约 → 请求报文 |
| 响应参数（逐级） | §接口契约 → 响应报文 |
| 返回状态码 | §接口契约 → 错误码定义 |

提取后按 §3 的编码映射填表。若用户直接给参数清单，也用同一映射规则。

## 6. 常见坑

| 问题 | 处理 |
|---|---|
| 离线 token 调后端 API 报 10001 | 不要裸调，改走浏览器控制；token 约 24h 过期且会被服务端吊销 |
| 元素引用失效（ref not found） | 任何页面变更后重新取快照再取新引用 |
| 找不到行/按钮 | 在页面执行 JS 遍历 DOM 定位，或滚动可见后再点 |
| 保存后状态非预期 | 通过网络请求捕获看保存请求返回 + 重新查询列表确认 |
| 嵌套参数漏 parentUUID | 响应参数有子字段时，子行必须挂在父行下（parentUUID 指向父 uuid） |
| Debugger 断连（Bridge error: Debugger is not attached） | 先激活该标签页，再重新导航刷新页面后重试 |
| 刷新后跳登录页 | 按 `d:\IdeaProjects\pms\.claude\config\api-center-login.md` 自动登录 |
| **坑8 · 请求路径 disabled**：保存后编辑请求路径没变 | 「请求路径」在编辑抽屉中带 `disabled` 属性，**创建时一次性锁定，之后再编辑会被后端忽略**。要改路径只能删掉该接口重建，不要在更新流程中浪费时间改此输入框。✅ 已实测证伪方案A |
| **坑9 · 同名服务多条记录**（PMS 903 vs PMS服务 905） | 先核对两条服务的服务地址（host），只要 host 一致就不影响转发；但创建接口时必须选对服务行，选完之后想改也不能（和请求路径同理，所属服务字段编辑也可能只读） |
| **坑10 · Nacos 保存用 --data-urlencode content= 会双编码** | curl 提交 Nacos `publishConfig` 时，若用 `--data-urlencode "content=<urlencode内容)"` 会把原本已 UTF-8 编码的 YAML 再编码一层，保存返回 `true` 但实际内容全是 `%XX%XX`，读回发现没生效。**正确写法：写 YAML 到本地文件，用 `curl -F "content=@<yamlfile>"` 走 multipart 表单上传**，二进制不变形。✅ 已踩坑修复两次 |
| **坑11 · PowerShell curl 中文 body 用字面量提交报 400** | Windows PowerShell（尤其 5.1）编码机制会把 `-d '{"姓名":"中文"}'` 中的中文按本地代码页（GBK）传给 curl，再转发被后端 UTF-8 反序列化报 400。**必须用 UTF-8 写文件 + `--data-binary @<file>`**，禁止直接把含中文的 JSON 放在 PowerShell 命令行里。✅ 已通过实测对比 |
| **坑12 · Rancher 日志面板搜索"No lines match"不等于没有相关日志** | Rancher 的「View Logs」是带 tailLines 限制 + 关键字过滤的前端过滤 UI，过滤条件匹配规则不稳定（尤其特殊字符）。**更可靠的方法是直接调用 K8s 代理 API** `GET /k8s/clusters/<cluster-id>/api/v1/namespaces/<ns>/pods/<pod-name>/log?tailLines=500` 拉一段完整文本到本地，脚本内 grep。✅ 会话中通过该方式在 500 行日志中成功定位到 `request:POST /pms/pms/resignWarning/receive` 行，面板搜索始终无匹配。 |
| **坑13 · 在线测试入口用全局固定坐标会点错行** | 列表行高约 40px，相邻接口的「...」触发器 top 只差 40 左右；用记忆中的固定 top（如 360）点击，实际打开的是相邻接口的测试面板。**必须先按行号（首单元格 textContent 精确相等）量出目标行 top，再用 `div.bosui-dropdown` 的 top ±8 容差匹配该行菜单，点其内 li「在线测试」**；打开后再读 Ace 编辑器预置示例二次确认。✅ 实测 top=360 误开 2593、top=317 正确打开 2695 |
| **坑14 · 在线测试面板执行一次后组件销毁重建，旧面板改报文不生效** | 点「执行」后 ApiLineTest 组件销毁重建：Ace 里 `setValue` 改的是新编辑器显示文本，但**提交模型仍绑定旧报文**，再点执行发的还是旧报文（实测改了 changeId=02，响应返回的是旧 01 的 idempotent=true）。另外关闭「×」常残留空壳（h=875 但内容已卸载），Escape 无效。**规则：同报文重放可直接再点；发不同报文必须 navigate 刷新 /api-regist → 行级定位 → 开全新面板 → 填一次发一次**。✅ 2695 会话实测修复 |
| **坑15 · Nacos/网关地址随所属系统不同，别套 PMS 老地址** | 本技能早期案例都是 PMS 系统（Nacos `10.1.12.33:36032`、命名空间 pms-dev/pms-uat、网关 `api-test-pms.jomoo.com`）。GPM（plugins-service）等其它系统是**另一套**：Nacos `172.17.95.173:32265`、命名空间如 `gpm-jomoo-dev`、外部域名 `jpm-test.jomoo.cn`（路径前缀 `/jpm/api/...`，经 nginx 外部可省 /jpm）。注册前先在 Nacos 确认目标服务所属命名空间与 dataId（如 gateway-service.yaml、common.yaml 含数据源），白名单/数据源一切以该套环境实际配置为准。✅ 2695 会话实查 |
| **坑16 · 门户/域名是 UAT，不等于后端连的是 UAT 库（环境实锤）** | `*-uat.jomoo.com` 门户、`jpm-test.jomoo.cn` 这类域名只代表入口环境，后端经 Nacos 拉取的数据源可能指向 **SIT/DEV 库**。凭域名想当然在 UAT schema 造数/回查，会得到"数据不存在"或污染错误环境。**四步证据链实锤真实连接库**：① 查目标命名空间 common.yaml 的数据源 url/username/schema；② 发空体 `{}` 探测——返回业务 400（如"changeId不能为空"）即证明白名单已放行+新代码已部署；③ 构造一条**仅在单一库存在**的业务主键发请求，看响应返回的内部 ID/数据属于哪个库；④ JDBC 回查该库审计/业务表，确认秒级落库。四步吻合后只在该库操作，禁止对"名义环境但实际未连接"的 schema 执行任何 SQL。✅ 2695 会话实锤 jpm-test 连 gpm-jomoo-dev/jomoogpm_dev@tc11test，全程未动 JOMOOGPM_UAT |

## 7. 完成标准

> 从"保存+上架"扩展为**4 层闭环验证**（仅"在线测试通过"不算真通）。接口对接完成必须满足以下全部 8 项：

- [ ] **(A-1) 注册基本信息正确**：接口在列表可见，基本信息（名称/路径/类型/状态）与计划文档一致
- [ ] **(A-2) 契约回显完整**：请求参数、响应参数、状态码在编辑页回显完整（点「编辑」打开抽屉逐一对照）
- [ ] **(A-3) 已上架**：列表状态显示「已上架」
- [ ] **(A-4) 在线测试通过**：API 中心自带的在线测试发请求返回符合契约（success/code/message/data 正确）
- [ ] **(B-1) 网关免 token 穿透（仅限直连场景）**：服务网关域名（如 `api-test-pms.jomoo.com`）裸调无凭证不返回 401；若仍 401 说明白名单未生效，回到步骤 2 走规则 C 加白名单
- [ ] **(B-2) 后端到达日志存在**：Rancher 或 K8s API 拉 Pod 日志，存在 `c.j.p.i.UserContextInterceptor.preHandle` 打印的 `request:POST <path>` 行（证明请求过了网关、到了服务端的拦截器，不是被网关/SSO 拦截在外）。**降级证据（仅当 Rancher 无登录会话且短期无法获取时）**：响应体返回了**仅该后端 Controller 能产生的业务信封**（如含后端生成的 `traceId`、`executionTime`、正确内部 `projectId`、幂等标志），**并且** B-3 的入库行时间戳与请求时刻秒级吻合——两者同时成立可推定请求到达后端；但正式交付结论仍建议补拉日志
- [ ] **(B-3) 数据库记录存在**：对目标业务表执行 SELECT（如 `SELECT * FROM t_pms_xxx WHERE process_no = '测试单号'`），确认 `process_no`、关键字段与请求体一致且 `created_time` 与测试时间匹配
- [ ] **(B-4) 在线测试同报文与 curl 直连通报文行为一致**：使用同一 processNo 分别执行 API 中心在线测试 + 服务网关裸调，响应码/入库一致（避免出现"在线测试直连成功、但订阅方正式调用带网关鉴权失败"的错配）

> **(A) 组 = API 中心平台侧要求；(B) 组 = 端到端真通验证。对外宣称"接口已打通"前至少 (A-1~A-4) 全部通过 + (B-1/B-3) 通过**。

## 8. 免认证通道决策（三通道对照表）

**背景**：九牧测试环境 PMS 的服务网关（`api-test-pms.jomoo.com`）token 认证由 Nacos `gateway.yaml` 的 `emop.auth.exclude-path-patterns` 白名单控制。网关路由 `pms-service-api` 规则：`Path=/pms/pms-service/pms/**` + `StripPrefix=2`，即外部路径经过网关转发到后端时，会剥掉前两段（`/pms/pms-service`），后端收到的 path 形如 `/pms/<模块>/...`。白名单匹配是对**剥前缀后**的路径做 glob 匹配。

目前有 3 条独立通道，按业务语义选对应即可；**推荐规则C（专用白名单）**，语义最清晰、对其它业务零干扰：

| 通道 | 命中 pattern | 业务场景 | 代表接口 | 实现代价 |
|---|---|---|---|---|
| **规则A** | `/pms/ibpm/**` | **工作流回调类接口**（BPM/ibpm 触发，仅回调通道） | 2337 PMS工作流全局回调 | 最小。接口路径必须含 `/ibpm/` 段，直接创建即命中；零额外配置 |
| **规则B** | `/pms/pms/**` | **JPM/外部系统历史推送通道**（靠 `pms` 重复段复用） | 2297 批量接收JPM推送数据 | 中等。**创建接口时必须一开始就把请求路径写为双段**（`/pms/pms-service/pms/pms/<模块>/...`），创建后请求路径字段锁定，事后不能补；同时后端 Controller `@RequestMapping` 要写 `/pms/<模块>`，和其他接口不一样 |
| **规则C** ⭐推荐 | `/pms/<模块>/**`（白名单 YAML 追加一条专用 pattern） | **一切新增对外接口**，尤其是业务独立模块（离职预警、数据同步、合同推送等） | 2583 PMS接收离职信息 ✅ | 中等。Nacos YAML 多追加一行、GET 回读确认，其余代码与注册路径均不变；每个接口独立一条 pattern，互不影响 |

**决策流程**：

1. 接口属于 ibpm/BPM 工作流回调？→ 规则A，路径以 `/ibpm/` 开头
2. 否则，Controller 前缀已经写死了 `/pms/xxx` 而且 API 注册还没点过创建（可以锁定正确路径）？→ 规则B，最省配置
3. 其余一切情况 → **规则C**：创建接口用正常单段 `/pms/pms-service/pms/<模块>/...`，后端用正常 `@RequestMapping("/<模块>")`，Nacos 追加 `emop.auth.exclude-path-patterns` 一条 `- /pms/<模块>/**`

## 9. Nacos Config 白名单读写操作手册

**适用情况**：走规则C（专用白名单）时，需要读/写/验证 `gateway.yaml` 的 `emop.auth.exclude-path-patterns`。

**Nacos 连接约定**：
- 地址：`http://10.1.12.33:36032/nacos`（pms-uat/pms-dev 同 host）
- 账号密码：`nacos/nacos`（测试/开发环境）
- `tenant` 按环境：`pms-dev`（测试环境）、`pms-uat`（另一份）、生产需对应单独值
- `dataId=gateway.yaml`, `group=DEFAULT_GROUP`

### 9.1 读 YAML（核对现状）

```bash
curl "http://10.1.12.33:36032/nacos/v1/cs/configs?dataId=gateway.yaml&group=DEFAULT_GROUP&tenant=pms-dev&username=nacos&password=nacos"
```
结果是完整的 YAML 文本，grep `exclude-path-patterns:` 就能看到当前白名单。

### 9.2 追加一条白名单 pattern（推荐流程）

```powershell
# Step 1. GET 保存到本地工作目录
curl.exe -s "http://10.1.12.33:36032/nacos/v1/cs/configs?dataId=gateway.yaml&group=DEFAULT_GROUP&tenant=pms-dev&username=nacos&password=nacos" | Out-File -Encoding UTF8 -Force "gateway_<env>_before.yaml"
# Step 2. 用编辑器在 exclude-path-patterns 列表末尾追加一行（保持同样的 YAML 缩进：9 空格 + "- /pms/<模块>/**"）
# Step 3. multipart/form-data 上传（⚠️ 禁止 --data-urlencode，会双编码）
curl.exe -s -X POST "http://10.1.12.33:36032/nacos/v1/cs/configs" `
  -F "dataId=gateway.yaml" `
  -F "group=DEFAULT_GROUP" `
  -F "tenant=pms-dev" `
  -F "type=yaml" `
  -F "username=nacos" `
  -F "password=nacos" `
  -F "content=@gateway_<env>_before.yaml"
# 期望返回 true。若返回 false 说明参数错。
# Step 4. ⚠️ 必须立刻 GET 回读确认写入生效
$back = curl.exe -s "http://10.1.12.33:36032/nacos/v1/cs/configs?dataId=gateway.yaml&group=DEFAULT_GROUP&tenant=pms-dev&username=nacos&password=nacos"
$back -match "/pms/<模块>/**"  # 必须 True 才算写入成功
```

### 9.3 刷新生效时序

- 实时写 Nacos Config（`publishConfig` 返回 `true`）后，一般 `10~20 秒` 内网关自动刷新；
- 建议先 `sleep 10`，再用服务网关裸调同一个 URL（空数组或合法条目均可），看是否从 401 变成穿透；
- 如果 30 秒以上仍是 401，回到 9.1 重新 GET 确认白名单确实存在，可能是刚才 Step 3 实际上没正确上传内容。

## 10. 日志排障：Rancher/K8s 直拉 Pod 日志

**适用情况**：B-2（验证请求是否到达 pms-service）或排查 401/404/5xx 根因。PMS 的 `UserContextInterceptor.preHandle` 对每个请求都会打印 `request:<method> <path>, headers:{...}`，这条日志就是**请求是否过了网关进入服务容器**的唯一活证据。

### 两种拉日志方法（按推荐顺序）

**方法1：K8s 代理 API（推荐，浏览器自动化也能调用）**

通过 Rancher 门户暴露的 K8s 代理 API 直接 GET 最近 N 行原始文本（绕开 View Logs 面板不完美的过滤）：

```
GET https://rancher.jomoo.com/k8s/clusters/<cluster-id>/api/v1/namespaces/<ns>/pods/<pod-name>/log?tailLines=500
```

- `<cluster-id>`：从 Rancher URL 复制，如 `c-9g5pt`
- `<ns>`：命名空间，PMS 测试环境通常是 `pms-dev`
- `<pod-name>`：完整 pod 名，如 `pms-service-78f8d59c5b-lm5rt`
- 这个 API 需要浏览器的 Rancher 会话 Cookie（所以走浏览器自动化或用户打开的 Tab 里执行 fetch）
- 返回 `text/plain`，复制到本地再 grep

**方法2：Rancher View Logs 面板（仅粗略看）**

如果用浏览器自动化打开「View Logs」面板时遇到搜索"No lines match"，立刻切方法1，不要在面板上反复调过滤条件浪费时间。**Live/Tailing 视图通常只能保留数百行最新日志，新 Pod 刚启动时之前容器的日志（Previous container）经常显示 Disconnected/无条目，属于正常情况。**

### 关键注意事项

1. **UserContextInterceptor 日志存在 = 网关转发成功**。日志里如果有 `request:POST /pms/<模块>/...` 但响应却是 Spring 404，说明到达拦截器了，但 Controller 映射不匹配：
   - 常见原因1：Controller 映射为 `/resignWarning`，但转发路径是 `/pms/resignWarning`（context-path 外又包一层 `/pms/`）→ 需要对照网关 StripPrefix 的段数 + Controller `@RequestMapping` 对齐
   - 常见原因2：代码改了但 UAT 部署的 jar 还是旧版本（本次会话实锤），直接去数据库查 INSERT 记录反推部署版本是否正确更快
2. **DispatcherServlet 的 NoHandlerFoundException 默认不打印**：Spring Boot 默认 `spring.mvc.throw-exception-if-no-handler-found=false`，会吞掉"没有处理器"的报错。所以**只看到 request:POST 行、后面没有 DispatcherServlet 错误日志 ≠ 映射匹配成功**，还要看 curl 返回的 HTTP 状态码和响应体。
3. **集成测试的 @Transactional 导致去重失效不要怪日志**：端到端验证永远在真实 UAT 环境跑（非测试类内事务），避免"第一次请求回滚、第二次不重"的假阳性。

## 11. 写接口零污染在线调试序列

**适用情况**：在线调试的是**写接口**（会改业务数据），又需要在共享测试环境完成验证且不留脏数据。核心思路：用一个**可还原的字段变更**（典型为项目/单据名称加后缀再改回）配合业务幂等键，三步完成功能+幂等双验证，最终业务数据零残留、仅保留审计日志。

**前置选择**：
- 测试数据选**明确的测试项目/测试单据**（命名含"测试"字样），禁止用真实业务数据；先 JDBC 查基线值并记录（主键 ID、名称、MODIFYTIME）。
- 先完成坑16 的环境实锤，确认域名真实连接的库，只在该库回查。
- 确认接口的幂等键字段（如 changeId/processNo/requestId）与审计表（成功必留 SUCCESS 行）。

**三步序列**（每步都要读面板响应 + JDBC 回查）：

| 步骤 | 报文要点 | 期望响应 | DB 期望 |
|---|---|---|---|
| ① 变更 | **新幂等键 A**，目标字段改为「原值-联调后缀」 | 200，`idempotent=false`（正常耗时，如 100ms+） | 业务字段已变更；审计表插入 1 条 SUCCESS |
| ② 重放 | **完全相同**的幂等键 A 与报文（编辑器不动直接再点「执行」） | 200，`idempotent=true`（短路耗时极短，如个位数 ms） | 审计表仍只有 1 条；业务字段无二次写入痕迹 |
| ③ 还原 | **新幂等键 B**，目标字段改回基线原值 | 200，`idempotent=false` | 业务字段与基线完全一致；审计新增第 2 条 SUCCESS |

**收尾核对**：
1. 业务表关键字段 = 基线值（零残留）；审计表按本次幂等键可查到 ①③ 两条 SUCCESS（重放②不新增）。
2. 响应中的内部资源 ID（如 projectId）必须与基线查询一致，防止改错数据。
3. 清理本地临时文件（探测 SQL/JSON、Nacos 导出的配置 yaml 等，导出配置含连接信息不应遗留）。

**注意事项**：
- ①③ 是两个不同报文，受坑14 约束必须**各开一次全新面板**；②是同报文重放，在①的面板直接再执行即可。
- 零变更探测（如 mainInfo 传空对象、blank 字段被 Writer 跳过）可用于更早的连通性验证：返回 200 且写 SUCCESS 日志但业务数据不变，适合环境实锤阶段，不替代正式三步序列。
- 若接口没有可还原字段（如纯新增推送），改用带固定测试前缀的唯一主键，验证后按主键删除测试行，并确认无关联脏数据。

## 12. PMS 接口注册 SOP 实证（2026-11）

> 本节是 2026-11 PMS「合同系统查询流程信息」接口（编号 2947）的完整实操沉淀，可直接作为 PMS 新接口注册模板。

### 12.1 前置

- 确认接口已部署：未部署时先注册，在线测试会 404。
- UAT PMS 服务地址：`https://api-uat-pms.jomoo.com/`（注意是 `api-uat-pms`，不是前端 `uat-pms`）。
- 请求路径：`/pms/pms-service/pms/<模块>/<方法>`；网关 `pms-service-api` 规则 `Path=/pms/pms-service/pms/**` + `StripPrefix=2`。
- 白名单：UAT `gateway.yaml` 已含 `/pms/external/**`；新模块按规则C追加。
- 快速通道脚本：`scripts/api-center-api.mjs`（list/detail/publish/create/update，token 来自 auth-center；用法见脚本内置 help）。

### 12.2 登录

- 统一走 auth-center：`auth status` → `auth login <app>`。
- 浏览器使用共享 Edge Profile `~/.auth-center/edge-profile`。
- 打开登录页后自动轮询登录态（登录页元素消失/URL 跳转/出现用户信息），检测到成功立即继续，不要要求用户回复“好了”。

### 12.3 新增抽屉

- 点「新增」；ref 点击无效时用 JS：
  ```js
  [...document.querySelectorAll('button')].filter(b=>b.textContent.replace(/\s/g,'')==='新增').pop().click()
  ```
- **先选「所属服务」= PMS**；选完后才渲染 服务地址/请求地址/请求类型/超时/缓存 字段。
- 接口名称保持通用，不要把具体流程写死。
- 关键字段：连接超时 2000、读取超时 2000、请求类型 POST、功能类型 读取、接口安全级别 公开接口。
- 请求地址用 JS 原生 setter 写入并回读，避免 `fill` 把本地路径前缀带进值：
  ```js
  const set=(el,v)=>{const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
  ```

### 12.4 参数/示例/状态码

- Body 参数逐行新增；说明写示例值，枚举参数列出全部可选值。
- 返回参数逐行补全；状态码至少 200 成功、500 业务异常。
- 三个示例用 Ace 编辑器逐个 setValue，并逐个回读：
  ```js
  const eds=[...document.querySelectorAll('.bosui-dialog,.el-dialog')].filter(d=>d.getBoundingClientRect().height>0).pop().querySelectorAll('.ace_editor');
  window.ace.edit(eds[0]).setValue(JSON.stringify(request,null,2),-1);
  window.ace.edit(eds[1]).setValue(JSON.stringify(response,null,2),-1);
  window.ace.edit(eds[2]).setValue(JSON.stringify(exception,null,2),-1);
  ```
- 多编辑器一次批量 setValue 可能被 Vue 重渲染覆盖，必须逐个 setValue + 逐个读回。

### 12.5 保存 → 回读 → 在线测试 → 上架

- 点「确定」保存，列表出现新行，记录编号。
- 点「编辑」回读关键字段、参数、示例，确认保存生效。
- 行操作「在线测试」：面板预置请求示例 → 点「执行」→ 读响应编辑器。
- 行操作「上架」：确认 message box 遮罩 → 点「确定」→ 状态变「已上架」。
- 环境切换后已订阅接口必须重新上下架刷新绑定。

### 12.6 PMS 实证契约（编号 2947）

```text
接口名称：合同系统查询流程信息
请求路径：/pms/pms-service/pms/external/contract/queryFlowInfo
服务地址：https://api-uat-pms.jomoo.com/
请求类型：POST
功能类型：读取
安全级别：公开接口
```

请求：

```json
{ "flowCode": "XMLX-202611-0054", "ibpmFlowKey": "PM02001" }
```

响应：

```json
{
  "success": true,
  "message": "操作成功",
  "code": 0,
  "data": {
    "flowCode": "XMLX-202611-0054",
    "flowTitle": "郑珊珊提交的项目立项XMLX-202611-0054",
    "instId": "2119680407272566784",
    "status": "APPROVAL",
    "statusName": "审批",
    "applicantCode": "00072862",
    "applicantName": "郑珊珊",
    "approvalUrl": "https://test-ibpm.jomoo.com/fvue/inst/2119680407272566784",
    "applyDate": "2026-11-09",
    "projectCode": null
  }
}
```

### 12.7 实证踩坑

- **立项流程编号**：合同系统传 `t_wf_project_info.form_no`（如 `XMLX-202611-0054`），不是 `t_wf_project_approval.code`（如 `LX20261109000351`）。
- **字段命名**：流程编号统一用 `flowCode`，不要用 `flowNo`。
- **通用接口标题**：不要写死具体流程，参数说明列出全部 flowKey。
- **表格 DOM 克隆**：请求/响应/状态码表格可能同时渲染固定列副本，行数会翻倍；以实际值为准，不要按行数判断。
- **上架遮罩**：上架确认是 `.bosui-message-box__wrapper`，必须先确认遮罩存在再点「确定」。

## 13. 抓包 API 快速通道（2026-11 实证）

> 除浏览器 UI 外，API 中心后台的注册/上架接口已抓包，可直接用 `auth token api-center` 的 Bearer token 调后端 API，适合批量/重复操作。

### 13.1 鉴权与基础信息

```text
Base: https://api-admin-jmbos-uat.jomoo.com/api
Headers:
  Authorization: Bearer <auth token api-center>
  systemid: 100837377
  Content-Type: application/json
```

- token 来自 `auth token api-center` 或 `~/.auth-center/apps/api-center/config.json`。
- 注册页 `dfCode`：`1518912c-8a9f-42df-9f9a-d90b7abf3529`
- 服务列表 `dfCode`：`aa700187-c63a-4924-a285-e4cb9ba74614`

### 13.2 已抓包端点

| 操作 | Method | Path | Body |
|---|---|---|---|
| 列表 | POST | `/api-interface/apiRegisterPage?dfCode=<dfCode>` | `{currentPage,pageSize,dfCode}` |
| 详情 | GET | `/api-interface/apiInterfaceDetailForUpdate?id=<id>` | - |
| Body 参数 | POST | `/api-interface-param/getRequestParmsByInterfaceId?id=<id>` | `{id,paramType:1}` |
| Query 参数 | POST | 同上 | `{id,paramType:2}` |
| Header 参数 | POST | 同上 | `{id,paramType:3}` |
| Cookie 参数 | POST | 同上 | `{id,paramType:4}` |
| 响应参数 | POST | `/api-interface-param/getResponseParmsByInterfaceId?id=<id>` | `{id}` |
| 状态码 | POST | `/api-interface-status-code/getListByInterfaceId?id=<id>` | `{id,currentPage:1,pageSize:20}` |
| 新增 | POST | `/api-interface/interfaceRegister` | 完整注册 payload |
| 更新 | POST | `/api-interface/interfaceRegisterUpdateShelves?dfCode=<dfCode>&id=<id>` | 完整注册 payload + `id` |
| 上架 | POST | `/api-interface/onShelvesStatus?id=<id>` | `{id}` |
| 下架 | POST | `/api-interface/offLineStatus?id=<id>` | `{id}` |
| 复制 | POST | `/api-interface/interfaceCopy?id=<id>` | `{id}` |

### 13.3 快速脚本

`scripts/api-center-api.mjs` 已封装列表/详情/上架/下架/复制/新增/更新：

```bash
node ~/.agents/skills/api-center-register/scripts/api-center-api.mjs list 1 10
node ~/.agents/skills/api-center-register/scripts/api-center-api.mjs detail 2947
node ~/.agents/skills/api-center-register/scripts/api-center-api.mjs publish 2947
node ~/.agents/skills/api-center-register/scripts/api-center-api.mjs unpublish 2947
node ~/.agents/skills/api-center-register/scripts/api-center-api.mjs copy 2947
node ~/.agents/skills/api-center-register/scripts/api-center-api.mjs create payload.json
node ~/.agents/skills/api-center-register/scripts/api-center-api.mjs update 2947 payload.json
```

新增 payload 关键字段（实测）：

```json
{
  "apiServiceId": "903",
  "name": "接口名称",
  "interfaceType": "1",
  "interfaceTypeName": "HTTP",
  "requestType": "1",
  "functionType": "1",
  "safeLevel": "1",
  "isNeedCache": "-1",
  "isHideLogResponse": "0",
  "serviceAddress": "https://api-uat-pms.jomoo.com/",
  "requestAddress": "/pms/pms-service/pms/<模块>/<方法>",
  "connectTimeout": 2000,
  "readTimeout": 2000,
  "requestExample": "{}",
  "responseExample": "{}",
  "exceptionResponseExample": "{}",
  "requestBodyParamList": [],
  "requestQueryParamList": [],
  "requestHeaderParamList": [],
  "requestCookieParamList": [],
  "responseParamList": [],
  "statusCodeList": []
}
```

### 13.4 注意事项

- 更新 payload 是**全量覆盖**：先 `detail` 拉全量，改目标字段再 `update`，不要只传局部字段。
- `requestAddressGateway`/`url` 可能出现双 `/pms/` 或双斜杠，但列表与在线测试按 `requestAddress` 正常转发；写后必须回读列表确认。
- 删除端点未抓包，删除仍走 UI 行操作「删除」。
- 在线测试仍建议走 UI 面板，确认请求/响应与注册示例一致。
- 脚本与 HAR 含 Bearer token，禁止提交或长期落盘；抓包文件用完立即删除。