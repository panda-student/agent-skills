# -*- coding: utf-8 -*-
"""视图域用例:view 命令(富条件报表/汇总页视图/非视图路径)。覆盖 parsers+renderers 的 views。"""

CASES = [
    ('report_rich', ['view', 'V_NoPJBenefit']),
    ('summary_page', ['view', 'QT04009_WDSQ']),
    ('not_a_view', ['view', 'T_Spring']),
]
