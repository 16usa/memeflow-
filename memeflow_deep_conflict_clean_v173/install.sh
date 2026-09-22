#!/usr/bin/env bash
set -euo pipefail

APP="memeflow-app"
OUT="$APP/memeflow-x-canonical-v173.css"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-deep-conflict-clean-v173-backup-$STAMP"
POINTER=".memeflow-deep-conflict-clean-v173-last-backup"

if [ ! -d "$APP" ]; then
  echo "ERROR: $APP not found. Run this from the existing Replit workspace root."
  exit 1
fi

OPTIONAL_OLD_GLOBAL=(
  "$APP/memeflow-visual-guardrails-v169.css"
  "$APP/memeflow-structural-compat-v169.css"
  "$APP/memeflow-x-canonical-v169.css"
  "$APP/memeflow-x-canonical-v170.css"
  "$APP/memeflow-x-canonical-v171.css"
)

echo "V173 self-contained mode."
echo "Old global files are optional; missing files are expected and are not an error."

PAGES=(
  index.html system.html how-it-works.html smart-vault.html trading.html
  settings.html system-tokens.html x100.html agent-performance.html
  owner-intelligence.html system-source.html
)

SOURCES=(
  paper-automation-ui.css memeflow-brand.css system.css memeflow-nav.css
  memeflow-header.css memeflow-theme.css memeflow-header-nav-polish-v59.css
  memeflow-nav-interaction-restore-v59b.css
  memeflow-component-consistency-v63.css access-gate.css how-it-works.css
  trading.css memeflow-typography-premium-v66.css
  trading-visual-hierarchy-v67.css open-position-popover-v85.css
  system-tokens.css memeflow-insightx-v1.css
  memeflow-token-flow-continuous-v1.css agent-performance.css
  owner-intelligence.css x100.css
)

mkdir -p "$BACKUP/memeflow-app"

for f in "${OPTIONAL_OLD_GLOBAL[@]}"; do
  if [ -f "$f" ]; then
    cp -p "$f" "$BACKUP/memeflow-app/$(basename "$f")"
  fi
done

for p in "${PAGES[@]}"; do
  [ -f "$APP/$p" ] && cp -p "$APP/$p" "$BACKUP/memeflow-app/$p"
done

for f in "${SOURCES[@]}"; do
  [ -f "$APP/$f" ] && cp -p "$APP/$f" "$BACKUP/memeflow-app/$f"
done

[ -f "$OUT" ] && cp -p "$OUT" "$BACKUP/memeflow-app/$(basename "$OUT").before"

printf '%s\n' "$BACKUP" > "$POINTER"

# Normalize active source CSS + embedded CSS instead of stacking another theme.
python3 - <<'PY'

from pathlib import Path
import re
import colorsys

APP = Path("memeflow-app")

SEMANTIC_WORDS = (
    "ready","watch","waiting","blocked","danger","error","success",
    "positive","negative","profit","loss","pnl","buy","sell","approve",
    "reject","open-position","decision","status","state-","live","win",
    "semantic","primary-action","core-module","definition-grid .is",
    "allocation-bar","donut","chart","canvas","viewport","scene","orbit",
    "avatar","logo","image","icon","dot","progress","graph"
)

SEMANTIC_MARKERS = (
    "--cyan","--green","--red","--yellow","--purple","--blue","--amber",
    "--semantic","--positive","--negative","--accent",
    "#55d9ff","#55d7f4","#57dcff","#54ddff",
    "#4de6a1","#49e0ae","#51e7a8",
    "#ff6679","#ff6878","#ef6670","#ef6677",
    "#efc66a","#efc86a","#a98bff","#a68cff",
    "#5c8dff","#6a99ff","#1d9bf0"
)

DARK_SURFACES = {
    "#0f141a","#111820","#141c25","#0d1218","#0d1217","#071117",
    "#020405","#03090d","#0c1117","#0c1318","#0d151b","#1c2830",
    "#080e13","#0b1218","#090f14","#05070a","#05080c","#0c1218",
    "#101820","#111920","#101113","#181f27","#070a0f","#0a1016",
    "#0a0f15","#121b25","#1b2836","#18232e","#1b2632","#0b1119",
    "#101822","#172331","#192531","#071017","#071018","#121c26",
    "#080d13","#070c12","#192430","#1c2834","#07090c","#0c1015",
    "#11161d","#161d26","#071016","#090c10","#0a0d12","#0e131a",
    "#121923","#061116","#07090d","#0b0f14","#0b131d","#10161d",
    "#0e1823","#151d26","#111d29"
}

