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

if grep -q 'data-mf-ai-module-v3="1"' "$INDEX"; then
  echo "AI ANALYSIS FULL MODULE V3 is already installed."
  exit 0
fi

# V3 deliberately upgrades the exact standalone architecture already installed.
if ! grep -q 'data-mf-ai-module-v2="1"' "$INDEX"; then
  echo "ERROR: standalone AI V2 marker not found."
  echo "Nothing changed. Install V2 first or send me the current Shell output."
  exit 1
fi

PATCH_DIR="$APP/.memeflow-patches/ai-analysis-full-module-v3"
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
trap 'echo "ERROR: AI Full Module V3 failed; restoring exact pre-install index.html."; rollback' ERR

python3 - "$WORK" <<'PY'
from pathlib import Path
import base64, re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")
canonical_css = base64.b64decode("LyogTUZfQUlfRlVMTF9NT0RVTEVfQ0FOT05JQ0FMX1YzCiAgIEZ1bGwgbW9kdWxhciBwcmVzZW50YXRpb24gZm9yIHRoZSBzaW5nbGUgZXhpc3RpbmcgI2FpLWFuYWx5c2lzIG5vZGUuCiAgIE5vIGR1cGxpY2F0ZWQgSFRNTCwgbm8gb3ZlcmxheSwgbm8gcnVudGltZSBzdHlsZSBpbmplY3Rpb24uCiovCi5haS1hbmFseXNpcy1tb2R1bGV7CiAgZ3JpZC1jb2x1bW46MS8tMSFpbXBvcnRhbnQ7CiAgcG9zaXRpb246cmVsYXRpdmUhaW1wb3J0YW50OwogIG1pbi13aWR0aDowIWltcG9ydGFudDsKICB3aWR0aDoxMDAlIWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjFweCBzb2xpZCByZ2JhKDQxLDU3LDc0LC43OCkhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6MThweCFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTgwZGVnLHJnYmEoMTQsMjAsMjgsLjk2KSxyZ2JhKDgsMTIsMTcsLjk4KSkhaW1wb3J0YW50OwogIGJveC1zaGFkb3c6MCAyMHB4IDU0cHggcmdiYSgwLDAsMCwuMjQpIWltcG9ydGFudDsKICBvdmVyZmxvdzpoaWRkZW4haW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGU6OmJlZm9yZXsKICBjb250ZW50OiIiIWltcG9ydGFudDsKICBwb3NpdGlvbjphYnNvbHV0ZSFpbXBvcnRhbnQ7CiAgei1pbmRleDoyIWltcG9ydGFudDsKICBsZWZ0OjAhaW1wb3J0YW50OwogIHJpZ2h0OjAhaW1wb3J0YW50OwogIHRvcDowIWltcG9ydGFudDsKICBoZWlnaHQ6MnB4IWltcG9ydGFudDsKICBwb2ludGVyLWV2ZW50czpub25lIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCg5MGRlZyx2YXIoLS1jeWFuKSxyZ2JhKDg0LDIyMSwyNTUsLjE2KSA0OCUsdHJhbnNwYXJlbnQgNzglKSFpbXBvcnRhbnQ7Cn0KCi5haS1hbmFseXNpcy1tb2R1bGU+c3VtbWFyeXsKICBwb3NpdGlvbjpyZWxhdGl2ZSFpbXBvcnRhbnQ7CiAgei1pbmRleDoxIWltcG9ydGFudDsKICB3aWR0aDoxMDAlIWltcG9ydGFudDsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgbWluLWhlaWdodDo3OHB4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzoxNXB4IDE2cHggMTRweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjAhaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDA2KSFpbXBvcnRhbnQ7CiAgZGlzcGxheTpncmlkIWltcG9ydGFudDsKICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6bWlubWF4KDAsMWZyKSBhdXRvIGF1dG8haW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAgZ2FwOjEycHghaW1wb3J0YW50OwogIGxpc3Qtc3R5bGU6bm9uZSFpbXBvcnRhbnQ7CiAgY3Vyc29yOnBvaW50ZXIhaW1wb3J0YW50OwogIGNvbG9yOnZhcigtLXRleHQpIWltcG9ydGFudDsKICAtd2Via2l0LXRhcC1oaWdobGlnaHQtY29sb3I6dHJhbnNwYXJlbnQhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGU+c3VtbWFyeTo6LXdlYmtpdC1kZXRhaWxzLW1hcmtlcntkaXNwbGF5Om5vbmUhaW1wb3J0YW50fQouYWktYW5hbHlzaXMtbW9kdWxlW29wZW5dPnN1bW1hcnl7CiAgYm9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tbGluZSkhaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDEyKSFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLW1vZHVsZT5zdW1tYXJ5OmZvY3VzLXZpc2libGV7CiAgb3V0bGluZToycHggc29saWQgdmFyKC0tY3lhbikhaW1wb3J0YW50OwogIG91dGxpbmUtb2Zmc2V0Oi0ycHghaW1wb3J0YW50Owp9CgouYWktYW5hbHlzaXMtdGl0bGV7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIGRpc3BsYXk6YmxvY2shaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy10aXRsZSBzbWFsbHsKICBkaXNwbGF5OmJsb2NrIWltcG9ydGFudDsKICBtYXJnaW46MCAwIDZweCFpbXBvcnRhbnQ7CiAgY29sb3I6dmFyKC0tY3lhbikhaW1wb3J0YW50OwogIGZvbnQtc2l6ZTo4cHghaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OjEhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OjkwMCFpbXBvcnRhbnQ7CiAgbGV0dGVyLXNwYWNpbmc6LjE2ZW0haW1wb3J0YW50OwogIHRleHQtdHJhbnNmb3JtOnVwcGVyY2FzZSFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLXRpdGxlIGJ7CiAgZGlzcGxheTpibG9jayFpbXBvcnRhbnQ7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIG1hcmdpbjowIWltcG9ydGFudDsKICBjb2xvcjojZjFmNWY4IWltcG9ydGFudDsKICBmb250LXNpemU6MTdweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MS4xOCFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6ODUwIWltcG9ydGFudDsKICBsZXR0ZXItc3BhY2luZzotLjAyOGVtIWltcG9ydGFudDsKICB3aGl0ZS1zcGFjZTpub3dyYXAhaW1wb3J0YW50OwogIG92ZXJmbG93OmhpZGRlbiFpbXBvcnRhbnQ7CiAgdGV4dC1vdmVyZmxvdzplbGxpcHNpcyFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLXRpdGxlOjphZnRlcnsKICBjb250ZW50OiJEZWNpc2lvbiBpbnRlbGxpZ2VuY2UgwrcgTWFya2V0IGV2aWRlbmNlIMK3IEhvbGRlciBxdWFsaXR5IiFpbXBvcnRhbnQ7CiAgZGlzcGxheTpibG9jayFpbXBvcnRhbnQ7CiAgbWF4LXdpZHRoOjYyMHB4IWltcG9ydGFudDsKICBtYXJnaW4tdG9wOjVweCFpbXBvcnRhbnQ7CiAgY29sb3I6IzdmOGQ5ZSFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjlweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MS4zNSFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6NjAwIWltcG9ydGFudDsKICBsZXR0ZXItc3BhY2luZzouMDA1ZW0haW1wb3J0YW50OwogIHdoaXRlLXNwYWNlOm5vd3JhcCFpbXBvcnRhbnQ7CiAgb3ZlcmZsb3c6aGlkZGVuIWltcG9ydGFudDsKICB0ZXh0LW92ZXJmbG93OmVsbGlwc2lzIWltcG9ydGFudDsKfQoKLmFpLWFuYWx5c2lzLWNoaXBzewogIG1pbi13aWR0aDowIWltcG9ydGFudDsKICBkaXNwbGF5OmZsZXghaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAganVzdGlmeS1jb250ZW50OmZsZXgtZW5kIWltcG9ydGFudDsKICBnYXA6NnB4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLWNoaXBzIGVtewogIG1heC13aWR0aDoxNTBweCFpbXBvcnRhbnQ7CiAgbWluLWhlaWdodDoyOHB4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzowIDlweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lMikhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6OTk5cHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDE4KSFpbXBvcnRhbnQ7CiAgZGlzcGxheTppbmxpbmUtZmxleCFpbXBvcnRhbnQ7CiAgYWxpZ24taXRlbXM6Y2VudGVyIWltcG9ydGFudDsKICBqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyIWltcG9ydGFudDsKICBjb2xvcjojODk5N2E3IWltcG9ydGFudDsKICBmb250LXN0eWxlOm5vcm1hbCFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjhweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MSFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6ODIwIWltcG9ydGFudDsKICBsZXR0ZXItc3BhY2luZzouMDhlbSFpbXBvcnRhbnQ7CiAgdGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlIWltcG9ydGFudDsKICB3aGl0ZS1zcGFjZTpub3dyYXAhaW1wb3J0YW50OwogIG92ZXJmbG93OmhpZGRlbiFpbXBvcnRhbnQ7CiAgdGV4dC1vdmVyZmxvdzplbGxpcHNpcyFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLWNoaXBzPmVtOmZpcnN0LWNoaWxkewogIGNvbG9yOiM3ZjhkOWUhaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSg4NCwyMjEsMjU1LC4wMjUpIWltcG9ydGFudDsKICBib3JkZXItY29sb3I6cmdiYSg4NCwyMjEsMjU1LC4xNSkhaW1wb3J0YW50Owp9Ci5haS1kYXRhLXZhbHtjb2xvcjp2YXIoLS1jeWFuKSFpbXBvcnRhbnQ7Zm9udC13ZWlnaHQ6OTUwIWltcG9ydGFudH0KLmFpLWFuYWx5c2lzLW1vZHVsZVtkYXRhLWFpLXVpLXN0YXRlPSJ3YWl0aW5nIl0gI2RlY2lzaW9uTGFuZXsKICBjb2xvcjp2YXIoLS15ZWxsb3cpIWltcG9ydGFudDsKICBib3JkZXItY29sb3I6cmdiYSgyNDYsMTk5LDk1LC4zMCkhaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgyNDYsMTk5LDk1LC4wNikhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGVbZGF0YS1haS11aS1zdGF0ZT0iY29sbGVjdGluZyJdICNkZWNpc2lvbkxhbmV7CiAgY29sb3I6dmFyKC0tY3lhbikhaW1wb3J0YW50OwogIGJvcmRlci1jb2xvcjpyZ2JhKDg0LDIyMSwyNTUsLjMwKSFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDg0LDIyMSwyNTUsLjA2KSFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLW1vZHVsZVtkYXRhLWFpLXVpLXN0YXRlPSJyZWFkeSJdICNkZWNpc2lvbkxhbmV7CiAgY29sb3I6dmFyKC0tZ3JlZW4pIWltcG9ydGFudDsKICBib3JkZXItY29sb3I6cmdiYSg4MSwyMzEsMTY4LC4zNCkhaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSg4MSwyMzEsMTY4LC4wNykhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGVbZGF0YS1haS11aS1zdGF0ZT0iYmxvY2tlZCJdICNkZWNpc2lvbkxhbmV7CiAgY29sb3I6dmFyKC0tcmVkKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLWNvbG9yOnJnYmEoMjU1LDEwMSwxMTgsLjM0KSFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDI1NSwxMDEsMTE4LC4wNykhaW1wb3J0YW50Owp9CgovKiBPbmUgbmF0aXZlIGNoZXZyb24sIGZhciByaWdodC4gKi8KLmFpLWFuYWx5c2lzLW1vZHVsZT5zdW1tYXJ5OjphZnRlcnsKICBjb250ZW50OiLigLoiIWltcG9ydGFudDsKICB3aWR0aDoxOHB4IWltcG9ydGFudDsKICBoZWlnaHQ6MjRweCFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50OwogIGRpc3BsYXk6aW5saW5lLWZsZXghaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAganVzdGlmeS1jb250ZW50OmNlbnRlciFpbXBvcnRhbnQ7CiAgY29sb3I6IzhkOWFhYSFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjIzcHghaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OjEhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OjQwMCFpbXBvcnRhbnQ7CiAgdHJhbnNmb3JtOnJvdGF0ZSgwZGVnKSFpbXBvcnRhbnQ7CiAgdHJhbnNmb3JtLW9yaWdpbjpjZW50ZXIhaW1wb3J0YW50OwogIHRyYW5zaXRpb246dHJhbnNmb3JtIC4xNnMgZWFzZSFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLW1vZHVsZVtvcGVuXT5zdW1tYXJ5OjphZnRlcnsKICB0cmFuc2Zvcm06cm90YXRlKDkwZGVnKSFpbXBvcnRhbnQ7Cn0KCi8qIEZ1bGwgbW9kdWxlIGJvZHkgKi8KLmFpLWFuYWx5c2lzLWJvZHl7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIHBhZGRpbmc6MTRweCAxNnB4IDE2cHghaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tZXRhewogIG1hcmdpbjowIDAgMTBweCFpbXBvcnRhbnQ7CiAgY29sb3I6dmFyKC0tbXV0ZWQpIWltcG9ydGFudDsKICBmb250LXNpemU6OXB4IWltcG9ydGFudDsKICBsaW5lLWhlaWdodDoxLjQhaW1wb3J0YW50Owp9CgovKiBXQUlUSU5HIC8gQ09MTEVDVElORzogb25lIHN0YXR1cyBjYXJkICsgdGhyZWUgcmVhbCByZWFkaW5lc3MgdGlsZXMuICovCi5tZi1haS1jb21wYWN0LXdhaXRpbmd7CiAgZGlzcGxheTpub25lOwogIGdyaWQtdGVtcGxhdGUtY29sdW1uczptaW5tYXgoMCwxLjM1ZnIpIG1pbm1heCgzMTBweCwuNjVmcik7CiAgZ2FwOjEwcHg7CiAgYWxpZ24taXRlbXM6c3RyZXRjaDsKfQoubWYtYWktY29tcGFjdC1jb3B5ewogIG1pbi13aWR0aDowOwogIHBhZGRpbmc6MTRweCAxNXB4OwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7CiAgYm9yZGVyLXJhZGl1czoxM3B4OwogIGJhY2tncm91bmQ6CiAgICByYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGF0IDAgMCxyZ2JhKDg0LDIyMSwyNTUsLjA1NSksdHJhbnNwYXJlbnQgNDUlKSwKICAgIHJnYmEoNywxMSwxNiwuNjYpOwp9Ci5tZi1haS1jb21wYWN0LWNvcHkgc21hbGx7CiAgZGlzcGxheTpibG9jazsKICBtYXJnaW46MCAwIDdweDsKICBjb2xvcjp2YXIoLS1jeWFuKTsKICBmb250LXNpemU6OHB4OwogIGxpbmUtaGVpZ2h0OjE7CiAgZm9udC13ZWlnaHQ6OTAwOwogIGxldHRlci1zcGFjaW5nOi4xNWVtOwogIHRleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTsKfQoubWYtYWktY29tcGFjdC1jb3B5IHN0cm9uZ3sKICBkaXNwbGF5OmJsb2NrOwogIGNvbG9yOiNlZWY0Zjg7CiAgZm9udC1zaXplOjE3cHg7CiAgbGluZS1oZWlnaHQ6MS4yNDsKICBmb250LXdlaWdodDo4NDA7CiAgbGV0dGVyLXNwYWNpbmc6LS4wMjVlbTsKfQoubWYtYWktY29tcGFjdC1jb3B5IHB7CiAgbWF4LXdpZHRoOjY4MHB4OwogIG1hcmdpbjo3cHggMCAwOwogIGNvbG9yOiM4OTk3YTc7CiAgZm9udC1zaXplOjEwLjVweDsKICBsaW5lLWhlaWdodDoxLjUyOwp9Ci5tZi1haS1jb21wYWN0LXN0YXR1c3sKICBkaXNwbGF5OmdyaWQ7CiAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcjsKICBnYXA6NnB4OwogIGJvcmRlcjowOwp9Ci5tZi1haS1jb21wYWN0LXN0YXR1cz5kaXZ7CiAgbWluLXdpZHRoOjA7CiAgbWluLWhlaWdodDo0OHB4OwogIHBhZGRpbmc6OXB4IDExcHg7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTsKICBib3JkZXItcmFkaXVzOjExcHg7CiAgYmFja2dyb3VuZDpyZ2JhKDcsMTEsMTYsLjY4KTsKICBkaXNwbGF5OmZsZXg7CiAgYWxpZ24taXRlbXM6Y2VudGVyOwogIGp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuOwogIGdhcDoxMnB4Owp9Ci5tZi1haS1jb21wYWN0LXN0YXR1cyBzcGFuewogIG1pbi13aWR0aDowOwogIGNvbG9yOiM4NDkyYTM7CiAgZm9udC1zaXplOjlweDsKICBsaW5lLWhlaWdodDoxLjI1Owp9Ci5tZi1haS1jb21wYWN0LXN0YXR1cyBiewogIGZsZXg6MCAwIGF1dG87CiAgY29sb3I6dmFyKC0teWVsbG93KTsKICBmb250LXNpemU6MTBweDsKICBsaW5lLWhlaWdodDoxOwogIGZvbnQtd2VpZ2h0Ojg4MDsKICBsZXR0ZXItc3BhY2luZzouMDRlbTsKfQojYWktYW5hbHlzaXNbZGF0YS1haS11aS1zdGF0ZT0id2FpdGluZyJdIC5tZi1haS1jb21wYWN0LXdhaXRpbmcsCiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJjb2xsZWN0aW5nIl0gLm1mLWFpLWNvbXBhY3Qtd2FpdGluZ3sKICBkaXNwbGF5OmdyaWQhaW1wb3J0YW50Owp9CiNhaS1hbmFseXNpc1tkYXRhLWFpLXVpLXN0YXRlPSJ3YWl0aW5nIl0gLmFpLWFuYWx5c2lzLWJvZHk+Om5vdCgubWYtYWktY29tcGFjdC13YWl0aW5nKSwKI2FpLWFuYWx5c2lzW2RhdGEtYWktdWktc3RhdGU9ImNvbGxlY3RpbmciXSAuYWktYW5hbHlzaXMtYm9keT46bm90KC5tZi1haS1jb21wYWN0LXdhaXRpbmcpewogIGRpc3BsYXk6bm9uZSFpbXBvcnRhbnQ7Cn0KI2FpLWFuYWx5c2lzW2RhdGEtYWktdWktc3RhdGU9InJlYWR5Il0gLm1mLWFpLWNvbXBhY3Qtd2FpdGluZywKI2FpLWFuYWx5c2lzW2RhdGEtYWktdWktc3RhdGU9ImJsb2NrZWQiXSAubWYtYWktY29tcGFjdC13YWl0aW5newogIGRpc3BsYXk6bm9uZSFpbXBvcnRhbnQ7Cn0KCi8qIFJFQURZIC8gQkxPQ0tFRDogY29uY2x1c2lvbiBjYXJkLCBkZWNpc2lvbiBwYXRoLCBzZWdtZW50ZWQgZXZpZGVuY2Ugd29ya3NwYWNlLiAqLwouYWktYW5hbHlzaXMtbW9kdWxlIC5yZWFzb257CiAgbWFyZ2luOjAgMCAxMHB4IWltcG9ydGFudDsKICBwYWRkaW5nOjEzcHggMTRweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLWxlZnQ6M3B4IHNvbGlkIHZhcigtLXllbGxvdykhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6MTJweCFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDI0NiwxOTksOTUsLjA0NSkhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLnJlYXNvbi5ncmVlbnsKICBib3JkZXItbGVmdC1jb2xvcjp2YXIoLS1ncmVlbikhaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSg4MSwyMzEsMTY4LC4wNDUpIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlIC5yZWFzb24uY3lhbnsKICBib3JkZXItbGVmdC1jb2xvcjp2YXIoLS1jeWFuKSFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDg0LDIyMSwyNTUsLjA0NSkhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLnJlYXNvbi5yZWR7CiAgYm9yZGVyLWxlZnQtY29sb3I6dmFyKC0tcmVkKSFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDI1NSwxMDEsMTE4LC4wNDUpIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlIC5yZWFzb24gYnsKICBjb2xvcjojZWRmM2Y3IWltcG9ydGFudDsKICBmb250LXNpemU6MTFweCFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLW1vZHVsZSAucmVhc29uIHNwYW57CiAgbWFyZ2luLXRvcDo1cHghaW1wb3J0YW50OwogIGNvbG9yOiM4ZDlhYWEhaW1wb3J0YW50OwogIGZvbnQtc2l6ZToxMHB4IWltcG9ydGFudDsKICBsaW5lLWhlaWdodDoxLjQ4IWltcG9ydGFudDsKfQoKLmFpLWFuYWx5c2lzLW1vZHVsZSAjZGVjaXNpb25UcmVlewogIG1pbi1oZWlnaHQ6MCFpbXBvcnRhbnQ7CiAgaGVpZ2h0OmF1dG8haW1wb3J0YW50OwogIG1hcmdpbjowIDAgMTBweCFpbXBvcnRhbnQ7CiAgcGFkZGluZzoxMHB4IWltcG9ydGFudDsKICBkaXNwbGF5OmdyaWQhaW1wb3J0YW50OwogIGdyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoNixtaW5tYXgoMCwxZnIpKSFpbXBvcnRhbnQ7CiAgZ2FwOjZweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czoxM3B4IWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOnJnYmEoNywxMSwxNiwuNjApIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlICNkZWNpc2lvblRyZWU6ZW1wdHl7CiAgZGlzcGxheTpub25lIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlICNkZWNpc2lvblRyZWUgLnRyZWUtbm9kZXsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgbWluLWhlaWdodDo0OHB4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzo4cHggNnB4IWltcG9ydGFudDsKICBkaXNwbGF5OmZsZXghaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAganVzdGlmeS1jb250ZW50OmNlbnRlciFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czo5cHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDE0KSFpbXBvcnRhbnQ7Cn0KCi5haS1hbmFseXNpcy1tb2R1bGUgLmFpLWFuYWx5c2lzLXRhYnN7CiAgZGlzcGxheTpncmlkIWltcG9ydGFudDsKICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDMsMWZyKSFpbXBvcnRhbnQ7CiAgZ2FwOjRweCFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50OwogIHBhZGRpbmc6NHB4IWltcG9ydGFudDsKICBib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOjExcHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSg3LDExLDE2LC42NSkhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLmFpLWFuYWx5c2lzLXRhYnMgLml0YWJ7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIG1pbi1oZWlnaHQ6MzhweCFpbXBvcnRhbnQ7CiAgbWFyZ2luOjAhaW1wb3J0YW50OwogIHBhZGRpbmc6MCA4cHghaW1wb3J0YW50OwogIGJvcmRlcjowIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOjhweCFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDp0cmFuc3BhcmVudCFpbXBvcnRhbnQ7CiAgY29sb3I6IzdmOGQ5ZSFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjlweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MSFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6NzYwIWltcG9ydGFudDsKICB0cmFuc2Zvcm06bm9uZSFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLW1vZHVsZSAuYWktYW5hbHlzaXMtdGFicyAuaXRhYi5hY3RpdmV7CiAgYmFja2dyb3VuZDpyZ2JhKDg0LDIyMSwyNTUsLjA3NSkhaW1wb3J0YW50OwogIGNvbG9yOiNlZWY1ZjghaW1wb3J0YW50OwogIGJveC1zaGFkb3c6aW5zZXQgMCAwIDAgMXB4IHJnYmEoODQsMjIxLDI1NSwuMTQpIWltcG9ydGFudDsKfQouYWktYW5hbHlzaXMtbW9kdWxlIC50YWItcGFuZXsKICBtYXJnaW4tdG9wOjEwcHghaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLnRhYi1wYW5lLmFjdGl2ZXsKICBwYWRkaW5nOjEycHghaW1wb3J0YW50OwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSkhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6MTJweCFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpyZ2JhKDcsMTEsMTYsLjU0KSFpbXBvcnRhbnQ7Cn0KLmFpLWFuYWx5c2lzLW1vZHVsZSAudGFiLXBhbmUgLmRhdGEtcm93Omxhc3QtY2hpbGR7CiAgYm9yZGVyLWJvdHRvbTowIWltcG9ydGFudDsKfQoKLmFpLWFuYWx5c2lzLW1vZHVsZSAubWlzc2lvbi1hY3Rpb25zewogIGRpc3BsYXk6Z3JpZCFpbXBvcnRhbnQ7CiAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCgzLG1pbm1heCgwLDFmcikpIWltcG9ydGFudDsKICBnYXA6N3B4IWltcG9ydGFudDsKICBtYXJnaW46MTBweCAwIDAhaW1wb3J0YW50Owp9Ci5haS1hbmFseXNpcy1tb2R1bGUgLm1pc3Npb24tYWN0aW9ucyAuYnRuewogIHdpZHRoOjEwMCUhaW1wb3J0YW50OwogIG1pbi13aWR0aDowIWltcG9ydGFudDsKICBtaW4taGVpZ2h0OjQycHghaW1wb3J0YW50OwogIG1hcmdpbjowIWltcG9ydGFudDsKfQoKQG1lZGlhKG1heC13aWR0aDo4MjBweCl7CiAgLmFpLWFuYWx5c2lzLW1vZHVsZXsKICAgIGJvcmRlci1yYWRpdXM6MThweCFpbXBvcnRhbnQ7CiAgICBib3gtc2hhZG93Om5vbmUhaW1wb3J0YW50OwogIH0KICAuYWktYW5hbHlzaXMtbW9kdWxlPnN1bW1hcnl7CiAgICBtaW4taGVpZ2h0Ojc0cHghaW1wb3J0YW50OwogICAgcGFkZGluZzoxM3B4IDE0cHghaW1wb3J0YW50OwogICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOm1pbm1heCgwLDFmcikgYXV0byBhdXRvIWltcG9ydGFudDsKICAgIGdhcDo5cHghaW1wb3J0YW50OwogIH0KICAuYWktYW5hbHlzaXMtdGl0bGUgc21hbGx7CiAgICBtYXJnaW4tYm90dG9tOjVweCFpbXBvcnRhbnQ7CiAgICBmb250LXNpemU6Ny41cHghaW1wb3J0YW50OwogIH0KICAuYWktYW5hbHlzaXMtdGl0bGUgYnsKICAgIGZvbnQtc2l6ZToxNHB4IWltcG9ydGFudDsKICB9CiAgLmFpLWFuYWx5c2lzLXRpdGxlOjphZnRlcnsKICAgIG1heC13aWR0aDozOTBweCFpbXBvcnRhbnQ7CiAgICBtYXJnaW4tdG9wOjRweCFpbXBvcnRhbnQ7CiAgICBmb250LXNpemU6OHB4IWltcG9ydGFudDsKICB9CiAgLmFpLWFuYWx5c2lzLWNoaXBzPmVtOmZpcnN0LWNoaWxkewogICAgZGlzcGxheTpub25lIWltcG9ydGFudDsKICB9CiAgLmFpLWFuYWx5c2lzLWNoaXBzICNkZWNpc2lvbkxhbmV7CiAgICBtYXgtd2lkdGg6OTZweCFpbXBvcnRhbnQ7CiAgICBtaW4taGVpZ2h0OjI3cHghaW1wb3J0YW50OwogICAgcGFkZGluZzowIDhweCFpbXBvcnRhbnQ7CiAgICBmb250LXNpemU6OHB4IWltcG9ydGFudDsKICB9CiAgLmFpLWFuYWx5c2lzLW1vZHVsZT5zdW1tYXJ5OjphZnRlcnsKICAgIHdpZHRoOjE2cHghaW1wb3J0YW50OwogICAgZm9udC1zaXplOjIxcHghaW1wb3J0YW50OwogIH0KICAuYWktYW5hbHlzaXMtYm9keXsKICAgIHBhZGRpbmc6MTJweCAxM3B4IDEzcHghaW1wb3J0YW50OwogIH0KICAubWYtYWktY29tcGFjdC13YWl0aW5newogICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciFpbXBvcnRhbnQ7CiAgICBnYXA6OHB4IWltcG9ydGFudDsKICB9CiAgLm1mLWFpLWNvbXBhY3QtY29weXsKICAgIHBhZGRpbmc6MTNweCFpbXBvcnRhbnQ7CiAgfQogIC5tZi1haS1jb21wYWN0LWNvcHkgc3Ryb25newogICAgZm9udC1zaXplOjE1cHghaW1wb3J0YW50OwogIH0KICAubWYtYWktY29tcGFjdC1jb3B5IHB7CiAgICBmb250LXNpemU6MTBweCFpbXBvcnRhbnQ7CiAgfQogIC5tZi1haS1jb21wYWN0LXN0YXR1c3sKICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMyxtaW5tYXgoMCwxZnIpKSFpbXBvcnRhbnQ7CiAgICBnYXA6NnB4IWltcG9ydGFudDsKICB9CiAgLm1mLWFpLWNvbXBhY3Qtc3RhdHVzPmRpdnsKICAgIG1pbi1oZWlnaHQ6NjJweCFpbXBvcnRhbnQ7CiAgICBwYWRkaW5nOjlweCFpbXBvcnRhbnQ7CiAgICBkaXNwbGF5OmdyaWQhaW1wb3J0YW50OwogICAgYWxpZ24tY29udGVudDpjZW50ZXIhaW1wb3J0YW50OwogICAganVzdGlmeS1jb250ZW50OnN0cmV0Y2ghaW1wb3J0YW50OwogICAgZ2FwOjdweCFpbXBvcnRhbnQ7CiAgfQogIC5tZi1haS1jb21wYWN0LXN0YXR1cyBzcGFuewogICAgZm9udC1zaXplOjhweCFpbXBvcnRhbnQ7CiAgfQogIC5tZi1haS1jb21wYWN0LXN0YXR1cyBiewogICAgZm9udC1zaXplOjEwcHghaW1wb3J0YW50OwogIH0KICAuYWktYW5hbHlzaXMtbW9kdWxlICNkZWNpc2lvblRyZWV7CiAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDIsbWlubWF4KDAsMWZyKSkhaW1wb3J0YW50OwogIH0KICAuYWktYW5hbHlzaXMtbW9kdWxlIC5taXNzaW9uLWFjdGlvbnN7CiAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIWltcG9ydGFudDsKICB9Cn0KQG1lZGlhKG1heC13aWR0aDo0MzBweCl7CiAgLmFpLWFuYWx5c2lzLW1vZHVsZT5zdW1tYXJ5ewogICAgbWluLWhlaWdodDo3MnB4IWltcG9ydGFudDsKICAgIHBhZGRpbmc6MTJweCFpbXBvcnRhbnQ7CiAgfQogIC5haS1hbmFseXNpcy10aXRsZSBiewogICAgZm9udC1zaXplOjEzLjVweCFpbXBvcnRhbnQ7CiAgfQogIC5haS1hbmFseXNpcy10aXRsZTo6YWZ0ZXJ7CiAgICBtYXgtd2lkdGg6MjUwcHghaW1wb3J0YW50OwogIH0KICAubWYtYWktY29tcGFjdC1zdGF0dXN7CiAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIWltcG9ydGFudDsKICB9CiAgLm1mLWFpLWNvbXBhY3Qtc3RhdHVzPmRpdnsKICAgIG1pbi1oZWlnaHQ6NDJweCFpbXBvcnRhbnQ7CiAgICBkaXNwbGF5OmZsZXghaW1wb3J0YW50OwogIH0KfQ==").decode("utf-8")

