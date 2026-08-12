#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"
APP="$ROOT/memeflow-app"
[[ -f "$APP/index.html" ]] || APP="$ROOT"
INDEX="$APP/index.html"

[[ -f "$INDEX" ]] || {
  echo "ERROR: index.html not found. Run from ~/workspace."
  exit 1
}

if grep -q 'MF_DECISION_FLOW_CANONICAL_V1' "$INDEX"; then
  echo "DECISION FLOW V1 is already installed."
  exit 0
fi

if ! grep -q 'data-mf-ai-module-v5="1"' "$INDEX"; then
  echo "ERROR: AI Final V5 marker not found."
  echo "Nothing changed. This installer refuses to guess against another source state."
  exit 1
fi

PATCH_DIR="$APP/.memeflow-patches/decision-flow-v1"
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
trap 'echo "ERROR: Decision Flow V1 failed; restoring exact pre-install index.html."; rollback' ERR

python3 - "$WORK" <<'PY'
from pathlib import Path
import base64, re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")
flow_css = base64.b64decode("LyogTUZfREVDSVNJT05fRkxPV19DQU5PTklDQUxfVjEKICAgUHJlc2VudGF0aW9uLW9ubHkgcmVsYXRpb25zaGlwIGxheWVyLgogICBFeGlzdGluZyBQcmltYXJ5IENhbmRpZGF0ZSwgQUkgQW5hbHlzaXMgYW5kIFByZS10cmFkZSBjb21wb25lbnRzIGtlZXAKICAgb3duZXJzaGlwIG9mIHRoZWlyIGludGVybmFsIGxheW91dCBhbmQgbG9naWMuIFRoaXMgYmxvY2sgb3ducyBvbmx5OgogICBmbG93IGxhYmVscywgY29ubmVjdG9ycywgc2hhcmVkIG91dGVyIHJoeXRobSBhbmQgc2hhcmVkIG91dGVyIHNraW4uCiovCi5tZi1kZWNpc2lvbi1mbG93LWludHJvLAoubWYtZGVjaXNpb24tZmxvdy1zdGFnZSwKLm1mLWRlY2lzaW9uLWZsb3ctY29ubmVjdG9yewogIGRpc3BsYXk6bm9uZTsKfQoKQG1lZGlhKG1heC13aWR0aDo4MjBweCl7CiAgLm1mLWRlY2lzaW9uLWZsb3ctaW50cm97CiAgICBkaXNwbGF5OmJsb2NrOwogICAgbWFyZ2luOjE2cHggMCA4cHg7CiAgICBwYWRkaW5nOjEzcHggMTRweCAxMnB4OwogICAgYm9yZGVyOjFweCBzb2xpZCByZ2JhKDg0LDIyMSwyNTUsLjIyKTsKICAgIGJvcmRlci1yYWRpdXM6MTZweDsKICAgIGJhY2tncm91bmQ6CiAgICAgIHJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgOCUgMCxyZ2JhKDg0LDIyMSwyNTUsLjA3KSx0cmFuc3BhcmVudCA0MiUpLAogICAgICByZ2JhKDgsMTIsMTcsLjcyKTsKICAgIGJveC1zaGFkb3c6MCAxNHB4IDM0cHggcmdiYSgwLDAsMCwuMTIpOwogIH0KICAubWYtZGVjaXNpb24tZmxvdy1pbnRybyBzbWFsbHsKICAgIGRpc3BsYXk6YmxvY2s7CiAgICBtYXJnaW46MCAwIDZweDsKICAgIGNvbG9yOnZhcigtLWN5YW4pOwogICAgZm9udC1zaXplOjhweDsKICAgIGxpbmUtaGVpZ2h0OjE7CiAgICBmb250LXdlaWdodDo5MDA7CiAgICBsZXR0ZXItc3BhY2luZzouMTZlbTsKICAgIHRleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTsKICB9CiAgLm1mLWRlY2lzaW9uLWZsb3ctaW50cm8gc3Ryb25newogICAgZGlzcGxheTpibG9jazsKICAgIGNvbG9yOiNlOWYwZjU7CiAgICBmb250LXNpemU6MTFweDsKICAgIGxpbmUtaGVpZ2h0OjEuMzU7CiAgICBmb250LXdlaWdodDo4MDA7CiAgICBsZXR0ZXItc3BhY2luZzotLjAxMmVtOwogIH0KICAubWYtZGVjaXNpb24tZmxvdy1pbnRybyBwewogICAgbWFyZ2luOjVweCAwIDA7CiAgICBjb2xvcjojN2Y4ZDlkOwogICAgZm9udC1zaXplOjlweDsKICAgIGxpbmUtaGVpZ2h0OjEuNDsKICB9CiAgLm1mLWRlY2lzaW9uLWZsb3ctbWFwewogICAgZGlzcGxheTpncmlkOwogICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOmF1dG8gMWZyIGF1dG8gMWZyIGF1dG87CiAgICBhbGlnbi1pdGVtczpjZW50ZXI7CiAgICBnYXA6NnB4OwogICAgbWFyZ2luLXRvcDoxMHB4OwogIH0KICAubWYtZGVjaXNpb24tZmxvdy1tYXAgc3BhbnsKICAgIG1pbi13aWR0aDowOwogICAgY29sb3I6IzllYWJiYTsKICAgIGZvbnQtc2l6ZTo3LjVweDsKICAgIGxpbmUtaGVpZ2h0OjE7CiAgICBmb250LXdlaWdodDo3NjA7CiAgICB3aGl0ZS1zcGFjZTpub3dyYXA7CiAgfQogIC5tZi1kZWNpc2lvbi1mbG93LW1hcCBpewogICAgaGVpZ2h0OjFweDsKICAgIG1pbi13aWR0aDoxMHB4OwogICAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcscmdiYSg4NCwyMjEsMjU1LC41NSkscmdiYSg4NCwyMjEsMjU1LC4xMikpOwogICAgcG9zaXRpb246cmVsYXRpdmU7CiAgfQogIC5tZi1kZWNpc2lvbi1mbG93LW1hcCBpOjphZnRlcnsKICAgIGNvbnRlbnQ6IiI7CiAgICBwb3NpdGlvbjphYnNvbHV0ZTsKICAgIHJpZ2h0Oi0xcHg7CiAgICB0b3A6NTAlOwogICAgd2lkdGg6NHB4OwogICAgaGVpZ2h0OjRweDsKICAgIGJvcmRlci10b3A6MXB4IHNvbGlkIHJnYmEoODQsMjIxLDI1NSwuNjIpOwogICAgYm9yZGVyLXJpZ2h0OjFweCBzb2xpZCByZ2JhKDg0LDIyMSwyNTUsLjYyKTsKICAgIHRyYW5zZm9ybTp0cmFuc2xhdGVZKC01MCUpIHJvdGF0ZSg0NWRlZyk7CiAgfQoKICAubWYtZGVjaXNpb24tZmxvdy1zdGFnZXsKICAgIGRpc3BsYXk6ZmxleDsKICAgIGFsaWduLWl0ZW1zOmNlbnRlcjsKICAgIGdhcDo4cHg7CiAgICBtaW4taGVpZ2h0OjI4cHg7CiAgICBtYXJnaW46NXB4IDAgNXB4OwogICAgcGFkZGluZzowIDdweDsKICAgIGNvbG9yOiM4MTkwYTE7CiAgfQogIC5tZi1kZWNpc2lvbi1mbG93LXN0YWdlOjpiZWZvcmV7CiAgICBjb250ZW50OiIiOwogICAgd2lkdGg6OHB4OwogICAgaGVpZ2h0OjhweDsKICAgIGZsZXg6MCAwIDhweDsKICAgIGJvcmRlcjoxcHggc29saWQgcmdiYSg4NCwyMjEsMjU1LC43Mik7CiAgICBib3JkZXItcmFkaXVzOjUwJTsKICAgIGJhY2tncm91bmQ6IzBhMTExODsKICAgIGJveC1zaGFkb3c6MCAwIDAgM3B4IHJnYmEoODQsMjIxLDI1NSwuMDYpLDAgMCAxMnB4IHJnYmEoODQsMjIxLDI1NSwuMTYpOwogIH0KICAubWYtZGVjaXNpb24tZmxvdy1zdGFnZSAubWYtZmxvdy1zdGVwewogICAgZmxleDowIDAgYXV0bzsKICAgIG1pbi1oZWlnaHQ6MjJweDsKICAgIHBhZGRpbmc6MCA4cHg7CiAgICBib3JkZXI6MXB4IHNvbGlkIHJnYmEoODQsMjIxLDI1NSwuMjIpOwogICAgYm9yZGVyLXJhZGl1czo5OTlweDsKICAgIGJhY2tncm91bmQ6cmdiYSg4NCwyMjEsMjU1LC4wMzUpOwogICAgZGlzcGxheTppbmxpbmUtZmxleDsKICAgIGFsaWduLWl0ZW1zOmNlbnRlcjsKICAgIGNvbG9yOnZhcigtLWN5YW4pOwogICAgZm9udC1zaXplOjdweDsKICAgIGxpbmUtaGVpZ2h0OjE7CiAgICBmb250LXdlaWdodDo5MDA7CiAgICBsZXR0ZXItc3BhY2luZzouMTJlbTsKICB9CiAgLm1mLWRlY2lzaW9uLWZsb3ctc3RhZ2UgYnsKICAgIG1pbi13aWR0aDowOwogICAgY29sb3I6I2I3YzJjZDsKICAgIGZvbnQtc2l6ZTo4LjVweDsKICAgIGxpbmUtaGVpZ2h0OjEuMjsKICAgIGZvbnQtd2VpZ2h0OjcyMDsKICAgIHdoaXRlLXNwYWNlOm5vd3JhcDsKICAgIG92ZXJmbG93OmhpZGRlbjsKICAgIHRleHQtb3ZlcmZsb3c6ZWxsaXBzaXM7CiAgfQogIC5tZi1kZWNpc2lvbi1mbG93LXN0YWdlIHNtYWxsewogICAgbWFyZ2luLWxlZnQ6YXV0bzsKICAgIGNvbG9yOiM2OTc3ODk7CiAgICBmb250LXNpemU6Ny41cHg7CiAgICBsaW5lLWhlaWdodDoxLjI7CiAgICB3aGl0ZS1zcGFjZTpub3dyYXA7CiAgfQoKICAubWYtZGVjaXNpb24tZmxvdy1jb25uZWN0b3J7CiAgICBkaXNwbGF5OmZsZXg7CiAgICBhbGlnbi1pdGVtczpjZW50ZXI7CiAgICB3aWR0aDoxMDAlOwogICAgaGVpZ2h0OjIwcHg7CiAgICBtYXJnaW46MDsKICAgIHBhZGRpbmctbGVmdDoxMHB4OwogIH0KICAubWYtZGVjaXNpb24tZmxvdy1jb25uZWN0b3I6OmJlZm9yZXsKICAgIGNvbnRlbnQ6IiI7CiAgICB3aWR0aDoxcHg7CiAgICBoZWlnaHQ6MjBweDsKICAgIG1hcmdpbi1sZWZ0OjFweDsKICAgIGJhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE4MGRlZyxyZ2JhKDg0LDIyMSwyNTUsLjUwKSxyZ2JhKDg0LDIyMSwyNTUsLjEyKSk7CiAgICBib3gtc2hhZG93OjAgMCAxMHB4IHJnYmEoODQsMjIxLDI1NSwuMTApOwogIH0KICAubWYtZGVjaXNpb24tZmxvdy1jb25uZWN0b3I6OmFmdGVyewogICAgY29udGVudDoiIjsKICAgIHdpZHRoOjVweDsKICAgIGhlaWdodDo1cHg7CiAgICBtYXJnaW4tbGVmdDotM3B4OwogICAgYWxpZ24tc2VsZjpmbGV4LWVuZDsKICAgIGJvcmRlci1yaWdodDoxcHggc29saWQgcmdiYSg4NCwyMjEsMjU1LC41OCk7CiAgICBib3JkZXItYm90dG9tOjFweCBzb2xpZCByZ2JhKDg0LDIyMSwyNTUsLjU4KTsKICAgIHRyYW5zZm9ybTp0cmFuc2xhdGVZKDFweCkgcm90YXRlKDQ1ZGVnKTsKICB9CgogIC8qIE9uZSBleHRlcm5hbC1sYXlvdXQgb3duZXIgZm9yIHRoZSB0aHJlZSBmbG93IGNhcmRzLiAqLwogICNwcmltYXJ5LWNhbmRpZGF0ZVtkYXRhLW1mLWRlY2lzaW9uLWZsb3ctY2FyZD0iMSJdLAogICNhaS1hbmFseXNpc1tkYXRhLW1mLWRlY2lzaW9uLWZsb3ctY2FyZD0iMiJdLAogICNleGVjdXRpb25QcmV2aWV3W2RhdGEtbWYtZGVjaXNpb24tZmxvdy1jYXJkPSIzIl17CiAgICB3aWR0aDoxMDAlIWltcG9ydGFudDsKICAgIG1heC13aWR0aDpub25lIWltcG9ydGFudDsKICAgIG1hcmdpbjowIWltcG9ydGFudDsKICAgIGJvcmRlci1yYWRpdXM6MThweCFpbXBvcnRhbnQ7CiAgICBib3JkZXItY29sb3I6cmdiYSg4NCwyMjEsMjU1LC4yMCkhaW1wb3J0YW50OwogICAgYm94LXNoYWRvdzowIDE0cHggMzRweCByZ2JhKDAsMCwwLC4xNCkhaW1wb3J0YW50OwogICAgYmFja2dyb3VuZDoKICAgICAgbGluZWFyLWdyYWRpZW50KDE4MGRlZyxyZ2JhKDE0LDIwLDI4LC45NjUpLHJnYmEoOCwxMiwxNywuOTg1KSkhaW1wb3J0YW50OwogIH0KCiAgLyogU2hhcmVkIGhlYWRlciByaHl0aG07IGludGVybmFscyByZW1haW4gY29tcG9uZW50LW93bmVkLiAqLwogICNwcmltYXJ5LWNhbmRpZGF0ZVtkYXRhLW1mLWRlY2lzaW9uLWZsb3ctY2FyZD0iMSJdIC5wYW5lbC1oZWFkLAogICNleGVjdXRpb25QcmV2aWV3W2RhdGEtbWYtZGVjaXNpb24tZmxvdy1jYXJkPSIzIl0gLmV4ZWN1dGlvbi1oZWFkewogICAgbWluLWhlaWdodDo2MnB4IWltcG9ydGFudDsKICAgIHBhZGRpbmc6MTJweCAxNHB4IWltcG9ydGFudDsKICB9CiAgI2FpLWFuYWx5c2lzW2RhdGEtbWYtZGVjaXNpb24tZmxvdy1jYXJkPSIyIl0+c3VtbWFyeXsKICAgIG1pbi1oZWlnaHQ6NzBweCFpbXBvcnRhbnQ7CiAgICBwYWRkaW5nOjEycHggMTRweCFpbXBvcnRhbnQ7CiAgfQp9CgpAbWVkaWEobWF4LXdpZHRoOjQzMHB4KXsKICAubWYtZGVjaXNpb24tZmxvdy1pbnRyb3sKICAgIHBhZGRpbmc6MTJweCAxM3B4IDExcHg7CiAgfQogIC5tZi1kZWNpc2lvbi1mbG93LWludHJvIHN0cm9uZ3sKICAgIGZvbnQtc2l6ZToxMC41cHg7CiAgfQogIC5tZi1kZWNpc2lvbi1mbG93LW1hcCBzcGFuewogICAgZm9udC1zaXplOjdweDsKICB9CiAgLm1mLWRlY2lzaW9uLWZsb3ctc3RhZ2V7CiAgICBwYWRkaW5nLWlubGluZTo1cHg7CiAgfQogIC5tZi1kZWNpc2lvbi1mbG93LXN0YWdlIHNtYWxsewogICAgZGlzcGxheTpub25lOwogIH0KfQ==").decode("utf-8")

