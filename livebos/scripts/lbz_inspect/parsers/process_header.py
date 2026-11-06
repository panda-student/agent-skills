# -*- coding: utf-8 -*-
"""流程文件头解析:类型识别(process/workflow)+ 描述。"""
import re
from ..text_utils import strip_tags


def parse_process_header(data):
    """流程文件头 → {tag, header, describe}。tag ∈ {'process','workflow',''}。"""
    m = re.search(r'<(process|workflow)\b[^>]*>', data)
    if not m:
        return {'tag': '', 'header': '', 'describe': ''}
    desc_m = re.search(r'<describe>(.*?)</describe>', data, re.S)
    return {
        'tag': m.group(1),
        'header': m.group(0),
        'describe': strip_tags(desc_m.group(1)) if desc_m else '',
    }
