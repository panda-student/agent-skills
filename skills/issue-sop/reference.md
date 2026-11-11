# 腾讯文档问题跟进参考

## PMS 文档清单

- 唯一事实来源：`config/issue_docs.json`，包含两份文档的 `file_id`、全部 tab（含隐藏）、表头行、责任列、状态列、状态过滤、备注署名。
- 默认范围：两份文档全部 tab，按责任列含「孙志强」筛选，且状态列只取「待处理」；URL 的 `?tab=` 只是打开定位。
- 汇总字段：文档 / 子表 / 行号 / 问题描述 / 状态 / 责任列 / 备注。
- 详细 tab 清单、表头行、责任列/状态列以配置为准，本文件不重复维护。

### 状态过滤

- 默认只梳理状态为「待处理」的行；`待验证`、`待解决`、`待确认`、`关闭`、空状态均不纳入。
- 状态单元格先去掉首尾空格再判断；值里带后缀或前后缀说明时用包含判断。
- 先采样状态列实际取值：若表内没有「待处理」但有「待解决」，先向用户说明口径并确认，禁止静默返回空或自行放宽。
- 需要梳理其他状态时，由用户显式指定具体状态，不得自行放宽范围。
- 汇总里可按状态分组，但默认结果只包含「待处理」。

### 复测范围识别

- 「待业务复测 / 待复测」通常写在备注列，不是状态列取值；不要因为状态列仍是「待处理」就认为不是复测项，也不要因此把全部待处理行都算进来。
- 用户点名 N 条复测项时：先取责任列命中且状态为「待处理」的行，再按备注包含「待业务复测」「待复测」过滤；结果条数与 N 不一致时，先列出候选（序号 / 问题描述 / 备注中的修复与部署结论）请用户确认，不自行增减。
- 备注只有根因分析、修复或配置尚未完成的项不算复测项（如「请在流程设计器勾选…后复测」），保持「待处理」，不要随批改成「待验证」。
- 复测通过后按用户指令改「待验证」；未通过保持「待处理」并写明失败现象。

## 表格结构

### 内部文档常见列序（0-based）

| 列 | 字段 | 说明 |
|---|---|---|
| 0 | 序号 | 数据行号 = 序号值（表头是第 0 行） |
| 1 | 模块 | 问题所属模块 |
| 2 | 问题描述 | 主键式描述，可能含表单号 |
| 3 | 实际效果 | 复现现象 |
| 4 | 预期效果 | 规格要求 |
| 5 | 操作步骤 | 复现路径 |
| 6 | 截图1 | 附件 |
| 7 | 截图2 | 附件 |
| 8 | 提报人 | 提报人姓名 |
| 9 | 责任人 | 可能是多值，如「孙志强,常欢」 |
| 10 | 状态 | 待处理 / 待验证 / 关闭 |
| 11 | 备注 | 原备注 + 处理说明 |

行号换算：表头在第 0 行，序号 `N` 的数据在第 `N` 行。例如序号 14 → `row=14`。

多值责任人：筛选时用包含判断，不要用等值；回写时注意人员列的追加行为。

### UAT 文档列序（0-based）

UAT 文档的表头行、责任列、状态列以 `config/issue_docs.json` 为准。常见字段：

`序号 / 所属模块 / [确认人员] / 问题描述 / 图片1~3 / 提报人 / 提报日期 / 问题处理人 / [问题初步分析] / 备注 / 优先级 / 问题归属类型 / 问题处理策略 / 问题处理状态 / 预计完成时间 / 待验证日期|问题处理日期 / 业务验证结果 / 业务验证日期 / 验证结果备注 / 图片1~3 / 备注`

不同 UAT 子表的列数和顺序不同，`问题处理人` 与 `问题处理状态` 必须按表头名称定位，不能按固定列号。UAT1问题清单(副本1) 比 UAT2/UAT3 多「确认人员 / 问题初步分析」列，列号会整体后移。

UAT 行号换算：表头在第 1 行，序号 `N` 的数据在第 `N+1` 行。例如序号 56 → `row=57`。写入前先读目标行第 0 列核对序号。

每次读取都要重新解析表头：表格可能在会话中途插入/删除列（2026-11-11 实证：UAT2 新增「问题处理策略」列后，「问题处理状态」由第 13 列移到第 14 列），禁止缓存列号。

## 操作层依赖

普通表格的读取、写入、清空、人员列/备注列处理、0-based/表头定位、MCP 工具可用性等通用能力，统一按 `tencent-docs` 执行；本技能不再重复工具细节。

PMS 特有规则见「PMS 文档清单」：两份文档、全部 tab、责任列名称、表头位置、UAT1 隐藏副本去重。

