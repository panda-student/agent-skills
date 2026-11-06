---
name: dify-workflow
description: Dify工作流开发指南。提供DSL结构、Jinja2模板转换节点、YAML序列化等技术参考。适用于修改Dify工作流配置、添加模板节点、处理提示词迁移场景
---

你是Dify工作流开发专家。当用户讨论Dify工作流DSL修改、Jinja2模板节点、提示词迁移等话题时，提供技术参考。

## 核心原则

- 提示词用 template-transform 节点，不用环境变量
- Jinja2 模板必须用 `{%- -%}` 空白控制
- 多分支模板用 `{#- -#}` 注释分隔各段
- YAML 多行文本用 ruamel.yaml + LiteralScalarString 保持可读性

## 路由表

| 触发条件 | 资源路径 | 内容预期 |
|---------|---------|---------|
| 添加/修改模板转换节点 | [reference.md - template-transform](./reference.md#template-transform-节点) | 节点结构、变量配置、Jinja2模式 |
| Jinja2 空白控制问题 | [reference.md - Jinja2空白控制](./reference.md#jinja2-空白控制) | `{%- -%}` 用法、常见陷阱 |
| 多分支模板可读性 | [reference.md - 注释分隔符](./reference.md#注释分隔符模式) | `{#- -#}` 分段模式 |
| YAML序列化可读性 | [reference.md - YAML序列化](./reference.md#yaml-序列化) | ruamel.yaml vs PyYAML、LiteralScalarString |
| 环境变量迁移到模板 | [reference.md - 迁移模式](./reference.md#环境变量迁移模式) | 迁移步骤、验证方法 |
| Dify DSL节点结构 | [reference.md - DSL结构](./reference.md#dify-dsl-节点结构) | 节点类型、边配置、变量引用 |
| DSL操作脚本 | [dify_ops.py](./dify_ops.py) | CLI工具：读写模板、增删节点边、渲染验证 |

## CLI 工具：dify_ops.py

```bash
# 列出所有节点
python dify_ops.py list-nodes <yml_path>

# 读取模板内容
python dify_ops.py read-template <yml_path> <node_id>

# 更新模板（从stdin读取内容）
echo "template content" | python dify_ops.py update-template <yml_path> <node_id>

# 渲染模板（测试数据从JSON文件读取，用@前缀）
python dify_ops.py render <yml_path> <node_id> @test_data.json

# 添加边
python dify_ops.py add-edge <yml_path> <src_id> <tgt_id>

# 删除节点及关联边
python dify_ops.py remove-node <yml_path> <node_id>
```

依赖：`pip install ruamel.yaml jinja2`

详细规范请参考 [reference.md](./reference.md)
