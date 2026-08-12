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

if grep -q 'data-mf-ai-module-v2="1"' "$INDEX"; then
  echo "AI ANALYSIS STANDALONE MODULE V2 is already installed."
  exit 0
fi

PATCH_DIR="$APP/.memeflow-patches/ai-analysis-standalone-module-v2"
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
trap 'echo "ERROR: AI standalone V2 patch failed; restoring exact pre-install index.html."; rollback' ERR

python3 - "$WORK" <<'PY'
from pathlib import Path
import base64, re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")
canonical_css = base64.b64decode("LyogTUZfQUlfU1RBTkRBTE9ORV9DQU5PTklDQUxfVjIKICAgT25lIGNhbm9uaWNhbCBwcmVzZW50YXRpb24gb3duZXIgZm9yIHRoZSBzdGFuZGFsb25lIEFJIEFuYWx5c2lzIG1vZHVsZS4KICAgVGhlIG1vZHVsZSBpcyBhIHNpbmdsZSBuYXRpdmUgPGRldGFpbHM+OyBubyBjbG9uZWQgcGFuZWwgb3Igb3ZlcmxheS4KKi8KLmFpLWFuYWx5c2lzLW1vZHVsZXsKICBncmlkLWNvbHVtbjoxLy0xIWltcG9ydGFudDsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgd2lkdGg6MTAwJSFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50OwogIGJvcmRlcjoxcHggc29saWQgcmdiYSg4NCwyMjEsMjU1LC4yMCkhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6MTZweCFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoCiAgICAxODBkZWcsCiAgICByZ2JhKDEyLDE4LDI1LC45NyksCiAgICByZ2JhKDgsMTIsMTcsLjk4KQogICkhaW1wb3J0YW50OwogIGJveC1zaGFkb3c6MCAxNHB4IDM2cHggcmdiYSgwLDAsMCwuMTgpIWltcG9ydGFudDsKICBvdmVyZmxvdzpoaWRkZW4haW1wb3J0YW50Cn0KCi5haS1hbmFseXNpcy1tb2R1bGU+c3VtbWFyeXsKICB3aWR0aDoxMDAlIWltcG9ydGFudDsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgbWluLWhlaWdodDo2NHB4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzoxMXB4IDE0cHghaW1wb3J0YW50OwogIGJvcmRlcjowIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnRyYW5zcGFyZW50IWltcG9ydGFudDsKICBkaXNwbGF5OmZsZXghaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAgZ2FwOjEycHghaW1wb3J0YW50OwogIGxpc3Qtc3R5bGU6bm9uZSFpbXBvcnRhbnQ7CiAgY3Vyc29yOnBvaW50ZXIhaW1wb3J0YW50OwogIGNvbG9yOnZhcigtLXRleHQpIWltcG9ydGFudDsKICAtd2Via2l0LXRhcC1oaWdobGlnaHQtY29sb3I6dHJhbnNwYXJlbnQhaW1wb3J0YW50Cn0KLmFpLWFuYWx5c2lzLW1vZHVsZT5zdW1tYXJ5Ojotd2Via2l0LWRldGFpbHMtbWFya2VyewogIGRpc3BsYXk6bm9uZSFpbXBvcnRhbnQKfQouYWktYW5hbHlzaXMtbW9kdWxlW29wZW5dPnN1bW1hcnl7CiAgYm9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tbGluZSkhaW1wb3J0YW50Cn0KCi5haS1hbmFseXNpcy10aXRsZXsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgZmxleDoxIDEgYXV0byFpbXBvcnRhbnQ7CiAgZGlzcGxheTpibG9jayFpbXBvcnRhbnQKfQouYWktYW5hbHlzaXMtdGl0bGUgc21hbGx7CiAgZGlzcGxheTpibG9jayFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAgMCA1cHghaW1wb3J0YW50OwogIGNvbG9yOnZhcigtLWN5YW4pIWltcG9ydGFudDsKICBmb250LXNpemU6OHB4IWltcG9ydGFudDsKICBsaW5lLWhlaWdodDoxIWltcG9ydGFudDsKICBmb250LXdlaWdodDo5MDAhaW1wb3J0YW50OwogIGxldHRlci1zcGFjaW5nOi4xNWVtIWltcG9ydGFudDsKICB0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2UhaW1wb3J0YW50Cn0KLmFpLWFuYWx5c2lzLXRpdGxlIGJ7CiAgZGlzcGxheTpibG9jayFpbXBvcnRhbnQ7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIG1hcmdpbjowIWltcG9ydGFudDsKICBjb2xvcjojZWVmNGY4IWltcG9ydGFudDsKICBmb250LXNpemU6MTVweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MS4xOCFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6ODIwIWltcG9ydGFudDsKICBsZXR0ZXItc3BhY2luZzotLjAyNWVtIWltcG9ydGFudDsKICB3aGl0ZS1zcGFjZTpub3dyYXAhaW1wb3J0YW50OwogIG92ZXJmbG93OmhpZGRlbiFpbXBvcnRhbnQ7CiAgdGV4dC1vdmVyZmxvdzplbGxpcHNpcyFpbXBvcnRhbnQKfQoKLmFpLWFuYWx5c2lzLWNoaXBzewogIG1pbi13aWR0aDowIWltcG9ydGFudDsKICBmbGV4OjAgMCBhdXRvIWltcG9ydGFudDsKICBkaXNwbGF5OmZsZXghaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAganVzdGlmeS1jb250ZW50OmZsZXgtZW5kIWltcG9ydGFudDsKICBnYXA6N3B4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQKfQouYWktYW5hbHlzaXMtY2hpcHMgZW17CiAgbWF4LXdpZHRoOjEzMHB4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzo2cHggOHB4IWltcG9ydGFudDsKICBib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOjk5OXB4IWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjAxOCkhaW1wb3J0YW50OwogIGNvbG9yOiM4ZjljYWMhaW1wb3J0YW50OwogIGZvbnQtc3R5bGU6bm9ybWFsIWltcG9ydGFudDsKICBmb250LXNpemU6OHB4IWltcG9ydGFudDsKICBsaW5lLWhlaWdodDoxIWltcG9ydGFudDsKICBmb250LXdlaWdodDo3NjAhaW1wb3J0YW50OwogIGxldHRlci1zcGFjaW5nOi4wN2VtIWltcG9ydGFudDsKICB0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2UhaW1wb3J0YW50OwogIHdoaXRlLXNwYWNlOm5vd3JhcCFpbXBvcnRhbnQ7CiAgb3ZlcmZsb3c6aGlkZGVuIWltcG9ydGFudDsKICB0ZXh0LW92ZXJmbG93OmVsbGlwc2lzIWltcG9ydGFudAp9Ci5haS1hbmFseXNpcy1jaGlwcyAjZGVjaXNpb25MYW5lewogIGJvcmRlci1jb2xvcjpyZ2JhKDg0LDIyMSwyNTUsLjE4KSFpbXBvcnRhbnQ7CiAgY29sb3I6I2FhYjhjNyFpbXBvcnRhbnQKfQouYWktZGF0YS12YWx7CiAgY29sb3I6dmFyKC0tY3lhbikhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OjkwMCFpbXBvcnRhbnQKfQoKLyogRXhhY3RseSBvbmUgbmF0aXZlIGNoZXZyb246IHJpZ2h0IGVkZ2Ugb25seS4gKi8KLmFpLWFuYWx5c2lzLW1vZHVsZT5zdW1tYXJ5OjphZnRlcnsKICBjb250ZW50OiLigLoiIWltcG9ydGFudDsKICB3aWR0aDoxOHB4IWltcG9ydGFudDsKICBoZWlnaHQ6MjJweCFpbXBvcnRhbnQ7CiAgZmxleDowIDAgMThweCFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50OwogIGRpc3BsYXk6aW5saW5lLWZsZXghaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAganVzdGlmeS1jb250ZW50OmNlbnRlciFpbXBvcnRhbnQ7CiAgY29sb3I6IzhmOWRhZCFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjIycHghaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OjEhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OjQwMCFpbXBvcnRhbnQ7CiAgdHJhbnNmb3JtOnJvdGF0ZSgwZGVnKSFpbXBvcnRhbnQ7CiAgdHJhbnNmb3JtLW9yaWdpbjpjZW50ZXIhaW1wb3J0YW50OwogIHRyYW5zaXRpb246dHJhbnNmb3JtIC4xNnMgZWFzZSFpbXBvcnRhbnQKfQouYWktYW5hbHlzaXMtbW9kdWxlW29wZW5dPnN1bW1hcnk6OmFmdGVyewogIHRyYW5zZm9ybTpyb3RhdGUoOTBkZWcpIWltcG9ydGFudAp9Ci5haS1hbmFseXNpcy1tb2R1bGU+c3VtbWFyeTpmb2N1cy12aXNpYmxlewogIG91dGxpbmU6MnB4IHNvbGlkIHZhcigtLWN5YW4pIWltcG9ydGFudDsKICBvdXRsaW5lLW9mZnNldDotMnB4IWltcG9ydGFudAp9CgouYWktYW5hbHlzaXMtYm9keXsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzoxM3B4IDE0cHggMTRweCFpbXBvcnRhbnQKfQouYWktYW5hbHlzaXMtbWV0YXsKICBtYXJnaW46MCAwIDEwcHghaW1wb3J0YW50OwogIGNvbG9yOnZhcigtLW11dGVkKSFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjlweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MS4zNSFpbXBvcnRhbnQKfQouYWktYW5hbHlzaXMtbW9kdWxlIC5yZWFzb257CiAgbWFyZ2luOjAgMCAxMnB4IWltcG9ydGFudAp9Ci5haS1hbmFseXNpcy1tb2R1bGUgI2RlY2lzaW9uVHJlZXsKICBtaW4taGVpZ2h0OjAhaW1wb3J0YW50OwogIGhlaWdodDphdXRvIWltcG9ydGFudDsKICBtYXJnaW46MCAwIDEycHghaW1wb3J0YW50OwogIGdyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoNixtaW5tYXgoMCwxZnIpKSFpbXBvcnRhbnQ7CiAgZ2FwOjZweCFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czoxMnB4IWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoNywxMiwxNywuNjQpIWltcG9ydGFudAp9CgouYWktYW5hbHlzaXMtbW9kdWxlIC5haS1hbmFseXNpcy10YWJzewogIGRpc3BsYXk6ZmxleCFpbXBvcnRhbnQ7CiAgZ2FwOjNweCFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50OwogIHBhZGRpbmc6NHB4IWltcG9ydGFudDsKICBib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOjEwcHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDEyKSFpbXBvcnRhbnQKfQouYWktYW5hbHlzaXMtbW9kdWxlIC5haS1hbmFseXNpcy10YWJzIC5pdGFiewogIG1pbi13aWR0aDowIWltcG9ydGFudDsKICBmbGV4OjEgMSAwIWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzo4cHggN3B4IWltcG9ydGFudDsKICBib3JkZXI6MCFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czo3cHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6dHJhbnNwYXJlbnQhaW1wb3J0YW50OwogIGNvbG9yOiM4MzkxYTIhaW1wb3J0YW50OwogIGZvbnQtc2l6ZTo5cHghaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OjEhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OjcwMCFpbXBvcnRhbnQKfQouYWktYW5hbHlzaXMtbW9kdWxlIC5haS1hbmFseXNpcy10YWJzIC5pdGFiLmFjdGl2ZXsKICBiYWNrZ3JvdW5kOnJnYmEoODQsMjIxLDI1NSwuMDY1KSFpbXBvcnRhbnQ7CiAgY29sb3I6I2VkZjVmOCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjAhaW1wb3J0YW50Cn0KLmFpLWFuYWx5c2lzLW1vZHVsZSAudGFiLXBhbmUuYWN0aXZlewogIHBhZGRpbmctdG9wOjEwcHghaW1wb3J0YW50Cn0KLmFpLWFuYWx5c2lzLW1vZHVsZSAubWlzc2lvbi1hY3Rpb25zewogIGRpc3BsYXk6Z3JpZCFpbXBvcnRhbnQ7CiAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCgzLG1pbm1heCgwLDFmcikpIWltcG9ydGFudDsKICBnYXA6N3B4IWltcG9ydGFudDsKICBtYXJnaW46MTJweCAwIDAhaW1wb3J0YW50Cn0KLmFpLWFuYWx5c2lzLW1vZHVsZSAubWlzc2lvbi1hY3Rpb25zIC5idG57CiAgd2lkdGg6MTAwJSFpbXBvcnRhbnQ7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50Cn0KCi8qIENvbXBhY3QgV0FJVElORyAvIENPTExFQ1RJTkcgc3RhdGUgcmV0YWluZWQsIGJ1dCBvd25lZCBieSB0aGlzIG1vZHVsZS4gKi8KLm1mLWFpLWNvbXBhY3Qtd2FpdGluZ3sKICBkaXNwbGF5Om5vbmU7CiAgcGFkZGluZzoxcHggMCAwCn0KLm1mLWFpLWNvbXBhY3QtY29weSBzbWFsbHsKICBkaXNwbGF5OmJsb2NrOwogIG1hcmdpbjowIDAgN3B4OwogIGNvbG9yOnZhcigtLWN5YW4pOwogIGZvbnQtc2l6ZTo4cHg7CiAgbGluZS1oZWlnaHQ6MTsKICBmb250LXdlaWdodDo5MDA7CiAgbGV0dGVyLXNwYWNpbmc6LjE0ZW07CiAgdGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlCn0KLm1mLWFpLWNvbXBhY3QtY29weSBzdHJvbmd7CiAgZGlzcGxheTpibG9jazsKICBjb2xvcjp2YXIoLS10ZXh0KTsKICBmb250LXNpemU6MTVweDsKICBsaW5lLWhlaWdodDoxLjI4OwogIGxldHRlci1zcGFjaW5nOi0uMDJlbQp9Ci5tZi1haS1jb21wYWN0LWNvcHkgcHsKICBtYXgtd2lkdGg6NjgwcHg7CiAgbWFyZ2luOjdweCAwIDEzcHg7CiAgY29sb3I6dmFyKC0tbXV0ZWQpOwogIGZvbnQtc2l6ZToxMHB4OwogIGxpbmUtaGVpZ2h0OjEuNQp9Ci5tZi1haS1jb21wYWN0LXN0YXR1c3sKICBib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1saW5lKQp9Ci5tZi1haS1jb21wYWN0LXN0YXR1cz5kaXZ7CiAgbWluLWhlaWdodDo0MHB4OwogIGRpc3BsYXk6ZmxleDsKICBhbGlnbi1pdGVtczpjZW50ZXI7CiAganVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47CiAgZ2FwOjE0cHg7CiAgYm9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tbGluZSkKfQoubWYtYWktY29tcGFjdC1zdGF0dXM+ZGl2Omxhc3QtY2hpbGR7CiAgYm9yZGVyLWJvdHRvbTowCn0KLm1mLWFpLWNvbXBhY3Qtc3RhdHVzIHNwYW57CiAgbWluLXdpZHRoOjA7CiAgY29sb3I6dmFyKC0tbXV0ZWQpOwogIGZvbnQtc2l6ZToxMHB4Cn0KLm1mLWFpLWNvbXBhY3Qtc3RhdHVzIGJ7CiAgZmxleDowIDAgYXV0bzsKICBjb2xvcjp2YXIoLS15ZWxsb3cpOwogIGZvbnQtc2l6ZTo5cHg7CiAgZm9udC13ZWlnaHQ6ODUwOwogIGxldHRlci1zcGFjaW5nOi4wNmVtCn0KCiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJ3YWl0aW5nIl0gLm1mLWFpLWNvbXBhY3Qtd2FpdGluZywKI2FpLWFuYWx5c2lzW2RhdGEtYWktdWktc3RhdGU9ImNvbGxlY3RpbmciXSAubWYtYWktY29tcGFjdC13YWl0aW5newogIGRpc3BsYXk6YmxvY2shaW1wb3J0YW50Cn0KI2FpLWFuYWx5c2lzW2RhdGEtYWktdWktc3RhdGU9IndhaXRpbmciXSAuYWktYW5hbHlzaXMtYm9keT46bm90KC5tZi1haS1jb21wYWN0LXdhaXRpbmcpLAojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0iY29sbGVjdGluZyJdIC5haS1hbmFseXNpcy1ib2R5Pjpub3QoLm1mLWFpLWNvbXBhY3Qtd2FpdGluZyl7CiAgZGlzcGxheTpub25lIWltcG9ydGFudAp9CiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJyZWFkeSJdIC5tZi1haS1jb21wYWN0LXdhaXRpbmcsCiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJibG9ja2VkIl0gLm1mLWFpLWNvbXBhY3Qtd2FpdGluZ3sKICBkaXNwbGF5Om5vbmUhaW1wb3J0YW50Cn0KCkBtZWRpYShtYXgtd2lkdGg6ODIwcHgpewogIC5haS1hbmFseXNpcy1tb2R1bGV7CiAgICBtYXJnaW4tdG9wOjEwcHghaW1wb3J0YW50OwogICAgYm9yZGVyLXJhZGl1czoxNXB4IWltcG9ydGFudDsKICAgIGJveC1zaGFkb3c6bm9uZSFpbXBvcnRhbnQKICB9CiAgLmFpLWFuYWx5c2lzLW1vZHVsZT5zdW1tYXJ5ewogICAgbWluLWhlaWdodDo1OHB4IWltcG9ydGFudDsKICAgIHBhZGRpbmc6MTBweCAxMnB4IWltcG9ydGFudDsKICAgIGdhcDo5cHghaW1wb3J0YW50CiAgfQogIC5haS1hbmFseXNpcy10aXRsZSBzbWFsbHsKICAgIG1hcmdpbi1ib3R0b206NHB4IWltcG9ydGFudDsKICAgIGZvbnQtc2l6ZTo3LjVweCFpbXBvcnRhbnQKICB9CiAgLmFpLWFuYWx5c2lzLXRpdGxlIGJ7CiAgICBmb250LXNpemU6MTNweCFpbXBvcnRhbnQKICB9CiAgLmFpLWFuYWx5c2lzLWNoaXBzewogICAgZ2FwOjAhaW1wb3J0YW50CiAgfQogIC5haS1hbmFseXNpcy1jaGlwcz5lbTpmaXJzdC1jaGlsZHsKICAgIGRpc3BsYXk6bm9uZSFpbXBvcnRhbnQKICB9CiAgLmFpLWFuYWx5c2lzLWNoaXBzICNkZWNpc2lvbkxhbmV7CiAgICBtYXgtd2lkdGg6ODhweCFpbXBvcnRhbnQ7CiAgICBwYWRkaW5nOjVweCA3cHghaW1wb3J0YW50OwogICAgZm9udC1zaXplOjhweCFpbXBvcnRhbnQKICB9CiAgLmFpLWFuYWx5c2lzLW1vZHVsZT5zdW1tYXJ5OjphZnRlcnsKICAgIHdpZHRoOjE2cHghaW1wb3J0YW50OwogICAgZmxleC1iYXNpczoxNnB4IWltcG9ydGFudDsKICAgIGZvbnQtc2l6ZToyMHB4IWltcG9ydGFudAogIH0KICAuYWktYW5hbHlzaXMtYm9keXsKICAgIHBhZGRpbmc6MTJweCFpbXBvcnRhbnQKICB9CiAgLm1mLWFpLWNvbXBhY3QtY29weSBzdHJvbmd7CiAgICBmb250LXNpemU6MTRweAogIH0KICAubWYtYWktY29tcGFjdC1jb3B5IHB7CiAgICBtYXJnaW4tYm90dG9tOjExcHg7CiAgICBmb250LXNpemU6MTBweAogIH0KICAubWYtYWktY29tcGFjdC1zdGF0dXM+ZGl2ewogICAgbWluLWhlaWdodDozOHB4CiAgfQogIC5haS1hbmFseXNpcy1tb2R1bGUgI2RlY2lzaW9uVHJlZXsKICAgIG1pbi1oZWlnaHQ6MCFpbXBvcnRhbnQ7CiAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDIsbWlubWF4KDAsMWZyKSkhaW1wb3J0YW50CiAgfQogIC5haS1hbmFseXNpcy1tb2R1bGUgLm1pc3Npb24tYWN0aW9uc3sKICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIhaW1wb3J0YW50CiAgfQp9").decode("utf-8")

