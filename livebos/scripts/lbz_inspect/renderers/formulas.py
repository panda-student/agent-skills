# -*- coding: utf-8 -*-
"""公式渲染:公式列表 → 项目符号文本。"""


def render_formulas(formulas_list):
    """公式列表 → 标题 + 项目符号行。"""
    lines = ['公式/SQL 汇总(%d 条,去重):' % len(formulas_list), '-' * 70]
    for e in formulas_list:
        lines.append('• ' + e[:120])
        if len(e) > 120:
            lines.append('   ' + e[120:].replace('\n', '\n   '))
    return lines
