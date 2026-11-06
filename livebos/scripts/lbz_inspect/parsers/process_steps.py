# -*- coding: utf-8 -*-
"""<process> 步骤树解析:if/elseif/else/forEach/sequence 分支 + invoke/response/assign/copy 节点。"""
import re
from ..text_utils import strip_tags, compact_expr
from .invokes import parse_invoke

_TOKENS = re.compile(
    r'(<(invoke|if|elseif|else|forEach|response|assign|sequence|copy)\b[^>]*>'
    r'|</(if|elseif|else|forEach|sequence|copy)>)')


def _block_cond(data, start):
    """块开标签(if/elseif)后续 <conditions> 的首个表达式,截 60 字符。"""
    seg = data[start:start + 3000]
    cut = seg.find('<sequence')
    if cut > 0:
        seg = seg[:cut]
    m = re.search(r'<arg name="expression">(.*?)</arg>', seg, re.S)
    return compact_expr(m.group(1))[:60] if m else ''


def parse_process_steps(data):
    """业务流程(<process>)文本 → 有序节点列表。

    每个节点:{type, depth, label, desc, cond?, invoke?, response?, copy?}
    type ∈ {'block_open', 'block_close', 'invoke', 'response', 'assign', 'copy'}
    block_open 对应 if/elseif/else/forEach/sequence 的开标签。
    """
    nodes = []
    depth = 0
    for m in _TOKENS.finditer(data):
        tag = m.group(2) or m.group(3)
        full = m.group(1)
        if tag in ('if', 'elseif', 'else', 'forEach', 'sequence'):
            if full.startswith('</'):
                depth = max(0, depth - 1)
                nodes.append({'type': 'block_close', 'depth': depth, 'label': tag})
                continue
            label = ''
            d = re.search(r'<describe>(.*?)</describe>', data[m.end():m.end() + 200], re.S)
            if d:
                label = strip_tags(d.group(1))
            node = {'type': 'block_open', 'depth': depth,
                    'label': tag.upper(), 'desc': label}
            if tag in ('if', 'elseif'):
                node['cond'] = _block_cond(data, m.end())
            nodes.append(node)
            depth += 1
        elif tag == 'invoke':
            block = data[m.start():m.start() + 8000]
            end = block.find('</invoke>')
            block = block[:end + len('</invoke>')] if end > 0 else block[:4000]
            nodes.append({'type': 'invoke', 'depth': depth,
                          'invoke': parse_invoke(block)})
        elif tag == 'response':
            msg_m = re.search(r'<message[^>]*>(.*?)</message>',
                              data[m.start():m.start() + 800], re.S)
            ret_m = re.search(r'<retvalue>(.*?)</retvalue>',
                              data[m.start():m.start() + 400], re.S)
            nodes.append({
                'type': 'response', 'depth': depth,
                'ret': ret_m.group(1).strip() if ret_m else '?',
                'msg': compact_expr(msg_m.group(1)) if msg_m else '',
            })
        elif tag == 'assign':
            d = re.search(r'<describe>(.*?)</describe>',
                          data[m.start():m.start() + 200], re.S)
            nodes.append({'type': 'assign', 'depth': depth,
                          'desc': strip_tags(d.group(1)) if d else ''})
        elif tag == 'copy':
            block = data[m.start():m.start() + 2000]
            end = block.find('</copy>')
            block = block[:end + len('</copy>')] if end > 0 else block
            fm = re.search(r'<from[^>]*>(.*?)</from>', block, re.S)
            tm = re.search(r'<to\b[^>]*variable="([^"]*)"', block)
            nodes.append({'type': 'copy', 'depth': depth,
                          'from': compact_expr(fm.group(1)) if fm else '',
                          'to': tm.group(1) if tm else '?'})
    return nodes
