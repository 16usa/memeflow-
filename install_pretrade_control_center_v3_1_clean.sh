#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"
APP="$ROOT/memeflow-app"

if [[ ! -f "$APP/index.html" && -f "$ROOT/index.html" ]]; then
  APP="$ROOT"
fi

INDEX="$APP/index.html"
PAPER_UI="$APP/paper-automation-ui.js"
MODULE="$APP/pretrade-control-center-v3.js"

if [[ ! -f "$INDEX" || ! -f "$PAPER_UI" ]]; then
  echo "ERROR: expected index.html and paper-automation-ui.js were not found."
  echo "Run this installer from ~/workspace."
  exit 1
fi

if ! grep -q 'data-mf-pretrade-v2="1"' "$INDEX"; then
  if grep -q 'data-mf-pretrade-v3="1"' "$INDEX"; then
    echo "PRE-TRADE CONTROL CENTER V3 is already installed."
    exit 0
  fi
  echo "ERROR: PRE-TRADE V2 source marker was not found."
  echo "This patch refuses to guess against a different source."
  exit 1
fi

PATCH_DIR="$APP/.memeflow-patches/pretrade-control-center-v3"
mkdir -p "$PATCH_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

INDEX_BAK="$PATCH_DIR/index.html.$STAMP.bak"
PAPER_BAK="$PATCH_DIR/paper-automation-ui.js.$STAMP.bak"
cp "$INDEX" "$INDEX_BAK"
cp "$PAPER_UI" "$PAPER_BAK"

MODULE_EXISTED=0
MODULE_BAK=""
if [[ -f "$MODULE" ]]; then
  MODULE_EXISTED=1
  MODULE_BAK="$PATCH_DIR/pretrade-control-center-v3.js.$STAMP.bak"
  cp "$MODULE" "$MODULE_BAK"
fi

WORK_INDEX="$PATCH_DIR/index.html.$STAMP.work"
WORK_PAPER="$PATCH_DIR/paper-automation-ui.js.$STAMP.work"
WORK_MODULE="$PATCH_DIR/pretrade-control-center-v3.js.$STAMP.work"
INLINE_CHECK="$PATCH_DIR/pretrade-inline.$STAMP.js"

cp "$INDEX" "$WORK_INDEX"
cp "$PAPER_UI" "$WORK_PAPER"

rollback() {
  cp "$INDEX_BAK" "$INDEX" 2>/dev/null || true
  cp "$PAPER_BAK" "$PAPER_UI" 2>/dev/null || true
  if [[ "$MODULE_EXISTED" == "1" && -n "$MODULE_BAK" ]]; then
    cp "$MODULE_BAK" "$MODULE" 2>/dev/null || true
  else
    rm -f "$MODULE"
  fi
  rm -f "${WORK_INDEX:-}" "${WORK_PAPER:-}" "${WORK_MODULE:-}" "${INLINE_CHECK:-}"
}
trap 'echo "ERROR: installation failed; restoring original files."; rollback' ERR

