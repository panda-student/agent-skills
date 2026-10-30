# -*- coding: utf-8 -*-
"""按钮渲染:parse_commands 结果 → 文本。"""

CMD_TYPE_LABEL = {'2': '命令', '5': '流程'}


def render_commands(cmds):
    """parse_commands 结果 → 文本行列表(每按钮一行)。"""
    lines = []
    for c in cmds:
        kind = CMD_TYPE_LABEL.get(c['type'], 'type=' + c['type'])
        lines.append('  [%s] %-14s => %s' % (kind, c['desc'], ' / '.join(c['items'])))
    return lines


def render_commands_summary(file_cmds):
    """[(rel_path, 文件名, cmds), ...] → 每文件一行摘要(overview 用)。"""
    lines = []
    for _, name, cmds in file_cmds:
        lines.append('  %-24s %s' % (name, ' / '.join(c['desc'] for c in cmds)))
    return lines
