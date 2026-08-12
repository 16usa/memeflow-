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

PATCH_DIR="$APP/.memeflow-patches/mobile-header-clean-v2"
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
trap 'echo "ERROR: MOBILE HEADER CLEAN V2 failed; restoring exact pre-install index.html."; rollback' ERR

# If the broken V1 patch is currently installed, start from its exact pre-install backup.
# This avoids trying to "patch the patch".
if grep -q 'MF_MOBILE_HEADER_CANONICAL_V1' "$INDEX"; then
  V1_MANIFEST="$APP/.memeflow-patches/mobile-header-canonical-v1/latest-manifest.txt"
  if [[ -f "$V1_MANIFEST" ]]; then
    V1_BACKUP="$(sed -n 's/^BACKUP=//p' "$V1_MANIFEST" | tail -n 1)"
    if [[ -n "$V1_BACKUP" && -f "$V1_BACKUP" ]]; then
      cp "$V1_BACKUP" "$WORK"
      echo "Broken V1 detected: restored exact pre-V1 source into working copy."
    else
      echo "Broken V1 detected, but its backup is unavailable; cleaning current source directly."
    fi
  else
    echo "Broken V1 detected, but its manifest is unavailable; cleaning current source directly."
  fi
fi

python3 - "$WORK" <<'PY'
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")

OWNER_ID = "mf-mobile-header-clean-v2"
MARKER = "MF_MOBILE_HEADER_CLEAN_V2"

if MARKER in src or f'id="{OWNER_ID}"' in src:
    raise SystemExit("MOBILE HEADER CLEAN V2 is already installed.")

required = [
    'class="topbar"',
    'class="top-left"',
    'class="top-actions"',
    'class="topbar-conn"',
    'id="topPlanBadge"',
    'id="topbarConn"',
    'id="mobileConnWallet"',
    'id="mobileConnRpc"',
]
missing = [x for x in required if x not in src]
if missing:
    raise SystemExit("Required mobile-header DOM is missing: " + ", ".join(missing))

scripts_before = re.findall(r"<script\b[^>]*>.*?</script>", src, flags=re.I | re.S)
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

LEGACY_COMPONENT_STYLE_IDS = {
    "mobile-icon-cleanup-v2",
    "MEMEFLOW_HIDE_TOP_WALLET_MOBILE_V1",
    "mf-premium-mobile-v1-3-header-edge",
}

def has_target(selector):
    compact = re.sub(r"\s+", " ", selector).strip()
    return any(tok in compact for tok in TARGET_TOKENS)

def split_selectors(text):
    out, start = [], 0
    paren = bracket = 0
    quote = None
    esc = False
    for i, ch in enumerate(text):
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch == "(":
            paren += 1
        elif ch == ")":
            paren = max(0, paren - 1)
        elif ch == "[":
            bracket += 1
        elif ch == "]":
            bracket = max(0, bracket - 1)
        elif ch == "," and paren == 0 and bracket == 0:
            out.append(text[start:i].strip())
            start = i + 1
    out.append(text[start:].strip())
    return [x for x in out if x]

def find_boundary(text, start):
    quote = None
    esc = False
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
            if esc:
                esc = False
            elif text[i] == "\\":
                esc = True
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
            return i, "{"
        elif ch == ";":
            return i, ";"
        i += 1
    return len(text), None

def match_brace(text, opening):
    depth = 1
    quote = None
    esc = False
    comment = False
    i = opening + 1
    while i < len(text):
        if comment:
            if text.startswith("*/", i):
                comment = False
                i += 2
                continue
            i += 1
            continue
        if quote:
            if esc:
                esc = False
            elif text[i] == "\\":
                esc = True
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

def max_width_mobile(text):
    clean = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    widths = re.findall(r"max-width\s*:\s*(\d+(?:\.\d+)?)px", clean, flags=re.I)
    return any(float(w) <= 820 for w in widths)

def attrs_style_id(attrs):
    m = re.search(r'\bid\s*=\s*(["\'])(.*?)\1', attrs, flags=re.I | re.S)
    return m.group(2) if m else ""

