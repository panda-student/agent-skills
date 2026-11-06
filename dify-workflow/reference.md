# Dify 工作流开发参考

## template-transform 节点 {#template-transform-节点}

### 节点结构

```yaml
- data:
    template: |-
      {%- if agent == "目标人群画像" -%}
      内容...
      {%- elif agent == "场景/痛点" -%}
      内容...
      {%- endif -%}
    title: 模板名称
    type: template-transform
    variables:
    - value_selector:
      - '源节点ID'
      - 输出变量名
      value_type: string
      variable: 模板内变量名
  height: 52
  id: '节点ID'
  position: &id00X
    x: 坐标
    y: 坐标
  type: custom
  width: 242
```

### 变量引用语法

在 template-transform 节点的 template 中，直接使用 `{{ variable_name }}` 引用 variables 中定义的变量。

在 LLM 节点的 prompt_template 中，使用 `{{#节点ID.变量名#}}` 引用其他节点的输出。

### 边配置

```yaml
- data:
    isInIteration: false
    isInLoop: false
    sourceType: template-transform
    targetType: llm
  id: 源ID-source-目标ID-target
  source: '源节点ID'
  sourceHandle: source
  target: '目标节点ID'
  targetHandle: target
  type: custom
  zIndex: 0
```

---

## Jinja2 空白控制 {#jinja2-空白控制}

### 核心规则

| 语法 | 效果 |
|------|------|
| `{%-` | 去除标签前所有空白（含换行） |
| `-%}` | 去除标签后所有空白（含换行） |
| `{%` | 保留标签前空白 |
| `%}` | 保留标签后空白 |

### 最佳实践

**必须使用 `{%- -%}`**：Dify 模板转换节点的输出会直接注入 LLM prompt，多余的空行会干扰 LLM 理解。

```jinja2
{%- if agent == "目标人群画像" -%}
适用于画像分析类任务，输出Markdown表格。当前分析品类：{{ category }}
{%- elif agent == "场景/痛点" -%}
适用于场景痛点分析类任务，输出Markdown表格。当前分析品类：{{ category }}
{%- else -%}
适用于其他分析任务。
{%- endif -%}
```

### 常见陷阱

1. **`{% if %}` 导致输出以 `\n` 开头**：改用 `{%- if -%}`
2. **`{% endif %}` 导致尾部多余换行**：改用 `{%- endif -%}`
3. **条件标签间的空白被渲染**：所有 if/elif/else/endif 都用 `{%- -%}`
4. **内嵌条件可混用**：`{%- if category == "X" %}` 内嵌条件后需要输出换行时，`%}` 不加 `-`

---

## 注释分隔符模式 {#注释分隔符模式}

### 问题

多分支 Jinja2 模板（if/elif/else）中，各分支内容混在一起，难以区分哪个段落属于哪个条件。

### 解决方案

使用 `{#- -#}` 注释作为段落分隔符。Jinja2 注释不产生输出，`-` 控制空白，不影响渲染结果。

```jinja2
{#- ================================================================ -#}
{#-  目标人群画像 — 格式指令                                        -#}
{#- ================================================================ -#}
{%- if agent == "目标人群画像" -%}
适用于画像分析类任务...
{#- ================================================================ -#}
{#-  场景/痛点 — 格式指令                                          -#}
{#- ================================================================ -#}
{%- elif agent == "场景/痛点" -%}
适用于场景痛点分析类任务...
{#- ================================================================ -#}
{#-  其他分析任务 — 格式指令                                        -#}
{#- ================================================================ -#}
{%- else -%}
适用于其他分析任务...
{%- endif -%}
```

### 验证

添加注释后必须验证输出不变：

```python
import jinja2
env = jinja2.Environment(undefined=jinja2.Undefined)
original = env.from_string(ORIGINAL_TEMPLATE).render(agent="X", category="Y")
improved = env.from_string(IMPROVED_TEMPLATE).render(agent="X", category="Y")
assert original == improved
```

---

## YAML 序列化 {#yaml-序列化}

### PyYAML vs ruamel.yaml

| 特性 | PyYAML | ruamel.yaml |
|------|--------|-------------|
| 多行文本 | 双引号 + `\n` 转义 | `|-` 块标量（可读） |
| 格式保留 | 不保留 | 保留注释、引用、格式 |
| 块标量 | `dump()` 破坏 | `LiteralScalarString` 保持 |

### ruamel.yaml 写入模板

```python
from ruamel.yaml import YAML
from ruamel.yaml.scalarstring import LiteralScalarString

yaml = YAML()
yaml.preserve_quotes = True
yaml.width = 4096

with open('workflow.yml', 'r', encoding='utf-8') as f:
    data = yaml.load(f)

for node in data['workflow']['graph']['nodes']:
    if node['id'] == '目标节点ID':
        node['data']['template'] = LiteralScalarString(TEMPLATE_CONTENT)

with open('workflow.yml', 'w', encoding='utf-8') as f:
    yaml.dump(data, f)
```

### 关键配置

- `yaml.preserve_quotes = True`：保留原始引号风格
- `yaml.width = 4096`：避免长行被折叠
- `LiteralScalarString`：确保多行文本以 `|-` 块标量写入

---

## 环境变量迁移模式 {#环境变量迁移模式}

### 迁移步骤

1. **提取环境变量内容**：从 environment_variables 中提取提示词文本
2. **转换为 Jinja2 模板**：将 key=value 格式转为 `{%- if/elif/else -%}` 分支
3. **添加空白控制**：所有条件标签使用 `{%- -%}`
4. **添加注释分隔符**：用 `{#- -#}` 标注各段落
5. **创建 template-transform 节点**：在 nodes 中添加新节点
6. **更新边配置**：修改 edges 中的 source/target 连接
7. **更新 LLM 引用**：将 `{{#env.VAR#}}` 改为 `{{#节点ID.output#}}`
8. **删除旧环境变量**：移除已迁移的 environment_variables 条目
9. **验证输出一致性**：对比原始代码输出和 Jinja2 渲染结果

### 验证方法

```python
import jinja2

env = jinja2.Environment(undefined=jinja2.Undefined)

test_cases = [
    ("目标人群画像", "智能马桶"),
    ("场景/痛点", "智能马桶"),
    ("购买行为和关注要素", "智能马桶"),
]

for agent, category in test_cases:
    original = original_code(agent, category)
    rendered = env.from_string(JINJA2_TEMPLATE).render(agent=agent, category=category)
    assert original == rendered, f"MISMATCH for {agent}+{category}"
```

---

## Dify DSL 节点结构 {#dify-dsl-节点结构}

### 节点类型

| type | 用途 | 关键字段 |
|------|------|---------|
| `start` | 工作流入口 | variables（用户输入） |
| `code` | Python 代码执行 | code, code_language, outputs, variables |
| `template-transform` | Jinja2 模板转换 | template, variables |
| `llm` | LLM 推理 | model, prompt_template, context, memory |
| `answer` | 输出回复 | answer |

### 变量引用格式

| 引用位置 | 语法 | 示例 |
|---------|------|------|
| LLM prompt_template | `{{#节点ID.变量名#}}` | `{{#1780540578724.output#}}` |
| template-transform template | `{{ 变量名 }}` | `{{ category }}` |
| code 节点 variables | value_selector | `['1772004179032', 'category']` |

### 节点 ID 生成

使用 13 位时间戳作为节点 ID（如 `1780540578724`），确保唯一性。
