# -*- coding: utf-8 -*-
"""纯解析包:从 XML 文本提取结构化数据。

契约:所有函数只返回数据(dict/list),不做任何打印、不读文件。
输入是已解码的字符串,输出是结构化结果。便于单元测试。
一种解析逻辑一个模块:
  fields          - 对象 <columns> 字段
  buttons         - <display-options><commands> 页面按钮
  views           - 视图(父继承/筛选权限条件/属性/展示列)
  invokes         - <invoke> 组件调用结构
  sqls            - SQL 语句提取(参数解包 + 文本扫描)
  process_header  - 流程文件头(类型识别)
  process_steps   - <process> 步骤树(含 elseif/else/copy 分支)
  workflow_steps  - <workflow> 审批定义(步骤/动态办理人/流转/业务挂接)
  formulas        - 计算表达式收集(公式 + 内联 SQL 去重)
"""
from .fields import parse_column, parse_fields
from .buttons import parse_commands
from .views import parse_view, parse_conditions, parse_properties
from .invokes import parse_invoke
from .sqls import extract_sql, scan_inline_sql
from .process_header import parse_process_header
from .process_steps import parse_process_steps
from .workflow_steps import parse_workflow_def
from .formulas import parse_formulas

__all__ = [
    'parse_column', 'parse_fields',
    'parse_commands',
    'parse_view', 'parse_conditions', 'parse_properties',
    'parse_invoke',
    'extract_sql', 'scan_inline_sql',
    'parse_process_header',
    'parse_process_steps',
    'parse_workflow_def',
    'parse_formulas',
]
