#!/usr/bin/env python3
from __future__ import annotations

import base64
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_V31_REAL_EVENT_WEB"
STAMP = time.strftime("%Y%m%d-%H%M%S")

SYSTEM_STREAM_HELPERS = base64.b64decode("Ly8gTUVNRUZMT1dfVjMxX1JFQUxfRVZFTlRfV0VCIOKAlCByZWFkLW9ubHkgU3lzdGVtIFZpZXcgZXZlbnQgc3RyZWFtLgovLyBObyB3b3JrIGlzIGRvbmUgb24gdGhlIGhvdCBwYXRoIHVubGVzcyBhdCBsZWFzdCBvbmUgU3lzdGVtIFZpZXcgaXMgY29ubmVjdGVkLgpjb25zdCBfX3N5c3RlbVZpZXdTdHJlYW1zVjMxID0gbmV3IFNldCgpOwpsZXQgX19zeXN0ZW1WaWV3U2VxVjMxID0gMDsKY29uc3QgX19zeXN0ZW1WaWV3TGFzdE1pbnRWMzEgPSBuZXcgTWFwKCk7CgpmdW5jdGlvbiBfX3N5c3RlbVZpZXdFbWl0VjMxKHR5cGUsIHBheWxvYWQgPSB7fSkgewogIGlmICghX19zeXN0ZW1WaWV3U3RyZWFtc1YzMS5zaXplKSByZXR1cm47CgogIGNvbnN0IG5vdyA9IERhdGUubm93KCk7CgogIGlmICh0eXBlID09PSAndG9rZW4nICYmIHBheWxvYWQ/Lm1pbnQpIHsKICAgIGNvbnN0IGtleSA9IFN0cmluZyhwYXlsb2FkLm1pbnQpOwogICAgY29uc3QgcHJldmlvdXMgPSBfX3N5c3RlbVZpZXdMYXN0TWludFYzMS5nZXQoa2V5KSB8fCAwOwogICAgaWYgKChub3cgLSBwcmV2aW91cykgPCAxOCkgcmV0dXJuOwogICAgX19zeXN0ZW1WaWV3TGFzdE1pbnRWMzEuc2V0KGtleSwgbm93KTsKCiAgICBpZiAoX19zeXN0ZW1WaWV3TGFzdE1pbnRWMzEuc2l6ZSA+IDEwMDApIHsKICAgICAgZm9yIChjb25zdCBbbWludCwgdHNdIG9mIF9fc3lzdGVtVmlld0xhc3RNaW50VjMxKSB7CiAgICAgICAgaWYgKChub3cgLSB0cykgPiAzMDAwMCkgX19zeXN0ZW1WaWV3TGFzdE1pbnRWMzEuZGVsZXRlKG1pbnQpOwogICAgICB9CiAgICB9CiAgfQoKICBjb25zdCBldmVudFR5cGUgPSBTdHJpbmcodHlwZSB8fCAnc3lzdGVtJykucmVwbGFjZSgvW15hLXowLTlfLV0vZ2ksICcnKTsKICBjb25zdCBib2R5ID0gSlNPTi5zdHJpbmdpZnkoewogICAgdHlwZTogZXZlbnRUeXBlLAogICAgc2VxOiArK19fc3lzdGVtVmlld1NlcVYzMSwKICAgIHRzOiBub3csCiAgICAuLi5wYXlsb2FkCiAgfSk7CgogIGNvbnN0IGZyYW1lID0gYGV2ZW50OiAke2V2ZW50VHlwZX1cbmRhdGE6ICR7Ym9keX1cblxuYDsKCiAgZm9yIChjb25zdCByZXMgb2YgWy4uLl9fc3lzdGVtVmlld1N0cmVhbXNWMzFdKSB7CiAgICB0cnkgewogICAgICByZXMud3JpdGUoZnJhbWUpOwogICAgfSBjYXRjaCB7CiAgICAgIF9fc3lzdGVtVmlld1N0cmVhbXNWMzEuZGVsZXRlKHJlcyk7CiAgICB9CiAgfQp9Cg==").decode("utf-8")
SYSTEM_ROUTE = base64.b64decode("IC8vIE1FTUVGTE9XX1YzMV9SRUFMX0VWRU5UX1dFQgogaWYodXJsLnBhdGhuYW1lPT09Jy9hcGkvc3lzdGVtL3N0cmVhbScmJnJlcS5tZXRob2Q9PT0nR0VUJyl7CiAgcmVzLndyaXRlSGVhZCgyMDAsewogICAnY29udGVudC10eXBlJzondGV4dC9ldmVudC1zdHJlYW07IGNoYXJzZXQ9dXRmLTgnLAogICAnY2FjaGUtY29udHJvbCc6J25vLWNhY2hlLCBuby1zdG9yZSwgbm8tdHJhbnNmb3JtJywKICAgJ2Nvbm5lY3Rpb24nOidrZWVwLWFsaXZlJywKICAgJ3gtYWNjZWwtYnVmZmVyaW5nJzonbm8nCiAgfSk7CiAgcmVzLmZsdXNoSGVhZGVycz8uKCk7CiAgX19zeXN0ZW1WaWV3U3RyZWFtc1YzMS5hZGQocmVzKTsKCiAgdHJ5ewogICByZXMud3JpdGUoYHJldHJ5OiAxMDAwXG5ldmVudDogaGVsbG9cbmRhdGE6ICR7SlNPTi5zdHJpbmdpZnkoe3R5cGU6J2hlbGxvJyxzZXE6X19zeXN0ZW1WaWV3U2VxVjMxLHRzOkRhdGUubm93KCl9KX1cblxuYCk7CiAgfWNhdGNoe30KCiAgY29uc3QgaGVhcnRiZWF0PXNldEludGVydmFsKCgpPT57CiAgIHRyeXtyZXMud3JpdGUoYDogdjMxICR7RGF0ZS5ub3coKX1cblxuYCl9Y2F0Y2h7fQogIH0sMTUwMDApOwogIGhlYXJ0YmVhdC51bnJlZj8uKCk7CgogIHJlcS5vbignY2xvc2UnLCgpPT57CiAgIGNsZWFySW50ZXJ2YWwoaGVhcnRiZWF0KTsKICAgX19zeXN0ZW1WaWV3U3RyZWFtc1YzMS5kZWxldGUocmVzKTsKICB9KTsKICByZXR1cm47CiB9Cg==").decode("utf-8")
SYSTEM_JS_V31 = base64.b64decode("Ci8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICBNRU1FRkxPVyBWMzEg4oCUIFJFQUwgRVZFTlQgV0VCIC8gRklUVEVEIERJR0lUQUwgVFdJTgogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KCmNvbnN0IFJFQUxfV0VCX1YzMSA9IHsKICBpbnN0YWxsZWQ6IGZhbHNlLAogIGdyb3VwOiBudWxsLAogIGVkZ2VzOiBuZXcgTWFwKCksCiAgc291cmNlOiBudWxsLAogIGZyYW1lOiAwLAogIGxhc3RGcmFtZUF0OiAwLAogIGxhc3RUZWxlbWV0cnk6IG51bGwsCiAgcmVzaXplVGltZXI6IG51bGwsCiAgaW5zdGFsbFRpbWVyOiBudWxsLAogIHJlY29ubmVjdHM6IDAsCiAgbW9iaWxlUXVlcnk6IHdpbmRvdy5tYXRjaE1lZGlhKCcobWF4LXdpZHRoOiA5MDBweCknKQp9OwoKY29uc3QgV0VCX0VER0VTX1YzMSA9IFsKICB7IGtleTonZGlzY292ZXJ5OmJvb3RzdHJhcCcsIGZyb206J2Rpc2NvdmVyeScsIHRvOidib290c3RyYXAnLCBjb2xvcjpDT0xPUlMuY3lhbiB9LAogIHsga2V5Oidib290c3RyYXA6Y29yZScsICAgICAgZnJvbTonYm9vdHN0cmFwJywgdG86J2NvcmUnLCAgICAgIGNvbG9yOkNPTE9SUy5ibHVlIH0sCiAgeyBrZXk6J2NvcmU6aG9sZGVycycsICAgICAgICBmcm9tOidjb3JlJywgICAgICB0bzonaG9sZGVycycsICAgY29sb3I6Q09MT1JTLmN5YW4gfSwKICB7IGtleTonY29yZTptYXJrZXQnLCAgICAgICAgIGZyb206J2NvcmUnLCAgICAgIHRvOidtYXJrZXQnLCAgICBjb2xvcjpDT0xPUlMuYmx1ZSB9LAogIHsga2V5Oidob2xkZXJzOnJpc2snLCAgICAgICAgZnJvbTonaG9sZGVycycsICAgdG86J3Jpc2snLCAgICAgIGNvbG9yOkNPTE9SUy5jeWFuIH0sCiAgeyBrZXk6J21hcmtldDpyaXNrJywgICAgICAgICBmcm9tOidtYXJrZXQnLCAgICB0bzoncmlzaycsICAgICAgY29sb3I6Q09MT1JTLmJsdWUgfSwKICB7IGtleTonb3BlbmFpOnJpc2snLCAgICAgICAgIGZyb206J29wZW5haScsICAgIHRvOidyaXNrJywgICAgICBjb2xvcjpDT0xPUlMucHVycGxlIH0sCiAgeyBrZXk6J3Jpc2s6ZGVjaXNpb24nLCAgICAgICBmcm9tOidyaXNrJywgICAgICB0bzonZGVjaXNpb24nLCAgY29sb3I6Q09MT1JTLmdyZWVuIH0sCiAgeyBrZXk6J2RlY2lzaW9uOnBhcGVyJywgICAgICBmcm9tOidkZWNpc2lvbicsICB0bzoncGFwZXInLCAgICAgY29sb3I6Q09MT1JTLnB1cnBsZSB9LAogIHsga2V5OidwYXBlcjpleGVjdXRpb24nLCAgICAgZnJvbToncGFwZXInLCAgICAgdG86J2V4ZWN1dGlvbicsIGNvbG9yOkNPTE9SUy55ZWxsb3cgfQpdOwoKY29uc3QgV0VCX0xBWU9VVF9NT0JJTEVfVjMxID0gewogIGRpc2NvdmVyeTogeyBwb3M6Wy00LjQ1LCAgMi44NSwgIDAuMTJdLCBzY2FsZTowLjUyIH0sCiAgYm9vdHN0cmFwOiB7IHBvczpbIDAuMDAsICAyLjg1LCAtMC4wNF0sIHNjYWxlOjAuNTIgfSwKICBjb3JlOiAgICAgIHsgcG9zOlsgNC40NSwgIDIuODUsICAwLjE4XSwgc2NhbGU6MC41OSB9LAoKICByaXNrOiAgICAgIHsgcG9zOlstNC40NSwgIDAuNjIsICAwLjA4XSwgc2NhbGU6MC41MCB9LAogIG1hcmtldDogICAgeyBwb3M6WyAwLjAwLCAgMC42MiwgLTAuMDZdLCBzY2FsZTowLjUwIH0sCiAgaG9sZGVyczogICB7IHBvczpbIDQuNDUsICAwLjYyLCAgMC4xOF0sIHNjYWxlOjAuNTAgfSwKCiAgb3BlbmFpOiAgICB7IHBvczpbLTQuNDUsIC0xLjYyLCAtMC4xMF0sIHNjYWxlOjAuNDkgfSwKICBkZWNpc2lvbjogIHsgcG9zOlsgMC4wMCwgLTEuNjIsICAwLjA0XSwgc2NhbGU6MC41MSB9LAogIHBhcGVyOiAgICAgeyBwb3M6WyA0LjQ1LCAtMS42MiwgIDAuMDJdLCBzY2FsZTowLjUwIH0sCgogIGV4ZWN1dGlvbjogeyBwb3M6WyAwLjAwLCAtMy43OCwgLTAuMTJdLCBzY2FsZTowLjQ5IH0KfTsKCmNvbnN0IFdFQl9MQVlPVVRfREVTS1RPUF9WMzEgPSB7CiAgZGlzY292ZXJ5OiB7IHBvczpbLTUuNjAsICAzLjEwLCAgMC4xMF0sIHNjYWxlOjAuNjggfSwKICBib290c3RyYXA6IHsgcG9zOlsgMC4wMCwgIDMuMTAsIC0wLjA1XSwgc2NhbGU6MC42OCB9LAogIGNvcmU6ICAgICAgeyBwb3M6WyA1LjYwLCAgMy4xMCwgIDAuMjBdLCBzY2FsZTowLjc2IH0sCgogIHJpc2s6ICAgICAgeyBwb3M6Wy01LjYwLCAgMC41NSwgIDAuMDhdLCBzY2FsZTowLjY2IH0sCiAgbWFya2V0OiAgICB7IHBvczpbIDAuMDAsICAwLjU1LCAtMC4wOF0sIHNjYWxlOjAuNjYgfSwKICBob2xkZXJzOiAgIHsgcG9zOlsgNS42MCwgIDAuNTUsICAwLjE4XSwgc2NhbGU6MC42NiB9LAoKICBvcGVuYWk6ICAgIHsgcG9zOlstNS42MCwgLTIuMDAsIC0wLjEyXSwgc2NhbGU6MC42NCB9LAogIGRlY2lzaW9uOiAgeyBwb3M6WyAwLjAwLCAtMi4wMCwgIDAuMDJdLCBzY2FsZTowLjY3IH0sCiAgcGFwZXI6ICAgICB7IHBvczpbIDUuNjAsIC0yLjAwLCAgMC4wMl0sIHNjYWxlOjAuNjUgfSwKCiAgZXhlY3V0aW9uOiB7IHBvczpbIDAuMDAsIC00LjQ1LCAtMC4xMl0sIHNjYWxlOjAuNjMgfQp9OwoKZnVuY3Rpb24gd2ViQ2xhbXBWMzEodiwgYSwgYikgewogIHJldHVybiBNYXRoLm1heChhLCBNYXRoLm1pbihiLCBOdW1iZXIodikgfHwgMCkpOwp9CgpmdW5jdGlvbiB3ZWJNb2JpbGVWMzEoKSB7CiAgcmV0dXJuIFJFQUxfV0VCX1YzMS5tb2JpbGVRdWVyeS5tYXRjaGVzOwp9CgpmdW5jdGlvbiB3ZWJOb2RlVjMxKGlkKSB7CiAgcmV0dXJuIGFwcC5ub2Rlcz8uZ2V0Py4oaWQpIHx8IG51bGw7Cn0KCmZ1bmN0aW9uIHdlYlBvaW50VjMxKGlkKSB7CiAgY29uc3Qgbm9kZSA9IHdlYk5vZGVWMzEoaWQpOwogIGlmICghbm9kZT8uZ3JvdXApIHJldHVybiBuZXcgVEhSRUUuVmVjdG9yMygpOwoKICBjb25zdCBwID0gbm9kZS5ncm91cC5wb3NpdGlvbi5jbG9uZSgpOwogIHAueSArPSAwLjE4OwogIHJldHVybiBwOwp9CgpmdW5jdGlvbiB3ZWJDdXJ2ZVYzMShlZGdlLCBpbmRleCA9IDApIHsKICBjb25zdCBhID0gd2ViUG9pbnRWMzEoZWRnZS5mcm9tKTsKICBjb25zdCBiID0gd2ViUG9pbnRWMzEoZWRnZS50byk7CiAgY29uc3QgbWlkID0gYS5jbG9uZSgpLmxlcnAoYiwgMC41KTsKCiAgbWlkLnogKz0gKChpbmRleCAlIDMpIC0gMSkgKiAwLjE4OwogIG1pZC55ICs9IChpbmRleCAlIDIgPT09IDAgPyAwLjEwIDogLTAuMDYpOwoKICByZXR1cm4gbmV3IFRIUkVFLkNhdG11bGxSb21DdXJ2ZTMoCiAgICBbYSwgbWlkLCBiXSwKICAgIGZhbHNlLAogICAgJ2NhdG11bGxyb20nLAogICAgMC4wNgogICk7Cn0KCmZ1bmN0aW9uIHdlYkRpc3Bvc2VPYmplY3RWMzEob2JqZWN0KSB7CiAgaWYgKCFvYmplY3QpIHJldHVybjsKCiAgb2JqZWN0LnRyYXZlcnNlPy4oKGNoaWxkKSA9PiB7CiAgICBjaGlsZC5nZW9tZXRyeT8uZGlzcG9zZT8uKCk7CgogICAgaWYgKEFycmF5LmlzQXJyYXkoY2hpbGQubWF0ZXJpYWwpKSB7CiAgICAgIGZvciAoY29uc3QgbSBvZiBjaGlsZC5tYXRlcmlhbCkgbT8uZGlzcG9zZT8uKCk7CiAgICB9IGVsc2UgewogICAgICBjaGlsZC5tYXRlcmlhbD8uZGlzcG9zZT8uKCk7CiAgICB9CiAgfSk7CgogIG9iamVjdC5wYXJlbnQ/LnJlbW92ZT8uKG9iamVjdCk7Cn0KCmZ1bmN0aW9uIGRpc2FibGVMZWdhY3lGbG93VjMxKCkgewogIHRyeSB7CiAgICBpZiAodHlwZW9mIHN5bmNSZWFsaXR5U3BlZWRzVjggPT09ICdmdW5jdGlvbicpIHsKICAgICAgc3luY1JlYWxpdHlTcGVlZHNWOCA9ICgpID0+IHt9OwogICAgfQogIH0gY2F0Y2gge30KCiAgdHJ5IHsKICAgIGlmICh0eXBlb2YgY2xlYXJGbG93TGluZXNWNyA9PT0gJ2Z1bmN0aW9uJykgewogICAgICBjbGVhckZsb3dMaW5lc1Y3KCk7CiAgICB9CiAgfSBjYXRjaCB7fQoKICB0cnkgewogICAgZm9yIChjb25zdCBlbnRyeSBvZiBGTE9XX1JFQUxJVFlfVjg/LmxpbmVzIHx8IFtdKSB7CiAgICAgIHdlYkRpc3Bvc2VPYmplY3RWMzEoZW50cnk/LmxpbmUpOwogICAgfQogICAgaWYgKEZMT1dfUkVBTElUWV9WOD8ubGluZXMpIEZMT1dfUkVBTElUWV9WOC5saW5lcy5sZW5ndGggPSAwOwogIH0gY2F0Y2gge30KCiAgdHJ5IHsKICAgIGZvciAoY29uc3QgcHVsc2Ugb2YgYXBwLmVkZ2VQdWxzZXMgfHwgW10pIHsKICAgICAgd2ViRGlzcG9zZU9iamVjdFYzMShwdWxzZSk7CiAgICB9CiAgICBpZiAoYXBwLmVkZ2VQdWxzZXMpIGFwcC5lZGdlUHVsc2VzLmxlbmd0aCA9IDA7CiAgfSBjYXRjaCB7fQp9CgpmdW5jdGlvbiBhcHBseVdlYkxheW91dFYzMShmb3JjZUhvbWUgPSBmYWxzZSkgewogIGlmICghYXBwLnNjZW5lIHx8ICFhcHAuY2FtZXJhIHx8ICFhcHAuY29udHJvbHMgfHwgIWFwcC5ub2Rlcz8uc2l6ZSkgcmV0dXJuIGZhbHNlOwoKICBjb25zdCBtb2JpbGUgPSB3ZWJNb2JpbGVWMzEoKTsKICBjb25zdCBsYXlvdXQgPSBtb2JpbGUgPyBXRUJfTEFZT1VUX01PQklMRV9WMzEgOiBXRUJfTEFZT1VUX0RFU0tUT1BfVjMxOwoKICBmb3IgKGNvbnN0IFtpZCwgY2ZnXSBvZiBPYmplY3QuZW50cmllcyhsYXlvdXQpKSB7CiAgICBjb25zdCBub2RlID0gd2ViTm9kZVYzMShpZCk7CiAgICBpZiAoIW5vZGU/Lmdyb3VwKSBjb250aW51ZTsKCiAgICBub2RlLmdyb3VwLnBvc2l0aW9uLnNldCguLi5jZmcucG9zKTsKICAgIG5vZGUuZ3JvdXAuc2NhbGUuc2V0U2NhbGFyKGNmZy5zY2FsZSk7CiAgfQoKICBpZiAobW9iaWxlKSB7CiAgICBhcHAuY2FtZXJhSG9tZS5zZXQoMC4wLCAxMy40LCAyOC4yKTsKICAgIGFwcC50YXJnZXRIb21lLnNldCgwLjAsIC0xLjE1LCAwLjApOwoKICAgIGFwcC5jb250cm9scy5taW5EaXN0YW5jZSA9IDEzLjU7CiAgICBhcHAuY29udHJvbHMubWF4RGlzdGFuY2UgPSA0Ni4wOwogICAgYXBwLmNvbnRyb2xzLm1pblBvbGFyQW5nbGUgPSBNYXRoLlBJICogMC4yMDsKICAgIGFwcC5jb250cm9scy5tYXhQb2xhckFuZ2xlID0gTWF0aC5QSSAqIDAuNTI7CiAgICBhcHAuY29udHJvbHMubWluQXppbXV0aEFuZ2xlID0gLTAuOTU7CiAgICBhcHAuY29udHJvbHMubWF4QXppbXV0aEFuZ2xlID0gMC45NTsKICB9IGVsc2UgewogICAgYXBwLmNhbWVyYUhvbWUuc2V0KDAuMCwgMTIuMCwgMzAuMCk7CiAgICBhcHAudGFyZ2V0SG9tZS5zZXQoMC4wLCAtMC42NSwgMC4wKTsKCiAgICBhcHAuY29udHJvbHMubWluRGlzdGFuY2UgPSAxNC4wOwogICAgYXBwLmNvbnRyb2xzLm1heERpc3RhbmNlID0gNDguMDsKICAgIGFwcC5jb250cm9scy5taW5Qb2xhckFuZ2xlID0gTWF0aC5QSSAqIDAuMjA7CiAgICBhcHAuY29udHJvbHMubWF4UG9sYXJBbmdsZSA9IE1hdGguUEkgKiAwLjU1OwogICAgYXBwLmNvbnRyb2xzLm1pbkF6aW11dGhBbmdsZSA9IC0xLjIwOwogICAgYXBwLmNvbnRyb2xzLm1heEF6aW11dGhBbmdsZSA9IDEuMjA7CiAgfQoKICBhcHAuY29udHJvbHMuZW5hYmxlWm9vbSA9IHRydWU7CiAgYXBwLmNvbnRyb2xzLmVuYWJsZVJvdGF0ZSA9IHRydWU7CiAgYXBwLmNvbnRyb2xzLmVuYWJsZVBhbiA9IGZhbHNlOwogIGFwcC5jb250cm9scy5lbmFibGVEYW1waW5nID0gdHJ1ZTsKICBhcHAuY29udHJvbHMuZGFtcGluZ0ZhY3RvciA9IDAuMDU1OwogIGFwcC5jb250cm9scy56b29tU3BlZWQgPSAxLjE1OwogIGFwcC5jb250cm9scy5yb3RhdGVTcGVlZCA9IDAuNzY7CiAgYXBwLmNvbnRyb2xzLmF1dG9Sb3RhdGUgPSBmYWxzZTsKICBhcHAuYXV0b1JvdGF0ZSA9IGZhbHNlOwoKICBpZiAoYXBwLmNvbnRyb2xzLnRvdWNoZXMpIHsKICAgIGFwcC5jb250cm9scy50b3VjaGVzLk9ORSA9IFRIUkVFLlRPVUNILlJPVEFURTsKICAgIGFwcC5jb250cm9scy50b3VjaGVzLlRXTyA9IFRIUkVFLlRPVUNILkRPTExZX1JPVEFURTsKICB9CgogIGlmIChmb3JjZUhvbWUpIHsKICAgIGFwcC5jYW1lcmEucG9zaXRpb24uY29weShhcHAuY2FtZXJhSG9tZSk7CiAgICBhcHAuY29udHJvbHMudGFyZ2V0LmNvcHkoYXBwLnRhcmdldEhvbWUpOwogIH0KCiAgYXBwLmNvbnRyb2xzLnVwZGF0ZSgpOwogIHJldHVybiB0cnVlOwp9CgpmdW5jdGlvbiBjbGVhcldlYlYzMSgpIHsKICBpZiAoUkVBTF9XRUJfVjMxLmdyb3VwKSB7CiAgICB3ZWJEaXNwb3NlT2JqZWN0VjMxKFJFQUxfV0VCX1YzMS5ncm91cCk7CiAgfQoKICBSRUFMX1dFQl9WMzEuZ3JvdXAgPSBudWxsOwogIFJFQUxfV0VCX1YzMS5lZGdlcy5jbGVhcigpOwp9CgpmdW5jdGlvbiBidWlsZFdlYlYzMSgpIHsKICBpZiAoIWFwcC5zY2VuZSB8fCAhYXBwLm5vZGVzPy5zaXplKSByZXR1cm47CgogIGNsZWFyV2ViVjMxKCk7CgogIGNvbnN0IGdyb3VwID0gbmV3IFRIUkVFLkdyb3VwKCk7CiAgZ3JvdXAubmFtZSA9ICdNRU1FRkxPV19SRUFMX0VWRU5UX1dFQl9WMzEnOwogIGFwcC5zY2VuZS5hZGQoZ3JvdXApOwogIFJFQUxfV0VCX1YzMS5ncm91cCA9IGdyb3VwOwoKICBXRUJfRURHRVNfVjMxLmZvckVhY2goKGVkZ2UsIGluZGV4KSA9PiB7CiAgICBjb25zdCBjdXJ2ZSA9IHdlYkN1cnZlVjMxKGVkZ2UsIGluZGV4KTsKICAgIGNvbnN0IHBvaW50cyA9IGN1cnZlLmdldFBvaW50cyg3Mik7CgogICAgY29uc3QgYmFzZUdlb21ldHJ5ID0gbmV3IFRIUkVFLkJ1ZmZlckdlb21ldHJ5KCkuc2V0RnJvbVBvaW50cyhwb2ludHMpOwogICAgY29uc3QgYmFzZSA9IG5ldyBUSFJFRS5MaW5lKAogICAgICBiYXNlR2VvbWV0cnksCiAgICAgIG5ldyBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbCh7CiAgICAgICAgY29sb3I6IGVkZ2UuY29sb3IsCiAgICAgICAgdHJhbnNwYXJlbnQ6IHRydWUsCiAgICAgICAgb3BhY2l0eTogZWRnZS5rZXkgPT09ICdwYXBlcjpleGVjdXRpb24nID8gMC4wMTggOiAwLjAzNCwKICAgICAgICBkZXB0aFdyaXRlOiBmYWxzZQogICAgICB9KQogICAgKTsKICAgIGJhc2UucmVuZGVyT3JkZXIgPSA0OwogICAgZ3JvdXAuYWRkKGJhc2UpOwoKICAgIGNvbnN0IGhvdEdlb21ldHJ5ID0gbmV3IFRIUkVFLkJ1ZmZlckdlb21ldHJ5KCkuc2V0RnJvbVBvaW50cyhwb2ludHMpOwogICAgaG90R2VvbWV0cnkuc2V0RHJhd1JhbmdlKDAsIDApOwoKICAgIGNvbnN0IGhvdCA9IG5ldyBUSFJFRS5MaW5lKAogICAgICBob3RHZW9tZXRyeSwKICAgICAgbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHsKICAgICAgICBjb2xvcjogZWRnZS5jb2xvciwKICAgICAgICB0cmFuc3BhcmVudDogdHJ1ZSwKICAgICAgICBvcGFjaXR5OiAwLAogICAgICAgIGRlcHRoV3JpdGU6IGZhbHNlCiAgICAgIH0pCiAgICApOwogICAgaG90LnJlbmRlck9yZGVyID0gODsKICAgIGdyb3VwLmFkZChob3QpOwoKICAgIGNvbnN0IGhlYWQgPSBuZXcgVEhSRUUuTWVzaCgKICAgICAgbmV3IFRIUkVFLlNwaGVyZUdlb21ldHJ5KDAuMDc1LCAxMCwgMTApLAogICAgICBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoewogICAgICAgIGNvbG9yOiBlZGdlLmNvbG9yLAogICAgICAgIHRyYW5zcGFyZW50OiB0cnVlLAogICAgICAgIG9wYWNpdHk6IDAsCiAgICAgICAgZGVwdGhXcml0ZTogZmFsc2UKICAgICAgfSkKICAgICk7CiAgICBoZWFkLnZpc2libGUgPSBmYWxzZTsKICAgIGhlYWQucmVuZGVyT3JkZXIgPSA5OwogICAgZ3JvdXAuYWRkKGhlYWQpOwoKICAgIFJFQUxfV0VCX1YzMS5lZGdlcy5zZXQoZWRnZS5rZXksIHsKICAgICAgLi4uZWRnZSwKICAgICAgY3VydmUsCiAgICAgIHBvaW50cywKICAgICAgYmFzZSwKICAgICAgaG90LAogICAgICBoZWFkLAogICAgICBhY3RpdmU6IGZhbHNlLAogICAgICBzdGFydGVkQXQ6IDAsCiAgICAgIGR1cmF0aW9uTXM6IDkwLAogICAgICBmYWRlU3RhcnRlZEF0OiAwLAogICAgICBmYWRlTXM6IDEwNSwKICAgICAgYm9vc3Q6IDEsCiAgICAgIGxhc3RTaG90QXQ6IDAKICAgIH0pOwogIH0pOwp9CgpmdW5jdGlvbiB2aXN1YWxMYXRlbmN5VjMxKHNlcnZlclRzKSB7CiAgY29uc3QgbGFnID0gTWF0aC5tYXgoMCwgRGF0ZS5ub3coKSAtIE51bWJlcihzZXJ2ZXJUcyB8fCBEYXRlLm5vdygpKSk7CiAgcmV0dXJuIHdlYkNsYW1wVjMxKGxhZywgNzAsIDIyMCk7Cn0KCmZ1bmN0aW9uIGZsYXNoTm9kZVYzMShpZCwgdW50aWwpIHsKICBjb25zdCBub2RlID0gd2ViTm9kZVYzMShpZCk7CiAgaWYgKCFub2RlPy5ncm91cCkgcmV0dXJuOwoKICBub2RlLmdyb3VwLnVzZXJEYXRhLndlYkZsYXNoVW50aWxWMzEgPSBNYXRoLm1heCgKICAgIE51bWJlcihub2RlLmdyb3VwLnVzZXJEYXRhLndlYkZsYXNoVW50aWxWMzEpIHx8IDAsCiAgICB1bnRpbAogICk7Cn0KCmZ1bmN0aW9uIHNob290V2ViRWRnZVYzMShrZXksIHNlcnZlclRzLCBzdHJlbmd0aCA9IDEpIHsKICBjb25zdCBlbnRyeSA9IFJFQUxfV0VCX1YzMS5lZGdlcy5nZXQoa2V5KTsKICBpZiAoIWVudHJ5IHx8IGtleSA9PT0gJ3BhcGVyOmV4ZWN1dGlvbicpIHJldHVybjsKCiAgY29uc3Qgbm93ID0gcGVyZm9ybWFuY2Uubm93KCk7CiAgY29uc3QgZHVyYXRpb24gPSB2aXN1YWxMYXRlbmN5VjMxKHNlcnZlclRzKTsKCiAgaWYgKGVudHJ5LmFjdGl2ZSAmJiAobm93IC0gZW50cnkubGFzdFNob3RBdCkgPCAzNCkgewogICAgZW50cnkuYm9vc3QgPSBNYXRoLm1pbigxLjgsIGVudHJ5LmJvb3N0ICsgMC4yMCAqIHN0cmVuZ3RoKTsKICAgIGVudHJ5Lmxhc3RTaG90QXQgPSBub3c7CiAgICByZXR1cm47CiAgfQoKICBlbnRyeS5hY3RpdmUgPSB0cnVlOwogIGVudHJ5LnN0YXJ0ZWRBdCA9IG5vdzsKICBlbnRyeS5kdXJhdGlvbk1zID0gZHVyYXRpb247CiAgZW50cnkuZmFkZVN0YXJ0ZWRBdCA9IDA7CiAgZW50cnkuYm9vc3QgPSB3ZWJDbGFtcFYzMShzdHJlbmd0aCwgMC42NSwgMS44KTsKICBlbnRyeS5sYXN0U2hvdEF0ID0gbm93OwoKICBlbnRyeS5ob3QudmlzaWJsZSA9IHRydWU7CiAgZW50cnkuaG90Lm1hdGVyaWFsLm9wYWNpdHkgPSBNYXRoLm1pbigxLCAwLjc2ICogZW50cnkuYm9vc3QpOwogIGVudHJ5LmhvdC5nZW9tZXRyeS5zZXREcmF3UmFuZ2UoMCwgMSk7CgogIGVudHJ5LmhlYWQudmlzaWJsZSA9IHRydWU7CiAgZW50cnkuaGVhZC5tYXRlcmlhbC5vcGFjaXR5ID0gTWF0aC5taW4oMSwgMC45MiAqIGVudHJ5LmJvb3N0KTsKICBlbnRyeS5oZWFkLnNjYWxlLnNldFNjYWxhcigwLjc4ICsgMC4zMCAqIGVudHJ5LmJvb3N0KTsKCiAgY29uc3QgdW50aWwgPSBub3cgKyBkdXJhdGlvbiArIDEyMDsKICBmbGFzaE5vZGVWMzEoZW50cnkuZnJvbSwgdW50aWwpOwogIGZsYXNoTm9kZVYzMShlbnRyeS50bywgdW50aWwpOwp9CgpmdW5jdGlvbiBjdXJyZW50RGVjaXNpb25Gb3JNaW50VjMxKG1pbnQpIHsKICBjb25zdCBzYW1wbGUgPSBBcnJheS5pc0FycmF5KGFwcC50ZWxlbWV0cnk/LmRpYWc/LnNhbXBsZSkKICAgID8gYXBwLnRlbGVtZXRyeS5kaWFnLnNhbXBsZQogICAgOiBbXTsKCiAgY29uc3Qgcm93ID0gc2FtcGxlLmZpbmQoKGl0ZW0pID0+IFN0cmluZyhpdGVtPy5taW50IHx8ICcnKSA9PT0gU3RyaW5nKG1pbnQgfHwgJycpKTsKICByZXR1cm4gc3RhdGVLZXkocm93Py5kZWNpc2lvbj8uc3RhdGUgfHwgJycpOwp9CgpmdW5jdGlvbiBydW5DcmVhdGVSb3V0ZVYzMShwYXlsb2FkID0ge30pIHsKICBjb25zdCBkID0gdmlzdWFsTGF0ZW5jeVYzMShwYXlsb2FkLnRzKTsKCiAgc2hvb3RXZWJFZGdlVjMxKCdkaXNjb3Zlcnk6Ym9vdHN0cmFwJywgcGF5bG9hZC50cywgMS4xMik7CgogIHNldFRpbWVvdXQoCiAgICAoKSA9PiBzaG9vdFdlYkVkZ2VWMzEoJ2Jvb3RzdHJhcDpjb3JlJywgcGF5bG9hZC50cywgMS4xOCksCiAgICBNYXRoLm1heCgyNCwgZCAqIDAuNDIpCiAgKTsKfQoKZnVuY3Rpb24gcnVuVG9rZW5Sb3V0ZVYzMShwYXlsb2FkID0ge30pIHsKICBjb25zdCBkID0gdmlzdWFsTGF0ZW5jeVYzMShwYXlsb2FkLnRzKTsKCiAgc2hvb3RXZWJFZGdlVjMxKCdjb3JlOmhvbGRlcnMnLCBwYXlsb2FkLnRzLCAxLjA2KTsKICBzaG9vdFdlYkVkZ2VWMzEoJ2NvcmU6bWFya2V0JywgcGF5bG9hZC50cywgMS4xMik7CgogIHNldFRpbWVvdXQoKCkgPT4gewogICAgc2hvb3RXZWJFZGdlVjMxKCdob2xkZXJzOnJpc2snLCBwYXlsb2FkLnRzLCAxLjAyKTsKICAgIHNob290V2ViRWRnZVYzMSgnbWFya2V0OnJpc2snLCBwYXlsb2FkLnRzLCAxLjA4KTsKICB9LCBNYXRoLm1heCgxOCwgZCAqIDAuMzApKTsKCiAgc2V0VGltZW91dCgoKSA9PiB7CiAgICBzaG9vdFdlYkVkZ2VWMzEoJ3Jpc2s6ZGVjaXNpb24nLCBwYXlsb2FkLnRzLCAxLjE1KTsKICB9LCBNYXRoLm1heCgzNCwgZCAqIDAuNjApKTsKCiAgaWYgKGN1cnJlbnREZWNpc2lvbkZvck1pbnRWMzEocGF5bG9hZC5taW50KSA9PT0gJ3JlYWR5JykgewogICAgc2V0VGltZW91dCgoKSA9PiB7CiAgICAgIHNob290V2ViRWRnZVYzMSgnZGVjaXNpb246cGFwZXInLCBwYXlsb2FkLnRzLCAxLjIyKTsKICAgIH0sIE1hdGgubWF4KDQ4LCBkICogMC44OCkpOwogIH0KfQoKZnVuY3Rpb24gYXBwbHlOb2RlRmxhc2hWMzEobm93KSB7CiAgZm9yIChjb25zdCBbLCBub2RlXSBvZiBhcHAubm9kZXMgfHwgW10pIHsKICAgIGlmICghbm9kZT8uZ3JvdXApIGNvbnRpbnVlOwoKICAgIGNvbnN0IHVudGlsID0gTnVtYmVyKG5vZGUuZ3JvdXAudXNlckRhdGEud2ViRmxhc2hVbnRpbFYzMSkgfHwgMDsKICAgIGNvbnN0IGFjdGl2ZSA9IHVudGlsID4gbm93OwoKICAgIGlmICghbm9kZS5ncm91cC51c2VyRGF0YS53ZWJIYWxvVjMxKSB7CiAgICAgIGNvbnN0IHJpbmcgPSBuZXcgVEhSRUUuTWVzaCgKICAgICAgICBuZXcgVEhSRUUuUmluZ0dlb21ldHJ5KDAuNzIsIDAuNzksIDQwKSwKICAgICAgICBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoewogICAgICAgICAgY29sb3I6IG5vZGUuY2ZnPy5jb2xvciB8fCBDT0xPUlMuY3lhbiwKICAgICAgICAgIHRyYW5zcGFyZW50OiB0cnVlLAogICAgICAgICAgb3BhY2l0eTogMCwKICAgICAgICAgIHNpZGU6IFRIUkVFLkRvdWJsZVNpZGUsCiAgICAgICAgICBkZXB0aFdyaXRlOiBmYWxzZQogICAgICAgIH0pCiAgICAgICk7CiAgICAgIHJpbmcucm90YXRpb24ueCA9IC1NYXRoLlBJIC8gMjsKICAgICAgcmluZy5wb3NpdGlvbi55ID0gKE51bWJlcihub2RlLmNmZz8uc2l6ZT8uWzFdKSB8fCAxKSAqIDAuNTYgKyAwLjA4OwogICAgICBub2RlLmdyb3VwLmFkZChyaW5nKTsKICAgICAgbm9kZS5ncm91cC51c2VyRGF0YS53ZWJIYWxvVjMxID0gcmluZzsKICAgIH0KCiAgICBjb25zdCBoYWxvID0gbm9kZS5ncm91cC51c2VyRGF0YS53ZWJIYWxvVjMxOwogICAgY29uc3QgdGFyZ2V0ID0gYWN0aXZlID8gMC41NSA6IDAuMDsKICAgIGNvbnN0IGN1cnJlbnQgPSBOdW1iZXIoaGFsby5tYXRlcmlhbC5vcGFjaXR5KSB8fCAwOwoKICAgIGhhbG8ubWF0ZXJpYWwub3BhY2l0eSArPSAodGFyZ2V0IC0gY3VycmVudCkgKiAwLjIyOwoKICAgIGlmIChhY3RpdmUpIHsKICAgICAgY29uc3QgcHVsc2UgPSAxICsgTWF0aC5zaW4obm93ICogMC4wMjApICogMC4wODsKICAgICAgaGFsby5zY2FsZS5zZXRTY2FsYXIocHVsc2UpOwogICAgfQogIH0KfQoKZnVuY3Rpb24gYW5pbWF0ZVdlYlYzMShub3cpIHsKICBSRUFMX1dFQl9WMzEuZnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYW5pbWF0ZVdlYlYzMSk7CgogIGlmIChkb2N1bWVudC5oaWRkZW4gfHwgIVJFQUxfV0VCX1YzMS5pbnN0YWxsZWQpIHJldHVybjsKCiAgaWYgKChub3cgLSBSRUFMX1dFQl9WMzEubGFzdEZyYW1lQXQpIDwgMzIpIHJldHVybjsKICBSRUFMX1dFQl9WMzEubGFzdEZyYW1lQXQgPSBub3c7CgogIGZvciAoY29uc3QgZW50cnkgb2YgUkVBTF9XRUJfVjMxLmVkZ2VzLnZhbHVlcygpKSB7CiAgICBpZiAoIWVudHJ5LmFjdGl2ZSkgY29udGludWU7CgogICAgY29uc3QgZWxhcHNlZCA9IG5vdyAtIGVudHJ5LnN0YXJ0ZWRBdDsKICAgIGNvbnN0IHAgPSB3ZWJDbGFtcFYzMShlbGFwc2VkIC8gZW50cnkuZHVyYXRpb25NcywgMCwgMSk7CgogICAgaWYgKHAgPCAxKSB7CiAgICAgIGNvbnN0IGNvdW50ID0gTWF0aC5tYXgoMiwgTWF0aC5mbG9vcihlbnRyeS5wb2ludHMubGVuZ3RoICogcCkpOwogICAgICBlbnRyeS5ob3QuZ2VvbWV0cnkuc2V0RHJhd1JhbmdlKDAsIGNvdW50KTsKICAgICAgZW50cnkuaG90Lm1hdGVyaWFsLm9wYWNpdHkgPSBNYXRoLm1pbigxLCAwLjgwICogZW50cnkuYm9vc3QpOwoKICAgICAgY29uc3QgaGVhZFAgPSBlbnRyeS5jdXJ2ZS5nZXRQb2ludEF0KE1hdGgubWluKDAuOTk5LCBwKSk7CiAgICAgIGVudHJ5LmhlYWQucG9zaXRpb24uY29weShoZWFkUCk7CiAgICAgIGVudHJ5LmhlYWQubWF0ZXJpYWwub3BhY2l0eSA9IE1hdGgubWluKDEsIDAuOTYgKiBlbnRyeS5ib29zdCk7CgogICAgICBjb250aW51ZTsKICAgIH0KCiAgICBpZiAoIWVudHJ5LmZhZGVTdGFydGVkQXQpIHsKICAgICAgZW50cnkuZmFkZVN0YXJ0ZWRBdCA9IG5vdzsKICAgICAgZW50cnkuaG90Lmdlb21ldHJ5LnNldERyYXdSYW5nZSgwLCBlbnRyeS5wb2ludHMubGVuZ3RoKTsKICAgIH0KCiAgICBjb25zdCBmYWRlID0gd2ViQ2xhbXBWMzEoCiAgICAgIDEgLSAoKG5vdyAtIGVudHJ5LmZhZGVTdGFydGVkQXQpIC8gZW50cnkuZmFkZU1zKSwKICAgICAgMCwKICAgICAgMQogICAgKTsKCiAgICBlbnRyeS5ob3QubWF0ZXJpYWwub3BhY2l0eSA9IGZhZGUgKiAwLjYyICogZW50cnkuYm9vc3Q7CiAgICBlbnRyeS5oZWFkLm1hdGVyaWFsLm9wYWNpdHkgPSBmYWRlICogMC43OCAqIGVudHJ5LmJvb3N0OwoKICAgIGlmIChmYWRlIDw9IDApIHsKICAgICAgZW50cnkuYWN0aXZlID0gZmFsc2U7CiAgICAgIGVudHJ5LmJvb3N0ID0gMTsKICAgICAgZW50cnkuaG90LnZpc2libGUgPSBmYWxzZTsKICAgICAgZW50cnkuaGVhZC52aXNpYmxlID0gZmFsc2U7CiAgICAgIGVudHJ5LmhvdC5nZW9tZXRyeS5zZXREcmF3UmFuZ2UoMCwgMCk7CiAgICB9CiAgfQoKICBhcHBseU5vZGVGbGFzaFYzMShub3cpOwp9CgpmdW5jdGlvbiBwYXJzZVdlYkV2ZW50VjMxKGV2ZW50KSB7CiAgdHJ5IHsKICAgIHJldHVybiBKU09OLnBhcnNlKGV2ZW50LmRhdGEgfHwgJ3t9Jyk7CiAgfSBjYXRjaCB7CiAgICByZXR1cm4ge307CiAgfQp9CgpmdW5jdGlvbiBjb25uZWN0U3lzdGVtU3RyZWFtVjMxKCkgewogIHRyeSB7CiAgICBSRUFMX1dFQl9WMzEuc291cmNlPy5jbG9zZT8uKCk7CiAgfSBjYXRjaCB7fQoKICBpZiAodHlwZW9mIEV2ZW50U291cmNlID09PSAndW5kZWZpbmVkJykgcmV0dXJuOwoKICBjb25zdCBzb3VyY2UgPSBuZXcgRXZlbnRTb3VyY2UoJy9hcGkvc3lzdGVtL3N0cmVhbScpOwogIFJFQUxfV0VCX1YzMS5zb3VyY2UgPSBzb3VyY2U7CgogIHNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCdjcmVhdGUnLCAoZXZlbnQpID0+IHsKICAgIHJ1bkNyZWF0ZVJvdXRlVjMxKHBhcnNlV2ViRXZlbnRWMzEoZXZlbnQpKTsKICB9KTsKCiAgc291cmNlLmFkZEV2ZW50TGlzdGVuZXIoJ3Rva2VuJywgKGV2ZW50KSA9PiB7CiAgICBydW5Ub2tlblJvdXRlVjMxKHBhcnNlV2ViRXZlbnRWMzEoZXZlbnQpKTsKICB9KTsKCiAgc291cmNlLmFkZEV2ZW50TGlzdGVuZXIoJ2hlbGxvJywgKCkgPT4gewogICAgUkVBTF9XRUJfVjMxLnJlY29ubmVjdHMgPSAwOwogIH0pOwoKICBzb3VyY2Uub25lcnJvciA9ICgpID0+IHsKICAgIFJFQUxfV0VCX1YzMS5yZWNvbm5lY3RzICs9IDE7CiAgfTsKfQoKZnVuY3Rpb24gdGVsZW1ldHJ5RmFsbGJhY2tWMzEoKSB7CiAgLy8gRG8gbm90IHN5bnRoZXNpemUgZmFsbGJhY2sgc2hvdHMgd2hpbGUgdGhlIHJlYWwgU1NFIHRyYW5zcG9ydCBpcyBvcGVuLgogIGlmICgKICAgIFJFQUxfV0VCX1YzMS5zb3VyY2UgJiYKICAgIHR5cGVvZiBFdmVudFNvdXJjZSAhPT0gJ3VuZGVmaW5lZCcgJiYKICAgIFJFQUxfV0VCX1YzMS5zb3VyY2UucmVhZHlTdGF0ZSA9PT0gRXZlbnRTb3VyY2UuT1BFTgogICkgewogICAgcmV0dXJuOwogIH0KCiAgY29uc3QgY3VycmVudCA9IHsKICAgIHRzOiBEYXRlLm5vdygpLAogICAgZXZlbnRzOiBOdW1iZXIoYXBwLnRlbGVtZXRyeT8uZGlzY292ZXJ5Py5ldmVudHNSZWNlaXZlZCkgfHwgMCwKICAgIHRyYWRlczogTnVtYmVyKGFwcC50ZWxlbWV0cnk/LmRpYWc/LmxpdmVUcmFkZUZlZWQ/LnRyYWRlRXZlbnRzRGVjb2RlZCkgfHwgMAogIH07CgogIGNvbnN0IHByZXZpb3VzID0gUkVBTF9XRUJfVjMxLmxhc3RUZWxlbWV0cnk7CiAgUkVBTF9XRUJfVjMxLmxhc3RUZWxlbWV0cnkgPSBjdXJyZW50OwoKICBpZiAoIXByZXZpb3VzKSByZXR1cm47CgogIGlmIChjdXJyZW50LmV2ZW50cyA+IHByZXZpb3VzLmV2ZW50cykgewogICAgcnVuQ3JlYXRlUm91dGVWMzEoeyB0czogY3VycmVudC50cyB9KTsKICB9CgogIGlmIChjdXJyZW50LnRyYWRlcyA+IHByZXZpb3VzLnRyYWRlcykgewogICAgcnVuVG9rZW5Sb3V0ZVYzMSh7IHRzOiBjdXJyZW50LnRzIH0pOwogIH0KfQoKZnVuY3Rpb24gcmVidWlsZFJlYWxXZWJWMzEoZm9yY2VIb21lID0gZmFsc2UpIHsKICBpZiAoIWFwcGx5V2ViTGF5b3V0VjMxKGZvcmNlSG9tZSkpIHJldHVybjsKCiAgZGlzYWJsZUxlZ2FjeUZsb3dWMzEoKTsKICBidWlsZFdlYlYzMSgpOwp9CgpmdW5jdGlvbiBpbnN0YWxsUmVhbFdlYlYzMSgpIHsKICBpZiAoUkVBTF9XRUJfVjMxLmluc3RhbGxlZCkgcmV0dXJuOwoKICBpZiAoIWFwcC5zY2VuZSB8fCAhYXBwLmNhbWVyYSB8fCAhYXBwLmNvbnRyb2xzIHx8ICFhcHAubm9kZXM/LnNpemUpIHsKICAgIFJFQUxfV0VCX1YzMS5pbnN0YWxsVGltZXIgPSBzZXRUaW1lb3V0KGluc3RhbGxSZWFsV2ViVjMxLCAxODApOwogICAgcmV0dXJuOwogIH0KCiAgUkVBTF9XRUJfVjMxLmluc3RhbGxlZCA9IHRydWU7CgogIHJlYnVpbGRSZWFsV2ViVjMxKHRydWUpOwogIGNvbm5lY3RTeXN0ZW1TdHJlYW1WMzEoKTsKCiAgUkVBTF9XRUJfVjMxLmZyYW1lID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFuaW1hdGVXZWJWMzEpOwoKICBzZXRJbnRlcnZhbCgoKSA9PiB7CiAgICBpZiAoIWRvY3VtZW50LmhpZGRlbikgdGVsZW1ldHJ5RmFsbGJhY2tWMzEoKTsKICB9LCAxNTAwKTsKCiAgc2V0VGltZW91dCgoKSA9PiB7CiAgICBpZiAoIVJFQUxfV0VCX1YzMS5pbnN0YWxsZWQpIHJldHVybjsKICAgIHJlYnVpbGRSZWFsV2ViVjMxKHRydWUpOwogIH0sIDkwMCk7Cn0KCndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCAoKSA9PiB7CiAgaWYgKCFSRUFMX1dFQl9WMzEuaW5zdGFsbGVkKSByZXR1cm47CgogIGNsZWFyVGltZW91dChSRUFMX1dFQl9WMzEucmVzaXplVGltZXIpOwogIFJFQUxfV0VCX1YzMS5yZXNpemVUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4gewogICAgcmVidWlsZFJlYWxXZWJWMzEoZmFsc2UpOwogIH0sIDMyMCk7Cn0pOwoKc2V0VGltZW91dChpbnN0YWxsUmVhbFdlYlYzMSwgMTI1MCk7Cg==").decode("utf-8")