style_before = len(re.findall(r"<style\b", src, flags=re.I))
script_before = len(re.findall(r"<script\b", src, flags=re.I))
script_blocks_before = re.findall(
    r"<script\b[^>]*>.*?</script>",
    src,
    flags=re.I | re.S
)

required_ids = (
    "primary-candidate",
    "primaryState",
    "primaryName",
    "primaryScore",
    "ai-analysis",
    "decisionLane",
    "decisionReason",
    "aiAnalysisDeep",
    "pane-evidence",
    "pane-timeline",
    "pane-memory",
    "executionPreview",
    "executionState",
    "executionReadinessCount",
    "executionReadinessBar",
    "executionChecksToggle",
    "executionCheckList",
)
for ident in required_ids:
    count = src.count(f'id="{ident}"')
    if count != 1:
        raise SystemExit(f"Expected exactly one #{ident}; found {count}.")

if src.count('data-mf-ai-module-v5="1"') != 1:
    raise SystemExit("Expected exactly one AI Final V5 marker.")

def find_root(text, id_value):
    pattern = re.compile(
        rf'<(?P<tag>[a-zA-Z0-9:-]+)\b(?=[^>]*\bid=["\']{re.escape(id_value)}["\'])[^>]*>',
        flags=re.I
    )
    match = pattern.search(text)
    if not match:
        raise SystemExit(f"Opening tag for #{id_value} not found.")
    return match

