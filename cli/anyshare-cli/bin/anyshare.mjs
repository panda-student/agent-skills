#!/usr/bin/env node
// anyshare-cli 入口：命令分发（编排层，不含业务逻辑）
import { cmdWhoami, cmdLibs, cmdLs, cmdDir, cmdDownload, cmdSync, cmdToken, cmdLogin, cmdCredSetup, cmdLogout } from '../src/commands.mjs';

const args = process.argv.slice(2);
const cmd = args[0];
const hasFlag = (name) => args.includes(name);
const positional = (i) => args[i] && !args[i].startsWith('-') ? args[i] : undefined;

function usage() {
  console.log(`anyshare-cli — AnyShare 文档云命令行（wendang.jomoo.com）

登录与 token:
  anyshare login                登录并保存 token（已配凭据时无头直连；否则唤起 Edge 静默捕获）
  anyshare cred-setup           验证 vault 中的 SSO 凭据（密码不再弹窗/落盘，操作见 vault-ops 技能）
  anyshare whoami               token 状态（有效性/来源/保存时间）
  anyshare token [--refresh]    输出当前 token 供 curl 复用（--refresh 强制走刷新链）
  anyshare logout               清除本地 token

查:
  anyshare libs                 文档库列表（name/type/gns id）
  anyshare ls [路径] [--json]    列目录内容（路径 = 文档库名/子目录/... 或 gns:// id；
                                缺省列出配置的默认目录；--json 输出含 gns id 的单行 JSON，供脚本定位）
  anyshare dir [路径]            查看/设置默认进入目录（写入配置，附网页入口 URL）

下:
  anyshare download <路径> [目标] 下载文件（别名 dl）。路径支持 gns:// id 或
                                "文档库名/子目录/文件名"；目标为已存在目录时落到该目录
                                （用云端文件名），否则视为目标文件路径；缺省落当前目录

同步:
  anyshare sync <云端路径> <本地目录> [--dry-run]
                                递归同步云端目录到本地。只对比更新时间（云端新于本地
                                才下载，不看大小），本地多出的文件不删除；云端
                                「历史版本」子目录默认跳过；--dry-run 仅预览待下载清单

token 刷新链（401 自动触发）:
  已配凭据 → 无头 UCenter 链（零 UI）→ 失败回落浏览器：唤起 Edge 打开首页，
  静默 SSO 回路自动换发新 token，全程无需手工复制 token。
`);
}

try {
  switch (cmd) {
    case 'whoami': await cmdWhoami(); break;
    case 'libs': await cmdLibs(); break;
    case 'ls': await cmdLs(positional(1), { json: hasFlag('--json') }); break;
    case 'dir': await cmdDir(positional(1)); break;
    case 'download':
    case 'dl': await cmdDownload(positional(1), positional(2)); break;
    case 'sync': await cmdSync(positional(1), positional(2), { dryRun: hasFlag('--dry-run') }); break;
    case 'token': await cmdToken({ refresh: hasFlag('--refresh') }); break;
    case 'login': await cmdLogin(); break;
    case 'cred-setup': await cmdCredSetup(); break;
    case 'logout': cmdLogout(); break;
    default: usage();
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
