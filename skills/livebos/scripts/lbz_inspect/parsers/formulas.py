# -*- coding: utf-8 -*-
"""计算表达式收集:<expression> 公式 + 内联 SQL,合并去重保序。"""
import re
from ..text_utils import compact_expr
from .sqls import scan_inline_sql


def parse_formulas(data):
    """文件内所有计算表达式去重 → [expr, ...](保序)。"""
    seen = []
    for m in re.finditer(r'<expression>(.*?)</expression>', data, re.S):
        e = compact_expr(m.group(1))
        if e and e not in seen:
            seen.append(e)
    for raw in scan_inline_sql(data):
        e = compact_expr(raw)
        if e and e not in seen:
            seen.append(e)
    return seen