primary = find_root(src, "primary-candidate")
ai = find_root(src, "ai-analysis")
pretrade = find_root(src, "executionPreview")

if not (primary.start() < ai.start() < pretrade.start()):
    raise SystemExit(
        "Expected source order Primary Candidate -> AI Analysis -> Pre-trade."
    )

def add_attr(text, id_value, attr_name, attr_value):
    match = find_root(text, id_value)
    opening = match.group(0)
    if re.search(rf'\b{re.escape(attr_name)}=', opening, flags=re.I):
        raise SystemExit(f"{attr_name} already exists on #{id_value}.")
    updated = opening[:-1] + f' {attr_name}="{attr_value}">'
    return text[:match.start()] + updated + text[match.end():]

src = add_attr(src, "executionPreview", "data-mf-decision-flow-card", "3")
src = add_attr(src, "ai-analysis", "data-mf-decision-flow-card", "2")
src = add_attr(src, "primary-candidate", "data-mf-decision-flow-card", "1")

intro = """<section class="mf-decision-flow-intro" data-mf-decision-flow-ui="1" aria-label="Decision flow">
  <small>Decision flow</small>
  <strong>Candidate → AI analysis → Execution readiness</strong>
  <p>One decision pipeline from opportunity to executable trade.</p>
  <div class="mf-decision-flow-map" aria-hidden="true">
    <span>1 Candidate</span><i></i><span>2 Analysis</span><i></i><span>3 Execution</span>
  </div>
</section>
<div class="mf-decision-flow-stage" data-mf-decision-flow-ui="1">
  <span class="mf-flow-step">STEP 1</span><b>Primary Candidate</b><small>Opportunity</small>
</div>
"""