## 验证手册

### 规格 Excel 删除线

规格书为 Excel 时，逐格检查删除线；删除线代表该条需求作废：

```python
import openpyxl

wb = openpyxl.load_workbook(path, data_only=True)
ws = wb[sheet_name]
for row in ws.iter_rows():
    for cell in row:
        if cell.font and cell.font.strike:
            print(cell.coordinate, cell.value)
```

- 合并单元格里的规则也要看，不能只看左上角。
- 不能只依赖 `*` 必填标记和备注；删除线优先。
- 规格与代码冲突时，先确认哪份是有效版本，再下结论。
- 用户给的规格路径可能不含目标字段：先在项目 `docs/requirement/` 全目录按关键词（如字段名、「重启」）搜索，确认真正包含该字段的规格文件再引用；不要只读用户点名的那一份（2026-11-11 实证：点名的工程采购规格无「重启」，实际在变更 V1.7）。

### 验证凭证与快照口径

- 凭证优先记录「表单编号 + 项目编号/名称 + 验证结果」；截图仅作补充，缺表单编号的结论视为不完整。
- 编辑老单时，页面上的「已保存快照行」（如 `budgetChangeInfoList`）与下拉「源行选项」是两套数据：修复只刷新后者，前者保持提交时点值，不会自动补行。
- 2026-11-11 投资预算明细修复实证：XMBG-202611-0116（YCTC261153）下拉源行 6 项、已保存快照仍 1 行；XMBG-202611-0126（YCTC261148，预算变更）自动带出 3 行。

### DBX 配置核对

先确认环境、库、schema，再查配置：

```sql
SELECT node_id, field_type, field_name,
       is_required, is_readonly, is_hidden, `condition`, remark
FROM t_node_field_permission
WHERE process_key = 'QT04001'
  AND node_id = 'T_Applicant'
  AND is_valid = 'Y'
ORDER BY field_type, field_name;
```

核对后端实际生效的必填集合（condition 非空的行会被分流）：

```sql
SELECT field_type, field_name
FROM t_node_field_permission
WHERE process_key = 'QT04001'
  AND node_id = 'T_Applicant'
  AND is_valid = 'Y'
  AND is_custom = 'N'
  AND field_type IN ('FORM_FIELD','FORM_LIST','LIST_COLUMN')
  AND is_required = 'Y'
  AND (`condition` IS NULL OR `condition` = '');
```

DBX MCP 权限注意：

- 「数据读写」模式允许带条件的 UPDATE 和普通 INSERT；`INSERT ... SELECT`、DDL、`SET` 可能被判定高风险拦截。
- 跨库复制优先按业务键 `UPDATE JOIN` 同步 + `NOT EXISTS` 补插；不要硬删。
- 软删行仍占用唯一键；直接插同业务键会报 `Duplicate entry`。
- 需要 DDL/跨库复制时，让用户在 DBX 设置临时切「完全访问」，或生成 SQL 文件由用户在客户端执行。

### Yaak / 真实接口 E2E

- 接口任务一律用 yaak CLI；GUI 只用于查看。
- 本机系统代理（如 Clash）可能导致 UAT `tls handshake eof`；给 CLI 设置 `NO_PROXY`：
  ```powershell
  $env:NO_PROXY = "uat-pms.jomoo.com,api-uat-pms.jomoo.com"
  $env:no_proxy = $env:NO_PROXY
  ```
- 登录链：请求头 `Authorization: Bearer ${[ response.body.path(request='rq_login', path='$.data.ssoToken') ]}`。
- 申请人提交路径是 `/ibpm/workflow/afterSave`：
  ```json
  {
    "workflowType": "QT04001",
    "businessKey": "<单据ID>",
    "buttonType": "agree",
    "saveData": { "projectChange": {}, "budgetChangeInfoList": [], "fileIds": [] }
  }
  ```
- `saveData` 从详情接口构造；子表行要**去掉 `id`、`objectId`、审计字段**，否则 `replaceByObjectId` 软删后插入同 ID 会主键冲突。
- 完整推进：`GET /ibpm-api/getInstanceAndTaskByInstId?instId=...` 拿 `tasks[0].id` → `POST /ibpm-api/complete`，body 带 `instId/taskId/account/actionName/vars`。
- 验证结果看 `response.success`、HTTP 状态、数据库 `current_node_id` 是否流转。

### PMS UAT 环境与 E2E 取证

仓库定位：

- 后端 `D:\IdeaProjects\weekreport\pms`，前端 `D:\IdeaProjects\weekreport\pms_frontend`；不要误用 `jpm_soa_code` / `jomoo_frontend`（不是 PMS 仓库）。
- 代码定位仍优先 codegraph，仓库根目录有 `.codegraph/` 时先 `codegraph_explore`。