style_before = len(re.findall(r"<style\b", src, flags=re.I))
script_before = len(re.findall(r"<script\b", src, flags=re.I))

# ---- exact single-node / logic-contract checks ----
if len(re.findall(r'<details\b[^>]*\bid=["\']ai-analysis["\']', src, flags=re.I)) != 1:
    raise SystemExit("Expected exactly one details#ai-analysis.")

for ident in (
    "decisionData","decisionLane","decisionTree",
    "pane-evidence","pane-timeline","pane-memory","validateBtn",
    "mfAiCompactKicker","mfAiCompactTitle","mfAiCompactText",
    "mfAiCompactCompleteness","mfAiCompactMarket","mfAiCompactHolders"
):
    if src.count(f'id="{ident}"') != 1:
        raise SystemExit(f"Expected exactly one #{ident}; source does not match installed V2.")

if src.count('data-mf-ai-module-v2="1"') != 1:
    raise SystemExit("Expected exactly one V2 module marker.")

# Upgrade only the structural version marker. Node/class/IDs stay the same.
src = src.replace('data-mf-ai-module-v2="1"', 'data-mf-ai-module-v3="1"', 1)

# ---- remove every old AI presentation owner by selector ----
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

def find_close(text, op):
    depth = 1
    quote = None
    esc = False
    comment = False
    i = op + 1
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
    raise SystemExit("Unbalanced CSS while consolidating AI module.")

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
        body = text[op+1:close]
        selector = re.sub(r"/\*.*?\*/", "", prelude, flags=re.S).strip()

        if selector.startswith("@"):
            cleaned = clean_css(body)
            meaningful = re.sub(r"/\*.*?\*/", "", cleaned, flags=re.S).strip()
            if meaningful:
                out.append(prelude)
                out.append("{")
                out.append(cleaned)
                out.append("}")
        elif any(token in selector for token in AI_TOKENS):
            # Old AI presentation owner: removed instead of overridden.
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