stage2 = """<div class="mf-decision-flow-connector" data-mf-decision-flow-ui="1" aria-hidden="true"></div>
<div class="mf-decision-flow-stage" data-mf-decision-flow-ui="1">
  <span class="mf-flow-step">STEP 2</span><b>AI Analysis &amp; Market Data</b><small>Intelligence</small>
</div>
"""

stage3 = """<div class="mf-decision-flow-connector" data-mf-decision-flow-ui="1" aria-hidden="true"></div>
<div class="mf-decision-flow-stage" data-mf-decision-flow-ui="1">
  <span class="mf-flow-step">STEP 3</span><b>Pre-trade checks</b><small>Execution gate</small>
</div>
"""

pretrade = find_root(src, "executionPreview")
src = src[:pretrade.start()] + stage3 + src[pretrade.start():]

ai = find_root(src, "ai-analysis")
src = src[:ai.start()] + stage2 + src[ai.start():]

primary = find_root(src, "primary-candidate")
src = src[:primary.start()] + intro + src[primary.start():]

style_re = re.compile(
    r'(<style\s+id=["\']memeflow-consolidated-css["\']>)(.*?)(</style>)',
    flags=re.I | re.S
)
matches = list(style_re.finditer(src))
if len(matches) != 1:
    raise SystemExit(
        f"Expected one #memeflow-consolidated-css style block; found {len(matches)}."
    )

