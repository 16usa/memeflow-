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

if grep -q 'data-mf-ai-module-v4="1"' "$INDEX"; then
  echo "AI ANALYSIS WORKSPACE V4 is already installed."
  exit 0
fi

if ! grep -q 'data-mf-ai-module-v3="1"' "$INDEX"; then
  echo "ERROR: installed V3 module marker not found."
  echo "Nothing changed. Send me the current Shell output before continuing."
  exit 1
fi

PATCH_DIR="$APP/.memeflow-patches/ai-analysis-workspace-v4"
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
trap 'echo "ERROR: AI Workspace V4 failed; restoring exact pre-install index.html."; rollback' ERR

python3 - "$WORK" <<'PY'
from pathlib import Path
import base64, re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")
canonical_css = base64.b64decode("LyogTUZfQUlfV09SS1NQQUNFX0NBTk9OSUNBTF9WNAogICBBSSBBbmFseXNpcyBpcyBub3cgYW4gYWx3YXlzLXZpc2libGUgbW9kdWxlLgogICBPbmx5IHRoZSBkZWVwIHdvcmtzcGFjZSBpcyBjb2xsYXBzaWJsZS4KKi8KLmFpLWFuYWx5c2lzLW1vZHVsZXsKICBncmlkLWNvbHVtbjoxLy0xIWltcG9ydGFudDsKICBwb3NpdGlvbjpyZWxhdGl2ZSFpbXBvcnRhbnQ7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIHdpZHRoOjEwMCUhaW1wb3J0YW50OwogIG1hcmdpbjowIWltcG9ydGFudDsKICBib3JkZXI6MXB4IHNvbGlkIHJnYmEoNDEsNTcsNzQsLjgwKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czoxOHB4IWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxODBkZWcscmdiYSgxNCwyMCwyOCwuOTcpLHJnYmEoOCwxMiwxNywuOTg1KSkhaW1wb3J0YW50OwogIGJveC1zaGFkb3c6MCAxOHB4IDQ4cHggcmdiYSgwLDAsMCwuMjIpIWltcG9ydGFudDsKICBvdmVyZmxvdzpoaWRkZW4haW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGU6OmJlZm9yZXsKICBjb250ZW50OiIiIWltcG9ydGFudDsKICBwb3NpdGlvbjphYnNvbHV0ZSFpbXBvcnRhbnQ7CiAgei1pbmRleDoyIWltcG9ydGFudDsKICBpbnNldDowIDAgYXV0byAwIWltcG9ydGFudDsKICBoZWlnaHQ6MnB4IWltcG9ydGFudDsKICBwb2ludGVyLWV2ZW50czpub25lIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCg5MGRlZyx2YXIoLS1jeWFuKSxyZ2JhKDg0LDIyMSwyNTUsLjE4KSA0OCUsdHJhbnNwYXJlbnQgNzglKSFpbXBvcnRhbnQ7Cn0KCi8qIFN0YXRpYyBtb2R1bGUgaGVhZGVyLiBJdCBpcyBubyBsb25nZXIgdGhlIGV4cGFuZC9jb2xsYXBzZSBjb250cm9sLiAqLwouYWktYW5hbHlzaXMtbW9kdWxlPnN1bW1hcnl7CiAgd2lkdGg6MTAwJSFpbXBvcnRhbnQ7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIG1pbi1oZWlnaHQ6NzZweCFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50OwogIHBhZGRpbmc6MTRweCAxNnB4IDEzcHghaW1wb3J0YW50OwogIGJvcmRlcjowIWltcG9ydGFudDsKICBib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1saW5lKSFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4wMDgpIWltcG9ydGFudDsKICBkaXNwbGF5OmdyaWQhaW1wb3J0YW50OwogIGdyaWQtdGVtcGxhdGUtY29sdW1uczptaW5tYXgoMCwxZnIpIGF1dG8haW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAgZ2FwOjEycHghaW1wb3J0YW50OwogIGxpc3Qtc3R5bGU6bm9uZSFpbXBvcnRhbnQ7CiAgY3Vyc29yOmRlZmF1bHQhaW1wb3J0YW50OwogIHBvaW50ZXItZXZlbnRzOm5vbmUhaW1wb3J0YW50OwogIGNvbG9yOnZhcigtLXRleHQpIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlPnN1bW1hcnk6Oi13ZWJraXQtZGV0YWlscy1tYXJrZXJ7ZGlzcGxheTpub25lIWltcG9ydGFudH0KLmFpLWFuYWx5c2lzLW1vZHVsZT5zdW1tYXJ5OjphZnRlcntkaXNwbGF5Om5vbmUhaW1wb3J0YW50O2NvbnRlbnQ6bm9uZSFpbXBvcnRhbnR9CgouYWktYW5hbHlzaXMtdGl0bGV7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIGRpc3BsYXk6YmxvY2shaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy10aXRsZSBzbWFsbHsKICBkaXNwbGF5OmJsb2NrIWltcG9ydGFudDsKICBtYXJnaW46MCAwIDZweCFpbXBvcnRhbnQ7CiAgY29sb3I6dmFyKC0tY3lhbikhaW1wb3J0YW50OwogIGZvbnQtc2l6ZTo4cHghaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OjEhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OjkwMCFpbXBvcnRhbnQ7CiAgbGV0dGVyLXNwYWNpbmc6LjE2ZW0haW1wb3J0YW50OwogIHRleHQtdHJhbnNmb3JtOnVwcGVyY2FzZSFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLXRpdGxlIGJ7CiAgZGlzcGxheTpibG9jayFpbXBvcnRhbnQ7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIG1hcmdpbjowIWltcG9ydGFudDsKICBjb2xvcjojZjJmNmY5IWltcG9ydGFudDsKICBmb250LXNpemU6MTdweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MS4xOCFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6ODUwIWltcG9ydGFudDsKICBsZXR0ZXItc3BhY2luZzotLjAyOGVtIWltcG9ydGFudDsKICB3aGl0ZS1zcGFjZTpub3dyYXAhaW1wb3J0YW50OwogIG92ZXJmbG93OmhpZGRlbiFpbXBvcnRhbnQ7CiAgdGV4dC1vdmVyZmxvdzplbGxpcHNpcyFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLXRpdGxlOjphZnRlcnsKICBjb250ZW50OiJEZWNpc2lvbiBpbnRlbGxpZ2VuY2UgwrcgTWFya2V0IGV2aWRlbmNlIMK3IEhvbGRlciBxdWFsaXR5IiFpbXBvcnRhbnQ7CiAgZGlzcGxheTpibG9jayFpbXBvcnRhbnQ7CiAgbWF4LXdpZHRoOjYwMHB4IWltcG9ydGFudDsKICBtYXJnaW4tdG9wOjVweCFpbXBvcnRhbnQ7CiAgY29sb3I6IzdmOGQ5ZSFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjguNXB4IWltcG9ydGFudDsKICBsaW5lLWhlaWdodDoxLjMhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OjYwMCFpbXBvcnRhbnQ7CiAgd2hpdGUtc3BhY2U6bm93cmFwIWltcG9ydGFudDsKICBvdmVyZmxvdzpoaWRkZW4haW1wb3J0YW50OwogIHRleHQtb3ZlcmZsb3c6ZWxsaXBzaXMhaW1wb3J0YW50Owp9CgouYWktYW5hbHlzaXMtY2hpcHN7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIGRpc3BsYXk6ZmxleCFpbXBvcnRhbnQ7CiAgYWxpZ24taXRlbXM6Y2VudGVyIWltcG9ydGFudDsKICBqdXN0aWZ5LWNvbnRlbnQ6ZmxleC1lbmQhaW1wb3J0YW50OwogIGdhcDo2cHghaW1wb3J0YW50OwogIG1hcmdpbjowIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtY2hpcHMgZW17CiAgbWluLWhlaWdodDozMHB4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzowIDEwcHghaW1wb3J0YW50OwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZTIpIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOjk5OXB4IWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjAxOCkhaW1wb3J0YW50OwogIGRpc3BsYXk6aW5saW5lLWZsZXghaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAganVzdGlmeS1jb250ZW50OmNlbnRlciFpbXBvcnRhbnQ7CiAgY29sb3I6IzhjOTlhOCFpbXBvcnRhbnQ7CiAgZm9udC1zdHlsZTpub3JtYWwhaW1wb3J0YW50OwogIGZvbnQtc2l6ZTo4cHghaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OjEhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0Ojg1MCFpbXBvcnRhbnQ7CiAgbGV0dGVyLXNwYWNpbmc6LjA3NWVtIWltcG9ydGFudDsKICB0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2UhaW1wb3J0YW50OwogIHdoaXRlLXNwYWNlOm5vd3JhcCFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLWNoaXBzPmVtOmZpcnN0LWNoaWxke2Rpc3BsYXk6bm9uZSFpbXBvcnRhbnR9Ci5haS1kYXRhLXZhbHtjb2xvcjp2YXIoLS1jeWFuKSFpbXBvcnRhbnQ7Zm9udC13ZWlnaHQ6OTUwIWltcG9ydGFudH0KI2RlY2lzaW9uTGFuZXsKICBtYXgtd2lkdGg6bm9uZSFpbXBvcnRhbnQ7CiAgb3ZlcmZsb3c6dmlzaWJsZSFpbXBvcnRhbnQ7CiAgdGV4dC1vdmVyZmxvdzpjbGlwIWltcG9ydGFudDsKfQojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0id2FpdGluZyJdICNkZWNpc2lvbkxhbmV7CiAgY29sb3I6dmFyKC0teWVsbG93KSFpbXBvcnRhbnQ7CiAgYm9yZGVyLWNvbG9yOnJnYmEoMjQ2LDE5OSw5NSwuMzApIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoMjQ2LDE5OSw5NSwuMDYpIWltcG9ydGFudDsKfQojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0iY29sbGVjdGluZyJdICNkZWNpc2lvbkxhbmV7CiAgY29sb3I6dmFyKC0tY3lhbikhaW1wb3J0YW50OwogIGJvcmRlci1jb2xvcjpyZ2JhKDg0LDIyMSwyNTUsLjMwKSFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDg0LDIyMSwyNTUsLjA2KSFpbXBvcnRhbnQ7Cn0KI2FpLWFuYWx5c2lzW2RhdGEtYWktdWktc3RhdGU9InJlYWR5Il0gI2RlY2lzaW9uTGFuZXsKICBjb2xvcjp2YXIoLS1ncmVlbikhaW1wb3J0YW50OwogIGJvcmRlci1jb2xvcjpyZ2JhKDgxLDIzMSwxNjgsLjM0KSFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDgxLDIzMSwxNjgsLjA3KSFpbXBvcnRhbnQ7Cn0KI2FpLWFuYWx5c2lzW2RhdGEtYWktdWktc3RhdGU9ImJsb2NrZWQiXSAjZGVjaXNpb25MYW5lewogIGNvbG9yOnZhcigtLXJlZCkhaW1wb3J0YW50OwogIGJvcmRlci1jb2xvcjpyZ2JhKDI1NSwxMDEsMTE4LC4zNCkhaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgyNTUsMTAxLDExOCwuMDcpIWltcG9ydGFudDsKfQoKLyogQWx3YXlzLXZpc2libGUgbW9kdWxlIGJvZHkuICovCi5haS1hbmFseXNpcy1ib2R5ewogIG1pbi13aWR0aDowIWltcG9ydGFudDsKICBwYWRkaW5nOjEzcHggMTRweCAxNHB4IWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbWV0YXsKICBtaW4taGVpZ2h0OjM0cHghaW1wb3J0YW50OwogIG1hcmdpbjowIDAgOXB4IWltcG9ydGFudDsKICBwYWRkaW5nOjAgMTFweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czo5cHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSg3LDExLDE2LC40MikhaW1wb3J0YW50OwogIGRpc3BsYXk6ZmxleCFpbXBvcnRhbnQ7CiAgYWxpZ24taXRlbXM6Y2VudGVyIWltcG9ydGFudDsKICBqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbiFpbXBvcnRhbnQ7CiAgZ2FwOjEycHghaW1wb3J0YW50OwogIGNvbG9yOiNhYWI1YzEhaW1wb3J0YW50OwogIGZvbnQtc2l6ZTo5cHghaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OjEuMiFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLW1ldGE6OmJlZm9yZXsKICBjb250ZW50OiJEQVRBIFNPVVJDRSIhaW1wb3J0YW50OwogIGZsZXg6MCAwIGF1dG8haW1wb3J0YW50OwogIGNvbG9yOiM3MTgwOTIhaW1wb3J0YW50OwogIGZvbnQtc2l6ZTo3LjVweCFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6ODUwIWltcG9ydGFudDsKICBsZXR0ZXItc3BhY2luZzouMTNlbSFpbXBvcnRhbnQ7Cn0KCi5haS1hbmFseXNpcy1tb2R1bGUgLnJlYXNvbnsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzoxM3B4IDE0cHghaW1wb3J0YW50OwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSkhaW1wb3J0YW50OwogIGJvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS15ZWxsb3cpIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOjEycHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgyNDYsMTk5LDk1LC4wNCkhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLnJlYXNvbi5ncmVlbnsKICBib3JkZXItbGVmdC1jb2xvcjp2YXIoLS1ncmVlbikhaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSg4MSwyMzEsMTY4LC4wNDUpIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlIC5yZWFzb24uY3lhbnsKICBib3JkZXItbGVmdC1jb2xvcjp2YXIoLS1jeWFuKSFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDg0LDIyMSwyNTUsLjA0NSkhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLnJlYXNvbi5yZWR7CiAgYm9yZGVyLWxlZnQtY29sb3I6dmFyKC0tcmVkKSFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDI1NSwxMDEsMTE4LC4wNDUpIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlIC5yZWFzb24gYnsKICBjb2xvcjojZWVmNGY4IWltcG9ydGFudDsKICBmb250LXNpemU6MTFweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MS4zIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlIC5yZWFzb24gc3BhbnsKICBkaXNwbGF5OmJsb2NrIWltcG9ydGFudDsKICBtYXJnaW4tdG9wOjVweCFpbXBvcnRhbnQ7CiAgY29sb3I6IzhlOWJhYSFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjEwcHghaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OjEuNDghaW1wb3J0YW50Owp9CgovKiBXQUlUSU5HL0NPTExFQ1RJTkcgb3ZlcnZpZXcuICovCi5tZi1haS1jb21wYWN0LXdhaXRpbmd7CiAgZGlzcGxheTpub25lOwogIGdyaWQtdGVtcGxhdGUtY29sdW1uczptaW5tYXgoMCwxZnIpOwogIGdhcDo4cHg7Cn0KLm1mLWFpLWNvbXBhY3QtY29weXsKICBtaW4td2lkdGg6MDsKICBwYWRkaW5nOjEzcHggMTRweDsKICBib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpOwogIGJvcmRlci1yYWRpdXM6MTJweDsKICBiYWNrZ3JvdW5kOgogICAgcmFkaWFsLWdyYWRpZW50KGNpcmNsZSBhdCAwIDAscmdiYSg4NCwyMjEsMjU1LC4wNSksdHJhbnNwYXJlbnQgNDIlKSwKICAgIHJnYmEoNywxMSwxNiwuNTYpOwp9Ci5tZi1haS1jb21wYWN0LWNvcHkgc21hbGx7CiAgZGlzcGxheTpibG9jazsKICBtYXJnaW46MCAwIDZweDsKICBjb2xvcjp2YXIoLS1jeWFuKTsKICBmb250LXNpemU6Ny41cHg7CiAgbGluZS1oZWlnaHQ6MTsKICBmb250LXdlaWdodDo5MDA7CiAgbGV0dGVyLXNwYWNpbmc6LjE1ZW07CiAgdGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlOwp9Ci5tZi1haS1jb21wYWN0LWNvcHkgc3Ryb25newogIGRpc3BsYXk6YmxvY2s7CiAgY29sb3I6I2VkZjNmNzsKICBmb250LXNpemU6MTVweDsKICBsaW5lLWhlaWdodDoxLjI1OwogIGZvbnQtd2VpZ2h0Ojg0MDsKICBsZXR0ZXItc3BhY2luZzotLjAyZW07Cn0KLm1mLWFpLWNvbXBhY3QtY29weSBwewogIG1hcmdpbjo2cHggMCAwOwogIGNvbG9yOiM4OTk3YTc7CiAgZm9udC1zaXplOjkuNXB4OwogIGxpbmUtaGVpZ2h0OjEuNDg7Cn0KLm1mLWFpLWNvbXBhY3Qtc3RhdHVzewogIGRpc3BsYXk6Z3JpZDsKICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDMsbWlubWF4KDAsMWZyKSk7CiAgZ2FwOjZweDsKfQoubWYtYWktY29tcGFjdC1zdGF0dXM+ZGl2ewogIG1pbi13aWR0aDowOwogIG1pbi1oZWlnaHQ6NTJweDsKICBwYWRkaW5nOjlweCAxMHB4OwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7CiAgYm9yZGVyLXJhZGl1czoxMHB4OwogIGJhY2tncm91bmQ6cmdiYSg3LDExLDE2LC41OCk7CiAgZGlzcGxheTpncmlkOwogIGFsaWduLWNvbnRlbnQ6Y2VudGVyOwogIGdhcDo2cHg7Cn0KLm1mLWFpLWNvbXBhY3Qtc3RhdHVzIHNwYW57CiAgbWluLXdpZHRoOjA7CiAgY29sb3I6IzdlOGM5ZDsKICBmb250LXNpemU6Ny41cHg7CiAgbGluZS1oZWlnaHQ6MS4yOwogIHdoaXRlLXNwYWNlOm5vd3JhcDsKICBvdmVyZmxvdzpoaWRkZW47CiAgdGV4dC1vdmVyZmxvdzplbGxpcHNpczsKfQoubWYtYWktY29tcGFjdC1zdGF0dXMgYnsKICBjb2xvcjp2YXIoLS15ZWxsb3cpOwogIGZvbnQtc2l6ZToxMHB4OwogIGxpbmUtaGVpZ2h0OjE7CiAgZm9udC13ZWlnaHQ6ODgwOwogIGxldHRlci1zcGFjaW5nOi4wM2VtOwp9CgovKiBVSSBzdGF0ZSBjb250cm9scyB3aGF0IGlzIHZpc2libGUgaW4gdGhlIGFsd2F5cy1vcGVuIG92ZXJ2aWV3LiAqLwojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0id2FpdGluZyJdIC5tZi1haS1jb21wYWN0LXdhaXRpbmcsCiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJjb2xsZWN0aW5nIl0gLm1mLWFpLWNvbXBhY3Qtd2FpdGluZ3sKICBkaXNwbGF5OmdyaWQhaW1wb3J0YW50Owp9CiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJ3YWl0aW5nIl0gI2RlY2lzaW9uTWV0YSwKI2FpLWFuYWx5c2lzW2RhdGEtYWktdWktc3RhdGU9IndhaXRpbmciXSAjZGVjaXNpb25SZWFzb24sCiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJ3YWl0aW5nIl0gI2FpQW5hbHlzaXNEZWVwLAojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0iY29sbGVjdGluZyJdICNkZWNpc2lvbk1ldGEsCiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJjb2xsZWN0aW5nIl0gI2RlY2lzaW9uUmVhc29uLAojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0iY29sbGVjdGluZyJdICNhaUFuYWx5c2lzRGVlcHsKICBkaXNwbGF5Om5vbmUhaW1wb3J0YW50Owp9CiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJyZWFkeSJdIC5tZi1haS1jb21wYWN0LXdhaXRpbmcsCiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJibG9ja2VkIl0gLm1mLWFpLWNvbXBhY3Qtd2FpdGluZ3sKICBkaXNwbGF5Om5vbmUhaW1wb3J0YW50Owp9CiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJyZWFkeSJdICNkZWNpc2lvbk1ldGEsCiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJyZWFkeSJdICNkZWNpc2lvblJlYXNvbiwKI2FpLWFuYWx5c2lzW2RhdGEtYWktdWktc3RhdGU9InJlYWR5Il0gI2FpQW5hbHlzaXNEZWVwLAojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0iYmxvY2tlZCJdICNkZWNpc2lvbk1ldGEsCiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJibG9ja2VkIl0gI2RlY2lzaW9uUmVhc29uLAojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0iYmxvY2tlZCJdICNhaUFuYWx5c2lzRGVlcHsKICBkaXNwbGF5OmJsb2NrIWltcG9ydGFudDsKfQoKLyogSW5uZXIgZGVlcCBhbmFseXNpcyBjb250cm9sIOKAlCB0aGUgb25seSBjb2xsYXBzaWJsZSBzdXJmYWNlIGluIHRoZSBtb2R1bGUuICovCi5haS1hbmFseXNpcy1kZWVwewogIG1hcmdpbjo5cHggMCAwIWltcG9ydGFudDsKICBib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUyKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czoxMXB4IWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoNywxMSwxNiwuNDIpIWltcG9ydGFudDsKICBvdmVyZmxvdzpoaWRkZW4haW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1kZWVwPnN1bW1hcnl7CiAgd2lkdGg6MTAwJSFpbXBvcnRhbnQ7CiAgbWluLWhlaWdodDo0OHB4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzowIDExcHghaW1wb3J0YW50OwogIGRpc3BsYXk6Z3JpZCFpbXBvcnRhbnQ7CiAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOm1pbm1heCgwLDFmcikgYXV0byBhdXRvIWltcG9ydGFudDsKICBhbGlnbi1pdGVtczpjZW50ZXIhaW1wb3J0YW50OwogIGdhcDo5cHghaW1wb3J0YW50OwogIGxpc3Qtc3R5bGU6bm9uZSFpbXBvcnRhbnQ7CiAgY3Vyc29yOnBvaW50ZXIhaW1wb3J0YW50OwogIGNvbG9yOiNkZmU3ZWQhaW1wb3J0YW50OwogIC13ZWJraXQtdGFwLWhpZ2hsaWdodC1jb2xvcjp0cmFuc3BhcmVudCFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLWRlZXA+c3VtbWFyeTo6LXdlYmtpdC1kZXRhaWxzLW1hcmtlcntkaXNwbGF5Om5vbmUhaW1wb3J0YW50fQouYWktYW5hbHlzaXMtZGVlcD5zdW1tYXJ5IC5haS1kZWVwLXRpdGxlewogIG1pbi13aWR0aDowIWltcG9ydGFudDsKICBmb250LXNpemU6MTBweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MS4yIWltcG9ydGFudDsKICBmb250LXdlaWdodDo4MjAhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1kZWVwPnN1bW1hcnkgLmFpLWRlZXAtbWV0YXsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgY29sb3I6IzdmOGQ5ZCFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjhweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MS4yIWltcG9ydGFudDsKICBmb250LXdlaWdodDo2NTAhaW1wb3J0YW50OwogIHdoaXRlLXNwYWNlOm5vd3JhcCFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLWRlZXA+c3VtbWFyeTo6YWZ0ZXJ7CiAgY29udGVudDoi4oC6IiFpbXBvcnRhbnQ7CiAgd2lkdGg6MTZweCFpbXBvcnRhbnQ7CiAgaGVpZ2h0OjIwcHghaW1wb3J0YW50OwogIGRpc3BsYXk6aW5saW5lLWZsZXghaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAganVzdGlmeS1jb250ZW50OmNlbnRlciFpbXBvcnRhbnQ7CiAgY29sb3I6IzhmOWRhZCFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjIwcHghaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OjEhaW1wb3J0YW50OwogIHRyYW5zZm9ybTpyb3RhdGUoMGRlZykhaW1wb3J0YW50OwogIHRyYW5zaXRpb246dHJhbnNmb3JtIC4xNnMgZWFzZSFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLWRlZXBbb3Blbl0+c3VtbWFyeXsKICBib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1saW5lKSFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4wMTIpIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtZGVlcFtvcGVuXT5zdW1tYXJ5OjphZnRlcnt0cmFuc2Zvcm06cm90YXRlKDkwZGVnKSFpbXBvcnRhbnR9Ci5haS1hbmFseXNpcy1kZWVwLWJvZHl7CiAgcGFkZGluZzoxMHB4IWltcG9ydGFudDsKfQoKLmFpLWFuYWx5c2lzLW1vZHVsZSAjZGVjaXNpb25UcmVlewogIG1pbi1oZWlnaHQ6MCFpbXBvcnRhbnQ7CiAgaGVpZ2h0OmF1dG8haW1wb3J0YW50OwogIG1hcmdpbjowIDAgOXB4IWltcG9ydGFudDsKICBwYWRkaW5nOjlweCFpbXBvcnRhbnQ7CiAgZGlzcGxheTpncmlkIWltcG9ydGFudDsKICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDYsbWlubWF4KDAsMWZyKSkhaW1wb3J0YW50OwogIGdhcDo2cHghaW1wb3J0YW50OwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSkhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6MTFweCFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDQsOCwxMiwuNTIpIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlICNkZWNpc2lvblRyZWU6ZW1wdHl7ZGlzcGxheTpub25lIWltcG9ydGFudH0KLmFpLWFuYWx5c2lzLW1vZHVsZSAjZGVjaXNpb25UcmVlIC50cmVlLW5vZGV7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIG1pbi1oZWlnaHQ6NDZweCFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50OwogIHBhZGRpbmc6N3B4IDVweCFpbXBvcnRhbnQ7CiAgZGlzcGxheTpmbGV4IWltcG9ydGFudDsKICBhbGlnbi1pdGVtczpjZW50ZXIhaW1wb3J0YW50OwogIGp1c3RpZnktY29udGVudDpjZW50ZXIhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6OHB4IWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjAxNCkhaW1wb3J0YW50Owp9CgouYWktYW5hbHlzaXMtbW9kdWxlIC5haS1hbmFseXNpcy10YWJzewogIGRpc3BsYXk6Z3JpZCFpbXBvcnRhbnQ7CiAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCgzLDFmcikhaW1wb3J0YW50OwogIGdhcDo0cHghaW1wb3J0YW50OwogIG1hcmdpbjowIWltcG9ydGFudDsKICBwYWRkaW5nOjRweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czoxMHB4IWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoNCw4LDEyLC41NikhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLmFpLWFuYWx5c2lzLXRhYnMgLml0YWJ7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIG1pbi1oZWlnaHQ6MzZweCFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50OwogIHBhZGRpbmc6MCA3cHghaW1wb3J0YW50OwogIGJvcmRlcjowIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOjdweCFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDp0cmFuc3BhcmVudCFpbXBvcnRhbnQ7CiAgY29sb3I6IzdlOGI5YyFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjguNXB4IWltcG9ydGFudDsKICBsaW5lLWhlaWdodDoxIWltcG9ydGFudDsKICBmb250LXdlaWdodDo3NjAhaW1wb3J0YW50OwogIHRyYW5zZm9ybTpub25lIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlIC5haS1hbmFseXNpcy10YWJzIC5pdGFiLmFjdGl2ZXsKICBiYWNrZ3JvdW5kOnJnYmEoODQsMjIxLDI1NSwuMDc1KSFpbXBvcnRhbnQ7CiAgY29sb3I6I2VkZjVmOCFpbXBvcnRhbnQ7CiAgYm94LXNoYWRvdzppbnNldCAwIDAgMCAxcHggcmdiYSg4NCwyMjEsMjU1LC4xNCkhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLnRhYi1wYW5le21hcmdpbi10b3A6OXB4IWltcG9ydGFudH0KLmFpLWFuYWx5c2lzLW1vZHVsZSAudGFiLXBhbmUuYWN0aXZlewogIHBhZGRpbmc6MTFweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czoxMHB4IWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoNCw4LDEyLC40NikhaW1wb3J0YW50Owp9CgouYWktYW5hbHlzaXMtbW9kdWxlIC5taXNzaW9uLWFjdGlvbnN7CiAgZGlzcGxheTpncmlkIWltcG9ydGFudDsKICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDMsbWlubWF4KDAsMWZyKSkhaW1wb3J0YW50OwogIGdhcDo3cHghaW1wb3J0YW50OwogIG1hcmdpbjo5cHggMCAwIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlIC5taXNzaW9uLWFjdGlvbnMgLmJ0bnsKICB3aWR0aDoxMDAlIWltcG9ydGFudDsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgbWluLWhlaWdodDo0MHB4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7Cn0KCi8qIE1vYmlsZTogY29tcGFjdCBidXQgdmlzaWJseSBhIGZ1bGwgbW9kdWxlLiAqLwpAbWVkaWEobWF4LXdpZHRoOjgyMHB4KXsKICAuYWktYW5hbHlzaXMtbW9kdWxlewogICAgYm9yZGVyLXJhZGl1czoxOHB4IWltcG9ydGFudDsKICAgIGJveC1zaGFkb3c6bm9uZSFpbXBvcnRhbnQ7CiAgfQogIC5haS1hbmFseXNpcy1tb2R1bGU+c3VtbWFyeXsKICAgIG1pbi1oZWlnaHQ6NzJweCFpbXBvcnRhbnQ7CiAgICBwYWRkaW5nOjEycHggMTNweCFpbXBvcnRhbnQ7CiAgICBnYXA6OXB4IWltcG9ydGFudDsKICB9CiAgLmFpLWFuYWx5c2lzLXRpdGxlIHNtYWxsewogICAgbWFyZ2luLWJvdHRvbTo1cHghaW1wb3J0YW50OwogICAgZm9udC1zaXplOjcuNXB4IWltcG9ydGFudDsKICB9CiAgLmFpLWFuYWx5c2lzLXRpdGxlIGJ7Zm9udC1zaXplOjE0cHghaW1wb3J0YW50fQogIC5haS1hbmFseXNpcy10aXRsZTo6YWZ0ZXJ7CiAgICBtYXgtd2lkdGg6MzMwcHghaW1wb3J0YW50OwogICAgbWFyZ2luLXRvcDo0cHghaW1wb3J0YW50OwogICAgZm9udC1zaXplOjhweCFpbXBvcnRhbnQ7CiAgfQogIC5haS1hbmFseXNpcy1jaGlwcyBlbXsKICAgIG1pbi1oZWlnaHQ6MjhweCFpbXBvcnRhbnQ7CiAgICBwYWRkaW5nOjAgOHB4IWltcG9ydGFudDsKICAgIGZvbnQtc2l6ZTo3LjVweCFpbXBvcnRhbnQ7CiAgfQogIC5haS1hbmFseXNpcy1ib2R5e3BhZGRpbmc6MTFweCAxMnB4IDEycHghaW1wb3J0YW50fQogIC5haS1hbmFseXNpcy1tZXRhewogICAgbWluLWhlaWdodDozMnB4IWltcG9ydGFudDsKICAgIG1hcmdpbi1ib3R0b206OHB4IWltcG9ydGFudDsKICB9CiAgLmFpLWFuYWx5c2lzLW1vZHVsZSAucmVhc29uewogICAgcGFkZGluZzoxMnB4IWltcG9ydGFudDsKICB9CiAgLm1mLWFpLWNvbXBhY3Qtc3RhdHVzewogICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCgzLG1pbm1heCgwLDFmcikpIWltcG9ydGFudDsKICB9CiAgLmFpLWFuYWx5c2lzLWRlZXA+c3VtbWFyeXsKICAgIG1pbi1oZWlnaHQ6NDZweCFpbXBvcnRhbnQ7CiAgICBwYWRkaW5nOjAgMTBweCFpbXBvcnRhbnQ7CiAgfQogIC5haS1hbmFseXNpcy1kZWVwPnN1bW1hcnkgLmFpLWRlZXAtbWV0YXsKICAgIGRpc3BsYXk6bm9uZSFpbXBvcnRhbnQ7CiAgfQogIC5haS1hbmFseXNpcy1kZWVwLWJvZHl7cGFkZGluZzo5cHghaW1wb3J0YW50fQogIC5haS1hbmFseXNpcy1tb2R1bGUgI2RlY2lzaW9uVHJlZXsKICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMixtaW5tYXgoMCwxZnIpKSFpbXBvcnRhbnQ7CiAgfQogIC5haS1hbmFseXNpcy1tb2R1bGUgLm1pc3Npb24tYWN0aW9uc3sKICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIhaW1wb3J0YW50OwogIH0KfQpAbWVkaWEobWF4LXdpZHRoOjQzMHB4KXsKICAuYWktYW5hbHlzaXMtbW9kdWxlPnN1bW1hcnl7CiAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6bWlubWF4KDAsMWZyKSBhdXRvIWltcG9ydGFudDsKICB9CiAgLmFpLWFuYWx5c2lzLXRpdGxlIGJ7Zm9udC1zaXplOjEzLjVweCFpbXBvcnRhbnR9CiAgLmFpLWFuYWx5c2lzLXRpdGxlOjphZnRlcnsKICAgIG1heC13aWR0aDoyNDBweCFpbXBvcnRhbnQ7CiAgfQogIC5tZi1haS1jb21wYWN0LXN0YXR1c3sKICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMyxtaW5tYXgoMCwxZnIpKSFpbXBvcnRhbnQ7CiAgfQogIC5tZi1haS1jb21wYWN0LXN0YXR1cz5kaXZ7CiAgICBtaW4taGVpZ2h0OjUwcHghaW1wb3J0YW50OwogICAgcGFkZGluZzo4cHghaW1wb3J0YW50OwogIH0KICAubWYtYWktY29tcGFjdC1zdGF0dXMgc3Bhbntmb250LXNpemU6N3B4IWltcG9ydGFudH0KICAubWYtYWktY29tcGFjdC1zdGF0dXMgYntmb250LXNpemU6OXB4IWltcG9ydGFudH0KfQ==").decode("utf-8")

