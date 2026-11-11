#!/usr/bin/env python3
"""QQ Mail CLI (IMAP + SMTP), Python 3.8+ stdlib only.

Self-contained: no third-party packages.
Secret is read from %TEMP%\qqmail-auth.txt and never printed.

Commands:
  check   [--n 10]                         login + recent messages
  list    [--n 20]                         alias of check
  search  [--subject S] [--from F] [--since D] [--n 20]
  read    <uid>
  attachments <uid> [--dir PATH]
  folders
  draft   --subject S [--to A] [--cc B] [--body T | --body-file F] [--attach P]
  send    --subject S --to A [--cc B] [--body T | --body-file F] [--attach P]
"""
import argparse
import email
import imaplib
import json
import mimetypes
import os
import re
import smtplib
import sys
import tempfile
import time
from email.header import decode_header, make_header
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from pathlib import Path

BASE = Path(os.environ.get("USERPROFILE", Path.home())) / ".qqmail"
CONFIG = BASE / "config.json"
AUTH = Path(tempfile.gettempdir()) / "qqmail-auth.txt"
DOWNLOADS = BASE / "downloads"

DEFAULT_CONFIG = {
    "account": "842913787@qq.com",
    "imap_host": "imap.qq.com",
    "imap_port": 993,
    "smtp_host": "smtp.qq.com",
    "smtp_port": 465,
}

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def load():
    cfg = dict(DEFAULT_CONFIG)
    if CONFIG.exists():
        cfg.update(json.loads(CONFIG.read_text(encoding="utf-8")))
    if not AUTH.exists():
        sys.exit(
            f"missing secret file: {AUTH}\n"
            "Inject the QQ Mail 授权码 there via the vault-ops skill first. "
            "Never commit this file."
        )
    auth = AUTH.read_text(encoding="utf-8-sig").strip()
    if not auth:
        sys.exit("secret file is empty")
    return cfg, auth


def decode(s):
    if s is None:
        return ""
    try:
        return str(make_header(decode_header(s)))
    except Exception:
        return s


def connect(cfg, auth, folder="INBOX", readonly=True):
    m = imaplib.IMAP4_SSL(cfg["imap_host"], cfg["imap_port"], timeout=30)
    m.login(cfg["account"], auth)
    if folder:
        typ, data = m.select(folder, readonly=readonly)
        if typ != "OK":
            raise imaplib.IMAP4.error(f"select {folder} failed: {data}")
    return m


def header_of(m, uid):
    typ, data = m.uid("FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)])")
    if typ != "OK" or not data or not data[0]:
        return {}
    msg = email.message_from_bytes(data[0][1])
    return {k.lower(): decode(msg.get(k)) for k in ("From", "To", "Subject", "Date")}


def print_rows(m, uids, n):
    for uid in uids[-n:]:
        h = header_of(m, uid)
        print(
            f"uid={uid.decode():>7}  {h.get('date','')[:31]:<31}  "
            f"{h.get('from','')[:30]:<30}  {h.get('subject','')[:60]}"
        )


def imap_search(m, subject=None, from_=None, since=None):
    crit = []
    if subject:
        crit += ["SUBJECT", f'"{subject}"']
    if from_:
        crit += ["FROM", f'"{from_}"']
    if since:
        crit += ["SINCE", since]
    if not crit:
        return ["ALL"]
    return crit


def has_non_ascii(s):
    return any(ord(ch) > 127 for ch in str(s))


def client_filter(m, args, scan=500):
    typ, data = m.uid("SEARCH", None, "ALL")
    alluids = (data[0].split() if data and data[0] else [])[-scan:]
    hits = []
    for u in alluids:
        h = header_of(m, u)
        subj = h.get("subject", "")
        frm = h.get("from", "")
        if args.subject and args.subject.lower() not in subj.lower():
            continue
        if args.from_ and args.from_.lower() not in frm.lower():
            continue
        hits.append(u)
    return hits, scan


def cmd_check(args, folder="INBOX"):
    cfg, auth = load()
    m = connect(cfg, auth, folder)
    try:
        typ, data = m.status(folder, "(MESSAGES UNSEEN)")
        print("account:", cfg["account"])
        print("folder:", folder, data[0].decode() if data and data[0] else "?")
        typ, data = m.uid("SEARCH", None, "ALL")
        uids = data[0].split() if data and data[0] else []
        print("total messages:", len(uids))
        print_rows(m, uids, args.n)
    finally:
        try:
            m.logout()
        except Exception:
            pass


