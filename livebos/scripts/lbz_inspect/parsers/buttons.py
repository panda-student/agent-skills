# -*- coding: utf-8 -*-
"""按钮解析:对象/视图 XML 的 <display-options><commands> → 按钮清单。"""
import re
from ..text_utils import strip_tags


def parse_commands(data):
    """文本内全部 <display-options><commands> 按钮 → [ {type, desc, items, is_default} ]。

    页面按钮(新增/修改/删除/导入/导出/批量删除/维护流程入口)只配置在这里,
    不在 .lbz 流程文件里;type=2 为内置命令, type=5 为流程/方法调用。
    """
    out = []
    patt = re.compile(
        r'<command type="(\d+)">\s*<describe>(.*?)</describe>(.*?)</command>', re.S)
    for m in patt.finditer(data):
        body = m.group(3)
        items = [x.strip() for x in re.findall(r'<item>(.*?)</item>', body, re.S)]
        d = re.search(r'<is-default>(.*?)</is-default>', body, re.S)
        out.append({
            'type': m.group(1),
            'desc': strip_tags(m.group(2)),
            'items': items,
            'is_default': d.group(1).strip() if d else '',
        })
    return out