style_before = len(re.findall(r"<style\b", src, flags=re.I))
script_before = len(re.findall(r"<script\b", src, flags=re.I))

# ---- contract / ownership checks ----
if len(re.findall(r'<details\b[^>]*\bid=["\']ai-analysis["\']', src, flags=re.I)) != 1:
    raise SystemExit("Expected exactly one details#ai-analysis.")

for ident in (
    "decisionData","decisionLane","decisionTree","decisionMeta","decisionReason",
    "pane-evidence","pane-timeline","pane-memory","validateBtn",
    "mfAiCompactKicker","mfAiCompactTitle","mfAiCompactText",
    "mfAiCompactCompleteness","mfAiCompactMarket","mfAiCompactHolders"
):
    if src.count(f'id="{ident}"') != 1:
        raise SystemExit(f"Expected exactly one #{ident}.")

if src.count('data-mf-ai-module-v3="1"') != 1:
    raise SystemExit("Expected exactly one installed V3 marker.")

# ---- turn the outer details into an always-open module ----
open_tag_re = re.compile(
    r'<details\b(?=[^>]*\bid=["\']ai-analysis["\'])[^>]*>',
    flags=re.I
)
m = open_tag_re.search(src)
if not m:
    raise SystemExit("AI opening tag not found.")

opening = m.group(0)
opening = opening.replace('data-mf-ai-module-v3="1"', 'data-mf-ai-module-v4="1"')
if not re.search(r'\sopen(?:\s|>)', opening, flags=re.I):
    opening = opening[:-1] + ' open>'