printf '%s' 'KCgpID0+IHsKICAndXNlIHN0cmljdCc7CgogIGlmICh3aW5kb3cuX19NRU1FRkxPV19QUkVUUkFERV9DT05UUk9MX0NFTlRFUl9WM19fKSByZXR1cm47CiAgd2luZG93Ll9fTUVNRUZMT1dfUFJFVFJBREVfQ09OVFJPTF9DRU5URVJfVjNfXyA9IHRydWU7CgogIGNvbnN0ICQgPSBzZWxlY3RvciA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTsKICBjb25zdCBIQVJEX1BBUEVSX0NPREVTID0gbmV3IFNldChbCiAgICAnUE9TSVRJT05fRVhJU1RTJywKICAgICdNQVhfT1BFTl9QT1NJVElPTlMnLAogICAgJ01BWF9EQUlMWV9FTlRSSUVTJywKICAgICdJTlZBTElEX1BPU0lUSU9OX1NJWkUnLAogICAgJ0RBSUxZX1NQRU5EX0xJTUlUJywKICAgICdQQVBFUl9DQVBJVEFMX0xJTUlUJywKICAgICdLSUxMX1NXSVRDSCcsCiAgICAnREFJTFlfTE9TU19MSU1JVCcKICBdKTsKCiAgbGV0IHJlZnJlc2hHZW5lcmF0aW9uID0gMDsKICBsZXQgcmVmcmVzaFRpbWVyID0gbnVsbDsKICBsZXQgbGFzdFBheWxvYWQgPSBudWxsOwoKICBmdW5jdGlvbiBjYW5kaWRhdGUoKSB7CiAgICB0cnkgewogICAgICByZXR1cm4gd2luZG93Lk1FTUVGTE9XX0NPUkU/LmdldFNlbGVjdGVkPy4oKSB8fCBudWxsOwogICAgfSBjYXRjaCB7CiAgICAgIHJldHVybiBudWxsOwogICAgfQogIH0KCiAgZnVuY3Rpb24gY2FuZGlkYXRlU3RhdGUoYyA9IGNhbmRpZGF0ZSgpKSB7CiAgICByZXR1cm4gU3RyaW5nKAogICAgICBjPy5zdGF0ZSB8fAogICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcHJpbWFyeVN0YXRlJyk/LnRleHRDb250ZW50IHx8CiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNtb2JpbGVTaWduYWxTdGF0ZScpPy50ZXh0Q29udGVudCB8fAogICAgICAnV0FJVElORycKICAgICkudHJpbSgpLnRvVXBwZXJDYXNlKCk7CiAgfQoKICBmdW5jdGlvbiBtb2RlRnJvbUNvcmUoKSB7CiAgICB0cnkgewogICAgICBjb25zdCBjb3JlID0gd2luZG93Lk1FTUVGTE9XX0NPUkU/LmdldFN0YXRlPy4oKSB8fCB7fTsKICAgICAgY29uc3QgdmFsdWUgPQogICAgICAgIGNvcmU/LnNldHRpbmdzPy50cmFkaW5nRW52aXJvbm1lbnQgfHwKICAgICAgICBjb3JlPy50cmFkaW5nRW52aXJvbm1lbnQgfHwKICAgICAgICAnJzsKICAgICAgaWYgKHZhbHVlKSByZXR1cm4gU3RyaW5nKHZhbHVlKS50b0xvd2VyQ2FzZSgpOwogICAgfSBjYXRjaCB7fQogICAgcmV0dXJuICdwYXBlcic7CiAgfQoKICBmdW5jdGlvbiBtaW50T2YoYykgewogICAgcmV0dXJuIFN0cmluZygKICAgICAgYz8ubWludCB8fAogICAgICBjPy50b2tlbk1pbnQgfHwKICAgICAgYz8udG9rZW5BZGRyZXNzIHx8CiAgICAgIGM/LmFkZHJlc3MgfHwKICAgICAgYz8uaWQgfHwKICAgICAgJycKICAgICkudHJpbSgpOwogIH0KCiAgZnVuY3Rpb24gZmluaXRlKHZhbHVlKSB7CiAgICByZXR1cm4gdmFsdWUgIT09IG51bGwgJiYKICAgICAgdmFsdWUgIT09IHVuZGVmaW5lZCAmJgogICAgICB2YWx1ZSAhPT0gJycgJiYKICAgICAgTnVtYmVyLmlzRmluaXRlKE51bWJlcih2YWx1ZSkpOwogIH0KCiAgZnVuY3Rpb24gYnVpbGRMaXZlR2F0ZXMoYywgc3RhdGUpIHsKICAgIGNvbnN0IHF1b3RlQWdlID0gZmluaXRlKGM/LnF1b3RlQWdlTXMpID8gTnVtYmVyKGMucXVvdGVBZ2VNcykgOiBudWxsOwogICAgY29uc3QgcG9zaXRpb25TaXplID0gTnVtYmVyKAogICAgICBjPy5leGVjdXRpb24/LnNpemVTb2wgPz8KICAgICAgYz8ucG9zaXRpb25TaXplID8/CiAgICAgIGM/LnBvc2l0aW9uU2l6ZVNvbAogICAgKTsKCiAgICBjb25zdCByaXNrUmVhZHkgPQogICAgICBjPy5leGVjdXRpb24/LnJpc2tBcHByb3ZlZCA9PT0gdHJ1ZSB8fAogICAgICBjPy5yaXNrQXBwcm92ZWQgPT09IHRydWU7CgogICAgY29uc3Qgcm91dGVSZWFkeSA9CiAgICAgIGM/LmV4ZWN1dGlvbj8ucm91dGVBcHByb3ZlZCA9PT0gdHJ1ZSB8fAogICAgICBjPy5yb3V0ZUFwcHJvdmVkID09PSB0cnVlOwoKICAgIGNvbnN0IHdhbGxldFRleHQgPSBTdHJpbmcoCiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN3YWxsZXRFeGVjdXRpb25HYXRlJyk/LnRleHRDb250ZW50IHx8ICcnCiAgICApLnRyaW0oKS50b1VwcGVyQ2FzZSgpOwoKICAgIGNvbnN0IGJhbGFuY2VUZXh0ID0gU3RyaW5nKAogICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjd2FsbGV0QmFsYW5jZUdhdGUnKT8udGV4dENvbnRlbnQgfHwgJycKICAgICkudHJpbSgpLnRvVXBwZXJDYXNlKCk7CgogICAgcmV0dXJuIFsKICAgICAgeyBuYW1lOiAnQ2FuZGlkYXRlIHNlbGVjdGVkJywgcGFzczogISFjPy5pZCB8fCAhIW1pbnRPZihjKSB9LAogICAgICB7IG5hbWU6ICdBSSBCVVkgUkVBRFknLCBwYXNzOiBzdGF0ZSA9PT0gJ0JVWSBSRUFEWScgfSwKICAgICAgeyBuYW1lOiAnVmVyaWZpZWQgcHJpY2UnLCBwYXNzOiBmaW5pdGUoYz8ucHJpY2VTb2wgPz8gYz8ucHJpY2UpIH0sCiAgICAgIHsgbmFtZTogJ0ZyZXNoIGhvbGRlciBldmlkZW5jZScsIHBhc3M6IGM/LmhvbGRlckZyZXNoID09PSB0cnVlIH0sCiAgICAgIHsgbmFtZTogJ1Jpc2sgYXBwcm92ZWQnLCBwYXNzOiByaXNrUmVhZHkgfSwKICAgICAgeyBuYW1lOiAnUm91dGUgYXBwcm92ZWQnLCBwYXNzOiByb3V0ZVJlYWR5IH0sCiAgICAgIHsgbmFtZTogJ0ZyZXNoIHF1b3RlJywgcGFzczogcXVvdGVBZ2UgIT09IG51bGwgJiYgcXVvdGVBZ2UgPD0gMTUwMDAgfSwKICAgICAgewogICAgICAgIG5hbWU6ICdQb3NpdGlvbiBzaXplIHJlYWR5JywKICAgICAgICBwYXNzOiBOdW1iZXIuaXNGaW5pdGUocG9zaXRpb25TaXplKSAmJiBwb3NpdGlvblNpemUgPiAwCiAgICAgIH0sCiAgICAgIHsKICAgICAgICBuYW1lOiAnV2FsbGV0IGNvbm5lY3RlZCcsCiAgICAgICAgcGFzczogd2FsbGV0VGV4dCA9PT0gJ0NPTk5FQ1RFRCcgfHwgd2FsbGV0VGV4dCA9PT0gJ1BBU1MnCiAgICAgIH0sCiAgICAgIHsKICAgICAgICBuYW1lOiAnQmFsYW5jZSBhcHByb3ZlZCcsCiAgICAgICAgcGFzczogYmFsYW5jZVRleHQgPT09ICdQQVNTJwogICAgICB9CiAgICBdOwogIH0KCiAgZnVuY3Rpb24gZmFsbGJhY2tQYXBlckdhdGVzKHN0YXRlKSB7CiAgICBjb25zdCBnYXRlcyA9IFsKICAgICAgewogICAgICAgIG5hbWU6ICdBSSBCVVkgUkVBRFknLAogICAgICAgIHBhc3M6IHN0YXRlID09PSAnQlVZIFJFQURZJywKICAgICAgICBjb2RlOiBzdGF0ZSA9PT0gJ0JMT0NLRUQnID8gJ0FJX0JMT0NLRUQnIDogbnVsbAogICAgICB9CiAgICBdOwoKICAgIHdoaWxlIChnYXRlcy5sZW5ndGggPCAxMCkgewogICAgICBnYXRlcy5wdXNoKHsKICAgICAgICBuYW1lOiAnQmFja2VuZCByZWFkaW5lc3MgcGVuZGluZycsCiAgICAgICAgcGFzczogZmFsc2UsCiAgICAgICAgY29kZTogbnVsbAogICAgICB9KTsKICAgIH0KICAgIHJldHVybiBnYXRlczsKICB9CgogIGFzeW5jIGZ1bmN0aW9uIGZldGNoUGFwZXJQYXlsb2FkKGMsIHN0YXRlLCBnZW5lcmF0aW9uKSB7CiAgICBjb25zdCBtaW50ID0gbWludE9mKGMpOwoKICAgIGlmICghbWludCkgewogICAgICByZXR1cm4gewogICAgICAgIHBhcGVyTW9kZTogdHJ1ZSwKICAgICAgICBzdGF0ZSwKICAgICAgICBnYXRlczogZmFsbGJhY2tQYXBlckdhdGVzKHN0YXRlKQogICAgICB9OwogICAgfQoKICAgIHRyeSB7CiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goCiAgICAgICAgJy9hcGkvcGFwZXIvcmVhZGluZXNzP21pbnQ9JyArIGVuY29kZVVSSUNvbXBvbmVudChtaW50KSwKICAgICAgICB7CiAgICAgICAgICBjcmVkZW50aWFsczogJ2luY2x1ZGUnLAogICAgICAgICAgaGVhZGVyczogeyBhY2NlcHQ6ICdhcHBsaWNhdGlvbi9qc29uJyB9LAogICAgICAgICAgY2FjaGU6ICduby1zdG9yZScKICAgICAgICB9CiAgICAgICk7CgogICAgICBpZiAoZ2VuZXJhdGlvbiAhPT0gcmVmcmVzaEdlbmVyYXRpb24pIHJldHVybiBudWxsOwogICAgICBpZiAoIXJlc3BvbnNlLm9rKSB0aHJvdyBuZXcgRXJyb3IoJ0hUVFAgJyArIHJlc3BvbnNlLnN0YXR1cyk7CgogICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpOwogICAgICBpZiAoZ2VuZXJhdGlvbiAhPT0gcmVmcmVzaEdlbmVyYXRpb24pIHJldHVybiBudWxsOwoKICAgICAgY29uc3QgYmFja2VuZCA9IEFycmF5LmlzQXJyYXkoZGF0YT8uY2hlY2tzKSA/IGRhdGEuY2hlY2tzIDogW107CiAgICAgIGNvbnN0IGdhdGVzID0gWwogICAgICAgIHsKICAgICAgICAgIG5hbWU6ICdBSSBCVVkgUkVBRFknLAogICAgICAgICAgcGFzczogc3RhdGUgPT09ICdCVVkgUkVBRFknLAogICAgICAgICAgY29kZTogc3RhdGUgPT09ICdCTE9DS0VEJyA/ICdBSV9CTE9DS0VEJyA6IG51bGwKICAgICAgICB9LAogICAgICAgIC4uLmJhY2tlbmQubWFwKGNoZWNrID0+ICh7CiAgICAgICAgICBuYW1lOiBTdHJpbmcoY2hlY2s/Lm5hbWUgfHwgJ0NoZWNrJyksCiAgICAgICAgICBwYXNzOiBjaGVjaz8ucGFzcyA9PT0gdHJ1ZSwKICAgICAgICAgIGNvZGU6IGNoZWNrPy5jb2RlIHx8IG51bGwKICAgICAgICB9KSkKICAgICAgXTsKCiAgICAgIHdoaWxlIChnYXRlcy5sZW5ndGggPCAxMCkgewogICAgICAgIGdhdGVzLnB1c2goewogICAgICAgICAgbmFtZTogJ0JhY2tlbmQgcmVhZGluZXNzIHBlbmRpbmcnLAogICAgICAgICAgcGFzczogZmFsc2UsCiAgICAgICAgICBjb2RlOiBudWxsCiAgICAgICAgfSk7CiAgICAgIH0KCiAgICAgIHJldHVybiB7IHBhcGVyTW9kZTogdHJ1ZSwgc3RhdGUsIGdhdGVzIH07CiAgICB9IGNhdGNoIHsKICAgICAgcmV0dXJuIHsKICAgICAgICBwYXBlck1vZGU6IHRydWUsCiAgICAgICAgc3RhdGUsCiAgICAgICAgZ2F0ZXM6IGZhbGxiYWNrUGFwZXJHYXRlcyhzdGF0ZSkKICAgICAgfTsKICAgIH0KICB9CgogIGZ1bmN0aW9uIGNsYXNzaWZ5KGdhdGUsIHBhcGVyTW9kZSwgc3RhdGUpIHsKICAgIGlmIChnYXRlPy5wYXNzID09PSB0cnVlKSB7CiAgICAgIHJldHVybiB7IGxhYmVsOiAnUEFTUycsIGNsYXNzTmFtZTogJ3Bhc3MnIH07CiAgICB9CgogICAgaWYgKAogICAgICBTdHJpbmcoZ2F0ZT8ubmFtZSB8fCAnJykudG9VcHBlckNhc2UoKSA9PT0gJ0FJIEJVWSBSRUFEWScgJiYKICAgICAgc3RhdGUgPT09ICdCTE9DS0VEJwogICAgKSB7CiAgICAgIHJldHVybiB7IGxhYmVsOiAnQkxPQ0tFRCcsIGNsYXNzTmFtZTogJ2Jsb2NrZWQnIH07CiAgICB9CgogICAgaWYgKAogICAgICBwYXBlck1vZGUgJiYKICAgICAgSEFSRF9QQVBFUl9DT0RFUy5oYXMoU3RyaW5nKGdhdGU/LmNvZGUgfHwgJycpKQogICAgKSB7CiAgICAgIHJldHVybiB7IGxhYmVsOiAnQkxPQ0tFRCcsIGNsYXNzTmFtZTogJ2Jsb2NrZWQnIH07CiAgICB9CgogICAgcmV0dXJuIHsgbGFiZWw6ICdQRU5ESU5HJywgY2xhc3NOYW1lOiAncGVuZGluZycgfTsKICB9CgogIGZ1bmN0aW9uIGJsb2NrZXJUZXh0KGdhdGUsIHN0YXRlLCBwYXBlck1vZGUpIHsKICAgIGlmICghZ2F0ZSkgewogICAgICByZXR1cm4gcGFwZXJNb2RlCiAgICAgICAgPyAnQWxsIFBBUEVSIGV4ZWN1dGlvbiBjaGVja3MgcGFzc2VkLicKICAgICAgICA6ICdBbGwgTElWRSBwcmUtdHJhZGUgY2hlY2tzIHBhc3NlZC4nOwogICAgfQoKICAgIGlmIChTdHJpbmcoZ2F0ZS5uYW1lIHx8ICcnKS50b1VwcGVyQ2FzZSgpID09PSAnQUkgQlVZIFJFQURZJykgewogICAgICByZXR1cm4gc3RhdGUgPT09ICdCTE9DS0VEJwogICAgICAgID8gJ1RoZSBjdXJyZW50IEFJIGRlY2lzaW9uIGlzIEJMT0NLRUQgYnkgdGhlIGV2YWx1YXRpb24gZ2F0ZXMuJwogICAgICAgIDogJ1dhaXRpbmcgZm9yIHRoZSBBSSBkZWNpc2lvbiB0byByZWFjaCBCVVkgUkVBRFkuJzsKICAgIH0KCiAgICBjb25zdCBtZXNzYWdlcyA9IHsKICAgICAgSU5WQUxJRF9QUklDRTogJ1dhaXRpbmcgZm9yIGEgdmFsaWQgdmVyaWZpZWQgdG9rZW4gcHJpY2UuJywKICAgICAgU1RBTEVfREVDSVNJT046ICdXYWl0aW5nIGZvciBhIGZyZXNoIGRlY2lzaW9uIHNuYXBzaG90LicsCiAgICAgIFNUQUxFX1RPS0VOX0RBVEE6ICdXYWl0aW5nIGZvciBmcmVzaCBob2xkZXIgYW5kIHRva2VuIGV2aWRlbmNlLicsCiAgICAgIFBPU0lUSU9OX0VYSVNUUzogJ0EgUEFQRVIgcG9zaXRpb24gZm9yIHRoaXMgdG9rZW4gaXMgYWxyZWFkeSBvcGVuLicsCiAgICAgIE1BWF9PUEVOX1BPU0lUSU9OUzogJ1RoZSBjb25maWd1cmVkIG1heGltdW0gbnVtYmVyIG9mIG9wZW4gcG9zaXRpb25zIGhhcyBiZWVuIHJlYWNoZWQuJywKICAgICAgTUFYX0RBSUxZX0VOVFJJRVM6ICdUaGUgY29uZmlndXJlZCBkYWlseSBlbnRyeSBsaW1pdCBoYXMgYmVlbiByZWFjaGVkLicsCiAgICAgIElOVkFMSURfUE9TSVRJT05fU0laRTogJ1Bvc2l0aW9uIHNpemUgaXMgb3V0c2lkZSB0aGUgY29uZmlndXJlZCBsaW1pdHMuJywKICAgICAgREFJTFlfU1BFTkRfTElNSVQ6ICdUaGlzIGVudHJ5IHdvdWxkIGV4Y2VlZCB0aGUgY29uZmlndXJlZCBkYWlseSBzcGVuZCBsaW1pdC4nLAogICAgICBQQVBFUl9DQVBJVEFMX0xJTUlUOiAnQXZhaWxhYmxlIFBBUEVSIGNhcGl0YWwgaXMgaW5zdWZmaWNpZW50IGZvciB0aGlzIGVudHJ5LicsCiAgICAgIEtJTExfU1dJVENIOiAnVGhlIGFjY291bnQga2lsbCBzd2l0Y2ggaXMgYWN0aXZlLicsCiAgICAgIERBSUxZX0xPU1NfTElNSVQ6ICdUaGUgY29uZmlndXJlZCBkYWlseSBsb3NzIGxpbWl0IGlzIGFjdGl2ZS4nCiAgICB9OwoKICAgIHJldHVybiBtZXNzYWdlc1tTdHJpbmcoZ2F0ZS5jb2RlIHx8ICcnKV0gfHwKICAgICAgYCR7Z2F0ZS5uYW1lIHx8ICdUaGlzIGNoZWNrJ30gaGFzIG5vdCBwYXNzZWQgeWV0LmA7CiAgfQoKICBmdW5jdGlvbiBzZXRUZXh0KHNlbGVjdG9yLCB2YWx1ZSkgewogICAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTsKICAgIGlmIChlbCkgZWwudGV4dENvbnRlbnQgPSB2YWx1ZTsKICB9CgogIGZ1bmN0aW9uIHJlbmRlckxpc3Qocm93cykgewogICAgY29uc3QgbGlzdCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNleGVjdXRpb25DaGVja0xpc3QnKTsKICAgIGlmICghbGlzdCkgcmV0dXJuOwoKICAgIGNvbnN0IGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpOwoKICAgIGZvciAoY29uc3Qgcm93IG9mIHJvd3MpIHsKICAgICAgY29uc3QgaXRlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpOwogICAgICBpdGVtLmNsYXNzTmFtZSA9IGBkYXRhLXJvdyBleGVjdXRpb24tY2hlY2stcm93ICR7cm93LnVpLmNsYXNzTmFtZX1gOwogICAgICBpdGVtLnNldEF0dHJpYnV0ZSgncm9sZScsICdsaXN0aXRlbScpOwogICAgICBpZiAocm93LmNvZGUpIGl0ZW0uZGF0YXNldC5nYXRlQ29kZSA9IFN0cmluZyhyb3cuY29kZSk7CgogICAgICBjb25zdCBuYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpOwogICAgICBuYW1lLmNsYXNzTmFtZSA9ICdleGVjdXRpb24tY2hlY2stbmFtZSc7CgogICAgICBjb25zdCBkb3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpJyk7CiAgICAgIGRvdC5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKTsKCiAgICAgIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYicpOwogICAgICBsYWJlbC50ZXh0Q29udGVudCA9IFN0cmluZyhyb3cubmFtZSB8fCAnQ2hlY2snKTsKCiAgICAgIGNvbnN0IHN0YXR1cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2VtJyk7CiAgICAgIHN0YXR1cy50ZXh0Q29udGVudCA9IHJvdy51aS5sYWJlbDsKCiAgICAgIG5hbWUuYXBwZW5kKGRvdCwgbGFiZWwpOwogICAgICBpdGVtLmFwcGVuZChuYW1lLCBzdGF0dXMpOwogICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChpdGVtKTsKICAgIH0KCiAgICBsaXN0LnJlcGxhY2VDaGlsZHJlbihmcmFnbWVudCk7CiAgfQoKICBmdW5jdGlvbiByZW5kZXIocGF5bG9hZCkgewogICAgaWYgKCFwYXlsb2FkIHx8ICFBcnJheS5pc0FycmF5KHBheWxvYWQuZ2F0ZXMpKSByZXR1cm47CgogICAgY29uc3Qgc3RhdGUgPSBTdHJpbmcocGF5bG9hZC5zdGF0ZSB8fCAnV0FJVElORycpLnRvVXBwZXJDYXNlKCk7CiAgICBjb25zdCBwYXBlck1vZGUgPSBwYXlsb2FkLnBhcGVyTW9kZSAhPT0gZmFsc2U7CiAgICBjb25zdCByb3dzID0gcGF5bG9hZC5nYXRlcy5tYXAoZ2F0ZSA9PiAoewogICAgICAuLi5nYXRlLAogICAgICB1aTogY2xhc3NpZnkoZ2F0ZSwgcGFwZXJNb2RlLCBzdGF0ZSkKICAgIH0pKTsKCiAgICBjb25zdCBwYXNzZWQgPSByb3dzLmZpbHRlcihyb3cgPT4gcm93LnBhc3MgPT09IHRydWUpLmxlbmd0aDsKICAgIGNvbnN0IHRvdGFsID0gcm93cy5sZW5ndGg7CiAgICBjb25zdCBzYWZlID0gdG90YWwgPiAwICYmIHBhc3NlZCA9PT0gdG90YWw7CiAgICBjb25zdCBibG9ja2VkID0gcm93cy5maWx0ZXIocm93ID0+IHJvdy51aS5jbGFzc05hbWUgPT09ICdibG9ja2VkJykubGVuZ3RoOwogICAgY29uc3QgcGVuZGluZyA9IHJvd3MuZmlsdGVyKHJvdyA9PiByb3cudWkuY2xhc3NOYW1lID09PSAncGVuZGluZycpLmxlbmd0aDsKICAgIGNvbnN0IGZpcnN0RmFpbGVkID0gcm93cy5maW5kKHJvdyA9PiByb3cucGFzcyAhPT0gdHJ1ZSkgfHwgbnVsbDsKCiAgICBzZXRUZXh0KCcjZXhlY3V0aW9uUmVhZGluZXNzQ291bnQnLCBgJHtwYXNzZWR9IC8gJHt0b3RhbH0gY2hlY2tzYCk7CgogICAgc2V0VGV4dCgKICAgICAgJyNleGVjdXRpb25SZWFkaW5lc3NMYWJlbCcsCiAgICAgIHNhZmUKICAgICAgICA/IChwYXBlck1vZGUgPyAnUGFwZXIgZXhlY3V0aW9uIHJlYWR5JyA6ICdBbGwgcHJlLXRyYWRlIGNoZWNrcyBwYXNzZWQnKQogICAgICAgIDogYmxvY2tlZAogICAgICAgICAgPyBgJHtibG9ja2VkfSBibG9ja2VkIMK3ICR7cGVuZGluZ30gcGVuZGluZ2AKICAgICAgICAgIDogYCR7cGVuZGluZ30gcGVuZGluZ2AKICAgICk7CgogICAgY29uc3QgYmFyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2V4ZWN1dGlvblJlYWRpbmVzc0JhcicpOwogICAgaWYgKGJhcikgewogICAgICBiYXIuc3R5bGUud2lkdGggPSBgJHt0b3RhbCA/IE1hdGgucm91bmQoKHBhc3NlZCAvIHRvdGFsKSAqIDEwMCkgOiAwfSVgOwogICAgfQoKICAgIGNvbnN0IHN0YXRlRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZXhlY3V0aW9uU3RhdGUnKTsKICAgIGlmIChzdGF0ZUVsKSB7CiAgICAgIHN0YXRlRWwudGV4dENvbnRlbnQgPSBzYWZlCiAgICAgICAgPyAocGFwZXJNb2RlID8gJ1BBUEVSIFJFQURZJyA6ICdTQUZFJykKICAgICAgICA6ICdMT0NLRUQnOwogICAgICBzdGF0ZUVsLmNsYXNzTmFtZSA9IGBzdGF0ZSAke3NhZmUgPyAnYnV5JyA6ICd3YWl0J31gOwogICAgfQoKICAgIGNvbnN0IGV4cGxhaW5lciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNleGVjdXRpb25TaWduYWxFeHBsYWluZXInKTsKICAgIGlmIChleHBsYWluZXIpIHsKICAgICAgZXhwbGFpbmVyLnJlcGxhY2VDaGlsZHJlbigpOwoKICAgICAgY29uc3QgYWlTdHJvbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdiJyk7CiAgICAgIGFpU3Ryb25nLnRleHRDb250ZW50ID0gJ0FJIHNpZ25hbDonOwoKICAgICAgY29uc3QgZXhlY1N0cm9uZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2InKTsKICAgICAgZXhlY1N0cm9uZy50ZXh0Q29udGVudCA9ICdFeGVjdXRpb246JzsKCiAgICAgIGV4cGxhaW5lci5hcHBlbmQoCiAgICAgICAgYWlTdHJvbmcsCiAgICAgICAgZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoYCAke3N0YXRlfSDCtyBgKSwKICAgICAgICBleGVjU3Ryb25nLAogICAgICAgIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKAogICAgICAgICAgc2FmZQogICAgICAgICAgICA/IGAgJHtwYXBlck1vZGUgPyAnUEFQRVIgUkVBRFknIDogJ1NBRkUgVE8gVkFMSURBVEUnfWAKICAgICAgICAgICAgOiAnIExPQ0tFRCcKICAgICAgICApCiAgICAgICk7CiAgICB9CgogICAgc2V0VGV4dCgKICAgICAgJyNwcmltYXJ5QmxvY2tlclRpdGxlJywKICAgICAgc2FmZQogICAgICAgID8gKHBhcGVyTW9kZSA/ICdQYXBlciBleGVjdXRpb24gcmVhZHknIDogJ0FsbCBjaGVja3MgcGFzc2VkJykKICAgICAgICA6IFN0cmluZyhmaXJzdEZhaWxlZD8ubmFtZSB8fCAnVmFsaWRhdGlvbiBwZW5kaW5nJykKICAgICk7CgogICAgc2V0VGV4dCgKICAgICAgJyNwcmltYXJ5QmxvY2tlclRleHQnLAogICAgICBibG9ja2VyVGV4dChmaXJzdEZhaWxlZCwgc3RhdGUsIHBhcGVyTW9kZSkKICAgICk7CgogICAgY29uc3QgYWN0aW9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3ByaW1hcnlCbG9ja2VyQWN0aW9uJyk7CiAgICBpZiAoYWN0aW9uKSB7CiAgICAgIGFjdGlvbi50ZXh0Q29udGVudCA9IHNhZmUKICAgICAgICA/IChwYXBlck1vZGUgPyAnVmlldyBwb3NpdGlvbnMnIDogJ1ZhbGlkYXRlIGV4ZWN1dGlvbicpCiAgICAgICAgOiAnVmlldyBkZWNpc2lvbic7CgogICAgICBhY3Rpb24uaHJlZiA9IHNhZmUKICAgICAgICA/IChwYXBlck1vZGUgPyAnI3Bvc2l0aW9ucycgOiAnI2V4ZWN1dGlvblByZXZpZXcnKQogICAgICAgIDogJyNwcmltYXJ5LWNhbmRpZGF0ZSc7CiAgICB9CgogICAgc2V0VGV4dCgKICAgICAgJyNleGVjdXRpb25QZW5kaW5nQ291bnQnLAogICAgICBzYWZlCiAgICAgICAgPyAnQWxsIHBhc3NlZCcKICAgICAgICA6IGJsb2NrZWQKICAgICAgICAgID8gYCR7YmxvY2tlZH0gYmxvY2tlZCDCtyAke3BlbmRpbmd9IHBlbmRpbmdgCiAgICAgICAgICA6IGAke3BlbmRpbmd9IHBlbmRpbmdgCiAgICApOwoKICAgIHJlbmRlckxpc3Qocm93cyk7CgogICAgY29uc3QgcHJldmlldyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNleGVjdXRpb25QcmV2aWV3Jyk7CiAgICBpZiAocHJldmlldykgewogICAgICBwcmV2aWV3LmNsYXNzTGlzdC50b2dnbGUoJ2xvY2tlZCcsICFzYWZlKTsKICAgICAgcHJldmlldy5kYXRhc2V0LmV4ZWN1dGlvbk1vZGUgPSBwYXBlck1vZGUgPyAncGFwZXInIDogJ2xpdmUnOwogICAgfQoKICAgIGxhc3RQYXlsb2FkID0gewogICAgICBwYXBlck1vZGUsCiAgICAgIHN0YXRlLAogICAgICBzYWZlLAogICAgICBnYXRlczogcm93cy5tYXAoKHsgdWksIC4uLmdhdGUgfSkgPT4gZ2F0ZSkKICAgIH07CiAgfQoKICBmdW5jdGlvbiBiaW5kVG9nZ2xlKCkgewogICAgY29uc3QgaG9zdCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNleGVjdXRpb25QcmV2aWV3Jyk7CiAgICBjb25zdCBidXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZXhlY3V0aW9uQ2hlY2tzVG9nZ2xlJyk7CiAgICBjb25zdCBsaXN0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2V4ZWN1dGlvbkNoZWNrTGlzdCcpOwogICAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZXhlY3V0aW9uQ2hlY2tzVG9nZ2xlTGFiZWwnKTsKCiAgICBpZiAoIWhvc3QgfHwgIWJ1dHRvbiB8fCAhbGlzdCkgcmV0dXJuOwogICAgaWYgKGJ1dHRvbi5kYXRhc2V0Lm1mUHJldHJhZGVWM0JvdW5kID09PSAnMScpIHJldHVybjsKCiAgICBidXR0b24uZGF0YXNldC5tZlByZXRyYWRlVjNCb3VuZCA9ICcxJzsKCiAgICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7CiAgICAgIGNvbnN0IG9wZW4gPSBidXR0b24uZ2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJykgIT09ICd0cnVlJzsKCiAgICAgIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBTdHJpbmcob3BlbikpOwogICAgICBob3N0LmNsYXNzTGlzdC50b2dnbGUoJ21mLXBtLWNoZWNrcy1vcGVuJywgb3Blbik7CiAgICAgIGxpc3QuaGlkZGVuID0gIW9wZW47CgogICAgICBpZiAobGFiZWwpIGxhYmVsLnRleHRDb250ZW50ID0gb3BlbiA/ICdIaWRlIGNoZWNrcycgOiAnQWxsIGNoZWNrcyc7CiAgICB9KTsKICB9CgogIGFzeW5jIGZ1bmN0aW9uIHJlZnJlc2goKSB7CiAgICBiaW5kVG9nZ2xlKCk7CgogICAgY29uc3QgZ2VuZXJhdGlvbiA9ICsrcmVmcmVzaEdlbmVyYXRpb247CiAgICBjb25zdCBjID0gY2FuZGlkYXRlKCk7CiAgICBjb25zdCBzdGF0ZSA9IGNhbmRpZGF0ZVN0YXRlKGMpOwogICAgY29uc3QgcHVibGlzaGVkID0gd2luZG93Ll9fTUVNRUZMT1dfUFJFVFJBREVfU1RBVEVfXzsKCiAgICBpZiAoCiAgICAgIHB1Ymxpc2hlZCAmJgogICAgICBBcnJheS5pc0FycmF5KHB1Ymxpc2hlZC5nYXRlcykgJiYKICAgICAgcHVibGlzaGVkLmdhdGVzLmxlbmd0aAogICAgKSB7CiAgICAgIHJlbmRlcihwdWJsaXNoZWQpOwogICAgfQoKICAgIGNvbnN0IG1vZGUgPSBwdWJsaXNoZWQKICAgICAgPyAocHVibGlzaGVkLnBhcGVyTW9kZSA/ICdwYXBlcicgOiAnbGl2ZScpCiAgICAgIDogbW9kZUZyb21Db3JlKCk7CgogICAgaWYgKG1vZGUuaW5jbHVkZXMoJ3BhcGVyJykpIHsKICAgICAgY29uc3QgcGF5bG9hZCA9IGF3YWl0IGZldGNoUGFwZXJQYXlsb2FkKGMsIHN0YXRlLCBnZW5lcmF0aW9uKTsKICAgICAgaWYgKHBheWxvYWQgJiYgZ2VuZXJhdGlvbiA9PT0gcmVmcmVzaEdlbmVyYXRpb24pIHJlbmRlcihwYXlsb2FkKTsKICAgICAgcmV0dXJuOwogICAgfQoKICAgIGlmIChnZW5lcmF0aW9uICE9PSByZWZyZXNoR2VuZXJhdGlvbikgcmV0dXJuOwoKICAgIHJlbmRlcih7CiAgICAgIHBhcGVyTW9kZTogZmFsc2UsCiAgICAgIHN0YXRlLAogICAgICBnYXRlczogYnVpbGRMaXZlR2F0ZXMoYywgc3RhdGUpCiAgICB9KTsKICB9CgogIGZ1bmN0aW9uIHNjaGVkdWxlUmVmcmVzaCgpIHsKICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHsKICAgICAgcmVmcmVzaCgpLmNhdGNoKCgpID0+IHt9KTsKICAgIH0pOwogIH0KCiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lbWVmbG93OnByZXRyYWRlLXJlYWRpbmVzcycsIGV2ZW50ID0+IHsKICAgIGlmIChldmVudD8uZGV0YWlsKSByZW5kZXIoZXZlbnQuZGV0YWlsKTsKICB9KTsKCiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbWVtZWZsb3c6c3RhdGVjaGFuZ2UnLCBzY2hlZHVsZVJlZnJlc2gpOwogIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZW1lZmxvdzpjYW5kaWRhdGVjaGFuZ2UnLCBzY2hlZHVsZVJlZnJlc2gpOwogIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZjp3YWxsZXQtY2hhbmdlJywgc2NoZWR1bGVSZWZyZXNoKTsKCiAgZnVuY3Rpb24gYm9vdCgpIHsKICAgIGJpbmRUb2dnbGUoKTsKICAgIHJlZnJlc2goKS5jYXRjaCgoKSA9PiB7fSk7CgogICAgcmVmcmVzaFRpbWVyID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHsKICAgICAgcmVmcmVzaCgpLmNhdGNoKCgpID0+IHt9KTsKICAgIH0sIDUwMDApOwogIH0KCiAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJykgewogICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGJvb3QsIHsgb25jZTogdHJ1ZSB9KTsKICB9IGVsc2UgewogICAgYm9vdCgpOwogIH0KCiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BhZ2VoaWRlJywgKCkgPT4gewogICAgaWYgKHJlZnJlc2hUaW1lcikgewogICAgICBjbGVhckludGVydmFsKHJlZnJlc2hUaW1lcik7CiAgICAgIHJlZnJlc2hUaW1lciA9IG51bGw7CiAgICB9CiAgfSwgeyBvbmNlOiB0cnVlIH0pOwoKICB3aW5kb3cuTUVNRUZMT1dfUFJFVFJBREVfVUkgPSB7CiAgICB2ZXJzaW9uOiAzLAogICAgcmVmcmVzaCwKICAgIHJlbmRlciwKICAgIGdldFN0YXRlOiAoKSA9PiBsYXN0UGF5bG9hZAogICAgICA/IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkobGFzdFBheWxvYWQpKQogICAgICA6IG51bGwKICB9Owp9KSgpOwo=' | base64 -d > "$WORK_MODULE"

