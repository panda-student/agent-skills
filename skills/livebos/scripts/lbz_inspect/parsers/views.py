# -*- coding: utf-8 -*-
"""视图解析:V_*/VO_* 等视图对象的父继承、筛选/权限条件、属性、展示列。

视图逻辑分布:
  <parent>      - 宿主对象(视图挂在谁身上)
  <condition>   - JSON:{"args":[{expression...}],"statement":"SQL 片段,{N} 占位"}
                  筛选条件 + 权限过滤 + parameter.* 二次筛选参数全在这里
  <properties>  - 视图属性(name=73 推断为默认排序字段,63=true)
  <columns>     - 展示列清单(列顺序有意义,不去重)
"""
import re
import html
from ..text_utils import strip_tags


def _clean_statement(raw):
    """statement 片段:解码实体、还原 \\r\\n 转义、压首尾空白。"""
    s = html.unescape(raw)
    s = s.replace('\\r\\n', '\n').replace('\\n', '\n').replace('\\r', '\n')
    lines = [ln.strip() for ln in s.split('\n')]
    return '\n'.join(ln for ln in lines if ln)


def parse_conditions(data):
    """全部 <condition> 块 → [ {args: [表达式...], statement: str} ]。"""
    out = []
    for m in re.finditer(r'<condition[^>]*>(.*?)</condition>', data, re.S):
        body = m.group(1)
        args = re.findall(r'"expression"\s*:\s*"(.*?)"', body)
        sm = re.search(r'"statement"\s*:\s*"(.*?)"\s*,\s*"type"', body, re.S)
        out.append({
            'args': args,
            'statement': _clean_statement(sm.group(1)) if sm else strip_tags(body)[:200],
        })
    return out


def parse_properties(data):
    """<properties> → [(name, [value, ...]), ...](保序;一个 property 可有多个 value)。"""
    out = []
    for m in re.finditer(r'<property>\s*<name>(\d+)</name>(.*?)</property>', data, re.S):
        values = [v.strip() for v in re.findall(r'<value>(.*?)</value>', m.group(2), re.S)]
        out.append((m.group(1), values))
    return out


def parse_view(data):
    """视图 XML 文本 → {parent, conditions, properties, columns}。

    非视图文件(无 parent 且无 condition)返回 None。
    """
    parent_m = re.search(r'<parent>(.*?)</parent>', data, re.S)
    conditions = parse_conditions(data)
    if not parent_m and not conditions:
        return None
    top = re.search(r'<columns>(.*?)</columns>', data, re.S)
    body = top.group(1) if top else data
    columns = [c.strip() for c in re.findall(r'<column[^>]*>\s*<name>(.*?)</name>', body, re.S)]
    return {
        'parent': parent_m.group(1).strip() if parent_m else '',
        'conditions': conditions,
        'properties': parse_properties(data),
        'columns': columns,
    }
