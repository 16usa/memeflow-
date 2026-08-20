#!/usr/bin/env python3
from __future__ import annotations

import base64
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_DISCOVERY_SETTINGS_UI_V1"
STAMP = time.strftime("%Y%m%d-%H%M%S")
RUNTIME = base64.b64decode("CigoKSA9PiB7CiAgJ3VzZSBzdHJpY3QnOwoKICBjb25zdCBQQVRDSCA9ICdNRU1FRkxPV19ESVNDT1ZFUllfU0VUVElOR1NfVUlfVjEnOwogIGlmICh3aW5kb3cuX19tZkRpc2NvdmVyeVNldHRpbmdzVWlWMSkgcmV0dXJuOwogIHdpbmRvdy5fX21mRGlzY292ZXJ5U2V0dGluZ3NVaVYxID0gdHJ1ZTsKCiAgY29uc3Qgc3RhdGUgPSB7CiAgICBidXN5OiBmYWxzZSwKICAgIG1vZGU6IG51bGwsCiAgICBzb3VyY2U6IG51bGwsCiAgICBkZXg6IG51bGwsCiAgICBwdW1wOiBudWxsLAogICAgcGxhdGZvcm1WYWx1ZUVsOiBudWxsLAogICAgbW91bnRlZEF0OiAwLAogICAgcG9sbDogbnVsbCwKICAgIG9ic2VydmVyOiBudWxsLAogICAgbW91bnRUaW1lcjogbnVsbAogIH07CgogIGNvbnN0IGNzcyA9IGAKICAjbWZkcy1wYW5lbC12MSB7CiAgICBtYXJnaW46IDE2cHggMjBweCAwOwogICAgcGFkZGluZzogMTZweDsKICAgIGJvcmRlcjogMXB4IHNvbGlkICMxNzMwM2E7CiAgICBib3JkZXItcmFkaXVzOiAyMHB4OwogICAgYmFja2dyb3VuZDoKICAgICAgcmFkaWFsLWdyYWRpZW50KDEyMCUgMTgwJSBhdCAwJSAwJSwgcmdiYSg0NSwyMTgsMjU1LC4wNDUpLCB0cmFuc3BhcmVudCA0NCUpLAogICAgICBsaW5lYXItZ3JhZGllbnQoMTgwZGVnLCAjMDMwYjEwIDAlLCAjMDIwODBjIDEwMCUpOwogICAgYm94LXNoYWRvdzogaW5zZXQgMCAxcHggMCByZ2JhKDI1NSwyNTUsMjU1LC4wMTQpOwogIH0KICAjbWZkcy1wYW5lbC12MSAqIHsgYm94LXNpemluZzogYm9yZGVyLWJveDsgfQogIC5tZmRzLXYxLWhlYWQgewogICAgZGlzcGxheTogZmxleDsKICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7CiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47CiAgICBnYXA6IDEycHg7CiAgICBtYXJnaW4tYm90dG9tOiAxM3B4OwogIH0KICAubWZkcy12MS1raWNrZXIgewogICAgY29sb3I6ICM2NDdmOGI7CiAgICBmb250LXNpemU6IDEwcHg7CiAgICBsaW5lLWhlaWdodDogMTsKICAgIGZvbnQtd2VpZ2h0OiA3MDA7CiAgICBsZXR0ZXItc3BhY2luZzogLjE3ZW07CiAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlOwogIH0KICAubWZkcy12MS10aXRsZSB7CiAgICBtYXJnaW4tdG9wOiA2cHg7CiAgICBjb2xvcjogI2VhZjRmODsKICAgIGZvbnQtc2l6ZTogMTdweDsKICAgIGxpbmUtaGVpZ2h0OiAxLjE1OwogICAgZm9udC13ZWlnaHQ6IDczMDsKICAgIGxldHRlci1zcGFjaW5nOiAtLjAxNWVtOwogIH0KICAubWZkcy12MS1zdGF0dXMgewogICAgZmxleDogMCAwIGF1dG87CiAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDsKICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7CiAgICBnYXA6IDdweDsKICAgIG1pbi1oZWlnaHQ6IDMycHg7CiAgICBwYWRkaW5nOiAwIDEwcHg7CiAgICBib3JkZXI6IDFweCBzb2xpZCAjMWEzMzNkOwogICAgYm9yZGVyLXJhZGl1czogOTk5cHg7CiAgICBjb2xvcjogIzg2YTBhYjsKICAgIGJhY2tncm91bmQ6ICMwMjA5MGQ7CiAgICBmb250LXNpemU6IDlweDsKICAgIGZvbnQtd2VpZ2h0OiA3NTA7CiAgICBsZXR0ZXItc3BhY2luZzogLjEyZW07CiAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlOwogICAgd2hpdGUtc3BhY2U6IG5vd3JhcDsKICB9CiAgLm1mZHMtdjEtc3RhdHVzOjpiZWZvcmUgewogICAgY29udGVudDogIiI7CiAgICB3aWR0aDogN3B4OwogICAgaGVpZ2h0OiA3cHg7CiAgICBib3JkZXItcmFkaXVzOiA1MCU7CiAgICBiYWNrZ3JvdW5kOiAjNmQ4NDkwOwogICAgYm94LXNoYWRvdzogMCAwIDAgMnB4IHJnYmEoMTA5LDEzMiwxNDQsLjA4KTsKICB9CiAgLm1mZHMtdjEtc3RhdHVzLmxpdmUgewogICAgY29sb3I6ICM3MmVlYzA7CiAgICBib3JkZXItY29sb3I6IHJnYmEoNTIsMTkwLDEzOSwuMzQpOwogIH0KICAubWZkcy12MS1zdGF0dXMubGl2ZTo6YmVmb3JlIHsKICAgIGJhY2tncm91bmQ6ICM0NGVkYWM7CiAgICBib3gtc2hhZG93OiAwIDAgMTBweCByZ2JhKDY4LDIzNywxNzIsLjQ1KTsKICB9CiAgLm1mZHMtdjEtc3RhdHVzLnN0YXJ0aW5nIHsKICAgIGNvbG9yOiAjN2NjZmU1OwogICAgYm9yZGVyLWNvbG9yOiByZ2JhKDYwLDE3MiwyMDUsLjMwKTsKICB9CiAgLm1mZHMtdjEtc3RhdHVzLnN0YXJ0aW5nOjpiZWZvcmUgewogICAgYmFja2dyb3VuZDogIzRlZDhmZjsKICAgIGJveC1zaGFkb3c6IDAgMCAxMHB4IHJnYmEoNzgsMjE2LDI1NSwuMzUpOwogIH0KICAubWZkcy12MS1zZWdtZW50IHsKICAgIGRpc3BsYXk6IGdyaWQ7CiAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IHJlcGVhdCgzLCBtaW5tYXgoMCwgMWZyKSk7CiAgICBnYXA6IDdweDsKICAgIHBhZGRpbmc6IDVweDsKICAgIGJvcmRlcjogMXB4IHNvbGlkICMxNDI3MzE7CiAgICBib3JkZXItcmFkaXVzOiAxNXB4OwogICAgYmFja2dyb3VuZDogIzAyMDcwYjsKICB9CiAgLm1mZHMtdjEtbW9kZSB7CiAgICBhcHBlYXJhbmNlOiBub25lOwogICAgLXdlYmtpdC1hcHBlYXJhbmNlOiBub25lOwogICAgbWluLXdpZHRoOiAwOwogICAgaGVpZ2h0OiA0MnB4OwogICAgYm9yZGVyOiAxcHggc29saWQgdHJhbnNwYXJlbnQ7CiAgICBib3JkZXItcmFkaXVzOiAxMXB4OwogICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7CiAgICBjb2xvcjogIzcxODk5NTsKICAgIGZvbnQ6IGluaGVyaXQ7CiAgICBmb250LXNpemU6IDEwcHg7CiAgICBmb250LXdlaWdodDogNzgwOwogICAgbGV0dGVyLXNwYWNpbmc6IC4xMmVtOwogICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTsKICAgIG91dGxpbmU6IG5vbmU7CiAgICAtd2Via2l0LXRhcC1oaWdobGlnaHQtY29sb3I6IHRyYW5zcGFyZW50OwogICAgdG91Y2gtYWN0aW9uOiBtYW5pcHVsYXRpb247CiAgICB0cmFuc2l0aW9uOgogICAgICBiYWNrZ3JvdW5kIC4xNHMgZWFzZSwKICAgICAgYm9yZGVyLWNvbG9yIC4xNHMgZWFzZSwKICAgICAgY29sb3IgLjE0cyBlYXNlLAogICAgICB0cmFuc2Zvcm0gLjA4cyBlYXNlLAogICAgICBib3gtc2hhZG93IC4xNHMgZWFzZTsKICB9CiAgLm1mZHMtdjEtbW9kZTphY3RpdmUgeyB0cmFuc2Zvcm06IHNjYWxlKC45NzUpOyB9CiAgLm1mZHMtdjEtbW9kZVtkaXNhYmxlZF0geyBvcGFjaXR5OiAuNTU7IH0KICAubWZkcy12MS1tb2RlLmFjdGl2ZVtkYXRhLW1vZGU9InB1bXAiXSB7CiAgICBjb2xvcjogI2U2ZmFmZjsKICAgIGJvcmRlci1jb2xvcjogcmdiYSg2NiwyMTEsMjQ0LC41Mik7CiAgICBiYWNrZ3JvdW5kOiByZ2JhKDM1LDE1NywxODYsLjEwKTsKICAgIGJveC1zaGFkb3c6IGluc2V0IDAgMCAwIDFweCByZ2JhKDY2LDIxMSwyNDQsLjA4KTsKICB9CiAgLm1mZHMtdjEtbW9kZS5hY3RpdmVbZGF0YS1tb2RlPSJkZXgiXSB7CiAgICBjb2xvcjogI2RmZmJlZDsKICAgIGJvcmRlci1jb2xvcjogcmdiYSg2NiwyMzAsMTY0LC40OCk7CiAgICBiYWNrZ3JvdW5kOiByZ2JhKDQwLDE3NiwxMjIsLjEwKTsKICAgIGJveC1zaGFkb3c6IGluc2V0IDAgMCAwIDFweCByZ2JhKDY2LDIzMCwxNjQsLjA4KTsKICB9CiAgLm1mZHMtdjEtbW9kZS5hY3RpdmVbZGF0YS1tb2RlPSJoeWJyaWQiXSB7CiAgICBjb2xvcjogI2VlZWFmZjsKICAgIGJvcmRlci1jb2xvcjogcmdiYSgxMzIsMTEyLDI1NSwuNTApOwogICAgYmFja2dyb3VuZDogcmdiYSgxMDEsNzksMjE0LC4xMSk7CiAgICBib3gtc2hhZG93OiBpbnNldCAwIDAgMCAxcHggcmdiYSgxMzIsMTEyLDI1NSwuMDgpOwogIH0KICAubWZkcy12MS1mb290IHsKICAgIGRpc3BsYXk6IGZsZXg7CiAgICBhbGlnbi1pdGVtczogY2VudGVyOwogICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuOwogICAgZ2FwOiAxMHB4OwogICAgbWluLWhlaWdodDogMjBweDsKICAgIG1hcmdpbi10b3A6IDEwcHg7CiAgICBjb2xvcjogIzVmNzg4NDsKICAgIGZvbnQtc2l6ZTogMTBweDsKICAgIGxpbmUtaGVpZ2h0OiAxLjM1OwogIH0KICAubWZkcy12MS1ub3RlIHsgbWluLXdpZHRoOiAwOyB9CiAgLm1mZHMtdjEtbWV0cmljIHsKICAgIGZsZXg6IDAgMCBhdXRvOwogICAgY29sb3I6ICM3ODkzOWU7CiAgICB3aGl0ZS1zcGFjZTogbm93cmFwOwogICAgZm9udC12YXJpYW50LW51bWVyaWM6IHRhYnVsYXItbnVtczsKICB9CiAgLm1mZHMtdjEtZXJyb3IgewogICAgY29sb3I6ICNmZjc0ODkgIWltcG9ydGFudDsKICB9CiAgQG1lZGlhIChtYXgtd2lkdGg6IDU2MHB4KSB7CiAgICAjbWZkcy1wYW5lbC12MSB7CiAgICAgIG1hcmdpbjogMTRweCAyMHB4IDA7CiAgICAgIHBhZGRpbmc6IDE0cHg7CiAgICAgIGJvcmRlci1yYWRpdXM6IDE4cHg7CiAgICB9CiAgICAubWZkcy12MS10aXRsZSB7IGZvbnQtc2l6ZTogMTZweDsgfQogICAgLm1mZHMtdjEtbW9kZSB7IGhlaWdodDogNDBweDsgZm9udC1zaXplOiA5cHg7IH0KICAgIC5tZmRzLXYxLWZvb3QgeyBmb250LXNpemU6IDlweDsgfQogIH0KICBgOwoKICBmdW5jdGlvbiBpbnN0YWxsU3R5bGUoKSB7CiAgICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21mZHMtc3R5bGUtdjEnKSkgcmV0dXJuOwogICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOwogICAgc3R5bGUuaWQgPSAnbWZkcy1zdHlsZS12MSc7CiAgICBzdHlsZS50ZXh0Q29udGVudCA9IGNzczsKICAgIChkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkuYXBwZW5kQ2hpbGQoc3R5bGUpOwogIH0KCiAgZnVuY3Rpb24gbGVhdmVzKCkgewogICAgcmV0dXJuIEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYm9keSAqJykpLmZpbHRlcihlbCA9PiB7CiAgICAgIGlmIChlbC5pZCA9PT0gJ21mZHMtcGFuZWwtdjEnIHx8IGVsLmNsb3Nlc3Q/LignI21mZHMtcGFuZWwtdjEnKSkgcmV0dXJuIGZhbHNlOwogICAgICBpZiAoZWwuY2hpbGRyZW4ubGVuZ3RoKSByZXR1cm4gZmFsc2U7CiAgICAgIGNvbnN0IHQgPSAoZWwudGV4dENvbnRlbnQgfHwgJycpLnRyaW0oKTsKICAgICAgcmV0dXJuIEJvb2xlYW4odCk7CiAgICB9KTsKICB9CgogIGZ1bmN0aW9uIGxlYWZFeGFjdCh0ZXh0KSB7CiAgICBjb25zdCB3YW50ZWQgPSBTdHJpbmcodGV4dCkudHJpbSgpLnRvTG93ZXJDYXNlKCk7CiAgICByZXR1cm4gbGVhdmVzKCkuZmluZChlbCA9PiAoZWwudGV4dENvbnRlbnQgfHwgJycpLnRyaW0oKS50b0xvd2VyQ2FzZSgpID09PSB3YW50ZWQpIHx8IG51bGw7CiAgfQoKICBmdW5jdGlvbiBsZWFmSW5jbHVkZXModGV4dCkgewogICAgY29uc3Qgd2FudGVkID0gU3RyaW5nKHRleHQpLnRyaW0oKS50b0xvd2VyQ2FzZSgpOwogICAgcmV0dXJuIGxlYXZlcygpLmZpbmQoZWwgPT4gKGVsLnRleHRDb250ZW50IHx8ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh3YW50ZWQpKSB8fCBudWxsOwogIH0KCiAgZnVuY3Rpb24gZmluZFN1bW1hcnlSb3coKSB7CiAgICBjb25zdCBsYWJlbCA9IGxlYWZFeGFjdCgnUGxhdGZvcm0nKTsKICAgIGlmICghbGFiZWwpIHJldHVybiBudWxsOwoKICAgIGxldCBuID0gbGFiZWwucGFyZW50RWxlbWVudDsKICAgIHdoaWxlIChuICYmIG4gIT09IGRvY3VtZW50LmJvZHkpIHsKICAgICAgY29uc3QgdHh0ID0gKG4uaW5uZXJUZXh0IHx8IG4udGV4dENvbnRlbnQgfHwgJycpLnJlcGxhY2UoL1xzKy9nLCAnICcpLnRyaW0oKS50b0xvd2VyQ2FzZSgpOwogICAgICBjb25zdCBoYXNBbGwgPQogICAgICAgIHR4dC5pbmNsdWRlcygncGxhdGZvcm0nKSAmJgogICAgICAgIHR4dC5pbmNsdWRlcygnYWkgcG9saWN5JykgJiYKICAgICAgICB0eHQuaW5jbHVkZXMoJ2tpbGwgc3dpdGNoJyk7CgogICAgICBpZiAoaGFzQWxsICYmIHR4dC5sZW5ndGggPCA1MjApIHJldHVybiBuOwogICAgICBuID0gbi5wYXJlbnRFbGVtZW50OwogICAgfQogICAgcmV0dXJuIG51bGw7CiAgfQoKICBmdW5jdGlvbiBmaW5kUGxhdGZvcm1WYWx1ZSgpIHsKICAgIGlmIChzdGF0ZS5wbGF0Zm9ybVZhbHVlRWw/LmlzQ29ubmVjdGVkKSByZXR1cm4gc3RhdGUucGxhdGZvcm1WYWx1ZUVsOwoKICAgIGNvbnN0IGxhYmVsID0gbGVhZkV4YWN0KCdQbGF0Zm9ybScpOwogICAgaWYgKCFsYWJlbCkgcmV0dXJuIG51bGw7CgogICAgbGV0IG4gPSBsYWJlbC5wYXJlbnRFbGVtZW50OwogICAgZm9yIChsZXQgZGVwdGggPSAwOyBuICYmIG4gIT09IGRvY3VtZW50LmJvZHkgJiYgZGVwdGggPCA1OyBkZXB0aCsrLCBuID0gbi5wYXJlbnRFbGVtZW50KSB7CiAgICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBBcnJheS5mcm9tKG4ucXVlcnlTZWxlY3RvckFsbCgnKicpKS5maWx0ZXIoZWwgPT4gewogICAgICAgIGlmIChlbC5jaGlsZHJlbi5sZW5ndGgpIHJldHVybiBmYWxzZTsKICAgICAgICBjb25zdCB0ID0gKGVsLnRleHRDb250ZW50IHx8ICcnKS50cmltKCk7CiAgICAgICAgaWYgKCF0KSByZXR1cm4gZmFsc2U7CiAgICAgICAgaWYgKHQudG9Mb3dlckNhc2UoKSA9PT0gJ3BsYXRmb3JtJykgcmV0dXJuIGZhbHNlOwogICAgICAgIHJldHVybiB0cnVlOwogICAgICB9KTsKCiAgICAgIGNvbnN0IGRpcmVjdCA9IGNhbmRpZGF0ZXMuZmluZChlbCA9PiB7CiAgICAgICAgY29uc3QgdCA9IChlbC50ZXh0Q29udGVudCB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCk7CiAgICAgICAgcmV0dXJuIFsncHVtcC5mdW4nLCAncHVtcCcsICdkZXgnLCAnaHlicmlkJ10uaW5jbHVkZXModCk7CiAgICAgIH0pOwoKICAgICAgaWYgKGRpcmVjdCkgewogICAgICAgIHN0YXRlLnBsYXRmb3JtVmFsdWVFbCA9IGRpcmVjdDsKICAgICAgICByZXR1cm4gZGlyZWN0OwogICAgICB9CgogICAgICBpZiAoKG4uaW5uZXJUZXh0IHx8ICcnKS5sZW5ndGggPCAxMDAgJiYgY2FuZGlkYXRlcy5sZW5ndGggPT09IDEpIHsKICAgICAgICBzdGF0ZS5wbGF0Zm9ybVZhbHVlRWwgPSBjYW5kaWRhdGVzWzBdOwogICAgICAgIHJldHVybiBjYW5kaWRhdGVzWzBdOwogICAgICB9CiAgICB9CgogICAgcmV0dXJuIG51bGw7CiAgfQoKICBmdW5jdGlvbiBmaW5kTG9naWNTZWN0aW9uKCkgewogICAgY29uc3QgdGl0bGUgPSBsZWFmRXhhY3QoJ0xvZ2ljJyk7CiAgICBpZiAoIXRpdGxlKSByZXR1cm4gbnVsbDsKCiAgICBsZXQgbiA9IHRpdGxlLnBhcmVudEVsZW1lbnQ7CiAgICB3aGlsZSAobiAmJiBuICE9PSBkb2N1bWVudC5ib2R5KSB7CiAgICAgIGNvbnN0IHR4dCA9IChuLmlubmVyVGV4dCB8fCBuLnRleHRDb250ZW50IHx8ICcnKS5yZXBsYWNlKC9ccysvZywgJyAnKS50cmltKCkudG9Mb3dlckNhc2UoKTsKICAgICAgaWYgKAogICAgICAgIHR4dC5pbmNsdWRlcygnbG9naWMnKSAmJgogICAgICAgIHR4dC5pbmNsdWRlcygnZGVjaXNpb24gdGhyZXNob2xkcycpICYmCiAgICAgICAgdHh0Lmxlbmd0aCA8IDMyMAogICAgICApIHJldHVybiBuOwogICAgICBuID0gbi5wYXJlbnRFbGVtZW50OwogICAgfQogICAgcmV0dXJuIG51bGw7CiAgfQoKICBmdW5jdGlvbiBjcmVhdGVQYW5lbCgpIHsKICAgIGNvbnN0IHBhbmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2VjdGlvbicpOwogICAgcGFuZWwuaWQgPSAnbWZkcy1wYW5lbC12MSc7CiAgICBwYW5lbC5zZXRBdHRyaWJ1dGUoJ2RhdGEtcGF0Y2gnLCBQQVRDSCk7CiAgICBwYW5lbC5pbm5lckhUTUwgPSBgCiAgICAgIDxkaXYgY2xhc3M9Im1mZHMtdjEtaGVhZCI+CiAgICAgICAgPGRpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9Im1mZHMtdjEta2lja2VyIj5Ub2tlbiBpbnRha2U8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9Im1mZHMtdjEtdGl0bGUiPkRpc2NvdmVyeSBzb3VyY2U8L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJtZmRzLXYxLXN0YXR1cyBzdGFydGluZyIgaWQ9Im1mZHMtc3RhdHVzLXYxIj5Mb2FkaW5nPC9kaXY+CiAgICAgIDwvZGl2PgoKICAgICAgPGRpdiBjbGFzcz0ibWZkcy12MS1zZWdtZW50IiByb2xlPSJncm91cCIgYXJpYS1sYWJlbD0iRGlzY292ZXJ5IHNvdXJjZSI+CiAgICAgICAgPGJ1dHRvbiBjbGFzcz0ibWZkcy12MS1tb2RlIiB0eXBlPSJidXR0b24iIGRhdGEtbW9kZT0icHVtcCI+UHVtcDwvYnV0dG9uPgogICAgICAgIDxidXR0b24gY2xhc3M9Im1mZHMtdjEtbW9kZSIgdHlwZT0iYnV0dG9uIiBkYXRhLW1vZGU9ImRleCI+REVYPC9idXR0b24+CiAgICAgICAgPGJ1dHRvbiBjbGFzcz0ibWZkcy12MS1tb2RlIiB0eXBlPSJidXR0b24iIGRhdGEtbW9kZT0iaHlicmlkIj5IeWJyaWQ8L2J1dHRvbj4KICAgICAgPC9kaXY+CgogICAgICA8ZGl2IGNsYXNzPSJtZmRzLXYxLWZvb3QiPgogICAgICAgIDxzcGFuIGNsYXNzPSJtZmRzLXYxLW5vdGUiIGlkPSJtZmRzLW5vdGUtdjEiPlN3aXRjaGVzIHRva2VuIGludGFrZSBvbmx5LiBSaXNrIGFuZCB0cmFkaW5nIHNldHRpbmdzIHN0YXkgdW5jaGFuZ2VkLjwvc3Bhbj4KICAgICAgICA8c3BhbiBjbGFzcz0ibWZkcy12MS1tZXRyaWMiIGlkPSJtZmRzLW1ldHJpYy12MSI+PC9zcGFuPgogICAgICA8L2Rpdj4KICAgIGA7CgogICAgcGFuZWwucXVlcnlTZWxlY3RvckFsbCgnLm1mZHMtdjEtbW9kZScpLmZvckVhY2goYnRuID0+IHsKICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gc3dpdGNoTW9kZShidG4uZGF0YXNldC5tb2RlKSwge3Bhc3NpdmU6IHRydWV9KTsKICAgIH0pOwoKICAgIHJldHVybiBwYW5lbDsKICB9CgogIGZ1bmN0aW9uIG1vdW50KCkgewogICAgaW5zdGFsbFN0eWxlKCk7CgogICAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZmRzLXBhbmVsLXYxJykpIHsKICAgICAgdXBkYXRlUGxhdGZvcm1TdW1tYXJ5KCk7CiAgICAgIHJldHVybiB0cnVlOwogICAgfQoKICAgIGNvbnN0IHBhbmVsID0gY3JlYXRlUGFuZWwoKTsKICAgIGNvbnN0IHN1bW1hcnkgPSBmaW5kU3VtbWFyeVJvdygpOwogICAgY29uc3QgbG9naWMgPSBmaW5kTG9naWNTZWN0aW9uKCk7CgogICAgaWYgKHN1bW1hcnk/LnBhcmVudEVsZW1lbnQpIHsKICAgICAgc3VtbWFyeS5pbnNlcnRBZGphY2VudEVsZW1lbnQoJ2FmdGVyZW5kJywgcGFuZWwpOwogICAgfSBlbHNlIGlmIChsb2dpYz8ucGFyZW50RWxlbWVudCkgewogICAgICBsb2dpYy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShwYW5lbCwgbG9naWMpOwogICAgfSBlbHNlIHsKICAgICAgcmV0dXJuIGZhbHNlOwogICAgfQoKICAgIHN0YXRlLm1vdW50ZWRBdCA9IERhdGUubm93KCk7CiAgICBsb2FkU3RhdHVzKCk7CiAgICByZXR1cm4gdHJ1ZTsKICB9CgogIGZ1bmN0aW9uIG1vZGVMYWJlbChtb2RlKSB7CiAgICBpZiAobW9kZSA9PT0gJ3B1bXAnKSByZXR1cm4gJ1B1bXAuZnVuJzsKICAgIGlmIChtb2RlID09PSAnZGV4JykgcmV0dXJuICdERVgnOwogICAgaWYgKG1vZGUgPT09ICdoeWJyaWQnKSByZXR1cm4gJ0h5YnJpZCc7CiAgICByZXR1cm4gJ+KAlCc7CiAgfQoKICBmdW5jdGlvbiB1cGRhdGVQbGF0Zm9ybVN1bW1hcnkoKSB7CiAgICBjb25zdCB2YWx1ZSA9IGZpbmRQbGF0Zm9ybVZhbHVlKCk7CiAgICBpZiAodmFsdWUgJiYgc3RhdGUubW9kZSkgewogICAgICB2YWx1ZS50ZXh0Q29udGVudCA9IG1vZGVMYWJlbChzdGF0ZS5tb2RlKTsKICAgIH0KICB9CgogIGZ1bmN0aW9uIHJlbmRlcigpIHsKICAgIGNvbnN0IHBhbmVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21mZHMtcGFuZWwtdjEnKTsKICAgIGlmICghcGFuZWwpIHJldHVybjsKCiAgICBwYW5lbC5xdWVyeVNlbGVjdG9yQWxsKCcubWZkcy12MS1tb2RlJykuZm9yRWFjaChidG4gPT4gewogICAgICBidG4uY2xhc3NMaXN0LnRvZ2dsZSgnYWN0aXZlJywgYnRuLmRhdGFzZXQubW9kZSA9PT0gc3RhdGUubW9kZSk7CiAgICAgIGJ0bi5kaXNhYmxlZCA9IHN0YXRlLmJ1c3k7CiAgICB9KTsKCiAgICBjb25zdCBzdGF0dXMgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcjbWZkcy1zdGF0dXMtdjEnKTsKICAgIGNvbnN0IG5vdGUgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcjbWZkcy1ub3RlLXYxJyk7CiAgICBjb25zdCBtZXRyaWMgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcjbWZkcy1tZXRyaWMtdjEnKTsKCiAgICBsZXQgY29ubmVjdGVkID0gZmFsc2U7CiAgICBsZXQgc3RhcnRpbmcgPSBmYWxzZTsKCiAgICBpZiAoc3RhdGUubW9kZSA9PT0gJ2RleCcpIHsKICAgICAgY29ubmVjdGVkID0gQm9vbGVhbihzdGF0ZS5kZXg/LmNvbm5lY3RlZCk7CiAgICAgIHN0YXJ0aW5nID0gIWNvbm5lY3RlZCAmJiAhc3RhdGUuZGV4Py5sYXN0RXJyb3I7CiAgICB9IGVsc2UgaWYgKHN0YXRlLm1vZGUgPT09ICdwdW1wJykgewogICAgICBjb25uZWN0ZWQgPSBCb29sZWFuKHN0YXRlLnB1bXA/LmNvbm5lY3RlZCk7CiAgICAgIHN0YXJ0aW5nID0gIWNvbm5lY3RlZDsKICAgIH0gZWxzZSBpZiAoc3RhdGUubW9kZSA9PT0gJ2h5YnJpZCcpIHsKICAgICAgY29uc3QgcHVtcE9uID0gQm9vbGVhbihzdGF0ZS5wdW1wPy5jb25uZWN0ZWQpOwogICAgICBjb25zdCBkZXhPbiA9IEJvb2xlYW4oc3RhdGUuZGV4Py5jb25uZWN0ZWQpOwogICAgICBjb25uZWN0ZWQgPSBwdW1wT24gJiYgZGV4T247CiAgICAgIHN0YXJ0aW5nID0gIWNvbm5lY3RlZDsKICAgIH0KCiAgICBpZiAoc3RhdHVzKSB7CiAgICAgIHN0YXR1cy5jbGFzc0xpc3QucmVtb3ZlKCdsaXZlJywgJ3N0YXJ0aW5nJyk7CiAgICAgIGlmIChzdGF0ZS5idXN5KSB7CiAgICAgICAgc3RhdHVzLmNsYXNzTGlzdC5hZGQoJ3N0YXJ0aW5nJyk7CiAgICAgICAgc3RhdHVzLnRleHRDb250ZW50ID0gJ1N3aXRjaGluZyc7CiAgICAgIH0gZWxzZSBpZiAoY29ubmVjdGVkKSB7CiAgICAgICAgc3RhdHVzLmNsYXNzTGlzdC5hZGQoJ2xpdmUnKTsKICAgICAgICBzdGF0dXMudGV4dENvbnRlbnQgPSAnTGl2ZSc7CiAgICAgIH0gZWxzZSBpZiAoc3RhcnRpbmcpIHsKICAgICAgICBzdGF0dXMuY2xhc3NMaXN0LmFkZCgnc3RhcnRpbmcnKTsKICAgICAgICBzdGF0dXMudGV4dENvbnRlbnQgPSAnU3RhcnRpbmcnOwogICAgICB9IGVsc2UgewogICAgICAgIHN0YXR1cy50ZXh0Q29udGVudCA9ICdPZmZsaW5lJzsKICAgICAgfQogICAgfQoKICAgIGlmIChtZXRyaWMpIHsKICAgICAgaWYgKHN0YXRlLm1vZGUgPT09ICdkZXgnIHx8IHN0YXRlLm1vZGUgPT09ICdoeWJyaWQnKSB7CiAgICAgICAgY29uc3QgcSA9IE51bWJlcihzdGF0ZS5kZXg/LnF1ZXVlRGVwdGggfHwgMCk7CiAgICAgICAgY29uc3QgcGVuZGluZyA9IE51bWJlcihzdGF0ZS5kZXg/LnBlbmRpbmdDb25maXJtcyB8fCAwKTsKICAgICAgICBtZXRyaWMudGV4dENvbnRlbnQgPSBgUSAke3F9IMK3IFAgJHtwZW5kaW5nfWA7CiAgICAgIH0gZWxzZSB7CiAgICAgICAgbWV0cmljLnRleHRDb250ZW50ID0gJyc7CiAgICAgIH0KICAgIH0KCiAgICBpZiAobm90ZSAmJiAhbm90ZS5jbGFzc0xpc3QuY29udGFpbnMoJ21mZHMtdjEtZXJyb3InKSkgewogICAgICBub3RlLnRleHRDb250ZW50ID0gJ1N3aXRjaGVzIHRva2VuIGludGFrZSBvbmx5LiBSaXNrIGFuZCB0cmFkaW5nIHNldHRpbmdzIHN0YXkgdW5jaGFuZ2VkLic7CiAgICB9CgogICAgdXBkYXRlUGxhdGZvcm1TdW1tYXJ5KCk7CiAgfQoKICBhc3luYyBmdW5jdGlvbiBsb2FkU3RhdHVzKCkgewogICAgaWYgKGRvY3VtZW50LmhpZGRlbikgcmV0dXJuOwogICAgaWYgKCFkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWZkcy1wYW5lbC12MScpKSB7CiAgICAgIG1vdW50KCk7CiAgICAgIHJldHVybjsKICAgIH0KCiAgICB0cnkgewogICAgICBjb25zdCByID0gYXdhaXQgZmV0Y2goJy9hcGkvZGlzY292ZXJ5LXNvdXJjZScsIHsKICAgICAgICBtZXRob2Q6ICdHRVQnLAogICAgICAgIGNhY2hlOiAnbm8tc3RvcmUnLAogICAgICAgIGNyZWRlbnRpYWxzOiAnc2FtZS1vcmlnaW4nLAogICAgICAgIGhlYWRlcnM6IHsnYWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nfQogICAgICB9KTsKCiAgICAgIGNvbnN0IGogPSBhd2FpdCByLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTsKICAgICAgaWYgKCFyLm9rKSB0aHJvdyBuZXcgRXJyb3Ioaj8ubWVzc2FnZSB8fCBqPy5lcnJvciB8fCBgSFRUUCAke3Iuc3RhdHVzfWApOwoKICAgICAgc3RhdGUuc291cmNlID0gaj8uc291cmNlIHx8IG51bGw7CiAgICAgIHN0YXRlLm1vZGUgPSBTdHJpbmcoaj8uc291cmNlPy5tb2RlIHx8ICcnKS50b0xvd2VyQ2FzZSgpIHx8IHN0YXRlLm1vZGU7CiAgICAgIHN0YXRlLmRleCA9IGo/LmRleCB8fCBudWxsOwogICAgICBzdGF0ZS5wdW1wID0gaj8ucHVtcCB8fCBudWxsOwoKICAgICAgY29uc3Qgbm90ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZmRzLW5vdGUtdjEnKTsKICAgICAgbm90ZT8uY2xhc3NMaXN0LnJlbW92ZSgnbWZkcy12MS1lcnJvcicpOwogICAgICByZW5kZXIoKTsKICAgIH0gY2F0Y2ggKGUpIHsKICAgICAgY29uc3Qgbm90ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZmRzLW5vdGUtdjEnKTsKICAgICAgaWYgKG5vdGUpIHsKICAgICAgICBub3RlLnRleHRDb250ZW50ID0gYERpc2NvdmVyeSBzdGF0dXMgdW5hdmFpbGFibGU6ICR7ZT8ubWVzc2FnZSB8fCBlfWA7CiAgICAgICAgbm90ZS5jbGFzc0xpc3QuYWRkKCdtZmRzLXYxLWVycm9yJyk7CiAgICAgIH0KICAgIH0KICB9CgogIGFzeW5jIGZ1bmN0aW9uIHN3aXRjaE1vZGUobW9kZSkgewogICAgbW9kZSA9IFN0cmluZyhtb2RlIHx8ICcnKS50b0xvd2VyQ2FzZSgpOwogICAgaWYgKCFbJ3B1bXAnLCAnZGV4JywgJ2h5YnJpZCddLmluY2x1ZGVzKG1vZGUpIHx8IHN0YXRlLmJ1c3kpIHJldHVybjsKICAgIGlmIChtb2RlID09PSBzdGF0ZS5tb2RlKSByZXR1cm47CgogICAgY29uc3QgcHJldmlvdXMgPSBzdGF0ZS5tb2RlOwogICAgc3RhdGUuYnVzeSA9IHRydWU7CiAgICBzdGF0ZS5tb2RlID0gbW9kZTsKICAgIHJlbmRlcigpOwoKICAgIHRyeSB7CiAgICAgIGNvbnN0IHIgPSBhd2FpdCBmZXRjaCgnL2FwaS9kaXNjb3Zlcnktc291cmNlJywgewogICAgICAgIG1ldGhvZDogJ1BPU1QnLAogICAgICAgIGNhY2hlOiAnbm8tc3RvcmUnLAogICAgICAgIGNyZWRlbnRpYWxzOiAnc2FtZS1vcmlnaW4nLAogICAgICAgIGhlYWRlcnM6IHsKICAgICAgICAgICdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsCiAgICAgICAgICAnYWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nCiAgICAgICAgfSwKICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7bW9kZX0pCiAgICAgIH0pOwoKICAgICAgY29uc3QgaiA9IGF3YWl0IHIuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpOwogICAgICBpZiAoIXIub2spIHRocm93IG5ldyBFcnJvcihqPy5tZXNzYWdlIHx8IGo/LmVycm9yIHx8IGBIVFRQICR7ci5zdGF0dXN9YCk7CgogICAgICBzdGF0ZS5zb3VyY2UgPSBqPy5zb3VyY2UgfHwgbnVsbDsKICAgICAgc3RhdGUubW9kZSA9IFN0cmluZyhqPy5zb3VyY2U/Lm1vZGUgfHwgbW9kZSkudG9Mb3dlckNhc2UoKTsKICAgICAgc3RhdGUuZGV4ID0gaj8uZGV4IHx8IG51bGw7CiAgICAgIHN0YXRlLnB1bXAgPSBqPy5wdW1wIHx8IG51bGw7CgogICAgICBjb25zdCBub3RlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21mZHMtbm90ZS12MScpOwogICAgICBpZiAobm90ZSkgewogICAgICAgIG5vdGUuY2xhc3NMaXN0LnJlbW92ZSgnbWZkcy12MS1lcnJvcicpOwogICAgICAgIG5vdGUudGV4dENvbnRlbnQgPSBgJHttb2RlTGFiZWwoc3RhdGUubW9kZSl9IGlzIG5vdyB0aGUgYWN0aXZlIHRva2VuIHNvdXJjZS5gOwogICAgICB9CiAgICB9IGNhdGNoIChlKSB7CiAgICAgIHN0YXRlLm1vZGUgPSBwcmV2aW91czsKICAgICAgY29uc3Qgbm90ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZmRzLW5vdGUtdjEnKTsKICAgICAgaWYgKG5vdGUpIHsKICAgICAgICBub3RlLnRleHRDb250ZW50ID0gYFN3aXRjaCBmYWlsZWQ6ICR7ZT8ubWVzc2FnZSB8fCBlfWA7CiAgICAgICAgbm90ZS5jbGFzc0xpc3QuYWRkKCdtZmRzLXYxLWVycm9yJyk7CiAgICAgIH0KICAgIH0gZmluYWxseSB7CiAgICAgIHN0YXRlLmJ1c3kgPSBmYWxzZTsKICAgICAgcmVuZGVyKCk7CiAgICAgIHNldFRpbWVvdXQobG9hZFN0YXR1cywgNTAwKTsKICAgIH0KICB9CgogIGZ1bmN0aW9uIHF1ZXVlTW91bnQoKSB7CiAgICBjbGVhclRpbWVvdXQoc3RhdGUubW91bnRUaW1lcik7CiAgICBzdGF0ZS5tb3VudFRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7CiAgICAgIG1vdW50KCk7CiAgICAgIHVwZGF0ZVBsYXRmb3JtU3VtbWFyeSgpOwogICAgfSwgODApOwogIH0KCiAgZnVuY3Rpb24gc3RhcnQoKSB7CiAgICBpbnN0YWxsU3R5bGUoKTsKICAgIG1vdW50KCk7CgogICAgc3RhdGUub2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihxdWV1ZU1vdW50KTsKICAgIHN0YXRlLm9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgewogICAgICBjaGlsZExpc3Q6IHRydWUsCiAgICAgIHN1YnRyZWU6IHRydWUKICAgIH0pOwoKICAgIHN0YXRlLnBvbGwgPSBzZXRJbnRlcnZhbChsb2FkU3RhdHVzLCAyNTAwKTsKCiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgKCkgPT4gewogICAgICBpZiAoIWRvY3VtZW50LmhpZGRlbikgewogICAgICAgIHF1ZXVlTW91bnQoKTsKICAgICAgICBsb2FkU3RhdHVzKCk7CiAgICAgIH0KICAgIH0pOwoKICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwYWdlc2hvdycsICgpID0+IHsKICAgICAgcXVldWVNb3VudCgpOwogICAgICBsb2FkU3RhdHVzKCk7CiAgICB9KTsKICB9CgogIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycpIHsKICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBzdGFydCwge29uY2U6IHRydWV9KTsKICB9IGVsc2UgewogICAgc3RhcnQoKTsKICB9Cn0pKCk7Cg==").decode("utf-8")

