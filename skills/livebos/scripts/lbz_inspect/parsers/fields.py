# -*- coding: utf-8 -*-
"""对象字段解析:object/dataset 的 <columns> → 字段摘要。"""
import re
from ..text_utils import compact_expr


def parse_column(col_block):
    """单个 <column>...</column> 块 → 字段摘要 dict。

    返回 {name, desc, type, ref, expr, enabled, fire,
          unique, nullable, check_type, validation, default,
          visible, invisible_expr, disable_expr, constraints}。
    invisible_expr/disable_expr 为字段级动态显隐/锁定表达式(常含历史日期兼容规则)。
    constraints 为字段候选过滤列表(如选项目弹窗的状态/类型限制 SQL)——
    核心业务逻辑,2026-10-22 平迁梳理实证:constraint 归入"无逻辑不解析"导致选项目条件全漏。
    """
    def take(tag):
        m = re.search(r'<%s>(.*?)</%s>' % (tag, tag), col_block, re.S)
        return m.group(1).strip() if m else ''

    expr_raw = re.search(r'<expression>(.*?)</expression>', col_block, re.S)
    invis_raw = re.search(r'<invisible-expression>(.*?)</invisible-expression>', col_block, re.S)
    disable_raw = re.search(r'<disable-expression>(.*?)</disable-expression>', col_block, re.S)
    constraints = []
    for cm in re.finditer(r'<constraint\s+type="(\d+)">(.*?)</constraint>', col_block, re.S):
        seg = cm.group(2)
        sql_m = re.search(r'<SQL>(.*?)</SQL>', seg, re.S)
        if not sql_m:
            continue
        refs = re.findall(r'<refColumn>(.*?)</refColumn>', seg, re.S)
        constraints.append({
            'type': cm.group(1),
            'sql': compact_expr(sql_m.group(1)),
            'refs': [r.strip() for r in refs],
        })
    return {
        'name': take('name'),
        'desc': take('describe'),
        'type': take('type'),
        'ref': take('ref-object'),
        'expr': compact_expr(expr_raw.group(1)) if expr_raw else '',
        'enabled': take('enabled'),
        'fire': take('fire-event'),
        'unique': take('unique'),
        'nullable': take('nullable'),
        'check_type': take('check-type'),
        'validation': take('validation'),
        'default': take('default'),
        'visible': take('visible'),
        'invisible_expr': compact_expr(invis_raw.group(1)) if invis_raw else '',
        'disable_expr': compact_expr(disable_raw.group(1)) if disable_raw else '',
        'constraints': constraints,
    }


def parse_fields(data):
    """对象 XML 文本 → {header, main_fields, total_count, skipped_count}。

    - 只取第一个顶层 <columns> 块作为主字段(UI 参数副本折叠为计数)。
    - header 是 <object>/<dataset> 起始标签字符串。
    """
    header_m = re.search(r'<(object|dataset)\b[^>]*>', data)
    header = header_m.group(0) if header_m else ''

    top = re.search(r'<columns>(.*?)</columns>', data, re.S)
    if top:
        main_blocks = re.findall(r'<column>(.*?)</column>', top.group(1), re.S)
        all_count = len(re.findall(r'<column>(.*?)</column>', data, re.S))
    else:
        main_blocks = re.findall(r'<column>(.*?)</column>', data, re.S)
        all_count = len(main_blocks)

    # 去重(按 name+desc),保序
    seen = set()
    main_fields = []
    for b in main_blocks:
        s = parse_column(b)
        key = (s['name'], s['desc'])
        if key in seen:
            continue
        seen.add(key)
        main_fields.append(s)

    return {
        'header': header,
        'main_fields': main_fields,
        'total_count': all_count,
        'skipped_count': max(0, all_count - len(main_fields)),
    }
