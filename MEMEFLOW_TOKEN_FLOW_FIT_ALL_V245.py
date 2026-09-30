#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re
import shutil
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-compact-sort-v242.css"
CSS_MARKER = "MEMEFLOW_TOKEN_FLOW_FIT_ALL_V245_CSS"

CSS = r'''
/* ===== MEMEFLOW_TOKEN_FLOW_FIT_ALL_V245_CSS =====
   Mobile-first card geometry only.
   Goal: no clipped VOL / TX / MC / Δ% / SCORE values on iPhone,
   while keeping SCORE far-right and identity metadata on row two.
*/
body.mf-page-system-tokens{
  --mf-v245-card-x:7px;
  --mf-v245-avatar:44px;
  --mf-v245-metric-font:9px;
  --mf-v245-meta-font:9px;
  --mf-v245-rail:rgba(255,255,255,.075);
}

/* Two actual card rows:
   row 1 = name + VOL / TX / MC / Δ%
   row 2 = holders + age + action
   SCORE stays at the far right and spans both rows. */
body.mf-page-system-tokens .token-list > .flow-token{
  min-height:76px !important;
  padding:7px var(--mf-v245-card-x) !important;
  grid-template-columns:
    minmax(0,1fr)
    50px
    38px
    50px
    46px
    36px !important;
  grid-template-rows:34px 26px !important;
  column-gap:0 !important;
  row-gap:0 !important;
  align-items:stretch !important;
  align-content:center !important;
}

/* Identity owns only the remaining flexible width. */
body.mf-page-system-tokens .token-list > .flow-token > .token-primary{
  grid-column:1 !important;
  grid-row:1 / span 2 !important;
  width:100% !important;
  min-width:0 !important;
  height:60px !important;
  padding:0 5px 0 0 !important;
  align-self:center !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-head{
  width:100% !important;
  min-width:0 !important;
  height:60px !important;
  display:grid !important;
  grid-template-columns:var(--mf-v245-avatar) minmax(0,1fr) !important;
  gap:7px !important;
  align-items:center !important;
}
body.mf-page-system-tokens .token-list > .flow-token :is(
  .token-avatar,
  .mf-token-avatar-anchor-v51,
  .mf-token-avatar-anchor-v51 > .token-avatar
){
  width:var(--mf-v245-avatar) !important;
  height:var(--mf-v245-avatar) !important;
  min-width:var(--mf-v245-avatar) !important;
  min-height:var(--mf-v245-avatar) !important;
  max-width:var(--mf-v245-avatar) !important;
  max-height:var(--mf-v245-avatar) !important;
  border-radius:9px !important;
}

/* Flatten token-top into token-meta so age/source controls can sit on row two. */
body.mf-page-system-tokens .token-list > .flow-token .token-meta{
  width:100% !important;
  min-width:0 !important;
  height:54px !important;
  display:grid !important;
  grid-template-columns:auto auto minmax(0,1fr) !important;
  grid-template-rows:28px 22px !important;
  column-gap:6px !important;
  row-gap:0 !important;
  align-content:center !important;
  align-items:center !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-top{
  display:contents !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-name{
  grid-column:1 / -1 !important;
  grid-row:1 !important;
  min-width:0 !important;
  max-width:100% !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  white-space:nowrap !important;
  font-size:10px !important;
  line-height:1.05 !important;
}
body.mf-page-system-tokens .token-list > .flow-token .mf-token-subline-v47c{
  grid-column:1 !important;
  grid-row:2 !important;
  min-width:0 !important;
  min-height:0 !important;
  margin:0 !important;
  display:flex !important;
  align-items:center !important;
}
body.mf-page-system-tokens .token-list > .flow-token .mf-holder-mini-v47c{
  min-width:0 !important;
  gap:3px !important;
  padding:0 !important;
  border:0 !important;
  background:transparent !important;
  font-size:var(--mf-v245-meta-font) !important;
  line-height:1 !important;
  white-space:nowrap !important;
}
body.mf-page-system-tokens .token-list > .flow-token .mf-holder-mini-v47c svg{
  width:10px !important;
  height:10px !important;
  flex:0 0 10px !important;
}
body.mf-page-system-tokens .token-list > .flow-token .mf-token-age-chip-v47c{
  grid-column:2 !important;
  grid-row:2 !important;
  min-width:0 !important;
  margin:0 !important;
  padding:0 !important;
  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  font-size:var(--mf-v245-meta-font) !important;
  line-height:1 !important;
  white-space:nowrap !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-source-links{
  grid-column:3 !important;
  grid-row:2 !important;
  min-width:0 !important;
  justify-self:start !important;
  display:inline-flex !important;
  align-items:center !important;
  gap:2px !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-source-link{
  width:16px !important;
  height:16px !important;
  min-width:16px !important;
  min-height:16px !important;
  padding:0 !important;
  border:0 !important;
  border-radius:4px !important;
  background:transparent !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-source-link svg{
  width:11px !important;
  height:11px !important;
}

/* Strip becomes direct card-grid children as in V242. */
body.mf-page-system-tokens .token-list > .flow-token > :is(
  .mf-open-market-strip,
  .mf-regular-market-strip
){
  display:contents !important;
}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(-n+2),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(-n+2){
  display:none !important;
}

/* VOL / TX / MC / Δ% are one aligned top row. */
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(3),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(3){grid-column:2 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(4),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(4){grid-column:3 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(5),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(5){grid-column:4 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(6),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(6){grid-column:5 !important;grid-row:1 !important;}

body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3){
  width:100% !important;
  min-width:0 !important;
  height:34px !important;
  min-height:34px !important;
  margin:0 !important;
  padding:0 3px !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  border:0 !important;
  border-left:.5px solid var(--mf-v245-rail) !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  text-align:center !important;
  box-sizing:border-box !important;
  overflow:hidden !important;
}
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3) > span{
  display:none !important;
}
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3) > strong{
  width:100% !important;
  min-width:0 !important;
  margin:0 !important;
  padding:0 !important;
  font-size:var(--mf-v245-metric-font) !important;
  font-weight:700 !important;
  line-height:1 !important;
  letter-spacing:-.035em !important;
  font-variant-numeric:tabular-nums !important;
  text-align:center !important;
  white-space:nowrap !important;
  overflow:visible !important;
  text-overflow:clip !important;
  transform:none !important;
}

/* SCORE/P&L is permanently the last rail and vertically centered. */
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot,.mf-open-pnl-slot){
  grid-column:6 !important;
  grid-row:1 / span 2 !important;
  width:100% !important;
  min-width:0 !important;
  height:60px !important;
  min-height:60px !important;
  margin:0 !important;
  padding:0 2px !important;
  display:flex !important;
  flex-direction:column !important;
  align-items:center !important;
  justify-content:center !important;
  border:0 !important;
  border-left:.5px solid var(--mf-v245-rail) !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  text-align:center !important;
  overflow:visible !important;
}
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot,.mf-open-pnl-slot) > span{
  display:none !important;
}
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot,.mf-open-pnl-slot) > strong{
  width:100% !important;
  min-width:0 !important;
  margin:0 !important;
  padding:0 !important;
  font-size:10px !important;
  font-weight:750 !important;
  line-height:1 !important;
  letter-spacing:-.03em !important;
  font-variant-numeric:tabular-nums !important;
  text-align:center !important;
  white-space:nowrap !important;
  overflow:visible !important;
  text-overflow:clip !important;
}

/* Expanded details always start below both compact rows. */
body.mf-page-system-tokens .token-list > .flow-token .token-details{
  grid-column:1 / -1 !important;
  grid-row:3 !important;
}

/* The sort header follows the exact same metric rail widths as the cards. */
body.mf-page-system-tokens .mf-sorters-v242{
  flex:1 1 auto !important;
  min-width:0 !important;
}
body.mf-page-system-tokens .mf-sorters-v242 button{
  font-size:9px !important;
  letter-spacing:-.02em !important;
}

@media(max-width:390px){
  body.mf-page-system-tokens{
    --mf-v245-card-x:6px;
    --mf-v245-avatar:42px;
    --mf-v245-metric-font:8.5px;
    --mf-v245-meta-font:8.5px;
  }
  body.mf-page-system-tokens .token-list > .flow-token{
    grid-template-columns:
      minmax(0,1fr)
      47px
      36px
      47px
      43px
      34px !important;
  }
  body.mf-page-system-tokens .token-list > .flow-token .token-head{
    gap:6px !important;
  }
  body.mf-page-system-tokens .token-list > .flow-token .token-meta{
    column-gap:5px !important;
  }
  body.mf-page-system-tokens .token-list > .flow-token .token-name{
    font-size:9.5px !important;
  }
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot,.mf-open-pnl-slot) > strong{
    font-size:9.5px !important;
  }
}

@media(min-width:520px){
  body.mf-page-system-tokens{
    --mf-v245-card-x:9px;
    --mf-v245-avatar:48px;
    --mf-v245-metric-font:10px;
    --mf-v245-meta-font:9.5px;
  }
  body.mf-page-system-tokens .token-list > .flow-token{
    grid-template-columns:
      minmax(0,1fr)
      62px
      50px
      62px
      58px
      46px !important;
  }
  body.mf-page-system-tokens .token-list > .flow-token .token-name{font-size:11px !important;}
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot,.mf-open-pnl-slot) > strong{font-size:11px !important;}
}
/* ===== /MEMEFLOW_TOKEN_FLOW_FIT_ALL_V245_CSS ===== */
'''


