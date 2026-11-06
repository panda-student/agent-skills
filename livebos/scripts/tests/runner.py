# -*- coding: utf-8 -*-
"""回归调度职责:执行用例命令、与黄金快照比对、输出报告。

用例数据在各 cases_* 模块,fixture 工作区在 ../tests_fixture,
快照在本目录 baseline/<模块>/<用例>.txt。不做参数解析(入口 regression.py 负责)。
"""
import difflib
import os
import subprocess
import sys

from . import (cases_fields, cases_buttons, cases_views, cases_process,
               cases_workflow, cases_locate, cases_overview)

# 模块名 → 用例清单;模块名与解析职责一一对应,改哪跑哪
MODULES = [
    ('fields', cases_fields.CASES),
    ('buttons', cases_buttons.CASES),
    ('views', cases_views.CASES),
    ('process', cases_process.CASES),
    ('workflow', cases_workflow.CASES),
    ('locate', cases_locate.CASES),
    ('overview', cases_overview.CASES),
]

_SCRIPTS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURE = os.path.join(_SCRIPTS_DIR, 'tests_fixture')
BASELINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'baseline')


def run_case(args):
    """跑一条 CLI 命令 → 标准输出文本(含 stderr,统一 \n)。"""
    env = dict(os.environ)
    env['PYTHONIOENCODING'] = 'utf-8'
    env['PYTHONPATH'] = _SCRIPTS_DIR
    env['LBZ_WORKSPACE'] = FIXTURE
    p = subprocess.run([sys.executable, '-m', 'lbz_inspect'] + list(args),
                       capture_output=True, env=env, cwd=_SCRIPTS_DIR)
    out = p.stdout.decode('utf-8', errors='replace').replace('\r\n', '\n')
    err = p.stderr.decode('utf-8', errors='replace').replace('\r\n', '\n')
    if err.strip():
        out += '[STDERR]\n' + err
    return out


def _snapshot(module, name):
    return os.path.join(BASELINE, module, name + '.txt')


def write_baseline(mods):
    """生成/刷新快照。mods: [(模块名, 用例清单), ...]"""
    n = 0
    for module, cases in mods:
        os.makedirs(os.path.join(BASELINE, module), exist_ok=True)
        for name, args in cases:
            with open(_snapshot(module, name), 'w', encoding='utf-8', newline='\n') as f:
                f.write(run_case(args))
            n += 1
    print('baseline 已写入 %d 个用例 → %s' % (n, BASELINE))


def check(mods):
    """比对快照,打印报告。返回退出码(0=全过)。"""
    failed = []
    total = 0
    for module, cases in mods:
        for name, args in cases:
            total += 1
            snap = _snapshot(module, name)
            if not os.path.exists(snap):
                print('FAIL %-9s %-14s (快照缺失,先跑 baseline)' % (module, name))
                failed.append((module, name))
                continue
            expect = open(snap, encoding='utf-8').read().replace('\r\n', '\n')
            actual = run_case(args)
            if actual == expect:
                print('PASS %-9s %s' % (module, name))
            else:
                print('FAIL %-9s %s' % (module, name))
                _show_diff(expect, actual)
                failed.append((module, name))
    print('-' * 60)
    print('%d/%d 通过' % (total - len(failed), total))
    if failed:
        print('失败:', ', '.join('%s/%s' % f for f in failed))
    return 0 if not failed else 1


def _show_diff(expect, actual, max_lines=15):
    diff = list(difflib.unified_diff(
        expect.splitlines(), actual.splitlines(),
        fromfile='baseline', tofile='actual', lineterm=''))
    for ln in diff[:max_lines]:
        print('    ' + ln)
    if len(diff) > max_lines:
        print('    ... (共 %d 行差异)' % len(diff))
