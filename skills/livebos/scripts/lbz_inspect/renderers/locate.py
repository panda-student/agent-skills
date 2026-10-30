# -*- coding: utf-8 -*-
"""locate 渲染:文件定位结果 → 文本。"""


def render_locate(items):
    """locate 结果 → 文本行列表。items: [(rel_path, obj_name, package), ...]。"""
    lines = []
    for path, obj_name, pkg in items:
        tag = '%s %s' % (obj_name, pkg) if (obj_name or pkg) else ''
        lines.append('%-60s  %s' % (path, tag))
    return lines