PRIMARY_TEXT = {
    "#eef5fa","#edf5f8","#eaf2f6","#eef5f7","#edf4f7","#edf7fb",
    "#f4f8fb","#f7f9fb","#f4f7fb","#f5f8fb","#eef5f8","#eef5fa"
}
MUTED_TEXT = {
    "#718894","#70818f","#6f8290","#768795","#91a2ad","#8190a0",
    "#8290a2","#8792a2","#8d99a8","#8e9daf","#91a0a9","#81939f",
    "#758895","#93a4af","#7e8d99"
}
TERTIARY_TEXT = {
    "#455c67","#52616c","#536873","#596777","#637184","#657181",
    "#6e7b8b","#60717c","#5f7481","#607481"
}

NEUTRAL_VAR_VALUES = {
    "--bg":"#000000",
    "--panel":"#000000",
    "--panel-solid":"#000000",
    "--panel-2":"#000000",
    "--surface":"#000000",
    "--surface2":"#000000",
    "--surface3":"#000000",
    "--surface-0":"#000000",
    "--surface-1":"#000000",
    "--surface-2":"#000000",
    "--panel-bg":"#000000",
    "--mf-app-bg":"#000000",
    "--mf-app-surface":"#000000",
    "--mf-app-surface-2":"#000000",
    "--mf-app-surface-3":"#000000",
    "--mf-nav-bg":"#000000",
    "--mf-nav-surface":"#000000",
    "--mf-nav-surface-2":"#000000",
    "--hiw-bg":"#000000",
    "--hiw-panel":"#000000",
    "--hiw-panel-strong":"#000000",
    "--v-bg":"#000000",
    "--v-panel":"#000000",
    "--v-panel2":"#000000",

    "--line":"#2f3336",
    "--line2":"#2f3336",
    "--line-strong":"#2f3336",
    "--mf-app-line":"#2f3336",
    "--mf-app-line-strong":"#2f3336",
    "--mf-nav-line":"#2f3336",
    "--mf-nav-line-strong":"#2f3336",
    "--hiw-line":"#2f3336",
    "--hiw-line-strong":"#2f3336",
    "--v-line":"#2f3336",
    "--v-line2":"#2f3336",
    "--mf-v63-line-dark":"#2f3336",
    "--mf-v59-header-line":"#2f3336",
    "--mf-v59-drawer-line":"#2f3336",

    "--text":"#e7e9ea",
    "--muted":"#71767b",
    "--faint":"#536471",
    "--mf-app-text":"#e7e9ea",
    "--mf-app-muted":"#71767b",
    "--mf-nav-text":"#e7e9ea",
    "--mf-nav-muted":"#71767b",
    "--hiw-text":"#e7e9ea",
    "--hiw-muted":"#71767b",
    "--hiw-muted-2":"#536471",
    "--v-text":"#e7e9ea",
    "--v-muted":"#71767b",
    "--v-muted2":"#536471",
}

def strip_comments(css):
    return re.sub(r'/\*[\s\S]*?\*/', '', css)

def is_light_selector(selector):
    s = selector.lower().replace("'", '"')
    return 'data-theme="light"' in s

def semantic_selector(selector):
    s = selector.lower()
    return any(word in s for word in SEMANTIC_WORDS)

def semantic_value(value):
    v = value.lower().replace(" ", "")
    return any(marker.replace(" ","") in v for marker in SEMANTIC_MARKERS)

def parse_rgb_color(value):
    v = value.strip().lower()
    m = re.search(r'#([0-9a-f]{6})(?:[0-9a-f]{2})?\b', v)
    if m:
        h = m.group(1)
        return tuple(int(h[i:i+2],16) for i in (0,2,4))
    m = re.search(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)', v)
    if m:
        return tuple(map(int,m.groups()))
    return None

def is_neutral_rgb(rgb):
    if not rgb:
        return False
    r,g,b = [x/255 for x in rgb]
    h,l,s = colorsys.rgb_to_hls(r,g,b)
    return s < 0.38

def replace_dark_surface_literals(value):
    out = value
    for token in DARK_SURFACES:
        out = re.sub(re.escape(token), "#000000", out, flags=re.I)
    return out

def map_neutral_text(value):
    low = value.lower()
    for t in PRIMARY_TEXT:
        if t in low:
            return re.sub(re.escape(t), "#e7e9ea", value, flags=re.I)
    for t in MUTED_TEXT:
        if t in low:
            return re.sub(re.escape(t), "#71767b", value, flags=re.I)
    for t in TERTIARY_TEXT:
        if t in low:
            return re.sub(re.escape(t), "#536471", value, flags=re.I)

    rgb = parse_rgb_color(value)
    if rgb and is_neutral_rgb(rgb):
        lum = sum(rgb)/3/255
        if lum >= .72:
            return "#e7e9ea"
        if lum >= .42:
            return "#71767b"
        if lum >= .22:
            return "#536471"
    return value