def cmd_search(args):
    cfg, auth = load()
    m = connect(cfg, auth, args.folder)
    try:
        crit = imap_search(m, args.subject, args.from_, args.since)
        uids = None
        if crit:
            try:
                if any(has_non_ascii(c) for c in crit):
                    bcrit = ["CHARSET", "UTF-8"]
                    for c in crit:
                        bcrit.append(c.encode("utf-8") if has_non_ascii(c) else c)
                    typ, data = m.uid("SEARCH", None, *bcrit)
                else:
                    typ, data = m.uid("SEARCH", None, *crit)
                if typ == "OK":
                    uids = data[0].split() if data and data[0] else []
            except Exception as e:
                print("server search unavailable:", type(e).__name__)
        else:
            typ, data = m.uid("SEARCH", None, "ALL")
            uids = data[0].split() if data and data[0] else []

        if uids is None:
            uids, scan = client_filter(m, args)
            print(f"matched: {len(uids)} (client-side over newest {scan})")
        else:
            print(f"matched: {len(uids)}")
        print_rows(m, uids, args.n)
    finally:
        try:
            m.logout()
        except Exception:
            pass


def fetch_message(m, uid):
    typ, data = m.uid("FETCH", uid, "(RFC822)")
    if typ != "OK" or not data or not data[0]:
        sys.exit(f"uid {uid} not found")
    return email.message_from_bytes(data[0][1])


def cmd_read(args):
    cfg, auth = load()
    m = connect(cfg, auth, args.folder)
    try:
        msg = fetch_message(m, args.uid)
        print("From:   ", decode(msg.get("From")))
        print("To:     ", decode(msg.get("To")))
        print("Subject:", decode(msg.get("Subject")))
        print("Date:   ", decode(msg.get("Date")))
        print("-" * 60)
        body = None
        charset = "utf-8"
        if msg.is_multipart():
            for part in msg.walk():
                disp = str(part.get("Content-Disposition") or "")
                if part.get_content_type() == "text/plain" and "attachment" not in disp:
                    body = part.get_payload(decode=True)
                    charset = part.get_content_charset() or "utf-8"
                    break
            if body is None:
                for part in msg.walk():
                    if part.get_content_type() == "text/html" and "attachment" not in str(part.get("Content-Disposition") or ""):
                        body = part.get_payload(decode=True)
                        charset = part.get_content_charset() or "utf-8"
                        break
        else:
            body = msg.get_payload(decode=True)
            charset = msg.get_content_charset() or "utf-8"
        if body is None:
            print("[no text part]")
        else:
            print(body.decode(charset, errors="replace"))
    finally:
        try:
            m.logout()
        except Exception:
            pass


def safe_name(name):
    name = os.path.basename(name.replace("\\", "/"))
    return re.sub(r'[<>:"/\\|?*]', "_", name) or "attachment"


def iter_attachments(msg):
    for part in msg.walk():
        fn = part.get_filename()
        if not fn:
            continue
        if part.get_content_disposition() != "attachment" and part.get_content_maintype() == "multipart":
            continue
        yield decode(fn), part


def cmd_attachments(args):
    cfg, auth = load()
    m = connect(cfg, auth, args.folder)
    try:
        msg = fetch_message(m, args.uid)
        outdir = Path(args.dir) if args.dir else (DOWNLOADS / str(args.uid))
        outdir.mkdir(parents=True, exist_ok=True)
        found = 0
        for name, part in iter_attachments(msg):
            data = part.get_payload(decode=True)
            if data is None:
                continue
            path = outdir / safe_name(name)
            path.write_bytes(data)
            found += 1
            print(f"saved: {path} ({len(data)} bytes)")
        if not found:
            print("no attachments")
        else:
            print(f"total: {found} -> {outdir}")
    finally:
        try:
            m.logout()
        except Exception:
            pass


def list_folders(m):
    typ, data = m.list()
    out = []
    for line in data or []:
        out.append(line.decode("utf-8", "replace") if isinstance(line, bytes) else str(line))
    return out