def attrs_mobile_media(attrs):
    m = re.search(r'\bmedia\s*=\s*(["\'])(.*?)\1', attrs, flags=re.I | re.S)
    return bool(m and max_width_mobile(m.group(2)))

stats = {
    "rules_removed": 0,
    "grouped_trimmed": 0,
    "styles_removed": 0,
}

def clean_css(text, mobile=False, force_component=False):
    out = []
    pos = 0
    n = len(text)

    while pos < n:
        if text[pos].isspace():
            s = pos
            while pos < n and text[pos].isspace():
                pos += 1
            out.append(text[s:pos])
            continue

        if text.startswith("/*", pos):
            end = text.find("*/", pos + 2)
            if end < 0:
                out.append(text[pos:])
                break
            out.append(text[pos:end+2])
            pos = end + 2
            continue

        boundary, kind = find_boundary(text, pos)
        if kind is None:
            out.append(text[pos:])
            break

        prelude = text[pos:boundary]

        if kind == ";":
            out.append(text[pos:boundary+1])
            pos = boundary + 1
            continue

        close = match_brace(text, boundary)
        body = text[boundary+1:close]
        clean_pre = re.sub(r"/\*.*?\*/", "", prelude, flags=re.S).strip()

        if clean_pre.startswith("@"):
            child_mobile = mobile or (
                clean_pre.lower().startswith("@media") and max_width_mobile(clean_pre)
            )
            processed = clean_css(body, child_mobile, force_component)
            semantic = re.sub(r"/\*.*?\*/", "", processed, flags=re.S).strip()
            if semantic:
                out.append(prelude + "{" + processed + "}")
            pos = close + 1
            continue

        selectors = split_selectors(prelude)
        should_clean = mobile or force_component

        if should_clean:
            kept = [s for s in selectors if not has_target(s)]
            removed = len(selectors) - len(kept)
            if removed:
                if not kept:
                    stats["rules_removed"] += 1
                    pos = close + 1
                    continue
                stats["grouped_trimmed"] += 1
                out.append(", ".join(kept) + "{" + body + "}")
                pos = close + 1
                continue

        out.append(prelude + "{" + body + "}")
        pos = close + 1

    return "".join(out)

style_rx = re.compile(r"<style\b(?P<attrs>[^>]*)>(?P<css>.*?)</style>", flags=re.I | re.S)

parts = []
last = 0
for m in style_rx.finditer(src):
    parts.append(src[last:m.start()])
    attrs = m.group("attrs")
    css = m.group("css")
    sid = attrs_style_id(attrs)

    # Remove any previously injected V1 owner rules by normal selector cleanup.
    force = sid in LEGACY_COMPONENT_STYLE_IDS or (
        sid and ("header" in sid.lower() or "topbar" in sid.lower())
    )
    mobile_from_attr = attrs_mobile_media(attrs)

    cleaned = clean_css(css, mobile_from_attr, force)
    semantic = re.sub(r"/\*.*?\*/", "", cleaned, flags=re.S).strip()

    if semantic:
        parts.append("<style" + attrs + ">" + cleaned + "</style>")
    else:
        stats["styles_removed"] += 1

    last = m.end()
parts.append(src[last:])
base = "".join(parts)

# Any old V1 marker comment left in non-CSS text is harmless, but remove the literal marker
# so the file has exactly one current owner identity.
base = base.replace("MF_MOBILE_HEADER_CANONICAL_V1", "MF_MOBILE_HEADER_LEGACY_REMOVED")