src = src[:m.start()] + opening + src[m.end():]

# Make the outer header static / non-focusable.
summary_re = re.compile(
    r'(<details\b(?=[^>]*\bid=["\']ai-analysis["\'])[^>]*>\s*<summary\b)([^>]*)(>)',
    flags=re.I | re.S
)
sm = summary_re.search(src)
if not sm:
    raise SystemExit("AI outer summary not found.")

attrs = sm.group(2)
if 'tabindex=' not in attrs:
    attrs += ' tabindex="-1"'
if 'aria-disabled=' not in attrs:
    attrs += ' aria-disabled="true"'
src = src[:sm.start()] + sm.group(1) + attrs + sm.group(3) + src[sm.end():]

# ---- wrap deep content only ----
# Start immediately before decisionTree; source/meta/reason remain always visible.
tree_start = re.search(
    r'<div\b[^>]*\bid=["\']decisionTree["\'][^>]*>',
    src, flags=re.I
)
if not tree_start:
    raise SystemExit("decisionTree start not found.")

# mission-actions is the last deep-analysis block.
actions_re = re.compile(
    r'<div\b[^>]*\bclass=["\'][^"\']*\bmission-actions\b[^"\']*["\'][^>]*>.*?</div>',
    flags=re.I | re.S
)
actions = list(actions_re.finditer(src))
if len(actions) != 1:
    raise SystemExit(f"Expected one mission-actions block; found {len(actions)}.")

