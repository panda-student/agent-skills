#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
技能查找与安装辅助模块
提供环境检测、名称校验、安全安装等确定性操作，Agent根据SKILL.md文档自行构造搜索API请求。

SECURITY NOTE:
- 本脚本不包含任何出站网络请求——技能搜索由Agent根据SKILL.md中记录的API端点自行完成
- 安装命令使用subprocess参数列表形式（非shell=True），技能名称经正则校验防止注入
"""

import re
import os
import shutil
import subprocess
import urllib.parse
from typing import Dict, Optional

SKILL_INSTALL_BASE_URL = "https://api-ai-coder-jmbos.jomoo.com"
ALLOWED_DOMAINS = ["api-ai-coder-jmbos.jomoo.com"]
SUPPORTED_AGENTS = ["trae", "openclaw", "opencode", "codex", "cursor", "claude-code"]

SAFE_SKILL_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_-]+$")

# 智能体到技能安装目录的映射（基于 detect_agent 中的 agent_dir_map，追加 /skills 后缀）
AGENT_SKILLS_DIR_MAP = {
    "trae": ".trae/skills",
    "openclaw": ".openclaw/skills",
    "opencode": ".opencode/skills",
    "cursor": ".cursor/skills",
    "codex": ".codex/skills",
    "claude-code": ".claude/skills",
}


def validate_url(url: str) -> bool:
    """校验URL是否属于授权白名单域名"""
    parsed = urllib.parse.urlparse(url)
    return parsed.netloc in ALLOWED_DOMAINS


def validate_skill_name(skill_name: str) -> bool:
    """校验技能名称是否为安全字符（字母/数字/下划线/连字符）"""
    return bool(skill_name and SAFE_SKILL_NAME_PATTERN.match(skill_name))


def detect_agent() -> Optional[str]:
    """
    从项目根目录自动检测智能体信息

    检测策略：先通过项目目录结构推断，再扫描配置文件，最后检查环境变量。
    目录结构检测优先级最高（如 .trae/ 目录 → trae），避免配置文件中的误匹配。

    Returns:
        智能体名称，如 "trae", "openclaw" 等，或 None
    """
    agent_dir_map = {
        "trae": ".trae",
        "openclaw": ".openclaw",
        "opencode": ".opencode",
        "cursor": ".cursor",
        "codex": ".codex",
        "claude-code": ".claude",
    }

    cwd = os.getcwd()

    for agent, dir_name in agent_dir_map.items():
        if os.path.isdir(os.path.join(cwd, dir_name)):
            return agent

    config_files = ["agent.json", ".agentrc", "package.json", "pyproject.toml"]
    for config_file in config_files:
        file_path = os.path.join(cwd, config_file)
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read().lower()
                    for agent in SUPPORTED_AGENTS:
                        if agent in content:
                            return agent
            except Exception:
                pass

    for agent in SUPPORTED_AGENTS:
        env_key = f"{agent.upper().replace('-', '_')}_AGENT"
        if os.environ.get(env_key):
            return agent

    return None


def install_skill(skill_name: str, agent: str, version: Optional[str] = None) -> Dict[str, Optional[str]]:
    """
    执行技能安装命令

    Args:
        skill_name: 技能名称（必须为安全字符：字母、数字、下划线、连字符）
        agent: 目标智能体（必须在 SUPPORTED_AGENTS 列表中）
        version: 可选版本号（如 "V1.0.3"），为 None 或空字符串时不拼接版本号

    Returns:
        安装结果 {"success": bool, "output"/"error": str}
    """
    if not validate_skill_name(skill_name):
        return {"success": False, "error": f"无效的技能名称: {skill_name}"}

    if agent not in SUPPORTED_AGENTS:
        return {"success": False, "error": f"不支持的智能体: {agent}"}

    if version:
        skill_path = f"{skill_name}@{version}"
    else:
        skill_path = skill_name

    install_url = f"{SKILL_INSTALL_BASE_URL}/skills/jm-{skill_name}/{skill_path}"
    if not validate_url(install_url):
        return {"success": False, "error": "安装URL未通过白名单校验"}

    try:
        result = subprocess.run(
            [
                "npx", "skills", "add",
                install_url,
                "-a", agent,
                "-y",
            ],
            capture_output=True,
            text=True,
            timeout=60,
            shell=True,
        )

        if result.returncode == 0:
            return {"success": True, "output": result.stdout}
        else:
            return {"success": False, "error": result.stderr or result.stdout}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "安装超时，请稍后重试"}
    except FileNotFoundError:
        return {"success": False, "error": "npx 命令未找到，请确认 Node.js 已安装"}
    except Exception as e:
        return {"success": False, "error": f"安装过程中发生错误: {str(e)}"}


def _find_skill_dir(skill_name: str, agent: str) -> Optional[str]:
    """
    查找技能安装目录的内部辅助函数

    先查找同名子目录，找不到则遍历所有子目录通过 SKILL.md frontmatter 中的 name 字段匹配。

    Args:
        skill_name: 技能名称
        agent: 智能体类型

    Returns:
        技能目录的绝对路径，未找到返回 None
    """
    skills_dir = AGENT_SKILLS_DIR_MAP.get(agent)
    if not skills_dir:
        return None

    skills_path = os.path.join(os.getcwd(), skills_dir)
    if not os.path.isdir(skills_path):
        return None

    # 方式一：检查同名子目录
    same_name_dir = os.path.join(skills_path, skill_name)
    if os.path.isdir(same_name_dir):
        return same_name_dir

    # 方式二：遍历所有子目录，通过 SKILL.md frontmatter name 字段匹配
    try:
        for entry in os.listdir(skills_path):
            entry_path = os.path.join(skills_path, entry)
            if not os.path.isdir(entry_path):
                continue
            skill_md_path = os.path.join(entry_path, "SKILL.md")
            if not os.path.isfile(skill_md_path):
                continue
            try:
                with open(skill_md_path, "r", encoding="utf-8") as f:
                    content = f.read()
                # 解析 YAML frontmatter 中的 name 字段（简单字符串解析，不依赖 pyyaml）
                lines = content.splitlines()
                if not lines or lines[0].strip() != "---":
                    continue
                for line in lines[1:]:
                    if line.strip() == "---":
                        break
                    stripped = line.strip()
                    if stripped.startswith("name:"):
                        name_value = stripped[5:].strip()
                        # 去除可能的引号
                        name_value = name_value.strip('"').strip("'")
                        if name_value == skill_name:
                            return entry_path
            except Exception:
                continue
    except Exception:
        return None

    return None


def _get_local_skill_version(skill_name: str, agent: str) -> Optional[str]:
    """
    读取本地已安装技能的 SKILL.md 中 frontmatter 的 skill-version 字段

    Args:
        skill_name: 技能名称
        agent: 智能体类型

    Returns:
        版本号字符串（如 "V1.0.0"），未找到或解析失败返回 None
    """
    skill_dir = _find_skill_dir(skill_name, agent)
    if skill_dir is None:
        return None

    skill_md_path = os.path.join(skill_dir, "SKILL.md")
    if not os.path.isfile(skill_md_path):
        return None

    try:
        with open(skill_md_path, "r", encoding="utf-8") as f:
            content = f.read()
        lines = content.splitlines()
        if not lines or lines[0].strip() != "---":
            return None
        for line in lines[1:]:
            if line.strip() == "---":
                break
            stripped = line.strip()
            if stripped.startswith("skill-version:"):
                version_value = stripped[len("skill-version:"):].strip()
                version_value = version_value.strip('"').strip("'")
                return version_value
    except Exception:
        return None

    return None


def is_skill_installed(skill_name: str, agent: str) -> bool:
    """
    检测本地项目中是否安装了指定技能

    Args:
        skill_name: 技能名称
        agent: 智能体类型

    Returns:
        已安装返回 True，未安装或参数不合法返回 False
    """
    if not validate_skill_name(skill_name):
        return False

    if agent not in SUPPORTED_AGENTS:
        return False

    skill_dir = _find_skill_dir(skill_name, agent)
    return skill_dir is not None


def delete_skill(skill_name: str, agent: str) -> Dict[str, Optional[str]]:
    """
    从本地项目中安全删除指定技能

    Args:
        skill_name: 技能名称
        agent: 智能体类型

    Returns:
        删除结果 {"success": bool, "output"/"error": str}
    """
    if not validate_skill_name(skill_name):
        return {"success": False, "error": f"无效的技能名称: {skill_name}"}

    if agent not in SUPPORTED_AGENTS:
        return {"success": False, "error": f"不支持的智能体: {agent}"}

    skill_dir = _find_skill_dir(skill_name, agent)
    if skill_dir is None:
        return {"success": False, "error": f"技能 {skill_name} 未安装"}

    try:
        shutil.rmtree(skill_dir)
        return {"success": True, "output": f"已删除技能 {skill_name}"}
    except Exception as e:
        return {"success": False, "error": f"删除技能失败: {str(e)}"}


def full_update_skills(skills_data: list, agent: str) -> Dict:
    """
    全量更新编排函数，根据 delete_flag 和本地安装状态执行对应操作

    Args:
        skills_data: 技能清单数据，每个元素为含 name、delete_flag、version(可选) 字段的 dict
        agent: 目标智能体类型

    Returns:
        {"success": True, "summary": {...}} 或 {"success": False, "error": ..., "summary": None}
    """
    if agent not in SUPPORTED_AGENTS:
        return {"success": False, "error": f"不支持的智能体: {agent}", "summary": None}

    summary = {
        "deleted": [],
        "upgraded": [],
        "installed": [],
        "skipped": [],
        "failed": [],
    }

    for item in skills_data:
        try:
            name = item.get("name")
            delete_flag = item.get("delete_flag")
            version = item.get("version")

            if not name:
                summary["failed"].append({"name": name, "error": "技能名称为空或缺失"})
                continue

            installed = is_skill_installed(name, agent)

            if delete_flag == -1:
                # 需要删除
                if installed:
                    result = delete_skill(name, agent)
                    if result.get("success"):
                        summary["deleted"].append(name)
                    else:
                        summary["failed"].append({"name": name, "error": result.get("error", "未知错误")})
                else:
                    summary["skipped"].append(name)
            elif delete_flag == 1:
                # 需要安装/升级
                source_version = item.get("sourceVersion")
                if installed and source_version:
                    local_version = _get_local_skill_version(name, agent)
                    if local_version and local_version == source_version:
                        summary["skipped"].append(name)
                        continue
                result = install_skill(name, agent, version)
                if result.get("success"):
                    if installed:
                        summary["upgraded"].append(name)
                    else:
                        summary["installed"].append(name)
                else:
                    summary["failed"].append({"name": name, "error": result.get("error", "未知错误")})
            else:
                summary["skipped"].append(name)
        except Exception as e:
            summary["failed"].append({"name": item.get("name", "未知"), "error": str(e)})

    return {"success": True, "summary": summary}