def process_declarations(body, selector):
    if is_light_selector(selector):
        return body

    sem_sel = semantic_selector(selector)
    header_sel = any(x in selector.lower() for x in (
        "mf-site-header","site-header","topbar","flow-header",
        "mf-vault-topbar","mf-hiw-topbar"
    ))

    pattern = re.compile(
        r'(?P<prop>--[\w-]+|[\w-]+)\s*:\s*(?P<value>[^;{}]+)(?P<semi>;?)'
    )

    def repl(m):
        prop = m.group("prop")
        value = m.group("value").strip()
        semi = m.group("semi") or ";"
        pl = prop.lower()
        vl = value.lower()

        # Canonical variable aliases.
        if prop in NEUTRAL_VAR_VALUES:
            return f"{prop}:{NEUTRAL_VAR_VALUES[prop]}{semi}"

        if prop == "--mf-v59-header-bg":
            return f"{prop}:transparent{semi}"
        if prop == "--mf-v59-header-shadow":
            return f"{prop}:none{semi}"

        if header_sel:
            if pl in ("background","background-color"):
                return f"{prop}:transparent{semi}"
            if pl == "background-image":
                return f"{prop}:none{semi}"
            if pl in ("box-shadow","backdrop-filter","-webkit-backdrop-filter"):
                return f"{prop}:none{semi}"

        sem_val = semantic_value(value)

        # Background surfaces: replace old dark neutral literals.
        if pl in ("background","background-color","background-image"):
            if not (sem_sel or sem_val):
                new = replace_dark_surface_literals(value)
                if new != value:
                    value = new
                if pl == "background-image" and value.strip().lower() in DARK_SURFACES:
                    value = "none"
            return f"{prop}:{value}{semi}"

        # Neutral borders in dark/default rules = exact X 1px line.
        if pl == "border" or re.fullmatch(r'border-(top|right|bottom|left)', pl):
            if re.match(r'^\s*(0|none)\b', value, re.I):
                return m.group(0)
            if sem_sel or sem_val:
                return m.group(0)
            # Preserve intentional inverted/white primary controls.
            if any(x in selector.lower() for x in (
                "primary","core-module","definition-grid .is","skip"
            )):
                return m.group(0)
            return f"{prop}:1px solid #2f3336{semi}"

        if pl.endswith("border-color") or pl == "border-color":
            if sem_sel or sem_val or "transparent" in vl:
                return m.group(0)
            return f"{prop}:#2f3336{semi}"

        if pl == "border-width":
            if sem_sel:
                return m.group(0)
            if value.strip() not in ("0","0px"):
                return f"{prop}:1px{semi}"
            return m.group(0)

        # Neutral structural shadows/glows are removed.
        if pl in ("box-shadow","text-shadow"):
            if sem_sel or sem_val:
                return m.group(0)
            return f"{prop}:none{semi}"

        # X neutral text hierarchy.
        if pl == "color" and not (sem_sel or sem_val):
            return f"{prop}:{map_neutral_text(value)}{semi}"

        return f"{prop}:{value}{semi}"

    return pattern.sub(repl, body)

def normalize_css(css):
    css = strip_comments(css)

    # Normalize exact old dark surface literals first.
    for token in DARK_SURFACES:
        css = re.sub(re.escape(token), "#000000", css, flags=re.I)

    # Process innermost rule blocks. The regex intentionally ignores wrappers
    # such as @media and handles the actual nested selector rules.
    rule = re.compile(r'([^{}]+)\{([^{}]*)\}')
    def block_repl(m):
        selector = m.group(1)
        body = m.group(2)
        if selector.lstrip().startswith("@"):
            return m.group(0)
        return selector + "{" + process_declarations(body, selector) + "}"
    css = rule.sub(block_repl, css)

    css = re.sub(r'\n{3,}', '\n\n', css).strip() + "\n"
    return css

# Active default/dark source files. Explicitly-light files are intentionally
# not rewritten; they do not participate in the dark cascade.
FILES = [
    "paper-automation-ui.css",
    "memeflow-brand.css",
    "system.css",
    "memeflow-nav.css",
    "memeflow-header.css",
    "memeflow-theme.css",
    "memeflow-header-nav-polish-v59.css",
    "memeflow-nav-interaction-restore-v59b.css",
    "memeflow-component-consistency-v63.css",
    "access-gate.css",
    "how-it-works.css",
    "trading.css",
    "memeflow-typography-premium-v66.css",
    "trading-visual-hierarchy-v67.css",
    "open-position-popover-v85.css",
    "system-tokens.css",
    "memeflow-insightx-v1.css",
    "memeflow-token-flow-continuous-v1.css",
    "agent-performance.css",
    "owner-intelligence.css",
    "x100.css",
]

