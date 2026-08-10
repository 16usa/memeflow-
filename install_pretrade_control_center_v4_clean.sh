#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"
APP="$ROOT/memeflow-app"
[[ -f "$APP/index.html" ]] || APP="$ROOT"

INDEX="$APP/index.html"
PAPER_UI="$APP/paper-automation-ui.js"
V4_MODULE="$APP/pretrade-control-center-v4.js"
V2_DIR="$APP/.memeflow-patches/pretrade-control-center-v2"
V2_PTR="$V2_DIR/latest-backup.txt"

if [[ ! -f "$INDEX" || ! -f "$PAPER_UI" ]]; then
  echo "ERROR: index.html or paper-automation-ui.js not found."
  exit 1
fi

if [[ ! -f "$V2_PTR" ]]; then
  echo "ERROR: V2 clean-base backup pointer not found: $V2_PTR"
  echo "Nothing changed."
  exit 1
fi

CLEAN_BASE="$(cat "$V2_PTR")"
if [[ ! -f "$CLEAN_BASE" ]]; then
  echo "ERROR: V2 clean-base backup is missing: $CLEAN_BASE"
  echo "Nothing changed."
  exit 1
fi

if ! grep -q 'data-mf-pretrade-v2="1"' "$INDEX"; then
  if grep -q 'data-mf-pretrade-v4="1"' "$INDEX"; then
    echo "PRE-TRADE CONTROL CENTER V4 is already installed."
    exit 0
  fi
  echo "ERROR: current V2 source marker not found. Refusing to guess."
  exit 1
fi

PATCH_DIR="$APP/.memeflow-patches/pretrade-control-center-v4"
mkdir -p "$PATCH_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

INDEX_BAK="$PATCH_DIR/index.html.$STAMP.bak"
PAPER_BAK="$PATCH_DIR/paper-automation-ui.js.$STAMP.bak"
cp "$INDEX" "$INDEX_BAK"
cp "$PAPER_UI" "$PAPER_BAK"

MODULE_EXISTED=0
MODULE_BAK=""
if [[ -f "$V4_MODULE" ]]; then
  MODULE_EXISTED=1
  MODULE_BAK="$PATCH_DIR/pretrade-control-center-v4.js.$STAMP.bak"
  cp "$V4_MODULE" "$MODULE_BAK"
fi

WORK_INDEX="$PATCH_DIR/index.html.$STAMP.work"
WORK_PAPER="$PATCH_DIR/paper-automation-ui.js.$STAMP.work"
WORK_MODULE="$PATCH_DIR/pretrade-control-center-v4.js.$STAMP.work"

