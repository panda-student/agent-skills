# Activiti bpmnXml + extProcess 完整模板规则

> 逆向工程自原 zip 的 `bpmdefs.flow.xml` 里的 `<bpmnXml>` 段。这是系统 POJO 转换的关键依赖，**缺失任一部分都会导致 "XML转换POJO类型错误null"**。

## 一、根标签：ext:definitions（完整命名空间）

```xml
<ext:definitions
    xmlns:ext="http://www.jee-soft.cn/bpm"
    xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:activiti="http://activiti.org/bpmn"
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
    xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"
    xmlns:fn="http://www.w3.org/2005/02/xpath-functions"
    xmlns:ht="http://www.jee-soft.cn/BPMN20EXT"
    typeLanguage="http://www.w3.org/2001/XMLSchema"
    expressionLanguage="http://www.w3.org/1999/XPath"
    targetNamespace="http://activiti.org/bpmn20">
```

**关键点**：
- 根标签是 `ext:definitions`（宏天自定义前缀），不是 `bpmn:definitions`
- `targetNamespace="http://activiti.org/bpmn20"`（不是 `http://bpmn.io/schema/bpmn`）
- **无 `<?xml?>` 声明**（这段在 bpmdefs.flow.xml 的 `<bpmnXml>` 标签里，是嵌套的）

## 二、process 段（默认命名空间，无前缀）

```xml
<process id="defKey" name="流程名" isExecutable="true">
  <extensionElements>
    <activiti:executionListener event="start" delegateExpression="${startEventListener}"/>
    <activiti:executionListener event="end" delegateExpression="${endEventListener}"/>
  </extensionElements>
  <!-- 节点 -->
  <!-- 边 -->
</process>
```

**关键点**：
- `<process>` 用**默认命名空间**（无前缀），不是 `<bpmn:process>`
- `id = defKey`（流程英文标识，如 `fxbx`），不是 `Process_1`
- `isExecutable="true"`（不是 `false`）

## 三、节点规则

### startEvent（带 initiator）
```xml
<startEvent id="StartEvent1" name="开始" activiti:initiator="startUser" i18nKey=""/>
```

### userTask（带 taskListener）
```xml
<userTask id="UserTask1" name="编制" i18nKey="">
  <extensionElements>
    <activiti:taskListener event="create" delegateExpression="${taskCreateListener}"/>
    <activiti:taskListener event="complete" delegateExpression="${taskCompleteListener}"/>
  </extensionElements>
</userTask>
```

### gateway / endEvent（简单自闭合）
```xml
<exclusiveGateway id="XORGateway1" name="金额判断"/>
<endEvent id="EndEvent1" name="结束"/>
```

## 四、边（sequenceFlow）

### 普通边
```xml
<sequenceFlow id="sid-UUID" sourceRef="StartEvent1" targetRef="UserTask1"/>
```

### 带条件的边（网关分支）
```xml
<sequenceFlow id="sid-UUID" name="≥5000" sourceRef="XORGateway1" targetRef="UserTask3">
  <conditionExpression xsi:type="tFormalExpression"><![CDATA[amount>=5000]]></conditionExpression>
</sequenceFlow>
```

**关键点**：
- **id 必须是 `sid-<UUID>` 格式**（不是 `flow1` 这种简单名，否则 POJO 解析失败）
- 条件表达式用 `<conditionExpression xsi:type="tFormalExpression"><![CDATA[...]]></conditionExpression>`

## 五、BPMNDiagram 段（坐标）

```xml
<bpmndi:BPMNDiagram id="BPMNDiagram_defKey">
  <bpmndi:BPMNPlane bpmnElement="defKey" id="BPMNPlane_defKey">
    <bpmndi:BPMNShape bpmnElement="StartEvent1" id="BPMNShape_StartEvent1">
      <omgdc:Bounds height="30.0" width="30.0" x="135.0" y="187.0"/>
    </bpmndi:BPMNShape>
    <bpmndi:BPMNEdge bpmnElement="sid-UUID" id="BPMNEdge_sid-UUID">
      <omgdi:waypoint x="165.0" y="202.0"/>
      <omgdi:waypoint x="210.0" y="202.0"/>
    </bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane>
</bpmndi:BPMNDiagram>
```

**关键点**：
- 坐标用 `omgdc:Bounds`（不是 `dc:Bounds`）
- 边路径用 `omgdi:waypoint`（不是 `di:waypoint`）
- `BPMNEdge.bpmnElement` = `sequenceFlow.id`（必须匹配）

