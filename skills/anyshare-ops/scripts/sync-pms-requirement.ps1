# PMS 需求文档整库增量同步（AnyShare → 当前项目 docs/requirement）
# 用法：在项目内任意目录执行本脚本；同步判定只看更新时间（云端 mtime 新于本地才下载），云端「历史版本」子目录自动跳过
# 注意：禁止改为 sync 整库根目录——云端目录名与本地不一致且含 0-历史，会生成错误结构
# 编码：本文件必须存为 UTF-8 with BOM（Windows PowerShell 5.1 对无 BOM 文件按 GBK 解析）
param(
    # 本地落地基目录：缺省 = 项目根下的 docs\requirement（项目根自动探测，见 Get-ProjectRoot）
    [string]$LocalBase,
    # 仅打印探测到的项目根/落地路径后退出（验证用，不做网络请求）
    [switch]$ShowRoot
)

# 项目根探测：从当前目录向上逐级判定
#   1) 工作区标记 docs + (.agents|.claude) —— 优先级最高，取最外层命中（如 weekreport 下的 pms 子仓库，
#      仍归位到 weekreport，而不是 pms）
#   2) .git —— 无工作区标记时，取最近的版本库根
# 找不到返回 $null，绝不回退到「当前目录」，避免在任意目录（如用户主目录）静默建出错误目录树
function Get-ProjectRoot {
    $probe = (Get-Location).Path
    $gitRoot = $null
    while ($true) {
        if ((Test-Path (Join-Path $probe 'docs')) -and
            ((Test-Path (Join-Path $probe '.agents')) -or (Test-Path (Join-Path $probe '.claude')))) { return $probe }
        if (-not $gitRoot -and (Test-Path (Join-Path $probe '.git'))) { $gitRoot = $probe }
        $parent = Split-Path $probe -Parent
        if (-not $parent -or $parent -eq $probe) { return $gitRoot }
        $probe = $parent
    }
}

$base = "九牧集团信息化/48-项目管理系统V1.0/04产品研发&测试/需求规格说明书"

if (-not $LocalBase) {
    $projectRoot = Get-ProjectRoot
    if (-not $projectRoot) {
        Write-Host "✗ 未探测到项目根（向上未找到 .git，或 docs + .agents/.claude）。" -ForegroundColor Red
        Write-Host "  请在项目内执行，或用 -LocalBase <绝对路径> 指定落地目录。" -ForegroundColor Red
        exit 1
    }
    $LocalBase = Join-Path $projectRoot "docs\requirement"
    Write-Host "项目根: $projectRoot"
}
$local = $LocalBase

if ($ShowRoot) {
    Write-Host "本地基路径: $local"
    exit 0
}

# 依赖前置检查：缺 CLI 时直接失败，避免「每个目录都报错但脚本仍打印同步完成」的假成功
if (-not (Get-Command anyshare -ErrorAction SilentlyContinue)) {
    Write-Host "✗ 未找到 anyshare 命令。请先在 ~/.agents/cli/anyshare-cli 执行：npm install && npm link" -ForegroundColor Red
    exit 1
}

Write-Host "云端基路径: $base"
Write-Host "本地基路径: $local"

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
$failed = @()
foreach ($cloudDir in $map.Keys) {
    $localDir = Join-Path $local $map[$cloudDir]
    Write-Host "=== $cloudDir → $($map[$cloudDir]) ==="
    $out = anyshare sync "$base/$cloudDir" "$localDir" 2>&1
    if ($LASTEXITCODE -ne 0) {
        $failed += $cloudDir
        $out | Select-Object -Last 3
        Write-Host "✗ 失败（exit $LASTEXITCODE）" -ForegroundColor Red
    }
    else {
        $out | Select-Object -Last 1
    }
}
$total.Stop()

if ($failed.Count -gt 0) {
    Write-Host "✗ 同步未全部完成：失败 $($failed.Count)/$($map.Count) 个目录 → $($failed -join '、')，耗时 $([int]$total.Elapsed.TotalSeconds)s" -ForegroundColor Red
    exit 1
}
Write-Host "整库同步完成，总耗时: $([int]$total.Elapsed.TotalSeconds)s"