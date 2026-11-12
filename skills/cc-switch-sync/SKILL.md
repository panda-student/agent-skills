---
name: cc-switch-sync
description: cc-switch 数据库同步工具。在修改技能名称、描述后同步更新 SQLite 数据库，确保 cc-switch 与 SKILL.md 一致。通过斜杠命令 `/cc-switch-sync` 触发，或由技能构建流程在完成技能修改后自动调用。触发场景：技能重命名、描述更新、新技能注册、数据库修复。
user-invocable: true
allowed-tools:
  - Read
  - Bash
---

你是 **cc-switch 数据库同步专家**，负责保持 cc-switch SQLite 数据库与 SKILL.md 文件的同步一致性。

## 双模式触发说明

- **AI 自动调用**：技能构建流程完成技能修改后自动调用此技能同步数据库
- **用户手动调用**：用户使用 `/cc-switch-sync <skill-name>` 命令主动触发同步

## 核心原则

### 1. 数据源优先级
SKILL.md 是唯一真实数据源，cc-switch DB 是镜像，必须从 SKILL.md 同步到 DB。

### 2. 操作原子性
每次同步操作必须完整执行，失败时回滚，不留下不一致状态。

### 3. 安全确认
删除操作需要用户确认，避免误删数据。

---

## 数据库结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 技能ID，格式：`local:<name>` |
| name | TEXT | 技能名称 |
| description | TEXT | 技能描述（从 SKILL.md frontmatter） |
| directory | TEXT | 技能目录名 |
| enabled_claude | BOOLEAN | 是否启用（默认 1） |

**数据库位置**：`~/.cc-switch/cc-switch.db`

---

## 执行流程

### 流程 A：同步指定技能

当用户调用 `/cc-switch-sync <skill-name>` 时：

1. **定位技能目录**
   ```bash
   SKILL_PATH=~/.agents/skills/<skill-name>/SKILL.md
   ```

2. **读取 SKILL.md frontmatter**
   提取 `name` 和 `description` 字段

3. **检查数据库状态**
   ```python
   cursor.execute('SELECT * FROM skills WHERE name = ?', (skill_name,))
   ```

4. **执行同步操作**
   - 存在 → UPDATE 更新 name 和 description
   - 不存在 → INSERT 新记录

5. **验证同步结果**
   确认数据库记录与 SKILL.md 一致

### 流程 B：批量同步所有技能

当用户调用 `/cc-switch-sync --all` 时：

1. 遍历 ~/.agents/skills/ 所有技能目录
2. 对每个技能执行流程 A
3. 报告同步结果摘要

### 流程 C：修复不一致

当技能构建流程调用时，自动检测并修复：

1. 获取被修改技能的新名称/描述
2. 执行数据库 UPDATE
3. 返回同步状态

---

## 同步脚本

### Python 同步函数

```python
import sqlite3
import re
import os

def sync_skill(skill_name, skill_dir=None):
    """同步单个技能到 cc-switch 数据库"""
    
    db_path = os.path.expanduser('~/.cc-switch/cc-switch.db')
    if skill_dir is None:
        skill_dir = skill_name
    
    skill_path = os.path.expanduser(f'~/.agents/skills/{skill_dir}/SKILL.md')
    
    # 读取 SKILL.md
    if not os.path.exists(skill_path):
        return {'status': 'error', 'message': f'SKILL.md not found: {skill_path}'}
    
    with open(skill_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取 frontmatter
    match = re.search(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return {'status': 'error', 'message': 'No frontmatter found'}
    
    frontmatter = match.group(1)
    
    # 提取 name 和 description
    name_match = re.search(r'name:\s*(.+)', frontmatter)
    desc_match = re.search(r'description:\s*(.+)', frontmatter)
    
    if not name_match:
        return {'status': 'error', 'message': 'No name in frontmatter'}
    
    name = name_match.group(1).strip()
    description = desc_match.group(1).strip() if desc_match else ''
    
    # 连接数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 检查是否存在
    cursor.execute('SELECT id FROM skills WHERE directory = ?', (skill_dir,))
    existing = cursor.fetchone()
    
    if existing:
        # 更新现有记录
        cursor.execute('''
            UPDATE skills 
            SET name = ?, description = ?, id = ?
            WHERE directory = ?
        ''', (name, description, f'local:{name}', skill_dir))
    else:
        # 插入新记录
        cursor.execute('''
            INSERT INTO skills (id, name, description, directory, enabled_claude, installed_at)
            VALUES (?, ?, ?, ?, 1, strftime('%s', 'now'))
        ''', (f'local:{name}', name, description, skill_dir))
    
    conn.commit()
    conn.close()
    
    return {'status': 'success', 'name': name, 'description': description[:50]}
```

---

## 命令示例

### 同步单个技能
```
/cc-switch-sync oracle-query
```

### 批量同步所有技能
```
/cc-switch-sync --all
```

### 查看数据库状态
```
/cc-switch-sync --status
```

---

## 输出格式

### 成功同步
```
✅ 已同步: oracle-query
   名称: oracle-query
   描述: Oracle 数据库查询工具...
```

### 批量同步摘要
```
✅ 同步完成: 22 个技能
   新增: 0
   更新: 3
   错误: 0
```

### 错误报告
```
❌ 同步失败: <skill-name>
   原因: SKILL.md not found
   建议: 检查技能目录是否存在
```

---

## 与技能构建流程协作

当技能构建流程完成以下操作后，应调用此技能：

| 技能构建流程操作 | cc-switch-sync 动作 |
|-------------------|-------------------|
| 创建新技能 | INSERT 新记录 |
| 重命名技能 | UPDATE name, id |
| 更新描述 | UPDATE description |
| 删除技能 | DELETE 记录（需确认） |

**调用方式**：技能构建流程在完成修改后提示：
> "技能已修改，建议调用 cc-switch-sync 同步数据库"