cp "$INDEX" "$WORK_INDEX"
cp "$PAPER_UI" "$WORK_PAPER"
printf '%s' 'KCgpID0+IHsKICAndXNlIHN0cmljdCc7CgogIGlmICh3aW5kb3cuX19NRU1FRkxPV19QUkVUUkFERV9DT05UUk9MX0NFTlRFUl9WNF9fKSByZXR1cm47CiAgd2luZG93Ll9fTUVNRUZMT1dfUFJFVFJBREVfQ09OVFJPTF9DRU5URVJfVjRfXyA9IHRydWU7CgogIGNvbnN0IEhBUkRfUEFQRVJfQ09ERVMgPSBuZXcgU2V0KFsKICAgICdQT1NJVElPTl9FWElTVFMnLAogICAgJ01BWF9PUEVOX1BPU0lUSU9OUycsCiAgICAnTUFYX0RBSUxZX0VOVFJJRVMnLAogICAgJ0lOVkFMSURfUE9TSVRJT05fU0laRScsCiAgICAnREFJTFlfU1BFTkRfTElNSVQnLAogICAgJ1BBUEVSX0NBUElUQUxfTElNSVQnLAogICAgJ0tJTExfU1dJVENIJywKICAgICdEQUlMWV9MT1NTX0xJTUlUJwogIF0pOwoKICBsZXQgZ2VuZXJhdGlvbiA9IDA7CiAgbGV0IHRpbWVyID0gbnVsbDsKICBsZXQgbGFzdFN0YXRlID0gbnVsbDsKCiAgY29uc3QgJCA9IHNlbGVjdG9yID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpOwoKICBmdW5jdGlvbiBzZWxlY3RlZENhbmRpZGF0ZSgpIHsKICAgIHRyeSB7CiAgICAgIHJldHVybiB3aW5kb3cuTUVNRUZMT1dfQ09SRT8uZ2V0U2VsZWN0ZWQ/LigpIHx8IG51bGw7CiAgICB9IGNhdGNoIHsKICAgICAgcmV0dXJuIG51bGw7CiAgICB9CiAgfQoKICBmdW5jdGlvbiBtaW50T2YoY2FuZGlkYXRlKSB7CiAgICByZXR1cm4gU3RyaW5nKAogICAgICBjYW5kaWRhdGU/Lm1pbnQgfHwKICAgICAgY2FuZGlkYXRlPy50b2tlbk1pbnQgfHwKICAgICAgY2FuZGlkYXRlPy50b2tlbkFkZHJlc3MgfHwKICAgICAgY2FuZGlkYXRlPy5hZGRyZXNzIHx8CiAgICAgICcnCiAgICApLnRyaW0oKTsKICB9CgogIGZ1bmN0aW9uIGRlY2lzaW9uU3RhdGUoY2FuZGlkYXRlKSB7CiAgICByZXR1cm4gU3RyaW5nKAogICAgICBjYW5kaWRhdGU/LnN0YXRlIHx8CiAgICAgICQoJyNwcmltYXJ5U3RhdGUnKT8udGV4dENvbnRlbnQgfHwKICAgICAgJCgnI21vYmlsZVNpZ25hbFN0YXRlJyk/LnRleHRDb250ZW50IHx8CiAgICAgICdXQUlUSU5HJwogICAgKS50cmltKCkudG9VcHBlckNhc2UoKTsKICB9CgogIGZ1bmN0aW9uIG1vZGUoKSB7CiAgICBjb25zdCB2aXNpYmxlTW9kZSA9IFsKICAgICAgLi4uZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnRvcC1sZWZ0IC5jaGlwLC5tb2RlLWluZGljYXRvciwudG9wYmFyJykKICAgIF0ubWFwKGVsID0+IGVsLnRleHRDb250ZW50IHx8ICcnKS5qb2luKCcgJykudG9Mb3dlckNhc2UoKTsKCiAgICBpZiAodmlzaWJsZU1vZGUuaW5jbHVkZXMoJ3BhcGVyJykpIHJldHVybiAncGFwZXInOwogICAgaWYgKHZpc2libGVNb2RlLmluY2x1ZGVzKCdsaXZlJykpIHJldHVybiAnbGl2ZSc7CgogICAgdHJ5IHsKICAgICAgY29uc3QgY29yZSA9IHdpbmRvdy5NRU1FRkxPV19DT1JFPy5nZXRTdGF0ZT8uKCkgfHwge307CiAgICAgIGNvbnN0IHZhbHVlID0KICAgICAgICBjb3JlPy5zZXR0aW5ncz8udHJhZGluZ0Vudmlyb25tZW50IHx8CiAgICAgICAgY29yZT8udHJhZGluZ0Vudmlyb25tZW50IHx8CiAgICAgICAgJyc7CiAgICAgIGlmICh2YWx1ZSkgcmV0dXJuIFN0cmluZyh2YWx1ZSkudG9Mb3dlckNhc2UoKTsKICAgIH0gY2F0Y2gge30KCiAgICByZXR1cm4gJ3BhcGVyJzsKICB9CgogIGZ1bmN0aW9uIGZpbml0ZSh2YWx1ZSkgewogICAgcmV0dXJuIHZhbHVlICE9PSBudWxsICYmCiAgICAgIHZhbHVlICE9PSB1bmRlZmluZWQgJiYKICAgICAgdmFsdWUgIT09ICcnICYmCiAgICAgIE51bWJlci5pc0Zpbml0ZShOdW1iZXIodmFsdWUpKTsKICB9CgogIGZ1bmN0aW9uIGZhbGxiYWNrUGFwZXJHYXRlcyhzdGF0ZSkgewogICAgY29uc3Qgcm93cyA9IFsKICAgICAgewogICAgICAgIG5hbWU6ICdBSSBCVVkgUkVBRFknLAogICAgICAgIHBhc3M6IHN0YXRlID09PSAnQlVZIFJFQURZJywKICAgICAgICBjb2RlOiBzdGF0ZSA9PT0gJ0JMT0NLRUQnID8gJ0FJX0JMT0NLRUQnIDogbnVsbAogICAgICB9CiAgICBdOwoKICAgIGNvbnN0IG5hbWVzID0gWwogICAgICAnVmFsaWQgcHJpY2UnLAogICAgICAnRnJlc2ggdG9rZW4gZGF0YScsCiAgICAgICdObyBleGlzdGluZyBwb3NpdGlvbicsCiAgICAgICdQb3NpdGlvbiBjYXBhY2l0eScsCiAgICAgICdEYWlseSBlbnRyaWVzIGF2YWlsYWJsZScsCiAgICAgICdQb3NpdGlvbiBzaXplIHZhbGlkJywKICAgICAgJ0RhaWx5IHNwZW5kIGF2YWlsYWJsZScsCiAgICAgICdQYXBlciBjYXBpdGFsIGF2YWlsYWJsZScsCiAgICAgICdTYWZldHkgY29udHJvbHMgY2xlYXInCiAgICBdOwoKICAgIGZvciAoY29uc3QgbmFtZSBvZiBuYW1lcykgewogICAgICByb3dzLnB1c2goeyBuYW1lLCBwYXNzOiBmYWxzZSwgY29kZTogbnVsbCB9KTsKICAgIH0KCiAgICByZXR1cm4gcm93czsKICB9CgogIGFzeW5jIGZ1bmN0aW9uIHBhcGVyR2F0ZXMoY2FuZGlkYXRlLCBzdGF0ZSwgcmVxdWVzdEdlbmVyYXRpb24pIHsKICAgIGNvbnN0IG1pbnQgPSBtaW50T2YoY2FuZGlkYXRlKTsKICAgIGlmICghbWludCkgcmV0dXJuIGZhbGxiYWNrUGFwZXJHYXRlcyhzdGF0ZSk7CgogICAgdHJ5IHsKICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgKICAgICAgICAnL2FwaS9wYXBlci9yZWFkaW5lc3M/bWludD0nICsgZW5jb2RlVVJJQ29tcG9uZW50KG1pbnQpLAogICAgICAgIHsKICAgICAgICAgIGNyZWRlbnRpYWxzOiAnaW5jbHVkZScsCiAgICAgICAgICBoZWFkZXJzOiB7IGFjY2VwdDogJ2FwcGxpY2F0aW9uL2pzb24nIH0sCiAgICAgICAgICBjYWNoZTogJ25vLXN0b3JlJwogICAgICAgIH0KICAgICAgKTsKCiAgICAgIGlmIChyZXF1ZXN0R2VuZXJhdGlvbiAhPT0gZ2VuZXJhdGlvbikgcmV0dXJuIG51bGw7CiAgICAgIGlmICghcmVzcG9uc2Uub2spIHRocm93IG5ldyBFcnJvcignSFRUUCAnICsgcmVzcG9uc2Uuc3RhdHVzKTsKCiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7CiAgICAgIGlmIChyZXF1ZXN0R2VuZXJhdGlvbiAhPT0gZ2VuZXJhdGlvbikgcmV0dXJuIG51bGw7CgogICAgICBjb25zdCBiYWNrZW5kID0gQXJyYXkuaXNBcnJheShkYXRhPy5jaGVja3MpID8gZGF0YS5jaGVja3MgOiBbXTsKICAgICAgY29uc3Qgcm93cyA9IFsKICAgICAgICB7CiAgICAgICAgICBuYW1lOiAnQUkgQlVZIFJFQURZJywKICAgICAgICAgIHBhc3M6IHN0YXRlID09PSAnQlVZIFJFQURZJywKICAgICAgICAgIGNvZGU6IHN0YXRlID09PSAnQkxPQ0tFRCcgPyAnQUlfQkxPQ0tFRCcgOiBudWxsCiAgICAgICAgfSwKICAgICAgICAuLi5iYWNrZW5kLm1hcChjaGVjayA9PiAoewogICAgICAgICAgbmFtZTogU3RyaW5nKGNoZWNrPy5uYW1lIHx8ICdDaGVjaycpLAogICAgICAgICAgcGFzczogY2hlY2s/LnBhc3MgPT09IHRydWUsCiAgICAgICAgICBjb2RlOiBjaGVjaz8uY29kZSB8fCBudWxsCiAgICAgICAgfSkpCiAgICAgIF07CgogICAgICByZXR1cm4gcm93cy5sZW5ndGggPT09IDEwID8gcm93cyA6IGZhbGxiYWNrUGFwZXJHYXRlcyhzdGF0ZSk7CiAgICB9IGNhdGNoIHsKICAgICAgcmV0dXJuIGZhbGxiYWNrUGFwZXJHYXRlcyhzdGF0ZSk7CiAgICB9CiAgfQoKICBmdW5jdGlvbiBsaXZlR2F0ZXMoY2FuZGlkYXRlLCBzdGF0ZSkgewogICAgY29uc3QgcXVvdGVBZ2UgPSBmaW5pdGUoY2FuZGlkYXRlPy5xdW90ZUFnZU1zKQogICAgICA/IE51bWJlcihjYW5kaWRhdGUucXVvdGVBZ2VNcykKICAgICAgOiBudWxsOwoKICAgIGNvbnN0IHNpemUgPSBOdW1iZXIoCiAgICAgIGNhbmRpZGF0ZT8uZXhlY3V0aW9uPy5zaXplU29sID8/CiAgICAgIGNhbmRpZGF0ZT8ucG9zaXRpb25TaXplID8/CiAgICAgIGNhbmRpZGF0ZT8ucG9zaXRpb25TaXplU29sCiAgICApOwoKICAgIGNvbnN0IHJpc2tSZWFkeSA9CiAgICAgIGNhbmRpZGF0ZT8uZXhlY3V0aW9uPy5yaXNrQXBwcm92ZWQgPT09IHRydWUgfHwKICAgICAgY2FuZGlkYXRlPy5yaXNrQXBwcm92ZWQgPT09IHRydWU7CgogICAgY29uc3Qgcm91dGVSZWFkeSA9CiAgICAgIGNhbmRpZGF0ZT8uZXhlY3V0aW9uPy5yb3V0ZUFwcHJvdmVkID09PSB0cnVlIHx8CiAgICAgIGNhbmRpZGF0ZT8ucm91dGVBcHByb3ZlZCA9PT0gdHJ1ZTsKCiAgICBjb25zdCB3YWxsZXQgPSBTdHJpbmcoCiAgICAgICQoJyN3YWxsZXRFeGVjdXRpb25HYXRlJyk/LnRleHRDb250ZW50IHx8ICcnCiAgICApLnRyaW0oKS50b1VwcGVyQ2FzZSgpOwoKICAgIGNvbnN0IGJhbGFuY2UgPSBTdHJpbmcoCiAgICAgICQoJyN3YWxsZXRCYWxhbmNlR2F0ZScpPy50ZXh0Q29udGVudCB8fCAnJwogICAgKS50cmltKCkudG9VcHBlckNhc2UoKTsKCiAgICByZXR1cm4gWwogICAgICB7IG5hbWU6ICdDYW5kaWRhdGUgc2VsZWN0ZWQnLCBwYXNzOiAhIWNhbmRpZGF0ZT8uaWQgfHwgISFtaW50T2YoY2FuZGlkYXRlKSB9LAogICAgICB7IG5hbWU6ICdBSSBCVVkgUkVBRFknLCBwYXNzOiBzdGF0ZSA9PT0gJ0JVWSBSRUFEWScgfSwKICAgICAgeyBuYW1lOiAnVmVyaWZpZWQgcHJpY2UnLCBwYXNzOiBmaW5pdGUoY2FuZGlkYXRlPy5wcmljZVNvbCA/PyBjYW5kaWRhdGU/LnByaWNlKSB9LAogICAgICB7IG5hbWU6ICdGcmVzaCBob2xkZXIgZXZpZGVuY2UnLCBwYXNzOiBjYW5kaWRhdGU/LmhvbGRlckZyZXNoID09PSB0cnVlIH0sCiAgICAgIHsgbmFtZTogJ1Jpc2sgYXBwcm92ZWQnLCBwYXNzOiByaXNrUmVhZHkgfSwKICAgICAgeyBuYW1lOiAnUm91dGUgYXBwcm92ZWQnLCBwYXNzOiByb3V0ZVJlYWR5IH0sCiAgICAgIHsgbmFtZTogJ0ZyZXNoIHF1b3RlJywgcGFzczogcXVvdGVBZ2UgIT09IG51bGwgJiYgcXVvdGVBZ2UgPD0gMTUwMDAgfSwKICAgICAgeyBuYW1lOiAnUG9zaXRpb24gc2l6ZSByZWFkeScsIHBhc3M6IE51bWJlci5pc0Zpbml0ZShzaXplKSAmJiBzaXplID4gMCB9LAogICAgICB7IG5hbWU6ICdXYWxsZXQgY29ubmVjdGVkJywgcGFzczogd2FsbGV0ID09PSAnQ09OTkVDVEVEJyB8fCB3YWxsZXQgPT09ICdQQVNTJyB9LAogICAgICB7IG5hbWU6ICdCYWxhbmNlIGFwcHJvdmVkJywgcGFzczogYmFsYW5jZSA9PT0gJ1BBU1MnIH0KICAgIF07CiAgfQoKICBmdW5jdGlvbiBjbGFzc2lmeShnYXRlLCBwYXBlck1vZGUsIHN0YXRlKSB7CiAgICBpZiAoZ2F0ZT8ucGFzcyA9PT0gdHJ1ZSkgewogICAgICByZXR1cm4geyBsYWJlbDogJ1BBU1MnLCBjbGFzc05hbWU6ICdwYXNzJyB9OwogICAgfQoKICAgIGlmICgKICAgICAgU3RyaW5nKGdhdGU/Lm5hbWUgfHwgJycpLnRvVXBwZXJDYXNlKCkgPT09ICdBSSBCVVkgUkVBRFknICYmCiAgICAgIHN0YXRlID09PSAnQkxPQ0tFRCcKICAgICkgewogICAgICByZXR1cm4geyBsYWJlbDogJ0JMT0NLRUQnLCBjbGFzc05hbWU6ICdibG9ja2VkJyB9OwogICAgfQoKICAgIGlmICgKICAgICAgcGFwZXJNb2RlICYmCiAgICAgIEhBUkRfUEFQRVJfQ09ERVMuaGFzKFN0cmluZyhnYXRlPy5jb2RlIHx8ICcnKSkKICAgICkgewogICAgICByZXR1cm4geyBsYWJlbDogJ0JMT0NLRUQnLCBjbGFzc05hbWU6ICdibG9ja2VkJyB9OwogICAgfQoKICAgIHJldHVybiB7IGxhYmVsOiAnUEVORElORycsIGNsYXNzTmFtZTogJ3BlbmRpbmcnIH07CiAgfQoKICBmdW5jdGlvbiBibG9ja2VyVGV4dChnYXRlLCBzdGF0ZSwgcGFwZXJNb2RlKSB7CiAgICBpZiAoIWdhdGUpIHsKICAgICAgcmV0dXJuIHBhcGVyTW9kZQogICAgICAgID8gJ0FsbCBQQVBFUiBleGVjdXRpb24gY2hlY2tzIHBhc3NlZC4nCiAgICAgICAgOiAnQWxsIExJVkUgcHJlLXRyYWRlIGNoZWNrcyBwYXNzZWQuJzsKICAgIH0KCiAgICBpZiAoU3RyaW5nKGdhdGUubmFtZSB8fCAnJykudG9VcHBlckNhc2UoKSA9PT0gJ0FJIEJVWSBSRUFEWScpIHsKICAgICAgcmV0dXJuIHN0YXRlID09PSAnQkxPQ0tFRCcKICAgICAgICA/ICdUaGUgY3VycmVudCBBSSBkZWNpc2lvbiBpcyBCTE9DS0VEIGJ5IHRoZSBldmFsdWF0aW9uIGdhdGVzLicKICAgICAgICA6ICdXYWl0aW5nIGZvciB0aGUgQUkgZGVjaXNpb24gdG8gcmVhY2ggQlVZIFJFQURZLic7CiAgICB9CgogICAgY29uc3QgbWVzc2FnZXMgPSB7CiAgICAgIElOVkFMSURfUFJJQ0U6ICdXYWl0aW5nIGZvciBhIHZhbGlkIHZlcmlmaWVkIHRva2VuIHByaWNlLicsCiAgICAgIFNUQUxFX0RFQ0lTSU9OOiAnV2FpdGluZyBmb3IgYSBmcmVzaCBkZWNpc2lvbiBzbmFwc2hvdC4nLAogICAgICBTVEFMRV9UT0tFTl9EQVRBOiAnV2FpdGluZyBmb3IgZnJlc2ggaG9sZGVyIGFuZCB0b2tlbiBldmlkZW5jZS4nLAogICAgICBQT1NJVElPTl9FWElTVFM6ICdBIFBBUEVSIHBvc2l0aW9uIGZvciB0aGlzIHRva2VuIGlzIGFscmVhZHkgb3Blbi4nLAogICAgICBNQVhfT1BFTl9QT1NJVElPTlM6ICdUaGUgY29uZmlndXJlZCBtYXhpbXVtIG51bWJlciBvZiBvcGVuIHBvc2l0aW9ucyBoYXMgYmVlbiByZWFjaGVkLicsCiAgICAgIE1BWF9EQUlMWV9FTlRSSUVTOiAnVGhlIGNvbmZpZ3VyZWQgZGFpbHkgZW50cnkgbGltaXQgaGFzIGJlZW4gcmVhY2hlZC4nLAogICAgICBJTlZBTElEX1BPU0lUSU9OX1NJWkU6ICdQb3NpdGlvbiBzaXplIGlzIG91dHNpZGUgdGhlIGNvbmZpZ3VyZWQgbGltaXRzLicsCiAgICAgIERBSUxZX1NQRU5EX0xJTUlUOiAnVGhpcyBlbnRyeSB3b3VsZCBleGNlZWQgdGhlIGNvbmZpZ3VyZWQgZGFpbHkgc3BlbmQgbGltaXQuJywKICAgICAgUEFQRVJfQ0FQSVRBTF9MSU1JVDogJ0F2YWlsYWJsZSBQQVBFUiBjYXBpdGFsIGlzIGluc3VmZmljaWVudCBmb3IgdGhpcyBlbnRyeS4nLAogICAgICBLSUxMX1NXSVRDSDogJ1RoZSBhY2NvdW50IGtpbGwgc3dpdGNoIGlzIGFjdGl2ZS4nLAogICAgICBEQUlMWV9MT1NTX0xJTUlUOiAnVGhlIGNvbmZpZ3VyZWQgZGFpbHkgbG9zcyBsaW1pdCBpcyBhY3RpdmUuJwogICAgfTsKCiAgICByZXR1cm4gbWVzc2FnZXNbU3RyaW5nKGdhdGUuY29kZSB8fCAnJyldIHx8CiAgICAgIGAke2dhdGUubmFtZSB8fCAnVGhpcyBjaGVjayd9IGhhcyBub3QgcGFzc2VkIHlldC5gOwogIH0KCiAgZnVuY3Rpb24gc2V0VGV4dChzZWxlY3RvciwgdmFsdWUpIHsKICAgIGNvbnN0IGVsZW1lbnQgPSAkKHNlbGVjdG9yKTsKICAgIGlmIChlbGVtZW50KSBlbGVtZW50LnRleHRDb250ZW50ID0gdmFsdWU7CiAgfQoKICBmdW5jdGlvbiByZW5kZXJSb3dzKHJvd3MpIHsKICAgIGNvbnN0IGxpc3QgPSAkKCcjZXhlY3V0aW9uQ2hlY2tMaXN0Jyk7CiAgICBpZiAoIWxpc3QpIHJldHVybjsKCiAgICBjb25zdCBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTsKCiAgICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzKSB7CiAgICAgIGNvbnN0IGl0ZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTsKICAgICAgaXRlbS5jbGFzc05hbWUgPSBgZGF0YS1yb3cgZXhlY3V0aW9uLWNoZWNrLXJvdyAke3Jvdy51aS5jbGFzc05hbWV9YDsKICAgICAgaXRlbS5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnbGlzdGl0ZW0nKTsKICAgICAgaWYgKHJvdy5jb2RlKSBpdGVtLmRhdGFzZXQuZ2F0ZUNvZGUgPSBTdHJpbmcocm93LmNvZGUpOwoKICAgICAgY29uc3QgbGVmdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTsKICAgICAgbGVmdC5jbGFzc05hbWUgPSAnZXhlY3V0aW9uLWNoZWNrLW5hbWUnOwoKICAgICAgY29uc3QgZG90ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaScpOwogICAgICBkb3Quc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7CgogICAgICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2InKTsKICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSBTdHJpbmcocm93Lm5hbWUgfHwgJ0NoZWNrJyk7CgogICAgICBjb25zdCBzdGF0dXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdlbScpOwogICAgICBzdGF0dXMudGV4dENvbnRlbnQgPSByb3cudWkubGFiZWw7CgogICAgICBsZWZ0LmFwcGVuZChkb3QsIGxhYmVsKTsKICAgICAgaXRlbS5hcHBlbmQobGVmdCwgc3RhdHVzKTsKICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoaXRlbSk7CiAgICB9CgogICAgbGlzdC5yZXBsYWNlQ2hpbGRyZW4oZnJhZ21lbnQpOwogIH0KCiAgZnVuY3Rpb24gcmVuZGVyKGdhdGVzLCBwYXBlck1vZGUsIHN0YXRlKSB7CiAgICBpZiAoIUFycmF5LmlzQXJyYXkoZ2F0ZXMpIHx8ICFnYXRlcy5sZW5ndGgpIHJldHVybjsKCiAgICBjb25zdCByb3dzID0gZ2F0ZXMubWFwKGdhdGUgPT4gKHsKICAgICAgLi4uZ2F0ZSwKICAgICAgdWk6IGNsYXNzaWZ5KGdhdGUsIHBhcGVyTW9kZSwgc3RhdGUpCiAgICB9KSk7CgogICAgY29uc3QgcGFzc2VkID0gcm93cy5maWx0ZXIocm93ID0+IHJvdy5wYXNzID09PSB0cnVlKS5sZW5ndGg7CiAgICBjb25zdCB0b3RhbCA9IHJvd3MubGVuZ3RoOwogICAgY29uc3Qgc2FmZSA9IHBhc3NlZCA9PT0gdG90YWw7CiAgICBjb25zdCBibG9ja2VkID0gcm93cy5maWx0ZXIocm93ID0+IHJvdy51aS5jbGFzc05hbWUgPT09ICdibG9ja2VkJykubGVuZ3RoOwogICAgY29uc3QgcGVuZGluZyA9IHJvd3MuZmlsdGVyKHJvdyA9PiByb3cudWkuY2xhc3NOYW1lID09PSAncGVuZGluZycpLmxlbmd0aDsKICAgIGNvbnN0IGZpcnN0RmFpbGVkID0gcm93cy5maW5kKHJvdyA9PiByb3cucGFzcyAhPT0gdHJ1ZSkgfHwgbnVsbDsKCiAgICBzZXRUZXh0KCcjZXhlY3V0aW9uUmVhZGluZXNzQ291bnQnLCBgJHtwYXNzZWR9IC8gJHt0b3RhbH0gY2hlY2tzYCk7CiAgICBzZXRUZXh0KAogICAgICAnI2V4ZWN1dGlvblJlYWRpbmVzc0xhYmVsJywKICAgICAgc2FmZQogICAgICAgID8gKHBhcGVyTW9kZSA/ICdQYXBlciBleGVjdXRpb24gcmVhZHknIDogJ0FsbCBwcmUtdHJhZGUgY2hlY2tzIHBhc3NlZCcpCiAgICAgICAgOiBibG9ja2VkCiAgICAgICAgICA/IGAke2Jsb2NrZWR9IGJsb2NrZWQgwrcgJHtwZW5kaW5nfSBwZW5kaW5nYAogICAgICAgICAgOiBgJHtwZW5kaW5nfSBwZW5kaW5nYAogICAgKTsKCiAgICBjb25zdCBiYXIgPSAkKCcjZXhlY3V0aW9uUmVhZGluZXNzQmFyJyk7CiAgICBpZiAoYmFyKSB7CiAgICAgIGJhci5zdHlsZS53aWR0aCA9IGAke01hdGgucm91bmQoKHBhc3NlZCAvIHRvdGFsKSAqIDEwMCl9JWA7CiAgICB9CgogICAgY29uc3Qgc3RhdGVFbGVtZW50ID0gJCgnI2V4ZWN1dGlvblN0YXRlJyk7CiAgICBpZiAoc3RhdGVFbGVtZW50KSB7CiAgICAgIHN0YXRlRWxlbWVudC50ZXh0Q29udGVudCA9IHNhZmUKICAgICAgICA/IChwYXBlck1vZGUgPyAnUEFQRVIgUkVBRFknIDogJ1NBRkUnKQogICAgICAgIDogJ0xPQ0tFRCc7CiAgICAgIHN0YXRlRWxlbWVudC5jbGFzc05hbWUgPSBgc3RhdGUgJHtzYWZlID8gJ2J1eScgOiAnd2FpdCd9YDsKICAgIH0KCiAgICBjb25zdCBleHBsYWluZXIgPSAkKCcjZXhlY3V0aW9uU2lnbmFsRXhwbGFpbmVyJyk7CiAgICBpZiAoZXhwbGFpbmVyKSB7CiAgICAgIGNvbnN0IGFpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYicpOwogICAgICBhaS50ZXh0Q29udGVudCA9ICdBSSBzaWduYWw6JzsKICAgICAgY29uc3QgZXhlY3V0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYicpOwogICAgICBleGVjdXRpb24udGV4dENvbnRlbnQgPSAnRXhlY3V0aW9uOic7CgogICAgICBleHBsYWluZXIucmVwbGFjZUNoaWxkcmVuKAogICAgICAgIGFpLAogICAgICAgIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGAgJHtzdGF0ZX0gwrcgYCksCiAgICAgICAgZXhlY3V0aW9uLAogICAgICAgIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKAogICAgICAgICAgc2FmZQogICAgICAgICAgICA/IGAgJHtwYXBlck1vZGUgPyAnUEFQRVIgUkVBRFknIDogJ1NBRkUgVE8gVkFMSURBVEUnfWAKICAgICAgICAgICAgOiAnIExPQ0tFRCcKICAgICAgICApCiAgICAgICk7CiAgICB9CgogICAgc2V0VGV4dCgKICAgICAgJyNwcmltYXJ5QmxvY2tlclRpdGxlJywKICAgICAgc2FmZQogICAgICAgID8gKHBhcGVyTW9kZSA/ICdQYXBlciBleGVjdXRpb24gcmVhZHknIDogJ0FsbCBjaGVja3MgcGFzc2VkJykKICAgICAgICA6IFN0cmluZyhmaXJzdEZhaWxlZD8ubmFtZSB8fCAnVmFsaWRhdGlvbiBwZW5kaW5nJykKICAgICk7CgogICAgc2V0VGV4dCgKICAgICAgJyNwcmltYXJ5QmxvY2tlclRleHQnLAogICAgICBibG9ja2VyVGV4dChmaXJzdEZhaWxlZCwgc3RhdGUsIHBhcGVyTW9kZSkKICAgICk7CgogICAgY29uc3QgYWN0aW9uID0gJCgnI3ByaW1hcnlCbG9ja2VyQWN0aW9uJyk7CiAgICBpZiAoYWN0aW9uKSB7CiAgICAgIGFjdGlvbi50ZXh0Q29udGVudCA9IHNhZmUKICAgICAgICA/IChwYXBlck1vZGUgPyAnVmlldyBwb3NpdGlvbnMnIDogJ1ZhbGlkYXRlIGV4ZWN1dGlvbicpCiAgICAgICAgOiAnVmlldyBkZWNpc2lvbic7CiAgICAgIGFjdGlvbi5ocmVmID0gc2FmZQogICAgICAgID8gKHBhcGVyTW9kZSA/ICcjcG9zaXRpb25zJyA6ICcjZXhlY3V0aW9uUHJldmlldycpCiAgICAgICAgOiAnI3ByaW1hcnktY2FuZGlkYXRlJzsKICAgIH0KCiAgICBzZXRUZXh0KAogICAgICAnI2V4ZWN1dGlvblBlbmRpbmdDb3VudCcsCiAgICAgIHNhZmUKICAgICAgICA/ICdBbGwgcGFzc2VkJwogICAgICAgIDogYmxvY2tlZAogICAgICAgICAgPyBgJHtibG9ja2VkfSBibG9ja2VkIMK3ICR7cGVuZGluZ30gcGVuZGluZ2AKICAgICAgICAgIDogYCR7cGVuZGluZ30gcGVuZGluZ2AKICAgICk7CgogICAgcmVuZGVyUm93cyhyb3dzKTsKCiAgICBjb25zdCBwcmV2aWV3ID0gJCgnI2V4ZWN1dGlvblByZXZpZXcnKTsKICAgIGlmIChwcmV2aWV3KSB7CiAgICAgIHByZXZpZXcuY2xhc3NMaXN0LnRvZ2dsZSgnbG9ja2VkJywgIXNhZmUpOwogICAgICBwcmV2aWV3LmRhdGFzZXQuZXhlY3V0aW9uTW9kZSA9IHBhcGVyTW9kZSA/ICdwYXBlcicgOiAnbGl2ZSc7CiAgICB9CgogICAgbGFzdFN0YXRlID0gewogICAgICBwYXBlck1vZGUsCiAgICAgIHN0YXRlLAogICAgICBzYWZlLAogICAgICBnYXRlczogcm93cy5tYXAoKHsgdWksIC4uLmdhdGUgfSkgPT4gZ2F0ZSkKICAgIH07CiAgfQoKICBmdW5jdGlvbiBiaW5kVG9nZ2xlKCkgewogICAgY29uc3QgaG9zdCA9ICQoJyNleGVjdXRpb25QcmV2aWV3Jyk7CiAgICBjb25zdCBidXR0b24gPSAkKCcjZXhlY3V0aW9uQ2hlY2tzVG9nZ2xlJyk7CiAgICBjb25zdCBsaXN0ID0gJCgnI2V4ZWN1dGlvbkNoZWNrTGlzdCcpOwogICAgY29uc3QgbGFiZWwgPSAkKCcjZXhlY3V0aW9uQ2hlY2tzVG9nZ2xlTGFiZWwnKTsKCiAgICBpZiAoIWhvc3QgfHwgIWJ1dHRvbiB8fCAhbGlzdCkgcmV0dXJuOwogICAgaWYgKGJ1dHRvbi5kYXRhc2V0Lm1mUHJldHJhZGVWNEJvdW5kID09PSAnMScpIHJldHVybjsKCiAgICBidXR0b24uZGF0YXNldC5tZlByZXRyYWRlVjRCb3VuZCA9ICcxJzsKICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHsKICAgICAgY29uc3Qgb3BlbiA9IGJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnKSAhPT0gJ3RydWUnOwogICAgICBidXR0b24uc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgU3RyaW5nKG9wZW4pKTsKICAgICAgaG9zdC5jbGFzc0xpc3QudG9nZ2xlKCdtZi1wbS1jaGVja3Mtb3BlbicsIG9wZW4pOwogICAgICBsaXN0LmhpZGRlbiA9ICFvcGVuOwogICAgICBpZiAobGFiZWwpIGxhYmVsLnRleHRDb250ZW50ID0gb3BlbiA/ICdIaWRlIGNoZWNrcycgOiAnQWxsIGNoZWNrcyc7CiAgICB9KTsKICB9CgogIGFzeW5jIGZ1bmN0aW9uIHJlZnJlc2goKSB7CiAgICBiaW5kVG9nZ2xlKCk7CgogICAgY29uc3QgcmVxdWVzdEdlbmVyYXRpb24gPSArK2dlbmVyYXRpb247CiAgICBjb25zdCBjYW5kaWRhdGUgPSBzZWxlY3RlZENhbmRpZGF0ZSgpOwogICAgY29uc3Qgc3RhdGUgPSBkZWNpc2lvblN0YXRlKGNhbmRpZGF0ZSk7CiAgICBjb25zdCBwYXBlck1vZGUgPSBtb2RlKCkuaW5jbHVkZXMoJ3BhcGVyJyk7CgogICAgY29uc3QgZ2F0ZXMgPSBwYXBlck1vZGUKICAgICAgPyBhd2FpdCBwYXBlckdhdGVzKGNhbmRpZGF0ZSwgc3RhdGUsIHJlcXVlc3RHZW5lcmF0aW9uKQogICAgICA6IGxpdmVHYXRlcyhjYW5kaWRhdGUsIHN0YXRlKTsKCiAgICBpZiAocmVxdWVzdEdlbmVyYXRpb24gIT09IGdlbmVyYXRpb24gfHwgIWdhdGVzKSByZXR1cm47CiAgICByZW5kZXIoZ2F0ZXMsIHBhcGVyTW9kZSwgc3RhdGUpOwogIH0KCiAgZnVuY3Rpb24gc2NoZWR1bGVSZWZyZXNoKCkgewogICAgcXVldWVNaWNyb3Rhc2soKCkgPT4gewogICAgICByZWZyZXNoKCkuY2F0Y2goKCkgPT4ge30pOwogICAgfSk7CiAgfQoKICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtZW1lZmxvdzpzdGF0ZWNoYW5nZScsIHNjaGVkdWxlUmVmcmVzaCk7CiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lbWVmbG93OmNhbmRpZGF0ZWNoYW5nZScsIHNjaGVkdWxlUmVmcmVzaCk7CiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21mOndhbGxldC1jaGFuZ2UnLCBzY2hlZHVsZVJlZnJlc2gpOwoKICBmdW5jdGlvbiBib290KCkgewogICAgYmluZFRvZ2dsZSgpOwogICAgcmVmcmVzaCgpLmNhdGNoKCgpID0+IHt9KTsKICAgIHRpbWVyID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHsKICAgICAgcmVmcmVzaCgpLmNhdGNoKCgpID0+IHt9KTsKICAgIH0sIDUwMDApOwogIH0KCiAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJykgewogICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGJvb3QsIHsgb25jZTogdHJ1ZSB9KTsKICB9IGVsc2UgewogICAgYm9vdCgpOwogIH0KCiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BhZ2VoaWRlJywgKCkgPT4gewogICAgaWYgKHRpbWVyKSB7CiAgICAgIGNsZWFySW50ZXJ2YWwodGltZXIpOwogICAgICB0aW1lciA9IG51bGw7CiAgICB9CiAgfSwgeyBvbmNlOiB0cnVlIH0pOwoKICB3aW5kb3cuTUVNRUZMT1dfUFJFVFJBREVfVUkgPSB7CiAgICB2ZXJzaW9uOiA0LAogICAgcmVmcmVzaCwKICAgIGdldFN0YXRlOiAoKSA9PiBsYXN0U3RhdGUKICAgICAgPyBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGxhc3RTdGF0ZSkpCiAgICAgIDogbnVsbAogIH07Cn0pKCk7Cg==' | base64 -d > "$WORK_MODULE"