deep_open = (
    '<details class="ai-analysis-deep" id="aiAnalysisDeep">'
    '<summary>'
    '<span class="ai-deep-title">Detailed analysis</span>'
    '<span class="ai-deep-meta">Decision checks · Evidence · Timeline · Memory</span>'
    '</summary>'
    '<div class="ai-analysis-deep-body">'
)
deep_close = '</div></details>'

# Insert close first so offsets remain valid.
src = src[:actions[0].end()] + deep_close + src[actions[0].end():]
src = src[:tree_start.start()] + deep_open + src[tree_start.start():]

# ---- if Active Context evidence opener exists, open inner details too ----
evidence_fn = re.compile(
    r'(function\s+openContextEvidence\s*\(\)\s*\{\s*'
    r'const\s+details\s*=\s*\$\([\'"]#ai-analysis[\'"]\);\s*'
    r'if\(!details\)return\s+false;\s*'
    r'details\.open\s*=\s*true;)',
    flags=re.I | re.S
)
ef = evidence_fn.search(src)
if ef:
    replacement = ef.group(1) + "\n const deep=$('#aiAnalysisDeep');if(deep)deep.open=true;"
    src = src[:ef.start()] + replacement + src[ef.end():]

# ---- clean all old AI presentation rules by actual selector ----
AI_TOKENS = (
    "#ai-analysis",
    ".ai-analysis-section",
    ".ai-analysis-module",
    ".ai-analysis-title",
    ".ai-analysis-chips",
    ".ai-data-val",
    ".ai-analysis-body",
    ".ai-analysis-meta",
    ".ai-analysis-tabs",
    ".ai-analysis-chevron",
    ".ai-analysis-deep",
    ".mf-ai-compact-waiting",
    ".mf-ai-compact-copy",
    ".mf-ai-compact-status",
    "#decisionTree",
    "#decisionLane",
)

