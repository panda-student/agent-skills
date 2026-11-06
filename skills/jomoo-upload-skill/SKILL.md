---
name: jomoo-upload-skill
description: "Uploads local skills to central repository. MUST be invoked when user mentions upload-related terms (上传技能, 上传SKILL, 技能上传, 发布技能, 同步技能). This skill takes precedence over jomoo-find-skills for upload-related requests. Ensures newly created skills are synchronized and available for use."
skill-version: V1.0.1
---

# JMBOS Upload Skill

## CRITICAL BEHAVIOR

**AUTOMATIC EXECUTION**: When this skill is invoked via the Skill tool, the uploader runs **automatically** without requiring any manual intervention. The `index.js` entry point immediately executes the upload process.

**NO MANUAL STEPS REQUIRED**: Users and models do NOT need to run `node scanner.js` manually. The upload runs automatically when the skill is called.

## When to Use

### Primary Trigger Keywords (Highest Priority)

This skill MUST be invoked when user mentions any of the following:

- "上传技能"
- "上传SKILL"
- "上传本地技能"
- "技能上传到中央仓库"
- "同步本地技能"
- "技能上传"
- "上传我的技能"

### Secondary Trigger Keywords

Also triggered by:

- "同步技能"
- "上传"
- "技能同步"
- "upload skill"
- "upload skills"
- "sync skills"

## Trigger Examples

### Explicit User Requests:

- "上传技能到中央仓库"
- "上传技能"
- "上传SKILL"
- "同步技能"
- "上传"
- "技能上传"
- "上传本地技能"
- "技能同步"
- "同步本地技能"
- "上传我的技能"

### Skill Responsibility Clarification

**Important**: This skill is specifically for **uploading local skills to the central repository**. It should NOT be confused with `jomoo-find-skills` which is for **finding and installing skills from the central repository**.

| Action | Correct Skill to Call |
|--------|----------------------|
| Upload local skill to central repository | jomoo-upload-skill |
| Find skills in central repository | jomoo-find-skills |
| Install skill from central repository | jomoo-find-skills |
| Sync local skills to central repository | jomoo-upload-skill |

### Conflict Resolution Scenarios:

- User reports "skill-creator was used but skill doesn't appear in list"
- User sees skill in UI but cannot call it
- Model receives "Skill not found" error when trying to invoke a skill
- Discrepancy between displayed skills and available skills list

## Resolution Strategy for Skill Not Found Errors

When a skill invocation fails with "Skill not found":

1. **CALL THIS SKILL FIRST**: Invoke jomoo-upload-skill immediately to synchronize skills
2. **CHECK AVAILABLE SKILLS**: Use the returned list as authoritative source
3. **INFORM USER**: Explain the synchronization occurred and list currently available skills
4. **OFFER ALTERNATIVES**: If requested skill is still not available, offer alternatives or suggest recreating

### Example Response Flow:

```
User: "为什么我创建的alibaba-java-guidelines技能找不到？"
Model: "让我先上传技能...[调用jomoo-upload-skill]"
Model: "已上传技能。当前可用技能包括：alibaba-java-guidelines, http-client, skill-creator。你可以正常使用alibaba-java-guidelines技能了。"
```

## Architecture

```
.trae/skills/
  - jomoo-upload-skill/
    - SKILL.md           # This file (skill definition)
    - _meta.json         # Skill metadata
    - index.js           # MAIN ENTRY POINT - Auto-executes when skill is invoked
    - scanner.js         # Core scanning logic (called by index.js)
    - execution.md       # Execution documentation
```

### Key Files:

| File         | Purpose                                                    |
| ------------ | ---------------------------------------------------------- |
| `index.js`   | **Entry point** - Automatically runs when skill is invoked |
| `scanner.js` | Core scanning, packaging, and upload logic                 |
| `SKILL.md`   | Skill definition and documentation                         |
| `_meta.json` | Metadata for skill registration                            |

## Execution Flow

```
Skill Invoked → index.js runs automatically → scanner.js executes → 
[解析用户输入] → [检测新技能] → [用户确认/指定] → Package → Upload → Exit
```

When the skill is called:

1. `index.js` is executed as the entry point
2. It immediately calls `executeSkill()` from `scanner.js`
3. The uploader parses user input to detect specified skills
4. If no skills specified, it detects newly created skills
5. Prompts user for confirmation or specification
6. Packages and uploads confirmed skills
7. Results are logged and returned

## Scope

This skill ONLY:

- Scans local .trae/skills directory for skill packages
- Packages skills into zip files
- Uploads packages to the specified endpoint

This skill NEVER:

- Modifies any existing skills
- Accesses files outside the .trae/skills directory
- Performs any other network operations

## Core Rules

### 1. Scan Strategy

- Scans all directories under .trae/skills
- Identifies valid skills by presence of SKILL.md and \_meta.json
- Excludes itself from scanning

### 2. Packaging

- Creates zip files for each skill
- Includes all files in the skill directory
- Uses skill name as zip filename

### 3. Upload

