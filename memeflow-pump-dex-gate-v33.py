#!/usr/bin/env python3
from __future__ import annotations

import base64
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_PUMP_DEX_GATE_V33"
STAMP = time.strftime("%Y%m%d-%H%M%S")
GATE_CODE = base64.b64decode("Y29uc3QgVkVSU0lPTiA9ICdQVU1QX0RFWF9WRVJJRklDQVRJT05fR0FURV9WMSc7CmNvbnN0IFdTT0wgPSAnU28xMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMic7Cgpjb25zdCBzbGVlcCA9IG1zID0+IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpOwpjb25zdCBmaW5pdGUgPSB2ID0+IHYgIT09IG51bGwgJiYgdiAhPT0gdW5kZWZpbmVkICYmIHYgIT09ICcnICYmIE51bWJlci5pc0Zpbml0ZShOdW1iZXIodikpOwoKZnVuY3Rpb24gcGFpckFjdGl2aXR5KHBhaXIpIHsKICBmb3IgKGNvbnN0IHdpbmRvdyBvZiBbJ201JywgJ2gxJywgJ2g2JywgJ2gyNCddKSB7CiAgICBjb25zdCByb3cgPSBwYWlyPy50eG5zPy5bd2luZG93XTsKICAgIGNvbnN0IGJ1eXMgPSBOdW1iZXIocm93Py5idXlzIHx8IDApOwogICAgY29uc3Qgc2VsbHMgPSBOdW1iZXIocm93Py5zZWxscyB8fCAwKTsKICAgIGlmIChidXlzICsgc2VsbHMgPiAwKSByZXR1cm4geyB3aW5kb3csIGJ1eXMsIHNlbGxzIH07CiAgfQogIHJldHVybiB7IHdpbmRvdzogbnVsbCwgYnV5czogMCwgc2VsbHM6IDAgfTsKfQoKZnVuY3Rpb24gY2hvb3NlUGFpcihyb3dzLCBtaW50KSB7CiAgY29uc3QgY2FuZGlkYXRlcyA9IChBcnJheS5pc0FycmF5KHJvd3MpID8gcm93cyA6IFtdKS5maWx0ZXIocGFpciA9PiB7CiAgICBpZiAoU3RyaW5nKHBhaXI/LmNoYWluSWQgfHwgJycpLnRvTG93ZXJDYXNlKCkgIT09ICdzb2xhbmEnKSByZXR1cm4gZmFsc2U7CiAgICBjb25zdCBiYXNlID0gU3RyaW5nKHBhaXI/LmJhc2VUb2tlbj8uYWRkcmVzcyB8fCAnJyk7CiAgICBjb25zdCBxdW90ZSA9IFN0cmluZyhwYWlyPy5xdW90ZVRva2VuPy5hZGRyZXNzIHx8ICcnKTsKICAgIGNvbnN0IHNvbFBhaXJlZCA9IChiYXNlID09PSBtaW50ICYmIHF1b3RlID09PSBXU09MKSB8fCAocXVvdGUgPT09IG1pbnQgJiYgYmFzZSA9PT0gV1NPTCk7CiAgICBpZiAoIXNvbFBhaXJlZCkgcmV0dXJuIGZhbHNlOwogICAgY29uc3QgYWN0aXZpdHkgPSBwYWlyQWN0aXZpdHkocGFpcik7CiAgICBpZiAoYWN0aXZpdHkuYnV5cyArIGFjdGl2aXR5LnNlbGxzIDw9IDApIHJldHVybiBmYWxzZTsKICAgIGNvbnN0IGxpcXVpZGl0eVVzZCA9IE51bWJlcihwYWlyPy5saXF1aWRpdHk/LnVzZCk7CiAgICBpZiAoIU51bWJlci5pc0Zpbml0ZShsaXF1aWRpdHlVc2QpIHx8IGxpcXVpZGl0eVVzZCA8PSAwKSByZXR1cm4gZmFsc2U7CiAgICByZXR1cm4gQm9vbGVhbihwYWlyPy5wYWlyQWRkcmVzcyAmJiBwYWlyPy51cmwpOwogIH0pOwogIGNhbmRpZGF0ZXMuc29ydCgoYSwgYikgPT4gTnVtYmVyKGI/LmxpcXVpZGl0eT8udXNkIHx8IDApIC0gTnVtYmVyKGE/LmxpcXVpZGl0eT8udXNkIHx8IDApKTsKICByZXR1cm4gY2FuZGlkYXRlc1swXSB8fCBudWxsOwp9CgpmdW5jdGlvbiBtYXJrZXRQYXRjaChwYWlyLCBtaW50KSB7CiAgY29uc3QgYWN0aXZpdHkgPSBwYWlyQWN0aXZpdHkocGFpcik7CiAgY29uc3QgcHJlc3N1cmUgPSBhY3Rpdml0eS5zZWxscyA+IDAgPyBhY3Rpdml0eS5idXlzIC8gYWN0aXZpdHkuc2VsbHMgOiBhY3Rpdml0eS5idXlzID4gMCA/IE1hdGgubWF4KDEsIGFjdGl2aXR5LmJ1eXMpIDogbnVsbDsKICBjb25zdCBiYXNlID0gU3RyaW5nKHBhaXI/LmJhc2VUb2tlbj8uYWRkcmVzcyB8fCAnJyk7CiAgY29uc3QgcXVvdGUgPSBTdHJpbmcocGFpcj8ucXVvdGVUb2tlbj8uYWRkcmVzcyB8fCAnJyk7CiAgbGV0IHByaWNlU29sID0gbnVsbDsKCiAgaWYgKGJhc2UgPT09IG1pbnQgJiYgcXVvdGUgPT09IFdTT0wgJiYgZmluaXRlKHBhaXI/LnByaWNlTmF0aXZlKSAmJiBOdW1iZXIocGFpci5wcmljZU5hdGl2ZSkgPiAwKSB7CiAgICBwcmljZVNvbCA9IE51bWJlcihwYWlyLnByaWNlTmF0aXZlKTsKICB9IGVsc2UgaWYgKHF1b3RlID09PSBtaW50ICYmIGJhc2UgPT09IFdTT0wgJiYgZmluaXRlKHBhaXI/LnByaWNlTmF0aXZlKSAmJiBOdW1iZXIocGFpci5wcmljZU5hdGl2ZSkgPiAwKSB7CiAgICBwcmljZVNvbCA9IDEgLyBOdW1iZXIocGFpci5wcmljZU5hdGl2ZSk7CiAgfQoKICBjb25zdCBwYXRjaCA9IHsKICAgIGRleENvbmZpcm1lZDogdHJ1ZSwKICAgIGRleFBhaXJBZGRyZXNzOiBwYWlyPy5wYWlyQWRkcmVzcyB8fCBudWxsLAogICAgZGV4SWQ6IHBhaXI/LmRleElkIHx8IG51bGwsCiAgICBkZXhVcmw6IHBhaXI/LnVybCB8fCBudWxsLAogICAgZGV4UGFpckNyZWF0ZWRBdDogTnVtYmVyKHBhaXI/LnBhaXJDcmVhdGVkQXQpIHx8IG51bGwsCiAgICBkZXhNYXJrZXRVcGRhdGVkQXQ6IERhdGUubm93KCksCiAgICBtYXJrZXRTb3VyY2U6ICdkZXhzY3JlZW5lcicsCiAgICBwcmljZVNvdXJjZTogJ2RleHNjcmVlbmVyJywKICAgIGJ1eVByZXNzdXJlU291cmNlOiAnZGV4c2NyZWVuZXItJyArIChhY3Rpdml0eS53aW5kb3cgfHwgJ2F2YWlsYWJsZScpICsgJy10eC1jb3VudCcsCiAgICBidXlQcmVzc3VyZTogZmluaXRlKHByZXNzdXJlKSA/IE51bWJlcihwcmVzc3VyZSkgOiBudWxsLAogICAgYnV5VHJhbnNhY3Rpb25zOiBhY3Rpdml0eS5idXlzLAogICAgc2VsbFRyYW5zYWN0aW9uczogYWN0aXZpdHkuc2VsbHMsCiAgICB0b3RhbFRyYW5zYWN0aW9uczogYWN0aXZpdHkuYnV5cyArIGFjdGl2aXR5LnNlbGxzLAogICAgcHJpY2VTb2wsCiAgICBwcmljZVVzZDogZmluaXRlKHBhaXI/LnByaWNlVXNkKSA/IE51bWJlcihwYWlyLnByaWNlVXNkKSA6IG51bGwsCiAgICBsaXF1aWRpdHlVc2Q6IGZpbml0ZShwYWlyPy5saXF1aWRpdHk/LnVzZCkgPyBOdW1iZXIocGFpci5saXF1aWRpdHkudXNkKSA6IG51bGwsCiAgICBtYXJrZXRDYXBVc2Q6IGZpbml0ZShwYWlyPy5tYXJrZXRDYXApID8gTnVtYmVyKHBhaXIubWFya2V0Q2FwKSA6IG51bGwsCiAgICBmZHZVc2Q6IGZpbml0ZShwYWlyPy5mZHYpID8gTnVtYmVyKHBhaXIuZmR2KSA6IG51bGwsCiAgICB2b2x1bWUyNGhVc2Q6IGZpbml0ZShwYWlyPy52b2x1bWU/LmgyNCkgPyBOdW1iZXIocGFpci52b2x1bWUuaDI0KSA6IG51bGwsCiAgICB2b2x1bWU2aFVzZDogZmluaXRlKHBhaXI/LnZvbHVtZT8uaDYpID8gTnVtYmVyKHBhaXIudm9sdW1lLmg2KSA6IG51bGwsCiAgICB2b2x1bWUxaFVzZDogZmluaXRlKHBhaXI/LnZvbHVtZT8uaDEpID8gTnVtYmVyKHBhaXIudm9sdW1lLmgxKSA6IG51bGwsCiAgICB2b2x1bWU1bVVzZDogZmluaXRlKHBhaXI/LnZvbHVtZT8ubTUpID8gTnVtYmVyKHBhaXIudm9sdW1lLm01KSA6IG51bGwsCiAgICBsYXN0UHJpY2VBdDogRGF0ZS5ub3coKQogIH07CiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMocGF0Y2gpKSBpZiAocGF0Y2hba2V5XSA9PT0gbnVsbCkgZGVsZXRlIHBhdGNoW2tleV07CiAgcmV0dXJuIHBhdGNoOwp9CgpmdW5jdGlvbiByZXRyeURlbGF5KGF0dGVtcHQpIHsKICBjb25zdCBzY2hlZHVsZSA9IFsxMDAwLCAyMDAwLCA0MDAwLCA4MDAwLCAxNTAwMCwgMzAwMDAsIDYwMDAwLCAxMjAwMDAsIDI0MDAwMCwgMzAwMDAwLCA2MDAwMDBdOwogIHJldHVybiBzY2hlZHVsZVtNYXRoLm1pbihhdHRlbXB0LCBzY2hlZHVsZS5sZW5ndGggLSAxKV07Cn0KCmZ1bmN0aW9uIG1hcmtldERlbGF5KHZlcmlmaWVkQXQpIHsKICBjb25zdCBhZ2UgPSBEYXRlLm5vdygpIC0gTnVtYmVyKHZlcmlmaWVkQXQgfHwgRGF0ZS5ub3coKSk7CiAgaWYgKGFnZSA8IDIgKiA2MF8wMDApIHJldHVybiAzMDAwOwogIGlmIChhZ2UgPCAxNSAqIDYwXzAwMCkgcmV0dXJuIDEwXzAwMDsKICBpZiAoYWdlIDwgNjAgKiA2MF8wMDApIHJldHVybiAzMF8wMDA7CiAgcmV0dXJuIDYwXzAwMDsKfQoKZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURleFZlcmlmaWNhdGlvbkdhdGUob3B0aW9ucyA9IHt9KSB7CiAgY29uc3QgeyBvblZlcmlmaWVkID0gbnVsbCwgb25NYXJrZXQgPSBudWxsIH0gPSBvcHRpb25zOwogIGNvbnN0IHBlbmRpbmdNYXggPSBNYXRoLm1heCgzMDAsIE1hdGgubWluKDEwXzAwMCwgTnVtYmVyKHByb2Nlc3MuZW52LkRFWF9WRVJJRllfUEVORElOR19NQVggfHwgMzAwMCkpKTsKICBjb25zdCB0dGxNcyA9IE1hdGgubWF4KDUgKiA2MF8wMDAsIE1hdGgubWluKDMgKiA2MCAqIDYwXzAwMCwgTnVtYmVyKHByb2Nlc3MuZW52LkRFWF9WRVJJRllfVFRMX01TIHx8IDIgKiA2MCAqIDYwXzAwMCkpKTsKICBjb25zdCB0cmFja2VkTWF4ID0gTWF0aC5tYXgoNTAsIE1hdGgubWluKDEwMDAsIE51bWJlcihwcm9jZXNzLmVudi5ERVhfVkVSSUZZX1RSQUNLX01BWCB8fCAyNTApKSk7CiAgY29uc3QgcmVxdWVzdEdhcE1zID0gTWF0aC5tYXgoMjA1LCBOdW1iZXIocHJvY2Vzcy5lbnYuREVYX1ZFUklGWV9SRVFVRVNUX0dBUF9NUyB8fCAyMjUpKTsKCiAgY29uc3QgbWV0cmljcyA9IHsKICAgIHZlcnNpb246IFZFUlNJT04sCiAgICBzdHJhdGVneTogJ3B1bXAtb3JpZ2luK2RleC12ZXJpZmljYXRpb24nLAogICAgYWN0aXZlOiB0cnVlLAogICAgY29ubmVjdGVkOiB0cnVlLAogICAgc3RhcnRlZEF0OiBEYXRlLm5vdygpLAogICAgc3VibWl0dGVkOiAwLAogICAgc2VlZGVkOiAwLAogICAgZHVwbGljYXRlU3VibWl0czogMCwKICAgIHF1ZXVlRHJvcHBlZDogMCwKICAgIHBlbmRpbmdFeHBpcmVkOiAwLAogICAgZGV4Q2hlY2tzOiAwLAogICAgY29uZmlybUJhdGNoZXM6IDAsCiAgICBjb25maXJtQWRkcmVzc2VzOiAwLAogICAgbm9QYWlyQ2hlY2tzOiAwLAogICAgZGV4UmF0ZUxpbWl0ZWQ6IDAsCiAgICBkZXhDaGVja0Vycm9yczogMCwKICAgIHBhaXJzQ29uZmlybWVkOiAwLAogICAgcGFpcnNSZWplY3RlZDogMCwKICAgIGRpc2NvdmVyZWQ6IDAsCiAgICBtYXJrZXRVcGRhdGVzOiAwLAogICAgbWFya2V0TWlzc2VzOiAwLAogICAgcGVuZGluZ0NvbmZpcm1zOiAwLAogICAgdHJhY2tlZDogMCwKICAgIGxhc3RNaW50OiBudWxsLAogICAgbGFzdFBhaXI6IG51bGwsCiAgICBsYXN0VmVyaWZpZWRBdDogbnVsbCwKICAgIGxhc3RSZXF1ZXN0QXQ6IG51bGwsCiAgICBsYXN0U3VjY2Vzc0F0OiBudWxsLAogICAgbGFzdEVycm9yOiBudWxsCiAgfTsKCiAgY29uc3QgcGVuZGluZyA9IG5ldyBNYXAoKTsKICBjb25zdCB0cmFja2VkID0gbmV3IE1hcCgpOwogIGxldCBzdG9wcGVkID0gZmFsc2U7CiAgbGV0IGJ1c3kgPSBmYWxzZTsKICBsZXQgbGFzdFJlcXVlc3RBdCA9IDA7CiAgbGV0IGxhbmVDb3VudGVyID0gMDsKCiAgYXN5bmMgZnVuY3Rpb24gZmV0Y2hSb3dzKG1pbnRzKSB7CiAgICBjb25zdCB3YWl0ID0gTWF0aC5tYXgoMCwgcmVxdWVzdEdhcE1zIC0gKERhdGUubm93KCkgLSBsYXN0UmVxdWVzdEF0KSk7CiAgICBpZiAod2FpdCkgYXdhaXQgc2xlZXAod2FpdCk7CiAgICBsYXN0UmVxdWVzdEF0ID0gRGF0ZS5ub3coKTsKICAgIG1ldHJpY3MubGFzdFJlcXVlc3RBdCA9IGxhc3RSZXF1ZXN0QXQ7CiAgICBtZXRyaWNzLmRleENoZWNrcysrOwoKICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7CiAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDUwMDApOwogICAgdHJ5IHsKICAgICAgY29uc3QgdXJsID0gJ2h0dHBzOi8vYXBpLmRleHNjcmVlbmVyLmNvbS90b2tlbnMvdjEvc29sYW5hLycgKyBtaW50cy5tYXAoZW5jb2RlVVJJQ29tcG9uZW50KS5qb2luKCcsJyk7CiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7CiAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCwKICAgICAgICBoZWFkZXJzOiB7IGFjY2VwdDogJ2FwcGxpY2F0aW9uL2pzb24nLCAndXNlci1hZ2VudCc6ICdNRU1FRkxPVy9QdW1wLURleC1HYXRlLVYxJyB9CiAgICAgIH0pOwogICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MjkpIHsKICAgICAgICBtZXRyaWNzLmRleFJhdGVMaW1pdGVkKys7CiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdERVggU2NyZWVuZXIgcmF0ZSBsaW1pdGVkJyk7CiAgICAgIH0KICAgICAgaWYgKCFyZXNwb25zZS5vaykgdGhyb3cgbmV3IEVycm9yKCdERVggU2NyZWVuZXIgSFRUUCAnICsgcmVzcG9uc2Uuc3RhdHVzKTsKICAgICAgY29uc3Qgcm93cyA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTsKICAgICAgbWV0cmljcy5sYXN0U3VjY2Vzc0F0ID0gRGF0ZS5ub3coKTsKICAgICAgbWV0cmljcy5sYXN0RXJyb3IgPSBudWxsOwogICAgICByZXR1cm4gQXJyYXkuaXNBcnJheShyb3dzKSA/IHJvd3MgOiBbXTsKICAgIH0gZmluYWxseSB7CiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTsKICAgIH0KICB9CgogIGZ1bmN0aW9uIHBydW5lUGVuZGluZ0lmTmVlZGVkKCkgewogICAgd2hpbGUgKHBlbmRpbmcuc2l6ZSA+PSBwZW5kaW5nTWF4KSB7CiAgICAgIGNvbnN0IG9sZGVzdCA9IFsuLi5wZW5kaW5nLnZhbHVlcygpXS5zb3J0KChhLCBiKSA9PiBOdW1iZXIoYS5maXJzdFNlZW5BdCB8fCAwKSAtIE51bWJlcihiLmZpcnN0U2VlbkF0IHx8IDApKVswXTsKICAgICAgaWYgKCFvbGRlc3QpIGJyZWFrOwogICAgICBwZW5kaW5nLmRlbGV0ZShvbGRlc3QubWludCk7CiAgICAgIG1ldHJpY3MucXVldWVEcm9wcGVkKys7CiAgICAgIG1ldHJpY3MucGFpcnNSZWplY3RlZCsrOwogICAgfQogIH0KCiAgZnVuY3Rpb24gcHJ1bmVUcmFja2VkSWZOZWVkZWQoKSB7CiAgICB3aGlsZSAodHJhY2tlZC5zaXplID4gdHJhY2tlZE1heCkgewogICAgICBjb25zdCBvbGRlc3QgPSBbLi4udHJhY2tlZC52YWx1ZXMoKV0uc29ydCgoYSwgYikgPT4gTnVtYmVyKGEubGFzdE1hcmtldEF0IHx8IGEudmVyaWZpZWRBdCB8fCAwKSAtIE51bWJlcihiLmxhc3RNYXJrZXRBdCB8fCBiLnZlcmlmaWVkQXQgfHwgMCkpWzBdOwogICAgICBpZiAoIW9sZGVzdCkgYnJlYWs7CiAgICAgIHRyYWNrZWQuZGVsZXRlKG9sZGVzdC5taW50KTsKICAgIH0KICB9CgogIGZ1bmN0aW9uIHN1Ym1pdChjYW5kaWRhdGUsIHsgc2VlZGVkID0gZmFsc2UgfSA9IHt9KSB7CiAgICBjb25zdCBtaW50ID0gU3RyaW5nKGNhbmRpZGF0ZT8ubWludCB8fCBjYW5kaWRhdGU/LnRva2VuTWludCB8fCBjYW5kaWRhdGU/LnRva2VuQWRkcmVzcyB8fCAnJykudHJpbSgpOwogICAgaWYgKCFtaW50IHx8IHN0b3BwZWQpIHJldHVybiBmYWxzZTsKICAgIGlmICh0cmFja2VkLmhhcyhtaW50KSkgewogICAgICBtZXRyaWNzLmR1cGxpY2F0ZVN1Ym1pdHMrKzsKICAgICAgcmV0dXJuIGZhbHNlOwogICAgfQogICAgY29uc3QgZXhpc3RpbmcgPSBwZW5kaW5nLmdldChtaW50KTsKICAgIGlmIChleGlzdGluZykgewogICAgICBleGlzdGluZy5jYW5kaWRhdGUgPSB7IC4uLmV4aXN0aW5nLmNhbmRpZGF0ZSwgLi4uY2FuZGlkYXRlLCBtaW50IH07CiAgICAgIG1ldHJpY3MuZHVwbGljYXRlU3VibWl0cysrOwogICAgICByZXR1cm4gZmFsc2U7CiAgICB9CiAgICBwcnVuZVBlbmRpbmdJZk5lZWRlZCgpOwogICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTsKICAgIHBlbmRpbmcuc2V0KG1pbnQsIHsKICAgICAgbWludCwKICAgICAgY2FuZGlkYXRlOiB7IC4uLmNhbmRpZGF0ZSwgbWludCB9LAogICAgICBmaXJzdFNlZW5BdDogTnVtYmVyKGNhbmRpZGF0ZT8uZGlzY292ZXJlZEF0KSB8fCBub3csCiAgICAgIGFkZGVkQXQ6IG5vdywKICAgICAgbmV4dEF0OiBub3cgKyAzMDAsCiAgICAgIGF0dGVtcHRzOiAwCiAgICB9KTsKICAgIG1ldHJpY3Muc3VibWl0dGVkKys7CiAgICBpZiAoc2VlZGVkKSBtZXRyaWNzLnNlZWRlZCsrOwogICAgbWV0cmljcy5wZW5kaW5nQ29uZmlybXMgPSBwZW5kaW5nLnNpemU7CiAgICByZXR1cm4gdHJ1ZTsKICB9CgogIGZ1bmN0aW9uIHRyYWNrVmVyaWZpZWQodG9rZW4pIHsKICAgIGNvbnN0IG1pbnQgPSBTdHJpbmcodG9rZW4/Lm1pbnQgfHwgdG9rZW4/LnRva2VuTWludCB8fCB0b2tlbj8udG9rZW5BZGRyZXNzIHx8ICcnKS50cmltKCk7CiAgICBpZiAoIW1pbnQgfHwgdG9rZW4/LmRleENvbmZpcm1lZCAhPT0gdHJ1ZSkgcmV0dXJuIGZhbHNlOwogICAgcGVuZGluZy5kZWxldGUobWludCk7CiAgICB0cmFja2VkLnNldChtaW50LCB7CiAgICAgIG1pbnQsCiAgICAgIHZlcmlmaWVkQXQ6IE51bWJlcih0b2tlbj8uZGV4Q29uZmlybWVkQXQpIHx8IE51bWJlcih0b2tlbj8uZGV4TGlzdGVkQXQpIHx8IERhdGUubm93KCksCiAgICAgIGxhc3RNYXJrZXRBdDogTnVtYmVyKHRva2VuPy5kZXhNYXJrZXRVcGRhdGVkQXQpIHx8IE51bWJlcih0b2tlbj8ubGFzdFByaWNlQXQpIHx8IDAsCiAgICAgIG5leHRBdDogRGF0ZS5ub3coKSArIDEwMDAKICAgIH0pOwogICAgcHJ1bmVUcmFja2VkSWZOZWVkZWQoKTsKICAgIG1ldHJpY3MucGVuZGluZ0NvbmZpcm1zID0gcGVuZGluZy5zaXplOwogICAgbWV0cmljcy50cmFja2VkID0gdHJhY2tlZC5zaXplOwogICAgcmV0dXJuIHRydWU7CiAgfQoKICBmdW5jdGlvbiBjbGVhclBlbmRpbmcoKSB7CiAgICBwZW5kaW5nLmNsZWFyKCk7CiAgICBtZXRyaWNzLnBlbmRpbmdDb25maXJtcyA9IDA7CiAgfQoKICBhc3luYyBmdW5jdGlvbiBwcm9jZXNzUGVuZGluZyhyb3dzKSB7CiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpOwogICAgZm9yIChjb25zdCBpdGVtIG9mIHJvd3MpIHsKICAgICAgaWYgKCFwZW5kaW5nLmhhcyhpdGVtLm1pbnQpKSBjb250aW51ZTsKICAgICAgaWYgKG5vdyAtIE51bWJlcihpdGVtLmZpcnN0U2VlbkF0IHx8IGl0ZW0uYWRkZWRBdCB8fCBub3cpID4gdHRsTXMpIHsKICAgICAgICBwZW5kaW5nLmRlbGV0ZShpdGVtLm1pbnQpOwogICAgICAgIG1ldHJpY3MucGVuZGluZ0V4cGlyZWQrKzsKICAgICAgICBtZXRyaWNzLnBhaXJzUmVqZWN0ZWQrKzsKICAgICAgfQogICAgfQogICAgY29uc3QgbGl2ZSA9IHJvd3MuZmlsdGVyKGl0ZW0gPT4gcGVuZGluZy5oYXMoaXRlbS5taW50KSk7CiAgICBpZiAoIWxpdmUubGVuZ3RoKSB7CiAgICAgIG1ldHJpY3MucGVuZGluZ0NvbmZpcm1zID0gcGVuZGluZy5zaXplOwogICAgICByZXR1cm47CiAgICB9CgogICAgbWV0cmljcy5jb25maXJtQmF0Y2hlcysrOwogICAgbWV0cmljcy5jb25maXJtQWRkcmVzc2VzICs9IGxpdmUubGVuZ3RoOwogICAgbGV0IGFwaVJvd3M7CiAgICB0cnkgewogICAgICBhcGlSb3dzID0gYXdhaXQgZmV0Y2hSb3dzKGxpdmUubWFwKGl0ZW0gPT4gaXRlbS5taW50KSk7CiAgICB9IGNhdGNoIChlcnJvcikgewogICAgICBtZXRyaWNzLmRleENoZWNrRXJyb3JzKys7CiAgICAgIG1ldHJpY3MubGFzdEVycm9yID0gU3RyaW5nKGVycm9yPy5tZXNzYWdlIHx8IGVycm9yKTsKICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGxpdmUpIHsKICAgICAgICBpdGVtLmF0dGVtcHRzKys7CiAgICAgICAgaXRlbS5uZXh0QXQgPSBEYXRlLm5vdygpICsgcmV0cnlEZWxheShpdGVtLmF0dGVtcHRzKTsKICAgICAgfQogICAgICByZXR1cm47CiAgICB9CgogICAgZm9yIChjb25zdCBpdGVtIG9mIGxpdmUpIHsKICAgICAgY29uc3QgcGFpciA9IGNob29zZVBhaXIoYXBpUm93cywgaXRlbS5taW50KTsKICAgICAgaWYgKCFwYWlyKSB7CiAgICAgICAgbWV0cmljcy5ub1BhaXJDaGVja3MrKzsKICAgICAgICBpdGVtLmF0dGVtcHRzKys7CiAgICAgICAgaXRlbS5uZXh0QXQgPSBEYXRlLm5vdygpICsgcmV0cnlEZWxheShpdGVtLmF0dGVtcHRzKTsKICAgICAgICBjb250aW51ZTsKICAgICAgfQoKICAgICAgcGVuZGluZy5kZWxldGUoaXRlbS5taW50KTsKICAgICAgY29uc3QgcGF0Y2ggPSBtYXJrZXRQYXRjaChwYWlyLCBpdGVtLm1pbnQpOwogICAgICBjb25zdCB2ZXJpZmllZEF0ID0gRGF0ZS5ub3coKTsKICAgICAgdHJhY2tlZC5zZXQoaXRlbS5taW50LCB7CiAgICAgICAgbWludDogaXRlbS5taW50LAogICAgICAgIHZlcmlmaWVkQXQsCiAgICAgICAgbGFzdE1hcmtldEF0OiB2ZXJpZmllZEF0LAogICAgICAgIG5leHRBdDogdmVyaWZpZWRBdCArIG1hcmtldERlbGF5KHZlcmlmaWVkQXQpCiAgICAgIH0pOwogICAgICBwcnVuZVRyYWNrZWRJZk5lZWRlZCgpOwogICAgICBtZXRyaWNzLnBhaXJzQ29uZmlybWVkKys7CiAgICAgIG1ldHJpY3MuZGlzY292ZXJlZCsrOwogICAgICBtZXRyaWNzLmxhc3RNaW50ID0gaXRlbS5taW50OwogICAgICBtZXRyaWNzLmxhc3RQYWlyID0gcGFpcj8ucGFpckFkZHJlc3MgfHwgbnVsbDsKICAgICAgbWV0cmljcy5sYXN0VmVyaWZpZWRBdCA9IHZlcmlmaWVkQXQ7CgogICAgICB0cnkgewogICAgICAgIGF3YWl0IFByb21pc2UucmVzb2x2ZShvblZlcmlmaWVkPy4oeyBtaW50OiBpdGVtLm1pbnQsIGNhbmRpZGF0ZTogaXRlbS5jYW5kaWRhdGUsIG1hcmtldDogcGF0Y2gsIHBhaXIgfSkpOwogICAgICB9IGNhdGNoIChlcnJvcikgewogICAgICAgIG1ldHJpY3MubGFzdEVycm9yID0gJ29uVmVyaWZpZWQ6ICcgKyBTdHJpbmcoZXJyb3I/Lm1lc3NhZ2UgfHwgZXJyb3IpOwogICAgICB9CiAgICB9CgogICAgbWV0cmljcy5wZW5kaW5nQ29uZmlybXMgPSBwZW5kaW5nLnNpemU7CiAgICBtZXRyaWNzLnRyYWNrZWQgPSB0cmFja2VkLnNpemU7CiAgfQoKICBhc3luYyBmdW5jdGlvbiBwcm9jZXNzVHJhY2tlZChyb3dzKSB7CiAgICBtZXRyaWNzLmNvbmZpcm1CYXRjaGVzKys7CiAgICBtZXRyaWNzLmNvbmZpcm1BZGRyZXNzZXMgKz0gcm93cy5sZW5ndGg7CiAgICBsZXQgYXBpUm93czsKICAgIHRyeSB7CiAgICAgIGFwaVJvd3MgPSBhd2FpdCBmZXRjaFJvd3Mocm93cy5tYXAoaXRlbSA9PiBpdGVtLm1pbnQpKTsKICAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICAgIG1ldHJpY3MuZGV4Q2hlY2tFcnJvcnMrKzsKICAgICAgbWV0cmljcy5sYXN0RXJyb3IgPSBTdHJpbmcoZXJyb3I/Lm1lc3NhZ2UgfHwgZXJyb3IpOwogICAgICBmb3IgKGNvbnN0IGl0ZW0gb2Ygcm93cykgaXRlbS5uZXh0QXQgPSBEYXRlLm5vdygpICsgNTAwMDsKICAgICAgcmV0dXJuOwogICAgfQoKICAgIGZvciAoY29uc3QgaXRlbSBvZiByb3dzKSB7CiAgICAgIGlmICghdHJhY2tlZC5oYXMoaXRlbS5taW50KSkgY29udGludWU7CiAgICAgIGNvbnN0IHBhaXIgPSBjaG9vc2VQYWlyKGFwaVJvd3MsIGl0ZW0ubWludCk7CiAgICAgIGlmICghcGFpcikgewogICAgICAgIG1ldHJpY3MubWFya2V0TWlzc2VzKys7CiAgICAgICAgaXRlbS5uZXh0QXQgPSBEYXRlLm5vdygpICsgNTAwMDsKICAgICAgICBjb250aW51ZTsKICAgICAgfQogICAgICBjb25zdCBwYXRjaCA9IG1hcmtldFBhdGNoKHBhaXIsIGl0ZW0ubWludCk7CiAgICAgIGl0ZW0ubGFzdE1hcmtldEF0ID0gRGF0ZS5ub3coKTsKICAgICAgaXRlbS5uZXh0QXQgPSBEYXRlLm5vdygpICsgbWFya2V0RGVsYXkoaXRlbS52ZXJpZmllZEF0KTsKICAgICAgbWV0cmljcy5tYXJrZXRVcGRhdGVzKys7CiAgICAgIHRyeSB7CiAgICAgICAgYXdhaXQgUHJvbWlzZS5yZXNvbHZlKG9uTWFya2V0Py4oaXRlbS5taW50LCBwYXRjaCwgcGFpcikpOwogICAgICB9IGNhdGNoIChlcnJvcikgewogICAgICAgIG1ldHJpY3MubGFzdEVycm9yID0gJ29uTWFya2V0OiAnICsgU3RyaW5nKGVycm9yPy5tZXNzYWdlIHx8IGVycm9yKTsKICAgICAgfQogICAgfQogICAgbWV0cmljcy50cmFja2VkID0gdHJhY2tlZC5zaXplOwogIH0KCiAgYXN5bmMgZnVuY3Rpb24gdGljaygpIHsKICAgIGlmIChzdG9wcGVkIHx8IGJ1c3kpIHJldHVybjsKICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7CiAgICBjb25zdCBleHBpcmVkID0gWy4uLnBlbmRpbmcudmFsdWVzKCldLmZpbHRlcihpdGVtID0+IG5vdyAtIE51bWJlcihpdGVtLmZpcnN0U2VlbkF0IHx8IGl0ZW0uYWRkZWRBdCB8fCBub3cpID4gdHRsTXMpOwogICAgZm9yIChjb25zdCBpdGVtIG9mIGV4cGlyZWQpIHsKICAgICAgcGVuZGluZy5kZWxldGUoaXRlbS5taW50KTsKICAgICAgbWV0cmljcy5wZW5kaW5nRXhwaXJlZCsrOwogICAgICBtZXRyaWNzLnBhaXJzUmVqZWN0ZWQrKzsKICAgIH0KCiAgICBjb25zdCBkdWVQZW5kaW5nID0gWy4uLnBlbmRpbmcudmFsdWVzKCldLmZpbHRlcihpdGVtID0+IGl0ZW0ubmV4dEF0IDw9IG5vdykuc29ydCgoYSwgYikgPT4gYS5uZXh0QXQgLSBiLm5leHRBdCkuc2xpY2UoMCwgMzApOwogICAgY29uc3QgZHVlVHJhY2tlZCA9IFsuLi50cmFja2VkLnZhbHVlcygpXS5maWx0ZXIoaXRlbSA9PiBpdGVtLm5leHRBdCA8PSBub3cpLnNvcnQoKGEsIGIpID0+IGEubmV4dEF0IC0gYi5uZXh0QXQpLnNsaWNlKDAsIDMwKTsKICAgIG1ldHJpY3MucGVuZGluZ0NvbmZpcm1zID0gcGVuZGluZy5zaXplOwogICAgbWV0cmljcy50cmFja2VkID0gdHJhY2tlZC5zaXplOwogICAgaWYgKCFkdWVQZW5kaW5nLmxlbmd0aCAmJiAhZHVlVHJhY2tlZC5sZW5ndGgpIHJldHVybjsKCiAgICAvLyBEbyBub3QgbGV0IGEgcGVybWFuZW50bHkgYnVzeSBjYW5kaWRhdGUgcXVldWUgc3RhcnZlIG1hcmtldCB1cGRhdGVzCiAgICAvLyBmb3IgYWxyZWFkeS12ZXJpZmllZCB0b2tlbnMvb3BlbiBwYXBlciBwb3NpdGlvbnMuCiAgICBsYW5lQ291bnRlcisrOwogICAgY29uc3QgcnVuVHJhY2tlZCA9CiAgICAgIGR1ZVRyYWNrZWQubGVuZ3RoID4gMCAmJgogICAgICAoZHVlUGVuZGluZy5sZW5ndGggPT09IDAgfHwgbGFuZUNvdW50ZXIgJSA1ID09PSAwKTsKCiAgICBidXN5ID0gdHJ1ZTsKICAgIHRyeSB7CiAgICAgIGlmIChydW5UcmFja2VkKSBhd2FpdCBwcm9jZXNzVHJhY2tlZChkdWVUcmFja2VkKTsKICAgICAgZWxzZSBhd2FpdCBwcm9jZXNzUGVuZGluZyhkdWVQZW5kaW5nKTsKICAgIH0gZmluYWxseSB7CiAgICAgIGJ1c3kgPSBmYWxzZTsKICAgIH0KICB9CgogIGNvbnN0IHRpbWVyID0gc2V0SW50ZXJ2YWwoKCkgPT4gdm9pZCB0aWNrKCksIDI1MCk7CiAgdGltZXIudW5yZWY/LigpOwoKICByZXR1cm4gewogICAgc3VibWl0LAogICAgdHJhY2tWZXJpZmllZCwKICAgIGNsZWFyUGVuZGluZywKICAgIG1ldHJpY3M6ICgpID0+ICh7IC4uLm1ldHJpY3MsIGFjdGl2ZTogIXN0b3BwZWQsIGNvbm5lY3RlZDogIXN0b3BwZWQsIHBlbmRpbmdDb25maXJtczogcGVuZGluZy5zaXplLCB0cmFja2VkOiB0cmFja2VkLnNpemUgfSksCiAgICBzdG9wOiAoKSA9PiB7CiAgICAgIHN0b3BwZWQgPSB0cnVlOwogICAgICBjbGVhckludGVydmFsKHRpbWVyKTsKICAgICAgcGVuZGluZy5jbGVhcigpOwogICAgICB0cmFja2VkLmNsZWFyKCk7CiAgICAgIG1ldHJpY3MuYWN0aXZlID0gZmFsc2U7CiAgICAgIG1ldHJpY3MuY29ubmVjdGVkID0gZmFsc2U7CiAgICAgIG1ldHJpY3MucGVuZGluZ0NvbmZpcm1zID0gMDsKICAgICAgbWV0cmljcy50cmFja2VkID0gMDsKICAgIH0KICB9Owp9Cg==").decode("utf-8")