rollback(){
  cp "$INDEX_BAK" "$INDEX" 2>/dev/null || true
  cp "$PAPER_BAK" "$PAPER_UI" 2>/dev/null || true
  if [[ "$MODULE_EXISTED" == "1" && -n "$MODULE_BAK" ]]; then
    cp "$MODULE_BAK" "$V4_MODULE" 2>/dev/null || true
  else
    rm -f "$V4_MODULE"
  fi
  rm -f "$WORK_INDEX" "$WORK_PAPER" "$WORK_MODULE"
}
trap 'echo "ERROR: install failed; restoring exact pre-install files."; rollback' ERR

python3 - "$WORK_INDEX" "$WORK_PAPER" "$CLEAN_BASE" <<'PY'
from pathlib import Path
import re, sys

index_path = Path(sys.argv[1])
paper_path = Path(sys.argv[2])
clean_path = Path(sys.argv[3])

current = index_path.read_text(encoding='utf-8')
paper = paper_path.read_text(encoding='utf-8')
clean = clean_path.read_text(encoding='utf-8')

# 1) Restore ONLY production-core-js from the exact pre-V2 clean base.
#    This removes the malformed V2 readiness rewrite without reverting
#    the V2 HTML/CSS design or the earlier AI Analysis button fix.
script_re = re.compile(
    r'<script id="production-core-js">.*?</script>',
    re.S
)
clean_hits = script_re.findall(clean)
current_hits = script_re.findall(current)
if len(clean_hits) != 1 or len(current_hits) != 1:
    raise SystemExit(
        f'production-core-js lookup failed: clean={len(clean_hits)}, current={len(current_hits)}'
    )

