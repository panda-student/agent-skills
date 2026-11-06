# -*- coding: utf-8 -*-
"""文件定位职责:工作区根管理、对象名/路径/片段 → 文件、目录/工作区枚举、
文件名语义(流程类型)与对象名元信息。

本模块回答"文件在哪、叫什么",内容解码交给 readers。
"""
import os
import re
import glob
from .readers import read

# 工作区根。从环境变量 LBZ_WORKSPACE 读取(自包含技能不依赖文件位置);
# 命令行 -r/--root 可覆盖。若都未设置,默认上级目录(便于开发调试)。
ROOT = os.environ.get('LBZ_WORKSPACE') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def set_root(path):
    """设置工作区根目录。"""
    global ROOT
    ROOT = os.path.abspath(path)


def find_files(name_or_path):
    """把输入解析成有序文件列表。

    支持三种输入:
      - 绝对/相对路径(存在则直接返回)
      - 对象名(精确匹配 name.xml 优先)
      - 文件名片段(全工作区 glob)

    排序键:精确名 > 以名字开头 > 布局/UI/Param 文件降权 > 字母序。
    """
    if os.path.isfile(name_or_path):
        return [name_or_path]
    p = name_or_path if os.path.isabs(name_or_path) else os.path.join(ROOT, name_or_path)
    if os.path.isfile(p):
        return [p]
    # 当作对象名/片段,全工作区搜
    patt = os.path.join(ROOT, '**', '*%s*' % name_or_path)
    hits = [f for f in glob.glob(patt, recursive=True)
            if f.lower().endswith(('.xml', '.lbz')) and os.path.isfile(f)]
    nl = name_or_path.lower()

    def sort_key(f):
        b = os.path.basename(f).lower()
        exact = 0 if b == nl + '.xml' else 1
        startswith = 0 if b.startswith(nl) else 1
        is_aux = 1 if re.search(r'(_layout|\.layout|_param|_ui)\.', b) else 0
        return (exact, startswith, is_aux, b)

    hits.sort(key=sort_key)
    head = [f for f in hits if os.path.basename(f).lower().startswith(nl)]
    return head or hits


def locate(name):
    """返回 [(rel_path, object_name, package)] 列表,不打印。"""
    hits = find_files(name)
    out = []
    for f in hits:
        data = read(f)
        m = re.search(r'<(object|dataset|process)\b[^>]*>', data)
        obj_name, pkg = '', ''
        if m:
            attrs = m.group(0)
            n = re.search(r'name="([^"]+)"', attrs)
            p = re.search(r'package="([^"]+)"', attrs)
            obj_name = n.group(1) if n else ''
            pkg = p.group(1) if p else ''
        out.append((os.path.relpath(f, ROOT), obj_name, pkg))
    return out


def extract_object_name(data):
    """从文件内容提取 <object name="..."> 对象名(仅 object 标签)。无则返回 ''。

    与 locate() 的宽口径(object|dataset|process)不同,此为 refs 聚合口径。
    """
    m = re.search(r'<object[^>]*name="([^"]+)"', data)
    return m.group(1) if m else ''


def flow_kind(filename):
    """文件名 → 流程类型标签(LiveBOS 命名约定:增/改/删/初始化/其他)。"""
    if '_Add' in filename:
        return '增'
    if '_Update' in filename:
        return '改'
    if '_Del' in filename:
        return '删'
    if 'Init' in filename or 'Spr' in filename or '_M' in filename:
        return '初始化'
    return '其他'


def resolve_dir(target):
    """目标(路径或对象名)→ 所在目录。定位失败返回 None。

    路径是目录直接用;否则取 find_files 首个命中文件的所在目录。
    """
    p = target if os.path.isabs(target) else os.path.join(ROOT, target)
    if os.path.isdir(p):
        return p
    files = find_files(target)
    if not files:
        return None
    return os.path.dirname(files[0])


def list_dir(d, pattern):
    """目录内匹配 glob 模式的文件列表(排序)。"""
    return sorted(glob.glob(os.path.join(d, pattern)))


def iter_workspace_files():
    """遍历工作区全部 .xml/.lbz 文件(全工作区 glob)。"""
    for f in glob.glob(os.path.join(ROOT, '**', '*'), recursive=True):
        if f.lower().endswith(('.xml', '.lbz')) and os.path.isfile(f):
            yield f
