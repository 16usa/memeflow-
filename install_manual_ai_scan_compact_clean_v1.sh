#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"
APP="$ROOT/memeflow-app"
[[ -f "$APP/index.html" ]] || APP="$ROOT"
INDEX="$APP/index.html"

[[ -f "$INDEX" ]] || { echo "ERROR: index.html not found."; exit 1; }

if grep -q 'MF_MANUAL_SCAN_COMPACT_V1' "$INDEX"; then
  echo "MANUAL AI SCAN COMPACT V1 is already installed."
  exit 0
fi

PATCH_DIR="$APP/.memeflow-patches/manual-ai-scan-compact-v1"
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
trap 'echo "ERROR: Manual AI Scan patch failed; restoring exact pre-install index.html."; rollback' ERR

python3 - "$WORK" <<'PY'
from pathlib import Path
import base64, re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")
canonical_css = base64.b64decode("LyogTUZfTUFOVUFMX1NDQU5fQ09NUEFDVF9WMQogICBDYW5vbmljYWwgTWFudWFsIEFJIFNjYW4gcHJlc2VudGF0aW9uLgogICBSZXBsYWNlcyB0aGUgcHJldmlvdXMgTWFudWFsIFNjYW4gc3R5bGVzaGVldCBpbiBwbGFjZS4KKi8KLm1hbnVhbC1haS1zY2FuewogIG1hcmdpbjowIDAgMTJweCFpbXBvcnRhbnQ7CiAgYm9yZGVyOjFweCBzb2xpZCByZ2JhKDk3LDIyMywyNTUsLjIyKSFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czoxNnB4IWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxODBkZWcscmdiYSgxMywxOSwyNywuOTYpLHJnYmEoOCwxMiwxNywuOTgpKSFpbXBvcnRhbnQ7CiAgYm94LXNoYWRvdzpub25lIWltcG9ydGFudDsKICBvdmVyZmxvdzpoaWRkZW4haW1wb3J0YW50Cn0KLm1hbnVhbC1haS1zY2FuLWhlYWR7CiAgZGlzcGxheTpmbGV4IWltcG9ydGFudDsKICBhbGlnbi1pdGVtczpjZW50ZXIhaW1wb3J0YW50OwogIGp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIWltcG9ydGFudDsKICBnYXA6MTJweCFpbXBvcnRhbnQ7CiAgbWluLXdpZHRoOjAhaW1wb3J0YW50OwogIHBhZGRpbmc6MTJweCAxNHB4IDExcHghaW1wb3J0YW50OwogIGJvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWxpbmUpIWltcG9ydGFudAp9Ci5tYW51YWwtYWktc2Nhbi1oZWFkPmRpdnttaW4td2lkdGg6MCFpbXBvcnRhbnR9Ci5tYW51YWwtYWktc2Nhbi1oZWFkIHNtYWxsewogIGRpc3BsYXk6YmxvY2shaW1wb3J0YW50OwogIG1hcmdpbjowIWltcG9ydGFudDsKICBjb2xvcjp2YXIoLS1jeWFuKSFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjhweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MSFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6OTAwIWltcG9ydGFudDsKICBsZXR0ZXItc3BhY2luZzouMTVlbSFpbXBvcnRhbnQ7CiAgdGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlIWltcG9ydGFudAp9Ci5tYW51YWwtYWktc2Nhbi1oZWFkIGgzewogIG1hcmdpbjo1cHggMCAwIWltcG9ydGFudDsKICBjb2xvcjp2YXIoLS10ZXh0KSFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjE5cHghaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OjEuMTUhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0Ojg1MCFpbXBvcnRhbnQ7CiAgbGV0dGVyLXNwYWNpbmc6LS4wMjVlbSFpbXBvcnRhbnQKfQoubWFudWFsLWFpLXNjYW4taGVhZCAuc3RhdGV7CiAgZmxleDowIDAgYXV0byFpbXBvcnRhbnQ7CiAgbWluLWhlaWdodDozMHB4IWltcG9ydGFudDsKICBoZWlnaHQ6MzBweCFpbXBvcnRhbnQ7CiAgcGFkZGluZzowIDEwcHghaW1wb3J0YW50OwogIGRpc3BsYXk6aW5saW5lLWZsZXghaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOmNlbnRlciFpbXBvcnRhbnQ7CiAganVzdGlmeS1jb250ZW50OmNlbnRlciFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czo5OTlweCFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOjhweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MSFpbXBvcnRhbnQ7CiAgbGV0dGVyLXNwYWNpbmc6LjEwZW0haW1wb3J0YW50Cn0KLm1hbnVhbC1haS1zY2FuLWJvZHl7CiAgbWluLWhlaWdodDowIWltcG9ydGFudDsKICBoZWlnaHQ6YXV0byFpbXBvcnRhbnQ7CiAgcGFkZGluZzoxMnB4IDE0cHggMTNweCFpbXBvcnRhbnQKfQoubWFudWFsLWFpLXNjYW4tZm9ybXsKICBkaXNwbGF5OmdyaWQhaW1wb3J0YW50OwogIGdyaWQtdGVtcGxhdGUtY29sdW1uczptaW5tYXgoMCwxZnIpIGF1dG8haW1wb3J0YW50OwogIGdhcDo4cHghaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOnN0cmV0Y2ghaW1wb3J0YW50OwogIG1hcmdpbjowIWltcG9ydGFudAp9Ci5tYW51YWwtYWktc2Nhbi1pbnB1dHsKICB3aWR0aDoxMDAlIWltcG9ydGFudDsKICBtaW4td2lkdGg6MCFpbXBvcnRhbnQ7CiAgaGVpZ2h0OjUwcHghaW1wb3J0YW50OwogIG1pbi1oZWlnaHQ6NTBweCFpbXBvcnRhbnQ7CiAgbWF4LWhlaWdodDo1MHB4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzowIDEzcHghaW1wb3J0YW50OwogIGJvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZTIpIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOjExcHghaW1wb3J0YW50OwogIGJhY2tncm91bmQ6cmdiYSgxNiwyMywzMiwuODIpIWltcG9ydGFudDsKICBjb2xvcjp2YXIoLS10ZXh0KSFpbXBvcnRhbnQ7CiAgZm9udDppbmhlcml0IWltcG9ydGFudDsKICBmb250LXNpemU6MTJweCFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6MSFpbXBvcnRhbnQ7CiAgb3V0bGluZTpub25lIWltcG9ydGFudDsKICBib3gtc2hhZG93Om5vbmUhaW1wb3J0YW50Cn0KLm1hbnVhbC1haS1zY2FuLWlucHV0OjpwbGFjZWhvbGRlcnsKICBjb2xvcjojODM5MWEyIWltcG9ydGFudDsKICBvcGFjaXR5OjEhaW1wb3J0YW50Cn0KLm1hbnVhbC1haS1zY2FuLWlucHV0OmZvY3VzewogIGJvcmRlci1jb2xvcjpyZ2JhKDk3LDIyMywyNTUsLjQ1KSFpbXBvcnRhbnQ7CiAgYm94LXNoYWRvdzowIDAgMCAycHggcmdiYSg5NywyMjMsMjU1LC4wNikhaW1wb3J0YW50Cn0KI21hbnVhbEFpU3VibWl0ewogIG1pbi13aWR0aDoxNTBweCFpbXBvcnRhbnQ7CiAgbWluLWhlaWdodDo1MHB4IWltcG9ydGFudDsKICBoZWlnaHQ6NTBweCFpbXBvcnRhbnQ7CiAgbWF4LWhlaWdodDo1MHB4IWltcG9ydGFudDsKICBtYXJnaW46MCFpbXBvcnRhbnQ7CiAgcGFkZGluZzowIDE2cHghaW1wb3J0YW50OwogIGJvcmRlcjoxcHggc29saWQgcmdiYSg4NCwyMjEsMjU1LC4yOCkhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6MTFweCFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTgwZGVnLHJnYmEoODQsMjIxLDI1NSwuMDk1KSxyZ2JhKDg0LDIyMSwyNTUsLjAzNSkpLHJnYmEoMTMsMTksMjcsLjk0KSFpbXBvcnRhbnQ7CiAgY29sb3I6I2Y0ZjhmYiFpbXBvcnRhbnQ7CiAgYm94LXNoYWRvdzppbnNldCAwIDFweCAwIHJnYmEoMjU1LDI1NSwyNTUsLjAzNSkhaW1wb3J0YW50OwogIGZvbnQtc2l6ZToxMC41cHghaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OjEhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OjgyMCFpbXBvcnRhbnQ7CiAgbGV0dGVyLXNwYWNpbmc6LjAxZW0haW1wb3J0YW50Cn0KI21hbnVhbEFpU3VibWl0OmhvdmVyLAojbWFudWFsQWlTdWJtaXQ6Zm9jdXMtdmlzaWJsZXsKICBib3JkZXItY29sb3I6cmdiYSg4NCwyMjEsMjU1LC40OCkhaW1wb3J0YW50OwogIGJhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE4MGRlZyxyZ2JhKDg0LDIyMSwyNTUsLjEzKSxyZ2JhKDg0LDIyMSwyNTUsLjA1KSkscmdiYSgxMywxOSwyNywuOTYpIWltcG9ydGFudDsKICBvdXRsaW5lOm5vbmUhaW1wb3J0YW50Cn0KI21hbnVhbEFpU3VibWl0OmRpc2FibGVkewogIG9wYWNpdHk6LjU0IWltcG9ydGFudDsKICBjdXJzb3I6ZGVmYXVsdCFpbXBvcnRhbnQKfQoubWFudWFsLWFpLXNjYW4taGludHsKICBtYXJnaW46OXB4IDJweCAwIWltcG9ydGFudDsKICBwYWRkaW5nOjAhaW1wb3J0YW50OwogIGNvbG9yOiM4MzkxYTIhaW1wb3J0YW50OwogIGZvbnQtc2l6ZTo5cHghaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OjEuNDUhaW1wb3J0YW50Cn0KLm1hbnVhbC1haS1yZXN1bHR7CiAgZGlzcGxheTpub25lOwogIG1hcmdpbi10b3A6MTJweDsKICBwYWRkaW5nLXRvcDoxMnB4OwogIGJvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWxpbmUpCn0KLm1hbnVhbC1haS1yZXN1bHQuc2hvd3tkaXNwbGF5OmJsb2NrfQoubWFudWFsLWFpLXJlc3VsdC10b3B7CiAgZGlzcGxheTpncmlkOwogIGdyaWQtdGVtcGxhdGUtY29sdW1uczptaW5tYXgoMCwxZnIpIGF1dG87CiAgZ2FwOjEycHg7CiAgYWxpZ24taXRlbXM6c3RhcnQKfQoubWFudWFsLWFpLXRva2VuIHNtYWxse2NvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTBweH0KLm1hbnVhbC1haS10b2tlbiBiewogIGRpc3BsYXk6YmxvY2s7CiAgbWFyZ2luLXRvcDoycHg7CiAgZm9udC1zaXplOjIzcHg7CiAgbGV0dGVyLXNwYWNpbmc6LS4wM2VtCn0KLm1hbnVhbC1haS1zY29yZXt0ZXh0LWFsaWduOnJpZ2h0fQoubWFudWFsLWFpLXNjb3JlIHN0cm9uZ3sKICBkaXNwbGF5OmJsb2NrOwogIGZvbnQtc2l6ZTozOHB4OwogIGxpbmUtaGVpZ2h0OjE7CiAgZm9udC12YXJpYW50LW51bWVyaWM6dGFidWxhci1udW1zCn0KLm1hbnVhbC1haS1zY29yZSBzbWFsbHtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjlweH0KLm1hbnVhbC1haS1zdGF0ZXsKICBkaXNwbGF5OmlubGluZS1mbGV4OwogIGFsaWduLWl0ZW1zOmNlbnRlcjsKICBnYXA6N3B4OwogIG1hcmdpbi10b3A6OXB4OwogIHBhZGRpbmc6N3B4IDEwcHg7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lMik7CiAgYm9yZGVyLXJhZGl1czo5OTlweDsKICBmb250LXNpemU6MTBweDsKICBmb250LXdlaWdodDo5MDA7CiAgbGV0dGVyLXNwYWNpbmc6LjA4ZW0KfQoubWFudWFsLWFpLXN0YXRlLmJ1eXsKICBjb2xvcjp2YXIoLS1ncmVlbik7CiAgYm9yZGVyLWNvbG9yOnJnYmEoODgsMjI4LDE3MywuMzgpOwogIGJhY2tncm91bmQ6cmdiYSg4OCwyMjgsMTczLC4wNykKfQoubWFudWFsLWFpLXN0YXRlLndhaXR7CiAgY29sb3I6dmFyKC0teWVsbG93KTsKICBib3JkZXItY29sb3I6cmdiYSgyNDIsMTk4LDEwNCwuMzIpOwogIGJhY2tncm91bmQ6cmdiYSgyNDIsMTk4LDEwNCwuMDYpCn0KLm1hbnVhbC1haS1zdGF0ZS5ibG9ja3sKICBjb2xvcjp2YXIoLS1yZWQpOwogIGJvcmRlci1jb2xvcjpyZ2JhKDI1NSwxMDgsMTIzLC4zNCk7CiAgYmFja2dyb3VuZDpyZ2JhKDI1NSwxMDgsMTIzLC4wNikKfQoubWFudWFsLWFpLW1ldHJpY3N7CiAgZGlzcGxheTpncmlkOwogIGdyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoNCxtaW5tYXgoMCwxZnIpKTsKICBnYXA6N3B4OwogIG1hcmdpbi10b3A6MTJweAp9Ci5tYW51YWwtYWktbWV0cmljewogIG1pbi13aWR0aDowOwogIHBhZGRpbmc6MTBweDsKICBib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpOwogIGJvcmRlci1yYWRpdXM6MTFweDsKICBiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjAxOCkKfQoubWFudWFsLWFpLW1ldHJpYyBzbWFsbHsKICBkaXNwbGF5OmJsb2NrOwogIGNvbG9yOnZhcigtLW11dGVkKTsKICBmb250LXNpemU6OHB4OwogIGxldHRlci1zcGFjaW5nOi4wOGVtOwogIHRleHQtdHJhbnNmb3JtOnVwcGVyY2FzZQp9Ci5tYW51YWwtYWktbWV0cmljIGJ7CiAgZGlzcGxheTpibG9jazsKICBtYXJnaW4tdG9wOjVweDsKICBmb250LXNpemU6MTJweDsKICBvdmVyZmxvdzpoaWRkZW47CiAgdGV4dC1vdmVyZmxvdzplbGxpcHNpcwp9Ci5tYW51YWwtYWktcmVhc29uc3sKICBtYXJnaW4tdG9wOjExcHg7CiAgcGFkZGluZzoxMXB4IDEycHg7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTsKICBib3JkZXItcmFkaXVzOjExcHg7CiAgYmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4wMTgpCn0KLm1hbnVhbC1haS1yZWFzb25zIGJ7ZGlzcGxheTpibG9jaztmb250LXNpemU6MTFweH0KLm1hbnVhbC1haS1yZWFzb25zIGRpdnsKICBtYXJnaW4tdG9wOjZweDsKICBjb2xvcjp2YXIoLS1tdXRlZCk7CiAgZm9udC1zaXplOjEwcHg7CiAgbGluZS1oZWlnaHQ6MS41Cn0KLm1hbnVhbC1haS1zZXR0aW5nc3sKICBtYXJnaW4tdG9wOjlweDsKICBjb2xvcjp2YXIoLS1tdXRlZCk7CiAgZm9udC1zaXplOjlweDsKICBsaW5lLWhlaWdodDoxLjQ1Cn0KLm1hbnVhbC1haS1saW5rc3sKICBkaXNwbGF5OmdyaWQ7CiAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCgzLDFmcik7CiAgZ2FwOjdweDsKICBtYXJnaW4tdG9wOjExcHgKfQoubWFudWFsLWFpLWxpbmtzIGF7CiAgZGlzcGxheTpmbGV4OwogIGFsaWduLWl0ZW1zOmNlbnRlcjsKICBqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyOwogIG1pbi1oZWlnaHQ6NDBweDsKICBib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUyKTsKICBib3JkZXItcmFkaXVzOjEwcHg7CiAgY29sb3I6dmFyKC0tdGV4dCk7CiAgdGV4dC1kZWNvcmF0aW9uOm5vbmU7CiAgZm9udC1zaXplOjEwcHg7CiAgZm9udC13ZWlnaHQ6ODAwCn0KLm1hbnVhbC1haS1lcnJvcnsKICBkaXNwbGF5Om5vbmU7CiAgbWFyZ2luLXRvcDo5cHg7CiAgcGFkZGluZzo5cHggMTFweDsKICBib3JkZXI6MXB4IHNvbGlkIHJnYmEoMjU1LDEwOCwxMjMsLjMpOwogIGJvcmRlci1yYWRpdXM6MTBweDsKICBiYWNrZ3JvdW5kOnJnYmEoMjU1LDEwOCwxMjMsLjA2KTsKICBjb2xvcjojZmY5OGE1OwogIGZvbnQtc2l6ZToxMHB4OwogIGxpbmUtaGVpZ2h0OjEuNDUKfQoubWFudWFsLWFpLWVycm9yLnNob3d7ZGlzcGxheTpibG9ja30KCkBtZWRpYShtYXgtd2lkdGg6NjIwcHgpewogIC5tYW51YWwtYWktc2NhbnsKICAgIG1hcmdpbjowIDAgMTBweCFpbXBvcnRhbnQ7CiAgICBib3JkZXItcmFkaXVzOjE1cHghaW1wb3J0YW50CiAgfQogIC5tYW51YWwtYWktc2Nhbi1oZWFkewogICAgcGFkZGluZzoxMXB4IDEzcHggMTBweCFpbXBvcnRhbnQKICB9CiAgLm1hbnVhbC1haS1zY2FuLWhlYWQgaDN7CiAgICBmb250LXNpemU6MThweCFpbXBvcnRhbnQKICB9CiAgLm1hbnVhbC1haS1zY2FuLWhlYWQgLnN0YXRlewogICAgbWluLWhlaWdodDoyOHB4IWltcG9ydGFudDsKICAgIGhlaWdodDoyOHB4IWltcG9ydGFudDsKICAgIHBhZGRpbmc6MCA5cHghaW1wb3J0YW50OwogICAgZm9udC1zaXplOjcuNXB4IWltcG9ydGFudAogIH0KICAubWFudWFsLWFpLXNjYW4tYm9keXsKICAgIG1pbi1oZWlnaHQ6MCFpbXBvcnRhbnQ7CiAgICBoZWlnaHQ6YXV0byFpbXBvcnRhbnQ7CiAgICBwYWRkaW5nOjExcHggMTNweCAxMnB4IWltcG9ydGFudAogIH0KICAubWFudWFsLWFpLXNjYW4tZm9ybXsKICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIhaW1wb3J0YW50OwogICAgZ2FwOjhweCFpbXBvcnRhbnQKICB9CiAgLm1hbnVhbC1haS1zY2FuLWlucHV0ewogICAgaGVpZ2h0OjUwcHghaW1wb3J0YW50OwogICAgbWluLWhlaWdodDo1MHB4IWltcG9ydGFudDsKICAgIG1heC1oZWlnaHQ6NTBweCFpbXBvcnRhbnQ7CiAgICBmb250LXNpemU6MTEuNXB4IWltcG9ydGFudAogIH0KICAjbWFudWFsQWlTdWJtaXR7CiAgICB3aWR0aDoxMDAlIWltcG9ydGFudDsKICAgIG1pbi13aWR0aDowIWltcG9ydGFudDsKICAgIGhlaWdodDo1MHB4IWltcG9ydGFudDsKICAgIG1pbi1oZWlnaHQ6NTBweCFpbXBvcnRhbnQ7CiAgICBtYXgtaGVpZ2h0OjUwcHghaW1wb3J0YW50CiAgfQogIC5tYW51YWwtYWktc2Nhbi1oaW50ewogICAgbWFyZ2luLXRvcDo5cHghaW1wb3J0YW50OwogICAgZm9udC1zaXplOjlweCFpbXBvcnRhbnQ7CiAgICBsaW5lLWhlaWdodDoxLjQyIWltcG9ydGFudAogIH0KICAubWFudWFsLWFpLW1ldHJpY3N7CiAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDIsMWZyKQogIH0KICAubWFudWFsLWFpLWxpbmtzewogICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCgzLDFmcikKICB9Cn0KQG1lZGlhKG1heC13aWR0aDozOTBweCl7CiAgLm1hbnVhbC1haS1zY2FuLWhlYWR7CiAgICBnYXA6OXB4IWltcG9ydGFudDsKICAgIHBhZGRpbmctbGVmdDoxMnB4IWltcG9ydGFudDsKICAgIHBhZGRpbmctcmlnaHQ6MTJweCFpbXBvcnRhbnQKICB9CiAgLm1hbnVhbC1haS1zY2FuLWhlYWQgaDN7CiAgICBmb250LXNpemU6MTdweCFpbXBvcnRhbnQKICB9CiAgLm1hbnVhbC1haS1zY2FuLWJvZHl7CiAgICBwYWRkaW5nLWxlZnQ6MTJweCFpbXBvcnRhbnQ7CiAgICBwYWRkaW5nLXJpZ2h0OjEycHghaW1wb3J0YW50CiAgfQp9").decode("utf-8")