core = clean_hits[0]

# 2) In the clean core, disable ONLY its old visible Pre-trade DOM writes.
#    Calculations, backend fetches, validateBtn and compatibility anchors stay intact.
marker = '// Unified PAPER/LIVE execution readiness.'
end_marker = '// Mission/top context follows the same selected candidate.'
start = core.find(marker)
end = core.find(end_marker, start + 1 if start >= 0 else 0)
if start < 0 or end < 0 or end <= start:
    raise SystemExit('Could not isolate the authoritative readiness subsection in clean production-core-js.')

before = core[:start]
section = core[start:end]
after = core[end:]

redirect = {
    '#executionReadinessCount': '#legacyExecutionReadinessCountDisabled',
    '#executionReadinessLabel': '#legacyExecutionReadinessLabelDisabled',
    '#executionReadinessBar': '#legacyExecutionReadinessBarDisabled',
    '#executionState': '#legacyExecutionStateDisabled',
    '#executionSignalExplainer': '#legacyExecutionSignalExplainerDisabledV4',
    '#primaryBlockerTitle': '#legacyPrimaryBlockerTitleDisabledV4',
    '#primaryBlockerText': '#legacyPrimaryBlockerTextDisabledV4',
    '#primaryBlockerAction': '#legacyPrimaryBlockerActionDisabledV4',
}

