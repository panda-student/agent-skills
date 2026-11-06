# 生成与交付规则（核心约束）

> 本文档收录 ibpm 流程生成的硬性规则与交付检查项。SKILL.md 的 Step 5 打包后会按本文件校验；导入报错时也按本文件排查。低频查阅，按需读取。

## 前置依赖（首次使用必读）

生成器代码已内嵌在技能目录下的 `bpmn-gen/`，但**不含 node_modules**，首次使用需安装一次依赖：

```bash
cd <技能目录>/bpmn-gen && npm install
```

- 环境：Node.js ≥ 18
- 依赖：`archiver` / `bpmn-auto-layout` / `bpmn-moddle` / `xlsx`（已写入 `package.json`，`npm install` 会自动装齐）
- 装好后即可离线使用，无需联网

**生成器路径**：本技能目录下的 `bpmn-gen/pipeline.mjs`（相对技能根目录，跨机器通用）。调用时把 `<SKILL_DIR>` 替换为技能目录的绝对路径。

代码分层（`bpmn-gen/src/`，均为纯函数库，可 ESM import 自由组合）：

| 层 | 模块 | 职责 |
|---|---|---|
| `lib/` | geometry | 共享几何工具（boundaryExit 等） |
| `parse/` | parse-vsdx | vsdx → 节点/边/几何折点解析 |
| `layout/` | auto-layout、route-optimizer | 自动布局（含环流程降级）、边路由坐标下降优化 |
| `generate/` | build-xml、bpmn-to-oryx、generate-nodedispose、build-activiti-xml、build-extprocess | 无坐标 BPMN → defJson → nodeDispose → Activiti 风格 bpmnXml |
| `pack/` | build-zip、postprocess | spec → 流程 ZIP；边路由优化 + DI 重写 + 重打包 |
| `verify/` | verify-flow-zip、verify-defjson、verify-extprocess、verify-import、verify-golden、compare-di-defjson | 布局/defJson/extProcess/导入/golden/DI 一致性校验 |

## 生成命令

`pipeline.mjs` 支持 `--stages` 组合阶段（默认 `build`），两种输入方式：

**方式 A：stdin 管道（技能调用时用，无中间文件）**

```bash
# 首次：装依赖（仅一次）
cd <SKILL_DIR>/bpmn-gen && npm install

# 内存里的 spec 通过 stdin 传入；完整链 = 生成 + 边路由优化 + 三项校验
echo '<spec JSON 字符串>' | node <SKILL_DIR>/bpmn-gen/pipeline.mjs --stdin --stages build,postprocess,verify-zip [-o 输出zip路径]
```

> 例：`echo '{"name":"项目立项",...}' | node C:\Users\<user>\.agents\skills\ibpm-ops\bpmn-gen\pipeline.mjs --stdin --stages build,postprocess,verify-zip -o out/xmlx.zip`
>
> 注意：JSON 用单引号包裹时，内部不能含单引号（BPM spec 不会出现单引号，安全）。
> 注意：`-o` 同时作用于 build 与 postprocess 时会写同一路径（postprocess 读入内存后覆盖写回，安全）；需保留中间产物时分两次跑。

**方式 B：文件路径（调试/samples 重跑时用）**

```bash
node <SKILL_DIR>/bpmn-gen/pipeline.mjs samples/linear.json [-o 输出zip路径]
```

其他阶段（可逗号组合，上一阶段产物自动作为下一阶段输入）：

```bash
node <SKILL_DIR>/bpmn-gen/pipeline.mjs --stages parse-vsdx flow.vsdx [-o flow.parsed.json]        # vsdx 解析
node <SKILL_DIR>/bpmn-gen/pipeline.mjs --stages verify-import <解包目录> --expect-nodes 85 --expect-edges 110   # 导入回归
node <SKILL_DIR>/bpmn-gen/pipeline.mjs --stages verify-golden <生成nodeDispose.json> --golden <golden.json>       # golden 对比
node <SKILL_DIR>/bpmn-gen/pipeline.mjs --stages compare-di <解包目录>                              # DI/defJson 一致性
```

两种方式产出等价。技能运行时只用方式 A，不在用户项目目录留任何中间文件。

## 初始视口目标

- 将"全部节点可见"定义为：首次打开且渲染稳定后，每个流程节点的屏幕矩形都完整落在设计器可视区域内。
- 允许设计器根据流程和窗口大小选择任意缩放比例；不要调用 `setAFixZoomLevel(1)` 强制 100%。
- 优先复用 Oryx `ORYX.Plugins.View.zoomFitToModel()`；在模型加载、容器显式可见且宽高稳定后调用。
- zip/`defJson` 负责完整、紧凑、居中的模型范围，但不包含可靠的初始浏览器视口字段。若无法修改设计器前端，必须明确说明"仅凭 zip 不能保证首次打开全部节点可见"。
- 详细调用时机、计算规则和验收方法见 [layout-rules.md](./layout-rules.md)。

## 生成的 zip 结构（对齐系统原版）

```
<flowkey>_<date>_<time>.zip
└── <flowkey>_<date>_<time>/
    ├── bpmdefs.flow.xml      ← 三层结构：bpmDefinition > bpmDefData{bpmnXml, defJson}
    ├── nodeDispose.json      ← 节点审批人配置
    ├── bo.xml                ← 占位
    ├── form.xml              ← 占位
    ├── formrights.xml        ← 占位
    ├── formRightScript.json  ← 占位
    └── nodeAutoSetting.json  ← 占位
```

## 核心规则（已逆向工程验证，勿改）

以下规则是**系统 POJO 转换的关键依赖**，缺失任一会导致 "XML转换POJO类型错误null"：

