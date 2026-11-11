# 腾讯文档操作示例

## 本地 CLI

```powershell
# 列出子表
tencent-docs sheets list <file_id>

# 读一段区域（CSV）
tencent-docs sheets read <file_id> <sheet_id> --start-row 0 --end-row 20 --start-col 0 --end-col 20

# 智能表：拉全量记录（CLI 内部处理分页）
tencent-docs smartsheet records <file_id> <sheet_id> --all --pretty

# 通用调用：参数文件避免命令行长度限制
tencent-docs call smartsheet.add_records @records.json
```

业务脚本不直接读 token，使用 `cli-helper.cjs`（内部调用 `tencent-docs`）：

```js
const { tool } = require('~/.agents/cli/tencent-docs-cli/cli-helper.cjs');
const records = tool('smartsheet.list_records', { file_id, sheet_id });
```

token 的注入与临时文件清理按 `vault-ops` 技能执行。

## 读取普通表格并定位表头

```text
sheet_get_sheet_info(file_id)
  → 找到目标 sheet_id
sheet_get_cell_data(file_id, sheet_id, start_row=0, end_row=3, start_col=0, end_col=30, return_csv=true)
  → 找同时含「序号」「问题描述」的表头行
sheet_get_cell_data(..., start_row=表头行, end_row=末行, ...)
  → 数据行
```

## 追加备注（不覆盖原备注）

```text
原备注 = sheet_get_cell_data(...备注列...)
新备注 = 原备注 + "\n" + "孙志强2026-11-09：处理说明"
sheet_set_range_value(file_id, sheet_id, [{row, col, value_type:"STRING", string_value:新备注}])
sheet_get_cell_data(...) 读回确认
```

## 人员列先清空再写

```text
sheet_clear_range_cells(file_id, sheet_id, start_row=row, end_row=row, start_col=col, end_col=col)
sheet_set_range_value(file_id, sheet_id, [{row, col, value_type:"STRING", string_value:"常欢"}])
sheet_get_cell_data(...) 读回，确认没有前导逗号或旧姓名
```

## 智能表格新增记录

```text
fields = smartsheet_list_fields(sheet_id)
optionMap = fields 里 singleSelect 的 text→id 映射

smartsheet_add_records(sheet_id, records=[{
  "fields": {
    "日期": { "string_value": "1793980800000" },
    "成员": { "option_value": { "items": [{ "id": optionMap["张三"], "text": "张三" }] } },
    "工时": { "number_value": 8 },
    "内容": { "text_value": { "items": [{ "text": "禅道：12345-修复问题", "type": "text" }] } }
  }
}])

smartsheet_list_records(sheet_id) 抽查落位
```

## 批量写入后去重

```text
records = smartsheet_list_records(sheet_id, view_id)
按业务键（日期+成员+内容）分组
每组按规则保留一条，其余 delete_records(record_id)
再 list_records 核对行数
```

## HTTP MCP 脚本调用

```js
const call = (id, method, params = {}) =>
  fetch('https://docs.qq.com/openapi/mcp', {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  }).then(r => r.json());

await call(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'client', version: '1.0' } });
const result = await call(2, 'tools/call', { name: 'smartsheet.list_records', arguments: { sheet_id: 'ss_xxx' } });
```