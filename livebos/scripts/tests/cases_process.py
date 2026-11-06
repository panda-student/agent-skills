# -*- coding: utf-8 -*-
"""业务流程域用例:steps <lbz>(copy 变量拷贝/if-else 分支/forEach+SQL)。覆盖 process_steps/invokes/sqls。"""

CASES = [
    ('copy_and_sql', ['steps', '1整体管理/流程表单/项目效益收集/WO_QT04009_AddBackM.lbz']),
    ('if_else', ['steps', '1整体管理/流程表单/项目效益收集/WO_QT04009_UILOGIC.lbz']),
    ('foreach_sql', ['steps', '1整体管理/流程表单/项目效益收集/PM_ImportTest_M.lbz']),
]