- Sends POST request to [https://api-ai-coder-jmbos.jomoo.com](https://api-ai-coder-jmbos.jomoo.com/)[/api/skill/collect-skill](https://api-ai-coder-jmbos.jomoo.com/api/skill/collect-skill)
- Uses multipart/form-data with file parameter
- Handles upload errors gracefully
- Only uploads skills not already in the central repository

## Workflow

```
Skill Invoked → Auto-execute index.js → Call executeSkill() → 
[解析用户输入] → [检测新技能] → [用户确认/指定] → 
Package selected skills → Upload to central repository → Log results → Return success message
```

## Skill Upload Selection Mechanism

### Decision Flow

The skill implements a four-step decision flow for skill selection:

**Step 1: Check for Explicit Skill Specification**
- Parses user input to identify any explicitly mentioned skill names
- Supports formats like: "上传 my-skill", "上传 skill-a 和 skill-b", "上传 all"
- If explicit skills are found, proceeds with uploading only those skills

**Step 2: Analyze Conversation Context**
- If no explicit skills are specified, scans for newly created skills
- Compares local skills with central repository to identify new skills
- A skill is considered "new" if it exists locally but not in the central repository

**Step 3: Confirmation Prompt for New Skills**
- If new skills are detected, displays a clear confirmation prompt
- Lists all detected new skills with a request to confirm or cancel
- User must reply "确认" (confirm) or "取消" (cancel)

**Step 4: Request Skill Specification**
- If no explicit skills AND no new skills detected
- Displays a list of all available local skills
- Provides examples of acceptable input formats

### Example Interactions

**Scenario 1: Explicit Skill Specification**
```
User: "上传 my-new-skill"
Model: "[调用jomoo-upload-skill]"
Model: "✓ 技能 \"my-new-skill\" 上传成功"
```

**Scenario 2: New Skills Detected**
```
User: "上传技能"
Model: "[调用jomoo-upload-skill]"
Model: "检测到以下 2 个新技能，是否上传？

技能列表:
  - my-skill-1
  - my-skill-2

请回复 \"确认\" 或 \"取消\""
```

**Scenario 3: No Skills Specified**
```
User: "上传技能"
Model: "[调用jomoo-upload-skill]"
Model: "请指定要上传的技能名称。

可用技能列表:
  - skill-a
  - skill-b
  - skill-c

示例格式:
  - \"上传 my-skill\"
  - \"上传 skill-a 和 skill-b\"
  - \"上传 all\""
```

### Input Parsing Rules

The uploader recognizes skills in the following ways:
1. Any skill name that appears in the user input (e.g., "my-skill")
2. Pattern matching for "上传" followed by a skill name (e.g., "上传 my-skill")
3. The keyword "all" to upload all skills

## External Endpoints

| Endpoint                                                           | Data Sent      | Purpose                     |
|--------------------------------------------------------------------| -------------- | --------------------------- |
| <https://api-ai-coder-jmbos.jomoo.com/api/skill/collect-skill> | Skill zip file | Upload skill package        |
| <https://api-ai-coder-jmbos.jomoo.com/api/skill/list-name-all> | None           | Get list of existing skills |

## Security & Privacy

**Data that stays local:**

- Scan logs
- Temporary zip files (deleted after upload)

**Data that leaves your machine:**

- Skill packages uploaded to the specified endpoint

**This skill does NOT:**

- Access any personal or sensitive data
- Modify any system settings
- Execute any untrusted code

## Usage

### Automatic Execution (RECOMMENDED):

Simply invoke the skill via the Skill tool. The uploader runs automatically:

```
Model: "[调用jomoo-upload-skill]"
```

### Manual Execution (For Testing):

1. **Install dependencies**:
   ```bash
   npm install archiver axios form-data
   ```
2. **Run the uploader once**:
   ```bash
   node .trae/skills/jomoo-upload-skill/index.js
   ```
3. **The uploader will**:
   - Scan for new skills
   - Package and upload any new skills
   - Exit after completion

## Monitoring

Check the console output to monitor the uploader's activity. You should see logs like:

- "JMBOS Upload Skill - AUTO EXECUTION STARTED"
- "Skill invoked, automatically running uploader..."
- "Scanning skills directory..."
- "Found X skills in central repository"
- "Found Y skills to process"
- "Processing skill: \[skill name]"
- "Successfully uploaded \[skill name]: 200"
- "JMBOS Upload Skill - AUTO EXECUTION COMPLETED"

## Model Best Practices

1. **ALWAYS CALL AFTER skill-creator**: Never assume a skill is available immediately after creation
2. **USE RETURNED LIST AS TRUTH**: The list returned by this scanner is the authoritative source
3. **EXPLAIN SYNCHRONIZATION**: Inform users when synchronization occurs and what skills are available
4. **HANDLE NAME DIFFERENCES**: Skill names may differ between UI display and actual invocation names
5. **NO RETRY ON SAME ERROR**: If a skill still doesn't exist after synchronization, stop retrying and inform user
