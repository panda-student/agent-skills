#!/usr/bin/env python3
"""重建 .gitignore 的私有技能白名单段。

原则:本仓库只同步自研私有技能;公共技能(安装器写入 .skill-lock.json 且
sourceType=github 的)默认全部忽略。
新增自研技能后重跑本脚本即可入白名单;pre-commit 钩子(scripts/hooks/)会自动执行。
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BEGIN = '# >>> skills-private-whitelist(由 scripts/update-gitignore.py 生成,勿手改)'
END = '# <<< skills-private-whitelist'


def public_names():
    """公共技能名集合 = 锁文件 github 来源"""
    pub = set()
    try:
        data = json.load(open(os.path.join(ROOT, '.skill-lock.json'), encoding='utf-8'))
        for name, info in (data.get('skills') or {}).items():
            if info.get('sourceType') == 'github':
                pub.add(name)
    except Exception:
        pass
    return pub


def main():
    skills_dir = os.path.join(ROOT, 'skills')
    dirs = sorted(d for d in os.listdir(skills_dir) if os.path.isdir(os.path.join(skills_dir, d)))
    pub = public_names()
    private = [d for d in dirs if d not in pub]

    section = '\n'.join([BEGIN, 'skills/*'] + [f'!skills/{d}/' for d in private] + [END])
    gi = os.path.join(ROOT, '.gitignore')
    text = open(gi, encoding='utf-8').read()
    if BEGIN in text:
        text = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END), section, text, flags=re.S)
    else:
        text = text.rstrip('\n') + '\n\n' + section + '\n'
    open(gi, 'w', encoding='utf-8', newline='\n').write(text)

    skipped = sorted(set(dirs) & pub)
    msg = f'私有技能白名单 {len(private)} 个;忽略公共技能 {len(skipped)} 个'
    if skipped:
        msg += ': ' + ', '.join(skipped)
    print(msg + '\n(新增自研技能后重跑本脚本,或直接 git commit 由钩子自动处理)')


if __name__ == '__main__':
    main()