for name in FILES:
    p = APP / name
    if not p.exists():
        continue
    p.write_text(normalize_css(p.read_text(encoding="utf-8")), encoding="utf-8")
    print("NORMALIZED", p)

# Normalize embedded CSS on every production page as well. This cleans the
# 27 legacy style blocks in index.html rather than merely overriding them.
PAGES = [
    "index.html","system.html","how-it-works.html","smart-vault.html",
    "trading.html","settings.html","system-tokens.html","x100.html",
    "agent-performance.html","owner-intelligence.html","system-source.html",
]

style_re = re.compile(r'(<style\b[^>]*>)([\s\S]*?)(</style>)', re.I)

for name in PAGES:
    p = APP / name
    text = p.read_text(encoding="utf-8")
    text = style_re.sub(
        lambda m: m.group(1) + "\n" + normalize_css(m.group(2)) + m.group(3),
        text,
    )
    p.write_text(text, encoding="utf-8")
    print("INLINE CSS NORMALIZED", p)

PY

# Build ONE global canonical file. Old V169/V170/V171 globals are optional.
# If a useful old compatibility file still exists locally, absorb it.
# If it is already missing, V173 continues from its self-contained contract.
python3 - <<'PY'
from pathlib import Path
import re

app = Path("memeflow-app")
candidates = [
    app / "memeflow-visual-guardrails-v169.css",
    app / "memeflow-structural-compat-v169.css",
    app / "memeflow-x-canonical-v169.css",
    app / "memeflow-x-canonical-v170.css",
    app / "memeflow-x-canonical-v171.css",
]

parts = []
for p in candidates:
    if not p.exists():
        continue
    text = p.read_text(encoding="utf-8")
    # Historical comments are not part of the executable canonical source.
    text = re.sub(r'/\*[\s\S]*?\*/', '', text)
    parts.append(text.strip())

merged = "\n\n".join(x for x in parts if x)
merged = re.sub(r'\n{3,}', '\n\n', merged).strip()

header = """/*
  MEMEFLOW X CANONICAL V173
  Self-contained final global visual authority.
  Old V169/V170/V171 files are optional migration inputs only.
*/

"""

out = app / "memeflow-x-canonical-v173.css"
out.write_text(header + (merged + "\n\n" if merged else ""), encoding="utf-8")

print("OLD GLOBAL INPUTS ABSORBED:", len(parts))
PY

cat >> "$OUT" <<'CSS'

/* ==========================================================================
   MEMEFLOW X CANONICAL V173 — FINAL DARK NEUTRAL AUTHORITY

   Dark canvas / neutral modules  #000000
   Primary text                   #E7E9EA
   Strong text                    #FFFFFF
   Secondary / metadata           #71767B
   Tertiary                       #536471
   X focus/link blue              #1D9BF0
   Neutral frame/divider          #2F3336
   Neutral frame format           1px solid
   Header                         transparent, no blur/shadow

   Semantic state colors are intentionally independent.
   ========================================================================== */