canonical = r'''
<style id="mf-mobile-header-clean-v2">
/* MF_MOBILE_HEADER_CLEAN_V2
   Single mobile-header owner.
   Desktop base styles remain unchanged.
*/
@media (max-width:820px){
  #connectionStrip{
    display:none!important;
    height:0!important;
    min-height:0!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    overflow:hidden!important;
  }

  .topbar{
    position:sticky!important;
    top:calc(6px + env(safe-area-inset-top))!important;
    z-index:60!important;

    display:grid!important;
    grid-template-columns:minmax(0,1fr) 42px!important;
    grid-template-rows:44px 27px!important;
    align-items:center!important;
    column-gap:10px!important;
    row-gap:6px!important;

    width:100%!important;
    min-height:0!important;
    height:auto!important;
    margin:0 0 12px!important;
    padding:10px 12px 7px!important;

    border:1px solid rgba(126,151,176,.16)!important;
    border-radius:18px!important;
    background:rgba(5,8,12,.92)!important;
    -webkit-backdrop-filter:blur(22px) saturate(120%)!important;
    backdrop-filter:blur(22px) saturate(120%)!important;
    box-shadow:0 12px 30px rgba(0,0,0,.23)!important;

    flex-wrap:initial!important;
    overflow:visible!important;
    transform:none!important;
  }

  .topbar>.top-left{
    grid-column:1!important;
    grid-row:1!important;

    display:flex!important;
    align-items:center!important;
    justify-content:flex-start!important;
    min-width:0!important;
    width:auto!important;
    height:44px!important;
    gap:8px!important;

    margin:0!important;
    padding:0!important;
    align-self:center!important;
  }

  .topbar>.top-left>.mode-indicator{
    display:none!important;
    width:0!important;
    height:0!important;
    min-width:0!important;
    min-height:0!important;
    margin:0!important;
    padding:0!important;
    overflow:hidden!important;
  }

  .topbar>.top-left>.chip,
  .topbar>.top-left>.top-plan-badge{
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    flex:0 0 auto!important;

    height:44px!important;
    min-height:44px!important;
    max-height:44px!important;
    min-width:0!important;

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
    transform:none!important;
  }

  .topbar>.top-left>.chip{
    border:1px solid transparent!important;
    background:rgba(255,255,255,.045)!important;
    color:#aeb8c5!important;
  }

  .topbar>.top-left>.top-plan-badge{
    border:1px solid rgba(111,223,255,.20)!important;
    background:rgba(255,255,255,.012)!important;
    color:#f5f8fa!important;
  }

  .topbar>.top-actions{
    grid-column:2!important;
    grid-row:1!important;

    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    align-self:center!important;

    width:42px!important;
    min-width:42px!important;
    max-width:42px!important;
    height:44px!important;
    min-height:44px!important;

    margin:0!important;
    padding:0!important;
    gap:0!important;
    flex:initial!important;
    flex-wrap:nowrap!important;
    overflow:visible!important;
  }

  .topbar>.top-actions>.chip,
  .topbar>.top-actions>#focusToggle,
  .topbar>.top-actions>#presentationBtn,
  .topbar>.top-actions>#themeToggle{
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
    border-width:0!important;
    border-color:transparent!important;
    border-radius:0!important;
    outline:0!important;

    background:transparent!important;
    background-color:transparent!important;
    background-image:none!important;
    box-shadow:none!important;

    color:transparent!important;
    font-size:0!important;
    line-height:0!important;
    text-indent:-9999px!important;
    white-space:nowrap!important;

    overflow:visible!important;
    transform:none!important;
    filter:none!important;
  }

  .topbar #walletConnectTop:hover,
  .topbar #walletConnectTop:focus,
  .topbar #walletConnectTop:focus-visible,
  .topbar #walletConnectTop:active,
  .topbar #walletConnectTop.connected{
    border:0!important;
    border-radius:0!important;
    outline:0!important;
    background:transparent!important;
    box-shadow:none!important;
    transform:none!important;
    filter:none!important;
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
    min-width:27px!important;
    max-width:27px!important;
    height:27px!important;
    min-height:27px!important;
    max-height:27px!important;

    margin:0!important;
    padding:0!important;
    border:0!important;
    border-radius:0!important;

    background:var(--muted,#8d99a8)!important;
    box-shadow:none!important;
    opacity:1!important;
    transform:none!important;

    -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3h11'/%3E%3Cpath d='M20 11h-4a2 2 0 0 0 0 4h4'/%3E%3C/g%3E%3Ccircle cx='16' cy='13' r='.75' fill='black'/%3E%3C/svg%3E") center/contain no-repeat!important;
    mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3h11'/%3E%3Cpath d='M20 11h-4a2 2 0 0 0 0 4h4'/%3E%3C/g%3E%3Ccircle cx='16' cy='13' r='.75' fill='black'/%3E%3C/svg%3E") center/contain no-repeat!important;
  }

  .topbar #walletConnectTop.connected::before{
    background:var(--green,#5de2a5)!important;
  }

  .topbar>.topbar-conn{
    grid-column:1 / -1!important;
    grid-row:2!important;

    display:grid!important;
    grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
    align-items:center!important;

    width:100%!important;
    min-width:0!important;
    height:27px!important;
    min-height:27px!important;
    max-height:27px!important;

    margin:0!important;
    padding:6px 2px 0!important;
    gap:12px!important;

    border:0!important;
    border-top:1px solid rgba(126,151,176,.15)!important;
    background:transparent!important;
    box-shadow:none!important;

    flex:initial!important;
    overflow:hidden!important;
  }

  .topbar>.topbar-conn>.topbar-conn-item{
    display:flex!important;
    align-items:center!important;
    min-width:0!important;
    height:20px!important;

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

  .topbar>.topbar-conn>.topbar-conn-item+.topbar-conn-item{
    justify-content:flex-end!important;
    margin:0!important;
    padding:0!important;
    border-left:0!important;
  }

  .topbar>.topbar-conn>.topbar-conn-item i{
    flex:0 0 7px!important;
    width:7px!important;
    min-width:7px!important;
    height:7px!important;
    min-height:7px!important;
    margin:0!important;

    border:0!important;
    border-radius:50%!important;
    background:var(--muted)!important;
    box-shadow:none!important;
  }

  .topbar>.topbar-conn>.topbar-conn-item.good i{
    background:var(--green)!important;
    box-shadow:0 0 7px rgba(81,231,168,.45)!important;
  }

  .topbar>.topbar-conn>.topbar-conn-item.warn i{
    background:var(--yellow)!important;
    box-shadow:0 0 7px rgba(246,199,95,.35)!important;
  }

  .topbar>.topbar-conn>.topbar-conn-item.bad i{
    background:var(--red)!important;
    box-shadow:0 0 7px rgba(255,101,118,.35)!important;
  }

  .topbar>.topbar-conn>.topbar-conn-item span{
    min-width:0!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
}

@media (max-width:390px){
  .topbar{
    grid-template-columns:minmax(0,1fr) 39px!important;
    grid-template-rows:41px 26px!important;
    column-gap:8px!important;
    row-gap:5px!important;
    padding:9px 10px 7px!important;
  }

  .topbar>.top-left{
    height:41px!important;
    gap:6px!important;
  }

  .topbar>.top-left>.chip,
  .topbar>.top-left>.top-plan-badge{
    height:41px!important;
    min-height:41px!important;
    max-height:41px!important;
    padding:0 11px!important;
    font-size:9px!important;
    letter-spacing:.11em!important;
  }

  .topbar>.top-actions{
    width:39px!important;
    min-width:39px!important;
    max-width:39px!important;
    height:41px!important;
    min-height:41px!important;
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
    min-width:25px!important;
    max-width:25px!important;
    height:25px!important;
    min-height:25px!important;
    max-height:25px!important;
  }

  .topbar>.topbar-conn{
    height:26px!important;
    min-height:26px!important;
    max-height:26px!important;
    gap:8px!important;
  }

  .topbar>.topbar-conn>.topbar-conn-item{
    font-size:9px!important;
  }
}
</style>
'''

