#!/usr/bin/env python3
from __future__ import annotations

import base64
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_PLATFORM_SOURCE_CLEAN_V5"
STAMP = time.strftime("%Y%m%d-%H%M%S")

COMPATIBILITY_CODE = base64.b64decode("CmNvbnN0IE1GMjkzX0RFWF9JR05PUkVEX0tFWVMgPSBuZXcgU2V0KFsKICAnbWluQm9uZGluZ0N1cnZlUGN0JywnbWF4Qm9uZGluZ0N1cnZlUGN0JywKICAnbWluVG90YWxGZWVzU29sJywnbWF4VG90YWxGZWVzU29sJywKICAnbWluRGV2ZWxvcGVyUGN0JywnbWF4RGV2ZWxvcGVyUGN0JywKICAnbWluQnVuZGxlUGN0JywnbWF4QnVuZGxlUGN0JywKICAnbWluU25pcGVyUGN0JywnbWF4U25pcGVyUGN0JywKICAnZGV2ZWxvcGVyQmxhY2tsaXN0V2FsbGV0cycKXSk7CgpmdW5jdGlvbiBtZjI5M1BsYXRmb3JtTGFiZWwobW9kZSkgewogIHJldHVybiBtb2RlID09PSAnZGV4JyA/ICdERVgnIDogbW9kZSA9PT0gJ2h5YnJpZCcgPyAnSHlicmlkJyA6ICdQdW1wLmZ1bic7Cn0KCmZ1bmN0aW9uIG1mMjkzUmVzdG9yZVBsYXRmb3JtRmllbGQoaW5wdXQsIHdyYXApIHsKICBpZiAoIWlucHV0IHx8ICF3cmFwKSByZXR1cm47CiAgaWYgKGlucHV0LmRhdGFzZXQubWYyOTNTb3VyY2VEaXNhYmxlZCA9PT0gJzEnKSB7CiAgICBpbnB1dC5kaXNhYmxlZCA9IGZhbHNlOwogICAgZGVsZXRlIGlucHV0LmRhdGFzZXQubWYyOTNTb3VyY2VEaXNhYmxlZDsKICB9CiAgd3JhcC5jbGFzc0xpc3QucmVtb3ZlKCdtZjI5My1zb3VyY2UtaW5hY3RpdmUnLCAnbWYyOTMtc291cmNlLWh5YnJpZCcpOwogIHdyYXAucXVlcnlTZWxlY3RvcignOnNjb3BlID4gLm1mMjkzLXNvdXJjZS1ub3RlJyk/LnJlbW92ZSgpOwp9CgpmdW5jdGlvbiBtZjI5M0FwcGx5U291cmNlQ29tcGF0aWJpbGl0eSgpIHsKICBjb25zdCBtb2RlID0gU3RyaW5nKE1GMjkzLmRpc2NvdmVyeVNvdXJjZU1vZGUgfHwgJ3B1bXAnKS50b0xvd2VyQ2FzZSgpOwoKICBmb3IgKGNvbnN0IGtleSBvZiBNRjI5M19ERVhfSUdOT1JFRF9LRVlTKSB7CiAgICBjb25zdCBpbnB1dCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYFtkYXRhLXNldHRpbmcta2V5PSIke2tleX0iXWApOwogICAgY29uc3Qgd3JhcCA9IGlucHV0Py5jbG9zZXN0KCcubWYyOTMtZmllbGQnKTsKICAgIGlmICghaW5wdXQgfHwgIXdyYXApIGNvbnRpbnVlOwoKICAgIG1mMjkzUmVzdG9yZVBsYXRmb3JtRmllbGQoaW5wdXQsIHdyYXApOwogICAgaWYgKG1vZGUgPT09ICdwdW1wJykgY29udGludWU7CgogICAgY29uc3Qgbm90ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NtYWxsJyk7CiAgICBub3RlLmNsYXNzTmFtZSA9ICdtZjI5My1zb3VyY2Utbm90ZSc7CgogICAgaWYgKG1vZGUgPT09ICdkZXgnKSB7CiAgICAgIGlucHV0LmRpc2FibGVkID0gdHJ1ZTsKICAgICAgaW5wdXQuZGF0YXNldC5tZjI5M1NvdXJjZURpc2FibGVkID0gJzEnOwogICAgICB3cmFwLmNsYXNzTGlzdC5hZGQoJ21mMjkzLXNvdXJjZS1pbmFjdGl2ZScpOwogICAgICBub3RlLnRleHRDb250ZW50ID0gJ05vdCB1c2VkIGluIERFWCBtb2RlJzsKICAgIH0gZWxzZSB7CiAgICAgIHdyYXAuY2xhc3NMaXN0LmFkZCgnbWYyOTMtc291cmNlLWh5YnJpZCcpOwogICAgICBub3RlLnRleHRDb250ZW50ID0gJ1B1bXAuZnVuIG9ubHkgwrcgaWdub3JlZCBmb3IgREVYIHRva2Vucyc7CiAgICB9CgogICAgd3JhcC5hcHBlbmRDaGlsZChub3RlKTsKICB9Cn0KCmFzeW5jIGZ1bmN0aW9uIG1mMjkzU2V0RGlzY292ZXJ5U291cmNlKGV2ZW50KSB7CiAgY29uc3Qgc2VsZWN0ID0gZXZlbnQ/LmN1cnJlbnRUYXJnZXQgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21mMjkzRGlzY292ZXJ5U291cmNlJyk7CiAgaWYgKCFzZWxlY3QgfHwgTUYyOTMuZGlzY292ZXJ5U291cmNlU2F2aW5nKSByZXR1cm47CgogIGNvbnN0IHByZXZpb3VzID0gU3RyaW5nKE1GMjkzLmRpc2NvdmVyeVNvdXJjZU1vZGUgfHwgJ3B1bXAnKS50b0xvd2VyQ2FzZSgpOwogIGNvbnN0IG5leHQgPSBTdHJpbmcoc2VsZWN0LnZhbHVlIHx8ICcnKS50b0xvd2VyQ2FzZSgpOwoKICBpZiAoIVsncHVtcCcsICdkZXgnLCAnaHlicmlkJ10uaW5jbHVkZXMobmV4dCkpIHsKICAgIHNlbGVjdC52YWx1ZSA9IHByZXZpb3VzOwogICAgcmV0dXJuOwogIH0KICBpZiAobmV4dCA9PT0gcHJldmlvdXMpIHJldHVybjsKCiAgTUYyOTMuZGlzY292ZXJ5U291cmNlU2F2aW5nID0gdHJ1ZTsKICBzZWxlY3QuZGlzYWJsZWQgPSB0cnVlOwogIG1mMjkzQ2xlYXJFcnJvcigpOwogIG1mMjkzU3RhdHVzKCdTd2l0Y2hpbmcnLCAnYnVzeScpOwoKICB0cnkgewogICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnL2FwaS9kaXNjb3Zlcnktc291cmNlJywgewogICAgICBtZXRob2Q6ICdQT1NUJywKICAgICAgY3JlZGVudGlhbHM6ICdzYW1lLW9yaWdpbicsCiAgICAgIGNhY2hlOiAnbm8tc3RvcmUnLAogICAgICBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6J2FwcGxpY2F0aW9uL2pzb24nfSwKICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe21vZGU6IG5leHR9KQogICAgfSk7CiAgICBjb25zdCBwYXlsb2FkID0gYXdhaXQgcmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpOwoKICAgIGlmICghcmVzcG9uc2Uub2spIHsKICAgICAgdGhyb3cgbmV3IEVycm9yKHBheWxvYWQ/Lm1lc3NhZ2UgfHwgcGF5bG9hZD8uZXJyb3IgfHwgJ1VuYWJsZSB0byBzd2l0Y2ggcGxhdGZvcm0nKTsKICAgIH0KCiAgICBNRjI5My5kaXNjb3ZlcnlTb3VyY2VNb2RlID0gU3RyaW5nKHBheWxvYWQ/LnNvdXJjZT8ubW9kZSB8fCBuZXh0KS50b0xvd2VyQ2FzZSgpOwogICAgaWYgKE1GMjkzLmNhcGFiaWxpdGllcykgewogICAgICBNRjI5My5jYXBhYmlsaXRpZXMuZGlzY292ZXJ5U291cmNlTW9kZSA9IE1GMjkzLmRpc2NvdmVyeVNvdXJjZU1vZGU7CiAgICB9CiAgICBzZWxlY3QudmFsdWUgPSBNRjI5My5kaXNjb3ZlcnlTb3VyY2VNb2RlOwogICAgbWYyOTNBcHBseVNvdXJjZUNvbXBhdGliaWxpdHkoKTsKICAgIG1mMjkzU3RhdHVzKGBQbGF0Zm9ybSDCtyAke21mMjkzUGxhdGZvcm1MYWJlbChNRjI5My5kaXNjb3ZlcnlTb3VyY2VNb2RlKX1gLCAnc2F2ZWQnKTsKICB9IGNhdGNoIChlcnJvcikgewogICAgTUYyOTMuZGlzY292ZXJ5U291cmNlTW9kZSA9IHByZXZpb3VzOwogICAgc2VsZWN0LnZhbHVlID0gcHJldmlvdXM7CiAgICBtZjI5M0FwcGx5U291cmNlQ29tcGF0aWJpbGl0eSgpOwogICAgbWYyOTNTdGF0dXMoJ1N3aXRjaCBmYWlsZWQnLCAnZXJyb3InKTsKICAgIG1mMjkzRXJyb3IoZXJyb3IubWVzc2FnZSB8fCAnVW5hYmxlIHRvIHN3aXRjaCBwbGF0Zm9ybScpOwogIH0gZmluYWxseSB7CiAgICBNRjI5My5kaXNjb3ZlcnlTb3VyY2VTYXZpbmcgPSBmYWxzZTsKICAgIHNlbGVjdC5kaXNhYmxlZCA9IGZhbHNlOwogIH0KfQo=").decode("utf-8")
CSS_EXTRA = base64.b64decode("Ci5tZjI5My1zZXR0aW5ncy1tZXRhIHNlbGVjdCB7CiAgZGlzcGxheTogYmxvY2s7CiAgd2lkdGg6IDEwMCU7CiAgbWluLXdpZHRoOiAwOwogIG1hcmdpbi10b3A6IDNweDsKICBwYWRkaW5nOiAwIDE0cHggMCAwOwogIGJvcmRlcjogMDsKICBvdXRsaW5lOiAwOwogIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50OwogIGNvbG9yOiAjZGJlOGVlOwogIGZvbnQ6IGluaGVyaXQ7CiAgZm9udC1zaXplOiAxMXB4OwogIGZvbnQtd2VpZ2h0OiA3MDA7CiAgdGV4dC10cmFuc2Zvcm06IG5vbmU7CiAgbGV0dGVyLXNwYWNpbmc6IDA7CiAgLXdlYmtpdC1hcHBlYXJhbmNlOiBub25lOwogIGFwcGVhcmFuY2U6IG5vbmU7Cn0KCi5tZjI5My1wbGF0Zm9ybS1tZXRhIHsKICBwb3NpdGlvbjogcmVsYXRpdmU7CiAgY3Vyc29yOiBwb2ludGVyOwp9CgoubWYyOTMtcGxhdGZvcm0tbWV0YTo6YWZ0ZXIgewogIGNvbnRlbnQ6ICIiOwogIHBvc2l0aW9uOiBhYnNvbHV0ZTsKICByaWdodDogOXB4OwogIGJvdHRvbTogMTJweDsKICB3aWR0aDogNXB4OwogIGhlaWdodDogNXB4OwogIGJvcmRlci1yaWdodDogMXB4IHNvbGlkICM3MTg5OTU7CiAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICM3MTg5OTU7CiAgdHJhbnNmb3JtOiByb3RhdGUoNDVkZWcpOwogIHBvaW50ZXItZXZlbnRzOiBub25lOwp9CgoubWYyOTMtc291cmNlLWluYWN0aXZlIHsKICBvcGFjaXR5OiAuMzg7CiAgZmlsdGVyOiBzYXR1cmF0ZSguMyk7Cn0KCi5tZjI5My1zb3VyY2UtaHlicmlkIHsKICBib3JkZXItY29sb3I6IHJnYmEoMTMyLCAxMTMsIDI1NSwgLjE4KTsKfQoKLm1mMjkzLXNvdXJjZS1ub3RlIHsKICBkaXNwbGF5OiBibG9jazsKICBtYXJnaW4tdG9wOiAycHg7CiAgY29sb3I6ICM2NDdkODg7CiAgZm9udC1zaXplOiA3cHg7CiAgbGluZS1oZWlnaHQ6IDEuMjU7CiAgZm9udC13ZWlnaHQ6IDU1MDsKfQoKLm1mMjkzLXNvdXJjZS1oeWJyaWQgLm1mMjkzLXNvdXJjZS1ub3RlIHsKICBjb2xvcjogIzgxNzdhODsKfQo=").decode("utf-8")
OLD_WRAPPER = base64.b64decode("Ly8gTUVNRUZMT1dfREVYX0NSRUFUT1JfTkFfV1JBUFBFUl9WMV8xCi8vIEEgY29uZmlybWVkIERFWCBwb29sIGRvZXMgbm90IHByb3ZlIHRoZSBvcmlnaW5hbCBjcmVhdG9yIHdhbGxldC4KLy8gVW5rbm93biBjcmVhdG9yIGRhdGEgaXMgTi9BLCBub3QgV0FJVElORyBhbmQgbm90IGZha2UgMCUuCmV4cG9ydCBmdW5jdGlvbiBldmFsdWF0ZSh0b2tlbiwgcyA9IHt9KSB7CiAgY29uc3QgZGV4Q3JlYXRvclVuYXZhaWxhYmxlID0KICAgIFN0cmluZyh0b2tlbj8ubGF1bmNoUGxhdGZvcm0gfHwgJycpLnRvTG93ZXJDYXNlKCkgPT09ICdkZXgnICYmCiAgICB0b2tlbj8uY3JlYXRvciA9PSBudWxsICYmCiAgICB0b2tlbj8uZGV2ZWxvcGVyUGN0ID09IG51bGw7CgogIGlmICghZGV4Q3JlYXRvclVuYXZhaWxhYmxlKSB7CiAgICByZXR1cm4gX19tZkV2YWx1YXRlQmFzZVYxMSh0b2tlbiwgcyk7CiAgfQoKICBjb25zdCByZXN1bHQgPSBfX21mRXZhbHVhdGVCYXNlVjExKAogICAgdG9rZW4sCiAgICB7Li4ucywgbWF4RGV2ZWxvcGVyUGN0Om51bGx9CiAgKTsKCiAgY29uc3QgZ2F0ZXMgPSByZXN1bHQ/LnNldHRpbmdzRXZhbHVhdGlvbj8uZ2F0ZXM7CiAgaWYgKEFycmF5LmlzQXJyYXkoZ2F0ZXMpKSB7CiAgICBnYXRlcy5wdXNoKHsKICAgICAgbmFtZTonRGV2ZWxvcGVyIGNvbmNlbnRyYXRpb24nLAogICAgICBzdGF0dXM6J04vQScsCiAgICAgIHBhc3M6dHJ1ZSwKICAgICAgcmVhc29uOidjcmVhdG9yIGlkZW50aXR5IHVuYXZhaWxhYmxlIGZyb20gY29uZmlybWVkIERFWCBwb29sJwogICAgfSk7CiAgfQoKICByZXR1cm4gcmVzdWx0Owp9Cg==").decode("utf-8")
NEW_WRAPPER = base64.b64decode("Ly8gTUVNRUZMT1dfREVYX1NPVVJDRV9DT01QQVRJQklMSVRZX1YyCi8vIERFWCBwb29scyBkbyBub3QgcHJvdmlkZSBQdW1wIGJvbmRpbmctY3VydmUvZmVlL2J1bmRsZS9zbmlwZXIgc2VtYW50aWNzLgovLyBEZXZlbG9wZXIgaWRlbnRpdHkgaXMgYWxzbyBub3QgYSByZWxpYWJsZSBERVgtcG9vbCBwcm9wZXJ0eS4KLy8gVGhlc2Ugb3duZXIgc2V0dGluZ3MgcmVtYWluIGFjdGl2ZSBmb3IgUHVtcCB0b2tlbnMgYW5kIGFyZSBOL0EgZm9yIERFWCB0b2tlbnMuCmV4cG9ydCBmdW5jdGlvbiBldmFsdWF0ZSh0b2tlbiwgcyA9IHt9KSB7CiAgY29uc3QgaXNEZXggPSBTdHJpbmcodG9rZW4/LmxhdW5jaFBsYXRmb3JtIHx8ICcnKS50b0xvd2VyQ2FzZSgpID09PSAnZGV4JzsKCiAgaWYgKCFpc0RleCkgewogICAgcmV0dXJuIF9fbWZFdmFsdWF0ZUJhc2VWMTEodG9rZW4sIHMpOwogIH0KCiAgY29uc3QgZGV4U2V0dGluZ3MgPSB7CiAgICAuLi5zLAogICAgbWluQm9uZGluZ0N1cnZlUGN0Om51bGwsCiAgICBtYXhCb25kaW5nQ3VydmVQY3Q6bnVsbCwKICAgIG1pblRvdGFsRmVlc1NvbDpudWxsLAogICAgbWF4VG90YWxGZWVzU29sOm51bGwsCiAgICBtaW5EZXZlbG9wZXJQY3Q6bnVsbCwKICAgIG1heERldmVsb3BlclBjdDpudWxsLAogICAgbWluQnVuZGxlUGN0Om51bGwsCiAgICBtYXhCdW5kbGVQY3Q6bnVsbCwKICAgIG1pblNuaXBlclBjdDpudWxsLAogICAgbWF4U25pcGVyUGN0Om51bGwsCiAgICBkZXZlbG9wZXJCbGFja2xpc3RXYWxsZXRzOltdCiAgfTsKCiAgY29uc3QgcmVzdWx0ID0gX19tZkV2YWx1YXRlQmFzZVYxMSh0b2tlbiwgZGV4U2V0dGluZ3MpOwogIGNvbnN0IGdhdGVzID0gcmVzdWx0Py5zZXR0aW5nc0V2YWx1YXRpb24/LmdhdGVzOwoKICBpZiAoQXJyYXkuaXNBcnJheShnYXRlcykpIHsKICAgIGdhdGVzLnB1c2goCiAgICAgIHtuYW1lOidCb25kaW5nIGN1cnZlIC8gUHVtcCBmZWVzJyxzdGF0dXM6J04vQScscGFzczp0cnVlLHJlYXNvbjonbm90IHVzZWQgZm9yIERFWCB0b2tlbnMnfSwKICAgICAge25hbWU6J0RldmVsb3BlciAvIGNyZWF0b3IgZmlsdGVycycsc3RhdHVzOidOL0EnLHBhc3M6dHJ1ZSxyZWFzb246J25vdCByZWxpYWJsZSBmcm9tIGNvbmZpcm1lZCBERVggcG9vbCd9LAogICAgICB7bmFtZTonQnVuZGxlIC8gc25pcGVyIGZpbHRlcnMnLHN0YXR1czonTi9BJyxwYXNzOnRydWUscmVhc29uOidub3QgcHJvdmlkZWQgYnkgdGhlIERFWCBkaXNjb3ZlcnkgcGF0aCd9CiAgICApOwogIH0KCiAgcmV0dXJuIHJlc3VsdDsKfQo=").decode("utf-8")