1. **bpmnXml 必须是 Activiti 风格**：`ext:definitions` 根 + 默认命名空间 `<process id=defKey isExecutable=true>` + executionListener/taskListener + `omgdc/omgdi` 前缀坐标，**无 `<?xml?>` 声明**。
2. **defJson 边 resourceId = bpmnXml sequenceFlow id**：两者必须完全一致（系统靠这个关联两份数据，不一致→POJO null）。
3. **ext:extProcess 段必须存在**：占原版 bpmnXml 的 24.7%，含节点按钮/审批人/表单/变量。**网关不进 extNodes**（只有 UserTask + StartEvent/EndEvent）。
4. **坐标布局规则必须通过最终包验收**：节点不得重叠，边不得穿过非端点节点，不同边不得共线重合，除共同节点端点外不得相交。完整算法和判定标准见 [layout-rules.md](./layout-rules.md)。

## 交付前硬性检查

- zip 内必须恰好包含规定的 7 个文件，且只有一个流程根目录。
- `defJson` 边 `resourceId` 必须与 `bpmnXml` 的 `sequenceFlow.id` 一一对应。
- 节点尺寸、主行中心对齐、网关 `20.5` 半像素偏移和自适应画布居中必须符合 Oryx 规则。
- 画布必须包含节点、全部边路由和标签安全区；内容四周边距应对称，误差不得超过 1px。
- 节点重叠、边穿节点、边与边共线重叠、非共同端点交叉必须全部为 0。
- 设计器前端在交付范围内时，首次打开后的不可见节点数必须为 0；缩放百分比不作为验收项。
- `ext:extProcess` 必须存在；网关不得进入 `extNodes`。
- 未通过检查的包不得作为最终产物交付。

## 导入后的事

- **节点审批人**：spec 的 `assignee` 可直接配 4 种 source（见 [assignee-rules.md](./assignee-rules.md)）；未配置时生成"发起人"占位，导入后在节点配置界面逐个改
- **审批人落库验证（API 自动化，2026-10-21 实测可用）**：导入部署成功后无需在 UI 逐节点人工核对——
  - 静态核对：`GET /model/flow/node/v1/getDefSetting?defId=` 取部署态 bpmnXml，解析 `ext:userNode → userAssign → userRule` 与 spec.assignee 预期比对
  - 运行时核对：发起实例后 `GET /runtime/runtime/instance/v1/instanceFlowOpinions?instId=` 返回各节点实际办理人（姓名+工号+orgPath），可验证 hrScript/var 类动态规则的真实取人结果
  - token 获取与接口细节见 `configuring-ibpm-interface-approval` 技能（refreshToken 换取链捷径；runtime 服务命名空间为双段前缀 `/runtime/runtime/`）
- **表单 URL**：spec 里配 `formPath`（前端 view 组件路由路径，如 `projectApply/addIbpm`），生成器自动拼 `{host}{formPath}?workflowType={processKey}...`；`targetSystemId` 写死取 `config.json` 的 `form.targetSystemId`（PMS 前端固定子系统，≠ 流程分类主系统 `sysName`）；需完全自定义时用 `globalFormUrl` 覆盖
- **流程变量**：网关条件依赖变量，样本里必须配 `variables`；**生成器入口校验——网关出边 `condition` 引用的变量未在 `variables` 或 `config.json.builtinVars` 声明时拒绝生成**

## 已知限制：长流程首次打开看不全（非 zip 问题）

**现象**：横向流程节点较多时，导入 ibpm 设计器后右侧节点看不到、选不中。

**根因**（已验证，不是 zip 数据问题）：

| 检查项 | 结论 |
|---|---|
| 生成的 defJson.bounds 是否正确包住内容 | ✅ 正确（`fitContentToCanvas` 已实现动态计算，画布尺寸 = 内容范围 + 对称边距） |
| defJson 是否有控制"初始可视窗"的字段 | ❌ 没有。扫了 3 个真实导出包，顶层 keys 都是 `resourceId/properties/stencil/childShapes/bounds/stencilset/ssextensions`，**没有任何 viewport/zoom/canvas 字段** |
| ibpm 设计器的初始可视窗行为 | 默认可视窗 ≤ 1200px，**无横向滚动条**。画布超过可视窗时节点被裁掉，必须用户**手动点画布右边缘的箭头按钮**逐次扩充，扩充后才出现滚动条 |
| 设计器代码能否改 | ❌ 公司中台统一维护，使用方无源码权限 |

**结论**：zip 层无法解决此问题。"画布尺寸跟着内容扩大"反而是触发此现象的原因——画布越大，初始可视窗之外的节点越多。

**变通方案**（按优先级）：

1. **用户手动扩充可视窗**（当前唯一可行）：导入后点击设计器画布右边缘的箭头按钮，逐次扩充直到全部节点可见。扩充后会出现横向滚动条。
2. **拆分流程**：超长流程（横向宽度 > 1200px，约 8-10 个节点一行）考虑拆成子流程，降低单流程宽度。
3. **推动中台改设计器**：在设计器模型加载完成的回调里加一行 `ORYX.Plugins.View.zoomFitToModel()`，首次打开即自动适配。这是治本方案，但需要中台团队配合。

**不要尝试的无效做法**：

- ❌ 压缩节点间距让画布变窄（会导致节点重叠、名称换行）
- ❌ 在 zip 里加 zoom/viewport 字段（defJson 不支持）
- ❌ 改 processKey 或其他元数据（与此现象无关）

**判断阈值**：粗略估算，画布宽度超过 1200px 时大概率会出现此现象。生成器输出的 zip 路径日志里 `节点: N, 边: M` 可以参考——N > 8 且拓扑接近线性时，横向画布大概率超宽。
