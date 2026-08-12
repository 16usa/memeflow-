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

if grep -q 'data-mf-ai-module-v5="1"' "$INDEX"; then
  echo "AI ANALYSIS FINAL V5 is already installed."
  exit 0
fi

if ! grep -q 'data-mf-ai-module-v4="1"' "$INDEX"; then
  echo "ERROR: installed V4/V4.1 AI marker not found."
  echo "Nothing changed."
  exit 1
fi

PATCH_DIR="$APP/.memeflow-patches/ai-analysis-final-v5"
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
trap 'echo "ERROR: AI Final V5 failed; restoring exact pre-install index.html."; rollback' ERR

python3 - "$WORK" <<'PY'
from pathlib import Path
import base64, re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")
canonical_css = base64.b64decode("LyogTUZfQUlfRklOQUxfQ0FOT05JQ0FMX1Y1CiAgIEZpbmFsIHNpbmdsZS1vd25lciBwcmVzZW50YXRpb24gZm9yIEFJIEFuYWx5c2lzLgogICBPbmUgQUkgbW9kdWxlLCBvbmUgZGVlcCB3b3Jrc3BhY2UsIG5vIGR1cGxpY2F0ZWQgZXhlY3V0aW9uIGNvbnRyb2xzLgoqLwouYWktYW5hbHlzaXMtbW9kdWxlewogIGdyaWQtY29sdW1uOjEvLTEhaW1wb3J0YW50OwogIHBvc2l0aW9uOnJlbGF0aXZlIWltcG9ydGFudDsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgd2lkdGg6MTAwJSFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50OwogIGJvcmRlcjoxcHggc29saWQgcmdiYSg0MSw1Nyw3NCwuODIpIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOjE4cHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE4MGRlZyxyZ2JhKDE0LDIwLDI4LC45NykscmdiYSg4LDEyLDE3LC45ODUpKSFpbXBvcnRhbnQ7CiAgYm94LXNoYWRvdzowIDE4cHggNDhweCByZ2JhKDAsMCwwLC4yMCkhaW1wb3J0YW50OwogIG92ZXJmbG93OmhpZGRlbiFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLW1vZHVsZTo6YmVmb3JlewogIGRpc3BsYXk6bm9uZSFpbXBvcnRhbnQ7CiAgY29udGVudDpub25lIWltcG9ydGFudDsKfQoKLyogU3RhdGljIG1vZHVsZSBoZWFkZXIg4oCUIHNhbWUgaW5mb3JtYXRpb24gaGllcmFyY2h5IGFzIHRoZSBvdGhlciBwYW5lbHMuICovCi5haS1hbmFseXNpcy1tb2R1bGU+c3VtbWFyeXsKICB3aWR0aDoxMDAlIWltcG9ydGFudDsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgbWluLWhlaWdodDo3NHB4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzoxM3B4IDE1cHggMTJweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjAhaW1wb3J0YW50OwogIGJvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWxpbmUpIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjAwOCkhaW1wb3J0YW50OwogIGRpc3BsYXk6Z3JpZCFpbXBvcnRhbnQ7CiAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOm1pbm1heCgwLDFmcikgYXV0byFpbXBvcnRhbnQ7CiAgYWxpZ24taXRlbXM6Y2VudGVyIWltcG9ydGFudDsKICBnYXA6MTJweCFpbXBvcnRhbnQ7CiAgbGlzdC1zdHlsZTpub25lIWltcG9ydGFudDsKICBjdXJzb3I6ZGVmYXVsdCFpbXBvcnRhbnQ7CiAgcG9pbnRlci1ldmVudHM6bm9uZSFpbXBvcnRhbnQ7CiAgY29sb3I6dmFyKC0tdGV4dCkhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGU+c3VtbWFyeTo6LXdlYmtpdC1kZXRhaWxzLW1hcmtlcntkaXNwbGF5Om5vbmUhaW1wb3J0YW50fQouYWktYW5hbHlzaXMtbW9kdWxlPnN1bW1hcnk6OmFmdGVye2Rpc3BsYXk6bm9uZSFpbXBvcnRhbnQ7Y29udGVudDpub25lIWltcG9ydGFudH0KCi5haS1hbmFseXNpcy10aXRsZXsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgZGlzcGxheTpibG9jayFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLXRpdGxlIHNtYWxsewogIGRpc3BsYXk6YmxvY2shaW1wb3J0YW50OwogIG1hcmdpbjowIDAgNnB4IWltcG9ydGFudDsKICBjb2xvcjp2YXIoLS1jeWFuKSFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjhweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MSFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6OTAwIWltcG9ydGFudDsKICBsZXR0ZXItc3BhY2luZzouMTZlbSFpbXBvcnRhbnQ7CiAgdGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtdGl0bGUgYnsKICBkaXNwbGF5OmJsb2NrIWltcG9ydGFudDsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50OwogIGNvbG9yOiNmMmY2ZjkhaW1wb3J0YW50OwogIGZvbnQtc2l6ZToxN3B4IWltcG9ydGFudDsKICBsaW5lLWhlaWdodDoxLjE4IWltcG9ydGFudDsKICBmb250LXdlaWdodDo4NTAhaW1wb3J0YW50OwogIGxldHRlci1zcGFjaW5nOi0uMDI4ZW0haW1wb3J0YW50OwogIHdoaXRlLXNwYWNlOm5vd3JhcCFpbXBvcnRhbnQ7CiAgb3ZlcmZsb3c6aGlkZGVuIWltcG9ydGFudDsKICB0ZXh0LW92ZXJmbG93OmVsbGlwc2lzIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtdGl0bGU6OmFmdGVyewogIGNvbnRlbnQ6IkRlY2lzaW9uIGludGVsbGlnZW5jZSDCtyBNYXJrZXQgZXZpZGVuY2UgwrcgSG9sZGVyIHF1YWxpdHkiIWltcG9ydGFudDsKICBkaXNwbGF5OmJsb2NrIWltcG9ydGFudDsKICBtYXgtd2lkdGg6NTgwcHghaW1wb3J0YW50OwogIG1hcmdpbi10b3A6NXB4IWltcG9ydGFudDsKICBjb2xvcjojNzY4NTk2IWltcG9ydGFudDsKICBmb250LXNpemU6OC41cHghaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OjEuMyFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6NjAwIWltcG9ydGFudDsKICB3aGl0ZS1zcGFjZTpub3dyYXAhaW1wb3J0YW50OwogIG92ZXJmbG93OmhpZGRlbiFpbXBvcnRhbnQ7CiAgdGV4dC1vdmVyZmxvdzplbGxpcHNpcyFpbXBvcnRhbnQ7Cn0KCi5haS1hbmFseXNpcy1jaGlwc3sKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgZGlzcGxheTpmbGV4IWltcG9ydGFudDsKICBhbGlnbi1pdGVtczpjZW50ZXIhaW1wb3J0YW50OwogIGp1c3RpZnktY29udGVudDpmbGV4LWVuZCFpbXBvcnRhbnQ7CiAgZ2FwOjZweCFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1jaGlwcz5lbTpmaXJzdC1jaGlsZHsKICBkaXNwbGF5Om5vbmUhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1jaGlwcyBlbXsKICBtaW4taGVpZ2h0OjMwcHghaW1wb3J0YW50OwogIG1hcmdpbjowIWltcG9ydGFudDsKICBwYWRkaW5nOjAgMTBweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lMikhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6OTk5cHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDE4KSFpbXBvcnRhbnQ7CiAgZGlzcGxheTppbmxpbmUtZmxleCFpbXBvcnRhbnQ7CiAgYWxpZ24taXRlbXM6Y2VudGVyIWltcG9ydGFudDsKICBqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyIWltcG9ydGFudDsKICBjb2xvcjojOGM5OWE4IWltcG9ydGFudDsKICBmb250LXN0eWxlOm5vcm1hbCFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjhweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MSFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6ODUwIWltcG9ydGFudDsKICBsZXR0ZXItc3BhY2luZzouMDc1ZW0haW1wb3J0YW50OwogIHRleHQtdHJhbnNmb3JtOnVwcGVyY2FzZSFpbXBvcnRhbnQ7CiAgd2hpdGUtc3BhY2U6bm93cmFwIWltcG9ydGFudDsKfQouYWktZGF0YS12YWx7Y29sb3I6dmFyKC0tY3lhbikhaW1wb3J0YW50O2ZvbnQtd2VpZ2h0Ojk1MCFpbXBvcnRhbnR9CiNkZWNpc2lvbkxhbmV7CiAgbWF4LXdpZHRoOjE3MHB4IWltcG9ydGFudDsKICBvdmVyZmxvdzpoaWRkZW4haW1wb3J0YW50OwogIHRleHQtb3ZlcmZsb3c6ZWxsaXBzaXMhaW1wb3J0YW50Owp9CiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJ3YWl0aW5nIl0gI2RlY2lzaW9uTGFuZXsKICBjb2xvcjp2YXIoLS15ZWxsb3cpIWltcG9ydGFudDsKICBib3JkZXItY29sb3I6cmdiYSgyNDYsMTk5LDk1LC4zMCkhaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgyNDYsMTk5LDk1LC4wNikhaW1wb3J0YW50Owp9CiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJjb2xsZWN0aW5nIl0gI2RlY2lzaW9uTGFuZXsKICBjb2xvcjp2YXIoLS1jeWFuKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLWNvbG9yOnJnYmEoODQsMjIxLDI1NSwuMzApIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoODQsMjIxLDI1NSwuMDYpIWltcG9ydGFudDsKfQojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0icmVhZHkiXSAjZGVjaXNpb25MYW5lewogIGNvbG9yOnZhcigtLWdyZWVuKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLWNvbG9yOnJnYmEoODEsMjMxLDE2OCwuMzQpIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoODEsMjMxLDE2OCwuMDcpIWltcG9ydGFudDsKfQojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0iYmxvY2tlZCJdICNkZWNpc2lvbkxhbmV7CiAgY29sb3I6dmFyKC0tcmVkKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLWNvbG9yOnJnYmEoMjU1LDEwMSwxMTgsLjM0KSFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDI1NSwxMDEsMTE4LC4wNykhaW1wb3J0YW50Owp9CgovKiBBbHdheXMtdmlzaWJsZSBvdmVydmlldy4gKi8KLmFpLWFuYWx5c2lzLWJvZHl7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIHBhZGRpbmc6MTNweCAxNHB4IDE0cHghaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLnJlYXNvbnsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzoxM3B4IDE0cHghaW1wb3J0YW50OwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSkhaW1wb3J0YW50OwogIGJvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS15ZWxsb3cpIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOjEycHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgyNDYsMTk5LDk1LC4wNCkhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLnJlYXNvbi5ncmVlbnsKICBib3JkZXItbGVmdC1jb2xvcjp2YXIoLS1ncmVlbikhaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSg4MSwyMzEsMTY4LC4wNDUpIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlIC5yZWFzb24uY3lhbnsKICBib3JkZXItbGVmdC1jb2xvcjp2YXIoLS1jeWFuKSFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDg0LDIyMSwyNTUsLjA0NSkhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLnJlYXNvbi5yZWR7CiAgYm9yZGVyLWxlZnQtY29sb3I6dmFyKC0tcmVkKSFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDI1NSwxMDEsMTE4LC4wNDUpIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlIC5yZWFzb24gYnsKICBjb2xvcjojZWVmNGY4IWltcG9ydGFudDsKICBmb250LXNpemU6MTFweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MS4zMiFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLW1vZHVsZSAucmVhc29uIHNwYW57CiAgZGlzcGxheTpibG9jayFpbXBvcnRhbnQ7CiAgbWFyZ2luLXRvcDo1cHghaW1wb3J0YW50OwogIGNvbG9yOiM4ZTliYWEhaW1wb3J0YW50OwogIGZvbnQtc2l6ZToxMHB4IWltcG9ydGFudDsKICBsaW5lLWhlaWdodDoxLjQ4IWltcG9ydGFudDsKfQoKLyogV0FJVElORyAvIENPTExFQ1RJTkcgb3ZlcnZpZXcuICovCi5tZi1haS1jb21wYWN0LXdhaXRpbmd7CiAgZGlzcGxheTpub25lOwogIGdyaWQtdGVtcGxhdGUtY29sdW1uczptaW5tYXgoMCwxZnIpOwogIGdhcDo4cHg7Cn0KLm1mLWFpLWNvbXBhY3QtY29weXsKICBtaW4td2lkdGg6MDsKICBwYWRkaW5nOjEzcHggMTRweDsKICBib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpOwogIGJvcmRlci1yYWRpdXM6MTJweDsKICBiYWNrZ3JvdW5kOnJnYmEoNywxMSwxNiwuNTYpOwp9Ci5tZi1haS1jb21wYWN0LWNvcHkgc21hbGx7CiAgZGlzcGxheTpibG9jazsKICBtYXJnaW46MCAwIDZweDsKICBjb2xvcjp2YXIoLS1jeWFuKTsKICBmb250LXNpemU6Ny41cHg7CiAgbGluZS1oZWlnaHQ6MTsKICBmb250LXdlaWdodDo5MDA7CiAgbGV0dGVyLXNwYWNpbmc6LjE1ZW07CiAgdGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlOwp9Ci5tZi1haS1jb21wYWN0LWNvcHkgc3Ryb25newogIGRpc3BsYXk6YmxvY2s7CiAgY29sb3I6I2VkZjNmNzsKICBmb250LXNpemU6MTVweDsKICBsaW5lLWhlaWdodDoxLjI1OwogIGZvbnQtd2VpZ2h0Ojg0MDsKICBsZXR0ZXItc3BhY2luZzotLjAyZW07Cn0KLm1mLWFpLWNvbXBhY3QtY29weSBwewogIG1hcmdpbjo2cHggMCAwOwogIGNvbG9yOiM4OTk3YTc7CiAgZm9udC1zaXplOjkuNXB4OwogIGxpbmUtaGVpZ2h0OjEuNDg7Cn0KLm1mLWFpLWNvbXBhY3Qtc3RhdHVzewogIGRpc3BsYXk6Z3JpZDsKICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDMsbWlubWF4KDAsMWZyKSk7CiAgZ2FwOjZweDsKfQoubWYtYWktY29tcGFjdC1zdGF0dXM+ZGl2ewogIG1pbi13aWR0aDowOwogIG1pbi1oZWlnaHQ6NTJweDsKICBwYWRkaW5nOjlweCAxMHB4OwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7CiAgYm9yZGVyLXJhZGl1czoxMHB4OwogIGJhY2tncm91bmQ6cmdiYSg3LDExLDE2LC41OCk7CiAgZGlzcGxheTpncmlkOwogIGFsaWduLWNvbnRlbnQ6Y2VudGVyOwogIGdhcDo2cHg7Cn0KLm1mLWFpLWNvbXBhY3Qtc3RhdHVzIHNwYW57CiAgbWluLXdpZHRoOjA7CiAgY29sb3I6IzdlOGM5ZDsKICBmb250LXNpemU6Ny41cHg7CiAgbGluZS1oZWlnaHQ6MS4yOwogIHdoaXRlLXNwYWNlOm5vd3JhcDsKICBvdmVyZmxvdzpoaWRkZW47CiAgdGV4dC1vdmVyZmxvdzplbGxpcHNpczsKfQoubWYtYWktY29tcGFjdC1zdGF0dXMgYnsKICBjb2xvcjp2YXIoLS15ZWxsb3cpOwogIGZvbnQtc2l6ZToxMHB4OwogIGxpbmUtaGVpZ2h0OjE7CiAgZm9udC13ZWlnaHQ6ODgwOwogIGxldHRlci1zcGFjaW5nOi4wM2VtOwp9CgojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0id2FpdGluZyJdIC5tZi1haS1jb21wYWN0LXdhaXRpbmcsCiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJjb2xsZWN0aW5nIl0gLm1mLWFpLWNvbXBhY3Qtd2FpdGluZ3sKICBkaXNwbGF5OmdyaWQhaW1wb3J0YW50Owp9CiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJ3YWl0aW5nIl0gI2RlY2lzaW9uUmVhc29uLAojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0id2FpdGluZyJdICNhaUFuYWx5c2lzRGVlcCwKI2FpLWFuYWx5c2lzW2RhdGEtYWktdWktc3RhdGU9ImNvbGxlY3RpbmciXSAjZGVjaXNpb25SZWFzb24sCiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJjb2xsZWN0aW5nIl0gI2FpQW5hbHlzaXNEZWVwewogIGRpc3BsYXk6bm9uZSFpbXBvcnRhbnQ7Cn0KI2FpLWFuYWx5c2lzW2RhdGEtYWktdWktc3RhdGU9InJlYWR5Il0gLm1mLWFpLWNvbXBhY3Qtd2FpdGluZywKI2FpLWFuYWx5c2lzW2RhdGEtYWktdWktc3RhdGU9ImJsb2NrZWQiXSAubWYtYWktY29tcGFjdC13YWl0aW5newogIGRpc3BsYXk6bm9uZSFpbXBvcnRhbnQ7Cn0KI2FpLWFuYWx5c2lzW2RhdGEtYWktdWktc3RhdGU9InJlYWR5Il0gI2RlY2lzaW9uUmVhc29uLAojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0icmVhZHkiXSAjYWlBbmFseXNpc0RlZXAsCiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJibG9ja2VkIl0gI2RlY2lzaW9uUmVhc29uLAojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0iYmxvY2tlZCJdICNhaUFuYWx5c2lzRGVlcHsKICBkaXNwbGF5OmJsb2NrIWltcG9ydGFudDsKfQoKLyogRGVlcCBhbmFseXNpczogdGhlIG9ubHkgY29sbGFwc2libGUgcGFydC4gKi8KLmFpLWFuYWx5c2lzLWRlZXB7CiAgbWFyZ2luOjlweCAwIDAhaW1wb3J0YW50OwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZTIpIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOjExcHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSg3LDExLDE2LC40MikhaW1wb3J0YW50OwogIG92ZXJmbG93OmhpZGRlbiFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLWRlZXA+c3VtbWFyeXsKICB3aWR0aDoxMDAlIWltcG9ydGFudDsKICBtaW4taGVpZ2h0OjQ2cHghaW1wb3J0YW50OwogIG1hcmdpbjowIWltcG9ydGFudDsKICBwYWRkaW5nOjAgMTFweCFpbXBvcnRhbnQ7CiAgZGlzcGxheTpncmlkIWltcG9ydGFudDsKICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6bWlubWF4KDAsMWZyKSBhdXRvIGF1dG8haW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAgZ2FwOjlweCFpbXBvcnRhbnQ7CiAgbGlzdC1zdHlsZTpub25lIWltcG9ydGFudDsKICBjdXJzb3I6cG9pbnRlciFpbXBvcnRhbnQ7CiAgY29sb3I6I2RmZTdlZCFpbXBvcnRhbnQ7CiAgLXdlYmtpdC10YXAtaGlnaGxpZ2h0LWNvbG9yOnRyYW5zcGFyZW50IWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtZGVlcD5zdW1tYXJ5Ojotd2Via2l0LWRldGFpbHMtbWFya2Vye2Rpc3BsYXk6bm9uZSFpbXBvcnRhbnR9Ci5haS1hbmFseXNpcy1kZWVwPnN1bW1hcnkgLmFpLWRlZXAtdGl0bGV7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIGZvbnQtc2l6ZToxMHB4IWltcG9ydGFudDsKICBsaW5lLWhlaWdodDoxLjIhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OjgyMCFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLWRlZXA+c3VtbWFyeSAuYWktZGVlcC1tZXRhewogIG1pbi13aWR0aDowIWltcG9ydGFudDsKICBjb2xvcjojNzQ4MjkzIWltcG9ydGFudDsKICBmb250LXNpemU6OHB4IWltcG9ydGFudDsKICBsaW5lLWhlaWdodDoxLjIhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OjY1MCFpbXBvcnRhbnQ7CiAgd2hpdGUtc3BhY2U6bm93cmFwIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtZGVlcD5zdW1tYXJ5OjphZnRlcnsKICBjb250ZW50OiLigLoiIWltcG9ydGFudDsKICB3aWR0aDoxNnB4IWltcG9ydGFudDsKICBoZWlnaHQ6MjBweCFpbXBvcnRhbnQ7CiAgZGlzcGxheTppbmxpbmUtZmxleCFpbXBvcnRhbnQ7CiAgYWxpZ24taXRlbXM6Y2VudGVyIWltcG9ydGFudDsKICBqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyIWltcG9ydGFudDsKICBjb2xvcjojOGY5ZGFkIWltcG9ydGFudDsKICBmb250LXNpemU6MjBweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MSFpbXBvcnRhbnQ7CiAgdHJhbnNmb3JtOnJvdGF0ZSgwZGVnKSFpbXBvcnRhbnQ7CiAgdHJhbnNpdGlvbjp0cmFuc2Zvcm0gLjE2cyBlYXNlIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtZGVlcFtvcGVuXT5zdW1tYXJ5ewogIGJvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWxpbmUpIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjAxMikhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1kZWVwW29wZW5dPnN1bW1hcnk6OmFmdGVyewogIHRyYW5zZm9ybTpyb3RhdGUoOTBkZWcpIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtZGVlcC1ib2R5ewogIHBhZGRpbmc6OXB4IWltcG9ydGFudDsKfQoKLyogTWV0YS9zb3VyY2UgaXMgcHJlc2VydmVkLCBidXQgYmVsb25ncyB0byBkZWVwIGV2aWRlbmNlLCBub3QgdGhlIG92ZXJ2aWV3LiAqLwouYWktYW5hbHlzaXMtbWV0YXsKICBtaW4taGVpZ2h0OjM0cHghaW1wb3J0YW50OwogIG1hcmdpbjowIDAgOHB4IWltcG9ydGFudDsKICBwYWRkaW5nOjAgMTBweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czo5cHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSg0LDgsMTIsLjQ2KSFpbXBvcnRhbnQ7CiAgZGlzcGxheTpmbGV4IWltcG9ydGFudDsKICBhbGlnbi1pdGVtczpjZW50ZXIhaW1wb3J0YW50OwogIGp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIWltcG9ydGFudDsKICBnYXA6MTBweCFpbXBvcnRhbnQ7CiAgY29sb3I6IzljYThiNCFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjlweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MS4yIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbWV0YTo6YmVmb3JlewogIGNvbnRlbnQ6IkNPTlRFWFQiIWltcG9ydGFudDsKICBmbGV4OjAgMCBhdXRvIWltcG9ydGFudDsKICBjb2xvcjojNjk3Nzg5IWltcG9ydGFudDsKICBmb250LXNpemU6N3B4IWltcG9ydGFudDsKICBmb250LXdlaWdodDo4NTAhaW1wb3J0YW50OwogIGxldHRlci1zcGFjaW5nOi4xM2VtIWltcG9ydGFudDsKfQoKLyogRGVjaXNpb24gcGF0aDogdXNlZnVsIHdoZW4gcHJlc2VudCwgdGlueSB3aGVuIGFic2VudC4gKi8KLmFpLWFuYWx5c2lzLW1vZHVsZSAjZGVjaXNpb25UcmVlewogIG1pbi1oZWlnaHQ6MCFpbXBvcnRhbnQ7CiAgaGVpZ2h0OmF1dG8haW1wb3J0YW50OwogIG1hcmdpbjowIDAgOHB4IWltcG9ydGFudDsKICBwYWRkaW5nOjhweCFpbXBvcnRhbnQ7CiAgZGlzcGxheTpncmlkIWltcG9ydGFudDsKICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDYsbWlubWF4KDAsMWZyKSkhaW1wb3J0YW50OwogIGdhcDo2cHghaW1wb3J0YW50OwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSkhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6MTBweCFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDQsOCwxMiwuNDYpIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlICNkZWNpc2lvblRyZWU6ZW1wdHl7CiAgZGlzcGxheTpub25lIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlICNkZWNpc2lvblRyZWUgLnRyZWUtbm9kZXsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgbWluLWhlaWdodDo0NHB4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzo3cHggNXB4IWltcG9ydGFudDsKICBkaXNwbGF5OmZsZXghaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAganVzdGlmeS1jb250ZW50OmNlbnRlciFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czo4cHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDE0KSFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLW1vZHVsZSAjZGVjaXNpb25UcmVlIC5lbXB0eXsKICBncmlkLWNvbHVtbjoxLy0xIWltcG9ydGFudDsKICBtaW4taGVpZ2h0OjAhaW1wb3J0YW50OwogIG1hcmdpbjowIWltcG9ydGFudDsKICBwYWRkaW5nOjEycHggMTBweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjAhaW1wb3J0YW50OwogIGJhY2tncm91bmQ6dHJhbnNwYXJlbnQhaW1wb3J0YW50OwogIGNvbG9yOiM3ZThiOWEhaW1wb3J0YW50OwogIGZvbnQtc2l6ZToxMHB4IWltcG9ydGFudDsKICBsaW5lLWhlaWdodDoxLjQhaW1wb3J0YW50OwogIHRleHQtYWxpZ246bGVmdCFpbXBvcnRhbnQ7Cn0KCi8qIEV2aWRlbmNlIC8gVGltZWxpbmUgLyBNZW1vcnkgd29ya3NwYWNlLiAqLwouYWktYW5hbHlzaXMtbW9kdWxlIC5haS1hbmFseXNpcy10YWJzewogIGRpc3BsYXk6Z3JpZCFpbXBvcnRhbnQ7CiAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCgzLDFmcikhaW1wb3J0YW50OwogIGdhcDo0cHghaW1wb3J0YW50OwogIG1hcmdpbjowIWltcG9ydGFudDsKICBwYWRkaW5nOjRweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czoxMHB4IWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoNCw4LDEyLC41NikhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLmFpLWFuYWx5c2lzLXRhYnMgLml0YWJ7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIG1pbi1oZWlnaHQ6MzVweCFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50OwogIHBhZGRpbmc6MCA3cHghaW1wb3J0YW50OwogIGJvcmRlcjowIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOjdweCFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDp0cmFuc3BhcmVudCFpbXBvcnRhbnQ7CiAgY29sb3I6Izc3ODU5NiFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjguNXB4IWltcG9ydGFudDsKICBsaW5lLWhlaWdodDoxIWltcG9ydGFudDsKICBmb250LXdlaWdodDo3NjAhaW1wb3J0YW50OwogIHRyYW5zZm9ybTpub25lIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlIC5haS1hbmFseXNpcy10YWJzIC5pdGFiLmFjdGl2ZXsKICBiYWNrZ3JvdW5kOnJnYmEoODQsMjIxLDI1NSwuMDc1KSFpbXBvcnRhbnQ7CiAgY29sb3I6I2VkZjVmOCFpbXBvcnRhbnQ7CiAgYm94LXNoYWRvdzppbnNldCAwIDAgMCAxcHggcmdiYSg4NCwyMjEsMjU1LC4xNCkhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLnRhYi1wYW5lewogIG1hcmdpbi10b3A6OHB4IWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlIC50YWItcGFuZS5hY3RpdmV7CiAgcGFkZGluZzo4cHggMTBweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czoxMHB4IWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoNCw4LDEyLC40NCkhaW1wb3J0YW50Owp9CgovKiBDb21wYWN0IGFsbCBldmlkZW5jZSByb3dzIHdpdGhvdXQgbG9zaW5nIGFueSBmaWVsZC4gKi8KI3BhbmUtZXZpZGVuY2UgLmRhdGEtcm93ewogIG1pbi1oZWlnaHQ6NDBweCFpbXBvcnRhbnQ7CiAgcGFkZGluZzo4cHggMCFpbXBvcnRhbnQ7CiAgZGlzcGxheTpncmlkIWltcG9ydGFudDsKICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6bWlubWF4KDkwcHgsLjQyZnIpIG1pbm1heCgwLDFmcikhaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAgZ2FwOjEwcHghaW1wb3J0YW50OwogIGJvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWxpbmUpIWltcG9ydGFudDsKfQojcGFuZS1ldmlkZW5jZSAuZGF0YS1yb3c6bGFzdC1jaGlsZHsKICBib3JkZXItYm90dG9tOjAhaW1wb3J0YW50Owp9CiNwYW5lLWV2aWRlbmNlIC5kYXRhLXJvdz5zcGFuOmZpcnN0LWNoaWxkLAojcGFuZS1ldmlkZW5jZSAuZGF0YS1yb3c+ZGl2OmZpcnN0LWNoaWxkewogIGNvbG9yOiM3ODg2OTchaW1wb3J0YW50OwogIGZvbnQtc2l6ZTo4LjVweCFpbXBvcnRhbnQ7Cn0KI3BhbmUtZXZpZGVuY2UgLmRhdGEtcm93PnNwYW46bGFzdC1jaGlsZCwKI3BhbmUtZXZpZGVuY2UgLmRhdGEtcm93PmRpdjpsYXN0LWNoaWxkLAojcGFuZS1ldmlkZW5jZSAuZGF0YS1yb3c+YXsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgY29sb3I6I2UyZThlZCFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjkuNXB4IWltcG9ydGFudDsKICBmb250LXdlaWdodDo3MjAhaW1wb3J0YW50OwogIHRleHQtYWxpZ246cmlnaHQhaW1wb3J0YW50OwogIG92ZXJmbG93OmhpZGRlbiFpbXBvcnRhbnQ7CiAgdGV4dC1vdmVyZmxvdzplbGxpcHNpcyFpbXBvcnRhbnQ7CiAgd2hpdGUtc3BhY2U6bm93cmFwIWltcG9ydGFudDsKfQojcGFuZS1ldmlkZW5jZSBhewogIGNvbG9yOiNkZmU4ZWUhaW1wb3J0YW50Owp9CgovKiBFbXB0eSBUaW1lbGluZSAvIE1lbW9yeSBzdGF0ZXMgcmVtYWluIGFjY2Vzc2libGUgYnV0IG5vIGxvbmdlciBjb25zdW1lIGEgc2NyZWVuLiAqLwojcGFuZS10aW1lbGluZSAuZW1wdHksCiNwYW5lLW1lbW9yeSAuZW1wdHl7CiAgbWluLWhlaWdodDowIWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzoxM3B4IDEwcHghaW1wb3J0YW50OwogIGJvcmRlcjowIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnRyYW5zcGFyZW50IWltcG9ydGFudDsKICBjb2xvcjojNzc4NTk2IWltcG9ydGFudDsKICBmb250LXNpemU6MTBweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MS40IWltcG9ydGFudDsKICB0ZXh0LWFsaWduOmxlZnQhaW1wb3J0YW50Owp9CgovKiBBSSBpcyBhbmFseXNpcyBvbmx5LiBFeGVjdXRpb24gYXV0aG9yaXR5IHN0YXlzIGluIFByZS10cmFkZS4gKi8KLmFpLWFuYWx5c2lzLW5leHR7CiAgbWFyZ2luLXRvcDo4cHghaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1uZXh0IC5haS1wcmV0cmFkZS1saW5rewogIHdpZHRoOjEwMCUhaW1wb3J0YW50OwogIG1pbi1oZWlnaHQ6NDBweCFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50OwogIHBhZGRpbmc6MCAxMXB4IWltcG9ydGFudDsKICBib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUyKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czo5cHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDE1KSFpbXBvcnRhbnQ7CiAgZGlzcGxheTpmbGV4IWltcG9ydGFudDsKICBhbGlnbi1pdGVtczpjZW50ZXIhaW1wb3J0YW50OwogIGp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIWltcG9ydGFudDsKICBnYXA6MTBweCFpbXBvcnRhbnQ7CiAgY29sb3I6I2RjZTVlYiFpbXBvcnRhbnQ7CiAgdGV4dC1kZWNvcmF0aW9uOm5vbmUhaW1wb3J0YW50OwogIGZvbnQtc2l6ZTo5LjVweCFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6NzkwIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbmV4dCAuYWktcHJldHJhZGUtbGluayBzcGFuewogIGNvbG9yOiM4OTk3YTchaW1wb3J0YW50OwogIGZvbnQtc2l6ZToxN3B4IWltcG9ydGFudDsKICBsaW5lLWhlaWdodDoxIWltcG9ydGFudDsKfQoKLyogTW9iaWxlIHJoeXRobTogUHJpbWFyeSBDYW5kaWRhdGUgLT4gMTZweCAtPiBBSSAtPiBuZXh0IG1vZHVsZS4gKi8KQG1lZGlhKG1heC13aWR0aDo4MjBweCl7CiAgLmFpLWFuYWx5c2lzLW1vZHVsZXsKICAgIG1hcmdpbi10b3A6MTZweCFpbXBvcnRhbnQ7CiAgICBib3JkZXItcmFkaXVzOjE4cHghaW1wb3J0YW50OwogICAgYm94LXNoYWRvdzpub25lIWltcG9ydGFudDsKICB9CiAgLmFpLWFuYWx5c2lzLW1vZHVsZT5zdW1tYXJ5ewogICAgbWluLWhlaWdodDo3MHB4IWltcG9ydGFudDsKICAgIHBhZGRpbmc6MTJweCAxM3B4IWltcG9ydGFudDsKICAgIGdhcDo5cHghaW1wb3J0YW50OwogIH0KICAuYWktYW5hbHlzaXMtdGl0bGUgc21hbGx7CiAgICBtYXJnaW4tYm90dG9tOjVweCFpbXBvcnRhbnQ7CiAgICBmb250LXNpemU6Ny41cHghaW1wb3J0YW50OwogIH0KICAuYWktYW5hbHlzaXMtdGl0bGUgYnsKICAgIGZvbnQtc2l6ZToxNHB4IWltcG9ydGFudDsKICB9CiAgLmFpLWFuYWx5c2lzLXRpdGxlOjphZnRlcnsKICAgIG1heC13aWR0aDozMTBweCFpbXBvcnRhbnQ7CiAgICBtYXJnaW4tdG9wOjRweCFpbXBvcnRhbnQ7CiAgICBmb250LXNpemU6OHB4IWltcG9ydGFudDsKICB9CiAgLmFpLWFuYWx5c2lzLWNoaXBzIGVtewogICAgbWluLWhlaWdodDoyOHB4IWltcG9ydGFudDsKICAgIHBhZGRpbmc6MCA4cHghaW1wb3J0YW50OwogICAgZm9udC1zaXplOjcuNXB4IWltcG9ydGFudDsKICB9CiAgI2RlY2lzaW9uTGFuZXsKICAgIG1heC13aWR0aDoxNTBweCFpbXBvcnRhbnQ7CiAgfQogIC5haS1hbmFseXNpcy1ib2R5ewogICAgcGFkZGluZzoxMXB4IDEycHggMTJweCFpbXBvcnRhbnQ7CiAgfQogIC5tZi1haS1jb21wYWN0LXN0YXR1c3sKICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMyxtaW5tYXgoMCwxZnIpKSFpbXBvcnRhbnQ7CiAgfQogIC5haS1hbmFseXNpcy1kZWVwPnN1bW1hcnl7CiAgICBtaW4taGVpZ2h0OjQ0cHghaW1wb3J0YW50OwogICAgcGFkZGluZzowIDEwcHghaW1wb3J0YW50OwogIH0KICAuYWktYW5hbHlzaXMtZGVlcD5zdW1tYXJ5IC5haS1kZWVwLW1ldGF7CiAgICBkaXNwbGF5Om5vbmUhaW1wb3J0YW50OwogIH0KICAuYWktYW5hbHlzaXMtZGVlcC1ib2R5ewogICAgcGFkZGluZzo4cHghaW1wb3J0YW50OwogIH0KICAuYWktYW5hbHlzaXMtbW9kdWxlICNkZWNpc2lvblRyZWV7CiAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDIsbWlubWF4KDAsMWZyKSkhaW1wb3J0YW50OwogIH0KfQpAbWVkaWEobWF4LXdpZHRoOjQzMHB4KXsKICAuYWktYW5hbHlzaXMtdGl0bGUgYnsKICAgIGZvbnQtc2l6ZToxMy41cHghaW1wb3J0YW50OwogIH0KICAuYWktYW5hbHlzaXMtdGl0bGU6OmFmdGVyewogICAgbWF4LXdpZHRoOjIzNXB4IWltcG9ydGFudDsKICB9CiAgLm1mLWFpLWNvbXBhY3Qtc3RhdHVzPmRpdnsKICAgIG1pbi1oZWlnaHQ6NTBweCFpbXBvcnRhbnQ7CiAgICBwYWRkaW5nOjhweCFpbXBvcnRhbnQ7CiAgfQogIC5tZi1haS1jb21wYWN0LXN0YXR1cyBzcGFue2ZvbnQtc2l6ZTo3cHghaW1wb3J0YW50fQogIC5tZi1haS1jb21wYWN0LXN0YXR1cyBie2ZvbnQtc2l6ZTo5cHghaW1wb3J0YW50fQogICNwYW5lLWV2aWRlbmNlIC5kYXRhLXJvd3sKICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczo4OHB4IG1pbm1heCgwLDFmcikhaW1wb3J0YW50OwogIH0KfQ==").decode("utf-8")