style_count_before = len(re.findall(r"<style\b", src, flags=re.I))
script_count_before = len(re.findall(r"<script\b", src, flags=re.I))

# ---------------------------------------------------------------
# 1) Verify the exact current source objects.
# ---------------------------------------------------------------
if len(re.findall(r'<details\b[^>]*\bid=["\']ai-analysis["\']', src, flags=re.I)) != 1:
    raise SystemExit("Expected exactly one details#ai-analysis.")
if len(re.findall(r'<aside\b[^>]*\bid=["\']primary-candidate["\']', src, flags=re.I)) != 1:
    raise SystemExit("Expected exactly one aside#primary-candidate.")
for ident in ("decisionData","decisionLane","decisionTree","pane-evidence","pane-timeline","pane-memory"):
    if src.count(f'id="{ident}"') != 1:
        raise SystemExit(f"Expected exactly one #{ident}.")

# ---------------------------------------------------------------
# 2) Extract the ONE existing AI <details> from Primary Candidate.
#    No clone is created.
# ---------------------------------------------------------------
details_re = re.compile(
    r'<details\b(?=[^>]*\bid=["\']ai-analysis["\'])[^>]*>.*?</details>',
    flags=re.I | re.S
)
dm = details_re.search(src)
if not dm:
    raise SystemExit("Could not isolate details#ai-analysis.")