def log(msg):
    print(f"[V31-WEB] {msg}", flush=True)

def find_root() -> Path:
    candidates = [
        Path.cwd(),
        Path.cwd() / "memeflow-app",
        Path.home() / "workspace",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace"),
        Path("/home/runner/workspace/memeflow-app"),
        Path("/workspace"),
        Path("/workspace/memeflow-app"),
    ]
    for root in candidates:
        try:
            root = root.resolve()
        except Exception:
            continue
        if (root / "system.js").is_file() and (root / "app-server.mjs").is_file():
            return root

    for base in [Path("/home/runner/workspace"), Path.cwd()]:
        if not base.exists():
            continue
        try:
            for p in base.glob("**/app-server.mjs"):
                root = p.parent
                if (root / "system.js").is_file():
                    return root.resolve()
        except Exception:
            pass

    raise RuntimeError("MEMEFLOW root not found (need system.js + app-server.mjs).")

ROOT = find_root()
FILES = [ROOT / "system.js", ROOT / "app-server.mjs"]
if (ROOT / "system.html").is_file():
    FILES.append(ROOT / "system.html")

BACKUP_DIR = ROOT / f".v31-real-web-backup-{STAMP}"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
MODIFIED = []

def relative(p: Path):
    return p.resolve().relative_to(ROOT.resolve())