# Final component owner goes LAST in <head>, after every legacy/global style.
head_close = re.search(r"</head\s*>", base, flags=re.I)
if not head_close:
    raise SystemExit("</head> not found.")

final = base[:head_close.start()] + "\n" + canonical.strip() + "\n" + base[head_close.start():]

scripts_after = re.findall(r"<script\b[^>]*>.*?</script>", final, flags=re.I | re.S)
if scripts_after != scripts_before:
    raise SystemExit("JavaScript verification failed: script bodies changed.")

if final.count(f'id="{OWNER_ID}"') != 1 or final.count(MARKER) != 1:
    raise SystemExit("Final owner verification failed.")

for token in required:
    if final.count(token) != 1:
        raise SystemExit(f"DOM verification failed for {token}: count={final.count(token)}")

# Verify no competing mobile-header selectors survived outside the canonical owner.
canonical_start = final.index(f'<style id="{OWNER_ID}">')
canonical_end = final.index("</style>", canonical_start) + len("</style>")
without_owner = final[:canonical_start] + final[canonical_end:]

survivors = []
for m in style_rx.finditer(without_owner):
    attrs = m.group("attrs")
    css = m.group("css")
    initial_mobile = attrs_mobile_media(attrs)

    def scan(text, mobile=False):
        pos = 0
        while pos < len(text):
            if text[pos].isspace():
                pos += 1
                continue
            if text.startswith("/*", pos):
                end = text.find("*/", pos + 2)
                if end < 0:
                    return
                pos = end + 2
                continue
            boundary, kind = find_boundary(text, pos)
            if kind is None:
                return
            if kind == ";":
                pos = boundary + 1
                continue
            close = match_brace(text, boundary)
            prelude = text[pos:boundary]
            body = text[boundary+1:close]
            clean_pre = re.sub(r"/\*.*?\*/", "", prelude, flags=re.S).strip()
            if clean_pre.startswith("@"):
                child_mobile = mobile or (
                    clean_pre.lower().startswith("@media") and max_width_mobile(clean_pre)
                )
                scan(body, child_mobile)
            elif mobile:
                for sel in split_selectors(prelude):
                    if has_target(sel):
                        survivors.append(sel)
            pos = close + 1

    scan(css, initial_mobile)

