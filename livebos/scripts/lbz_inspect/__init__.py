# -*- coding: utf-8 -*-
"""LiveBOS 对象/流程结构提取工具包。

模块结构(单一职责拆分,一解析逻辑一模块 + 唯一调度):
  locators   - 工作区根管理、对象名/路径/片段 → 文件定位
  readers    - 文件读取、gb2312/gbk/utf-8 容错解码
  text_utils - 文本清洗(去标签、压空白、解码实体),parsers/renderers 共用
  parsers/   - 纯解析:fields/invokes/process_steps/workflow_steps/formulas/buttons
  renderers/ - 纯渲染:与 parsers 同粒度镜像拆分
  dispatcher - 唯一调度:组合 locator+reader+parser+renderer,每命令一函数
  cli        - argparse 入口与命令路由

用法:
  python -m lbz_inspect overview T_BenfitM
  python -m lbz_inspect --compact fields PM_Milestone
"""
from .cli import main

__all__ = ['main']