def backup(p: Path):
    if p in MODIFIED:
        return
    dest = BACKUP_DIR / relative(p)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, dest)
    MODIFIED.append(p)

def write(p: Path, text: str):
    backup(p)
    p.write_text(text, encoding="utf-8")
    log(f"patched {relative(p)}")

def rollback(reason):
    log(f"ERROR: {reason}")
    for p in MODIFIED:
        src = BACKUP_DIR / relative(p)
        if src.exists():
            shutil.copy2(src, p)
            log(f"restored {relative(p)}")
    log("ROLLBACK COMPLETE")
    sys.exit(1)

def patch_server():
    p = ROOT / "app-server.mjs"
    text = p.read_text(encoding="utf-8")
    original = text

    if PATCH_ID not in text:
        stream_anchor = "const streams=new Map(),priceTimers=new Map(),tradeWindows=new Map();"
        if stream_anchor in text:
            text = text.replace(
                stream_anchor,
                stream_anchor + "\n// " + PATCH_ID + "\n" + SYSTEM_STREAM_HELPERS,
                1
            )
        else:
            m = re.search(r"const\s+streams\s*=\s*new Map\(\)[^;\n]*;", text)
            if not m:
                raise RuntimeError("app-server.mjs: stream registry anchor not found")
            text = (
                text[:m.end()]
                + "\n// " + PATCH_ID + "\n"
                + SYSTEM_STREAM_HELPERS
                + text[m.end():]
            )

    if "/api/system/stream" not in text:
        route_anchor = "if(url.pathname==='/api/chart/stream')"
        pos = text.find(route_anchor)
        if pos < 0:
            raise RuntimeError("app-server.mjs: /api/chart/stream route anchor not found")
        text = text[:pos] + SYSTEM_ROUTE + "\n " + text[pos:]

    if "__systemViewEmitV31('token'" not in text:
        anchor = "function publish(mint){"
        if anchor not in text:
            raise RuntimeError("app-server.mjs: publish(mint) not found")

        hook = """function publish(mint){
  // V31 System View: actual server publish cadence drives the 3D impulse.
  try{
    const __v31t=store?.state?.tokens?.[mint]||{};
    __systemViewEmitV31('token',{
      mint:String(mint||''),
      updatedAt:Number(__v31t?.updatedAt||Date.now())
    });
  }catch{}
"""
        text = text.replace(anchor, hook, 1)

    if "__systemViewEmitV31('create'" not in text:
        fallback = "discMetrics.nonCreateEventsIgnored++;discMetrics.eventsFiltered++;return}"
        idx = text.find(fallback)
        if idx < 0:
            raise RuntimeError("app-server.mjs: Pump CREATE filter anchor not found")
        end = idx + len(fallback)
        text = (
            text[:end]
            + "\n        try{__systemViewEmitV31('create',{signature:String(sig||'')})}catch{}"
            + text[end:]
        )

    if text != original:
        write(p, text)
    else:
        log("app-server.mjs already V31-clean")

