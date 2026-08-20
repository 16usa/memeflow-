#!/usr/bin/env python3
from __future__ import annotations

import base64
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_PLATFORM_NATIVE_DIRECT_V4"
STAMP = time.strftime("%Y%m%d-%H%M%S")
HELPER = base64.b64decode("Ci8vIE1FTUVGTE9XX1BMQVRGT1JNX05BVElWRV9ESVJFQ1RfVjQKY29uc3QgTUZfUExBVEZPUk1fVjQgPSB7CiAgbW9kZTogJ3B1bXAnLAogIGJ1c3k6IGZhbHNlLAogIHNlbGVjdDogbnVsbAp9OwoKZnVuY3Rpb24gbWZQbGF0Zm9ybVY0VGV4dChlbCkgewogIHJldHVybiAoZWw/LmlubmVyVGV4dCB8fCBlbD8udGV4dENvbnRlbnQgfHwgJycpLnJlcGxhY2UoL1xzKy9nLCAnICcpLnRyaW0oKTsKfQoKZnVuY3Rpb24gbWZQbGF0Zm9ybVY0UGFuZWwoKSB7CiAgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZjI5M1NldHRpbmdzUGFuZWwnKQogICAgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21mMjkzU2V0dGluZ3NCYWNrZHJvcCcpCiAgICB8fCBkb2N1bWVudC5ib2R5Owp9CgpmdW5jdGlvbiBtZlBsYXRmb3JtVjRGaW5kUGxhdGZvcm1DYXJkKCkgewogIGNvbnN0IHJvb3QgPSBtZlBsYXRmb3JtVjRQYW5lbCgpOwogIGNvbnN0IGxlYXZlcyA9IEFycmF5LmZyb20ocm9vdC5xdWVyeVNlbGVjdG9yQWxsKCcqJykpLmZpbHRlcihlbCA9PiB7CiAgICBpZiAoZWwuY2hpbGRyZW4ubGVuZ3RoKSByZXR1cm4gZmFsc2U7CiAgICByZXR1cm4gbWZQbGF0Zm9ybVY0VGV4dChlbCkudG9Mb3dlckNhc2UoKSA9PT0gJ3BsYXRmb3JtJzsKICB9KTsKCiAgY29uc3QgbGFiZWwgPSBsZWF2ZXNbMF07CiAgaWYgKCFsYWJlbCkgcmV0dXJuIG51bGw7CgogIGxldCBub2RlID0gbGFiZWwucGFyZW50RWxlbWVudDsKICBsZXQgYmVzdCA9IG51bGw7CgogIGZvciAobGV0IGkgPSAwOyBub2RlICYmIG5vZGUgIT09IHJvb3QucGFyZW50RWxlbWVudCAmJiBpIDwgNjsgaSsrLCBub2RlID0gbm9kZS5wYXJlbnRFbGVtZW50KSB7CiAgICBjb25zdCB0ID0gbWZQbGF0Zm9ybVY0VGV4dChub2RlKS50b0xvd2VyQ2FzZSgpOwoKICAgIGlmICghdC5pbmNsdWRlcygncGxhdGZvcm0nKSkgY29udGludWU7CiAgICBpZiAodC5pbmNsdWRlcygnYWkgcG9saWN5JykgfHwgdC5pbmNsdWRlcygna2lsbCBzd2l0Y2gnKSkgYnJlYWs7CgogICAgY29uc3QgciA9IG5vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0Py4oKTsKICAgIGlmICghciB8fCByLndpZHRoIDwgOTAgfHwgci5oZWlnaHQgPCA0MCB8fCByLmhlaWdodCA+IDE1MCkgY29udGludWU7CgogICAgYmVzdCA9IG5vZGU7CgogICAgY29uc3QgY3MgPSBnZXRDb21wdXRlZFN0eWxlKG5vZGUpOwogICAgaWYgKHBhcnNlRmxvYXQoY3MuYm9yZGVyVG9wV2lkdGggfHwgJzAnKSA+IDApIGJyZWFrOwogIH0KCiAgcmV0dXJuIGJlc3Q7Cn0KCmZ1bmN0aW9uIG1mUGxhdGZvcm1WNEZpbmRWYWx1ZU5vZGUoY2FyZCkgewogIGlmICghY2FyZCkgcmV0dXJuIG51bGw7CgogIGNvbnN0IGxlYXZlcyA9IEFycmF5LmZyb20oY2FyZC5xdWVyeVNlbGVjdG9yQWxsKCcqJykpLmZpbHRlcihlbCA9PiB7CiAgICBpZiAoZWwuY2hpbGRyZW4ubGVuZ3RoKSByZXR1cm4gZmFsc2U7CiAgICBjb25zdCB0ID0gbWZQbGF0Zm9ybVY0VGV4dChlbCkudG9Mb3dlckNhc2UoKTsKICAgIHJldHVybiB0ICYmIHQgIT09ICdwbGF0Zm9ybSc7CiAgfSk7CgogIHJldHVybiBsZWF2ZXMuZmluZChlbCA9PiB7CiAgICBjb25zdCB0ID0gbWZQbGF0Zm9ybVY0VGV4dChlbCkudG9Mb3dlckNhc2UoKTsKICAgIHJldHVybiB0ID09PSAncHVtcC5mdW4nIHx8IHQgPT09ICdwdW1wJyB8fCB0ID09PSAnZGV4JyB8fCB0ID09PSAnaHlicmlkJzsKICB9KSB8fCBsZWF2ZXNbbGVhdmVzLmxlbmd0aCAtIDFdIHx8IG51bGw7Cn0KCmZ1bmN0aW9uIG1mUGxhdGZvcm1WNExhYmVsKG1vZGUpIHsKICByZXR1cm4gbW9kZSA9PT0gJ2RleCcgPyAnREVYJwogICAgOiBtb2RlID09PSAnaHlicmlkJyA/ICdIeWJyaWQnCiAgICA6ICdQdW1wLmZ1bic7Cn0KCmZ1bmN0aW9uIG1mUGxhdGZvcm1WNE5hdGl2ZVNlbGVjdCgpIHsKICBjb25zdCBzZWxlY3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTsKICBzZWxlY3QuaWQgPSAnbWZQbGF0Zm9ybU5hdGl2ZVNlbGVjdFY0JzsKICBzZWxlY3Quc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ1BsYXRmb3JtJyk7CgogIGZvciAoY29uc3QgW3ZhbHVlLCBsYWJlbF0gb2YgWwogICAgWydwdW1wJywgJ1B1bXAuZnVuJ10sCiAgICBbJ2RleCcsICdERVgnXSwKICAgIFsnaHlicmlkJywgJ0h5YnJpZCddCiAgXSkgewogICAgY29uc3Qgb3B0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnb3B0aW9uJyk7CiAgICBvcHRpb24udmFsdWUgPSB2YWx1ZTsKICAgIG9wdGlvbi50ZXh0Q29udGVudCA9IGxhYmVsOwogICAgc2VsZWN0LmFwcGVuZENoaWxkKG9wdGlvbik7CiAgfQoKICAvLyBLZWVwIGl0IHZpc3VhbGx5IGlkZW50aWNhbCB0byB0aGUgb2xkIHBsYWluICJQdW1wLmZ1biIgdmFsdWUsCiAgLy8gd2hpbGUgcmVtYWluaW5nIGEgUkVBTCBuYXRpdmUgc2VsZWN0LCBzbyBpT1Mgb3BlbnMgdGhlIHNhbWUgcGlja2VyCiAgLy8gYXMgT3BlcmF0aW5nIG1vZGUgLyBQcm9maWxlIC8gVHJhZGluZyBlbnZpcm9ubWVudC4KICBPYmplY3QuYXNzaWduKHNlbGVjdC5zdHlsZSwgewogICAgd2lkdGg6ICcxMDAlJywKICAgIG1heFdpZHRoOiAnMTAwJScsCiAgICBtYXJnaW46ICcwJywKICAgIHBhZGRpbmc6ICcwIDIycHggMCAwJywKICAgIGJvcmRlcjogJzAnLAogICAgb3V0bGluZTogJzAnLAogICAgYmFja2dyb3VuZDogJ3RyYW5zcGFyZW50JywKICAgIGNvbG9yOiAnaW5oZXJpdCcsCiAgICBmb250OiAnaW5oZXJpdCcsCiAgICBmb250V2VpZ2h0OiAnaW5oZXJpdCcsCiAgICBsaW5lSGVpZ2h0OiAnaW5oZXJpdCcsCiAgICBXZWJraXRBcHBlYXJhbmNlOiAnbm9uZScsCiAgICBhcHBlYXJhbmNlOiAnbm9uZScsCiAgICBjdXJzb3I6ICdwb2ludGVyJwogIH0pOwoKICBzZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgYXN5bmMgKCkgPT4gewogICAgaWYgKE1GX1BMQVRGT1JNX1Y0LmJ1c3kpIHJldHVybjsKCiAgICBjb25zdCBwcmV2aW91cyA9IE1GX1BMQVRGT1JNX1Y0Lm1vZGU7CiAgICBjb25zdCBuZXh0ID0gU3RyaW5nKHNlbGVjdC52YWx1ZSB8fCAncHVtcCcpLnRvTG93ZXJDYXNlKCk7CgogICAgaWYgKG5leHQgPT09IHByZXZpb3VzKSByZXR1cm47CgogICAgTUZfUExBVEZPUk1fVjQuYnVzeSA9IHRydWU7CiAgICBzZWxlY3QuZGlzYWJsZWQgPSB0cnVlOwoKICAgIHRyeSB7CiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJy9hcGkvZGlzY292ZXJ5LXNvdXJjZScsIHsKICAgICAgICBtZXRob2Q6ICdQT1NUJywKICAgICAgICBjYWNoZTogJ25vLXN0b3JlJywKICAgICAgICBjcmVkZW50aWFsczogJ3NhbWUtb3JpZ2luJywKICAgICAgICBoZWFkZXJzOiB7CiAgICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLAogICAgICAgICAgJ2FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJwogICAgICAgIH0sCiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBtb2RlOiBuZXh0IH0pCiAgICAgIH0pOwoKICAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTsKCiAgICAgIGlmICghcmVzcG9uc2Uub2spIHsKICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYm9keT8ubWVzc2FnZSB8fCBib2R5Py5lcnJvciB8fCBgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c31gKTsKICAgICAgfQoKICAgICAgTUZfUExBVEZPUk1fVjQubW9kZSA9IFN0cmluZyhib2R5Py5zb3VyY2U/Lm1vZGUgfHwgbmV4dCkudG9Mb3dlckNhc2UoKTsKICAgICAgc2VsZWN0LnZhbHVlID0gTUZfUExBVEZPUk1fVjQubW9kZTsKICAgICAgbWZQbGF0Zm9ybVY0QXBwbHlDb21wYXRpYmlsaXR5KE1GX1BMQVRGT1JNX1Y0Lm1vZGUpOwogICAgfSBjYXRjaCAoZXJyb3IpIHsKICAgICAgY29uc29sZS5lcnJvcignW1BMQVRGT1JNIFY0XSBzd2l0Y2ggZmFpbGVkJywgZXJyb3IpOwogICAgICBNRl9QTEFURk9STV9WNC5tb2RlID0gcHJldmlvdXM7CiAgICAgIHNlbGVjdC52YWx1ZSA9IHByZXZpb3VzOwogICAgfSBmaW5hbGx5IHsKICAgICAgTUZfUExBVEZPUk1fVjQuYnVzeSA9IGZhbHNlOwogICAgICBzZWxlY3QuZGlzYWJsZWQgPSBmYWxzZTsKICAgIH0KICB9KTsKCiAgcmV0dXJuIHNlbGVjdDsKfQoKZnVuY3Rpb24gbWZQbGF0Zm9ybVY0RmllbGRDYXJkcygpIHsKICBjb25zdCByb290ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21mMjkzU2V0dGluZ3NQYW5lbCcpIHx8IG1mUGxhdGZvcm1WNFBhbmVsKCk7CiAgY29uc3QgY29udHJvbHMgPSBBcnJheS5mcm9tKAogICAgcm9vdC5xdWVyeVNlbGVjdG9yQWxsKAogICAgICAnW2RhdGEtc2V0dGluZy1rZXldLCBpbnB1dCwgc2VsZWN0LCB0ZXh0YXJlYSwgW3JvbGU9InN3aXRjaCJdJwogICAgKQogICk7CgogIGNvbnN0IGNhcmRzID0gW107CgogIGZvciAoY29uc3QgY29udHJvbCBvZiBjb250cm9scykgewogICAgaWYgKGNvbnRyb2wuaWQgPT09ICdtZlBsYXRmb3JtTmF0aXZlU2VsZWN0VjQnKSBjb250aW51ZTsKCiAgICBsZXQgbm9kZSA9IGNvbnRyb2wucGFyZW50RWxlbWVudDsKICAgIGxldCBiZXN0ID0gbnVsbDsKCiAgICBmb3IgKGxldCBpID0gMDsgbm9kZSAmJiBub2RlICE9PSByb290ICYmIGkgPCA1OyBpKyssIG5vZGUgPSBub2RlLnBhcmVudEVsZW1lbnQpIHsKICAgICAgY29uc3QgdCA9IG1mUGxhdGZvcm1WNFRleHQobm9kZSk7CiAgICAgIGlmICghdCB8fCB0Lmxlbmd0aCA+IDMwMCkgYnJlYWs7CgogICAgICBjb25zdCBjb3VudCA9IG5vZGUucXVlcnlTZWxlY3RvckFsbCgKICAgICAgICAnW2RhdGEtc2V0dGluZy1rZXldLCBpbnB1dCwgc2VsZWN0LCB0ZXh0YXJlYSwgW3JvbGU9InN3aXRjaCJdJwogICAgICApLmxlbmd0aDsKCiAgICAgIGNvbnN0IHIgPSBub2RlLmdldEJvdW5kaW5nQ2xpZW50UmVjdD8uKCk7CiAgICAgIGlmICghciB8fCByLndpZHRoIDwgMTAwIHx8IHIuaGVpZ2h0IDwgMzggfHwgci5oZWlnaHQgPiAyNDApIGNvbnRpbnVlOwoKICAgICAgaWYgKGNvdW50ID09PSAxKSB7CiAgICAgICAgYmVzdCA9IG5vZGU7CiAgICAgICAgY29uc3QgY3MgPSBnZXRDb21wdXRlZFN0eWxlKG5vZGUpOwogICAgICAgIGlmIChwYXJzZUZsb2F0KGNzLmJvcmRlclRvcFdpZHRoIHx8ICcwJykgPiAwKSBicmVhazsKICAgICAgfQogICAgfQoKICAgIGlmIChiZXN0ICYmICFjYXJkcy5pbmNsdWRlcyhiZXN0KSkgY2FyZHMucHVzaChiZXN0KTsKICB9CgogIHJldHVybiBjYXJkczsKfQoKZnVuY3Rpb24gbWZQbGF0Zm9ybVY0UnVsZSh0ZXh0KSB7CiAgY29uc3QgdCA9IFN0cmluZyh0ZXh0IHx8ICcnKS50b0xvd2VyQ2FzZSgpOwoKICBpZiAodC5pbmNsdWRlcygnYm9uZGluZyBjdXJ2ZScpKSB7CiAgICByZXR1cm4gewogICAgICBkZXg6ICdQdW1wLmZ1biBvbmx5IMK3IGluYWN0aXZlIGluIERFWCBtb2RlJywKICAgICAgaHlicmlkOiAnUHVtcC5mdW4gb25seSDCtyBpZ25vcmVkIGJ5IERFWCBicmFuY2gnCiAgICB9OwogIH0KCiAgaWYgKHQuaW5jbHVkZXMoJ3RvdGFsIGZlZXMnKSkgewogICAgcmV0dXJuIHsKICAgICAgZGV4OiAnUHVtcC5mdW4gb25seSDCtyBpbmFjdGl2ZSBpbiBERVggbW9kZScsCiAgICAgIGh5YnJpZDogJ1B1bXAuZnVuIG9ubHkgwrcgaWdub3JlZCBieSBERVggYnJhbmNoJwogICAgfTsKICB9CgogIGlmICh0LmluY2x1ZGVzKCdidW5kbGUnKSkgewogICAgcmV0dXJuIHsKICAgICAgZGV4OiAnTm8gREVYIGJ1bmRsZSBzaWduYWwgwrcgaW5hY3RpdmUnLAogICAgICBoeWJyaWQ6ICdQdW1wLmZ1biBicmFuY2ggb25seSDCtyBubyBERVggYnVuZGxlIHNpZ25hbCcKICAgIH07CiAgfQoKICBpZiAodC5pbmNsdWRlcygnc25pcGVyJykpIHsKICAgIHJldHVybiB7CiAgICAgIGRleDogJ05vIERFWCBzbmlwZXIgc2lnbmFsIMK3IGluYWN0aXZlJywKICAgICAgaHlicmlkOiAnUHVtcC5mdW4gYnJhbmNoIG9ubHkgwrcgbm8gREVYIHNuaXBlciBzaWduYWwnCiAgICB9OwogIH0KCiAgaWYgKAogICAgdC5pbmNsdWRlcygnZGV2ZWxvcGVyJykgJiYKICAgICgKICAgICAgdC5pbmNsdWRlcygnc2hhcmUnKSB8fAogICAgICB0LmluY2x1ZGVzKCdjb25jZW50cmF0aW9uJykgfHwKICAgICAgdC5pbmNsdWRlcygnYmxhY2tsaXN0JykgfHwKICAgICAgdC5pbmNsdWRlcygnd2FsbGV0JykgfHwKICAgICAgdC5pbmNsdWRlcygnbWluaW11bScpIHx8CiAgICAgIHQuaW5jbHVkZXMoJ21heGltdW0nKSB8fAogICAgICB0LmluY2x1ZGVzKCdtaW4gJykgfHwKICAgICAgdC5pbmNsdWRlcygnbWF4ICcpIHx8CiAgICAgIHQuaW5jbHVkZXMoJyUnKQogICAgKQogICkgewogICAgcmV0dXJuIHsKICAgICAgZGV4OiAnQ3JlYXRvci9kZXZlbG9wZXIgc2lnbmFsIHVuYXZhaWxhYmxlIGZyb20gREVYIHBvb2wgwrcgaW5hY3RpdmUnLAogICAgICBoeWJyaWQ6ICdQdW1wLmZ1biB0b2tlbnMgb25seSDCtyBpZ25vcmVkIGJ5IERFWCBicmFuY2gnCiAgICB9OwogIH0KCiAgcmV0dXJuIG51bGw7Cn0KCmZ1bmN0aW9uIG1mUGxhdGZvcm1WNFJlc3RvcmVDYXJkKGNhcmQpIHsKICBpZiAoIWNhcmQuZGF0YXNldC5tZlBsYXRmb3JtVjRUb3VjaGVkKSByZXR1cm47CgogIGNhcmQuc3R5bGUub3BhY2l0eSA9IGNhcmQuZGF0YXNldC5tZlBsYXRmb3JtVjRPcGFjaXR5IHx8ICcnOwogIGNhcmQuc3R5bGUuZmlsdGVyID0gY2FyZC5kYXRhc2V0Lm1mUGxhdGZvcm1WNEZpbHRlciB8fCAnJzsKCiAgY2FyZC5xdWVyeVNlbGVjdG9yKCc6c2NvcGUgPiBbZGF0YS1tZi1wbGF0Zm9ybS12NC1ub3RlXScpPy5yZW1vdmUoKTsKCiAgZm9yIChjb25zdCBjb250cm9sIG9mIGNhcmQucXVlcnlTZWxlY3RvckFsbCgKICAgICdbZGF0YS1tZi1wbGF0Zm9ybS12NC1kaXNhYmxlZF0nCiAgKSkgewogICAgY29uc3Qgd2FzRGlzYWJsZWQgPSBjb250cm9sLmRhdGFzZXQubWZQbGF0Zm9ybVY0RGlzYWJsZWQgPT09ICcxJzsKICAgIGNvbnRyb2wuZGlzYWJsZWQgPSB3YXNEaXNhYmxlZDsKICAgIGRlbGV0ZSBjb250cm9sLmRhdGFzZXQubWZQbGF0Zm9ybVY0RGlzYWJsZWQ7CiAgfQoKICBkZWxldGUgY2FyZC5kYXRhc2V0Lm1mUGxhdGZvcm1WNFRvdWNoZWQ7CiAgZGVsZXRlIGNhcmQuZGF0YXNldC5tZlBsYXRmb3JtVjRPcGFjaXR5OwogIGRlbGV0ZSBjYXJkLmRhdGFzZXQubWZQbGF0Zm9ybVY0RmlsdGVyOwp9CgpmdW5jdGlvbiBtZlBsYXRmb3JtVjRBcHBseUNvbXBhdGliaWxpdHkobW9kZSkgewogIGNvbnN0IGNhcmRzID0gbWZQbGF0Zm9ybVY0RmllbGRDYXJkcygpOwoKICBmb3IgKGNvbnN0IGNhcmQgb2YgY2FyZHMpIHsKICAgIG1mUGxhdGZvcm1WNFJlc3RvcmVDYXJkKGNhcmQpOwogIH0KCiAgaWYgKG1vZGUgPT09ICdwdW1wJykgcmV0dXJuOwoKICBmb3IgKGNvbnN0IGNhcmQgb2YgY2FyZHMpIHsKICAgIGNvbnN0IHJ1bGUgPSBtZlBsYXRmb3JtVjRSdWxlKG1mUGxhdGZvcm1WNFRleHQoY2FyZCkpOwogICAgaWYgKCFydWxlKSBjb250aW51ZTsKCiAgICBjYXJkLmRhdGFzZXQubWZQbGF0Zm9ybVY0VG91Y2hlZCA9ICcxJzsKICAgIGNhcmQuZGF0YXNldC5tZlBsYXRmb3JtVjRPcGFjaXR5ID0gY2FyZC5zdHlsZS5vcGFjaXR5IHx8ICcnOwogICAgY2FyZC5kYXRhc2V0Lm1mUGxhdGZvcm1WNEZpbHRlciA9IGNhcmQuc3R5bGUuZmlsdGVyIHx8ICcnOwoKICAgIGNvbnN0IG5vdGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTsKICAgIG5vdGUuZGF0YXNldC5tZlBsYXRmb3JtVjROb3RlID0gJzEnOwogICAgbm90ZS50ZXh0Q29udGVudCA9IG1vZGUgPT09ICdkZXgnID8gcnVsZS5kZXggOiBydWxlLmh5YnJpZDsKCiAgICBPYmplY3QuYXNzaWduKG5vdGUuc3R5bGUsIHsKICAgICAgbWFyZ2luVG9wOiAnNnB4JywKICAgICAgcGFkZGluZ1RvcDogJzZweCcsCiAgICAgIGJvcmRlclRvcDogJzFweCBzb2xpZCByZ2JhKDEyMCwxNDUsMTU1LC4xMiknLAogICAgICBjb2xvcjogbW9kZSA9PT0gJ2RleCcgPyAnIzY4N2Y4OScgOiAnIzgxNzdhOCcsCiAgICAgIGZvbnRTaXplOiAnOXB4JywKICAgICAgbGluZUhlaWdodDogJzEuMjUnLAogICAgICBsZXR0ZXJTcGFjaW5nOiAnLjAyZW0nCiAgICB9KTsKCiAgICBpZiAobW9kZSA9PT0gJ2RleCcpIHsKICAgICAgY2FyZC5zdHlsZS5vcGFjaXR5ID0gJy4zOCc7CiAgICAgIGNhcmQuc3R5bGUuZmlsdGVyID0gJ2dyYXlzY2FsZSguNTUpIHNhdHVyYXRlKC4zKSc7CgogICAgICBmb3IgKGNvbnN0IGNvbnRyb2wgb2YgY2FyZC5xdWVyeVNlbGVjdG9yQWxsKAogICAgICAgICdpbnB1dCwgc2VsZWN0LCB0ZXh0YXJlYSwgYnV0dG9uLCBbcm9sZT0ic3dpdGNoIl0nCiAgICAgICkpIHsKICAgICAgICBpZiAoY29udHJvbC5pZCA9PT0gJ21mUGxhdGZvcm1OYXRpdmVTZWxlY3RWNCcpIGNvbnRpbnVlOwogICAgICAgIGNvbnRyb2wuZGF0YXNldC5tZlBsYXRmb3JtVjREaXNhYmxlZCA9IGNvbnRyb2wuZGlzYWJsZWQgPyAnMScgOiAnMCc7CiAgICAgICAgY29udHJvbC5kaXNhYmxlZCA9IHRydWU7CiAgICAgIH0KICAgIH0gZWxzZSB7CiAgICAgIGNhcmQuc3R5bGUub3BhY2l0eSA9ICcuNzgnOwogICAgfQoKICAgIGNhcmQuYXBwZW5kQ2hpbGQobm90ZSk7CiAgfQp9Cgphc3luYyBmdW5jdGlvbiBtZlBsYXRmb3JtVjRMb2FkKCkgewogIHRyeSB7CiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCcvYXBpL2Rpc2NvdmVyeS1zb3VyY2UnLCB7CiAgICAgIG1ldGhvZDogJ0dFVCcsCiAgICAgIGNhY2hlOiAnbm8tc3RvcmUnLAogICAgICBjcmVkZW50aWFsczogJ3NhbWUtb3JpZ2luJywKICAgICAgaGVhZGVyczogeyAnYWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nIH0KICAgIH0pOwoKICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7CiAgICBpZiAoIXJlc3BvbnNlLm9rKSByZXR1cm47CgogICAgTUZfUExBVEZPUk1fVjQubW9kZSA9IFN0cmluZyhib2R5Py5zb3VyY2U/Lm1vZGUgfHwgJ3B1bXAnKS50b0xvd2VyQ2FzZSgpOwoKICAgIGlmIChNRl9QTEFURk9STV9WNC5zZWxlY3QpIHsKICAgICAgTUZfUExBVEZPUk1fVjQuc2VsZWN0LnZhbHVlID0gTUZfUExBVEZPUk1fVjQubW9kZTsKICAgIH0KCiAgICBtZlBsYXRmb3JtVjRBcHBseUNvbXBhdGliaWxpdHkoTUZfUExBVEZPUk1fVjQubW9kZSk7CiAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIGNvbnNvbGUud2FybignW1BMQVRGT1JNIFY0XSBzdGF0dXMgdW5hdmFpbGFibGUnLCBlcnJvcik7CiAgfQp9CgpmdW5jdGlvbiBtZlBsYXRmb3JtVjRNb3VudCgpIHsKICBjb25zdCBjYXJkID0gbWZQbGF0Zm9ybVY0RmluZFBsYXRmb3JtQ2FyZCgpOwogIGlmICghY2FyZCkgewogICAgY29uc29sZS53YXJuKCdbUExBVEZPUk0gVjRdIFBsYXRmb3JtIGNhcmQgbm90IGZvdW5kIGR1cmluZyBtZjI5M0J1aWxkJyk7CiAgICByZXR1cm47CiAgfQoKICBjb25zdCBvbGQgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoJyNtZlBsYXRmb3JtTmF0aXZlU2VsZWN0VjQnKTsKICBpZiAob2xkKSB7CiAgICBNRl9QTEFURk9STV9WNC5zZWxlY3QgPSBvbGQ7CiAgICBtZlBsYXRmb3JtVjRMb2FkKCk7CiAgICByZXR1cm47CiAgfQoKICBjb25zdCB2YWx1ZU5vZGUgPSBtZlBsYXRmb3JtVjRGaW5kVmFsdWVOb2RlKGNhcmQpOwogIGlmICghdmFsdWVOb2RlKSB7CiAgICBjb25zb2xlLndhcm4oJ1tQTEFURk9STSBWNF0gUGxhdGZvcm0gdmFsdWUgbm9kZSBub3QgZm91bmQnKTsKICAgIHJldHVybjsKICB9CgogIGNvbnN0IHNlbGVjdCA9IG1mUGxhdGZvcm1WNE5hdGl2ZVNlbGVjdCgpOwoKICAvLyBSZXBsYWNlIHRoZSBzdGF0aWMgUHVtcC5mdW4gdGV4dCBhdCBidWlsZC10aW1lLgogIHZhbHVlTm9kZS5yZXBsYWNlV2l0aChzZWxlY3QpOwoKICBNRl9QTEFURk9STV9WNC5zZWxlY3QgPSBzZWxlY3Q7CiAgbWZQbGF0Zm9ybVY0TG9hZCgpOwp9Cg==").decode("utf-8")

