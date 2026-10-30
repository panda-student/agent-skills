# -*- coding: utf-8 -*-
"""CLI 入口:argparse 解析 + 分发到 commands。

职责单一:只做参数解析和命令路由,不含业务逻辑。
"""
import argparse
from . import locators
from .dispatcher import COMMANDS


def build_parser():
    ap = argparse.ArgumentParser(
        description='LiveBOS 对象/流程提取工具',
        epilog='示例: python -m lbz_inspect overview T_BenfitM')
    ap.add_argument('cmd', choices=list(COMMANDS.keys()))
    ap.add_argument('target', help='对象名/文件路径/字段名')
    ap.add_argument('-r', '--root', help='工作区根目录(默认脚本上级目录)')
    ap.add_argument('--compact', action='store_true',
                    help='紧凑模式:fields/overview 折叠长公式(只显示首行)')
    return ap


def main(argv=None):
    a = build_parser().parse_args(argv)
    if a.root:
        locators.set_root(a.root)
    cmd = COMMANDS[a.cmd]
    # 只有 fields/overview 接受 compact 参数
    if a.cmd in ('fields', 'overview'):
        cmd(a.target, compact=a.compact)
    else:
        cmd(a.target)


if __name__ == '__main__':
    main()
