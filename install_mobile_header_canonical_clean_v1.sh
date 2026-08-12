#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"
APP="$ROOT/memeflow-app"
[[ -f "$APP/index.html" ]] || APP="$ROOT"
INDEX="$APP/index.html"

[[ -f "$INDEX" ]] || {
  echo "ERROR: index.html not found. Run this from ~/workspace."
  exit 1
}

PATCH_DIR="$APP/.memeflow-patches/mobile-header-canonical-v1"
mkdir -p "$PATCH_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$PATCH_DIR/index.html.$STAMP.bak"
WORK="$PATCH_DIR/index.html.$STAMP.work"

cp "$INDEX" "$BACKUP"
cp "$INDEX" "$WORK"

rollback(){
  cp "$BACKUP" "$INDEX" 2>/dev/null || true
  rm -f "$WORK"
}
trap 'echo "ERROR: Mobile Header Canonical V1 failed; restoring exact pre-install index.html."; rollback' ERR

python3 - "$WORK" <<'PY'
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")

MARKER = "MF_MOBILE_HEADER_CANONICAL_V1"

if MARKER in src:
    raise SystemExit("Mobile Header Canonical V1 is already installed.")

required_dom = [
    'class="topbar"',
    'class="top-left"',
    'class="top-actions"',
    'class="topbar-conn"',
    'id="topPlanBadge"',
    'id="topbarConn"',
    'id="mobileConnWallet"',
    'id="mobileConnRpc"',
]
missing = [token for token in required_dom if token not in src]
if missing:
    raise SystemExit(
        "Required header DOM not found: " + ", ".join(missing) + ". Nothing changed."
    )

if src.count('id="memeflow-consolidated-css"') != 1:
    raise SystemExit("Expected exactly one #memeflow-consolidated-css style owner.")

scripts_before = re.findall(
    r"<script\b[^>]*>.*?</script>",
    src,
    flags=re.I | re.S
)
style_count_before = len(re.findall(r"<style\b", src, flags=re.I))

TARGET_TOKENS = (
    ".topbar",
    ".top-left",
    ".top-actions",
    ".topbar-conn",
    ".topbar-conn-item",
    "#walletConnectTop",
    ".top-plan-badge",
    ".mode-indicator",
    "#connectionStrip",
)

def is_target_selector(selector: str) -> bool:
    compact = re.sub(r"\s+", " ", selector).strip()
    return any(token in compact for token in TARGET_TOKENS)

def split_selectors(text: str):
    out, start = [], 0
    depth_paren = depth_bracket = 0
    quote = None
    escape = False
    for i, ch in enumerate(text):
        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch == "(":
            depth_paren += 1
        elif ch == ")":
            depth_paren = max(0, depth_paren - 1)
        elif ch == "[":
            depth_bracket += 1
        elif ch == "]":
            depth_bracket = max(0, depth_bracket - 1)
        elif ch == "," and depth_paren == 0 and depth_bracket == 0:
            out.append(text[start:i].strip())
            start = i + 1
    out.append(text[start:].strip())
    return [x for x in out if x]

def find_open_or_semicolon(text, start):
    quote = None
    escape = False
    comment = False
    i = start
    while i < len(text):
        if comment:
            if text.startswith("*/", i):
                comment = False
                i += 2
                continue
            i += 1
            continue
        if quote:
            if escape:
                escape = False
            elif text[i] == "\\":
                escape = True
            elif text[i] == quote:
                quote = None
            i += 1
            continue
        if text.startswith("/*", i):
            comment = True
            i += 2
            continue
        ch = text[i]
        if ch in ("'", '"'):
            quote = ch
            i += 1
            continue
        if ch == "{":
            return i, "{"
        if ch == ";":
            return i, ";"
        i += 1
    return len(text), None

def matching_brace(text, open_pos):
    depth = 1
    quote = None
    escape = False
    comment = False
    i = open_pos + 1
    while i < len(text):
        if comment:
            if text.startswith("*/", i):
                comment = False
                i += 2
                continue
            i += 1
            continue
        if quote:
            if escape:
                escape = False
            elif text[i] == "\\":
                escape = True
            elif text[i] == quote:
                quote = None
            i += 1
            continue
        if text.startswith("/*", i):
            comment = True
            i += 2
            continue
        ch = text[i]
        if ch in ("'", '"'):
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise RuntimeError("Unbalanced CSS braces.")

def media_is_mobile(prelude):
    p = re.sub(r"/\*.*?\*/", "", prelude, flags=re.S | re.I)
    if not re.match(r"\s*@media\b", p, flags=re.I):
        return False
    widths = re.findall(
        r"max-width\s*:\s*(\d+(?:\.\d+)?)px",
        p,
        flags=re.I
    )
    return any(float(w) <= 820 for w in widths)