def find_open(text, start):
    quote=None; esc=False; comment=False; i=start
    while i < len(text):
        if comment:
            if text.startswith("*/", i): comment=False; i+=2; continue
            i+=1; continue
        if not quote and text.startswith("/*", i):
            comment=True; i+=2; continue
        ch=text[i]
        if quote:
            if esc: esc=False
            elif ch=="\\": esc=True
            elif ch==quote: quote=None
            i+=1; continue
        if ch in ("'", '"'): quote=ch; i+=1; continue
        if ch=="{": return i
        i+=1
    return -1

def find_close(text, op):
    depth=1; quote=None; esc=False; comment=False; i=op+1
    while i < len(text):
        if comment:
            if text.startswith("*/", i): comment=False; i+=2; continue
            i+=1; continue
        if not quote and text.startswith("/*", i):
            comment=True; i+=2; continue
        ch=text[i]
        if quote:
            if esc: esc=False
            elif ch=="\\": esc=True
            elif ch==quote: quote=None
            i+=1; continue
        if ch in ("'", '"'): quote=ch
        elif ch=="{": depth+=1
        elif ch=="}":
            depth-=1
            if depth==0: return i
        i+=1
    raise SystemExit("Unbalanced CSS while consolidating V4.")

def clean_css(text):
    out=[]; pos=0
    while pos < len(text):
        op=find_open(text,pos)
        if op < 0:
            out.append(text[pos:]); break
        prelude=text[pos:op]
        close=find_close(text,op)
        body=text[op+1:close]
        selector=re.sub(r"/\*.*?\*/","",prelude,flags=re.S).strip()

        if selector.startswith("@"):
            cleaned=clean_css(body)
            meaningful=re.sub(r"/\*.*?\*/","",cleaned,flags=re.S).strip()
            if meaningful:
                out += [prelude,"{",cleaned,"}"]
        elif any(token in selector for token in AI_TOKENS):
            pass
        else:
            out += [prelude,"{",body,"}"]
        pos=close+1
    return "".join(out)

