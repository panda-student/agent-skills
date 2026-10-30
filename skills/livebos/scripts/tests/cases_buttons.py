# -*- coding: utf-8 -*-
"""按钮域用例:buttons 命令(对象定位目录/目录入参/仅 VO 有按钮的目录)。覆盖 parsers+renderers 的 buttons 与 locators.resolve_dir。"""

CASES = [
    ('by_object', ['buttons', 'T_Spring']),
    ('by_dir_flow', ['buttons', '1整体管理/流程表单/项目效益收集']),
    ('by_dir_ledger', ['buttons', '效益分析/项目效益台账']),
]