primary_open = re.search(
    r'<aside\b[^>]*\bid=["\']primary-candidate["\'][^>]*>',
    src,
    flags=re.I
)
primary_close_pos = src.find("</aside>", primary_open.end())
if primary_close_pos < 0:
    raise SystemExit("Could not locate closing </aside> for Primary Candidate.")

if not (primary_open.start() < dm.start() < primary_close_pos):
    raise SystemExit("details#ai-analysis is not currently owned by Primary Candidate; aborting.")

ai = dm.group(0)

# Rewrite only this element's structural ownership.
open_end = ai.find(">")
opening = ai[:open_end+1]

class_m = re.search(r'class=["\'][^"\']*["\']', opening, flags=re.I)
if not class_m:
    raise SystemExit("AI details class attribute not found.")
opening = (
    opening[:class_m.start()]
    + 'class="panel ai-analysis-module"'
    + opening[class_m.end():]
)
if 'data-mf-ai-module-v1=' not in opening:
    opening = opening[:-1] + ' data-mf-ai-module-v2="1">'

ai = opening + ai[open_end+1:]

# Remove the obsolete explicit LEFT chevron. The standalone module uses one
# right-edge native pseudo-chevron only.
chevron_re = re.compile(
    r'<span\b[^>]*\bclass=["\'][^"\']*\bai-analysis-chevron\b[^"\']*["\'][^>]*>'
    r'.*?</span>',
    flags=re.I | re.S
)
ai, chevron_removed = chevron_re.subn("", ai, count=1)
if chevron_removed != 1:
    raise SystemExit(f"Expected one explicit AI chevron; removed {chevron_removed}.")

