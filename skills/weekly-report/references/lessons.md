# 经验教训（lessons.md）

持续追加。格式：问题 → 根因 → 解法。

## 最终定案：腾讯文档 API 直写（2026-10-23 第四轮收敛）
- **结论：API 直写记录是周报三表的唯一正解**——无焦点/定位/分组/canvas 问题，5 秒写完三表；现统一经 `tencent-docs` 执行。
- **通用操作**（端点、token、字段值格式、选项映射、分页、写后校验）统一见 `tencent-docs-ops` 技能；本节只保留周报三表的业务元数据与落位经验。
- **周报三表元数据**：`list_tables` 拿 sheet_id（日报 ss_3n8xi6 / 周报汇总 trhuGh / 下周计划 tfR4dX）；`list_fields` 的 singleSelect options 含 id；`list_records` 的 view_id 影响行序（SZQ 视图 vOj1HV）。
- **记录落位**：add_records 追加到表尾，日期分组自动归位（游离区问题不存在）；delete_records 按 record_id 删，配合 list_records 可做任意清理。
- **防重**：add 前若用户手填过同周数据会重复 → AI 拉全量记录，按 日期+成员+内容 分组，保留最后编辑时间最早的一条，其余删除。

## 浏览器自动化路线的完整失败史（已废弃，备查）
- agent-browser 粘贴（AI 驱动）：能成功但 15-20 次工具调用 5-8 分钟，AI 推理往返是硬成本。
- playwright 全自动脚本：日报两次失败——第一次点已选中 SZQ tab 触发子视图重载；第二次「总计」断言救了加行救不了焦点。
- PowerShell 批处理（fill.ps1）：`find text "添加一行"` 点到屏幕外负坐标的隐藏同名元素（DOM 有 4 个）；改 eval 定位可见按钮坐标点击，加行成功但空行落在**分组外游离区**，粘贴报「类型不符」；snapshot+click @ref 日报成功但周报汇总仍落游离区。
- canvas 渲染根因：表体/「总计」不可 DOM 读取，焦点状态只能靠截图人眼判断——固定序列脚本无法闭环验证，这是放弃脚本路线的根本原因。

## PowerShell / Node 互操作

通用坑（内嵌引号被剥离、中文 GBK 编码、临时 JSON、UTF-8 输出解码）统一见 `tencent-docs-ops` 技能；周报 SOP 按该约定执行。

## 禅道 API（现由 zentao CLI 封装，以下保留供排障）
- **`GET /tasks` 返回重复且不全**：改用 `GET /executions/{executionId}/tasks?limit=200` 过滤 `assignedTo.account`；现直接用 `zentao my-tasks <执行ID>`。
- **任务列表分页可能截断**：早年脚本 `page > 50` 提前退出导致大执行集漏任务 → 怀疑遗漏时对照禅道页面核对。
- **任务详情 `desc` 可能为空**：需求范围要看 `storyTitle`，或让用户从禅道页面补描述。
- **Token 认证**：`POST /api.php/v1/tokens` body `{account,password}` → header `Token: <token>`。自签证书需 `rejectUnauthorized:false`。现由 zentao CLI 经 auth-center 完成（密码按 `vault-ops` 技能维护，运行时取用不落盘；token 缓存 `~/.auth-center/apps/zentao-cli/config.json`）。
- **eval/JS 传中文**：Node 侧 HTTPS 无问题；但 agent-browser `eval --stdin` 传中文会编码损坏 → 用 base64 编码 JS（`eval -b`）或 `String.fromCharCode`。
- **tokens 接口间歇性失败**：连续快速调用会返回空对象/无效 token（服务端限流）。→ 拿 token 后校验存在性，失败 sleep 2~3s 重试（最多 5~8 次）；批量调用每步 sleep 300~500ms。

## 禅道工时/任务操作（重点）
- **记录工时端点 = `POST /tasks/{id}/estimate`**（单数，"添加任务日志"，官方 2.13.11）。**不是** /estimates、/recordestimate、/effort（均 not found）。
  - 老版本（<20.7）body 为批量数组：`{id:[0,1..], objectID:[任务ID...], dates:[...], work:[...], consumed:[...], left:[每次记录后的剩余...], objectType:['task'...]}`；left 递减至 0。
  - 20.7+ 版本 body 简化为 `{date:[], work:[], consumed:[], left:[]}`。
