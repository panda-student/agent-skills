# -*- coding: utf-8 -*-
"""SQL 语句提取:<arg name="SQL"> 参数解包 + 文本内联 SQL 扫描。"""
import re
import html


def extract_sql(invoke_block):
    """从 <invoke> 块的 SQL 参数提取语句(JSON 数组首元素)。无则返回 ''。"""
    m = re.search(r'<arg name="SQL">(.*?)</arg>', invoke_block, re.S)
    if not m:
        return ''
    raw = html.unescape(m.group(1))
    sm = re.match(r'\s*\["(.*?)",\s*\[', raw, re.S)
    if sm:
        sql = sm.group(1)
    else:
        sm2 = re.match(r'\s*\["(.*?)"\s*\]', raw, re.S)
        sql = sm2.group(1) if sm2 else raw
    sql = sql.replace('\\r', ' ').replace('\\n', ' ')
    return re.sub(r'\s+', ' ', sql).strip()


def scan_inline_sql(data):
    """扫描文本内联 SQL 片段(ABS_SQLVALUE(...) / select ... from ...)→ [raw, ...]。"""
    return [m.group(1) for m in re.finditer(
        r'(ABS_SQLVALUE\([^)]+\)|select\s+.*?from\s+\S+)', data, re.S | re.I)]
