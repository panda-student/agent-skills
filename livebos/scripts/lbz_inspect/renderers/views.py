# -*- coding: utf-8 -*-
"""视图渲染:parse_view 结果 → 文本。"""

PROP_LABEL = {'73': '可排序字段(推断,可多值)', '63': '属性63'}


def render_view(result):
    """parse_view 结果 → 文本行列表。"""
    lines = []
    if result['parent']:
        lines.append('  父对象: %s' % result['parent'])
    for name, values in result['properties']:
        label = PROP_LABEL.get(name, '属性' + name)
        lines.append('  %s: %s' % (label, ' / '.join(values)))
    lines.append('  筛选/权限条件(%d 条):' % len(result['conditions']))
    for i, c in enumerate(result['conditions'], 1):
        lines.append('    #%d args: %s' % (i, ', '.join(c['args']) or '-'))
        for ln in c['statement'].split('\n'):
            lines.append('       %s' % ln)
    if result['columns']:
        lines.append('  展示列(%d): %s' % (len(result['columns']), ', '.join(result['columns'])))
    return lines