def log(message):
    print("[PUMP-DEX-V33] " + str(message), flush=True)


def find_root():
    candidates = [
        Path.cwd(),
        Path.cwd() / "memeflow-app",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace/memeflow-app"),
    ]
    required = [
        "app-server.mjs",
        "src/enrich.mjs",
        "src/discovery-source.mjs",
        "src/recovery.mjs",
        "src/settings.mjs",
        "src/evaluate.mjs",
        "src/store.mjs",
        "src/pump-live-trade-feed.mjs",
        "src/dex-discovery-feed.mjs",
    ]
    for candidate in candidates:
        try:
            root = candidate.resolve()
        except Exception:
            continue
        if all((root / rel).is_file() for rel in required):
            return root
    raise RuntimeError("MEMEFLOW project root not found")


ROOT = find_root()
APP = ROOT / "app-server.mjs"
ENRICH = ROOT / "src/enrich.mjs"
SOURCE = ROOT / "src/discovery-source.mjs"
RECOVERY = ROOT / "src/recovery.mjs"
GATE = ROOT / "src/dex-verification-gate.mjs"
SYSTEM_JS = ROOT / "system.js"
TOKENS_JS = ROOT / "system-tokens.js"

BACKUP = ROOT / (".pump-dex-v33-backup-" + STAMP)
BACKUP.mkdir(parents=True, exist_ok=True)
ORIGINALS = {}
GATE_EXISTED = GATE.exists()