python3 - "$WORK_INDEX" "$WORK_PAPER" <<'PY'
from pathlib import Path
import re, sys

index_path = Path(sys.argv[1])
paper_path = Path(sys.argv[2])

index = index_path.read_text(encoding="utf-8")
paper = paper_path.read_text(encoding="utf-8")

# A) Remove the old second owner of Pre-trade blocker state.
legacy_pattern = re.compile(
    r'\n  function technicalExecutionReasons\(\) \{.*?'
    r'\n  let queued = false;',
    re.S
)
paper, n_legacy = legacy_pattern.subn('\n  let queued = false;', paper, count=1)
if n_legacy != 1:
    raise SystemExit(
        f"Expected exactly one legacy blocker ownership block; found {n_legacy}."
    )

paper, n_call = re.subn(
    r'\n\s*isolateExecutionBlocker\(\);',
    '',
    paper,
    count=1
)
if n_call != 1:
    raise SystemExit(
        f"Expected exactly one isolateExecutionBlocker() call; found {n_call}."
    )

# B) Promote source marker V2 -> V3.
if index.count('data-mf-pretrade-v2="1"') != 1:
    raise SystemExit("Expected exactly one V2 source marker.")
index = index.replace(
    'data-mf-pretrade-v2="1"',
    'data-mf-pretrade-v3="1"',
    1
)