def log(msg):
    print("[PLATFORM-CLEAN-V5] " + str(msg), flush=True)

def find_root():
    candidates = [
        Path.cwd(),
        Path.cwd() / "memeflow-app",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace/memeflow-app"),
    ]
    for root in candidates:
        try:
            root = root.resolve()
        except Exception:
            continue
        if all((root / x).is_file() for x in (
            "system.js", "system.css", "system.html",
            "app-server.mjs", "src/evaluate.mjs"
        )):
            return root
    raise RuntimeError("MEMEFLOW project root not found")

ROOT = find_root()
FILES = {
    "system.js": ROOT / "system.js",
    "system.css": ROOT / "system.css",
    "system.html": ROOT / "system.html",
    "app-server.mjs": ROOT / "app-server.mjs",
    "src/evaluate.mjs": ROOT / "src/evaluate.mjs",
}
BACK = ROOT / (".platform-clean-v5-backup-" + STAMP)
BACK.mkdir(parents=True, exist_ok=True)
changed = []

def backup(path):
    if path in changed:
        return
    rel = path.relative_to(ROOT)
    dst = BACK / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dst)
    changed.append(path)

def write(path, text):
    backup(path)
    path.write_text(text, encoding="utf-8")
    log("patched " + str(path.relative_to(ROOT)))