for old, new in redirect.items():
    if old not in section:
        raise SystemExit(f'Expected readiness selector missing from clean subsection: {old}')
    section = section.replace(old, new)

# The old core also toggles the visible preview lock class. V4 owns that UI state.
section = section.replace(
    "const preview=$('#executionPreview');",
    "const preview=$('#legacyExecutionPreviewDisabledV4');"
)

core = before + section + after
current = script_re.sub(core, current, count=1)

# 3) Promote the V2 source marker to V4. HTML/CSS geometry is kept exactly.
if current.count('data-mf-pretrade-v2="1"') != 1:
    raise SystemExit('Expected exactly one V2 source marker.')
current = current.replace(
    'data-mf-pretrade-v2="1"',
    'data-mf-pretrade-v4="1"',
    1
)

# 4) Remove V2's button owner. The source button stays; only V4 binds it.
toggle_re = re.compile(
    r'\n  function bindChecksToggle\(\)\{.*?\n  \}\n\n  function init\(\)\{',
    re.S
)
current, n_toggle = toggle_re.subn('\n  function init(){', current, count=1)
if n_toggle != 1:
    raise SystemExit(f'Expected exactly one V2 bindChecksToggle() function; found {n_toggle}.')

current, n_call = re.subn(
    r'\n\s*bindChecksToggle\(\);',
    '',
    current,
    count=1
)
if n_call != 1:
    raise SystemExit(f'Expected exactly one V2 bindChecksToggle() call; found {n_call}.')