m = matches[0]
body = m.group(2)
if "MF_DECISION_FLOW_CANONICAL_V1" in body:
    raise SystemExit("Partial Decision Flow CSS already exists.")

body = body.rstrip() + "\n\n" + flow_css + "\n"
src = src[:m.start()] + m.group(1) + body + m.group(3) + src[m.end():]

style_after = len(re.findall(r"<style\b", src, flags=re.I))
script_after = len(re.findall(r"<script\b", src, flags=re.I))
script_blocks_after = re.findall(
    r"<script\b[^>]*>.*?</script>",
    src,
    flags=re.I | re.S
)

checks = {
    "style count unchanged": style_after == style_before,
    "script count unchanged": script_after == script_before,
    "script bodies byte-identical": script_blocks_after == script_blocks_before,
    "one flow CSS owner": src.count("MF_DECISION_FLOW_CANONICAL_V1") == 1,
    "one flow intro": src.count('class="mf-decision-flow-intro"') == 1,
    "three flow stages": src.count('class="mf-decision-flow-stage"') == 3,
    "two connectors": src.count('class="mf-decision-flow-connector"') == 2,
    "primary annotated once": len(re.findall(
        r'<[^>]+\bid=["\']primary-candidate["\'][^>]+\bdata-mf-decision-flow-card=["\']1["\']',
        src, flags=re.I
    )) == 1,
    "AI annotated once": len(re.findall(
        r'<[^>]+\bid=["\']ai-analysis["\'][^>]+\bdata-mf-decision-flow-card=["\']2["\']',
        src, flags=re.I
    )) == 1,
    "pretrade annotated once": len(re.findall(
        r'<[^>]+\bid=["\']executionPreview["\'][^>]+\bdata-mf-decision-flow-card=["\']3["\']',
        src, flags=re.I
    )) == 1,
    "AI V5 preserved": src.count('data-mf-ai-module-v5="1"') == 1,
}
for ident in required_ids:
    checks[f"#{ident} preserved"] = src.count(f'id="{ident}"') == 1

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Verification failed: " + ", ".join(failed))

