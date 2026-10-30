# -*- coding: utf-8 -*-
"""invoke 渲染:组件调用 → 主行 + SQL 展开行。"""


def render_invoke(inv):
    """parse_invoke 结果 → (主行, [展开行])。"""
    line = '[%s/%s] %s %s' % (
        inv['component'] or '?', inv['operation'] or '?',
        inv['object'], ('(%s)' % inv['desc']) if inv['desc'] else '')
    if inv['fields']:
        line += '  → 改字段: ' + ', '.join(inv['fields'])
    if inv['condition']:
        line += '  | cond: ' + inv['condition'][:60]
    extras = []
    sql = inv['sql']
    if sql:
        if len(sql) > 80:
            line += '  | SQL: ' + sql[:80] + '...'
            extras.append('SQL: ' + sql)
        else:
            line += '  | SQL: ' + sql
    return line, extras