接口与前端入口：

- 业务网关：`https://uat-pms.jomoo.com/pms/pms-service/...`；`IbpmApiController` 的命中路径为 `/pms/pms-service/pms/ibpm-api/...`（服务前缀后仍保留 `/pms` 上下文段；去掉该段会 404；报文不符合接口契约时返回 400，需按 DTO 核对字段）。
- 直调业务接口用 `https://api-uat-pms.jomoo.com/pms/pms-service/...`，请求头必须带 `Authorization: Bearer <nisbos_auth_token>` 与 `systemId: <systemId>`；只带 Cookie 会返回 401「未提供认证token」。示例：`POST .../pms/demandLedger/page`，body `{projectCodeExact, currentPage, pageSize}`。
- 前端由 ui-nginx 部署在站点根路径，history 路由直开：`https://uat-pms.jomoo.com/engineeringProject/addIbpm?type=approval&id=<单据ID>&workflowType=<流程Key>`；`/pms/...` 是网关前缀，不是前端路由，直接打开会「页面不存在」。
- 详情页 `type` 只要不是 `add` 就会加载详情和字段权限；`type=approval` 可用于审批节点取证。

UI 登录态（agent-browser / 浏览器复验）：

- 调 `POST https://api-uat-pms.jomoo.com/niscommon/noAuth/loginNew`（请求头 `systemid: 100837377`，body 带 `loginType/userCode/usePwd/systemType/tenantCode/uuid`）取 `data.ssoToken`。
- 写 Cookie `nisbos_auth_token` 到 `uat-pms.jomoo.com` 时**不要加 HttpOnly**；前端用 js-cookie 读取，HttpOnly 会导致已登录仍跳 `/login`。同时注入 `lang=zh`。
- `auth status pms` / `auth token pms` 返回的 token 可能已过期：网关业务接口仍可能放行，但前端路由守卫按 JWT `exp` 判定并跳登录；UI 验证不要复用旧 token，用 `loginNew` 新 token。`auth login pms` 依赖浏览器 SSO，可能长时间挂起，不要干等。
- UI 取证用 `agent-browser`：打开审批节点单据断言按钮/字段不可见，再打开草稿/编制单据做对照，截图存 `weekreport/shots/`。方法论见 `e2e-ops` 技能。

字段权限接口：

- `POST https://uat-pms.jomoo.com/pms/pms-service/pms/node/fieldPermission/list`，body `{entityId, processKey}`。
- `LIST_BUTTON` 行返回在 `data.listColumns.<parentField>` 下（如 `costDetailList.costDetailListAddButton`），不是 `formButtons`；前端把 `listColumns` 下所有列/按钮拍平进 `fieldPermissions`。
- 草稿没有当前节点时接口返回空，前端 `isFieldHidden` 默认 `false`（按钮可见），可用来验证「编制节点保留」。

E2E 造数与提交：

- 优先 `POST /project/common/saveDraft/<flowKey>` 新建带标识的测试单据（如 `subProjectName=E2E复测-<日期>-<场景>`），不改历史单据；`saveDraft` 同样会生成流程标题，可先验标题。
- 提交类验证：先用超限值提交确认返回业务错误且未发起流程，再用合规值提交确认放行；详情查 `statusName/currentNode/instId` 核对流转。
- `costDetailList` 提交时按 `objectId` 全删重插，行内不要带 `id/objectId`；必填列表列按节点权限配置（如 `bearAmount/costCenterName`）。
- 自建测试单会真实发起流程并产生待办；能 `doEndProcess` 终止则终止，不能终止时在收尾登记表单编号、实例 ID、当前节点和待办归属。

### 部署确认

- 推 uat 只是触发 CI；要确认流水线 `mvn_deploy` / `docker_build` success。
- 配置改动只有在代码已部署时才生效；旧代码不认 `condition` 时，改配置不会解决校验问题。

## 备注署名格式

- 署名规则：谁回复/谁操作，备注就署谁；署名跟实际操作人走，与责任人、提报人无关。
- 当前只有孙志强使用本技能，因此实际写入统一以「孙志强YYYY-MM-DD：」开头；将来别人使用时改为实际操作人。
- 责任人是别人（如常欢）时，不要把署名改成责任人；责任人是孙志强时，也不重复署责任人姓名。
- 多条回复各自独立成行、各自带前缀，不省略、不合并署名。
- 正确：`孙志强2026-11-10：已定位为前端未映射字段，修复中。`
- 错误：`2026-11-10：...`、`孙志强：...`（缺日期）、只在首行署名后面几行省略。