def rollback(reason):
    log("ERROR: " + str(reason))
    for path in reversed(changed):
        src = BACK / path.relative_to(ROOT)
        if src.exists():
            shutil.copy2(src, path)
            log("restored " + str(path.relative_to(ROOT)))
    log("ROLLBACK COMPLETE")
    sys.exit(1)

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(label + ": expected exactly 1 anchor, found " + str(count))
    return text.replace(old, new, 1)

def node_check(path):
    result = subprocess.run(
        ["node", "--check", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        raise RuntimeError(
            "node --check failed for " + str(path.relative_to(ROOT)) + ":\n"
            + (result.stderr or result.stdout)
        )

try:
    log("root: " + str(ROOT))

    js = FILES["system.js"].read_text(encoding="utf-8")
    css = FILES["system.css"].read_text(encoding="utf-8")
    html = FILES["system.html"].read_text(encoding="utf-8")
    server = FILES["app-server.mjs"].read_text(encoding="utf-8")
    evaluate = FILES["src/evaluate.mjs"].read_text(encoding="utf-8")

    if PATCH_ID in js:
        log("already installed")
        sys.exit(0)

    # Remove all failed V4/V4.1/V4.2 platform UI experiments.
    v4_start = js.find("// MEMEFLOW_PLATFORM_NATIVE_DIRECT_V4")
    build_start = js.find("function mf293Build()", v4_start if v4_start >= 0 else 0)
    if v4_start >= 0:
        if build_start < 0:
            raise RuntimeError("V4 block found but mf293Build() anchor is missing")
        js = js[:v4_start].rstrip() + "\n\n" + js[build_start:]
        log("removed old V4 helper block")

    js = re.sub(
        r"\n?\s*// MF_PLATFORM_V4_2_MOUNT\s*"
        r"requestAnimationFrame\(\(\) => \{\s*"
        r"mfPlatformV4Mount\(\);\s*"
        r"setTimeout\(\(\) => mfPlatformV4Mount\(\), 80\);\s*"
        r"\}\);\s*",
        "\n",
        js,
        count=1,
        flags=re.S
    )
    js = re.sub(
        r"^\s*// MEMEFLOW_PLATFORM_NATIVE_DIRECT_V4_[12]\s*$",
        "",
        js,
        flags=re.M
    )

    for forbidden in [
        "mfPlatformV4Mount",
        "mfPlatformNativeSelectV4",
        "MF_PLATFORM_V4_2_MOUNT",
    ]:
        if forbidden in js:
            raise RuntimeError("old platform experiment still remains: " + forbidden)

    js = replace_once(
        js,
        "  dirty: false,\n  saving: false\n};",
        "  dirty: false,\n  saving: false,\n  discoverySourceMode: 'pump',\n  discoverySourceSaving: false\n};",
        "MF293 state"
    )

    js = replace_once(
        js,
        '      <span>Platform<strong>Pump.fun</strong></span>\n      <span>AI policy<strong>Propose only</strong></span>',
        '      <span class="mf293-platform-meta">Platform\n'
        '        <select id="mf293DiscoverySource" aria-label="Platform">\n'
        '          <option value="pump">Pump.fun</option>\n'
        '          <option value="dex">DEX</option>\n'
        '          <option value="hybrid">Hybrid</option>\n'
        '        </select>\n'
        '      </span>\n'
        '      <span>AI policy<strong>Propose only</strong></span>',
        "Platform meta HTML"
    )

    js = replace_once(
        js,
        "\nfunction mf293Build() {",
        "\n" + COMPATIBILITY_CODE + "function mf293Build() {",
        "insert clean Platform functions"
    )

    js = replace_once(
        js,
        "  document.getElementById('mf293RestoreDefaults')?.addEventListener('click', mf293Restore);\n"
        "  backdrop.addEventListener('click', event => {",
        "  document.getElementById('mf293RestoreDefaults')?.addEventListener('click', mf293Restore);\n"
        "  document.getElementById('mf293DiscoverySource')?.addEventListener('change', mf293SetDiscoverySource);\n"
        "  backdrop.addEventListener('click', event => {",
        "Platform change listener"
    )

    js = replace_once(
        js,
        "    MF293.capabilities = payload.capabilities || {};\n"
        "    MF293.killSwitchActive = payload.killSwitchActive === true;\n"
        "    mf293Populate();",
        "    MF293.capabilities = payload.capabilities || {};\n"
        "    MF293.discoverySourceMode = String(\n"
        "      payload?.capabilities?.discoverySourceMode || MF293.discoverySourceMode || 'pump'\n"
        "    ).toLowerCase();\n"
        "    MF293.killSwitchActive = payload.killSwitchActive === true;\n"
        "    mf293Populate();",
        "load discovery source"
    )

    js = replace_once(
        js,
        "  const kill = document.getElementById('mf293KillSwitch');\n"
        "  if (kill) {",
        "  const platform = document.getElementById('mf293DiscoverySource');\n"
        "  if (platform) {\n"
        "    platform.value = String(MF293.discoverySourceMode || 'pump').toLowerCase();\n"
        "  }\n"
        "  mf293ApplySourceCompatibility();\n\n"
        "  const kill = document.getElementById('mf293KillSwitch');\n"
        "  if (kill) {",
        "populate platform"
    )

    js = replace_once(
        js,
        "  for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults']) {",
        "  for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults', 'mf293DiscoverySource']) {",
        "disable platform during load"
    )

    js = replace_once(
        js,
        "  next.launchPlatforms = ['pump'];",
        "  // Discovery source is global and controlled by /api/discovery-source.\n"
        "  // Per-user evaluation keeps both canonical platform tags available.\n"
        "  next.launchPlatforms = ['pump','dex'];",
        "canonical launchPlatforms"
    )

    js = js.rstrip() + "\n\n// " + PATCH_ID + "\n"

    css_anchor = (
        ".mf293-settings-meta strong {\n"
        "  display: block;\n"
        "  margin-top: 3px;\n"
        "  overflow: hidden;\n"
        "  color: #dbe8ee;\n"
        "  font-size: 11px;\n"
        "  text-transform: none;\n"
        "  letter-spacing: 0;\n"
        "  text-overflow: ellipsis;\n"
        "  white-space: nowrap;\n"
        "}\n"
    )
    css = replace_once(css, css_anchor, css_anchor + CSS_EXTRA, "settings meta CSS")

    evaluate = replace_once(evaluate, OLD_WRAPPER, NEW_WRAPPER, "DEX evaluator wrapper")

    html = replace_once(
        html,
        '<link rel="stylesheet" href="/system.css?v=clean-v29-3" />',
        '<link rel="stylesheet" href="/system.css?v=platform-clean-v5" />',
        "CSS cache bust"
    )
    html = replace_once(
        html,
        '<script type="module" src="/system.js?v=real-web-v31"></script>',
        '<script type="module" src="/system.js?v=platform-clean-v5"></script>',
        "JS cache bust"
    )

    old_cache = (
        "   res.setHeader('content-type',mime);"
        "res.setHeader('cache-control',isHTML?'no-store, no-cache, must-revalidate':"
        "'public, max-age=3600, stale-while-revalidate=86400');"
    )
    new_cache = (
        "   const isLiveSystemAsset=p==='system.js'||p==='system.css'||p==='system.html';\n"
        "   res.setHeader('content-type',mime);"
        "res.setHeader('cache-control',(isHTML||isLiveSystemAsset)?"
        "'no-store, no-cache, must-revalidate':"
        "'public, max-age=3600, stale-while-revalidate=86400');"
    )
    server = replace_once(server, old_cache, new_cache, "system asset cache policy")

    write(FILES["system.js"], js)
    write(FILES["system.css"], css)
    write(FILES["system.html"], html)
    write(FILES["src/evaluate.mjs"], evaluate)
    write(FILES["app-server.mjs"], server)

    node_check(FILES["system.js"])
    node_check(FILES["src/evaluate.mjs"])
    node_check(FILES["app-server.mjs"])

    final_js = FILES["system.js"].read_text(encoding="utf-8")
    final_html = FILES["system.html"].read_text(encoding="utf-8")
    final_server = FILES["app-server.mjs"].read_text(encoding="utf-8")

    checks = [
        (PATCH_ID in final_js, "V5 marker"),
        ('id="mf293DiscoverySource"' in final_js, "native Platform select"),
        ("mf293SetDiscoverySource" in final_js, "Platform POST handler"),
        ("mf293ApplySourceCompatibility" in final_js, "compatibility UI"),
        ("mfPlatformV4Mount" not in final_js, "old V4 removed"),
        ("platform-clean-v5" in final_html, "cache-busted system assets"),
        ("isLiveSystemAsset" in final_server, "no-cache system assets"),
    ]
    failed = [name for ok, name in checks if not ok]
    if failed:
        raise RuntimeError("validation failed: " + ", ".join(failed))

    log("system.js syntax OK")
    log("evaluate.mjs syntax OK")
    log("app-server.mjs syntax OK")
    log("INSTALL COMPLETE")
    log("Platform is now a real native select in the original MF293 markup")
    log("Platform source is loaded from /api/settings capabilities.discoverySourceMode")
    log("Platform switch POSTs directly to /api/discovery-source")
    log("DEX-incompatible settings are disabled by exact setting keys")
    log("HYBRID keeps Pump-only settings editable and labels them")
    log("DEX evaluator now truly ignores those Pump-only gates")
    log("old V4/V4.1/V4.2 platform code removed")
    log("system.js + system.css no longer use the 1-hour browser cache")
    log("backup: " + str(BACK))
    log("Restart the Replit workflow/app, then reopen /system.html once.")

except Exception as exc:
    rollback(exc)
