# 常见报错排查指南

> 基于真实导入测试的踩坑记录，按报错现象归类。

## 报错：XML转换为POJO类型错误null

**含义**：系统（Activiti 引擎）做 XML→Java 对象映射失败，某个期望的值是 null。

**按可能性从高到低排查**：

### 1. 缺 ext:extProcess 段（最常见，占 24.7%）
- **检查**：`bpmdefs.flow.xml` 里的 `<bpmnXml>` 段是否含 `<ext:extProcess>`？
- **现象**：没有这个段，或结构不完整
- **解法**：用 `build-extprocess.mjs` 生成完整段（含节点按钮/审批人/表单/变量）
- **验证**：`ext:userNode` 数 = UserTask 数，`ext:baseNode` 数 = 2（StartEvent+EndEvent），**网关不进 extNodes**

### 2. bpmnXml 风格不对（Activiti vs bpmn.io）
- **检查**：根标签是 `<ext:definitions>` 还是 `<bpmn:definitions>`？
- **解法**：用 `build-activiti-xml.mjs` 生成 Activiti 风格
- **关键检查项**（全对才行）：
  - [ ] 根标签 `ext:definitions` + 完整命名空间
  - [ ] `targetNamespace="http://activiti.org/bpmn20"`
  - [ ] `<process id=defKey isExecutable="true">`（默认命名空间）
  - [ ] executionListener（start/end）
  - [ ] startEvent 有 `activiti:initiator="startUser"`
  - [ ] userTask 有 taskListener（create/complete）
  - [ ] 无 `<?xml?>` 声明
  - [ ] 坐标用 `omgdc:Bounds`，边用 `omgdi:waypoint`

### 3. 边 ID 不一致（defJson vs bpmnXml）
- **检查**：defJson 里边的 resourceId 和 bpmnXml 里 sequenceFlow 的 id 是否一致？
- **解法**：边 id 统一成 `sid-<UUID>`，defJson 边 resourceId 直接用 spec 里的边 id
- **验证**：两者交集 = 边总数（如 12/12）

### 4. 边 id 格式不对
- **检查**：sequenceFlow id 是 `sid-<UUID>` 还是 `flow1` 这种简单名？
- **解法**：预处理时把所有边 id 规范化成 `sid-<UUID>`

## 现象：节点全堆在左上角一团

**含义**：系统不会自动重排布局，完全信 JSON 里的坐标。

- **检查**：JSON 里节点 bounds 是否都是 (10,10) 附近？
- **解法**：必须用 bpmn-auto-layout 算坐标，并按 [layout-rules.md](./layout-rules.md) 重排

## 现象：连线乱/穿过节点

**含义**：dockers 中间点算错，或长边穿过中间节点。

- **检查**：dockers 首尾点是否=节点中心偏移？中间点是否=绝对坐标？
- **解法**：实现正交路由（见 [layout-rules.md](./layout-rules.md) 第三节）
- **关键点**：长跨度边绕行到流程外围（上方/下方）

## 现象：节点重叠

**含义**：layout 按 100×80 布局，改成真实尺寸后长名加宽超出预留空间。

- **解法**：坐标重排（relayoutNodes），按真实宽度紧凑排列

## 现象：主行节点不齐

**含义**：不同类型节点高度不同（30/28/46/40），layout 按顶边对齐。

- **解法**：强制同一行节点中心 y 对齐到 StartEvent 中心 y

## 现象：properties 属性丢失

**含义**：节点 properties 缺系统校验的字段，或字段顺序不对。

- **检查**：和原版 defJson 逐字段对比（字段名+顺序+值）
- **解法**：按原版顺序排列字段：
  - StartEvent: `overrideid → name → initiator → i18nKey`
  - UserTask: `overrideid → name → tasklisteners → i18nKey`
  - XORGateway: `overrideid → name → documentation → asynchronousdefinition → exclusivedefinition → sequencefloworder`
  - EndEvent: `overrideid → name → documentation`

## 现象：网关分支标签显示 `&gt;=20万`

**含义**：XML 转义未还原。

- **解法**：对 name/condition 字段做 `unescapeXml`（`&gt;` → `>` 等）

## 现象：网关连线「连到边上」/流程配置页断线

**含义**：流程设计页箭头连在网关斜边上而非顶点；流程配置页该线直接断开没到网关。