def log(msg):
    print(f"[DISCOVERY-SETTINGS-V1] {msg}", flush=True)

def find_root():
    candidates = [
        Path.cwd(),
        Path.cwd() / "memeflow-app",
        Path.home() / "workspace",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace"),
        Path("/home/runner/workspace/memeflow-app"),
    ]

    for root in candidates:
        try:
            root = root.resolve()
        except Exception:
            continue

        if (root / "app-server.mjs").is_file():
            return root

    for base in [Path("/home/runner/workspace"), Path.cwd()]:
        if not base.exists():
            continue
        for p in base.glob("**/app-server.mjs"):
            return p.parent.resolve()

    raise RuntimeError("MEMEFLOW project root not found")

ROOT = find_root()
SERVER = ROOT / "app-server.mjs"
BACKUP_DIR = ROOT / f".discovery-settings-ui-v1-backup-{STAMP}"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
changed = []

SKIP_DIRS = {
    "node_modules", ".git", "data", "dist", "build",
    "__pycache__"
}

def rel(path):
    return path.resolve().relative_to(ROOT.resolve())

def usable(path):
    try:
        parts = rel(path).parts
    except Exception:
        return False

    for part in parts:
        if part in SKIP_DIRS:
            return False
        if part.startswith(".discovery-"):
            return False
        if part.startswith(".v31"):
            return False

    return True