style_re=re.compile(
    r'(<style\b(?P<attrs>[^>]*)>)(?P<body>.*?)(</style>)',
    flags=re.I|re.S
)
matches=list(style_re.finditer(src))
if not matches:
    raise SystemExit("No style blocks found.")

parts=[]; last=0; consolidated=0
for st in matches:
    parts.append(src[last:st.start()])
    opening_style=st.group(1)
    attrs=st.group("attrs")
    body=clean_css(st.group("body"))

    body=re.sub(
        r'/\*.*?(?:MF_AI_FULL_MODULE_CANONICAL_V3|MF_AI_STANDALONE_CANONICAL_V2|'
        r'MF_AI_STANDALONE_MODULE_V1|MF_AI_BUTTON_ALL_CHECKS_V1|'
        r'MF_AI_ANALYSIS_COMPACT_BODY_V1).*?\*/',
        '',
        body,
        flags=re.I|re.S
    )

    is_consolidated=bool(re.search(
        r'\bid=["\']memeflow-consolidated-css["\']',attrs,flags=re.I
    ))
    if is_consolidated:
        consolidated+=1
        body=body.rstrip()+"\n\n"+canonical_css+"\n"

    meaningful=re.sub(r'/\*.*?\*/','',body,flags=re.S).strip()
    if meaningful or is_consolidated:
        parts.append(opening_style+body+"</style>")
    last=st.end()

