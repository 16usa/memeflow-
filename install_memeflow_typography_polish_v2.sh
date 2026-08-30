#!/usr/bin/env bash
set -euo pipefail

echo "MEMEFLOW Typography Polish V2"
echo "============================="

if [ -f "memeflow-app/memeflow-brand.css" ]; then
  APP_DIR="memeflow-app"
elif [ -f "memeflow-brand.css" ]; then
  APP_DIR="."
else
  echo "ERROR: memeflow-brand.css not found."
  echo "Run this script from the MEMEFLOW repository root."
  exit 1
fi

BRAND="$APP_DIR/memeflow-brand.css"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$APP_DIR/.typography-v2-backup-$STAMP"
mkdir -p "$BACKUP_DIR"

cp "$BRAND" "$BACKUP_DIR/memeflow-brand.css"
for f in index.html system.html trading.html system-tokens.html; do
  if [ -f "$APP_DIR/$f" ]; then
    cp "$APP_DIR/$f" "$BACKUP_DIR/$f"
  fi
done

python3 - "$APP_DIR" <<'PY'
from pathlib import Path
import re
import sys

app = Path(sys.argv[1])
brand = app / "memeflow-brand.css"

V1_START = "MEMEFLOW_CANONICAL_TYPOGRAPHY_V1_START"
if V1_START not in brand.read_text(encoding="utf-8"):
    raise SystemExit(
        "ERROR: Typography V1 not found. Install install_memeflow_typography_v1.sh first."
    )

START = "/* ===== MEMEFLOW_TYPOGRAPHY_POLISH_V2_START ===== */"
END   = "/* ===== MEMEFLOW_TYPOGRAPHY_POLISH_V2_END ===== */"

css = brand.read_text(encoding="utf-8")

# Idempotent: replace V2 if the installer is run again.
css = re.sub(
    re.escape(START) + r".*?" + re.escape(END),
    "",
    css,
    flags=re.S,
).rstrip() + "\n\n"

layer = r"""
/* ===== MEMEFLOW_TYPOGRAPHY_POLISH_V2_START ===== */
/*
  Final visual polish after device screenshots.
  Scope:
    1) Trading Terminal micro technical copy only.
    2) System Settings accordion titles only.
  Explicitly NOT touched:
    - Token Flow typography
    - global drawer / memeflow-nav.css
    - hero/page titles
    - trading logic, chart logic, API, data, wallet or scanner behavior
*/

/* --------------------------------------------------------------- */
/* TRADING TERMINAL — tiny chart telemetry                         */
/* --------------------------------------------------------------- */

/*
  OHLC / candles / trades / SL / TP chips above the chart.
  trading.css had these at 6px, which stayed visibly undersized
  after V1 because chart-legend is a separate technical layer.
*/
.terminal .chart-legend span{
  font-size:8px!important;
  line-height:1.2!important;
}

/* Bottom chart metrics: Score / Holders / Top 10 / Developer / Liquidity. */
.terminal .selected-metrics span{
  font-size:9px!important;
  line-height:1.2!important;
}
.terminal .selected-metrics strong{
  font-size:10px!important;
  line-height:1.2!important;
}

/* Recent trades — secondary detail row only. */
.terminal .trade-log-details b{
  font-size:9px!important;
  line-height:1.2!important;
}
.terminal .trade-log-details strong{
  font-size:10px!important;
  line-height:1.25!important;
}

/* Keep timestamps and tiny execution-log hint readable but secondary. */
.terminal .trade-log-time,
.terminal .trade-log-hint{
  font-size:8px!important;
}

/* --------------------------------------------------------------- */
/* SYSTEM SETTINGS — slightly calmer section hierarchy             */
/* --------------------------------------------------------------- */

/*
  Accordion section names such as:
  Wallet & Smart Vault / Execution & safety / Logic /
  Trading / Copy trading / Entry filters.
  Reduce only the section heading weight/size; values and field copy stay V1.
*/
#settings .settings-group > summary b{
  font-size:14px!important;
  line-height:1.18!important;
  font-weight:760!important;
  letter-spacing:-.01em!important;
}

/* Common newer settings shell aliases, if present in the running build. */
#settings .settings-section > summary b,
#settings .settings-accordion > details > summary b{
  font-size:14px!important;
  line-height:1.18!important;
  font-weight:760!important;
  letter-spacing:-.01em!important;
}

/*
  If the standalone/mobile settings renderer uses headings rather than <b>,
  constrain only headings inside accordion summaries.
*/
#settings details > summary h2,
#settings details > summary h3{
  font-size:14px!important;
  line-height:1.18!important;
  font-weight:760!important;
  letter-spacing:-.01em!important;
}

/* Phone stays exactly the same scale — no additional shrink. */
@media(max-width:760px){
  .terminal .chart-legend span{
    font-size:8px!important;
  }
  .terminal .selected-metrics span{
    font-size:9px!important;
  }
  .terminal .selected-metrics strong{
    font-size:10px!important;
  }
  .terminal .trade-log-details b{
    font-size:9px!important;
  }
  .terminal .trade-log-details strong{
    font-size:10px!important;
  }

  #settings .settings-group > summary b,
  #settings .settings-section > summary b,
  #settings .settings-accordion > details > summary b,
  #settings details > summary h2,
  #settings details > summary h3{
    font-size:14px!important;
    font-weight:760!important;
  }
}
/* ===== MEMEFLOW_TYPOGRAPHY_POLISH_V2_END ===== */
"""

brand.write_text(css + layer.strip() + "\n", encoding="utf-8")

# Only bust the canonical brand stylesheet cache.
# No CSS/HTML structure or nav references are otherwise modified.
for name in ("index.html", "system.html", "trading.html", "system-tokens.html"):
    p = app / name
    if not p.exists():
        continue
    text = p.read_text(encoding="utf-8")
    text = re.sub(
        r'(memeflow-brand\.css\?v=)[^"\'\s>]+',
        r'\1typography-polish-v2-20260830',
        text
    )
    p.write_text(text, encoding="utf-8")

print(f"Patched: {brand}")
PY

echo
echo "Verification:"
V2_COUNT="$(grep -c "MEMEFLOW_TYPOGRAPHY_POLISH_V2_START" "$BRAND" || true)"
echo "V2 layer count: $V2_COUNT"
if [ "$V2_COUNT" != "1" ]; then
  echo "ERROR: expected exactly one V2 typography layer."
  exit 1
fi

echo
echo "Confirmed V2 selectors:"
grep -n "chart-legend span" "$BRAND" | tail -1
grep -n "settings-group > summary b" "$BRAND" | tail -1

echo
echo "Cache-buster references:"
for f in index.html system.html trading.html system-tokens.html; do
  if [ -f "$APP_DIR/$f" ]; then
    grep -n "memeflow-brand.css?v=typography-polish-v2-20260830" "$APP_DIR/$f" || \
      echo "WARNING: $f has no matching brand stylesheet reference"
  fi
done

echo
echo "Safety check:"
echo "Token Flow selectors changed by V2: 0"
echo "memeflow-nav.css changed by V2: 0"
echo
echo "Backup created at: $BACKUP_DIR"
echo "DONE: typography polish V2 installed."