def score_file(path):
    if not usable(path):
        return -1

    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return -1

    low = text.lower()
    score = 0

    checks = [
        ("system settings", 5),
        ("save settings", 4),
        ("restore defaults", 3),
        ("live configuration", 3),
        ("ai policy", 2),
        ("kill switch", 2),
        ("entry filters", 2),
        ("risk & exits", 2),
    ]

    for token, weight in checks:
        if token in low:
            score += weight

    name = path.name.lower()
    if "setting" in name:
        score += 3
    if name.startswith("system"):
        score += 1

    return score

def find_target():
    candidates = []

    for ext in ("*.html", "*.js", "*.mjs"):
        for p in ROOT.rglob(ext):
            s = score_file(p)
            if s >= 8:
                candidates.append((s, p))

    if not candidates:
        raise RuntimeError(
            "Could not locate the System settings UI file. "
            "No file contained enough of: System settings / Save settings / "
            "Restore defaults / Live configuration."
        )

    candidates.sort(key=lambda row: (row[0], -len(row[1].parts)), reverse=True)
    best_score = candidates[0][0]
    best = [p for s, p in candidates if s == best_score]

    if len(best) > 1:
        # Prefer HTML because inline UI injection is isolated from the app JS.
        html = [p for p in best if p.suffix.lower() == ".html"]
        if len(html) == 1:
            return html[0], best_score

    return candidates[0][1], best_score