stats = {
    "removed_rules": 0,
    "trimmed_grouped_rules": 0,
    "removed_empty_styles": 0,
}

def process_css(text, mobile_context=False):
    out = []
    pos = 0
    n = len(text)

    while pos < n:
        if text[pos].isspace():
            start = pos
            while pos < n and text[pos].isspace():
                pos += 1
            out.append(text[start:pos])
            continue

        if text.startswith("/*", pos):
            end = text.find("*/", pos + 2)
            if end == -1:
                out.append(text[pos:])
                break
            out.append(text[pos:end + 2])
            pos = end + 2
            continue

        boundary, kind = find_open_or_semicolon(text, pos)

        if kind is None:
            out.append(text[pos:])
            break

        prelude = text[pos:boundary]

        if kind == ";":
            out.append(text[pos:boundary + 1])
            pos = boundary + 1
            continue

        close = matching_brace(text, boundary)
        body = text[boundary + 1:close]
        clean_prelude = re.sub(r"/\*.*?\*/", "", prelude, flags=re.S).strip()

        if clean_prelude.startswith("@"):
            child_mobile = mobile_context or media_is_mobile(clean_prelude)
            processed = process_css(body, child_mobile)
            semantic = re.sub(r"/\*.*?\*/", "", processed, flags=re.S).strip()
            if semantic:
                out.append(prelude + "{" + processed + "}")
            pos = close + 1
            continue

        if mobile_context:
            selectors = split_selectors(prelude)
            kept = [s for s in selectors if not is_target_selector(s)]
            removed = len(selectors) - len(kept)

            if removed:
                if not kept:
                    stats["removed_rules"] += 1
                    pos = close + 1
                    continue
                stats["trimmed_grouped_rules"] += 1
                out.append(", ".join(kept) + "{" + body + "}")
                pos = close + 1
                continue

        out.append(prelude + "{" + body + "}")
        pos = close + 1

    return "".join(out)

style_rx = re.compile(
    r"<style\b(?P<attrs>[^>]*)>(?P<css>.*?)</style>",
    flags=re.I | re.S
)

rebuilt = []
last = 0

for match in style_rx.finditer(src):
    rebuilt.append(src[last:match.start()])
    attrs = match.group("attrs")
    css = match.group("css")
    cleaned = process_css(css, False)

    semantic = re.sub(r"/\*.*?\*/", "", cleaned, flags=re.S).strip()
    if semantic:
        rebuilt.append("<style" + attrs + ">" + cleaned + "</style>")
    else:
        stats["removed_empty_styles"] += 1

    last = match.end()

rebuilt.append(src[last:])
cleaned_html = "".join(rebuilt)

survivors = []

for match in style_rx.finditer(cleaned_html):
    css = match.group("css")

    def collect(text, mobile_context=False):
        pos = 0
        while pos < len(text):
            if text[pos].isspace():
                pos += 1
                continue
            if text.startswith("/*", pos):
                end = text.find("*/", pos + 2)
                if end == -1:
                    return
                pos = end + 2
                continue

            boundary, kind = find_open_or_semicolon(text, pos)
            if kind is None:
                return
            if kind == ";":
                pos = boundary + 1
                continue

            close = matching_brace(text, boundary)
            prelude = text[pos:boundary]
            body = text[boundary + 1:close]
            clean = re.sub(r"/\*.*?\*/", "", prelude, flags=re.S).strip()

            if clean.startswith("@"):
                collect(body, mobile_context or media_is_mobile(clean))
            elif mobile_context:
                for selector in split_selectors(prelude):
                    if is_target_selector(selector):
                        survivors.append(selector)

            pos = close + 1

    collect(css, False)

if survivors:
    raise SystemExit(
        "Mobile header cleanup verification failed; surviving rules: "
        + " | ".join(survivors[:8])
    )