def read(path):
    return path.read_text(encoding="utf-8")


def remember(path):
    if not path.exists():
        return
    text = read(path)
    ORIGINALS[path] = text
    rel = path.relative_to(ROOT)
    dst = BACKUP / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dst)


def restore():
    for path, text in ORIGINALS.items():
        path.write_text(text, encoding="utf-8")
    if not GATE_EXISTED and GATE.exists():
        GATE.unlink()


def fail(message):
    log("ERROR: " + str(message))
    restore()
    log("ROLLBACK COMPLETE")
    sys.exit(1)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 anchor, found {count}")
    return text.replace(old, new, 1)


def node_check(path):
    result = subprocess.run(
        ["node", "--check", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "node --check failed for "
            + str(path.relative_to(ROOT))
            + ":\n"
            + (result.stderr or result.stdout)
        )


def replace_slice(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(label + ": start marker not found")
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(label + ": end marker not found")
    return text[:start] + replacement + text[end:]


try:
    log("root: " + str(ROOT))

    for path in [APP, ENRICH, SOURCE, RECOVERY, SYSTEM_JS, TOKENS_JS, GATE]:
        remember(path)

    app = read(APP)
    enrich = read(ENRICH)
    source = read(SOURCE)
    recovery = read(RECOVERY)
    system_js = read(SYSTEM_JS) if SYSTEM_JS.exists() else None

    if PATCH_ID in app:
        log("already installed")
        sys.exit(0)

    # ------------------------------------------------------------
    # STRICT PRE-FLIGHT. Do not install on an unknown topology.
    # ------------------------------------------------------------
    required_app = [
        "startPumpLiveTradeFeed",
        "startDexDiscoveryFeed",
        "function processSignature(sig)",
        "function ensurePriceTimer(mint,curve)",
        "function __applyDiscoverySourceMode()",
        "function runDiscoveryBridge()",
        "const __discoverySource=new DiscoverySourceController",
        "const evaluateAll=makeEvaluateForActiveUsers",
        "startDecisionRecovery({store,metrics:recoveryMetrics",
        "if(url.pathname==='/api/discovery-source'&&req.method==='POST')",
    ]
    missing = [marker for marker in required_app if marker not in app]
    if missing:
        raise RuntimeError("app-server topology mismatch; missing: " + ", ".join(missing))

    required_enrich = [
        "export async function enrichToken",
        "const existingToken = store.state.tokens[mint] || {};",
        "if (ensurePriceTimer) ensurePriceTimer(mint, curve);",
    ]
    missing = [marker for marker in required_enrich if marker not in enrich]
    if missing:
        raise RuntimeError("enrich.mjs topology mismatch; missing: " + ", ".join(missing))

    if "const MODES = new Set(['pump', 'dex', 'hybrid']);" not in source:
        raise RuntimeError("discovery-source.mjs topology mismatch")
    if "export async function startDecisionRecovery" not in recovery:
        raise RuntimeError("recovery.mjs topology mismatch")

    log("PRE-FLIGHT OK")
    log("verified Pump create + Pump live feed + old direct DEX feed")
    log("verified evaluator + holders + bridge + recovery + settings routes")

    # ------------------------------------------------------------
    # 1) Remove the active direct DEX scanner import.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "import { startDexDiscoveryFeed } from './src/dex-discovery-feed.mjs'; // MEMEFLOW_DISCOVERY_ROUTER_V1_1",
        "import { createDexVerificationGate } from './src/dex-verification-gate.mjs'; // MEMEFLOW_PUMP_DEX_GATE_V33",
        "DEX import",
    )

    # ------------------------------------------------------------
    # 2) One canonical source gate for every downstream path.
    # ------------------------------------------------------------
    old_source_head = (
        "const __discoverySource=new DiscoverySourceController({dataDir,defaultMode:process.env.DISCOVERY_SOURCE_MODE||'dex'});\n"
        "const __discoverySourceAllows=source=>__discoverySource.allows(source);\n"
    )
    new_source_head = r"""const __discoverySource=new DiscoverySourceController({dataDir,defaultMode:process.env.DISCOVERY_SOURCE_MODE||'dex'});

function __isPumpOriginToken(token){
  if(!token)return false;
  const mint=String(token?.mint||token?.tokenMint||token?.tokenAddress||'').toLowerCase();
  const launch=String(token?.launchPlatform||'').toLowerCase();
  const protocol=String(token?.protocol||'').toLowerCase();
  const source=String(token?.source||'').toLowerCase();
  return launch==='pump'||protocol==='pump'||source.includes('pump create')||mint.endsWith('pump');
}
function __tokenAllowedByDiscoveryMode(token){
  if(!__isPumpOriginToken(token))return false;
  const mode=String(__discoverySource?.mode||'pump').toLowerCase();
  if(mode==='dex'){
    return token?.dexConfirmed===true&&Boolean(token?.dexUrl||token?.dexPairAddress);
  }
  return true;
}
"""
    app = replace_once(app, old_source_head, new_source_head, "canonical source gate")

    # ------------------------------------------------------------
    # 3) Holder admission obeys source gate.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "  const token=store.state.tokens[mint];\n  if(!token)return {allow:false,drop:true,reason:'token_missing'};\n",
        "  const token=store.state.tokens[mint];\n  if(!token)return {allow:false,drop:true,reason:'token_missing'};\n  if(!__tokenAllowedByDiscoveryMode(token))return {allow:false,drop:true,reason:'discovery_source_gate'};\n",
        "holder source gate",
    )

    # ------------------------------------------------------------
    # 4) Live evaluation obeys source gate.
    # ------------------------------------------------------------
    old_eval = (
        "const evaluateAll=makeEvaluateForActiveUsers({store,metrics:liveEvalMetrics,activeUserHoursMs:LIVE_EVAL_HOURS*3600000,batchSize:LIVE_EVAL_BATCH,delayMs:LIVE_EVAL_DELAY,onDecision:(uid,token,decision)=>{try{paper.onDecision(uid,token,decision,store.settings(uid))}catch(_){}}});"
    )
    new_eval = (
        "const __evaluateAllBase=makeEvaluateForActiveUsers({store,metrics:liveEvalMetrics,activeUserHoursMs:LIVE_EVAL_HOURS*3600000,batchSize:LIVE_EVAL_BATCH,delayMs:LIVE_EVAL_DELAY,onDecision:(uid,token,decision)=>{try{paper.onDecision(uid,token,decision,store.settings(uid))}catch(_){}}});\n"
        "function evaluateAll(token){\n"
        "  if(!__tokenAllowedByDiscoveryMode(token))return Promise.resolve({decisionLike:false,skipped:true,reason:'DISCOVERY_SOURCE_GATE'});\n"
        "  return __evaluateAllBase(token);\n"
        "}"
    )
    app = replace_once(app, old_eval, new_eval, "live evaluator source gate")

    # ------------------------------------------------------------
    # 5) In DEX-confirmed state, bonding curve can no longer own price.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "function ensurePriceTimer(mint,curve){\n  if(priceTimers.has(mint)||!curve)return;",
        "function ensurePriceTimer(mint,curve){\n  const __priceOwnerToken=store.state.tokens?.[mint];\n  if(__priceOwnerToken?.dexConfirmed===true)return;\n  if(priceTimers.has(mint)||!curve)return;",
        "price timer entry guard",
    )
    app = replace_once(
        app,
        "    const t=store.state.tokens[mint];\n    if(!t){clearInterval(timer);priceTimers.delete(mint);return}\n",
        "    const t=store.state.tokens[mint];\n    if(!t){clearInterval(timer);priceTimers.delete(mint);return}\n    if(t?.dexConfirmed===true){clearInterval(timer);priceTimers.delete(mint);return}\n",
        "price timer live guard",
    )

    # ------------------------------------------------------------
    # 6) Do not publish/game-feed unverified Pump junk in DEX mode.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "function publish(mint){\n  // V31 System View: actual server publish cadence drives the 3D impulse.\n",
        "function publish(mint){\n  const __publishToken=store.state.tokens?.[mint]||null;\n  if(__publishToken&&!__tokenAllowedByDiscoveryMode(__publishToken))return;\n  // V31 System View: actual server publish cadence drives the 3D impulse.\n",
        "publish source gate",
    )

    # ------------------------------------------------------------
    # 7) Pump Create is the one discovery source.
    #    In DEX mode store raw candidate only (for restart safety), but do
    #    not enrich/evaluate until DexScreener verifies a real pair.
    #    Also remove duplicate fastPhaseAStart + fix undefined `mint` bug.
    # ------------------------------------------------------------
    create_start = app.find("      store.addToken({mint:result.mint")
    create_end = app.find("    }else if(result.reason==='knownNonCreate'){", create_start)
    if create_start < 0 or create_end < 0:
        raise RuntimeError("Pump Create block not found")

    create_block = r"""      const __pumpCandidate={
        mint:result.mint,
        curve:result.curve,
        name:result.name,
        symbol:result.symbol,
        uri:result.uri,
        creator:result.creator,
        isMayhemMode:false,
        launchMode:'standard',
        launchPlatform:'pump',
        protocol:'pump',
        discoveredAt:Date.now(),
        slot:tx.slot,
        signature:sig,
        source:'Pump create'
      };

      if(__discoverySource.mode==='dex'){
        // Persist only the cheap raw Pump identity so a restart cannot lose
        // a candidate that is still waiting to appear in a DEX pool.
        store.addToken({
          ...__pumpCandidate,
          dexVerificationPending:true,
          dexVerificationQueuedAt:Date.now()
        });
        __submitPumpCandidateForDex(__pumpCandidate);
      }else{
        store.addToken(__pumpCandidate);

        try{__v1224LinkCreator(result.mint,__v1223Token(result.mint))}catch{}
        try{
          const __created=store.state?.tokens?.[result.mint];
          const __creator=__created?.creator||null;
          if(__creator)eventHolderLedger.setCreator(result.mint,__creator);
        }catch{}

        if(__discoverySource.mode==='hybrid')__submitPumpCandidateForDex(__pumpCandidate);

        // enrich() already calls fastPhaseAStart synchronously. The old code
        // called it here too, causing duplicate holder/evaluation work.
        void enrich(result.mint,result.curve).catch(e=>{
          discMetrics.lastErrorAt=Date.now();
          discovery.lastError={message:'enrich: '+String(e?.message||e),at:Date.now()};
        });
      }
"""
    app = app[:create_start] + create_block + app[create_end:]

    # ------------------------------------------------------------
    # 8) Bridge/setting reevaluation only sees eligible tokens.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "    const all=Object.values(store?.state?.tokens||{})\n      .filter(t=>bridgeIsPump(t)&&bridgeAgeMs(t,now)<=BRIDGE_MAX_AGE_MS&&bridgeAgeMs(t,now)>=BRIDGE_MIN_TOKEN_AGE_MS);",
        "    const all=Object.values(store?.state?.tokens||{})\n      .filter(t=>bridgeIsPump(t)&&__tokenAllowedByDiscoveryMode(t)&&bridgeAgeMs(t,now)<=BRIDGE_MAX_AGE_MS&&bridgeAgeMs(t,now)>=BRIDGE_MIN_TOKEN_AGE_MS);",
        "bridge source gate",
    )
    app = replace_once(
        app,
        "function shadowValidateSettings(settings,limit=50){const rows=store.tokens().slice(0,Math.max(1,Math.min(200,limit)));",
        "function shadowValidateSettings(settings,limit=50){const rows=store.tokens().filter(__tokenAllowedByDiscoveryMode).slice(0,Math.max(1,Math.min(200,limit)));",
        "shadow validation source filter",
    )
    app = replace_once(
        app,
        "  const tokens=store.tokens().slice(0,Math.max(50,Math.min(500,Number(process.env.SETTINGS_REEVALUATE_LIMIT||250))));",
        "  const tokens=store.tokens().filter(__tokenAllowedByDiscoveryMode).slice(0,Math.max(50,Math.min(500,Number(process.env.SETTINGS_REEVALUATE_LIMIT||250))));",
        "settings reevaluation source filter",
    )

    # ------------------------------------------------------------
    # 9) Recovery after restart gets the same source filter.
    # ------------------------------------------------------------
    recovery = replace_once(
        recovery,
        "  batchSize = 25, delayMs = 25, tokenLimit = 200, activeUserHoursMs = 86400000,\n",
        "  batchSize = 25, delayMs = 25, tokenLimit = 200, activeUserHoursMs = 86400000, tokenFilter = null,\n",
        "startup recovery tokenFilter arg",
    )
    recovery = replace_once(
        recovery,
        "  const allTokens = store.tokens();\n  const tokens = allTokens.slice(0, tokenLimit);",
        "  const allTokens = store.tokens();\n  const eligibleTokens = tokenFilter ? allTokens.filter(tokenFilter) : allTokens;\n  const tokens = eligibleTokens.slice(0, tokenLimit);",
        "startup recovery filter",
    )
    recovery = replace_once(
        recovery,
        "export function lazyRecoverUser({ store, uid, metrics, tokenLimit = 200 }) {",
        "export function lazyRecoverUser({ store, uid, metrics, tokenLimit = 200, tokenFilter = null }) {",
        "lazy recovery tokenFilter arg",
    )
    recovery = replace_once(
        recovery,
        "    const tokens = store.tokens().slice(0, tokenLimit);",
        "    const allTokens = store.tokens();\n    const tokens = (tokenFilter ? allTokens.filter(tokenFilter) : allTokens).slice(0, tokenLimit);",
        "lazy recovery filter",
    )
    app = replace_once(
        app,
        "if(!store._uidDec[u.id]?.size)await lazyRecoverUser({store,uid:u.id,metrics:recoveryMetrics,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT});",
        "if(!store._uidDec[u.id]?.size)await lazyRecoverUser({store,uid:u.id,metrics:recoveryMetrics,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT,tokenFilter:__tokenAllowedByDiscoveryMode});",
        "lazy recovery app hook",
    )
    app = replace_once(
        app,
        "startDecisionRecovery({store,metrics:recoveryMetrics,getLiveState:()=>({queueDepth:discQueue.freshQueueDepth+discQueue.retryQueueDepth,processing:discQueue.processing}),batchSize:DECISION_RECOVERY_BATCH_SIZE,delayMs:DECISION_RECOVERY_DELAY_MS,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT,activeUserHoursMs:DECISION_RECOVERY_ACTIVE_USER_HOURS*3600000})",
        "startDecisionRecovery({store,metrics:recoveryMetrics,getLiveState:()=>({queueDepth:discQueue.freshQueueDepth+discQueue.retryQueueDepth,processing:discQueue.processing}),batchSize:DECISION_RECOVERY_BATCH_SIZE,delayMs:DECISION_RECOVERY_DELAY_MS,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT,activeUserHoursMs:DECISION_RECOVERY_ACTIVE_USER_HOURS*3600000,tokenFilter:__tokenAllowedByDiscoveryMode})",
        "startup recovery app hook",
    )

    # ------------------------------------------------------------
    # 10) Replace old direct DEX runtime with one verifier. The old file stays
    #     on disk as rollback/reference but is neither imported nor started.
    # ------------------------------------------------------------
    runtime_start = app.find("let __pumpLiveTradeFeed=null;")
    runtime_end = app.find("// MEMEFLOW_V12_22_WS_DIRECT_TRADE_EVENT", runtime_start)
    if runtime_start < 0 or runtime_end < 0:
        raise RuntimeError("old discovery runtime block not found")

    runtime = r"""let __pumpLiveTradeFeed=null;
let __dexVerificationGate=null;

function __stopPumpPriceTimerForDex(mint){
  const timer=priceTimers.get(mint);
  if(timer){
    try{clearInterval(timer)}catch{}
    priceTimers.delete(mint);
  }
}
function __startPumpLiveFeed(){
  if(!__pumpLiveTradeFeed)__pumpLiveTradeFeed=startPumpLiveTradeFeed(__pumpLiveTradeFeedOpts);
}
function __ensureDexVerifier(){
  if(__dexVerificationGate)return __dexVerificationGate;
  __dexVerificationGate=createDexVerificationGate({
    onVerified:__applyDexVerifiedPump,
    onMarket:__applyDexVerifiedMarket
  });

  // Keep market updates alive for previously verified Pump tokens after restart.
  for(const token of store.tokens().filter(t=>__isPumpOriginToken(t)&&t?.dexConfirmed===true).slice(0,150)){
    __dexVerificationGate.trackVerified(token);
  }
  return __dexVerificationGate;
}
function __submitPumpCandidateForDex(candidate){
  return __ensureDexVerifier().submit(candidate);
}
function __seedDexVerifierFromRecentPump(){
  const gate=__ensureDexVerifier();
  const maxAgeMs=Math.max(10*60_000,Number(process.env.DEX_VERIFY_SEED_MAX_AGE_MS||3*60*60_000));
  const limit=Math.max(50,Math.min(1500,Number(process.env.DEX_VERIFY_SEED_LIMIT||600)));
  const now=Date.now();
  const rows=store.tokens()
    .filter(t=>__isPumpOriginToken(t)&&t?.dexConfirmed!==true)
    .filter(t=>{const ts=Number(t?.discoveredAt||t?.createdAt||0);return ts>0&&now-ts<=maxAgeMs})
    .slice(0,limit);
  for(const token of rows)gate.submit(token,{seeded:true});
  return rows.length;
}
function __reapplyDexMarket(mint,market){
  const current=store.state?.tokens?.[mint];
  if(!current)return null;
  return store.setToken(mint,{
    ...(market||{}),
    dexConfirmed:true,
    dexConfirmedAt:current.dexConfirmedAt||Date.now(),
    dexListedAt:current.dexListedAt||Date.now(),
    dexVerificationPending:false,
    launchPlatform:'pump',
    protocol:'pump'
  });
}
function __applyDexVerifiedPump(info){
  const mint=String(info?.mint||info?.candidate?.mint||'').trim();
  if(!mint)return;
  const candidate={
    ...(info?.candidate||{}),
    mint,
    launchPlatform:'pump',
    protocol:'pump',
    source:info?.candidate?.source||'Pump create',
    dexConfirmed:true,
    dexConfirmedAt:Date.now(),
    dexListedAt:Date.now(),
    dexVerificationPending:false,
    ...(info?.market||{})
  };
  const existing=store.state?.tokens?.[mint]||null;
  let updated;
  if(existing){
    updated=store.setToken(mint,{
      ...candidate,
      discoveredAt:existing.discoveredAt||candidate.discoveredAt,
      creator:existing.creator||candidate.creator||null,
      dataQuality:Math.max(Number(existing.dataQuality)||0,0.45)
    });
  }else{
    updated=store.addToken({...candidate,dataQuality:Math.max(Number(candidate.dataQuality)||0,0.45)});
  }

  __stopPumpPriceTimerForDex(mint);
  try{if(updated?.creator)eventHolderLedger.setCreator(mint,updated.creator)}catch{}

  const phaseADone=Boolean(updated?.totalSupply!=null&&updated?.decimals!=null);
  if(!phaseADone){
    void enrich(mint,updated?.curve||candidate?.curve||null).then(()=>{
      const finalToken=__reapplyDexMarket(mint,info?.market||{});
      if(finalToken){
        Promise.resolve(evaluateAll(finalToken)).catch(()=>{});
        try{publish(mint)}catch{}
        try{paper.onTokenUpdate(mint,finalToken)}catch{}
      }
    }).catch(error=>console.error('[DEX VERIFY] enrich',mint,error?.message||error));
    return;
  }

  Promise.resolve(evaluateAll(updated)).catch(()=>{});
  try{publish(mint)}catch{}
  try{paper.onTokenUpdate(mint,updated)}catch{}
}
function __applyDexVerifiedMarket(mint,patch){
  const current=store.state?.tokens?.[mint];
  if(!current||current?.dexConfirmed!==true||!__isPumpOriginToken(current))return;
  __stopPumpPriceTimerForDex(mint);
  const updated=__reapplyDexMarket(mint,patch);
  if(!updated)return;
  Promise.resolve(evaluateAll(updated)).catch(()=>{});
  try{publish(mint)}catch{}
  try{paper.onTokenUpdate(mint,updated)}catch{}
}
function __pruneDecisionsForDiscoveryMode(){
  for(const [uid,map] of Object.entries(store?._uidDec||{})){
    for(const [key] of [...map.entries()]){
      const decision=store.state?.decisions?.[key];
      const mint=decision?.mint||String(key).slice(String(uid).length+1);
      const token=store.state?.tokens?.[mint];
      if(!token||!__tokenAllowedByDiscoveryMode(token)){
        map.delete(key);
        delete store.state.decisions[key];
      }
    }
  }
}
function __applyDiscoverySourceMode(){
  // Pump is always the physical discovery feed.
  __startPumpLiveFeed();
  if(!ws)startDiscovery();

  const gate=__ensureDexVerifier();
  if(__discoverySource.mode==='dex'||__discoverySource.mode==='hybrid'){
    const seeded=__seedDexVerifierFromRecentPump();
    console.log('[DISCOVERY SOURCE]',__discoverySource.mode,'Pump discovery + DEX verification','seeded='+seeded);
  }else{
    gate.clearPending();
    console.log('[DISCOVERY SOURCE]',__discoverySource.mode,'Pump discovery only');
  }
  __pruneDecisionsForDiscoveryMode();
  return __discoverySource.mode;
}
function __discoverySourceStatus(){
  const pumpTrade=__pumpLiveTradeFeed?.metrics?.()||null;
  const dexMetrics=__dexVerificationGate?.metrics?.()||{
    active:false,connected:false,strategy:'pump-origin+dex-verification',pairsConfirmed:0,pairsRejected:0,pendingConfirms:0,tracked:0
  };
  const dexSelected=__discoverySource.mode==='dex'||__discoverySource.mode==='hybrid';
  return {
    source:__discoverySource.snapshot(),
    strategy:'pump-origin+dex-verification',
    pump:{connected:Boolean(discovery.connected||pumpTrade?.connected),createConnected:Boolean(discovery.connected),trade:pumpTrade},
    dex:{...dexMetrics,connected:Boolean(dexSelected&&discovery.connected&&dexMetrics.active!==false)}
  };
}

"""
    app = app[:runtime_start] + runtime + app[runtime_end:]

    # ------------------------------------------------------------
    # 11) /api/discovery/status includes the verifier metrics.
    # ------------------------------------------------------------
    app = replace_once(
        app,
        "    liveTradeFeed:__pumpLiveTradeFeed?.metrics?.()||null,\n",
        "    liveTradeFeed:__pumpLiveTradeFeed?.metrics?.()||null,\n    dexVerification:__dexVerificationGate?.metrics?.()||null,\n",
        "discovery status verifier metrics",
    )

    # ------------------------------------------------------------
    # 12) Source snapshot describes logical mode, not separate physical feeds.
    # ------------------------------------------------------------
    source = replace_once(
        source,
        "  snapshot() {\n    return {mode:this.state.mode,available:['pump','dex','hybrid'],pumpEnabled:this.allows('pump'),dexEnabled:this.allows('dex'),updatedAt:this.state.updatedAt,version:this.state.version};\n  }",
        "  snapshot() {\n    const dexEnabled=this.state.mode==='dex'||this.state.mode==='hybrid';\n    return {mode:this.state.mode,available:['pump','dex','hybrid'],pumpEnabled:true,dexEnabled,strategy:'pump-origin+dex-verification',updatedAt:this.state.updatedAt,version:this.state.version};\n  }",
        "source snapshot semantics",
    )

    # ------------------------------------------------------------
    # 13) Enrichment preserves DexScreener market values after confirmation.
    # ------------------------------------------------------------
    enrich = replace_once(
        enrich,
        "    const existingToken = store.state.tokens[mint] || {};\n",
        "    const existingToken = store.state.tokens[mint] || {};\n    const dexMarketLocked = existingToken.dexConfirmed === true;\n",
        "enrich DEX market lock",
    )
    enrich = replace_once(
        enrich,
        "      buyPressure: tw.sell ? tw.buy / tw.sell : (tw.buy ? tw.buy : null),\n      dataQuality: [total || null, c.priceSol ?? null].filter(x => x != null).length / 2,\n      source: 'Solana RPC',",
        "      buyPressure: dexMarketLocked ? (existingToken.buyPressure ?? null) : (tw.sell ? tw.buy / tw.sell : (tw.buy ? tw.buy : null)),\n      dataQuality: Math.max(Number(existingToken.dataQuality) || 0, [total || null, dexMarketLocked ? (existingToken.priceSol ?? null) : (c.priceSol ?? null)].filter(x => x != null).length / 2),\n      source: dexMarketLocked ? (existingToken.source || 'Pump create') : 'Solana RPC',",
        "enrich market ownership fields",
    )
    old_curve = """    if (Object.keys(c).length) {
      update.priceSol       = c.priceSol    ?? null;
      update.liquiditySol   = c.liquiditySol ?? null;
      update.marketCapSol   = (c.priceSol && total) ? c.priceSol * total : null;
      /* MEMEFLOW_CANONICAL_ENRICH_FIELDS_V1 */
      update.marketCap      = update.marketCapSol;
      update.liquidity      = update.liquiditySol;
      update.momentum       = update.buyPressure;
      update.complete       = c.complete     ?? null;
    }"""
    new_curve = """    if (Object.keys(c).length) {
      update.complete = c.complete ?? null;
      if (!dexMarketLocked) {
        update.priceSol       = c.priceSol    ?? null;
        update.liquiditySol   = c.liquiditySol ?? null;
        update.marketCapSol   = (c.priceSol && total) ? c.priceSol * total : null;
        /* MEMEFLOW_CANONICAL_ENRICH_FIELDS_V1 */
        update.marketCap      = update.marketCapSol;
        update.liquidity      = update.liquiditySol;
        update.momentum       = update.buyPressure;
      }
    }"""
    enrich = replace_once(enrich, old_curve, new_curve, "curve market ownership")
    enrich = replace_once(
        enrich,
        "    if (ensurePriceTimer) ensurePriceTimer(mint, curve);",
        "    if (ensurePriceTimer && token?.dexConfirmed !== true) ensurePriceTimer(mint, curve);",
        "enrich price timer guard",
    )

    # ------------------------------------------------------------
    # 14) If V26 Live Token States is installed locally, make DEX list mean
    #     Pump-origin + verified DEX pair, never old direct-DEX rows.
    # ------------------------------------------------------------
    v26_old = """    const isDexToken=t=>{
      const launch=String(t?.launchPlatform||'').toLowerCase();
      const source=String(t?.source||'').toLowerCase();

      return (
        launch==='dex' ||
        source.includes('dex pool') ||
        Boolean(t?.dexUrl||t?.dexPairAddress||t?.dexId)
      );
    };"""
    v26_new = """    const isDexToken=t=>{
      return (
        isPumpToken(t) &&
        t?.dexConfirmed===true &&
        Boolean(t?.dexUrl||t?.dexPairAddress)
      );
    };"""
    if v26_old in app:
        app = app.replace(v26_old, v26_new, 1)
        log("detected V26 Live Token States; DEX filter updated")

    # If the older Pump-only debug route is still present, make its sample source-aware.
    old_debug_filter = """    const allTokens=Object.values(store?.state?.tokens||{});
    const pumpTokens=allTokens
      .filter(t=>{
        const lp=String(t?.launchPlatform||t?.protocol||'').toLowerCase();
        const mint=String(t?.mint||t?.tokenMint||t?.tokenAddress||'');
        return lp==='pump'||mint.toLowerCase().endsWith('pump');
      })
      .sort((a,b)=>Number(b?.discoveredAt||b?.createdAt||0)-Number(a?.discoveredAt||a?.createdAt||0))
      .slice(0,limit);

    const settings=store.settings(u.id);

    const sample=pumpTokens.map(token=>{"""
    new_debug_filter = """    const allTokens=Object.values(store?.state?.tokens||{});
    const visibleTokens=allTokens
      .filter(__tokenAllowedByDiscoveryMode)
      .sort((a,b)=>Number(b?.discoveredAt||b?.createdAt||0)-Number(a?.discoveredAt||a?.createdAt||0))
      .slice(0,limit);

    const settings=store.settings(u.id);

    const sample=visibleTokens.map(token=>{"""
    if old_debug_filter in app:
        app = app.replace(old_debug_filter, new_debug_filter, 1)
        log("older Pump-only Live Token States route updated")

    # ------------------------------------------------------------
    # 15) V5 settings UI: no dimming in DEX mode now. All accepted tokens
    #     are Pump-origin, so Pump filters are meaningful in every mode.
    # ------------------------------------------------------------
    if system_js is not None:
        old_ui = r"""function mf293ApplySourceCompatibility() {
  const mode = String(MF293.discoverySourceMode || 'pump').toLowerCase();

  for (const key of MF293_DEX_IGNORED_KEYS) {
    const input = document.querySelector(`[data-setting-key="${key}"]`);
    const wrap = input?.closest('.mf293-field');
    if (!input || !wrap) continue;

    mf293RestorePlatformField(input, wrap);
    if (mode === 'pump') continue;

    const note = document.createElement('small');
    note.className = 'mf293-source-note';

    if (mode === 'dex') {
      input.disabled = true;
      input.dataset.mf293SourceDisabled = '1';
      wrap.classList.add('mf293-source-inactive');
      note.textContent = 'Not used in DEX mode';
    } else {
      wrap.classList.add('mf293-source-hybrid');
      note.textContent = 'Pump.fun only · ignored for DEX tokens';
    }

    wrap.appendChild(note);
  }
}
"""
        new_ui = r"""function mf293ApplySourceCompatibility() {
  // V33: DEX is an admission/verification gate over Pump-origin tokens.
  // Normal Pump settings remain active and editable in all modes.
  for (const key of MF293_DEX_IGNORED_KEYS) {
    const input = document.querySelector(`[data-setting-key="${key}"]`);
    const wrap = input?.closest('.mf293-field');
    if (!input || !wrap) continue;
    mf293RestorePlatformField(input, wrap);
  }
}
"""
        if old_ui in system_js:
            system_js = system_js.replace(old_ui, new_ui, 1)
            log("detected V5 settings UI; removed obsolete DEX dimming")
        elif "function mf293ApplySourceCompatibility()" in system_js:
            log("NOTICE: source compatibility UI differs from V5; unknown UI block left untouched")

    # ------------------------------------------------------------
    # 16) Write files.
    # ------------------------------------------------------------
    GATE.parent.mkdir(parents=True, exist_ok=True)
    GATE.write_text(GATE_CODE, encoding="utf-8")
    APP.write_text(app.rstrip() + "\n\n// " + PATCH_ID + "\n", encoding="utf-8")
    ENRICH.write_text(enrich, encoding="utf-8")
    SOURCE.write_text(source, encoding="utf-8")
    RECOVERY.write_text(recovery, encoding="utf-8")
    if SYSTEM_JS.exists() and system_js is not None:
        SYSTEM_JS.write_text(system_js, encoding="utf-8")

    # ------------------------------------------------------------
    # 17) Syntax + structural validation. Any failure rolls everything back.
    # ------------------------------------------------------------
    for path in [APP, ENRICH, SOURCE, RECOVERY, GATE]:
        node_check(path)
    if SYSTEM_JS.exists():
        node_check(SYSTEM_JS)

    final_app = read(APP)
    final_enrich = read(ENRICH)
    checks = {
        "direct DEX scanner import removed": "startDexDiscoveryFeed" not in final_app,
        "new DEX verifier imported": "createDexVerificationGate" in final_app,
        "Pump remains physical discovery": "Pump is always the physical discovery feed" in final_app,
        "DEX admission gate exists": "DISCOVERY_SOURCE_GATE" in final_app,
        "raw DEX-mode candidate persisted": "dexVerificationPending:true" in final_app,
        "duplicate Pump fastPhase removed": "fastPhaseAStart(result.mint,result.curve);" not in final_app,
        "undefined create mint reference removed": "__v1224LinkCreator(mint,__v1223Token(mint))" not in final_app[final_app.find("function processSignature(sig)"):final_app.find("const discQueue=makeDiscoveryQueue")],
        "bridge source-aware": "bridgeIsPump(t)&&__tokenAllowedByDiscoveryMode(t)" in final_app,
        "recovery source-aware": "tokenFilter:__tokenAllowedByDiscoveryMode" in final_app,
        "price timer guarded": "__priceOwnerToken?.dexConfirmed===true" in final_app,
        "DEX market locked in enrich": "const dexMarketLocked = existingToken.dexConfirmed === true;" in final_enrich,
        "new verifier module exists": GATE.exists(),
        "patch marker": PATCH_ID in final_app,
    }
    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        raise RuntimeError("post-install validation failed: " + ", ".join(failed))

    log("app-server.mjs syntax OK")
    log("src/enrich.mjs syntax OK")
    log("src/discovery-source.mjs syntax OK")
    log("src/recovery.mjs syntax OK")
    log("src/dex-verification-gate.mjs syntax OK")
    if SYSTEM_JS.exists():
        log("system.js syntax OK")

    log("INSTALL COMPLETE")
    log("")
    log("FINAL ARCHITECTURE")
    log("  Pump.fun = one and only discovery feed")
    log("  DEX      = Pump candidates become eligible only after real DEX verification")
    log("  Hybrid   = normal Pump pipeline + background DEX verification/tagging")
    log("")
    log("CLEANUPS")
    log("  old direct PumpSwap/Raydium DEX scanner is dormant (not imported, not started)")
    log("  duplicate Pump fastPhaseAStart removed")
    log("  old undefined `mint` reference in Pump Create path fixed")
    log("  evaluator / holders / bridge / reevaluation / recovery share one source gate")
    log("  DexScreener owns market data after DEX confirmation")
    log("  bonding-curve timer cannot overwrite confirmed DEX market data")
    log("  source switch prunes only in-memory ineligible decisions; tokens/positions are not deleted")
    log("")
    log("backup: " + str(BACKUP))
    log("Restart the Replit workflow/app now.")

except Exception as exc:
    fail(exc)