## 六、ext:extProcess 段（宏天扩展，占 24.7%）

### 结构骨架

```xml
<ext:extProcess>
  <ext:extNodes>
    <!-- 每个 UserTask 一个 userNode，StartEvent/EndEvent 一个 baseNode -->
    <!-- 网关不进 extNodes（原版规律） -->
    <ext:userNode nodeType="common" name="编制" bpmnElement="UserTask1">
      <ext:extPlugins>...审批人 userAssign...</ext:extPlugins>
      <ext:buttons>...8个操作按钮...</ext:buttons>
    </ext:userNode>
    <ext:baseNode nodeType="common" name="开始" bpmnElement="StartEvent1">
      <ext:extPlugins/>
      <ext:buttons>...startFlow/saveDraft 按钮...</ext:buttons>
    </ext:baseNode>
    <ext:baseNode nodeType="common" name="结束" bpmnElement="EndEvent1">
      <ext:extPlugins/>
    </ext:baseNode>
  </ext:extNodes>

  <ext:globalForm>
    <ext:form type="frame" formValue="{host}{formPath}?iframe=1&amp;workflowType={processKey}&amp;id={pk}..."/>
  </ext:globalForm>
  <ext:instForm></ext:instForm>
  <ext:extPlugins></ext:extPlugins>

  <ext:extProperties>
    <ext:subjectRule/><ext:description/><ext:startNotifyType/>...（12个空子标签）
  </ext:extProperties>

  <ext:varDefs>
    <ext:variableDef>
      <ext:name>报销金额</ext:name>
      <ext:key>amount</ext:key>
      <ext:type>double</ext:type>
      <ext:defaultVal>0.0</ext:defaultVal>
      <ext:isRequired>true</ext:isRequired>
    </ext:variableDef>
  </ext:varDefs>
</ext:extProcess>
</ext:definitions>
```

### UserTask 的 8 个操作按钮（固定模板）

`agree`(下一步) / `reject`(退回) / `free`(自由跳转) / `delegate`(转办) / `addSign`(加签) / `saveDraft`(保存) / `endProcess`(终止流程)

每个按钮结构：
```xml
<ext:button alias="agree" buttonType="system" customAlias="" isLock="false" name="下一步">
  <ext:rejectMode><![CDATA[backToStart,rejectPre,reject]]></ext:rejectMode>
</ext:button>
```

### StartEvent 的按钮

`startFlow`(提交申请) / `saveDraft`(保存)

### 审批人 extPlugins（userAssign）

**发起人模式**（source=start）：
```xml
<userAssign xmlns="http://www.jee-soft.cn/bpm/plugins/task/userAssign">
  <userRule xmlns="http://www.jee-soft.cn/bpm/plugins/userCalc/base" groupNo="1">
    <description>发起人</description>
    <condition>{"junction":"and","condition":[]}</condition>
    <type>user</type>
    <calcs>
      <cusers xmlns="http://www.jee-soft.cn/bpm/plugins/userCalc/cusers" extract="extract" logicCal="or" source="start"></cusers>
    </calcs>
  </userRule>
</userAssign>
```

**指定用户模式**（source=spec）：
```xml
<cusers xmlns="http://www.jee-soft.cn/bpm/plugins/userCalc/cusers" extract="extract" logicCal="or" source="spec">
  <members account="00071763" userId="1547142466930810880" userName="陈金坤"/>
</cusers>
```

## 七、关键 ID 关联（POJO 错误根因）

```
defJson 边 resourceId  =  bpmnXml sequenceFlow id  =  sid-UUID
                       ↑
                 必须完全一致！系统靠这个关联两份数据
```

**节点**：
- bpmnXml 通过 `BPMNShape.bpmnElement = overrideid`（如 StartEvent1）关联
- defJson 节点 resourceId 是独立 UUID，和 bpmnXml 无关

**边**：
- bpmnXml 通过 `BPMNEdge.bpmnElement = sequenceFlow.id` 关联
- **defJson 边 resourceId = sequenceFlow.id**（不是独立 UUID！）

## 八、流程变量（varDefs）

网关条件依赖变量，样本里必须配 `variables`：

```json
"variables": [
  { "name": "报销金额", "key": "amount", "type": "double", "defaultVal": 0.0, "isRequired": true },
  { "name": "报销类型", "key": "type", "type": "string", "isRequired": false }
]
```

变量类型：`double` / `string` / `int` / `boolean`
