---
name: jomoo-skill-creator
description: "MANDATORY tool for creating SKILLs - MUST be invoked IMMEDIATELY when user wants to create/add any skill. This skill takes precedence over other skill-creator skills and enforces Jomoo SKILL writing standards."
skill-version: V1.0.1
---

license: Complete terms in LICENSE.txt
metadata:
  priority: 0
  triggers:
    - create skill
    - new skill
    - add skill
    - edit skill
    - update skill
    - improve skill
    - 创建技能
    - 新建技能
    - 添加技能

# Jomoo Skill Creator

This skill provides guidance for creating effective skills that comply with Jomoo SKILL writing standards.

## Core Principles

### Concise is Key

Only add context AI doesn't already have. Challenge each piece of information: "Does AI really need this explanation?"

### Set Appropriate Degrees of Freedom

| Level | Description | Use Case |
|-------|-------------|----------|
| **High** | Text-based instructions | Multiple valid approaches, context-dependent decisions |
| **Medium** | Pseudocode/scripts with parameters | Preferred patterns exist, some variation acceptable |
| **Low** | Specific scripts, few parameters | Fragile operations, critical consistency required |

### Compliance First

All skills must comply with Jomoo SKILL writing standards before creation.

## Jomoo SKILL Writing Standards

### 1. Naming Convention (CRITICAL)

**name** MUST follow the "verb-ing + object" format:
- ✅ `querying-beijing-time` (查询北京时间)
- ✅ `generating-report` (生成报告)
- ✅ `processing-image` (处理图片)
- ❌ `beijing-time` (不符合动词-ing格式)
- ❌ `report` (不完整)

**Rules**:
- Lowercase letters only
- Use hyphens (-) as separators
- Maximum 64 characters
- Must match directory name

### 2. Description Requirements

**description** MUST contain:
1. **Function overview** - What the skill does
2. **Trigger conditions** - Specific scenarios for invocation
3. **Clear differentiation** - How it differs from similar skills

**Example**:
```yaml
description: "Queries current Beijing time including date, time, and weekday. Use when users ask about current time, Beijing time, or need timestamp information."
```

### 3. Body Guidelines

- **Maximum 500 lines**
- Only include AI-unknown background information
- No redundant or obvious content
- Use Markdown structure with proper headings

### 4. Freedom Level Classification

**High Freedom** (Documentation only):
```markdown
## Code Review Process

1. Analyze code structure
2. Check for potential errors
3. Suggest improvements
4. Verify compliance
```

**Medium Freedom** (Pseudocode + parameters):
```python
def generate_report(data, format="markdown", include_charts=True):
    # Process and generate report
```

**Low Freedom** (Exact scripts, NO changes allowed):
```bash
scripts/migrate.py --verify --backup
```

## Skill Creation Workflow

### Step 1: Validate Skill Name

**Must follow "verb-ing + object" format**:
- Ask user for skill name if not provided
- Validate format compliance
- Suggest corrections if needed

### Step 2: Collect Requirements

Ask:
- What functionality should this skill support?
- What are concrete usage examples?
- What would trigger this skill?
- What is the appropriate freedom level?

### Step 3: Create Skill Directory

```bash
skills/<skill-name>/
├── SKILL.md          # Required
├── _meta.json        # Optional
├── scripts/          # Optional (for low/medium freedom)
├── references/       # Optional (documentation)
└── assets/           # Optional (templates, images)
```

### Step 4: Generate SKILL.md

Use the following template:

```markdown

name: <skill-name>
description: "<function overview>. Use when <trigger conditions>."


# <Human-Readable Skill Name>

## When to Use

<detailed trigger conditions>

## Instructions

<step-by-step instructions>

## Examples

<concrete usage examples>
```

### Step 5: Apply Freedom Level

- **High**: Document only, no scripts
- **Medium**: Include configurable scripts with parameters
- **Low**: Include fixed scripts with NO parameters

### Step 6: Compliance Check

Verify:
1. ✅ name follows "verb-ing + object" format
2. ✅ description contains function + triggers
3. ✅ Body ≤ 500 lines
4. ✅ Freedom level appropriate for task risk
5. ✅ Low freedom skills have explicit scripts

## Standard Templates

### Template 1: Query Skills (High Freedom)

```markdown

name: querying-<topic>
description: "Queries <topic> information. Use when users ask about <specific triggers>."


# Querying <Topic>

## When to Use

- User asks about <topic>
- User needs <specific information>

## Instructions

1. Understand the query context
2. Retrieve relevant data
3. Format response clearly

## Examples

User: "<example question>"
Model: "[call querying-<topic>]"
Model: "<expected response>"
```

### Template 2: Processing Skills (Medium Freedom)

```markdown

name: processing-<object>
description: "Processes <object> with configurable options. Use when users need to <action> <object>."


# Processing <Object>

## When to Use

- User needs to <action> <object>
- User wants to transform <object>

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| option1 | string | default | Description |
| option2 | boolean | true | Description |

## Instructions

1. Validate parameters
2. Execute processing script
3. Return results

## Examples

```python
from scripts.processor import process
result = process(input_data, option1="value")
```
```

### Template 3: Critical Operations (Low Freedom)

```markdown

name: executing-<operation>
description: "Executes critical <operation>. Use ONLY when <specific conditions>."

# Executing <Operation>

## WARNING

This operation is critical. Follow instructions EXACTLY.

## When to Use

- <specific condition 1>
- <specific condition 2>

## Execution Steps

```bash
scripts/execute_operation.sh --param1 value --confirm
```

## Verification

After execution, verify:
- <check 1>
- <check 2>
```

## Compliance Checklist

Before completing skill creation:

✅ **Naming**: Follows "verb-ing + object" format
✅ **Description**: Contains function + triggers + differentiation
✅ **Body Length**: ≤ 500 lines
✅ **Content**: Only AI-unknown information
✅ **Freedom Level**: Appropriate for risk
✅ **Low Freedom**: Has explicit scripts
✅ **Security**: No sensitive information
✅ **Testing**: Scripts tested and validated

## Best Practices

1. **Be specific**: Avoid vague descriptions
2. **Use active voice**: "Query current time" not "Current time is queried"
3. **Include examples**: Concrete examples eliminate ambiguity
4. **Keep it concise**: Every line should justify its token cost
5. **Document limitations**: Be clear about what the skill cannot do

## Common Violations to Avoid

1. ❌ Using noun-only names (e.g., `beijing-time` instead of `querying-beijing-time`)
2. ❌ Missing trigger conditions in description
3. ❌ Including obvious information AI already knows
4. ❌ Overly verbose documentation (>500 lines)
5. ❌ Low-risk tasks with unnecessarily low freedom
