from pathlib import Path
import re
import sys

css_path = Path(sys.argv[1])
html_path = Path(sys.argv[2])

css = css_path.read_text()
html = html_path.read_text()

marker_start = "/* MEMEFLOW_CHART_HEADER_COPY_TOUCH_V96 */"
marker_end = "/* MEMEFLOW_CHART_HEADER_COPY_TOUCH_V96_END */"

# If V96 was partially applied before, remove only its pseudo-element block.
css = re.sub(
    r'\n?/\* MEMEFLOW_CHART_HEADER_COPY_TOUCH_V96 \*/[\s\S]*?'
    r'/\* MEMEFLOW_CHART_HEADER_COPY_TOUCH_V96_END \*/\s*',
    '\n',
    css,
    count=1
)

old = "\n".join([
    "body.mf-page-trading.mf-trading-terminal",
    ".chart-panel > .chart-head",
    "#copyMintBtn {",
    "  flex: 0 0 auto !important;",
    "  margin: 0 !important;",
    "}",
])

new = "\n".join([
    "body.mf-page-trading.mf-trading-terminal",
    ".chart-panel > .chart-head",
    "#copyMintBtn {",
    "  flex: 0 0 auto !important;",
    "  margin: 0 !important;",
    "  min-block-size: 0 !important;",
    "  min-height: 0 !important;",
    "  height: auto !important;",
    "  min-inline-size: 0 !important;",
    "  padding: 0 !important;",
    "  border: 0 !important;",
    "  line-height: 1 !important;",
    "  position: relative !important;",
    "}",
    "",
    marker_start,
    "body.mf-page-trading.mf-trading-terminal",
    ".chart-panel > .chart-head",
    "#copyMintBtn::before {",
    '  content: "" !important;',
    "  position: absolute !important;",
    "  left: 50% !important;",
    "  top: 50% !important;",
    "  width: 44px !important;",
    "  height: 44px !important;",
    "  transform: translate(-50%, -50%) !important;",
    "  pointer-events: auto !important;",
    "}",
    marker_end,
])

if old in css:
    css = css.replace(old, new, 1)
elif "min-block-size: 0 !important;" not in css or "#copyMintBtn::before" not in css:
    raise SystemExit("ERROR: canonical #copyMintBtn block not found")

html, count = re.subn(
    r'/chart-header-geometry-v95-1\.css\?v=[^"\']+',
    '/chart-header-geometry-v95-1.css?v=chart-header-copy-touch-v96-20260909',
    html,
    count=1
)
if count != 1:
    raise SystemExit("ERROR: V95.1 stylesheet link not found in trading.html")

css_path.write_text(css.rstrip("\n") + "\n")
html_path.write_text(html)