# 5) Remove paper-automation-ui.js legacy blocker ownership.
legacy_re = re.compile(
    r'\n  function technicalExecutionReasons\(\) \{.*?'
    r'\n  let queued = false;',
    re.S
)
paper, n_legacy = legacy_re.subn('\n  let queued = false;', paper, count=1)
if n_legacy != 1:
    raise SystemExit(f'Expected one legacy blocker block; found {n_legacy}.')

paper, n_legacy_call = re.subn(
    r'\n\s*isolateExecutionBlocker\(\);',
    '',
    paper,
    count=1
)
if n_legacy_call != 1:
    raise SystemExit(f'Expected one isolateExecutionBlocker() call; found {n_legacy_call}.')

# 6) Load one presentation-only module. No CSS/style tag is added.
script_tag = '<script src="./pretrade-control-center-v4.js?v=4.0.0" defer></script>'
if script_tag not in current:
    anchor = '<script defer src="paper-automation-ui.js"></script>'
    if current.count(anchor) != 1:
        raise SystemExit('Expected exactly one paper-automation-ui.js script tag.')
    current = current.replace(anchor, anchor + '\n' + script_tag, 1)

# Remove failed/obsolete V3 reference if it somehow survived a manual copy.
current = re.sub(
    r'\s*<script src="\./pretrade-control-center-v3\.js[^>]*></script>',
    '',
    current
)