# Remove Settings-panel ownership from the AI body.
ai, body_class_count = re.subn(
    r'class=["\']settings-group-body\s+ai-analysis-body["\']',
    'class="ai-analysis-body"',
    ai,
    count=1,
    flags=re.I
)
if body_class_count != 1:
    raise SystemExit("Expected one settings-group-body ai-analysis-body class.")

# Physically remove the original node.
src = src[:dm.start()] + src[dm.end():]

# Find Primary Candidate again after extraction and insert the SAME node
# immediately after </aside>, still inside mission-grid.
primary_open = re.search(
    r'<aside\b[^>]*\bid=["\']primary-candidate["\'][^>]*>',
    src,
    flags=re.I
)
primary_close_pos = src.find("</aside>", primary_open.end())
if primary_close_pos < 0:
    raise SystemExit("Primary Candidate close disappeared after extraction.")
insert_at = primary_close_pos + len("</aside>")
src = src[:insert_at] + "\n" + ai + src[insert_at:]

# ---------------------------------------------------------------
# 3) Remove old AI CSS by ACTUAL SELECTORS, not comments/line numbers.
#    This works even when prior clean patches changed comments/order.
#    Canonical V2 CSS is appended to the existing consolidated style.
# ---------------------------------------------------------------
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
    ".mf-ai-compact-waiting",
    ".mf-ai-compact-copy",
    ".mf-ai-compact-status",
    "#decisionTree",
)

