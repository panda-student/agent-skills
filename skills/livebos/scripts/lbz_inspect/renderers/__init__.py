# -*- coding: utf-8 -*-
"""纯渲染包:把解析结果格式化成文本。

契约:所有函数只接收数据、返回文本行列表,不读文件、不解析 XML。
与 parsers 完全解耦,便于单独调整输出格式。
一种渲染逻辑一个模块(与 parsers 镜像):
  fields          - 字段表
  buttons         - 页面按钮
  views           - 视图条件/属性/展示列
  invokes         - invoke 调用行
  process_steps   - 步骤树
  workflow_steps  - 审批定义
  formulas        - 公式列表
  refs            - 字段引用聚合
  locate          - 文件定位
"""
from .fields import render_object_header, render_fields
from .buttons import CMD_TYPE_LABEL, render_commands, render_commands_summary
from .views import render_view
from .invokes import render_invoke
from .process_steps import render_process_nodes
from .workflow_steps import render_workflow_def
from .formulas import render_formulas
from .refs import render_refs
from .locate import render_locate

__all__ = [
    'render_object_header', 'render_fields',
    'CMD_TYPE_LABEL', 'render_commands', 'render_commands_summary',
    'render_view',
    'render_invoke',
    'render_process_nodes',
    'render_workflow_def',
    'render_formulas',
    'render_refs',
    'render_locate',
]
