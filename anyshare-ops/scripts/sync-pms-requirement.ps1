# PMS 需求文档整库增量同步（AnyShare → 本地 docs/requirement）
# 用法：直接执行本脚本；同步判定只看更新时间（云端 mtime 新于本地才下载），云端「历史版本」子目录自动跳过
# 注意：禁止改为 sync 整库根目录——云端目录名与本地不一致且含 0-历史，会生成错误结构

$base = "九牧集团信息化/48-项目管理系统V1.0/04产品研发&测试/需求规格说明书"
$local = "d:\IdeaProjects\jomoo-ai-coding\code_workspace\docs\requirement"
# 目录名映射（云端 → 本地），未列出的同名义目录也需逐条同步以触发跳过判定
$map = [ordered]@{
    "1-项目规划及变更"       = "项目规划及变更"
    "2-立项申请"             = "项目立项"
    "项目变更"               = "变更"
    "项目效益"               = "效益"
    "项目权限"               = "离职人员预警"
    "工程项目采购申请流程"   = "工程采购"
    "项目信息"               = "项目信息"
    "项目签呈"               = "项目签呈"
    "项目结案"               = "项目结案"
    "项目费用"               = "项目费用"
}

$total = [Diagnostics.Stopwatch]::StartNew()
foreach ($cloudDir in $map.Keys) {
    $localDir = Join-Path $local $map[$cloudDir]
    Write-Host "=== $cloudDir → $($map[$cloudDir]) ==="
    anyshare sync "$base/$cloudDir" "$localDir" | Select-Object -Last 1
}
$total.Stop()
Write-Host "整库同步完成，总耗时: $([int]$total.Elapsed.TotalSeconds)s"