def find_open(text, start):
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
        if not quote and text.startswith("/*", i):
            comment = True
            i += 2
            continue
        ch = text[i]
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
            i += 1
            continue
        if ch == "{":
            return i
        i += 1
    return -1

def find_close(text, open_index):
    depth = 1
    quote = None
    esc = False
    comment = False
    i = open_index + 1
    while i < len(text):
        if comment:
            if text.startswith("*/", i):
                comment = False
                i += 2
                continue
            i += 1
            continue
        if not quote and text.startswith("/*", i):
            comment = True
            i += 2
            continue
        ch = text[i]
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise SystemExit("Unbalanced CSS braces while cleaning AI rules.")

def clean_css(text):
    out = []
    pos = 0
    while pos < len(text):
        op = find_open(text, pos)
        if op < 0:
            out.append(text[pos:])
            break

        prelude = text[pos:op]
        close = find_close(text, op)
        body = text[op + 1:close]
        selector = re.sub(r"/\*.*?\*/", "", prelude, flags=re.S).strip()

        if selector.startswith("@"):
            out.append(prelude)
            out.append("{")
            out.append(clean_css(body))
            out.append("}")
        elif any(token in selector for token in AI_TOKENS):
            # Old AI presentation rule: deliberately removed.
            pass
        else:
            out.append(prelude)
            out.append("{")
            out.append(body)
            out.append("}")

        pos = close + 1
    return "".join(out)