def backup(path):
    if path in changed:
        return

    dest = BACKUP_DIR / rel(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)
    changed.append(path)

def write(path, text):
    backup(path)
    path.write_text(text, encoding="utf-8")
    log(f"patched {rel(path)}")

def rollback(reason):
    log(f"ERROR: {reason}")

    for path in reversed(changed):
        src = BACKUP_DIR / rel(path)
        if src.exists():
            shutil.copy2(src, path)
            log(f"restored {rel(path)}")

    log("ROLLBACK COMPLETE")
    sys.exit(1)

def patch_html(path, text):
    if PATCH_ID in text:
        return text

    tag = (
        "\n<!-- " + PATCH_ID + " -->\n"
        "<script>\n" + RUNTIME + "\n</script>\n"
    )

    if re.search(r"</body\s*>", text, flags=re.I):
        return re.sub(
            r"</body\s*>",
            tag + "</body>",
            text,
            count=1,
            flags=re.I
        )

    return text.rstrip() + tag

def patch_js(path, text):
    if PATCH_ID in text:
        return text

    return (
        text.rstrip()
        + "\n\n// " + PATCH_ID + "\n"
        + RUNTIME
        + "\n"
    )

try:
    log(f"root: {ROOT}")

    server_text = SERVER.read_text(encoding="utf-8")

    if "/api/discovery-source" not in server_text:
        raise RuntimeError(
            "Discovery Router V1.1 endpoint /api/discovery-source was not found. "
            "Install the router first."
        )

    target, score = find_target()
    log(f"settings UI target: {rel(target)} (score={score})")

    original = target.read_text(encoding="utf-8")

    if PATCH_ID in original:
        log("already installed")
        sys.exit(0)

    if target.suffix.lower() == ".html":
        patched = patch_html(target, original)
    else:
        patched = patch_js(target, original)

    write(target, patched)

    # Validate the injected JS independently.
    check_file = ROOT / ".mfds-ui-v1-runtime-check.js"
    check_file.write_text(RUNTIME, encoding="utf-8")
    try:
        result = subprocess.run(
            ["node", "--check", str(check_file)],
            cwd=ROOT,
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            raise RuntimeError(
                "runtime JS syntax check failed:\n"
                + (result.stderr or result.stdout)
            )
    finally:
        try:
            check_file.unlink()
        except Exception:
            pass

    final = target.read_text(encoding="utf-8")
    required = [
        PATCH_ID,
        "mfds-panel-v1",
        "/api/discovery-source",
        "Discovery source",
        "data-mode=\"pump\"",
        "data-mode=\"dex\"",
        "data-mode=\"hybrid\""
    ]

    for token in required:
        if token not in final:
            raise RuntimeError(f"validation missing: {token}")

    log("INSTALL COMPLETE")
    log("Discovery source is now integrated into System settings")
    log("PUMP / DEX / HYBRID switches apply immediately")
    log("top PLATFORM summary updates automatically")
    log("DEX queue/pending status is visible in the settings panel")
    log("Risk / Trading / Entry filters / Exits are untouched")
    log(f"backup: {BACKUP_DIR}")
    log("Hard-refresh Safari after restarting the app only if the page is cached.")

except Exception as exc:
    rollback(exc)
