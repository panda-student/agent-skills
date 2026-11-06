# -*- coding: utf-8 -*-
"""审批流程定义解析:<workflow> 的步骤/动态办理人/流转规则/业务挂接/节点字段权限。"""
import re
import xml.etree.ElementTree as ET

from ..text_utils import compact_expr


def _hooks(block):
    """pre/post-functions 里的业务流程挂接(processName 优先,函数名兜底)。"""
    out = []
    for fm in re.finditer(r'<function\b[^>]*name="([^"]+)"[^>]*>(.*?)</function>', block, re.S):
        pm = re.search(r'<arg name="processName">([^<]+)</arg>', fm.group(2))
        out.append(pm.group(1).strip() if pm else fm.group(1))
    return out


def _section_hooks(block, section):
    m = re.search(r'<%s>(.*?)</%s>' % (section, section), block, re.S)
    return _hooks(m.group(1)) if m else []


def _transitions(block):
    """action → unconditional-result 的流转规则(动作: 旧状态→新状态→步骤N)。"""
    out = []
    for am in re.finditer(r'<action\b[^>]*name="([^"]+)"[^>]*>(.*?)</action>', block, re.S):
        aname, abody = am.group(1), am.group(2)
        um = re.search(r'<unconditional-result\b([^>]*)>', abody)
        if um:
            attrs = um.group(1)

            def attr(k):
                km = re.search(r'%s="([^"]*)"' % k, attrs)
                return km.group(1) if km else '?'
            out.append('%s: %s→%s→步骤%s' % (aname, attr('old-status'), attr('status'), attr('step')))
        else:
            out.append(aname)
    return out


def _dyn_owners(block):
    """dynOwner 动态办理人规则(describe + CDATA 表达式)。"""
    out = []
    for dm in re.finditer(r'<dynOwner\b[^>]*>(.*?)</dynOwner>', block, re.S):
        attrs = dm.group(0)[:dm.group(0).find('>')]
        dm_desc = re.search(r'describe="([^"]*)"', attrs)
        em = re.search(r'<expression>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))</expression>', dm.group(1), re.S)
        expr = (em.group(1) or em.group(2) or '').strip() if em else ''
        out.append({
            'describe': dm_desc.group(1) if dm_desc else '',
            'expr': compact_expr(expr),
        })
    return out


def _strip_decl(text):
    """去掉 XML 声明(GB2312/GBK 等多字节声明 ET 不支持,统一按 UTF-8 重编码解析)。"""
    return re.sub(r'<\?xml[^>]*\?>', '', text, count=1)


def _columns_of(obj_el):
    """object 元素 → {editable/locked/hidden 列名列表};子表 object 递归为嵌套 dict。"""
    info = {'editable': [], 'locked': [], 'hidden': [], 'sub': {}}
    cols = obj_el.find('columns')
    if cols is None:
        return info
    for col in cols:
        if col.tag != 'column':
            continue
        name = col.get('name') or '?'
        hidden = col.get('hidden') == 'true'
        disabled = col.get('disabled') == 'true'
        if hidden:
            info['hidden'].append(name)
        elif disabled:
            info['locked'].append(name)
        else:
            info['editable'].append(name)
        sub = col.find('object')
        if sub is not None:
            sub_name = sub.get('name') or '?'
            sub_info = _columns_of(sub)
            sub_info['edit_attribute'] = sub.get('editAttribute') or ''
            info['sub'][sub_name] = sub_info
    return info


def _node_fields(data):
    """step 内嵌 <object><columns> → 节点字段三态配置。

    返回 {step_name: [{'object': 主对象名, **三态列表, 'sub': {子表名: 三态}}]},
    解析失败返回 None(渲染层给出警告,不静默吞掉)。
    """
    try:
        root = ET.fromstring(_strip_decl(data).encode('utf-8'))
    except Exception as ex:  # noqa: BLE001 - 解析异常显式上抛给渲染层提示
        return {'__error__': str(ex)}
    result = {}
    for steps in root.iter():
        if steps.tag != 'steps':
            continue
        for step in steps:
            if step.tag != 'step':
                continue
            sname = step.get('name') or '?'
            items = []
            for obj in step:
                if obj.tag == 'object':
                    items.append({'object': obj.get('name') or '?',
                                  'edit_attribute': obj.get('editAttribute') or '',
                                  **_columns_of(obj)})
            if items:
                result[sname] = items
    return result


def parse_workflow_def(data):
    """<workflow> 文本 → {steps: [...], initial: {pre, transitions}, node_fields}。

    step: {name, finish, pre, post, dyn_owners, transitions}
    node_fields: 按步骤名聚合的节点字段三态配置(可编辑/锁定可见/隐藏),解析失败含 __error__。
    """
    steps = []
    for sm in re.finditer(r'<step\b[^>]*name="([^"]+)"[^>]*>(.*?)</step>', data, re.S):
        sname, sbody = sm.group(1), sm.group(2)
        steps.append({
            'name': sname,
            'finish': bool(re.search(r'<meta name="finish">true</meta>', sbody)),
            'pre': _section_hooks(sbody, 'pre-functions'),
            'post': _section_hooks(sbody, 'post-functions'),
            'dyn_owners': _dyn_owners(sbody),
            'transitions': _transitions(sbody),
        })
    init_m = re.search(r'<initial-actions>(.*?)</initial-actions>', data, re.S)
    init_body = init_m.group(1) if init_m else ''
    return {
        'steps': steps,
        'initial': {
            'pre': _hooks(init_body),
            'transitions': _transitions(init_body),
        },
        'node_fields': _node_fields(data),
    }