style_before = len(re.findall(r"<style\b", src, flags=re.I))
script_before = len(re.findall(r"<script\b", src, flags=re.I))

required_counts = {
    'MEMEFLOW_MANUAL_SCAN_STYLE': src.count('id="MEMEFLOW_MANUAL_SCAN_STYLE"'),
    'MEMEFLOW_MANUAL_SCAN_V1': src.count('id="MEMEFLOW_MANUAL_SCAN_V1"'),
    'manualAiMint': src.count('id="manualAiMint"'),
    'manualAiSubmit': src.count('id="manualAiSubmit"'),
}
bad = [f"{k}={v}" for k,v in required_counts.items() if v != 1]
if bad:
    raise SystemExit("Unexpected Manual Scan ownership: " + ", ".join(bad))

style_re = re.compile(
    r'(<style\s+id=["\']MEMEFLOW_MANUAL_SCAN_STYLE["\']>).*?(</style>)',
    flags=re.I | re.S
)
matches = list(style_re.finditer(src))
if len(matches) != 1:
    raise SystemExit(f"Expected one Manual Scan style block, found {len(matches)}.")

m = matches[0]
src = src[:m.start()] + m.group(1) + "\n" + canonical_css + "\n" + m.group(2) + src[m.end():]

orphan_re = re.compile(
    r'\s*<button\b[^>]*\bid=["\']mfManualAiButton["\'][^>]*>.*?</button>\s*',
    flags=re.I | re.S
)
src, orphan_count = orphan_re.subn("\n", src, count=1)
if orphan_count != 1:
    raise SystemExit(f"Expected one orphan mfManualAiButton, removed {orphan_count}.")