def pick_drafts(folders):
    for s in folders:
        if '"Drafts"' in s or "草稿" in s:
            return s.split('"')[-2]
    return "Drafts"


def cmd_folders(args):
    cfg, auth = load()
    m = connect(cfg, auth, None)
    try:
        m.login_ok = True
        for s in list_folders(m):
            print(s)
    finally:
        try:
            m.logout()
        except Exception:
            pass


def build_message(cfg, args, need_to=False):
    msg = EmailMessage()
    msg["From"] = cfg["account"]
    to = args.to or ([] if need_to else [cfg["account"]])
    if need_to and not to:
        sys.exit("--to is required for send")
    msg["To"] = ", ".join(to)
    if getattr(args, "cc", None):
        msg["Cc"] = ", ".join(args.cc)
    msg["Subject"] = args.subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid()
    body = Path(args.body_file).read_text(encoding="utf-8") if args.body_file else args.body
    msg.set_content(body or "")
    for p in getattr(args, "attach", None) or []:
        path = Path(p)
        if not path.exists():
            sys.exit(f"attachment not found: {p}")
        ctype, encoding = mimetypes.guess_type(path.name)
        if ctype is None or encoding is not None:
            ctype = "application/octet-stream"
        maintype, subtype = ctype.split("/", 1)
        msg.add_attachment(path.read_bytes(), maintype=maintype, subtype=subtype, filename=path.name)
    return msg


def cmd_draft(args):
    cfg, auth = load()
    msg = build_message(cfg, args)
    m = connect(cfg, auth, None)
    try:
        folder = pick_drafts(list_folders(m))
        typ, data = m.append(folder, "\\Draft", imaplib.Time2Internaldate(time.time()), msg.as_bytes())
        if typ != "OK":
            sys.exit(f"append failed: {typ} {data}")
        subj = decode(msg["Subject"])
        print(f"draft saved to [{folder}]: {subj}")
    finally:
        try:
            m.logout()
        except Exception:
            pass


def cmd_send(args):
    cfg, auth = load()
    msg = build_message(cfg, args, need_to=True)
    with smtplib.SMTP_SSL(cfg["smtp_host"], cfg["smtp_port"], timeout=30) as s:
        s.login(cfg["account"], auth)
        s.send_message(msg)
    print("sent:", decode(msg["Subject"]), "->", msg["To"])


def add_msg_opts(p, to_required=False):
    p.add_argument("--to", action="append", required=to_required)
    p.add_argument("--cc", action="append")
    p.add_argument("--subject", required=True)
    p.add_argument("--body", default="")
    p.add_argument("--body-file")
    p.add_argument("--attach", action="append", help="attachment path; repeatable")


def main():
    p = argparse.ArgumentParser(description="QQ Mail CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("check", help="login and show recent messages")
    c.add_argument("--n", type=int, default=10)
    c.add_argument("--folder", default="INBOX")
    c.set_defaults(func=lambda a: cmd_check(a, a.folder))

    l = sub.add_parser("list", help="alias of check")
    l.add_argument("--n", type=int, default=20)
    l.add_argument("--folder", default="INBOX")
    l.set_defaults(func=lambda a: cmd_check(a, a.folder))

    s = sub.add_parser("search", help="search a folder")
    s.add_argument("--subject")
    s.add_argument("--from", dest="from_")
    s.add_argument("--since", help="e.g. 01-Jan-2026")
    s.add_argument("--n", type=int, default=20)
    s.add_argument("--folder", default="INBOX")
    s.set_defaults(func=cmd_search)

    r = sub.add_parser("read", help="print one message by uid")
    r.add_argument("uid")
    r.add_argument("--folder", default="INBOX")
    r.set_defaults(func=cmd_read)

    a = sub.add_parser("attachments", help="download attachments of one message")
    a.add_argument("uid")
    a.add_argument("--dir")
    a.add_argument("--folder", default="INBOX")
    a.set_defaults(func=cmd_attachments)

    fo = sub.add_parser("folders", help="list IMAP folders")
    fo.set_defaults(func=cmd_folders)

    d = sub.add_parser("draft", help="save to Drafts")
    add_msg_opts(d)
    d.set_defaults(func=cmd_draft)

    e = sub.add_parser("send", help="send a message")
    add_msg_opts(e, to_required=True)
    e.set_defaults(func=cmd_send)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()