# -*- coding: utf-8 -*-
"""业务流程步骤树渲染:带缩进文本树。"""
from .invokes import render_invoke


def render_process_nodes(nodes):
    """parse_process_steps 结果 → 文本行列表(带缩进树)。"""
    lines = []
    for n in nodes:
        pad = '  ' * n['depth']
        if n['type'] == 'block_open':
            line = '%s◆ %s %s' % (pad, n['label'], n['desc'])
            if n.get('cond'):
                line += '  | cond: ' + n['cond']
            lines.append(line)
        elif n['type'] == 'block_close':
            continue
        elif n['type'] == 'invoke':
            line, extras = render_invoke(n['invoke'])
            lines.append('%s• %s' % (pad, line))
            for e in extras:
                lines.append('%s    └ %s' % (pad, e))
        elif n['type'] == 'response':
            lines.append('%s⚠ 响应 ret=%s msg=%s' % (
                pad, n['ret'], n['msg'][:60]))
        elif n['type'] == 'assign':
            lines.append('%s= 赋值 %s' % (pad, n['desc']))
        elif n['type'] == 'copy':
            lines.append('%s= 拷贝 %s ← %s' % (pad, n['to'], n['from']))
    return lines
