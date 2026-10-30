# -*- coding: utf-8 -*-
"""文本清洗工具:去标签、压空白、解码实体。

被 parsers(预处理表达式)和 renderers(格式化输出)共用,
独立成模块避免相互依赖。
"""
import re
import html
from xml.sax.saxutils import unescape


def strip_tags(s):
    """去标签、解码实体、压空白成单行。用于 describe 等短文本。"""
    s = re.sub(r'<[^>]+>', ' ', s)
    s = html.unescape(unescape(s, {'&#xD;': '', '&#xA;': ' '}))
    s = re.sub(r'<%@[^%]*%>', '', s)          # 去 livebos jsp 标记
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def compact_expr(s):
    """压空白但保留换行。用于公式(需要多行可读)。"""
    s = re.sub(r'<%@[^%]*%>', '', s)
    s = html.unescape(unescape(s, {'&#xD;': '\n', '&#xA;': '\n'}))
    s = re.sub(r'\r', '', s)
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n[ \t]+', '\n', s)
    return s.strip()