style_re = re.compile(
    r'(<style\b(?P<attrs>[^>]*)>)(?P<body>.*?)(</style>)',
    flags=re.I | re.S
)
style_matches = list(style_re.finditer(src))
if not style_matches:
    raise SystemExit("No style blocks found.")

parts = []
last = 0
consolidated_seen = 0

for style_match in style_matches:
    parts.append(src[last:style_match.start()])
    opening_style = style_match.group(1)
    attrs = style_match.group("attrs")
    body = clean_css(style_match.group("body"))

    # Remove obsolete AI-only comments/markers left after rule cleanup.
    body = re.sub(
        r'/\*[^*]*(?:MF_AI_BUTTON_ALL_CHECKS_V1|MF_AI_ANALYSIS_COMPACT_BODY_V1|'
        r'AI Analysis & Market Data collapsible|'
        r'#decision-studio merged into #primary-candidate \.ai-analysis-section)'
        r'.*?\*/',
        '',
        body,
        flags=re.I | re.S
    )

    is_consolidated = bool(re.search(
        r'\bid=["\']memeflow-consolidated-css["\']',
        attrs,
        flags=re.I
    ))
    if is_consolidated:
        consolidated_seen += 1
        body = body.rstrip() + "\n\n" + canonical_css + "\n"

    parts.append(opening_style + body + "</style>")
    last = style_match.end()

