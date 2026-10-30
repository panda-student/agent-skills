# -*- coding: utf-8 -*-
"""字段域用例:fields 命令(字段表/校验属性/公式折叠/未找到路径)。覆盖 parsers+renderers 的 fields。"""

CASES = [
    ('full', ['fields', 'T_Spring']),
    ('compact', ['--compact', 'fields', 'T_Spring']),
    ('notfound', ['fields', 'X_NOT_EXIST']),
    ('constraint', ['fields', 'T_CstrDemo']),
    ('constraint_compact', ['--compact', 'fields', 'T_CstrDemo']),
]
