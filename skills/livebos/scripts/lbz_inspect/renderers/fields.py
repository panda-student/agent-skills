# -*- coding: utf-8 -*-
"""字段表渲染:parse_fields 结果 → 文本行。"""


def render_object_header(header):
    """object/dataset 头标签多属性换行美化。"""
    return header.replace('><', '>\n<') if header else ''


def _check_summary(s):
    """字段校验属性 → 有意义值的摘要行(空值/默认值不显示)。"""
    parts = []
    if s.get('unique') in ('true', '1', 'Y'):
        parts.append('unique')
    if s.get('nullable') in ('false', '0', 'N'):
        parts.append('必填')
    if s.get('check_type') not in ('', '0', None):
        parts.append('check-type=' + s['check_type'])
    if s.get('validation'):
        parts.append('validation=' + s['validation'][:60])
    if s.get('default'):
        parts.append('default=' + s['default'][:40])
    return '; '.join(parts)


def _visibility_summary(s):
    """字段显隐/锁定摘要行(动态表达式压缩,空值不显示)。"""
    parts = []
    if s.get('visible') in ('false', '0', 'N'):
        parts.append('静态隐藏(visible=false)')
    if s.get('invisible_expr'):
        parts.append('动态隐藏: ' + s['invisible_expr'])
    if s.get('disable_expr'):
        parts.append('动态锁定: ' + s['disable_expr'])
    return '; '.join(parts)


def render_fields(result, compact=False):
    """parse_fields 结果 → 字段表文本行列表。

    compact=True 时折叠长公式(只显示 40 字符摘要)。
    """
    lines = []
    if result['header']:
        lines.append(render_object_header(result['header']))
    if not result['main_fields']:
        lines.append('  (无 <column> 字段定义)')
        return lines
    if result['skipped_count']:
        lines.append('  (主字段 %d 个,另有 %d 个 UI 参数/弹窗副本已折叠)' % (
            len(result['main_fields']), result['skipped_count']))
    lines.append('-' * 70)
    lines.append('%-22s %-22s %-5s %-8s %-4s %-4s %s' %
                 ('字段', '描述', 'type', 'ref', 'en', 'fire', '公式'))
    for s in result['main_fields']:
        expr = s['expr']
        expr_show = (expr[:40] + ('...' if len(expr) > 40 else '')) if expr else ''
        lines.append('%-22s %-22s %-5s %-8s %-4s %-4s %s' % (
            s['name'], s['desc'], s['type'], s['ref'] or '-',
            s['enabled'] or '-', s['fire'] or '-', expr_show))
        checks = _check_summary(s)
        if checks:
            lines.append('       校验: ' + checks)
        vis = _visibility_summary(s)
        if vis:
            lines.append('       显隐: ' + vis)
        if expr and len(expr) > 40 and not compact:
            lines.append('       公式全文: ' + expr)
        # 候选过滤 constraint:引用字段的弹窗候选 SQL(选项目条件等核心业务限制)
        for c in s.get('constraints', []):
            head = '候选过滤(constraint type=%s)' % c['type']
            if c['refs']:
                head += ' 引用[' + ','.join(c['refs']) + ']'
            sql_show = c['sql']
            if compact and len(sql_show) > 40:
                sql_show = sql_show[:40] + '...'
            lines.append('       %s: %s' % (head, sql_show))
    return lines