def patch_system_js():
    p = ROOT / "system.js"
    text = p.read_text(encoding="utf-8")

    if PATCH_ID in text:
        log("system.js already has V31")
        return

    text = text.rstrip() + "\n\n// " + PATCH_ID + "\n" + SYSTEM_JS_V31 + "\n"
    write(p, text)

def patch_system_html():
    p = ROOT / "system.html"
    if not p.is_file():
        return

    text = p.read_text(encoding="utf-8")
    original = text

    text = re.sub(
        r'(<script[^>]+src="/system\.js)(?:\?[^"]*)?(")',
        r'\1?v=real-web-v31\2',
        text,
        count=1
    )

    if text != original:
        write(p, text)

def checks():
    for p in [ROOT / "system.js", ROOT / "app-server.mjs"]:
        result = subprocess.run(
            ["node", "--check", str(p)],
            cwd=ROOT,
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"node --check failed for {relative(p)}:\n"
                + (result.stderr or result.stdout)
            )

        log(f"syntax OK: {relative(p)}")

    server = (ROOT / "app-server.mjs").read_text(encoding="utf-8")
    system = (ROOT / "system.js").read_text(encoding="utf-8")

    required_server = [
        PATCH_ID,
        "/api/system/stream",
        "__systemViewEmitV31('token'",
        "__systemViewEmitV31('create'"
    ]
    for marker in required_server:
        if marker not in server:
            raise RuntimeError(f"server validation missing: {marker}")

    required_system = [
        PATCH_ID,
        "WEB_LAYOUT_MOBILE_V31",
        "connectSystemStreamV31",
        "runCreateRouteV31",
        "runTokenRouteV31",
        "disableLegacyFlowV31"
    ]
    for marker in required_system:
        if marker not in system:
            raise RuntimeError(f"system validation missing: {marker}")

try:
    log(f"project root: {ROOT}")
    patch_server()
    patch_system_js()
    patch_system_html()
    checks()

    log("INSTALL COMPLETE")
    log(f"backup: {BACKUP_DIR}")
    log("All 10 modules: compact fitted home topology")
    log("Zoom / pinch / rotate: enabled")
    log("Old continuous V8 bubbles: disabled")
    log("Real System SSE: /api/system/stream")
    log("Create: Discovery -> Bootstrap -> Core")
    log("Token publish: Core -> Holder/Market -> Risk -> Decision")
    log("LIVE EXECUTION: deliberately not faked")
    log("Restart the Replit app/workflow, then hard-refresh Safari.")

except Exception as exc:
    rollback(exc)
