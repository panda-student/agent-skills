# -*- coding: utf-8 -*-
"""refs 渲染:字段跨对象引用聚合 → 文本。"""


def render_refs(field, grouped_items, total_files, limit, truncated_count):
    """refs 聚合结果 → 文本行列表。

    grouped_items: [(obj_name, [file_paths...]), ...] 已排序。
    """
    total_objs = len(grouped_items) + truncated_count
    lines = ['字段 [%s] 出现在 %d 个文件,聚合为 %d 个对象:' % (
        field, total_files, total_objs)]
    for obj, files in grouped_items:
        main_f = min(files, key=len)
        extras = len(files) - 1
        suffix = ('  (+%d 副本)' % extras) if extras else ''
        lines.append('  %-30s %s%s' % (obj, main_f, suffix))
    if truncated_count:
        lines.append('  ... (还有 %d 个对象未显示,共 %d 个对象)' % (
            truncated_count, total_objs))
    return lines
