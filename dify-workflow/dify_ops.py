# -*- coding: utf-8 -*-
"""
Dify DSL 操作工具集
用法: python dify_ops.py <命令> [参数]

命令:
  read-template <yml_path> <node_id>              读取模板内容
  update-template <yml_path> <node_id> <content>   更新模板内容(内容从stdin读取)
  list-nodes <yml_path>                            列出所有节点
  add-edge <yml_path> <src_id> <tgt_id>            添加边
  remove-node <yml_path> <node_id>                 删除节点及其关联边
  verify-template <yml_path> <node_id> <test_json> 验证模板渲染
  render <yml_path> <node_id> <test_json>          渲染模板并输出
"""
import sys
import json
from ruamel.yaml import YAML
from ruamel.yaml.scalarstring import LiteralScalarString
import jinja2


def create_yaml():
    yaml = YAML()
    yaml.preserve_quotes = True
    yaml.width = 4096
    return yaml


def load_yaml(path):
    yaml = create_yaml()
    with open(path, 'r', encoding='utf-8') as f:
        return yaml.load(f)


def save_yaml(path, data):
    yaml = create_yaml()
    with open(path, 'w', encoding='utf-8') as f:
        yaml.dump(data, f)


def find_node(data, node_id):
    for node in data['workflow']['graph']['nodes']:
        if node['id'] == node_id:
            return node
    return None


def cmd_read_template(yml_path, node_id):
    data = load_yaml(yml_path)
    node = find_node(data, node_id)
    if not node:
        print(f"Node {node_id} not found", file=sys.stderr)
        sys.exit(1)
    if node['data'].get('type') != 'template-transform':
        print(f"Node {node_id} is not template-transform", file=sys.stderr)
        sys.exit(1)
    print(node['data']['template'])


def cmd_update_template(yml_path, node_id):
    content = sys.stdin.read()
    data = load_yaml(yml_path)
    node = find_node(data, node_id)
    if not node:
        print(f"Node {node_id} not found", file=sys.stderr)
        sys.exit(1)
    node['data']['template'] = LiteralScalarString(content)
    save_yaml(yml_path, data)
    print(f"Updated template in node {node_id}")


def cmd_list_nodes(yml_path):
    data = load_yaml(yml_path)
    for node in data['workflow']['graph']['nodes']:
        ntype = node['data'].get('type', 'unknown')
        title = node['data'].get('title', '')
        nid = node['id']
        extra = ''
        if ntype == 'template-transform':
            t = node['data'].get('template', '')
            extra = f' template_len={len(t)}'
        elif ntype == 'code':
            c = node['data'].get('code', '')
            extra = f' code_len={len(c)}'
        elif ntype == 'llm':
            extra = f' model={node["data"].get("model", {}).get("name", "?")}'
        print(f"  {nid}  {ntype:20s}  {title}{extra}")


def cmd_add_edge(yml_path, src_id, tgt_id):
    data = load_yaml(yml_path)
    src_node = find_node(data, src_id)
    tgt_node = find_node(data, tgt_id)
    if not src_node:
        print(f"Source node {src_id} not found", file=sys.stderr)
        sys.exit(1)
    if not tgt_node:
        print(f"Target node {tgt_id} not found", file=sys.stderr)
        sys.exit(1)
    src_type = src_node['data'].get('type', '')
    tgt_type = tgt_node['data'].get('type', '')
    edge = {
        'data': {
            'isInIteration': False,
            'isInLoop': False,
            'sourceType': src_type,
            'targetType': tgt_type,
        },
        'id': f'{src_id}-source-{tgt_id}-target',
        'selected': False,
        'source': src_id,
        'sourceHandle': 'source',
        'target': tgt_id,
        'targetHandle': 'target',
        'type': 'custom',
        'zIndex': 0,
    }
    data['workflow']['graph']['edges'].append(edge)
    save_yaml(yml_path, data)
    print(f"Added edge: {src_id} -> {tgt_id}")


def cmd_remove_node(yml_path, node_id):
    data = load_yaml(yml_path)
    nodes = data['workflow']['graph']['nodes']
    edges = data['workflow']['graph']['edges']
    original_len = len(nodes)
    data['workflow']['graph']['nodes'] = [n for n in nodes if n['id'] != node_id]
    if len(data['workflow']['graph']['nodes']) == original_len:
        print(f"Node {node_id} not found", file=sys.stderr)
        sys.exit(1)
    edge_count = len(edges)
    data['workflow']['graph']['edges'] = [
        e for e in edges
        if e.get('source') != node_id and e.get('target') != node_id
    ]
    removed_edges = edge_count - len(data['workflow']['graph']['edges'])
    save_yaml(yml_path, data)
    print(f"Removed node {node_id} and {removed_edges} associated edges")


def _load_test_data(test_json):
    if test_json.startswith('@'):
        with open(test_json[1:], 'r', encoding='utf-8') as f:
            return json.load(f)
    return json.loads(test_json)


def cmd_verify_template(yml_path, node_id, test_json):
    test_data = _load_test_data(test_json)
    data = load_yaml(yml_path)
    node = find_node(data, node_id)
    if not node:
        print(f"Node {node_id} not found", file=sys.stderr)
        sys.exit(1)
    template_str = node['data'].get('template', '')
    env = jinja2.Environment(undefined=jinja2.Undefined)
    t = env.from_string(template_str)
    rendered = t.render(**test_data)
    if 'expected' in test_data:
        match = rendered == test_data['expected']
        print(f"Result: {'MATCH' if match else 'MISMATCH'}")
        if not match:
            print(f"  Rendered length: {len(rendered)}")
            print(f"  Expected length: {len(test_data['expected'])}")
            for i, (c1, c2) in enumerate(zip(rendered, test_data['expected'])):
                if c1 != c2:
                    print(f"  First diff at pos {i}: rendered={repr(c1)}, expected={repr(c2)}")
                    break
        sys.exit(0 if match else 1)
    else:
        print(rendered)


def cmd_render(yml_path, node_id, test_json):
    test_data = _load_test_data(test_json)
    data = load_yaml(yml_path)
    node = find_node(data, node_id)
    if not node:
        print(f"Node {node_id} not found", file=sys.stderr)
        sys.exit(1)
    template_str = node['data'].get('template', '')
    env = jinja2.Environment(undefined=jinja2.Undefined)
    t = env.from_string(template_str)
    print(t.render(**test_data))


COMMANDS = {
    'read-template': (cmd_read_template, 2, '<yml_path> <node_id>'),
    'update-template': (cmd_update_template, 2, '<yml_path> <node_id> (content from stdin)'),
    'list-nodes': (cmd_list_nodes, 1, '<yml_path>'),
    'add-edge': (cmd_add_edge, 3, '<yml_path> <src_id> <tgt_id>'),
    'remove-node': (cmd_remove_node, 2, '<yml_path> <node_id>'),
    'verify-template': (cmd_verify_template, 3, '<yml_path> <node_id> <test_json>'),
    'render': (cmd_render, 3, '<yml_path> <node_id> <test_json>'),
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        print("\nAvailable commands:")
        for name, (_, argc, usage) in COMMANDS.items():
            print(f"  {name} {usage}")
        sys.exit(1)

    cmd_name = sys.argv[1]
    func, argc, _ = COMMANDS[cmd_name]
    args = sys.argv[2:]
    if len(args) < argc:
        print(f"Usage: dify_ops.py {cmd_name} {COMMANDS[cmd_name][2]}", file=sys.stderr)
        sys.exit(1)
    func(*args[:argc])


if __name__ == '__main__':
    main()
