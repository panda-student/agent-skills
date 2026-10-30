# -*- coding: utf-8 -*-
"""文件读取职责:gb2312/gbk/utf-8 容错解码,失败返回 ''。

只负责"读出文本",不做定位、不做解析。
"""


def read(path):
    """读取文件,gb2312/gbk/utf-8 容错解码,失败返回 ''。"""
    try:
        raw = open(path, 'rb').read()
    except IOError:
        return ''
    for enc in ('gb2312', 'gbk', 'utf-8'):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode('gb2312', 'ignore')