# C) Remove V2 toggle ownership. V3 module will own the static source button.
toggle_func = re.compile(
    r'\n  function bindChecksToggle\(\)\{.*?\n  \}\n\n  function init\(\)\{',
    re.S
)
index, n_toggle = toggle_func.subn('\n  function init(){', index, count=1)
if n_toggle != 1:
    raise SystemExit(
        f"Expected exactly one V2 bindChecksToggle() function; found {n_toggle}."
    )

index, n_toggle_call = re.subn(
    r'\n\s*bindChecksToggle\(\);',
    '',
    index,
    count=1
)
if n_toggle_call != 1:
    raise SystemExit(
        f"Expected exactly one V2 bindChecksToggle() call; found {n_toggle_call}."
    )

# D) Keep existing business/readiness calculation, but stop inline DOM ownership.
start_token = " const gates=paperMode?paperGates:liveGates;"
end_token = "\n // Mission/top context follows the same selected candidate."

start = index.find(start_token)
end = index.find(end_token, start + 1 if start >= 0 else 0)

if start < 0 or end < 0 or end <= start:
    raise SystemExit(
        "Could not locate the canonical PAPER/LIVE readiness section."
    )

replacement = r""" const gates=paperMode?paperGates:liveGates;
 const passed=gates.filter(g=>g.pass).length;
 const safe=passed===gates.length;

 // PRE-TRADE V3:
 // business/readiness ownership stays in this existing sync path;
 // DOM presentation ownership belongs only to pretrade-control-center-v3.js.
 const pretradeState={
   paperMode,
   state,
   safe,
   gates:gates.map(g=>({
     name:String(g?.name||'Check'),
     pass:g?.pass===true,
     code:g?.code||null
   })),
   candidate:{
     id:c?.id||null,
     mint:String(c?.mint||c?.tokenMint||c?.tokenAddress||c?.address||''),
     name:c?.name||null,
     symbol:c?.symbol||null
   }
 };
 window.__MEMEFLOW_PRETRADE_STATE__=pretradeState;
 window.dispatchEvent(
   new CustomEvent('memeflow:pretrade-readiness',{detail:pretradeState})
 );

 // Compatibility state anchors remain available to the rest of MEMEFLOW.
 text('#executionSize',Number.isFinite(positionSize)?positionSize+' SOL':'—');
 text('#quoteAge',paperMode?'NOT REQUIRED':fmt.age(quoteAge));
 text(
   '#executionSlippage',
   paperMode
     ? 'NOT REQUIRED'
     : (finite(c?.slippagePct)?fmt.pct(c.slippagePct):'—')
 );

 const risk=$('#executionRiskGate');
 if(risk){
   risk.textContent=riskReady?'PASS':'PENDING';
   risk.style.color=riskReady?'var(--green)':'var(--yellow)';
 }

 const route=$('#executionRouteGate');
 if(route){
   route.textContent=routeReady?'PASS':'PENDING';
   route.style.color=routeReady?'var(--green)':'var(--yellow)';
 }

 const walletGate=$('#walletExecutionGate');
 if(walletGate && paperMode){
   walletGate.textContent='NOT REQUIRED';
   walletGate.style.color='var(--green)';
 }

 const balanceGate=$('#walletBalanceGate');
 if(balanceGate && paperMode){
   balanceGate.textContent='PAPER';
   balanceGate.style.color='var(--green)';
 }

 const validate=$('#validateBtn');
 if(validate){
   validate.disabled=!safe;
   validate.setAttribute('aria-disabled',String(!safe));
 }

 const preview=$('#executionPreview');
 if(preview){
   preview.classList.toggle('locked',!safe);
   preview.dataset.executionMode=paperMode?'paper':'live';
 }"""