style_before = len(re.findall(r"<style\b", src, flags=re.I))
script_before = len(re.findall(r"<script\b", src, flags=re.I))

# ---------- helpers ----------
def matching_details_end(html, open_match):
    tag_re = re.compile(r'<details\b[^>]*>|</details\s*>', flags=re.I)
    depth = 0
    for tag in tag_re.finditer(html, open_match.start()):
        if tag.group(0).lower().startswith("<details"):
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                return tag.end()
    raise SystemExit("Unbalanced <details> structure for #ai-analysis.")

def matching_div_end(html, open_match):
    tag_re = re.compile(r'<div\b[^>]*>|</div\s*>', flags=re.I)
    depth = 0
    for tag in tag_re.finditer(html, open_match.start()):
        if tag.group(0).lower().startswith("<div"):
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                return tag.end()
    raise SystemExit("Unbalanced <div> structure.")

# ---------- exact AI host / logic contract ----------
ai_open = re.search(
    r'<details\b(?=[^>]*\bid=["\']ai-analysis["\'])[^>]*>',
    src, flags=re.I
)
if not ai_open:
    raise SystemExit("details#ai-analysis not found.")

ai_end = matching_details_end(src, ai_open)
ai = src[ai_open.start():ai_end]

for ident in (
    "decisionData","decisionLane","decisionMeta","decisionReason","decisionTree",
    "pane-evidence","pane-timeline","pane-memory","validateBtn",
    "mfAiCompactKicker","mfAiCompactTitle","mfAiCompactText",
    "mfAiCompactCompleteness","mfAiCompactMarket","mfAiCompactHolders",
    "aiAnalysisDeep"
):
    if ai.count(f'id="{ident}"') != 1:
        raise SystemExit(f"Expected exactly one #{ident} inside #ai-analysis.")