html:not([data-theme="light"]) {
  color-scheme: dark;

  --mf-x-bg: #000000;
  --mf-x-surface: #000000;
  --mf-x-text: #e7e9ea;
  --mf-x-text-strong: #ffffff;
  --mf-x-text-muted: #71767b;
  --mf-x-text-tertiary: #536471;
  --mf-x-text-faint: #3e4a55;
  --mf-x-blue: #1d9bf0;
  --mf-x-line: #2f3336;

  --bg: #000000 !important;
  --panel: #000000 !important;
  --panel-solid: #000000 !important;
  --panel-2: #000000 !important;
  --surface: #000000 !important;
  --surface2: #000000 !important;
  --surface3: #000000 !important;
  --surface-0: #000000 !important;
  --surface-1: #000000 !important;
  --surface-2: #000000 !important;
  --panel-bg: #000000 !important;

  --mf-app-bg: #000000 !important;
  --mf-app-surface: #000000 !important;
  --mf-app-surface-2: #000000 !important;
  --mf-app-surface-3: #000000 !important;
  --mf-app-panel-top: #000000 !important;
  --mf-app-panel-bottom: #000000 !important;

  --mf-nav-bg: #000000 !important;
  --mf-nav-surface: #000000 !important;
  --mf-nav-surface-2: #000000 !important;

  --hiw-bg: #000000 !important;
  --hiw-panel: #000000 !important;
  --hiw-panel-strong: #000000 !important;
  --hiw-shadow: none !important;

  --v-bg: #000000 !important;
  --v-panel: #000000 !important;
  --v-panel2: #000000 !important;

  --mf-dark-canvas: #000000 !important;
  --mf-dark-surface-1: #000000 !important;
  --mf-dark-surface-2: #000000 !important;
  --mf-x-dark-canvas: #000000 !important;
  --mf-x-dark-inset: #000000 !important;

  --ds-bg: #000000 !important;
  --ds-surface: #000000 !important;
  --ds-surface-raised: #000000 !important;

  --text: #e7e9ea !important;
  --muted: #71767b !important;
  --faint: #536471 !important;
  --text-2: #71767b !important;
  --text-3: #536471 !important;
  --mf-app-text: #e7e9ea !important;
  --mf-app-muted: #71767b !important;
  --mf-nav-text: #e7e9ea !important;
  --mf-nav-muted: #71767b !important;
  --hiw-text: #e7e9ea !important;
  --hiw-muted: #71767b !important;
  --hiw-muted-2: #536471 !important;
  --v-text: #e7e9ea !important;
  --v-muted: #71767b !important;
  --v-muted2: #536471 !important;
  --mf-text-primary: #e7e9ea !important;
  --mf-text-secondary: #71767b !important;
  --mf-text-tertiary: #536471 !important;

  /* Every neutral line alias = the exact same X line. */
  --line: #2f3336 !important;
  --line2: #2f3336 !important;
  --line-strong: #2f3336 !important;
  --mf-app-line: #2f3336 !important;
  --mf-app-line-strong: #2f3336 !important;
  --mf-nav-line: #2f3336 !important;
  --mf-nav-line-strong: #2f3336 !important;
  --hiw-line: #2f3336 !important;
  --hiw-line-strong: #2f3336 !important;
  --v-line: #2f3336 !important;
  --v-line2: #2f3336 !important;
  --mf-dark-line: #2f3336 !important;
  --mf-x-dark-line: #2f3336 !important;
  --mf-x-dark-line-inner: #2f3336 !important;
  --mf-structure-outer: #2f3336 !important;
  --mf-structure-divider: #2f3336 !important;
  --mf-structure-ultra: #2f3336 !important;
  --mf-v63-line: #2f3336 !important;
  --mf-v63-line-dark: #2f3336 !important;
  --mf-v57-line: #2f3336 !important;
  --mf-v59-header-line: #2f3336 !important;
  --mf-v59-drawer-line: #2f3336 !important;
  --ds-line: #2f3336 !important;
  --ds-line-strong: #2f3336 !important;
  --mf-hairline: #2f3336 !important;
  --mf-pm-line: #2f3336 !important;
  --mf-pm-line-strong: #2f3336 !important;

  --mf-structure-hairline: 1px !important;
  --mf-x-dark-hairline: 1px !important;

  --mf-v59-header-bg: transparent !important;
  --mf-v59-header-shadow: none !important;
  --mf-v59-drawer-bg: #000000 !important;
  --mf-v59-drawer-shadow: none !important;
}

/* Pure black dark canvas. */
html:not([data-theme="light"]),
html:not([data-theme="light"]) body,
html:not([data-theme="light"]) body[class] {
  background: #000000 !important;
  background-color: #000000 !important;
  background-image: none !important;
}

/* Header has no sheet/surface at all. */
html:not([data-theme="light"]) body :where(
  .mf-site-header,
  .topbar,
  .flow-header,
  .mf-vault-topbar,
  .mf-hiw-topbar,
  .site-header
) {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border-bottom-color: #2f3336 !important;
}

/* Neutral structural surfaces: black + one X frame. */
html:not([data-theme="light"]) body
:where(
  .panel,
  [class*="-panel"],
  [class*="-card"],
  [class*="-module"]
)
:not([class*="ready"])
:not([class*="watch"])
:not([class*="waiting"])
:not([class*="blocked"])
:not([class*="danger"])
:not([class*="error"])
:not([class*="success"])
:not([class*="positive"])
:not([class*="negative"])
:not([class*="buy"])
:not([class*="sell"])
:not([class*="approve"])
:not([class*="reject"])
:not([class*="open-position"])
:not(.core-module) {
  background-color: #000000 !important;
  background-image: none !important;
  border-width: 1px !important;
  border-style: solid !important;
  border-color: #2f3336 !important;
  box-shadow: none !important;
}