index = index[:start] + replacement + index[end:]

# E) Load one presentation-only JS module. No new CSS file/style tag.
script_tag = '<script src="./pretrade-control-center-v3.js?v=3.0.0" defer></script>'
if script_tag not in index:
    anchor = '<script defer src="paper-automation-ui.js"></script>'
    if index.count(anchor) != 1:
        raise SystemExit(
            "Expected exactly one paper-automation-ui.js script tag."
        )
    index = index.replace(anchor, anchor + '\n' + script_tag, 1)

checks = {
    "V3 marker": index.count('data-mf-pretrade-v3="1"') == 1,
    "V2 marker removed": 'data-mf-pretrade-v2="1"' not in index,
    "V2 toggle owner removed": 'function bindChecksToggle()' not in index,
    "V3 module tag": index.count('pretrade-control-center-v3.js?v=3.0.0') == 1,
    "state publication": index.count(
        'window.__MEMEFLOW_PRETRADE_STATE__=pretradeState;'
    ) == 1,
    "old inline blocker writer removed": "text('#primaryBlockerTitle'" not in index,
    "old inline list writer removed": "const list=$('#executionCheckList')" not in index,
    "legacy blocker function removed": 'function isolateExecutionBlocker()' not in paper,
    "legacy technical reasons removed": 'function technicalExecutionReasons()' not in paper,
    "legacy blocker call removed": 'isolateExecutionBlocker();' not in paper,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit(
        "Ownership verification failed: " + ", ".join(failed)
    )

index_path.write_text(index, encoding="utf-8")
paper_path.write_text(paper, encoding="utf-8")
print("Source ownership rewrite prepared.")
PY

# Clean-code validations BEFORE production files are replaced.
node --check < "$WORK_PAPER"
node --check < "$WORK_MODULE"

if grep -q 'MutationObserver' "$WORK_MODULE"; then
  echo "ERROR: V3 module unexpectedly contains MutationObserver."
  exit 1
fi

if grep -q '<style\|style.textContent' "$WORK_MODULE"; then
  echo "ERROR: V3 module unexpectedly contains a CSS/style layer."
  exit 1
fi

# Syntax-check the exact inline script modified above.
python3 - "$WORK_INDEX" "$INLINE_CHECK" <<'PY'
from pathlib import Path
import re, sys

html = Path(sys.argv[1]).read_text(encoding="utf-8")
out = Path(sys.argv[2])

scripts = re.findall(
    r'<script(?:\s[^>]*)?>(.*?)</script>',
    html,
    flags=re.S | re.I
)

hits = [
    script for script in scripts
    if 'window.__MEMEFLOW_PRETRADE_STATE__=pretradeState;' in script
]

if len(hits) != 1:
    raise SystemExit(
        f"Expected exactly one modified inline readiness script; found {len(hits)}."
    )

out.write_text(hits[0], encoding="utf-8")
PY
node --check < "$INLINE_CHECK"

# Only now replace production sources.
cp "$WORK_INDEX" "$INDEX"
cp "$WORK_PAPER" "$PAPER_UI"
cp "$WORK_MODULE" "$MODULE"

# Final production verification.
grep -q 'data-mf-pretrade-v3="1"' "$INDEX"
grep -q 'pretrade-control-center-v3.js?v=3.0.0' "$INDEX"
! grep -q 'function isolateExecutionBlocker()' "$PAPER_UI"
node --check "$PAPER_UI"
node --check "$MODULE"

# Successful install: remove disposable validation/work files.
rm -f "$WORK_INDEX" "$WORK_PAPER" "$WORK_MODULE" "$INLINE_CHECK"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
INDEX_BAK=$INDEX_BAK
PAPER_UI=$PAPER_UI
PAPER_BAK=$PAPER_BAK
MODULE=$MODULE
MODULE_EXISTED=$MODULE_EXISTED
MODULE_BAK=$MODULE_BAK
EOF

trap - ERR

echo
echo "OK: PRE-TRADE CONTROL CENTER V3.1 installed cleanly."
echo
echo "Single UI owner: pretrade-control-center-v3.js"
echo "Legacy blocker writer: REMOVED"
echo "V2 toggle writer: REMOVED"
echo "New CSS layers: NONE"
echo "MutationObserver in V3: NONE"
echo "Overlay/cloned block: NONE"
echo "PaperEngine/server gates: UNCHANGED"
echo
echo "Backups:"
echo "  $INDEX_BAK"
echo "  $PAPER_BAK"
echo
echo "Now Stop -> Run, then refresh the page."