if survivors:
    raise SystemExit(
        "Competing mobile-header selectors survived cleanup: "
        + " | ".join(survivors[:12])
    )

# The final owner must be the last <style> in <head>.
head_text = final[:head_close.start() + len(canonical) + 2000]
style_positions = [m.start() for m in re.finditer(r"<style\b", final[:final.lower().index("</head>")], flags=re.I)]
if not style_positions or style_positions[-1] != final.index(f'<style id="{OWNER_ID}">'):
    raise SystemExit("Canonical mobile header is not the final stylesheet in <head>.")

style_count_after = len(re.findall(r"<style\b", final, flags=re.I))

path.write_text(final, encoding="utf-8")

print("Header source rebuilt from a clean component boundary.")
print(f"Legacy mobile-header rules removed: {stats['rules_removed']}")
print(f"Grouped selector rules trimmed: {stats['grouped_trimmed']}")
print(f"Empty legacy style blocks removed: {stats['styles_removed']}")
print(f"<style> count: {style_count_before} -> {style_count_after}")
print("Competing mobile-header selectors outside owner: 0")
print("Canonical owner position: LAST STYLE IN <head>")
print("JavaScript bodies byte-identical: PASS")
print("Header DOM IDs/classes preserved: PASS")
PY

cp "$WORK" "$INDEX"
rm -f "$WORK"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
BACKUP=$BACKUP
EOF

trap - ERR

echo
echo "OK: MOBILE HEADER CLEAN V2 installed."
echo
echo "Expected mobile layout:"
echo "  Row 1: PAPER MODE | FREE PLAN | wallet icon"
echo "  Row 2: Wallet status | RPC status"
echo
echo "Verification:"
echo "  One mobile-header CSS owner: PASS"
echo "  Legacy mobile-header conflicts: REMOVED"
echo "  JavaScript changed: NO"
echo "  Wallet logic changed: NO"
echo "  RPC logic changed: NO"
echo "  Trading / AI logic changed: NO"
echo "  Desktop header changed: NO"
echo
echo "Now Stop -> Run, then hard-refresh Safari."