parts.append(src[last:])
src="".join(parts)

if consolidated != 1:
    raise SystemExit(f"Expected one consolidated style; found {consolidated}.")

# ---- final verification ----
style_after=len(re.findall(r"<style\b",src,flags=re.I))
script_after=len(re.findall(r"<script\b",src,flags=re.I))

checks={
    "style count did not increase": style_after <= style_before,
    "script count unchanged": script_after == script_before,
    "one AI host": src.count('id="ai-analysis"') == 1,
    "one V4 marker": src.count('data-mf-ai-module-v4="1"') == 1,
    "V3 marker removed": 'data-mf-ai-module-v3="1"' not in src,
    "outer module open": bool(re.search(r'<details\b[^>]*\bid=["\']ai-analysis["\'][^>]*\bopen\b',src,flags=re.I)),
    "one inner deep details": src.count('id="aiAnalysisDeep"') == 1,
    "one canonical V4 CSS": src.count("MF_AI_WORKSPACE_CANONICAL_V4") == 1,
    "old V3 CSS removed": "MF_AI_FULL_MODULE_CANONICAL_V3" not in src,
    "decision tree preserved": src.count('id="decisionTree"') == 1,
    "decision reason preserved": src.count('id="decisionReason"') == 1,
    "Evidence preserved": src.count('id="pane-evidence"') == 1,
    "Timeline preserved": src.count('id="pane-timeline"') == 1,
    "Memory preserved": src.count('id="pane-memory"') == 1,
    "Validate preserved": src.count('id="validateBtn"') == 1,
    "waiting UI preserved": src.count('id="mfAiCompactTitle"') == 1,
}
failed=[k for k,v in checks.items() if not v]
if failed:
    raise SystemExit("Verification failed: "+", ".join(failed))

