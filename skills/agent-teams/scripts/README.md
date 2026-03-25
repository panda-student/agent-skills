# Agent Teams Scripts

**用户无需关心这些脚本，只需调用技能即可，系统自动处理一切。**

## 自动化流程

当用户调用 `/agent-teams` 技能时，AI自动执行：

```
1. node scripts/cli.js check     → 检查恢复
2. node scripts/cli.js recover   → 如需要则恢复
3. node scripts/cli.js init      → 初始化新任务
4. ... 执行任务 ...
5. node scripts/cli.js checkpoint → 创建检查点
6. node scripts/cli.js complete  → 完成任务
```

用户只需描述任务，AI自动调用脚本管理状态。

## 模块说明（供AI参考）

| 模块 | 用途 |
|------|------|
| `lib/context.js` | 状态管理、初始化、分段、摘要 |
| `lib/wal.js` | WAL日志持久化 |
| `lib/checkpoint.js` | 检查点创建与恢复 |
| `lib/recovery.js` | 恢复检测与执行 |
| `index.js` | 统一API入口 |

## 快速API

```javascript
const at = require('./scripts/index');

// 检查恢复
at.checkRecovery(baseDir);

// 执行恢复
at.recover(baseDir);

// 初始化任务
at.init(baseDir, '任务目标');

// 创建检查点
at.checkpoint(baseDir, 'segment');

// 获取状态
at.status(baseDir);

// 完成任务
at.complete(baseDir);
```

## 文件结构

```
.claude/context/
├── core/RECOVERY_TRIGGER.md    # 存在=有未完成任务
├── active/state.yaml           # 当前状态
├── checkpoints/                # 检查点
└── segments/                   # 分段WAL
```