def log(msg):
    print("[PLATFORM-V4] " + str(msg), flush=True)

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

        if (root / "system.js").is_file() and (root / "app-server.mjs").is_file():
            return root

    for base in [Path("/home/runner/workspace"), Path.cwd()]:
        if not base.exists():
            continue
        for p in base.glob("**/system.js"):
            if (p.parent / "app-server.mjs").is_file():
                return p.parent.resolve()

    raise RuntimeError("MEMEFLOW root with system.js/app-server.mjs not found")

ROOT = find_root()
SYSTEM = ROOT / "system.js"
SERVER = ROOT / "app-server.mjs"
BACK = ROOT / (".platform-v4-backup-" + STAMP)
BACK.mkdir(parents=True, exist_ok=True)
BACK_SYSTEM = BACK / "system.js"

OLD_MARKERS = [
    "MEMEFLOW_DISCOVERY_SETTINGS_UI_V1",
    "MEMEFLOW_DISCOVERY_PLATFORM_DROPDOWN_V2",
    "MEMEFLOW_DISCOVERY_NATIVE_PLATFORM_V3",
]

def node_check(path):
    p = subprocess.run(
        ["node", "--check", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True
    )
    return p.returncode, (p.stderr or p.stdout or "").strip()

def find_function(text, name):
    needle = "function " + name + "("
    start = text.find(needle)

    if start < 0:
        raise RuntimeError("function " + name + "() not found")

    brace = text.find("{", start)
    if brace < 0:
        raise RuntimeError("opening brace for " + name + "() not found")

    depth = 0
    quote = None
    escape = False
    i = brace

    while i < len(text):
        ch = text[i]

        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue

        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            continue

        if ch == "/" and i + 1 < len(text):
            nxt = text[i + 1]

            if nxt == "/":
                end = text.find("\n", i + 2)
                if end < 0:
                    end = len(text)
                i = end
                continue

            if nxt == "*":
                end = text.find("*/", i + 2)
                if end < 0:
                    raise RuntimeError("unterminated comment while parsing " + name)
                i = end + 2
                continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return start, brace, i

        i += 1

    raise RuntimeError("closing brace for " + name + "() not found")

def rollback(reason):
    log("ERROR: " + str(reason))

    if BACK_SYSTEM.exists():
        shutil.copy2(BACK_SYSTEM, SYSTEM)
        log("system.js restored")

    log("ROLLBACK COMPLETE")
    sys.exit(1)

try:
    log("root: " + str(ROOT))

    server = SERVER.read_text(encoding="utf-8")
    if "/api/discovery-source" not in server:
        raise RuntimeError(
            "Discovery Router V1.1 endpoint /api/discovery-source is missing"
        )

    text = SYSTEM.read_text(encoding="utf-8")

    if PATCH_ID in text:
        log("V4 already installed")
        sys.exit(0)

    dirty_old = [m for m in OLD_MARKERS if m in text]
    if dirty_old:
        raise RuntimeError(
            "Old UI layers still present: " + ", ".join(dirty_old)
            + ". Run the clean restore first."
        )

    # Confirm this is the real clean MF293 settings builder shown by diagnostics.
    required = [
        "function mf293Build()",
        "kind === 'select'",
        "document.createElement('select')",
        "input.dataset.settingKey = key",
        "mf293Status('Unsaved', 'dirty')",
    ]

    for token in required:
        if token not in text:
            raise RuntimeError("clean MF293 anchor missing: " + token)

    shutil.copy2(SYSTEM, BACK_SYSTEM)
    log("backup: " + str(BACK_SYSTEM))

    build_start, build_brace, build_end = find_function(text, "mf293Build")

    # Insert helper directly before the existing mf293Build function.
    new_text = (
        text[:build_start]
        + HELPER
        + "\n\n"
        + text[build_start:]
    )

    # Re-find mf293Build after helper insertion.
    build_start, build_brace, build_end = find_function(new_text, "mf293Build")
    build_body = new_text[build_brace + 1:build_end]

    if "mfPlatformV4Mount();" in build_body:
        raise RuntimeError("mount call unexpectedly already present")

    # Mount only once, exactly when the actual settings DOM has been built.
    new_text = (
        new_text[:build_end]
        + "\n  mfPlatformV4Mount();\n"
        + new_text[build_end:]
    )

    SYSTEM.write_text(new_text, encoding="utf-8")
    log("patched system.js directly")

    rc, output = node_check(SYSTEM)
    if rc != 0:
        raise RuntimeError("system.js syntax check failed:\n" + output)

    final = SYSTEM.read_text(encoding="utf-8")

    checks = [
        PATCH_ID,
        "mfPlatformV4Mount();",
        "mfPlatformNativeSelectV4",
        "document.createElement('select')",
        "/api/discovery-source",
    ]

    for token in checks:
        if token not in final:
            raise RuntimeError("post-install validation missing: " + token)

    # There must be exactly one direct V4 marker and one mount call.
    if final.count("// " + PATCH_ID) != 1:
        raise RuntimeError(
            "V4 marker count is not exactly 1: "
            + str(final.count("// " + PATCH_ID))
        )

    if final.count("mfPlatformV4Mount();") != 1:
        raise RuntimeError(
            "V4 mount call count is not exactly 1: "
            + str(final.count("mfPlatformV4Mount();"))
        )

    log("system.js syntax OK")
    log("INSTALL COMPLETE")
    log("Platform is now a real native <select> mounted inside mf293Build()")
    log("No MutationObserver")
    log("No overlay")
    log("No custom dropdown")
    log("No new CSS file")
    log("Options: Pump.fun / DEX / Hybrid")
    log("DEX incompatible settings are disabled/dimmed")
    log("HYBRID marks Pump-only settings but keeps them editable")
    log("Hard-refresh System settings.")

except Exception as exc:
    rollback(exc)