def fail(message):
    print(f"\n[FAIL] {message}")
    sys.exit(1)


def main():
    root = Path.cwd()
    app = root / "memeflow-app"
    if not app.is_dir() and root.name == "memeflow-app":
        app = root
        root = app.parent
    if not app.is_dir():
        fail("memeflow-app not found. Run from the existing Replit workspace Shell.")

    try:
        origin = subprocess.check_output(
            ["git", "config", "--get", "remote.origin.url"],
            cwd=root,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        origin = ""

    if origin and EXPECTED_REPO_FRAGMENT not in origin:
        fail(f"Unexpected git origin: {origin}")

    html_path = app / "system-tokens.html"
    css_path = app / CSS_NAME
    js_path = app / "system-tokens.js"

    for path in (html_path, css_path, js_path):
        if not path.is_file():
            fail(f"Missing required file: {path}")

    html = html_path.read_text(encoding="utf-8")
    css = css_path.read_text(encoding="utf-8")
    js = js_path.read_text(encoding="utf-8")

    if "mfCompactSortV242" not in html:
        fail("V242 compact sort markup is not installed. Nothing changed.")
    if "MEMEFLOW_TOKEN_FLOW_COMPACT_SORT_V242" not in js:
        fail("V242 client logic is not installed. Nothing changed.")

    # Idempotent: remove an older V245 block if the user reruns this installer.
    css = re.sub(
        r"\n?/\* ===== MEMEFLOW_TOKEN_FLOW_FIT_ALL_V245_CSS ===== \*/.*?"
        r"/\* ===== /MEMEFLOW_TOKEN_FLOW_FIT_ALL_V245_CSS ===== \*/\n?",
        "\n",
        css,
        flags=re.S,
    )
    css = css.rstrip() + "\n\n" + CSS.strip() + "\n"

    css_link_pattern = r'href="/' + re.escape(CSS_NAME) + r'(?:\?v=[^"]*)?"'
    html, n = re.subn(
        css_link_pattern,
        f'href="/{CSS_NAME}?v=245-20260928"',
        html,
        count=1,
    )
    if n != 1:
        fail("Compact Token Flow stylesheet link was not found. Nothing changed.")

    if css.count("/* ===== MEMEFLOW_TOKEN_FLOW_FIT_ALL_V245_CSS =====") != 1:
        fail("Internal V245 CSS validation failed. Nothing changed.")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = root / f".memeflow-token-flow-before-v245-{stamp}"
    backup.mkdir(parents=True, exist_ok=False)
    for path in (html_path, css_path):
        target = backup / path.relative_to(root)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)

    css_path.write_text(css, encoding="utf-8")
    html_path.write_text(html, encoding="utf-8")

    try:
        subprocess.run(
            [
                "git", "diff", "--check", "--",
                "memeflow-app/system-tokens.html",
                f"memeflow-app/{CSS_NAME}",
            ],
            cwd=root,
            check=True,
        )
    except subprocess.CalledProcessError:
        shutil.copy2(backup / html_path.relative_to(root), html_path)
        shutil.copy2(backup / css_path.relative_to(root), css_path)
        fail(f"git diff --check failed; V245 was rolled back. Backup: {backup}")

    print("\n[OK] MEMEFLOW TOKEN FLOW FIT ALL V245 installed.")
    print(f"[BACKUP] {backup}")
    print("\nV245:")
    print("  • VOL / TX / MC / Δ% are forced into one readable top row")
    print("  • SCORE stays the final far-right rail and is vertically centered")
    print("  • holders / token age / source icon share the second identity row")
    print("  • card metric typography is explicitly sized so global typography cannot blow it up")
    print("  • avatar + identity column are narrower to give market values real width")
    print("  • metric values no longer use ellipsis clipping")
    print("  • active-sort highlight and state stripe remain intact")
    print("  • sorting / scanner / trading / Entry / Score logic untouched")
    print("\nNo process/server restart was performed.")
    print("\nPush after visual check:")
    print(
        "git add memeflow-app/system-tokens.html "
        "memeflow-app/memeflow-token-flow-compact-sort-v242.css && "
        "git commit -m \"Fit all Token Flow card metrics on mobile\" && git push"
    )


if __name__ == "__main__":
    main()