- **left=0 自动完成任务**：estimate 最后一条 left=0 → status 变 done（用户确认的行为，无需再调 finish）。若 left>0 卡住（如任务实际工时超出预计），用 **`POST /tasks/{id}/finish`** 兜底：body 需含 `finishedDate` + `realStarted`（缺 realStarted 报"实际完成不能小于实际开始"），consumed 传 0 即可（累计消耗已在记录里）。
- **`PUT /tasks/{id}`（2.13.4 修改任务）**：可改 deadline 等；但 **estimate/left 字段修改不生效**（接口忽略），工时相关只能走 estimate/finish。PATCH 方法不被支持（500 callback 错误），用 PUT。
- **finish 校验**：需 `finishedDate`（"『实际完成』不能为空"）；总消耗为 0 时不能完成（"总计消耗为0时不能完成任务"）；实际完成不能小于实际开始。
- **estStarted 不可靠**：常晚于实际代码提交（如 24987 estStarted 09-18 但提交从 07-13 开始）→ 工时日期容量以 git 提交日期为准，勿用 estStarted 过滤。
- **预计工时偏小**：任务实际消耗可能超 estimate（如 24987 est24 实际 32h）。API 改不了 estimate → 需用户在页面手动调预计，或接受"超预计"状态。
- **过期任务收尾顺序**：deadline < 今天且未完成的任务 → 先列清单让用户调整 deadline（PUT 生效）→ 再补工时完成。

## 腾讯文档浏览器自动化历史（已废弃，备查）

- 当前统一用 `tencent-docs`；通用操作见 `tencent-docs-ops` 技能。以下为早期 canvas/浏览器方案的历史坑，仅备查。
- **智能表格是 canvas 渲染**：snapshot 拿不到单元格，只有编辑器 text。操作靠：鼠标坐标点击 / 名称框（左上角，坐标约 (133,65)，跳转偶尔不生效）/ 键盘导航。
- **视口与截图比例**：`agent-browser` 截图宽 992，实际视口 1912×922，比例 ≈1.9274。坐标换算错会点到邻列（曾把 L94 点成 M88 公式格）。先 `eval "window.innerWidth"` 确认。
- **粘贴多行 TSV 会弹"拆分字段"确认框**：点"确定"才能按 `\t` 拆列。
- **内容含空格 = 拆列事故**：空格被视为字段分隔，溢出内容自动新建"文本"列。→ 内容全部用连字符/顿号连接（如 `禅道：24792-变更申请流程节点业务处理：新增...`）。误建列：点列头 → 列菜单垃圾桶图标删除。
- **`keyboard type` 中文乱序**：逐键事件在 canvas 编辑器中乱序。→ 一律 `clipboard write` + Ctrl+V；单格输入用 `keyboard inserttext`（在名称框/查找框可用）。
- **单击单元格会放大输入框**：用户确认的正常行为，不是错误。
- **Ctrl+A 在表格上=全选记录而非编辑器内全选**：会勾选整行，Esc 取消。
- **周报汇总"添加一行"位置**：新行插在分组第 1 行，日期自动预填本周分组日；锚定要点击**数据行的日期格**而非分组头（y 坐标差一行分组行）。
- **进度表筛选**：表头右下角蓝色小三角才是筛选入口（右键菜单没有"筛选"）；agent-browser 点不准 → **让用户手动筛选**（开发人员=孙志强、进度≠100%）最快。
- **进度列显示值≠真实值**：进度条条件格式导致 L94 显示"3%"实际是 50%。→ 选中单元格 Ctrl+C → `clipboard read` 验证后再改。
- **进度列写入**：选中单元格直接 `keyboard type "85%"` + Enter 可覆盖（无需进编辑模式）；写入后 M 列二级/N 列一级模块进度公式自动联动。
- **Ctrl+F 查找**：`press Control+f` → snapshot 找「输入查找内容」textbox → `fill` 关键词 → 面板显示匹配数/「无结果」。用于核对行数与清理后 0 残留验证。

