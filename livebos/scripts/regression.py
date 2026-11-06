# -*- coding: utf-8 -*-
"""回归测试入口:python regression.py {check,baseline} [模块 ...]

模块对应解析职责,改哪跑哪:
  python regression.py check                 # 全量回归
  python regression.py check fields          # 只跑字段域(改 parsers/fields.py 后)
  python regression.py baseline views        # views 输出有意变更后刷新快照

可用模块:fields / buttons / views / process / workflow / locate / overview
"""
import argparse
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tests import runner  # noqa: E402


def main():
    ap = argparse.ArgumentParser(
        description='lbz_inspect 回归测试(快照对拍)',
        epilog='模块: ' + ' / '.join(m for m, _ in runner.MODULES))
    ap.add_argument('mode', choices=['check', 'baseline'],
                    help='check=比对快照;baseline=生成/刷新快照')
    ap.add_argument('modules', nargs='*',
                    help='只跑指定用例模块(缺省全量)')
    a = ap.parse_args()

    known = dict(runner.MODULES)
    unknown = [x for x in a.modules if x not in known]
    if unknown:
        print('未知模块:', ', '.join(unknown))
        return 2
    mods = [(m, known[m]) for m in known if not a.modules or m in a.modules]
    if not mods:
        print('没有匹配的用例模块')
        return 2
    if a.mode == 'baseline':
        runner.write_baseline(mods)
        return 0
    return runner.check(mods)


if __name__ == '__main__':
    sys.exit(main())
