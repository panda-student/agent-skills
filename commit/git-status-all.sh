#!/bin/bash
# 遍历所有子模块，显示有变更的子模块及其文件列表
# 用法: bash git-status-all.sh [项目根目录] [--diff]
#   项目根目录  默认当前目录
#   --diff     同时显示变更内容

# 内置子模块列表（与 submodules-name.txt 保持同步）
DEFAULT_SUBMODULES="workflow-service
timer-service
system-service
report-service
project-service
plugins-service
obs-service
gateway
common-core
operation-services
jomoo_frontend"

SHOW_DIFF=false
PROJECT_DIR="."

for arg in "$@"; do
  if [ "$arg" = "--diff" ]; then
    SHOW_DIFF=true
  elif [ "$arg" != "" ]; then
    PROJECT_DIR="$arg"
  fi
done

PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"

# 优先读取项目的 submodules-name.txt，否则用内置列表
if [ -f "$PROJECT_DIR/submodules-name.txt" ]; then
  SUBMODULES=$(cat "$PROJECT_DIR/submodules-name.txt")
else
  SUBMODULES="$DEFAULT_SUBMODULES"
fi

FOUND=0

while IFS= read -r dir; do
  dir=$(echo "$dir" | tr -d '\r')
  if [ -z "$dir" ]; then continue; fi
  if [ -d "$PROJECT_DIR/$dir/.git" ]; then
    changes=$(cd "$PROJECT_DIR/$dir" && git status --porcelain 2>/dev/null)
    if [ -n "$changes" ]; then
      FOUND=1
      echo "=== $dir ==="
      echo "$changes"
      if [ "$SHOW_DIFF" = true ]; then
        (cd "$PROJECT_DIR/$dir" && git diff --stat)
      fi
      echo ""
    fi
  fi
done <<< "$SUBMODULES"

if [ $FOUND -eq 0 ]; then
  echo "所有子模块工作区干净"
fi