path.write_text(src, encoding="utf-8")

print("Decision Flow V1 source consolidation prepared.")
print(f"<style> count: {style_before} -> {style_after}")
print(f"<script> count: {script_before} -> {script_after}")
print("Existing script bodies unchanged: PASS")
print("Primary / AI / Pre-trade nodes moved: NO")
print("Logic IDs preserved: PASS")
PY

grep -q 'MF_DECISION_FLOW_CANONICAL_V1' "$WORK"
grep -q 'data-mf-decision-flow-card="1"' "$WORK"
grep -q 'data-mf-decision-flow-card="2"' "$WORK"
grep -q 'data-mf-decision-flow-card="3"' "$WORK"
grep -q 'data-mf-ai-module-v5="1"' "$WORK"

cp "$WORK" "$INDEX"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
BACKUP=$BACKUP
EOF

rm -f "$WORK"
trap - ERR

echo
echo "OK: DECISION FLOW V1 installed cleanly."
echo
echo "Primary Candidate node: PRESERVED / NOT MOVED"
echo "AI Analysis node: PRESERVED / NOT MOVED"
echo "Pre-trade node: PRESERVED / NOT MOVED"
echo "Decision Flow CSS owner: ONE"
echo "New <style> elements: NONE"
echo "New <script> elements: NONE"
echo "Existing script bodies: UNCHANGED"
echo "AI Final V5: PRESERVED"
echo "AI evaluator: UNCHANGED"
echo "Pre-trade readiness logic: UNCHANGED"
echo "Trading / PAPER / LIVE logic: UNCHANGED"
echo
echo "Decision Flow chrome is mobile-only; desktop production layout is unchanged."
echo "Now Stop -> Run and hard-refresh."
