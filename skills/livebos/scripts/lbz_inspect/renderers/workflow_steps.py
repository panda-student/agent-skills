# -*- coding: utf-8 -*-
"""审批链渲染:步骤/动态办理人/流转/业务挂接/节点字段权限 → 编号缩进文本。"""


def _fmt_perm(info):
    """三态配置 → 单行摘要:可编辑全列、隐藏全列、锁定仅计数。"""
    parts = []
    if info['editable']:
        parts.append('可编辑(%d): %s' % (len(info['editable']), ', '.join(info['editable'])))
    if info['locked']:
        parts.append('锁定可见(%d)' % len(info['locked']))
    if info['hidden']:
        parts.append('隐藏(%d): %s' % (len(info['hidden']), ', '.join(info['hidden'])))
    return ' | '.join(parts) if parts else '(无列配置)'


def render_workflow_def(result):
    """parse_workflow_def 结果 → 文本行列表。"""
    lines = ['  审批链(%d 步):' % len(result['steps'])]
    init = result['initial']
    if init['pre'] or init['transitions']:
        parts = []
        if init['pre']:
            parts.append('挂接(pre): ' + ', '.join(init['pre']))
        for t in init['transitions']:
            parts.append('流转: ' + t)
        lines.append('  [发起] ' + ' | '.join(parts))
    node_fields = result.get('node_fields') or {}
    if '__error__' in node_fields:
        lines.append('  ⚠ 节点字段权限解析失败: %s' % node_fields['__error__'])
    for i, st in enumerate(result['steps'], 1):
        lines.append('  %d. %s%s' % (i, st['name'], ' (结束)' if st['finish'] else ''))
        for ow in st['dyn_owners']:
            lines.append('       动态办理人: %s %s' % (ow['describe'], ow['expr'][:100]))
        if st['pre']:
            lines.append('       挂接(pre): ' + ', '.join(st['pre']))
        if st['post']:
            lines.append('       挂接(post): ' + ', '.join(st['post']))
        for t in st['transitions']:
            lines.append('       流转: ' + t)
        for item in node_fields.get(st['name'], []):
            ea = item.get('edit_attribute')
            label = '字段权限[%s]' % item['object']
            if ea:
                label = '字段权限[%s(editAttribute=%s)]' % (item['object'], ea)
            lines.append('       %s: %s' % (label, _fmt_perm(item)))
            for sub_name, sub_info in item.get('sub', {}).items():
                sea = sub_info.get('edit_attribute')
                sub_label = '子表权限[%s]' % sub_name
                if sea:
                    sub_label = '子表权限[%s(editAttribute=%s)]' % (sub_name, sea)
                lines.append('         %s: %s' % (sub_label, _fmt_perm(sub_info)))
    return lines
