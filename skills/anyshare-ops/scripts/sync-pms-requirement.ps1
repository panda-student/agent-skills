# PMS 需求文档整库增量同步（AnyShare → 当前项目 docs/requirement）
# 用法：在项目内任意目录执行本脚本；同步判定只看更新时间（云端 mtime 新于本地才下载），云端「历史版本」子目录自动跳过
# 云端定位：库名固定 + 其下按「稳定片段」逐级匹配（不写版本号/括号补充等易变部分），并优先复用 gns id 缓存，
#           因此云端目录改名或移动（如 48-项目管理系统V1.0 → 48-项目管理系统（PMS)V1.0）不会导致失效
# 注意：禁止改为 sync 整库根目录——云端目录名与本地不一致且含 0-历史，会生成错误结构
# 编码：本文件必须存为 UTF-8 with BOM（Windows PowerShell 5.1 对无 BOM 文件按 GBK 解析）
param(
    # 本地落地基目录：缺省 = 项目根下的 docs\requirement（项目根自动探测，见 Get-ProjectRoot）
    [string]$LocalBase,
    # 仅打印探测到的项目根/落地路径后退出（验证用，不做网络请求）
    [switch]$ShowRoot,
    # 手动指定云端「需求规格说明书」根目录的 gns id（云端结构大改、自动解析失败时使用）
    [string]$BaseGns
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

# ======================= 云端定位（改名容忍） =======================
# 层级：文档库 → 项目根目录 → 研发测试目录 → 需求规格说明书根目录
# 每级只保留稳定片段，逐级用「精确 → 包含 → 去前导序号后包含」匹配；云端改名只要没改掉核心词就仍能命中
$libName  = "九牧集团信息化"
$baseSegs = @("48-项目管理系统", "04产品研发", "需求规格说明书")

# gns id 缓存：AnyShare 改名/移动不改变文档 id，缓存命中时云端再改名也照常同步；
# 仅当目录被删除/权限失效（gns 读不到）才回落到名称解析
$cacheDir  = Join-Path $HOME '.anyshare-ops'
$cacheFile = Join-Path $cacheDir 'pms-requirement-root.json'

# 调 CLI 列目录（--json 输出单行 JSON，含每个子目录的 gns id）；失败返回 $null
function Get-CloudListing([string]$target) {
    $raw = & anyshare ls $target --json 2>&1
    if ($LASTEXITCODE -ne 0) { return $null }
    try { return (($raw | Out-String) | ConvertFrom-Json) } catch { return $null }
}

# 子目录名匹配：精确 → 包含 → 去掉前导序号（「1-」「01」「1、」等）后包含
function Find-ChildDir($dirs, [string]$want) {
    $list = @($dirs)
    $hit = $list | Where-Object { $_.name -eq $want } | Select-Object -First 1
    if ($hit) { return $hit }
    $hit = $list | Where-Object { $_.name -and $_.name.Contains($want) } | Select-Object -First 1
    if ($hit) { return $hit }
    $stripped = $want -replace '^\d+[\-_.、\s]*', ''
    return $list | Where-Object {
        $_.name -and (($_.name -replace '^\d+[\-_.、\s]*', '').Contains($stripped))
    } | Select-Object -First 1
}

# 解析云端需求规格说明书根目录，返回 @{ gns; path; listing }
function Resolve-RequirementRoot {
    if ($BaseGns) {
        $listing = Get-CloudListing $BaseGns
        if ($listing) { return @{ gns = $BaseGns; path = '(手动指定 -BaseGns)'; listing = $listing } }
        Write-Host "✗ 无法读取 -BaseGns 指定的目录: $BaseGns" -ForegroundColor Red
        return $null
    }

    # 1) 优先用 gns id 缓存（改名/移动不影响文档 id）
    if (Test-Path $cacheFile) {
        try {
            $cached = Get-Content $cacheFile -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($cached.gns) {
                $listing = Get-CloudListing $cached.gns
                if ($listing) {
                    Write-Host "云端定位: gns 缓存命中（上次路径: $($cached.path)）"
                    return @{ gns = $cached.gns; path = "$($cached.path)（缓存记录，可能已改名）"; listing = $listing }
                }
                Write-Host "云端定位: gns 缓存已失效，按名称重新解析" -ForegroundColor Yellow
            }
        }
        catch { }
    }

    # 2) 按稳定片段逐级解析
    $current = $libName
    $gns = $null
    foreach ($seg in $baseSegs) {
        $listing = Get-CloudListing $current
        if (-not $listing) {
            Write-Host "✗ 读取云端目录失败: $current" -ForegroundColor Red
            return $null
        }
        $hit = Find-ChildDir $listing.dirs $seg
        if (-not $hit) {
            Write-Host "✗ 云端未找到匹配「$seg」的目录（当前层级: $current）" -ForegroundColor Red
            Write-Host "  该层实际子目录:"
            @($listing.dirs) | ForEach-Object { Write-Host "    - $($_.name)" }
            Write-Host "  处理：把脚本里的 `$baseSegs 改成仍能匹配的名称，或用 -BaseGns <gns:// id> 指定根目录。" -ForegroundColor Yellow
            return $null
        }
        $current = "$current/$($hit.name)"
        $gns = $hit.id
    }
    $listing = Get-CloudListing $gns
    if (-not $listing) {
        Write-Host "✗ 读取云端需求规格说明书根目录失败: $gns" -ForegroundColor Red
        return $null
    }

    # 3) 写入缓存：之后直接按 gns id 定位，云端再改名也不受影响
    try {
        if (-not (Test-Path $cacheDir)) { New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null }
        @{ gns = $gns; path = $current; resolvedAt = (Get-Date).ToString('s') } |
            ConvertTo-Json -Compress | Set-Content -Path $cacheFile -Encoding UTF8
    }
    catch { }
    return @{ gns = $gns; path = $current; listing = $listing }
}

$root = Resolve-RequirementRoot
if (-not $root) { exit 1 }

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

Write-Host "云端基路径: $($root.path)"
Write-Host "本地基路径: $local"

$total = [Diagnostics.Stopwatch]::StartNew()
$failed = @()
foreach ($cloudDir in $map.Keys) {
    $localDir = Join-Path $local $map[$cloudDir]
    Write-Host "=== $cloudDir → $($map[$cloudDir]) ==="
    # 按 gns id 同步（而非拼路径）：云端改名不影响；仅在根目录列表里按名字定位子目录
    $hit = Find-ChildDir $root.listing.dirs $cloudDir
    if (-not $hit) {
        $failed += $cloudDir
        Write-Host "✗ 云端根目录下找不到匹配「$cloudDir」的目录" -ForegroundColor Red
        Write-Host "  实际子目录:"
        @($root.listing.dirs) | ForEach-Object { Write-Host "    - $($_.name)" }
        continue
    }
    $out = anyshare sync $hit.id $localDir 2>&1
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