- **检查**：bpmnXml DI 中该边网关端 waypoint 是否落在 DI 矩形四边中点（菱形顶点）？
- **根因**：waypoint 落在菱形斜边或矩形角上——配置页按菱形渲染连线，只有精确顶点才能吸附
- **解法**：vsdx-relayout 构造性保证三件套（shapeExit 轴向投影 / vertexSnap 顶点吸附 / gwGuide 正交引导拐点），详见 [layout-rules.md §3.6](./layout-rules.md)
- **验证**：`verify-import`「DI 网关端点菱形顶点粘附」须 N/N

## 现象：网关多条出线挤在一起

**含义**：同一网关多条出线共线重叠，网关附近挤成一条线。

- **检查**：relayout 输出有无「⚠️ 输入预检: 未匹配…源 vsdx 疑似版本过旧」告警？该网关在 vsdx 里是否存在？
- **根因**：源 vsdx 版本过旧缺该网关，出边走兜底 L 形路由，多条同向共线
- **解法**：向用户索取最新 vsdx 重新重排，勿依赖兜底重路由硬排
- **验证**：`verify-import`「网关出线分散」检查——同网关出线同顶点同方向且共线重叠 >60px 判拥挤（短共享干道后垂直分叉的 Y 形分支不算）

## 排查方法论：先校准诊断脚本本身

诊断结果与预期严重不符时（如报 20 条斜向边但图上没有），先怀疑脚本再怀疑产物：

- DI XML 属性顺序不定（`height width x y` 等），正则须按属性名提取，勿假设固定顺序
- `BPMNEdge_` / `BPMNShape_` 是 DI 元素 id 前缀，`bpmnElement` 属性才是业务节点/边 id
- defJson docker 首段方向判定须取对参考点（`midIdx = tag === '首' ? 1 : d.length - 2`）

## 验证分层：输入预检 vs 产物回归

| 层 | 时机 | 职责 |
|---|---|---|
| 输入预检 | 生成前 | relayout 匹配率告警——vsdx 版本过旧 fail-fast，成本最低 |
| 构造性保证 | 生成中 | shapeExit/vertexSnap/gwGuide 让任何输入必产出顶点粘附产物 |
| 产物回归 | 生成后 | `verify-import` 顶点粘附 + 出线分散校验——秒级回归门禁，防止改代码碰坏构造性保证（vsdx-relayout 曾连改 4 轮） |

## 调试工具

### 字节级对比
当导入报错但找不到原因时，把生成版和原版逐段对比：

```bash
# 建一个临时对比目录（任意位置均可，用完即删）
mkdir -p /tmp/ibpm-cmp && cd /tmp/ibpm-cmp
# 解压生成版 zip
unzip -o <生成的zip绝对路径>
# 解压原版 zip（如果有真实导出包做对照）
unzip -o <原版zip绝对路径> -d orig/
# 对比顶层结构、属性、节点/边数量
```

### bpmn-moddle 解析验证
用 `bpmn-moddle` 解析生成的 bpmnXml，看 warnings/errors：
- warnings 多说明有非标准属性（可忽略）
- **解析失败说明结构有硬伤**

### ID 关联一致性检查
```js
// defJson 边 resourceId vs bpmnXml sequenceFlow id 的交集
// 应该 = 边总数
```

## 现象：查不到某实例的站内信/抄送记录（新平台实例）

**含义**：新 IBPM 平台实例 id 为 19 位雪花 id，消息库不在 JMBPM schema 的旧消息表里。

- **旧表陷阱**：LBWFNOTIFY/LBWFNOTIFYMSG.INSTANCEID 是 NUMBER(12)，装不下 19 位 id；T_SYS_MSG、T_MESSAGEINFO（2024 年停用）、CT_NOTICELOG、T_MSG_CALLCLIENT 均为旧平台表——按 19 位实例 id 查全部为空，勿浪费时间
- **真正落点**：BPM schema（all_users 可见，2026-08 新建）承载新平台运行时，dbx 直连账号默认无 SELECT 授权，DB 直查走不通
- **替代证据源**：PMS 侧 `t_ibpm_callback_log`（uat MySQL）记录全链路 taskComplete 事件——`candidate` 列=真实审批人工号，`assignee=admin` 是应用级 apiToken 代操作的表象；审批历史兜底用 openapi `getOpinionHistoryList`（OpinionInfo.auditorAccount）