canonical = r'''
/* MF_MOBILE_HEADER_CANONICAL_V1
   ONE mobile header owner.
   Row 1: PAPER MODE | FREE PLAN | wallet icon
   Row 2: Wallet status | RPC status
*/
@media(max-width:820px){
  #connectionStrip{
    display:none!important;
    height:0!important;
    margin:0!important;
    padding:0!important;
    overflow:hidden!important;
  }

  .topbar{
    position:sticky!important;
    top:calc(6px + env(safe-area-inset-top))!important;
    z-index:60!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    grid-template-areas:
      "left actions"
      "conn conn"!important;
    align-items:center!important;
    column-gap:10px!important;
    row-gap:7px!important;
    min-height:0!important;
    width:auto!important;
    margin:0 0 12px!important;
    padding:10px 12px 7px!important;
    border:1px solid rgba(126,151,176,.16)!important;
    border-radius:18px!important;
    background:rgba(5,8,12,.92)!important;
    -webkit-backdrop-filter:blur(22px) saturate(120%)!important;
    backdrop-filter:blur(22px) saturate(120%)!important;
    box-shadow:0 12px 32px rgba(0,0,0,.24)!important;
    overflow:visible!important;
    transform:none!important;
  }

  .topbar .top-left{
    grid-area:left!important;
    display:flex!important;
    align-items:center!important;
    min-width:0!important;
    width:auto!important;
    gap:8px!important;
    margin:0!important;
    padding:0!important;
  }

  .topbar .top-left .mode-indicator{
    display:none!important;
  }

  .topbar .top-left>.chip,
  .topbar .top-left>.top-plan-badge{
    flex:0 1 auto!important;
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    min-width:0!important;
    height:42px!important;
    min-height:42px!important;
    max-height:42px!important;
    margin:0!important;
    padding:0 14px!important;
    border-radius:999px!important;
    font-size:10px!important;
    font-weight:850!important;
    line-height:1!important;
    letter-spacing:.13em!important;
    white-space:nowrap!important;
    text-transform:uppercase!important;
    box-shadow:none!important;
  }

  .topbar .top-left>.chip{
    border:1px solid transparent!important;
    background:rgba(255,255,255,.045)!important;
    color:#aab5c3!important;
  }

  .topbar .top-left>.top-plan-badge{
    border:1px solid rgba(111,223,255,.18)!important;
    background:rgba(255,255,255,.012)!important;
    color:#f2f6f9!important;
  }

  .topbar .top-actions{
    grid-area:actions!important;
    display:flex!important;
    align-items:center!important;
    justify-content:flex-end!important;
    width:auto!important;
    min-width:42px!important;
    gap:0!important;
    margin:0!important;
    padding:0!important;
  }

  .topbar .top-actions>.chip,
  .topbar .top-actions #focusToggle,
  .topbar .top-actions #presentationBtn,
  .topbar .top-actions #themeToggle{
    display:none!important;
  }

  .topbar #walletConnectTop{
    position:relative!important;
    inset:auto!important;
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    flex:0 0 42px!important;
    width:42px!important;
    min-width:42px!important;
    max-width:42px!important;
    height:42px!important;
    min-height:42px!important;
    max-height:42px!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    border-radius:0!important;
    outline:0!important;
    background:transparent!important;
    background-image:none!important;
    box-shadow:none!important;
    color:transparent!important;
    font-size:0!important;
    line-height:0!important;
    text-indent:-9999px!important;
    overflow:visible!important;
    transform:none!important;
  }

  .topbar #walletConnectTop:hover,
  .topbar #walletConnectTop:focus,
  .topbar #walletConnectTop:focus-visible,
  .topbar #walletConnectTop:active,
  .topbar #walletConnectTop.connected{
    border:0!important;
    outline:0!important;
    background:transparent!important;
    box-shadow:none!important;
    transform:none!important;
  }

  .topbar #walletConnectTop>*{
    display:none!important;
  }

  .topbar #walletConnectTop::after{
    content:none!important;
    display:none!important;
  }

  .topbar #walletConnectTop::before{
    content:""!important;
    display:block!important;
    position:static!important;
    width:27px!important;
    height:27px!important;
    margin:0!important;
    padding:0!important;
    background:var(--muted,#8d99a8)!important;
    opacity:1!important;
    box-shadow:none!important;
    transform:none!important;
    -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3h11'/%3E%3Cpath d='M20 11h-4a2 2 0 0 0 0 4h4'/%3E%3C/g%3E%3Ccircle cx='16' cy='13' r='.75' fill='black'/%3E%3C/svg%3E") center/contain no-repeat!important;
    mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3h11'/%3E%3Cpath d='M20 11h-4a2 2 0 0 0 0 4h4'/%3E%3C/g%3E%3Ccircle cx='16' cy='13' r='.75' fill='black'/%3E%3C/svg%3E") center/contain no-repeat!important;
  }

  .topbar #walletConnectTop.connected::before{
    background:var(--green,#5de2a5)!important;
  }

  .topbar .topbar-conn{
    grid-area:conn!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
    align-items:center!important;
    flex:initial!important;
    width:100%!important;
    min-width:0!important;
    min-height:25px!important;
    gap:12px!important;
    margin:0!important;
    padding:6px 2px 1px!important;
    border-top:1px solid rgba(126,151,176,.15)!important;
    overflow:hidden!important;
  }

  .topbar .topbar-conn-item{
    display:flex!important;
    align-items:center!important;
    min-width:0!important;
    gap:6px!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    color:var(--muted)!important;
    font-size:10px!important;
    font-weight:500!important;
    line-height:1!important;
    overflow:hidden!important;
  }

  .topbar .topbar-conn-item+.topbar-conn-item{
    justify-content:flex-end!important;
    margin:0!important;
    padding:0!important;
    border-left:0!important;
  }

  .topbar .topbar-conn-item i{
    flex:0 0 7px!important;
    width:7px!important;
    height:7px!important;
    margin:0!important;
    border-radius:50%!important;
    background:var(--muted)!important;
    box-shadow:none!important;
  }

  .topbar .topbar-conn-item.good i{
    background:var(--green)!important;
    box-shadow:0 0 7px rgba(81,231,168,.45)!important;
  }

  .topbar .topbar-conn-item.warn i{
    background:var(--yellow)!important;
    box-shadow:0 0 7px rgba(246,199,95,.35)!important;
  }

  .topbar .topbar-conn-item.bad i{
    background:var(--red)!important;
    box-shadow:0 0 7px rgba(255,101,118,.35)!important;
  }

  .topbar .topbar-conn-item span{
    min-width:0!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
}

@media(max-width:390px){
  .topbar{
    column-gap:8px!important;
    padding:9px 10px 7px!important;
  }

  .topbar .top-left{
    gap:6px!important;
  }

  .topbar .top-left>.chip,
  .topbar .top-left>.top-plan-badge{
    height:39px!important;
    min-height:39px!important;
    max-height:39px!important;
    padding:0 11px!important;
    font-size:9px!important;
    letter-spacing:.11em!important;
  }

  .topbar #walletConnectTop{
    flex-basis:39px!important;
    width:39px!important;
    min-width:39px!important;
    max-width:39px!important;
    height:39px!important;
    min-height:39px!important;
    max-height:39px!important;
  }

  .topbar #walletConnectTop::before{
    width:25px!important;
    height:25px!important;
  }

  .topbar .topbar-conn{
    gap:8px!important;
  }

  .topbar .topbar-conn-item{
    font-size:9px!important;
  }
}
'''