old_hint = (
    "Uses the same MEMEFLOW AI evaluator and your current\n"
    "          Settings. Manual scans never enter the automatic\n"
    "          Candidate Feed and never execute a trade."
)
new_hint = (
    "Analysis only · uses your current Settings · never enters "
    "Candidate Feed · never executes a trade."
)
if old_hint not in src:
    raise SystemExit("Current Manual Scan safety hint was not found.")
src = src.replace(old_hint, new_hint, 1)

style_after = len(re.findall(r"<style\b", src, flags=re.I))
script_after = len(re.findall(r"<script\b", src, flags=re.I))

checks = {
    "style count unchanged": style_after == style_before,
    "script count unchanged": script_after == script_before,
    "canonical marker": src.count("MF_MANUAL_SCAN_COMPACT_V1") == 1,
    "one manual style": src.count('id="MEMEFLOW_MANUAL_SCAN_STYLE"') == 1,
    "one manual script": src.count('id="MEMEFLOW_MANUAL_SCAN_V1"') == 1,
    "one input": src.count('id="manualAiMint"') == 1,
    "one submit": src.count('id="manualAiSubmit"') == 1,
    "orphan removed": "mfManualAiButton" not in src,
    "API preserved": "/api/manual/analyze" in src,
    "submit handler preserved": "addEventListener('submit', analyze)" in src,
    "analyze preserved": "async function analyze(event)" in src,
    "result renderer preserved": "function renderResult(d)" in src,
    "scanning preserved": "button.textContent = 'Scanning…';" in src,
    "restore text preserved": "button.textContent = 'Analyze token';" in src,
}
failed = [k for k,v in checks.items() if not v]
if failed:
    raise SystemExit("Verification failed: " + ", ".join(failed))

path.write_text(src, encoding="utf-8")
print(f"Source rewrite prepared. <style>: {style_before}->{style_after}; <script>: {script_before}->{script_after}")
PY

grep -q 'MF_MANUAL_SCAN_COMPACT_V1' "$WORK"
grep -q '/api/manual/analyze' "$WORK"
grep -q "async function analyze(event)" "$WORK"
! grep -q 'mfManualAiButton' "$WORK"

cp "$WORK" "$INDEX"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
BACKUP=$BACKUP
EOF

rm -f "$WORK"
trap - ERR

echo
echo "OK: MANUAL AI SCAN COMPACT V1 installed cleanly."
echo "Existing Manual Scan <style>: REPLACED IN PLACE"
echo "New <style> layers: NONE"
echo "New JavaScript layers: NONE"
echo "Orphan Open AI assistant form button: REMOVED"
echo "/api/manual/analyze logic: UNCHANGED"
echo "Analyze submit handler: UNCHANGED"
echo "Result renderer: UNCHANGED"
echo "Trading / Candidate Feed logic: UNCHANGED"
echo
echo "Mobile: compact header + 50px input + 50px graphite/cyan button + compact safety note."
echo "Now Stop -> Run, hard-refresh, and send me a screenshot."
