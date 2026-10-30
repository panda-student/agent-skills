# -*- coding: utf-8 -*-
"""调度职责:整体编排——定位文件 → 读出文本 → 解析 → 渲染 → 打印。

每个命令函数对应一个 CLI 子命令,只做组合与输出,不含解析/渲染/定位细节。
本模块是包内唯一做 print 的地方。
"""
import os
from collections import OrderedDict
from . import readers
from . import locators
from . import parsers
from . import renderers


def fields(target, compact=False):
    files = locators.find_files(target)
    if not files:
        print('[未找到]', target)
        return
    for f in files:
        if not f.lower().endswith('.xml'):
            continue
        data = readers.read(f)
        result = parsers.parse_fields(data)
        print('=' * 70)
        print('FILE:', os.path.relpath(f, locators.ROOT))
        for ln in renderers.render_fields(result, compact=compact):
            print(ln)
        print()


def steps(target):
    files = locators.find_files(target)
    if not files:
        print('[未找到]', target)
        return
    for f in files:
        data = readers.read(f)
        header = parsers.parse_process_header(data)
        if header['tag'] not in ('process', 'workflow'):
            continue
        print('=' * 70)
        print('FILE:', os.path.relpath(f, locators.ROOT))
        if header['header']:
            print(header['header'])
        if header['describe']:
            print('描述:', header['describe'])
        print('-' * 70)
        if header['tag'] == 'workflow':
            wf = parsers.parse_workflow_def(data)
            for ln in renderers.render_workflow_def(wf):
                print(ln)
        else:
            nodes = parsers.parse_process_steps(data)
            for ln in renderers.render_process_nodes(nodes):
                print(ln)
        print()


def formulas(target):
    files = locators.find_files(target)
    if not files:
        print('[未找到]', target)
        return
    all_formulas = []
    for f in files:
        data = readers.read(f)
        for e in parsers.parse_formulas(data):
            if e not in all_formulas:
                all_formulas.append(e)
    print('=' * 70)
    for ln in renderers.render_formulas(all_formulas):
        print(ln)


def refs(field, limit=40):
    """跨工作区搜 <name>字段</name>,按对象聚合后渲染。"""
    patt = '<name>%s</name>' % field
    by_obj = OrderedDict()
    total_files = 0
    for f in locators.iter_workspace_files():
        data = readers.read(f)
        if patt not in data:
            continue
        total_files += 1
        obj = locators.extract_object_name(data) or os.path.basename(f)
        rel = os.path.relpath(f, locators.ROOT)
        by_obj.setdefault(obj, []).append(rel)

    items = sorted(by_obj.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    shown = items[:limit]
    truncated = len(items) - limit
    for ln in renderers.render_refs(field, shown, total_files, limit, max(0, truncated)):
        print(ln)


def locate(target):
    items = locators.locate(target)
    if not items:
        print('[未找到] 对象/片段:', target)
        return
    for ln in renderers.render_locate(items):
        print(ln)


def view(target):
    """视图对象的父继承 / 筛选与权限条件 / 属性 / 展示列。"""
    files = locators.find_files(target)
    if not files:
        print('[未找到]', target)
        return
    shown = False
    for f in files:
        result = parsers.parse_view(readers.read(f))
        if result is None:
            continue
        shown = True
        print('=' * 70)
        print('FILE:', os.path.relpath(f, locators.ROOT))
        for ln in renderers.render_view(result):
            print(ln)
        print()
    if not shown:
        print('[未找到视图特征(<parent>/<condition>),目标可能不是视图]', target)


def _scan_dir_commands(d):
    """目录内全部 XML 的按钮配置 → [(rel_path, 文件名, cmds), ...](只含有按钮的文件)。"""
    out = []
    for f in locators.list_dir(d, '*.xml'):
        cmds = parsers.parse_commands(readers.read(f))
        if cmds:
            out.append((os.path.relpath(f, locators.ROOT), os.path.basename(f), cmds))
    return out


def buttons(target):
    """对象/路径所在目录(一个目录=一个页面/模块)内全部 XML 的按钮清单。"""
    d = locators.resolve_dir(target)
    if d is None:
        print('[未找到]', target)
        return
    found = _scan_dir_commands(d)
    if not found:
        print('[该目录无任何 <commands> 按钮配置]', os.path.relpath(d, locators.ROOT))
        return
    for rel, _, cmds in found:
        print('=' * 70)
        print('FILE:', rel)
        for ln in renderers.render_commands(cmds):
            print(ln)
        print()


def overview(target, compact=False):
    files = locators.find_files(target)
    if not files:
        print('[未找到]', target)
        return
    main = files[0]
    print('################## 对象定义 ##################')
    fields(main, compact=compact)
    # 同目录关联流程
    d = os.path.dirname(main)
    base = os.path.splitext(os.path.basename(main))[0]
    related = locators.list_dir(d, base + '*.lbz')
    if related:
        print('################## 关联流程 ##################')
        for r in related:
            print('  [%s] %s' % (locators.flow_kind(os.path.basename(r)),
                                 os.path.relpath(r, locators.ROOT)))
    # 同目录页面按钮(对象+视图+报表 VO)
    btn = _scan_dir_commands(d)
    if btn:
        print('################## 页面按钮 ##################')
        for ln in renderers.render_commands_summary(btn):
            print(ln)


# 命令名 → 函数 的映射,供 cli 使用
COMMANDS = {
    'fields': fields,
    'steps': steps,
    'formulas': formulas,
    'refs': refs,
    'locate': locate,
    'view': view,
    'overview': overview,
    'buttons': buttons,
}