if ai.count('data-mf-ai-module-v4="1"') != 1:
    raise SystemExit("Expected one installed V4 marker inside #ai-analysis.")

# ---------- upgrade marker ----------
ai = ai.replace('data-mf-ai-module-v4="1"', 'data-mf-ai-module-v5="1"', 1)

# ---------- move decisionMeta into deep workspace ----------
meta_re = re.compile(
    r'<p\b(?=[^>]*\bid=["\']decisionMeta["\'])[^>]*>.*?</p>',
    flags=re.I | re.S
)
meta = meta_re.search(ai)
if not meta:
    raise SystemExit("decisionMeta element not found.")
meta_html = meta.group(0)
ai = ai[:meta.start()] + ai[meta.end():]

deep_body_open = re.search(
    r'<div\b[^>]*\bclass=["\'][^"\']*\bai-analysis-deep-body\b[^"\']*["\'][^>]*>',
    ai, flags=re.I
)
if not deep_body_open:
    raise SystemExit("ai-analysis-deep-body not found.")
insert_at = deep_body_open.end()
ai = ai[:insert_at] + meta_html + ai[insert_at:]

# ---------- replace AI-owned execution placeholders ----------
actions_open = re.search(
    r'<div\b[^>]*\bclass=["\'][^"\']*\bmission-actions\b[^"\']*["\'][^>]*>',
    ai, flags=re.I
)
if not actions_open:
    raise SystemExit("AI mission-actions block not found.")