/* Neutral structural selectors not covered by naming convention. */
html:not([data-theme="light"]) body :where(
  .mf-infra,
  .flow-hero,
  .flow-toolbar,
  .pagination,
  .token-list,
  .flow-token,
  .candidate-filter,
  .positions-list,
  .approval-list,
  .trade-history,
  .selected-metrics,
  .strategy-summary-list,
  .settings-context,
  .settings-group,
  .mf293-settings-group,
  .mf-theme-appearance,
  .mf-vault-row,
  .mf-vault-stat,
  .mf-vault-action,
  .mf-vault-note,
  .mf-hiw-map-shell,
  .mf-hiw-money,
  .mf-hiw-cta,
  .ap-source,
  .ap-kpis article,
  .ap-summary div,
  .oi-stat,
  .oi-decision,
  .oi-row,
  .mf-paper-position,
  .mf-paper-proposal,
  .mf-paper-status,
  .mf-paper-grid > div
) {
  background-color: #000000 !important;
  background-image: none !important;
  border-color: #2f3336 !important;
  box-shadow: none !important;
}

/* Every neutral structural separator uses the same X line. */
html:not([data-theme="light"]) body :where(
  hr,
  .panel-head,
  .chart-head,
  .candidate-filter,
  .timeframes,
  .indicator-bar,
  .selected-metrics,
  .strategy-summary-foot,
  .details,
  .tx-details,
  .doc-section,
  .mf293-settings-head,
  .mf293-settings-meta,
  .mf293-settings-footer,
  .mf-hiw-status-head,
  .mf-hiw-map-detail,
  .mf-nav-drawer,
  .mf-nav-drawer-head,
  .mf-nav-link,
  .mf-nav-foot,
  .stat-row,
  .principles,
  .allocation-list,
  .flow-stack,
  .faq-list,
  details,
  footer,
  [class*="divider"],
  [class*="separator"]
) {
  border-color: #2f3336 !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body.mf-page-trading.mf-trading-terminal
:where(.candidate, .position-row, .trade-row.trade-log-row)::after {
  background: #2f3336 !important;
  height: 1px !important;
  opacity: 1 !important;
}

/* Inputs/neutral fields. */
html:not([data-theme="light"]) body :where(input, select, textarea) {
  background-color: #000000 !important;
  border-color: #2f3336 !important;
  color: #e7e9ea !important;
}

html:not([data-theme="light"]) body :where(input, select, textarea):focus,
html:not([data-theme="light"]) body :where(input, select, textarea):focus-visible {
  border-color: #1d9bf0 !important;
  outline: 0 !important;
  box-shadow: 0 0 0 1px #1d9bf0 !important;
}

/* 3D content is preserved; only outer frame is canonical. */
html:not([data-theme="light"]) body.mf-page-system .viewport-wrap {
  border: 1px solid #2f3336 !important;
  box-shadow: none !important;
}

/* X100 intentional inverted information modules remain inverted. */
html:not([data-theme="light"]) body.mf-page-x100 :where(
  .core-module,
  .definition-grid .is
) {
  background: #f2f2f2 !important;
  color: #050505 !important;
}


/* ==========================================================================
   V173 SEMANTIC STATE PRESERVATION
   Neutral theme cleanup must never erase meaning-bearing state colors.
   ========================================================================== */
:root {
  --mf-semantic-cyan: #55d9ff;
  --mf-semantic-green: #4de6a1;
  --mf-semantic-red: #ff6679;
  --mf-semantic-yellow: #efc66a;
  --mf-semantic-purple: #a98bff;
  --mf-semantic-blue: #6a99ff;
}

html body:is(
  .mf-page-system,
  .mf-page-system-tokens,
  .mf-page-trading,
  .mf-page-smart-vault,
  .mf-page-settings,
  .mf-page-how-it-works,
  .mf-page-agent-performance,
  .mf-page-owner-intelligence
) {
  --cyan: var(--mf-semantic-cyan) !important;
  --green: var(--mf-semantic-green) !important;
  --red: var(--mf-semantic-red) !important;
  --yellow: var(--mf-semantic-yellow) !important;
  --purple: var(--mf-semantic-purple) !important;
  --blue: var(--mf-semantic-blue) !important;
}

html body :where(
  .state-dot.open,
  .decision-badge.open,
  .status-pill.open,
  .approval-approve,
  .pnl-positive,
  .trade-side.buy
) {
  color: var(--mf-semantic-green) !important;
}

html body :where(
  .state-dot.ready,
  .decision-badge.ready,
  .status-pill.ready
) {
  color: var(--mf-semantic-yellow) !important;
}

html body :where(
  .state-dot.watch,
  .decision-badge.watch,
  .status-pill.watch
) {
  color: var(--mf-semantic-blue) !important;
}

html body :where(
  .state-dot.blocked,
  .decision-badge.blocked,
  .status-pill.blocked,
  .close-position,
  .approval-reject,
  .pnl-negative,
  .trade-side.sell
) {
  color: var(--mf-semantic-red) !important;
}

html body :where(
  .copy-trade-badge,
  [data-mf-semantic="cyan"]
) {
  color: var(--mf-semantic-cyan) !important;
}
/* /V173 SEMANTIC STATE PRESERVATION */

/* MEMEFLOW_X_CANONICAL_V173_END */

CSS

# One global canonical stylesheet per production page, loaded LAST.
python3 - <<'PY'
from pathlib import Path

app=Path("memeflow-app")
pages=[
    "index.html","system.html","how-it-works.html","smart-vault.html",
    "trading.html","settings.html","system-tokens.html","x100.html",
    "agent-performance.html","owner-intelligence.html","system-source.html",
]
old=[
    "memeflow-visual-guardrails-v169.css",
    "memeflow-structural-compat-v169.css",
    "memeflow-x-canonical-v169.css",
    "memeflow-x-canonical-v170.css",
    "memeflow-x-canonical-v171.css",
    "memeflow-x-canonical-v173.css",
]
link='<link rel="stylesheet" href="/memeflow-x-canonical-v173.css?v=x-deep-conflict-clean-v173-20260922">'

for name in pages:
    p=app/name
    text=p.read_text(encoding="utf-8")
    lines=[
        line for line in text.splitlines()
        if not any(asset in line for asset in old)
    ]
    text="\n".join(lines)
    if "</head>" not in text:
        raise SystemExit(f"ERROR: </head> missing in {p}")
    text=text.replace("</head>",f"  {link}\n</head>",1)
    p.write_text(text+("\n" if not text.endswith("\n") else ""),encoding="utf-8")
    print("CANONICAL LINK",p)
PY

# Physically remove the old three global style layers.
rm -f   "$APP/memeflow-visual-guardrails-v169.css"   "$APP/memeflow-structural-compat-v169.css"   "$APP/memeflow-x-canonical-v169.css"   "$APP/memeflow-x-canonical-v170.css"   "$APP/memeflow-x-canonical-v171.css"

# Old failed/future local patch artifacts are not part of the site.
rm -rf memeflow_x_final_clean_v170 memeflow_x_final_clean_v171 2>/dev/null || true
rm -f Memflow-X-Final-Clean-V170.zip Memflow-X-Final-Clean-V171.zip 2>/dev/null || true

# Deep source/cascade audit.
python3 - <<'PY'

from pathlib import Path
import re

APP = Path("memeflow-app")

PRODUCTION = [
    "index.html","system.html","how-it-works.html","smart-vault.html",
    "trading.html","settings.html","system-tokens.html","x100.html",
    "agent-performance.html","owner-intelligence.html","system-source.html",
]

CANON = "memeflow-x-canonical-v173.css"
STALE = [
    "memeflow-visual-guardrails-v169.css",
    "memeflow-structural-compat-v169.css",
    "memeflow-x-canonical-v169.css",
    "memeflow-x-canonical-v170.css",
    "memeflow-x-canonical-v171.css",
    "memeflow-x-canonical-v167.css",
    "memeflow-x-lights-out-v166.css",
    "memeflow-pure-black-v165.css",
    "memeflow-pump-fee-full-ui-v164.css",
    "memeflow-pump-fee-palette-v163.css",
    "memeflow-pump-fee-palette-v162.css",
]

BANNED_DARK = [
    "#0f141a","#111820","#141c25","#101113","#181f27",
    "#0d1218","#0d1217","#071117","#020405","#03090d",
    "#0c1117","#0c1318","#0d151b"
]

NORMALIZED_SOURCES = [
    "paper-automation-ui.css","memeflow-brand.css","system.css",
    "memeflow-nav.css","memeflow-header.css","memeflow-theme.css",
    "memeflow-header-nav-polish-v59.css",
    "memeflow-nav-interaction-restore-v59b.css",
    "memeflow-component-consistency-v63.css","access-gate.css",
    "how-it-works.css","trading.css","memeflow-typography-premium-v66.css",
    "trading-visual-hierarchy-v67.css","open-position-popover-v85.css",
    "system-tokens.css","memeflow-insightx-v1.css",
    "memeflow-token-flow-continuous-v1.css","agent-performance.css",
    "owner-intelligence.css","x100.css",
]

errors=[]

# Every top-level HTML page is scanned for stale global style layers.
all_pages=sorted(APP.glob("*.html"))
for p in all_pages:
    t=p.read_text(encoding="utf-8",errors="replace")
    for stale in STALE:
        if stale in t:
            errors.append(f"{p.name}: stale style link {stale}")

# Every production page: one canonical stylesheet, always LAST.
for name in PRODUCTION:
    p=APP/name
    t=p.read_text(encoding="utf-8")
    links=re.findall(
        r'<link\b[^>]*href=["\']([^"\']+\.css[^"\']*)',
        t,
        flags=re.I,
    )
    if sum(CANON in x for x in links) != 1:
        errors.append(f"{name}: canonical link count != 1")
    if not links or CANON not in links[-1]:
        errors.append(f"{name}: canonical is not LAST stylesheet")

# Superseded global files must be physically gone.
for stale in [
    "memeflow-visual-guardrails-v169.css",
    "memeflow-structural-compat-v169.css",
    "memeflow-x-canonical-v169.css",
    "memeflow-x-canonical-v170.css",
    "memeflow-x-canonical-v171.css",
]:
    if (APP/stale).exists():
        errors.append(f"stale global file remains: {stale}")

# Old principal dark palettes must be gone from normalized live source CSS.
for name in NORMALIZED_SOURCES:
    p=APP/name
    if not p.exists():
        continue
    text=re.sub(r'/\*[\s\S]*?\*/','',p.read_text(encoding="utf-8")).lower()
    for token in BANNED_DARK:
        if token in text:
            errors.append(f"{name}: old dark neutral remains {token}")

# Embedded production CSS also cannot keep old dark surface tokens.
style_re=re.compile(r'<style\b[^>]*>([\s\S]*?)</style>',re.I)
for name in PRODUCTION:
    text=(APP/name).read_text(encoding="utf-8")
    styles="\n".join(style_re.findall(text)).lower()
    for token in BANNED_DARK:
        if token in styles:
            errors.append(f"{name}: inline CSS keeps old dark neutral {token}")

# Canonical tokens + header contract.
canon=(APP/CANON).read_text(encoding="utf-8").lower()
for token in (
    "--mf-x-bg: #000000",
    "--mf-x-line: #2f3336",
    "--mf-x-text: #e7e9ea",
    "--mf-x-text-muted: #71767b",
    "--mf-x-text-tertiary: #536471",
    "--mf-x-blue: #1d9bf0",
    "--mf-x-dark-line-inner: #2f3336",
    "--mf-v63-line-dark: #2f3336",
    "--mf-v59-header-line: #2f3336",
    "--mf-structure-divider: #2f3336",
):
    if token not in canon:
        errors.append(f"canonical missing token: {token}")

header=(APP/"memeflow-header.css").read_text(encoding="utf-8").lower()
base=re.search(r'(^|\n)\.mf-site-header\s*\{([\s\S]*?)\}',header)
if not base:
    errors.append("memeflow-header.css: base header rule missing")
else:
    hb=base.group(2)
    if "background:transparent" not in hb.replace(" ",""):
        errors.append("header base is not transparent")
    if "backdrop-filter:none" not in hb.replace(" ",""):
        errors.append("header base still has blur")
    if "#2f3336" not in hb:
        errors.append("header base divider is not #2F3336")

# No production page may contain hard-coded legacy dark colors in style attrs.
for name in PRODUCTION:
    text=(APP/name).read_text(encoding="utf-8").lower()
    attrs=re.findall(r'\sstyle=["\']([^"\']+)["\']',text,re.I)
    joined="\n".join(attrs)
    for token in BANNED_DARK:
        if token in joined:
            errors.append(f"{name}: inline style attribute keeps {token}")

if errors:
    print("V173 DEEP CONFLICT AUDIT: FAIL")
    for e in errors:
        print(" -",e)
    raise SystemExit(1)

print("V173 DEEP CONFLICT AUDIT: PASS")
print(f" - top-level HTML scanned: {len(all_pages)}")
print(f" - production pages audited: {len(PRODUCTION)}")
print(f" - normalized active source CSS files: {len(NORMALIZED_SOURCES)}")
print(" - index.html legacy inline style blocks normalized")
print(" - one canonical global stylesheet per production page, always LAST")
print(" - V169/V170/V171 global visual layers physically removed when present")
print(" - old dark surface palette removed from active normalized sources")
print(" - dark canvas/modules: #000000")
print(" - neutral module frames/dividers: 1px solid #2F3336")
print(" - header: transparent / no blur / no shadow")
print(" - semantic colored state borders preserved")
print(" - no server restart performed")

PY

echo
echo "Installed MEMEFLOW DEEP CONFLICT CLEAN V173"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo
git status --short