owner_rx = re.compile(
    r'(<style\b[^>]*\bid=["\']memeflow-consolidated-css["\'][^>]*>)'
    r'(?P<body>.*?)'
    r'(</style>)',
    flags=re.I | re.S
)
owner_matches = list(owner_rx.finditer(cleaned_html))
if len(owner_matches) != 1:
    raise SystemExit("Could not isolate the consolidated CSS owner after cleanup.")

m = owner_matches[0]
new_owner = (
    m.group(1)
    + m.group("body").rstrip()
    + "\n\n"
    + canonical.strip()
    + "\n"
    + m.group(3)
)
final_html = cleaned_html[:m.start()] + new_owner + cleaned_html[m.end():]

scripts_after = re.findall(
    r"<script\b[^>]*>.*?</script>",
    final_html,
    flags=re.I | re.S
)
style_count_after = len(re.findall(r"<style\b", final_html, flags=re.I))

checks = {
    "JS byte-identical": scripts_after == scripts_before,
    "one canonical owner": final_html.count(MARKER) == 1,
    "no new style tags": style_count_after <= style_count_before,
    "topbar DOM preserved": final_html.count('class="topbar"') == 1,
    "topPlanBadge preserved": final_html.count('id="topPlanBadge"') == 1,
    "topbarConn preserved": final_html.count('id="topbarConn"') == 1,
    "wallet status preserved": final_html.count('id="mobileConnWallet"') == 1,
    "rpc status preserved": final_html.count('id="mobileConnRpc"') == 1,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Final verification failed: " + ", ".join(failed))

path.write_text(final_html, encoding="utf-8")

print("Mobile header consolidation prepared.")
print(f"Legacy mobile-header rules removed: {stats['removed_rules']}")
print(f"Grouped rules trimmed safely: {stats['trimmed_grouped_rules']}")
print(f"Empty legacy style blocks removed: {stats['removed_empty_styles']}")
print(f"<style> count: {style_count_before} -> {style_count_after}")
print("<script> bodies byte-identical: PASS")
print("Canonical mobile header owners: ONE")
PY

cp "$WORK" "$INDEX"
rm -f "$WORK"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
BACKUP=$BACKUP
EOF

trap - ERR

echo
echo "OK: MOBILE HEADER CANONICAL V1 installed cleanly."
echo
echo "Mobile header CSS owner: ONE"
echo "Legacy mobile header rules: REMOVED"
echo "New <style> elements: NONE"
echo "JavaScript changed: NO"
echo "Wallet logic: UNCHANGED"
echo "RPC status logic: UNCHANGED"
echo "PAPER MODE logic/text: UNCHANGED"
echo "FREE PLAN logic/text: UNCHANGED"
echo "Desktop header: UNCHANGED"
echo
echo "Mobile result:"
echo "  Compact row 1: PAPER MODE | FREE PLAN | wallet icon"
echo "  Compact row 2: Wallet status | RPC status"
echo
echo "Now Stop -> Run and hard-refresh."