actions_end = matching_div_end(ai, actions_open)
actions_html = ai[actions_open.start():actions_end]

# Guard: only remove the known AI placeholder/action controls.
for ident in ("validateBtn","replayBtn","compareBtn"):
    if f'id="{ident}"' not in actions_html:
        raise SystemExit(f"Expected #{ident} inside AI mission-actions.")

next_html = (
    '<div class="ai-analysis-next">'
    '<a class="ai-pretrade-link" href="#executionPreview">'
    '<span>Review pre-trade checks</span><span aria-hidden="true">›</span>'
    '</a>'
    '</div>'
)
ai = ai[:actions_open.start()] + next_html + ai[actions_end:]

# Put the rewritten single AI host back into the page.
src = src[:ai_open.start()] + ai + src[ai_end:]

# ---------- clean ALL old AI presentation rules by selector ----------
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
    ".ai-analysis-next",
    ".ai-pretrade-link",
    ".mf-ai-compact-waiting",
    ".mf-ai-compact-copy",
    ".mf-ai-compact-status",
    "#decisionTree",
    "#decisionLane",
    "#pane-evidence",
    "#pane-timeline",
    "#pane-memory",
)

def find_open(text, start):
    quote=None; esc=False; comment=False; i=start
    while i < len(text):
        if comment:
            if text.startswith("*/", i):
                comment=False; i+=2; continue
            i+=1; continue
        if not quote and text.startswith("/*", i):
            comment=True; i+=2; continue
        ch=text[i]
        if quote:
            if esc: esc=False
            elif ch=="\\": esc=True
            elif ch==quote: quote=None
            i+=1; continue
        if ch in ("'", '"'):
            quote=ch; i+=1; continue
        if ch=="{": return i
        i+=1
    return -1