path.write_text(src,encoding="utf-8")

print("AI Workspace V4 source consolidation prepared.")
print(f"<style> count: {style_before} -> {style_after}")
print(f"<script> count: {script_before} -> {script_after}")
print("AI host count: 1")
print("Deep workspace count: 1")
print("Logic IDs preserved: PASS")
PY

grep -q 'data-mf-ai-module-v4="1"' "$WORK"
grep -q 'id="aiAnalysisDeep"' "$WORK"
grep -q 'MF_AI_WORKSPACE_CANONICAL_V4' "$WORK"
grep -q 'id="pane-evidence"' "$WORK"
grep -q 'id="validateBtn"' "$WORK"
! grep -q 'data-mf-ai-module-v3="1"' "$WORK"
! grep -q 'MF_AI_FULL_MODULE_CANONICAL_V3' "$WORK"

cp "$WORK" "$INDEX"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
BACKUP=$BACKUP
EOF

rm -f "$WORK"
trap - ERR

echo
echo "OK: AI ANALYSIS WORKSPACE V4 installed cleanly."
echo
echo "AI module: ALWAYS-OPEN OVERVIEW"
echo "Deep analysis: INNER COLLAPSIBLE WORKSPACE"
echo "AI host node count: ONE"
echo "Old V3 AI CSS: REMOVED"
echo "Canonical V4 AI CSS owner: ONE"
echo "New <style> layers: NONE"
echo "New <script> layers: NONE"
echo "Evaluator/state controller: UNCHANGED"
echo "Evidence / Timeline / Memory IDs: PRESERVED"
echo "Validate execution: PRESERVED"
echo "Pre-trade / trading logic: UNCHANGED"
echo
echo "Now Stop -> Run and hard-refresh."
