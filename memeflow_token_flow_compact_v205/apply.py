#!/usr/bin/env python3
from pathlib import Path
import datetime, json, re, shutil, sys

ROOT = Path(sys.argv[1]).resolve()
BACKUP = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 and sys.argv[2] != "-" else None
APP = ROOT / "memeflow-app"
CSS = APP / "system-tokens.css"
HTML = APP / "system-tokens.html"
HERE = Path(__file__).resolve().parent

for p in (CSS, HTML):
    if not p.is_file():
        raise SystemExit(f"ERROR: missing {p}")

css = CSS.read_text(encoding="utf-8")
html = HTML.read_text(encoding="utf-8")

required_css = [
    ".flow-token",
    ".token-list",
    ".flow-hero",
    ".summary-card",
    ".flow-toolbar",
    ".token-head",
    ".token-avatar",
    ".token-name",
]
missing = [s for s in required_css if s not in css]
if missing:
    raise SystemExit("ERROR: Token Flow structure mismatch; missing CSS selectors: " + ", ".join(missing))

if not re.search(r'href=["\']/system-tokens\.css(?:\?[^"\']*)?["\']', html, flags=re.I):
    raise SystemExit("ERROR: system-tokens.css link not found in system-tokens.html")

if BACKUP:
    BACKUP.mkdir(parents=True, exist_ok=True)
    for p in (CSS, HTML):
        shutil.copy2(p, BACKUP / p.name)
    (BACKUP / "manifest.json").write_text(
        json.dumps({"files":["system-tokens.css","system-tokens.html"]}, indent=2),
        encoding="utf-8"
    )

start = "/* ===== MEMEFLOW_TOKEN_FLOW_COMPACT_V205 ====="
end = "/* ===== /MEMEFLOW_TOKEN_FLOW_COMPACT_V205 ===== */"

# Reinstall safe.
pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
css = pattern.sub("", css).rstrip() + "\n\n" + (HERE / "v205.css").read_text(encoding="utf-8").strip() + "\n"

html, n = re.subn(
    r'href=(["\'])/system-tokens\.css(?:\?[^"\']*)?\1',
    'href="/system-tokens.css?v=token-flow-compact-v205-20260922"',
    html,
    count=1,
    flags=re.I
)
if n != 1:
    raise SystemExit("ERROR: CSS cache-bust replacement failed")

CSS.write_text(css, encoding="utf-8")
HTML.write_text(html, encoding="utf-8")
print("V205 APPLY COMPLETE")