def find_close(text, op):
    depth=1; quote=None; esc=False; comment=False; i=op+1
    while i < len(text):
        if comment:
            if text.startswith("*/", i):
                comment=False; i+=2; continue
            i+=1; continue
        if not quote and text.startswith("/*", i):
            comment=True; i+=2; continue
        ch=text[i]
        if quote:
            if esc: esc=False
            elif ch=="\\": esc=True
            elif ch==quote: quote=None
            i+=1; continue
        if ch in ("'", '"'):
            quote=ch
        elif ch=="{":
            depth+=1
        elif ch=="}":
            depth-=1
            if depth==0: return i
        i+=1
    raise SystemExit("Unbalanced CSS while consolidating V5.")

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
        r'/\*.*?(?:MF_AI_WORKSPACE_CANONICAL_V4|MF_AI_FULL_MODULE_CANONICAL_V3|'
        r'MF_AI_STANDALONE_CANONICAL_V2|MF_AI_STANDALONE_MODULE_V1|'
        r'MF_AI_BUTTON_ALL_CHECKS_V1|MF_AI_ANALYSIS_COMPACT_BODY_V1).*?\*/',
        '',
        body,
        flags=re.I|re.S
    )

    is_consolidated=bool(re.search(
        r'\bid=["\']memeflow-consolidated-css["\']',
        attrs,
        flags=re.I
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
    raise SystemExit(f"Expected one memeflow-consolidated-css; found {consolidated}.")

# ---------- final clean-code verification ----------
style_after=len(re.findall(r"<style\b",src,flags=re.I))
script_after=len(re.findall(r"<script\b",src,flags=re.I))

checks={
    "style count did not increase": style_after <= style_before,
    "script count unchanged": script_after == script_before,
    "one AI host": src.count('id="ai-analysis"') == 1,
    "one V5 marker": src.count('data-mf-ai-module-v5="1"') == 1,
    "old V4 marker removed": 'data-mf-ai-module-v4="1"' not in src,
    "one V5 CSS owner": src.count("MF_AI_FINAL_CANONICAL_V5") == 1,
    "old V4 CSS removed": "MF_AI_WORKSPACE_CANONICAL_V4" not in src,
    "one deep workspace": src.count('id="aiAnalysisDeep"') == 1,
    "meta preserved": src.count('id="decisionMeta"') == 1,
    "reason preserved": src.count('id="decisionReason"') == 1,
    "tree preserved": src.count('id="decisionTree"') == 1,
    "Evidence preserved": src.count('id="pane-evidence"') == 1,
    "Timeline preserved": src.count('id="pane-timeline"') == 1,
    "Memory preserved": src.count('id="pane-memory"') == 1,
    "fake validate removed": 'id="validateBtn"' not in src,
    "replay placeholder removed": 'id="replayBtn"' not in src,
    "compare placeholder removed": 'id="compareBtn"' not in src,
    "pretrade link added": src.count('class="ai-pretrade-link"') == 1,
    "waiting completeness preserved": src.count('id="mfAiCompactCompleteness"') == 1,
    "waiting market preserved": src.count('id="mfAiCompactMarket"') == 1,
    "waiting holders preserved": src.count('id="mfAiCompactHolders"') == 1,
}
failed=[k for k,v in checks.items() if not v]
if failed:
    raise SystemExit("Verification failed: "+", ".join(failed))

path.write_text(src,encoding="utf-8")

print("AI Final V5 source consolidation prepared.")
print(f"<style> count: {style_before} -> {style_after}")
print(f"<script> count: {script_before} -> {script_after}")
print("AI host count: 1")
print("Deep workspace count: 1")
print("Evidence / Timeline / Memory preserved: PASS")
print("Execution placeholders removed from AI: PASS")
PY

grep -q 'data-mf-ai-module-v5="1"' "$WORK"
grep -q 'MF_AI_FINAL_CANONICAL_V5' "$WORK"
grep -q 'id="pane-evidence"' "$WORK"
grep -q 'id="pane-timeline"' "$WORK"
grep -q 'id="pane-memory"' "$WORK"
grep -q 'class="ai-pretrade-link"' "$WORK"
! grep -q 'data-mf-ai-module-v4="1"' "$WORK"
! grep -q 'MF_AI_WORKSPACE_CANONICAL_V4' "$WORK"
! grep -q 'id="validateBtn"' "$WORK"
! grep -q 'id="replayBtn"' "$WORK"
! grep -q 'id="compareBtn"' "$WORK"

cp "$WORK" "$INDEX"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
BACKUP=$BACKUP
EOF

rm -f "$WORK"
trap - ERR

echo
echo "OK: AI ANALYSIS FINAL V5 installed cleanly."
echo
echo "AI host node: ONE"
echo "Deep analysis workspace: ONE"
echo "Old V4 AI CSS: REMOVED"
echo "Canonical V5 AI CSS owner: ONE"
echo "New <style> layers: NONE"
echo "New <script> layers: NONE"
echo "Decision meta/reason/tree: PRESERVED"
echo "Evidence / Timeline / Memory: PRESERVED"
echo "WAITING readiness fields: PRESERVED"
echo "AI Validate placeholder: REMOVED"
echo "Decision replay placeholder: REMOVED"
echo "Compare placeholder: REMOVED"
echo "Real execution authority: PRE-TRADE ONLY"
echo "AI evaluator / trading logic: UNCHANGED"
echo
echo "Now Stop -> Run, hard-refresh, and test WAITING + READY."
