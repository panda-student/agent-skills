# 拉取当天（或指定日期）三仓库 git 提交，写成 UTF-8 临时文件，供 AI 用 Read 读取
# 为什么写文件：pms 等仓库的 UTF-8 中文提交信息经 PowerShell 控制台输出会按 GBK 解码成乱码，实测只有落文件稳定
# 编码：本文件必须存为 UTF-8 with BOM（Windows PowerShell 5.1 对无 BOM 文件按 GBK 解析，中文会乱码报解析错误）
param(
    [string]$Date = (Get-Date -Format 'yyyy-MM-dd'),
    [string]$OutDir = $env:TEMP,
    [string]$Author = 'sunzhiqiang'
)

$ErrorActionPreference = 'Stop'

# 项目根探测：docs + (.agents|.claude) 优先（取最外层），其次最近的 .git
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

$root = Get-ProjectRoot
if (-not $root) {
    Write-Host "✗ 未探测到项目根（向上未找到 docs + .agents/.claude，或 .git）。请在项目内执行。" -ForegroundColor Red
    exit 1
}

$day = ([datetime]$Date).ToString('yyyy-MM-dd')
$next = ([datetime]$Date).AddDays(1).ToString('yyyy-MM-dd')
Write-Host "项目根: $root"
Write-Host "日期: $day（作者: $Author）"

$total = 0
foreach ($repo in @('pms', 'pms_frontend', 'pms_mobile')) {
    $repoPath = Join-Path $root $repo
    if (-not (Test-Path $repoPath)) { Write-Host "  [skip] $repo 不存在"; continue }

    $log = @(git -C $repoPath log origin/uat --since="$day 00:00" --until="$next 00:00" --author="$Author" --pretty=format:"%h|%ad|%s" --date=format:"%H:%M" 2>$null)
    if (-not $log -or $log.Count -eq 0) {
        # origin/uat 无结果时兜底全部分支（提交可能在别的分支）
        $log = @(git -C $repoPath log --all --since="$day 00:00" --until="$next 00:00" --author="$Author" --pretty=format:"%h|%ad|%s" --date=format:"%H:%M" 2>$null)
    }

    $out = Join-Path $OutDir "daily_$repo.txt"
    [System.IO.File]::WriteAllText($out, ($log -join "`n"), (New-Object System.Text.UTF8Encoding($false)))
    $total += $log.Count
    Write-Host ("  {0,-14} {1,3} 条 -> {2}" -f $repo, $log.Count, $out)
}

Write-Host "合计 $total 条提交。下一步：用 Read 工具读取上述文件，读完后删除。"