# 腾讯文档问题跟进参考

## PMS 文档清单

- 唯一事实来源：`config/issue_docs.json`，包含两份文档的 `file_id`、全部 tab（含隐藏）、表头行、责任列、状态列、状态过滤、备注署名。
- 默认范围：两份文档全部 tab，按责任列含「孙志强」筛选，且状态列只取「待处理」；URL 的 `?tab=` 只是打开定位。
- 汇总字段：文档 / 子表 / 行号 / 问题描述 / 状态 / 责任列 / 备注。
- 详细 tab 清单、表头行、责任列/状态列以配置为准，本文件不重复维护。

### 状态过滤

- 默认只梳理状态为「待处理」的行；`待验证`、`待解决`、`待确认`、`关闭`、空状态均不纳入。
- 状态单元格先去掉首尾空格再判断；值里带后缀或前后缀说明时用包含判断。
- 需要梳理其他状态时，由用户显式指定具体状态，不得自行放宽范围。
- 汇总里可按状态分组，但默认结果只包含「待处理」。

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
- [ ] 只纳入状态为「待处理」的行，其他状态已跳过
- [ ] 每个 tab 的责任列按表头定位（`责任人` 或 `问题处理人`），不是按固定列号
- [ ] 汇总结果标明了文档 / 子表 / 行号，UAT1 隐藏副本已去重
- [ ] `file_id` / `sheet_id` 已确认，读的是正确子表
- [ ] 原备注已读取，未被覆盖
- [ ] 若改责任人：按 `tencent-docs` 的人员列规则清空后写入，读回值无前导逗号
- [ ] 每条备注/回复都以「姓名+日期+冒号」开头；当前操作者为孙志强
- [ ] 署名跟实际操作人走，未误用责任人/提报人姓名
- [ ] 状态只在验证通过且用户确认后修改
- [ ] 所有改动单元格已读回校验

## 常见问题

- **找不到 tab**：按 `tencent-docs` 的子表定位方式处理。
- **用户昵称与表内姓名不一致**：用 AskUserQuestion 确认，不要猜。
- **署名人写错**：署名跟实际操作人走，不要因为责任人是别人就改署责任人；当前操作者只有孙志强。
- **状态过滤过宽**：默认只取「待处理」；把待验证/关闭的行也汇总进来属于超出范围。
- **状态值带空格或后缀**：去空格后用包含判断，不要因为「待处理（已受理）」这类写法漏掉。
- **删除线漏检**：逐格 + 合并单元格检查 `cell.font.strike`。
- **人员列写成「A,B」或「,B」**：按 `tencent-docs` 的人员列规则清空后重写。
- **DBX 高风险拦截**：不要改用会绕过策略的写法；调整权限或让用户执行 SQL 文件。
- **UAT TLS EOF**：先判断是代理问题，设置 `NO_PROXY` 后重试。
- **afterSave 主键冲突**：子表行去掉 `id` 后再提交。