checks = {
    'V4 marker': current.count('data-mf-pretrade-v4="1"') == 1,
    'V2 marker removed': 'data-mf-pretrade-v2="1"' not in current,
    'one V4 module reference': current.count('pretrade-control-center-v4.js?v=4.0.0') == 1,
    'V2 toggle owner removed': 'function bindChecksToggle()' not in current,
    'legacy blocker owner removed': 'function isolateExecutionBlocker()' not in paper,
    'legacy technical reasons removed': 'function technicalExecutionReasons()' not in paper,
    'visible readiness count redirected in core': "'#executionReadinessCount'" not in section,
    'visible blocker title redirected in core': "'#primaryBlockerTitle'" not in section,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Ownership verification failed: ' + ', '.join(failed))

index_path.write_text(current, encoding='utf-8')
paper_path.write_text(paper, encoding='utf-8')
print('Clean V4 source ownership prepared.')
PY

# -------- Pre-install syntax validation --------
# Validate standalone changed files.
node --check < "$WORK_PAPER"
node --check < "$WORK_MODULE"

# Validate every INLINE script we actually modified:
# production-core-js and the premium-mobile script containing init().
python3 - "$WORK_INDEX" "$PATCH_DIR" "$STAMP" <<'PY'
from pathlib import Path
import re, sys

html = Path(sys.argv[1]).read_text(encoding='utf-8')
outdir = Path(sys.argv[2])
stamp = sys.argv[3]

# production-core-js
m = re.search(
    r'<script id="production-core-js">(.*?)</script>',
    html,
    flags=re.S
)
if not m:
    raise SystemExit('production-core-js extraction failed.')
(outdir / f'production-core.{stamp}.js').write_text(m.group(1), encoding='utf-8')

# premium mobile script: uniquely identified by tagManualScan + syncPrimaryEmpty
scripts = re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', html, flags=re.S|re.I)
hits = [s for s in scripts if 'tagManualScan' in s and 'syncPrimaryEmpty' in s]
if len(hits) != 1:
    raise SystemExit(f'Premium mobile inline script extraction failed: {len(hits)} matches.')
(outdir / f'premium-mobile.{stamp}.js').write_text(hits[0], encoding='utf-8')
PY

node --check < "$PATCH_DIR/production-core.$STAMP.js"
node --check < "$PATCH_DIR/premium-mobile.$STAMP.js"

# No CSS or observer is allowed in the V4 controller.
if grep -q 'MutationObserver' "$WORK_MODULE"; then
  echo "ERROR: V4 controller unexpectedly contains MutationObserver."
  exit 1
fi
if grep -q '<style\|style.textContent' "$WORK_MODULE"; then
  echo "ERROR: V4 controller unexpectedly contains a CSS/style layer."
  exit 1
fi

# Only after every validation passes do we replace production files.
cp "$WORK_INDEX" "$INDEX"
cp "$WORK_PAPER" "$PAPER_UI"
cp "$WORK_MODULE" "$V4_MODULE"

# Remove obsolete failed V3 module only after V4 is safely installed.
if ! grep -q 'pretrade-control-center-v3.js' "$INDEX"; then
  rm -f "$APP/pretrade-control-center-v3.js"
fi

# Final production validation.
grep -q 'data-mf-pretrade-v4="1"' "$INDEX"
grep -q 'pretrade-control-center-v4.js?v=4.0.0' "$INDEX"
! grep -q 'function isolateExecutionBlocker()' "$PAPER_UI"
node --check "$PAPER_UI"
node --check "$V4_MODULE"

cat > "$PATCH_DIR/latest-manifest.txt" <<EOF
INDEX=$INDEX
INDEX_BAK=$INDEX_BAK
PAPER_UI=$PAPER_UI
PAPER_BAK=$PAPER_BAK
V4_MODULE=$V4_MODULE
MODULE_EXISTED=$MODULE_EXISTED
MODULE_BAK=$MODULE_BAK
EOF

rm -f "$WORK_INDEX" "$WORK_PAPER" "$WORK_MODULE"
rm -f "$PATCH_DIR/production-core.$STAMP.js" "$PATCH_DIR/premium-mobile.$STAMP.js"

trap - ERR

echo
echo "OK: PRE-TRADE CONTROL CENTER V4 installed cleanly."
echo
echo "production-core-js: restored from exact pre-V2 clean backup"
echo "Legacy visible pre-trade writer: DISABLED by selector redirect"
echo "paper-automation blocker writer: REMOVED"
echo "V2 toggle owner: REMOVED"
echo "Single visible UI owner: pretrade-control-center-v4.js"
echo "New CSS layers: NONE"
echo "Existing V2 CSS changed: NO"
echo "MutationObserver in V4: NONE"
echo "Overlay/cloned block: NONE"
echo "PaperEngine/server readiness gates: UNCHANGED"
echo "All modified JS syntax checks: PASS"
echo
echo "Do not Stop/Run yet. Send me this Shell result first."
