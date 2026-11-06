# -*- coding: utf-8 -*-
"""<invoke> 组件调用结构解析:组件/操作/对象/描述/改动字段/条件。"""
import re
from ..text_utils import strip_tags, compact_expr
from .sqls import extract_sql


def parse_invoke(invoke_block):
    """<invoke> 块 → {component, operation, object, desc, fields, condition, sql}。

    fields: 改动的字段名列表(去重保序,排除 @ 开头的参数)。
    """
    def g1(patt):
        m = re.search(patt, invoke_block)
        return m.group(1).strip() if m else ''

    desc_m = re.search(r'<describe>(.*?)</describe>', invoke_block, re.S)
    cond_m = re.search(r'"@condition">([^<]+)<', invoke_block)
    fields_ch = re.findall(r'name="([A-Za-z_]\w*)"[^>]*type="expression"', invoke_block)
    fields_ch = [f for f in dict.fromkeys(fields_ch) if not f.startswith('@')]
    # FormUI changeNullable/changeState/resetOption 的目标字段是字面量型参数
    # <arg flag="field" name="X" type="">值</arg>(type 为空,上面的 expression 正则匹配不到),
    # 名单追加 X=值;type="expression" 的 field 参数(FormSetOperate/setValue 赋值)仍归上面的通用提取
    for fm in re.finditer(r'<arg flag="field" name="([A-Za-z_]\w*)"(?![^>]*type="expression")[^>]*>([^<]*)</arg>', invoke_block):
        val = fm.group(2).strip()
        item = '%s=%s' % (fm.group(1), val[:40]) if val else fm.group(1)
        if item not in fields_ch:
            fields_ch.append(item)
    return {
        'component': g1(r'component="([^"]+)"'),
        'operation': g1(r'operation="([^"]+)"'),
        'object': g1(r'"@objectName">([^<]+)<'),
        'desc': strip_tags(desc_m.group(1)) if desc_m else '',
        'fields': fields_ch,
        'condition': compact_expr(cond_m.group(1)) if cond_m else '',
        'sql': extract_sql(invoke_block),
    }
