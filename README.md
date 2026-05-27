# Agent Skills 仓库

用于存储和迭代 AI Agent 技能。

## 技能列表

| 技能 | 说明 | 文档 |
|------|------|------|
| [agent-teams](skills/agent-teams/) | 多 Agent 协作技能 | [查看](skills/agent-teams/SKILL.md) |
| [simplify](skills/simplify/) | 代码审查工具，分级策略 + 四维度并行审查（复用/单一职责/质量/性能） | [查看](skills/simplify/SKILL.md) |
| [doc-review](skills/doc-review/) | 文档评审工具，分级策略 + 多维度审查，减少后续修复成本 | [查看](skills/doc-review/SKILL.md) |
| [learn](skills/learn/) | 知识管理专家，会话复盘与知识固化 | [查看](skills/learn/SKILL.md) |
| [commit](skills/commit/) | Git 提交规范 | [查看](skills/commit/SKILL.md) |
| [exec-pgsql](skills/exec-pgsql/) | PostgreSQL 操作 | [查看](skills/exec-pgsql/SKILL.md) |
| [image-analyzer](skills/image-analyzer/) | 图像分析 | [查看](skills/image-analyzer/SKILL.md) |
| [skill-builder](skills/skill-builder/) | Skill 构建工具 | [查看](skills/skill-builder/SKILL.md) |

## 目录结构

```
skills/
├── agent-teams/          # 多 Agent 协作技能
│   ├── SKILL.md          # 技能定义
│   ├── README.md         # 使用说明
│   ├── references/       # 参考文档
│   ├── assets/           # 资源文件
│   └── scripts/          # 脚本
└── [其他技能]/           # 更多技能...
```

## 添加新技能

1. 在 `skills/` 目录下创建新文件夹
2. 添加 `SKILL.md` 定义技能
3. 添加 `README.md` 说明文档
4. 更新本文件的技能列表

## 安装技能

```bash
# 克隆仓库
git clone git@github.com:panda-student/agent-teams.git

# 复制技能到本地
cp -r agent-teams/skills/[技能名] ~/.openclaw/workspace/skills/
```