## 加行+整块粘贴 SOP（W43 mock 全流程实测，当前最优）
- **流程**：连点「添加一行」N 次加足空行 → 点首个空行日期格锚定（点偏用 ↑/↓ 微调，点日期格无副作用）→ `Set-Clipboard` 写整块 TSV → `press Control+v` → 有「拆分字段」框点确定 → 截图核对。比逐格键入快一个数量级，日报 5 行实测约 1 分钟。
- **「添加一行」行为**：可连点批量加行；SZQ 日报追加在分组底部；周报汇总/下周计划插在当前组第 1 行且**新行日期格自动激活**（加 1 行后可直接粘贴，无需再点）。新行自带默认日期（当前组日期）与成员。
- **agent-browser `clipboard write` 本机失效**（os error 10060 连接超时）→ 用 PowerShell `Set-Clipboard -Value "..."`（`` `t ``=Tab、`` `r`n ``=换行）写真实系统剪贴板，页面 Ctrl+V 正常读取。空剪贴板粘贴仅弹 toast「剪贴板内容为空」，无副作用。
- **「拆分字段」对话框不固定出现**：日报 5 行整块粘贴弹出过；周报汇总/下周计划单行粘贴直接生效不弹。→ 每次 Ctrl+V 后必须截图核对落列，勿假设弹框流程。
- **全角空格（　）不触发拆列**：周报汇总"问题处理"单元格 `1、xx　2、xx　3、xx` 全角空格分隔整格落位。半角空格仍是禁区。
- **粘贴非本周日期自动重分组**：粘贴 2026-10-23（下周）自动新建该周分组归入；删行后分组自动消失还原。
- **删行立即生效（无确认框）**：多选行 → 右键 →「删除 N 行」；单行也可在单元格右键菜单点底部「删除」（整行删除）。
- **选行只有真实输入可靠**：canvas 上 dispatch MouseEvent(shiftKey) 合成点击、行号列拖选均**不能**扩展选区；真实点击行号 + `press Shift+ArrowDown`×N 稳定扩展（右下角「已选记录 N」确认）。
- **右键 = `mouse down right` + `mouse up right`**：`mouse down 2` 报 Invalid mouse button。右键菜单是 DOM，snapshot 能拿到 menuitem ref。
- **坐标点击误差**：按截图比例算的 y 有 ±2 行偏差 → 先点、截图看落点、↑/↓ 微调最稳；refs 点击要加引号 `"@e105"`。
- **本机 Shell 是 PowerShell 5.1**：不支持 `&&`/`||` 链接 → 用 `;`。
- **mock 全流程测试法（迭代 SOP 用）**：假装下一周，草稿四节内容全部加 `MOCK-` 前缀 → 三视图走完整 SOP → 删行还原 → Ctrl+F 确认 0 残留 → 删 mock 草稿。可随时安全回归测试。

## 浏览器环境（Edge 153 / Windows）
- **默认用户配置禁 CDP**：Edge 136+ 禁止在默认 User Data 上开 remote-debugging-port。→ 用配置副本 `~\.agent-browser\edge-auto-profile`。
- **配置副本登录态**：腾讯文档微信扫码登录的凭证在 Cookies/本地存储，运行中的 Edge 锁定 Cookies 文件复制无效（会话凭证不走磁盘或复制损坏）。→ 副本首启需手动登录一次，之后持久保留。
- **复制 Cookies 需先关 Edge**：文件被独占锁定；`taskkill /IM msedge.exe /F` → 复制 → 先起自动化实例 → `--restore-last-session` 恢复用户 Edge。全程约 10 秒。
- **不要 `agent-browser install`**：Windows 复用本地 Edge，CLI >= 0.38.1。
- **TRAE"浏览器控制"插件无外部可调接口**，接管真实浏览器不可行 → 始终用配置副本方案。
- **隐藏启动自动化浏览器**会让用户看不到窗口（登录交互困难）→ 启动时用 `Start-Process`（可见）。

## 流程/协作
- **草稿先确认后填写**：日报/周报/下周计划/进度建议值都先写入 `drafts/draft-<年>W<周>.txt`（TSV 可直接复制进表格）给用户确认，避免返工。
- **日报条数=实际工作日数**：非固定 5 条，调休补班要算，节假日不上。
- **归属不确定时**：查任务 story 标题 + 本周提交关键词双向印证；用户一句口述（如"下周计划是验证测试用例自动化"）优先于推断。
- **进度评估口径**：对照**仓库整体实现情况**（uat 全量代码），不是本周提交增量；只评非 100% 行；用 Explore 代理出证据报告。
- **收尾清理临时文件**：shots\、log_*.txt、zentao_*.json、临时 js；保留 drafts\、.config\、skill、pms 仓库。