for sm in style_matches:
    parts.append(src[last:sm.start()])
    opening = sm.group(1)
    attrs = sm.group("attrs")
    body = clean_css(sm.group("body"))

    # Remove old AI-only marker comments left after rule deletion.
    body = re.sub(
        r'/\*.*?(?:MF_AI_STANDALONE_CANONICAL_V2|MF_AI_STANDALONE_MODULE_V1|'
        r'MF_AI_BUTTON_ALL_CHECKS_V1|MF_AI_ANALYSIS_COMPACT_BODY_V1|'
        r'AI Analysis & Market Data).*?\*/',
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

    meaningful = re.sub(r'/\*.*?\*/', '', body, flags=re.S).strip()
    if meaningful or is_consolidated:
        parts.append(opening + body + "</style>")

    last = sm.end()

parts.append(src[last:])
src = "".join(parts)

if consolidated_seen != 1:
    raise SystemExit(
        f"Expected exactly one memeflow-consolidated-css; found {consolidated_seen}."
    )

# ---- final verification ----
style_after = len(re.findall(r"<style\b", src, flags=re.I))
script_after = len(re.findall(r"<script\b", src, flags=re.I))

checks = {
    "style count did not increase": style_after <= style_before,
    "script count unchanged": script_after == script_before,
    "one AI node": len(re.findall(r'<details\b[^>]*\bid=["\']ai-analysis["\']', src, flags=re.I)) == 1,
    "one V3 marker": src.count('data-mf-ai-module-v3="1"') == 1,
    "V2 marker removed": 'data-mf-ai-module-v2="1"' not in src,
    "one canonical V3 CSS": src.count("MF_AI_FULL_MODULE_CANONICAL_V3") == 1,
    "old V2 CSS removed": "MF_AI_STANDALONE_CANONICAL_V2" not in src,
    "standalone class preserved": 'class="panel ai-analysis-module"' in src,
    "decision data preserved": src.count('id="decisionData"') == 1,
    "decision lane preserved": src.count('id="decisionLane"') == 1,
    "decision tree preserved": src.count('id="decisionTree"') == 1,
    "Evidence preserved": src.count('id="pane-evidence"') == 1,
    "Timeline preserved": src.count('id="pane-timeline"') == 1,
    "Memory preserved": src.count('id="pane-memory"') == 1,
    "Validate preserved": src.count('id="validateBtn"') == 1,
    "waiting UI preserved": src.count('id="mfAiCompactTitle"') == 1,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Verification failed: " + ", ".join(failed))

path.write_text(src, encoding="utf-8")

print("AI Full Module V3 source consolidation prepared.")
print(f"<style> count: {style_before} -> {style_after}")
print(f"<script> count: {script_before} -> {script_after}")
print("AI node count: 1")
print("AI logic IDs preserved: PASS")
PY

grep -q 'data-mf-ai-module-v3="1"' "$WORK"
grep -q 'MF_AI_FULL_MODULE_CANONICAL_V3' "$WORK"
grep -q 'id="decisionTree"' "$WORK"
grep -q 'id="pane-evidence"' "$WORK"
grep -q 'id="validateBtn"' "$WORK"
! grep -q 'data-mf-ai-module-v2="1"' "$WORK"
! grep -q 'MF_AI_STANDALONE_CANONICAL_V2' "$WORK"

cp "$WORK" "$INDEX"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
BACKUP=$BACKUP
EOF

rm -f "$WORK"
trap - ERR

echo
echo "OK: AI ANALYSIS FULL MODULE V3 installed cleanly."
echo
echo "AI node: ONE / EXISTING NODE PRESERVED"
echo "Standalone placement: PRESERVED"
echo "Old V2 AI CSS: REMOVED"
echo "Canonical V3 AI CSS owner: ONE"
echo "New <style> layers: NONE"
echo "New <script> layers: NONE"
echo "Runtime style injection: NONE"
echo "Decision / Evidence / Timeline / Memory IDs: PRESERVED"
echo "WAITING / COLLECTING / READY / BLOCKED state contract: PRESERVED"
echo "AI evaluator logic: UNCHANGED"
echo "Pre-trade logic: UNCHANGED"
echo "Trading logic: UNCHANGED"
echo
echo "Now Stop -> Run, hard-refresh, and send me the closed + open module screenshots."