## 回写清单

- [ ] 两份文档、全部 tab（含隐藏 tab）已扫描
- [ ] 每次读取已重新解析表头并建立「列名→列号」映射，未沿用历史列号
- [ ] 只纳入状态为「待处理」的行，其他状态已跳过
- [ ] 复测项已按备注「待业务复测 / 待复测」筛选，条数与用户一致
- [ ] 状态列实际取值已采样，口径已向用户确认
- [ ] 每个 tab 的责任列按表头定位（`责任人` 或 `问题处理人`），不是按固定列号
- [ ] 汇总结果标明了文档 / 子表 / 序号，UAT1 隐藏副本已去重
- [ ] `file_id` / `sheet_id` 已确认，读的是正确子表
- [ ] 写入前已核对目标行第 0 列序号与预期一致（UAT 序号 `N` → `row=N+1`）
- [ ] 写状态前已重新解析表头定位「问题处理状态」列，写后读回状态列及相邻列
- [ ] 原备注已读取，未被覆盖
- [ ] 若改责任人：按「清空 → 写入 → 读回等于目标人」执行，读回值无前导逗号
- [ ] 转派时只改责任列 + 备注，未擅自改状态
- [ ] 每条备注/回复都以「姓名+日期+冒号」开头；当前操作者为孙志强
- [ ] 署名跟实际操作人走，未误用责任人/提报人姓名
- [ ] 状态只在验证通过且用户确认后修改；未通过项保持「待处理」
- [ ] E2E 备注含验证环境（UAT）、验证单据编号（表单编号）、期望 vs 实际、结论
- [ ] 用户要求补充信息时以独立署名行追加，未覆盖原备注
- [ ] 自建 UAT 测试单据/流程实例的遗留已登记（表单编号、实例 ID、当前节点）
- [ ] 所有改动单元格已读回校验

## 常见问题

- **找不到 tab**：按 `tencent-docs` 的子表定位方式处理。
- **表头中途插列导致列号漂移**：每次读取重新解析表头，不缓存列号。
- **状态写错列**：复用了早前列号而表格已插入「问题处理策略」列；写前重新解析表头，写后读回状态列及相邻列。
- **老单据回显行数没变**：修复只影响新加载/重新选项目，已保存快照行不会自动补行，不代表修复失败。
- **状态词表没有「待处理」**：该表可能用「待解决」；先向用户确认口径，不要静默返回空或自行放宽。
- **序号与行号混用**：UAT 序号 `N` 在第 `N+1` 行；写入前读第 0 列核对。
- **人员列写入变成追加**：直接写会得到「原处理人,新处理人」；必须清空后写入并读回。
- **用户给的规格路径不含目标字段**：先在 `docs/requirement/` 全目录按关键词搜索，再引用。
- **用户昵称与表内姓名不一致**：用 AskUserQuestion 确认，不要猜。
- **署名人写错**：署名跟实际操作人走，不要因为责任人是别人就改署责任人；当前操作者只有孙志强。
- **状态过滤过宽**：默认只取「待处理」；把待验证/关闭的行也汇总进来属于超出范围。
- **状态值带空格或后缀**：去空格后用包含判断，不要因为「待处理（已受理）」这类写法漏掉。
- **删除线漏检**：逐格 + 合并单元格检查 `cell.font.strike`。
- **人员列写成「A,B」或「,B」**：按 `tencent-docs` 的人员列规则清空后重写。
- **DBX 高风险拦截**：不要改用会绕过策略的写法；调整权限或让用户执行 SQL 文件。
- **UAT TLS EOF**：先判断是代理问题，设置 `NO_PROXY` 后重试。
- **afterSave 主键冲突**：子表行去掉 `id` 后再提交。
- **用户说「待业务复测」但状态列是「待处理」**：复测标记在备注列，按备注筛，不要按状态列筛，也不要因此把全部待处理行都算复测项。
- **UI 已登录仍跳 `/login`**：先检查 `nisbos_auth_token` 是否为 HttpOnly；前端 js-cookie 读不到 HttpOnly Cookie。
- **auth token 显示过期但接口能通**：前端路由守卫按 JWT `exp` 拦截，UI 验证用 `loginNew` 新 token，不要复用 `auth token pms` 的旧值。
- **前端直开 `/pms/...` 报页面不存在**：`/pms` 是网关前缀；前端 history 路由从站点根路径直开。
- **字段权限接口取不到按钮**：按钮在 `data.listColumns.<parentField>` 下，不要只看 `formButtons`。
- **自建测试单产生待办**：E2E 收尾登记表单编号、实例 ID、当前节点；能终止则终止。