parts.append(src[last:])
src = "".join(parts)

if consolidated_seen != 1:
    raise SystemExit(
        f"Expected exactly one memeflow-consolidated-css; found {consolidated_seen}."
    )

# ---------------------------------------------------------------
# 4) Verify single ownership and unchanged behavior surfaces.
# ---------------------------------------------------------------
style_count_after = len(re.findall(r"<style\b", src, flags=re.I))
script_count_after = len(re.findall(r"<script\b", src, flags=re.I))

# Recalculate structural positions.
ai_match = re.search(
    r'<details\b[^>]*\bid=["\']ai-analysis["\'][^>]*>',
    src,
    flags=re.I
)
primary_match = re.search(
    r'<aside\b[^>]*\bid=["\']primary-candidate["\'][^>]*>',
    src,
    flags=re.I
)
primary_end = src.find("</aside>", primary_match.end())

checks = {
    "style count did not increase": style_count_after <= style_count_before,
    "script count unchanged": script_count_after == script_count_before,
    "one AI details": len(re.findall(r'<details\b[^>]*\bid=["\']ai-analysis["\']', src, flags=re.I)) == 1,
    "one standalone marker": src.count('data-mf-ai-module-v2="1"') == 1,
    "AI outside Primary Candidate": ai_match.start() > primary_end,
    "old settings ownership removed": 'class="settings-group ai-analysis-section"' not in src,
    "old left chevron removed": "ai-analysis-chevron" not in src,
    "one canonical CSS owner": src.count("MF_AI_STANDALONE_CANONICAL_V2") == 1,
    "old AI button CSS marker removed": "MF_AI_BUTTON_ALL_CHECKS_V1" not in src,
    "old compact CSS marker removed": "MF_AI_ANALYSIS_COMPACT_BODY_V1" not in src,
    "decision data preserved": src.count('id="decisionData"') == 1,
    "decision lane preserved": src.count('id="decisionLane"') == 1,
    "decision tree preserved": src.count('id="decisionTree"') == 1,
    "Evidence preserved": src.count('id="pane-evidence"') == 1,
    "Timeline preserved": src.count('id="pane-timeline"') == 1,
    "Memory preserved": src.count('id="pane-memory"') == 1,
    "validate action preserved": src.count('id="validateBtn"') == 1,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Verification failed: " + ", ".join(failed))

path.write_text(src, encoding="utf-8")

print("AI Analysis standalone source rewrite prepared.")
print(f"<style> count: {style_count_before} -> {style_count_after}")
print(f"<script> count: {script_count_before} -> {script_count_after}")
print("AI node count: 1")
print("Explicit left chevrons removed: 1")
PY

grep -q 'data-mf-ai-module-v2="1"' "$WORK"
grep -q 'MF_AI_STANDALONE_CANONICAL_V2' "$WORK"
grep -q 'id="pane-evidence"' "$WORK"
grep -q 'id="decisionTree"' "$WORK"
! grep -q 'ai-analysis-chevron' "$WORK"
! grep -q 'MF_AI_BUTTON_ALL_CHECKS_V1' "$WORK"

cp "$WORK" "$INDEX"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
BACKUP=$BACKUP
EOF

rm -f "$WORK"
trap - ERR

echo
echo "OK: AI ANALYSIS STANDALONE MODULE V2 installed cleanly."
echo
echo "AI Analysis node: MOVED, NOT CLONED"
echo "Primary Candidate ownership: REMOVED"
echo "Standalone AI module owner: ONE"
echo "CSS discovery: SELECTOR-BASED (no comment markers)"
echo "Old AI CSS rules: REMOVED BY SELECTOR"
echo "New <style> layers: NONE"
echo "New <script> layers: NONE"
echo "Old left chevron: REMOVED"
echo "Right-edge chevron: ONE"
echo "Evidence / Timeline / Memory: PRESERVED"
echo "AI state controller: PRESERVED"
echo "AI evaluator / trading logic: UNCHANGED"
echo "Pre-trade logic: UNCHANGED"
echo
echo "Now Stop -> Run, hard-refresh, and send me a screenshot."
