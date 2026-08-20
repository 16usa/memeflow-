#!/usr/bin/env python3
from __future__ import annotations
import base64,re,shutil,subprocess,sys,time
from pathlib import Path

PATCH_ID="MEMEFLOW_V30_2_CORE_CLEANUP"
STAMP=time.strftime("%Y%m%d-%H%M%S")
EVALUATE_MJS=base64.b64decode("Ly8gTUVNRUZMT1dfVjMwXzJfQ09SRV9DTEVBTlVQCmNvbnN0IGNsYW1wU2NvcmU9dj0+TWF0aC5tYXgoMCxNYXRoLm1pbigxMDAsTWF0aC5yb3VuZChOdW1iZXIodil8fDApKSk7CmNvbnN0IGZpbml0ZT12PT52IT09JycmJnYhPT1udWxsJiZ2IT09dW5kZWZpbmVkJiZOdW1iZXIuaXNGaW5pdGUoTnVtYmVyKHYpKTsKY29uc3QgZmlyc3RGaW5pdGU9KC4uLnhzKT0+e2Zvcihjb25zdCB2IG9mIHhzKWlmKGZpbml0ZSh2KSlyZXR1cm4gTnVtYmVyKHYpO3JldHVybiBudWxsfTsKY29uc3QgZmlyc3RUZXh0PSguLi54cyk9Pntmb3IoY29uc3QgdiBvZiB4cyl7Y29uc3Qgcz1TdHJpbmcodj8/JycpLnRyaW0oKTtpZihzKXJldHVybiBzfXJldHVybiAnJ307CmNvbnN0IGxpc3Q9dj0+U3RyaW5nKHY/PycnKS5zcGxpdCgvW1xuLF0rLykubWFwKHg9PngudHJpbSgpLnRvTG93ZXJDYXNlKCkpLmZpbHRlcihCb29sZWFuKTsKCmZ1bmN0aW9uIGluZGVwZW5kZW50QWlTY29yZSh0b2tlbj17fSl7CiAgbGV0IHNjb3JlPTA7IGNvbnN0IHF1YWxpdHk9W107CiAgY29uc3QgaD1maXJzdEZpbml0ZSh0b2tlbi5ob2xkZXJDb3VudCx0b2tlbi5ob2xkZXJzLHRva2VuLmhvbGRlcj8uY291bnQpOwogIGlmKGghPT1udWxsKXtsZXQgcD0wO2lmKGg+PTEwMClwPTIwO2Vsc2UgaWYoaD49NjApcD0xNztlbHNlIGlmKGg+PTMwKXA9MTM7ZWxzZSBpZihoPj0xNSlwPTc7ZWxzZSBpZihoPjApcD0zO3Njb3JlKz1wO3F1YWxpdHkucHVzaCh7a2V5Oidob2xkZXJzJyx2YWx1ZTpoLHBvaW50czpwLG1heFBvaW50czoyMH0pfQogIGNvbnN0IHQ9Zmlyc3RGaW5pdGUodG9rZW4udG9wMTBQY3QsdG9rZW4udG9wMTAsdG9rZW4uaG9sZGVyPy50b3AxMFBjdCk7CiAgaWYodCE9PW51bGwpe2xldCBwPTA7aWYodDw9MTUpcD0yMDtlbHNlIGlmKHQ8PTI1KXA9MTc7ZWxzZSBpZih0PD0zNSlwPTEyO2Vsc2UgaWYodDw9NTApcD02O3Njb3JlKz1wO3F1YWxpdHkucHVzaCh7a2V5Oid0b3AxMCcsdmFsdWU6dCxwb2ludHM6cCxtYXhQb2ludHM6MjB9KX0KICBjb25zdCBkPWZpcnN0RmluaXRlKHRva2VuLmRldmVsb3BlclBjdCx0b2tlbi5kZXZlbG9wZXJTaGFyZVBjdCx0b2tlbi5jcmVhdG9yUGN0LHRva2VuLmhvbGRlcj8uZGV2ZWxvcGVyUGN0KTsKICBpZihkIT09bnVsbCl7bGV0IHA9MDtpZihkPD01KXA9MjA7ZWxzZSBpZihkPD0xMClwPTE4O2Vsc2UgaWYoZDw9MjApcD0xNDtlbHNlIGlmKGQ8PTMwKXA9NztzY29yZSs9cDtxdWFsaXR5LnB1c2goe2tleTonZGV2ZWxvcGVyJyx2YWx1ZTpkLHBvaW50czpwLG1heFBvaW50czoyMH0pfQogIGNvbnN0IGI9Zmlyc3RGaW5pdGUodG9rZW4uYnV5UHJlc3N1cmUsdG9rZW4ubW9tZW50dW0sdG9rZW4ubWFya2V0Py5idXlQcmVzc3VyZSk7CiAgaWYoYiE9PW51bGwpe2xldCBwPTA7aWYoYj49MylwPTIwO2Vsc2UgaWYoYj49MilwPTE3O2Vsc2UgaWYoYj49MS41KXA9MTM7ZWxzZSBpZihiPj0xLjIpcD05O2Vsc2UgaWYoYj49MSlwPTQ7c2NvcmUrPXA7cXVhbGl0eS5wdXNoKHtrZXk6J2J1eVByZXNzdXJlJyx2YWx1ZTpiLHBvaW50czpwLG1heFBvaW50czoyMH0pfQogIGNvbnN0IHByaWNlPWZpcnN0RmluaXRlKHRva2VuLnByaWNlU29sKSxoYXNQcmljZT1wcmljZSE9PW51bGwmJnByaWNlPjA7CiAgaWYoaGFzUHJpY2Upc2NvcmUrPTEwO3F1YWxpdHkucHVzaCh7a2V5Oid2ZXJpZmllZFByaWNlJyx2YWx1ZTpoYXNQcmljZSxwb2ludHM6aGFzUHJpY2U/MTA6MCxtYXhQb2ludHM6MTB9KTsKICBjb25zdCBmcmVzaD10b2tlbi5ob2xkZXJGcmVzaD09PXRydWU7CiAgaWYoZnJlc2gpc2NvcmUrPTEwO3F1YWxpdHkucHVzaCh7a2V5OidmcmVzaEhvbGRlcnMnLHZhbHVlOmZyZXNoLHBvaW50czpmcmVzaD8xMDowLG1heFBvaW50czoxMH0pOwogIHJldHVybiB7c2NvcmU6Y2xhbXBTY29yZShzY29yZSkscXVhbGl0eX07Cn0KCmZ1bmN0aW9uIG1ldGFkYXRhS25vd24odD17fSl7CiAgcmV0dXJuIEJvb2xlYW4odC5tZXRhZGF0YVJlYWR5PT09dHJ1ZXx8dC5tZXRhZGF0YUZldGNoZWQ9PT10cnVlfHx0Lm1ldGFkYXRhUmVzb2x2ZWQ9PT10cnVlfHx0Lm5hbWV8fHQuc3ltYm9sfHx0LnVyaXx8dC5tZXRhZGF0YVVyaSk7Cn0KZnVuY3Rpb24gc29jaWFscyh0PXt9KXsKICByZXR1cm4gewogICAgdHdpdHRlcjpmaXJzdFRleHQodC50d2l0dGVyLHQudHdpdHRlclVybCx0LngsdC54VXJsLHQuc29jaWFscz8udHdpdHRlcix0LnNvY2lhbHM/LngpLAogICAgd2Vic2l0ZTpmaXJzdFRleHQodC53ZWJzaXRlLHQud2Vic2l0ZVVybCx0LnNvY2lhbHM/LndlYnNpdGUpLAogICAgdGVsZWdyYW06Zmlyc3RUZXh0KHQudGVsZWdyYW0sdC50ZWxlZ3JhbVVybCx0LnNvY2lhbHM/LnRlbGVncmFtKQogIH07Cn0KCmV4cG9ydCBmdW5jdGlvbiB0b2tlbkFnZU1pbnV0ZXModG9rZW49e30sbm93PURhdGUubm93KCkpewogIGNvbnN0IGNyZWF0ZWQ9Zmlyc3RGaW5pdGUodG9rZW4uY3JlYXRlZEF0LHRva2VuLmRpc2NvdmVyZWRBdCx0b2tlbi5maXJzdFNlZW5BdCx0b2tlbi5zZWVuQXQsdG9rZW4uY3JlYXRlZF9hdCx0b2tlbi5kaXNjb3ZlcmVkX2F0LHRva2VuLnRpbWVzdGFtcCk7CiAgaWYoY3JlYXRlZD09PW51bGx8fGNyZWF0ZWQ8PTApcmV0dXJuIG51bGw7CiAgY29uc3QgbXM9Y3JlYXRlZDwxZTEyP2NyZWF0ZWQqMTAwMDpjcmVhdGVkOwogIHJldHVybiBNYXRoLm1heCgwLChOdW1iZXIobm93KS1tcykvNjAwMDApOwp9CgpleHBvcnQgZnVuY3Rpb24gZXZhbHVhdGUodG9rZW4scz17fSl7CiAgY29uc3QgcmVhc29ucz1bXSxnYXRlcz1bXTtsZXQgd2FpdGluZz1mYWxzZSxibG9ja2VkPWZhbHNlOwogIGNvbnN0IGFkZEdhdGU9KG5hbWUscmVzdWx0LHJlYXNvbixtZXRhPXt9KT0+ewogICAgY29uc3Qgc3RhdHVzPXJlc3VsdD09PW51bGx8fHJlc3VsdD09PXVuZGVmaW5lZD8nV0FJVElORyc6cmVzdWx0PydQQVNTJzonRkFJTCc7CiAgICBnYXRlcy5wdXNoKHtuYW1lLHN0YXR1cyxwYXNzOnN0YXR1cz09PSdQQVNTJywuLi5tZXRhfSk7CiAgICBpZihzdGF0dXM9PT0nV0FJVElORycpe3dhaXRpbmc9dHJ1ZTtyZWFzb25zLnB1c2goJ1dhaXRpbmc6ICcrcmVhc29uKX0KICAgIGVsc2UgaWYoc3RhdHVzPT09J0ZBSUwnKXtibG9ja2VkPXRydWU7cmVhc29ucy5wdXNoKHJlYXNvbil9CiAgfTsKICBjb25zdCBhZGRNaW49KG5hbWUsdmFsdWUsbGltaXQscmVhc29uLHplcm9EaXNhYmxlcz10cnVlKT0+ewogICAgaWYoIWZpbml0ZShsaW1pdCkpcmV0dXJuO2NvbnN0IHg9TnVtYmVyKGxpbWl0KTtpZih6ZXJvRGlzYWJsZXMmJng8PTApcmV0dXJuOwogICAgYWRkR2F0ZShuYW1lLHZhbHVlPT09bnVsbD9udWxsOnZhbHVlPj14LHJlYXNvbix7dmFsdWUsdGhyZXNob2xkOngsb3BlcmF0b3I6Jz49J30pOwogIH07CiAgY29uc3QgYWRkTWF4PShuYW1lLHZhbHVlLGxpbWl0LHJlYXNvbik9PnsKICAgIGlmKCFmaW5pdGUobGltaXQpKXJldHVybjtjb25zdCB4PU51bWJlcihsaW1pdCk7CiAgICBhZGRHYXRlKG5hbWUsdmFsdWU9PT1udWxsP251bGw6dmFsdWU8PXgscmVhc29uLHt2YWx1ZSx0aHJlc2hvbGQ6eCxvcGVyYXRvcjonPD0nfSk7CiAgfTsKCiAgY29uc3QgYWk9aW5kZXBlbmRlbnRBaVNjb3JlKHRva2VuKSxzY29yZT1haS5zY29yZTsKICBjb25zdCBjb21wbGV0ZW5lc3M9WwogICAgZmlyc3RGaW5pdGUodG9rZW4uaG9sZGVyQ291bnQsdG9rZW4uaG9sZGVycyx0b2tlbi5ob2xkZXI/LmNvdW50KSwKICAgIGZpcnN0RmluaXRlKHRva2VuLnRvcDEwUGN0LHRva2VuLnRvcDEwLHRva2VuLmhvbGRlcj8udG9wMTBQY3QpLAogICAgZmlyc3RGaW5pdGUodG9rZW4uZGV2ZWxvcGVyUGN0LHRva2VuLmRldmVsb3BlclNoYXJlUGN0LHRva2VuLmNyZWF0b3JQY3QsdG9rZW4uaG9sZGVyPy5kZXZlbG9wZXJQY3QpLAogICAgZmlyc3RGaW5pdGUodG9rZW4uYnV5UHJlc3N1cmUsdG9rZW4ubW9tZW50dW0sdG9rZW4ubWFya2V0Py5idXlQcmVzc3VyZSksCiAgICBmaXJzdEZpbml0ZSh0b2tlbi5wcmljZVNvbCkKICBdOwogIGNvbnN0IGZhbGxiYWNrPWNvbXBsZXRlbmVzcy5maWx0ZXIodj0+diE9PW51bGwpLmxlbmd0aC9jb21wbGV0ZW5lc3MubGVuZ3RoOwogIGNvbnN0IHN0b3JlZFF1YWxpdHk9ZmluaXRlKHRva2VuLmRhdGFRdWFsaXR5KT9NYXRoLm1heCgwLE1hdGgubWluKDEsTnVtYmVyKHRva2VuLmRhdGFRdWFsaXR5KSkpOjA7CiAgY29uc3QgcT1NYXRoLm1heChzdG9yZWRRdWFsaXR5LGZhbGxiYWNrKTsKICBjb25zdCBjb25maWRlbmNlPWNsYW1wU2NvcmUocSoxMDApOwoKICBjb25zdCB2PXsKICAgIGJvbmRpbmc6Zmlyc3RGaW5pdGUodG9rZW4uYm9uZGluZ0N1cnZlUGN0LHRva2VuLmJvbmRpbmdDdXJ2ZSx0b2tlbi5ib25kaW5nUHJvZ3Jlc3NQY3QsdG9rZW4uY3VydmVQY3QpLAogICAgbWFya2V0Q2FwOmZpcnN0RmluaXRlKHRva2VuLm1hcmtldENhcFVzZCx0b2tlbi5tYXJrZXRDYXBVU0QpLAogICAgZmVlczpmaXJzdEZpbml0ZSh0b2tlbi50b3RhbEZlZXNTb2wsdG9rZW4uZmVlc1NvbCx0b2tlbi50b3RhbEZlZXMpLAogICAgdm9sdW1lOmZpcnN0RmluaXRlKHRva2VuLnZvbHVtZTI0aFVzZCx0b2tlbi52b2x1bWUyNGhVU0QsdG9rZW4udm9sdW1lMjRoKSwKICAgIGJ1eXM6Zmlyc3RGaW5pdGUodG9rZW4uYnV5VHJhbnNhY3Rpb25zLHRva2VuLmJ1eXMsdG9rZW4uYnV5Q291bnQpLAogICAgc2VsbHM6Zmlyc3RGaW5pdGUodG9rZW4uc2VsbFRyYW5zYWN0aW9ucyx0b2tlbi5zZWxscyx0b2tlbi5zZWxsQ291bnQpLAogICAgaG9sZGVyczpmaXJzdEZpbml0ZSh0b2tlbi5ob2xkZXJDb3VudCx0b2tlbi5ob2xkZXJzLHRva2VuLmhvbGRlcj8uY291bnQpLAogICAgYnVuZGxlOmZpcnN0RmluaXRlKHRva2VuLmJ1bmRsZVBjdCx0b2tlbi5idW5kbGVkUGN0LHRva2VuLmJ1bmRsZVBlcmNlbnQpLAogICAgYWdlOnRva2VuQWdlTWludXRlcyh0b2tlbiksCiAgICB0b3AxMDpmaXJzdEZpbml0ZSh0b2tlbi50b3AxMFBjdCx0b2tlbi50b3AxMCx0b2tlbi5ob2xkZXI/LnRvcDEwUGN0KSwKICAgIGRldmVsb3BlcjpmaXJzdEZpbml0ZSh0b2tlbi5kZXZlbG9wZXJQY3QsdG9rZW4uZGV2ZWxvcGVyU2hhcmVQY3QsdG9rZW4uY3JlYXRvclBjdCx0b2tlbi5ob2xkZXI/LmRldmVsb3BlclBjdCksCiAgICBzbmlwZXI6Zmlyc3RGaW5pdGUodG9rZW4uc25pcGVyUGN0LHRva2VuLnNuaXBlcnNQY3QsdG9rZW4uc25pcGVyUGVyY2VudCksCiAgICBsaXF1aWRpdHk6Zmlyc3RGaW5pdGUodG9rZW4ubGlxdWlkaXR5VXNkLHRva2VuLmxpcXVpZGl0eVVTRCksCiAgICBwcmVzc3VyZTpmaXJzdEZpbml0ZSh0b2tlbi5idXlQcmVzc3VyZSx0b2tlbi5tb21lbnR1bSx0b2tlbi5tYXJrZXQ/LmJ1eVByZXNzdXJlKSwKICAgIHByaWNlOmZpcnN0RmluaXRlKHRva2VuLnByaWNlU29sKQogIH07CiAgdi50b3RhbFR4PWZpcnN0RmluaXRlKHRva2VuLnRvdGFsVHJhbnNhY3Rpb25zLHRva2VuLnRyYW5zYWN0aW9ucywodi5idXlzIT09bnVsbCYmdi5zZWxscyE9PW51bGwpP3YuYnV5cyt2LnNlbGxzOm51bGwpOwoKICBhZGRNaW4oJ01pbmltdW0gYm9uZGluZyBjdXJ2ZScsdi5ib25kaW5nLHMubWluQm9uZGluZ0N1cnZlUGN0LGBib25kaW5nIGN1cnZlIGJlbG93ICR7cy5taW5Cb25kaW5nQ3VydmVQY3R9JWApOwogIGFkZE1heCgnTWF4aW11bSBib25kaW5nIGN1cnZlJyx2LmJvbmRpbmcscy5tYXhCb25kaW5nQ3VydmVQY3QsYGJvbmRpbmcgY3VydmUgYWJvdmUgJHtzLm1heEJvbmRpbmdDdXJ2ZVBjdH0lYCk7CiAgYWRkTWluKCdNaW5pbXVtIG1hcmtldCBjYXAnLHYubWFya2V0Q2FwLHMubWluTWFya2V0Q2FwVXNkLGBtYXJrZXQgY2FwIGJlbG93ICQke3MubWluTWFya2V0Q2FwVXNkfWApOwogIGFkZE1heCgnTWF4aW11bSBtYXJrZXQgY2FwJyx2Lm1hcmtldENhcCxzLm1heE1hcmtldENhcFVzZCxgbWFya2V0IGNhcCBhYm92ZSAkJHtzLm1heE1hcmtldENhcFVzZH1gKTsKICBhZGRNaW4oJ01pbmltdW0gdG90YWwgZmVlcycsdi5mZWVzLHMubWluVG90YWxGZWVzU29sLGB0b3RhbCBmZWVzIGJlbG93ICR7cy5taW5Ub3RhbEZlZXNTb2x9IFNPTGApOwogIGFkZE1heCgnTWF4aW11bSB0b3RhbCBmZWVzJyx2LmZlZXMscy5tYXhUb3RhbEZlZXNTb2wsYHRvdGFsIGZlZXMgYWJvdmUgJHtzLm1heFRvdGFsRmVlc1NvbH0gU09MYCk7CiAgYWRkTWluKCdNaW5pbXVtIDI0aCB2b2x1bWUnLHYudm9sdW1lLHMubWluVm9sdW1lMjRoVXNkLGAyNGggdm9sdW1lIGJlbG93ICQke3MubWluVm9sdW1lMjRoVXNkfWApOwogIGFkZE1heCgnTWF4aW11bSAyNGggdm9sdW1lJyx2LnZvbHVtZSxzLm1heFZvbHVtZTI0aFVzZCxgMjRoIHZvbHVtZSBhYm92ZSAkJHtzLm1heFZvbHVtZTI0aFVzZH1gKTsKICBhZGRNaW4oJ01pbmltdW0gYnV5IHRyYW5zYWN0aW9ucycsdi5idXlzLHMubWluQnV5VHJhbnNhY3Rpb25zLGBidXkgdHJhbnNhY3Rpb25zIGJlbG93ICR7cy5taW5CdXlUcmFuc2FjdGlvbnN9YCk7CiAgYWRkTWF4KCdNYXhpbXVtIGJ1eSB0cmFuc2FjdGlvbnMnLHYuYnV5cyxzLm1heEJ1eVRyYW5zYWN0aW9ucyxgYnV5IHRyYW5zYWN0aW9ucyBhYm92ZSAke3MubWF4QnV5VHJhbnNhY3Rpb25zfWApOwogIGFkZE1pbignTWluaW11bSBzZWxsIHRyYW5zYWN0aW9ucycsdi5zZWxscyxzLm1pblNlbGxUcmFuc2FjdGlvbnMsYHNlbGwgdHJhbnNhY3Rpb25zIGJlbG93ICR7cy5taW5TZWxsVHJhbnNhY3Rpb25zfWApOwogIGFkZE1heCgnTWF4aW11bSBzZWxsIHRyYW5zYWN0aW9ucycsdi5zZWxscyxzLm1heFNlbGxUcmFuc2FjdGlvbnMsYHNlbGwgdHJhbnNhY3Rpb25zIGFib3ZlICR7cy5tYXhTZWxsVHJhbnNhY3Rpb25zfWApOwogIGFkZE1pbignTWluaW11bSB0b3RhbCB0cmFuc2FjdGlvbnMnLHYudG90YWxUeCxzLm1pblRvdGFsVHJhbnNhY3Rpb25zLGB0b3RhbCB0cmFuc2FjdGlvbnMgYmVsb3cgJHtzLm1pblRvdGFsVHJhbnNhY3Rpb25zfWApOwogIGFkZE1heCgnTWF4aW11bSB0b3RhbCB0cmFuc2FjdGlvbnMnLHYudG90YWxUeCxzLm1heFRvdGFsVHJhbnNhY3Rpb25zLGB0b3RhbCB0cmFuc2FjdGlvbnMgYWJvdmUgJHtzLm1heFRvdGFsVHJhbnNhY3Rpb25zfWApOwogIGFkZE1pbignTWluaW11bSBob2xkZXJzJyx2LmhvbGRlcnMscy5taW5Ib2xkZXJzLGBob2xkZXJzIGJlbG93ICR7cy5taW5Ib2xkZXJzfWApOwogIGFkZE1heCgnTWF4aW11bSBob2xkZXJzJyx2LmhvbGRlcnMscy5tYXhIb2xkZXJzLGBob2xkZXJzIGFib3ZlICR7cy5tYXhIb2xkZXJzfWApOwogIGFkZE1pbignTWluaW11bSBidW5kbGUnLHYuYnVuZGxlLHMubWluQnVuZGxlUGN0LGBidW5kbGUgYmVsb3cgJHtzLm1pbkJ1bmRsZVBjdH0lYCk7CiAgYWRkTWF4KCdNYXhpbXVtIGJ1bmRsZScsdi5idW5kbGUscy5tYXhCdW5kbGVQY3QsYGJ1bmRsZSBhYm92ZSAke3MubWF4QnVuZGxlUGN0fSVgKTsKICBhZGRNaW4oJ01pbmltdW0gdG9rZW4gYWdlJyx2LmFnZSxzLm1pblRva2VuQWdlTWludXRlcyxgdG9rZW4gYWdlIGJlbG93ICR7cy5taW5Ub2tlbkFnZU1pbnV0ZXN9bWApOwogIGFkZE1heCgnTWF4aW11bSB0b2tlbiBhZ2UnLHYuYWdlLHMubWF4VG9rZW5BZ2VNaW51dGVzLGB0b2tlbiBhZ2UgYWJvdmUgJHtzLm1heFRva2VuQWdlTWludXRlc31tYCk7CiAgYWRkTWluKCdNaW5pbXVtIFRvcC0xMCBjb25jZW50cmF0aW9uJyx2LnRvcDEwLHMubWluVG9wMTBQY3QsYFRvcCAxMCBiZWxvdyAke3MubWluVG9wMTBQY3R9JWApOwogIGFkZE1heCgnTWF4aW11bSBUb3AtMTAgY29uY2VudHJhdGlvbicsdi50b3AxMCxzLm1heFRvcDEwUGN0LGBUb3AgMTAgYWJvdmUgJHtzLm1heFRvcDEwUGN0fSVgKTsKICBhZGRNaW4oJ01pbmltdW0gZGV2ZWxvcGVyIHNoYXJlJyx2LmRldmVsb3BlcixzLm1pbkRldmVsb3BlclBjdCxgZGV2ZWxvcGVyIGJlbG93ICR7cy5taW5EZXZlbG9wZXJQY3R9JWApOwogIGFkZE1heCgnTWF4aW11bSBkZXZlbG9wZXIgc2hhcmUnLHYuZGV2ZWxvcGVyLHMubWF4RGV2ZWxvcGVyUGN0LGBkZXZlbG9wZXIgYWJvdmUgJHtzLm1heERldmVsb3BlclBjdH0lYCk7CiAgYWRkTWluKCdNaW5pbXVtIHNuaXBlciBzaGFyZScsdi5zbmlwZXIscy5taW5TbmlwZXJQY3QsYHNuaXBlciBzaGFyZSBiZWxvdyAke3MubWluU25pcGVyUGN0fSVgKTsKICBhZGRNYXgoJ01heGltdW0gc25pcGVyIHNoYXJlJyx2LnNuaXBlcixzLm1heFNuaXBlclBjdCxgc25pcGVyIHNoYXJlIGFib3ZlICR7cy5tYXhTbmlwZXJQY3R9JWApOwogIGFkZE1pbignTWluaW11bSBsaXF1aWRpdHknLHYubGlxdWlkaXR5LHMubWluTGlxdWlkaXR5VXNkLGBsaXF1aWRpdHkgYmVsb3cgJCR7cy5taW5MaXF1aWRpdHlVc2R9YCk7CiAgYWRkTWluKCdCdXkgcHJlc3N1cmUnLHYucHJlc3N1cmUscy5taW5CdXlQcmVzc3VyZSxgYnV5IHByZXNzdXJlIGJlbG93ICR7cy5taW5CdXlQcmVzc3VyZX14YCk7CgogIGNvbnN0IHNvYz1zb2NpYWxzKHRva2VuKSxrbm93bj1tZXRhZGF0YUtub3duKHRva2VuKTsKICBpZihzLnJlcXVpcmVUd2l0dGVyPT09dHJ1ZSlhZGRHYXRlKCdUd2l0dGVyIC8gWCByZXF1aXJlZCcsa25vd24/Qm9vbGVhbihzb2MudHdpdHRlcik6bnVsbCwnVHdpdHRlciAvIFggaXMgcmVxdWlyZWQnKTsKICBpZihzLnJlcXVpcmVXZWJzaXRlPT09dHJ1ZSlhZGRHYXRlKCdXZWJzaXRlIHJlcXVpcmVkJyxrbm93bj9Cb29sZWFuKHNvYy53ZWJzaXRlKTpudWxsLCd3ZWJzaXRlIGlzIHJlcXVpcmVkJyk7CiAgaWYocy5yZXF1aXJlVGVsZWdyYW09PT10cnVlKWFkZEdhdGUoJ1RlbGVncmFtIHJlcXVpcmVkJyxrbm93bj9Cb29sZWFuKHNvYy50ZWxlZ3JhbSk6bnVsbCwnVGVsZWdyYW0gaXMgcmVxdWlyZWQnKTsKICBpZihzLnJlcXVpcmVBbnlTb2NpYWw9PT10cnVlKWFkZEdhdGUoJ0FueSBzb2NpYWwgcmVxdWlyZWQnLGtub3duP0Jvb2xlYW4oc29jLnR3aXR0ZXJ8fHNvYy53ZWJzaXRlfHxzb2MudGVsZWdyYW0pOm51bGwsJ2F0IGxlYXN0IG9uZSBzb2NpYWwgbGluayBpcyByZXF1aXJlZCcpOwogIGlmKHMucmVxdWlyZVdlYnNpdGVPclg9PT10cnVlKWFkZEdhdGUoJ1dlYnNpdGUgb3IgWCByZXF1aXJlZCcsa25vd24/Qm9vbGVhbihzb2Mud2Vic2l0ZXx8c29jLnR3aXR0ZXIpOm51bGwsJ3dlYnNpdGUgb3IgWCBpcyByZXF1aXJlZCcpOwoKICBjb25zdCBoYXk9W3Rva2VuLm5hbWUsdG9rZW4uc3ltYm9sLHRva2VuLmRlc2NyaXB0aW9uLHRva2VuLm1ldGFkYXRhPy5uYW1lLHRva2VuLm1ldGFkYXRhPy5zeW1ib2wsdG9rZW4ubWV0YWRhdGE/LmRlc2NyaXB0aW9uXS5maWx0ZXIoQm9vbGVhbikuam9pbignICcpLnRvTG93ZXJDYXNlKCk7CiAgY29uc3QgaW5jPWxpc3Qocy5pbmNsdWRlS2V5d29yZHMpOwogIGlmKGluYy5sZW5ndGgpYWRkR2F0ZSgnSW5jbHVkZSBrZXl3b3JkcycsaGF5P2luYy5zb21lKGs9PmhheS5pbmNsdWRlcyhrKSk6bnVsbCxgcmVxdWlyZWQga2V5d29yZCBub3QgZm91bmQgKCR7aW5jLmpvaW4oJywgJyl9KWApOwogIGNvbnN0IGV4Yz1saXN0KHMuZXhjbHVkZUtleXdvcmRzKTsKICBpZihleGMubGVuZ3RoKWFkZEdhdGUoJ0V4Y2x1ZGUga2V5d29yZHMnLCFleGMuc29tZShrPT5oYXkuaW5jbHVkZXMoaykpLCdleGNsdWRlZCBrZXl3b3JkIG1hdGNoZWQnKTsKCiAgY29uc3QgYmw9QXJyYXkuaXNBcnJheShzLmRldmVsb3BlckJsYWNrbGlzdFdhbGxldHMpP3MuZGV2ZWxvcGVyQmxhY2tsaXN0V2FsbGV0cy5tYXAoeD0+U3RyaW5nKHh8fCcnKS50cmltKCkpLmZpbHRlcihCb29sZWFuKTpbXTsKICBpZihibC5sZW5ndGgpewogICAgY29uc3QgY3JlYXRvcj1maXJzdFRleHQodG9rZW4uY3JlYXRvcix0b2tlbi5jcmVhdG9yV2FsbGV0LHRva2VuLmRldmVsb3BlcldhbGxldCx0b2tlbi5kZXZXYWxsZXQsdG9rZW4uZGV2ZWxvcGVyKTsKICAgIGFkZEdhdGUoJ0RldmVsb3BlciBibGFja2xpc3QnLGNyZWF0b3I/IWJsLmluY2x1ZGVzKGNyZWF0b3IpOm51bGwsJ2RldmVsb3BlciB3YWxsZXQgaXMgYmxhY2tsaXN0ZWQnKTsKICB9CgogIGFkZEdhdGUoJ1ZlcmlmaWVkIHByaWNlJyx2LnByaWNlPT09bnVsbD9udWxsOnYucHJpY2U+MCwncHJpY2UgdW5hdmFpbGFibGUnLHt2YWx1ZTp2LnByaWNlfSk7CiAgaWYocy5yZXF1aXJlRnJlc2hIb2xkZXJTbmFwc2hvdD09PXRydWUpYWRkR2F0ZSgnRnJlc2ggaG9sZGVyIHNuYXBzaG90Jyx0b2tlbi5ob2xkZXJGcmVzaD09bnVsbD9udWxsOnRva2VuLmhvbGRlckZyZXNoPT09dHJ1ZSwnaG9sZGVyIHNuYXBzaG90IHVuYXZhaWxhYmxlJyk7CgogIGNvbnN0IG1pblNjb3JlPWZpbml0ZShzLm1pblNjb3JlKT9OdW1iZXIocy5taW5TY29yZSk6bnVsbDsKICBjb25zdCBtaW5Db25maWRlbmNlPWZpbml0ZShzLm1pbkNvbmZpZGVuY2UpP051bWJlcihzLm1pbkNvbmZpZGVuY2UpOm51bGw7CiAgY29uc3Qgc2NvcmVQYXNzPW1pblNjb3JlPT09bnVsbHx8c2NvcmU+PW1pblNjb3JlOwogIGNvbnN0IGNvbmZQYXNzPW1pbkNvbmZpZGVuY2U9PT1udWxsfHxjb25maWRlbmNlPj1taW5Db25maWRlbmNlOwogIGdhdGVzLnB1c2goe25hbWU6J01pbmltdW0gQUkgc2NvcmUnLHN0YXR1czpzY29yZVBhc3M/J1BBU1MnOidGQUlMJyxwYXNzOnNjb3JlUGFzcyx2YWx1ZTpzY29yZSx0aHJlc2hvbGQ6bWluU2NvcmV9KTsKICBpZighc2NvcmVQYXNzKXtibG9ja2VkPXRydWU7cmVhc29ucy5wdXNoKGBBSSBzY29yZSAke3Njb3JlfSBiZWxvdyBjb25maWd1cmVkIG1pbmltdW0gJHttaW5TY29yZX1gKX0KICBnYXRlcy5wdXNoKHtuYW1lOidNaW5pbXVtIGRhdGEgY29uZmlkZW5jZScsc3RhdHVzOmNvbmZQYXNzPydQQVNTJzonRkFJTCcscGFzczpjb25mUGFzcyx2YWx1ZTpjb25maWRlbmNlLHRocmVzaG9sZDptaW5Db25maWRlbmNlfSk7CiAgaWYoIWNvbmZQYXNzKXtibG9ja2VkPXRydWU7cmVhc29ucy5wdXNoKGBkYXRhIGNvbmZpZGVuY2UgJHtjb25maWRlbmNlfSUgYmVsb3cgY29uZmlndXJlZCBtaW5pbXVtICR7bWluQ29uZmlkZW5jZX0lYCl9CgogIGNvbnN0IHN0YXRlPWJsb2NrZWQ/J0JMT0NLRUQnOndhaXRpbmc/J1dBSVRJTkcnOnNjb3JlUGFzcyYmY29uZlBhc3M/J0JVWSBSRUFEWSc6J1dBVENIJzsKICByZXR1cm4gewogICAgc3RhdGUsc2NvcmUsY29uZmlkZW5jZSxkYXRhQ29uZmlkZW5jZTpjb25maWRlbmNlLGNvbmZpZGVuY2VLaW5kOidkYXRhLWNvbXBsZXRlbmVzcycscmVhc29ucywKICAgIHByaW1hcnlSZWFzb246cmVhc29uc1swXXx8J0luZGVwZW5kZW50IEFJIHF1YWxpdHkgYW5kIGFsbCBjb25maWd1cmVkIHVzZXIgZ2F0ZXMgcGFzc2VkJywKICAgIGFpUXVhbGl0eTp7bW9kZWw6J01FTUVGTE9XX0lOREVQRU5ERU5UX0FJX1YxJyxzY29yZSxjb21wb25lbnRzOmFpLnF1YWxpdHl9LAogICAgc2V0dGluZ3NFdmFsdWF0aW9uOnttaW5TY29yZSxtaW5Db25maWRlbmNlLGdhdGVzfQogIH07Cn0K").decode("utf-8")

def log(x): print("[V30.2] "+str(x),flush=True)

def find_root():
    for start in [Path.cwd(),Path.home()/"workspace",Path("/home/runner/workspace"),Path("/workspace")]:
        if not start.exists(): continue
        for p in [start,start/"memeflow-app"]:
            if (p/"app-server.mjs").is_file() and (p/"src/evaluate.mjs").is_file(): return p.resolve()
    for base in [Path("/home/runner/workspace"),Path.cwd()]:
        if not base.exists(): continue
        for p in base.glob("**/app-server.mjs"):
            r=p.parent
            if r.name=="memeflow-app" and (r/"src/evaluate.mjs").is_file(): return r.resolve()
    raise RuntimeError("MEMEFLOW project root not found")

ROOT=find_root()
BACKUP=ROOT/f".v30-2-core-backup-{STAMP}"
BACKUP.mkdir(parents=True,exist_ok=True)
modified=[]

def relative(p): return p.resolve().relative_to(ROOT)
def backup(p):
    if p in modified:return
    d=BACKUP/relative(p);d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,d);modified.append(p)
def write(p,t):
    backup(p);p.write_text(t,encoding="utf-8");log("patched "+str(relative(p)))
def rollback():
    log("ROLLBACK")
    for p in modified:
        b=BACKUP/relative(p)
        if b.exists():shutil.copy2(b,p);log("restored "+str(relative(p)))

def patch_eval():
    p=ROOT/"src/evaluate.mjs"
    if PATCH_ID in p.read_text(encoding="utf-8"):log("evaluate.mjs already patched");return
    write(p,"// "+PATCH_ID+"\n"+EVALUATE_MJS)

def patch_store():
    p=ROOT/"src/store.mjs";t=p.read_text(encoding="utf-8")
    if "MF_V302_DECISIONS_MEMORY_ONLY" in t:log("store.mjs already patched");return
    pat=re.compile(r"(setDecision\(uid,mint,d\)\{.*?if\(m\.size>250\)\{.*?\}\n)\s*this\.save\(\)\n(\s*\})",re.S)
    m=pat.search(t)
    if not m:raise RuntimeError("store.mjs: setDecision save() pattern not found")
    rep=m.group(1)+"    // MF_V302_DECISIONS_MEMORY_ONLY: decisions are memory-only; no state.json save here.\n"+m.group(2)
    write(p,t[:m.start()]+rep+t[m.end():])

def patch_server():
    p=ROOT/"app-server.mjs";t=p.read_text(encoding="utf-8");old=t
    if "SETTINGS_REEVALUATE_LIMIT||250" not in t:
        pat=re.compile(r"(function reevaluateUser\(uid\)\{\s*const settings=store\.settings\(uid\);\s*)const tokens=store\.tokens\(\);")
        t,n=pat.subn(r"\1const tokens=store.tokens().slice(0,Math.max(50,Math.min(500,Number(process.env.SETTINGS_REEVALUATE_LIMIT||250))));",t,count=1)
        if n!=1:raise RuntimeError("app-server.mjs: reevaluateUser pattern not found")
    t=t.replace("const LIVE_EVAL_HOURS=Number(process.env.LIVE_EVALUATION_ACTIVE_USER_HOURS||24);","const LIVE_EVAL_HOURS=Number(process.env.LIVE_EVALUATION_ACTIVE_USER_HOURS||2);")
    t=t.replace("const HOLDER_ADMISSION_ACTIVE_HOURS=Math.max(1,Number(process.env.HOLDER_ADMISSION_ACTIVE_USER_HOURS||24));","const HOLDER_ADMISSION_ACTIVE_HOURS=Math.max(1,Number(process.env.HOLDER_ADMISSION_ACTIVE_USER_HOURS||2));")
    t=t.replace("Promise.resolve(evaluateAI(__u)).catch(()=>{})","Promise.resolve(evaluateAll(__u)).catch(()=>{})")
    if "MF_V302_PAPER_WS_DIRECT" not in t:
        a="  evaluateAI: typeof evaluateAll==='function'?evaluateAll:null\n});"
        b="  evaluateAI: typeof evaluateAll==='function'?evaluateAll:null,\n  // MF_V302_PAPER_WS_DIRECT\n  onTokenUpdate:(mint,updated)=>{try{paper.onTokenUpdate(mint,updated||store.state.tokens[mint])}catch{}}\n});"
        if a not in t:raise RuntimeError("app-server.mjs: live feed options pattern not found")
        t=t.replace(a,b,1)
    if t!=old:write(p,t)
    else:log("app-server.mjs already patched")

def patch_feed():
    p=ROOT/"src/pump-live-trade-feed.mjs";t=p.read_text(encoding="utf-8");old=t
    t=t.replace("const {eventHolderLedger,store,publish,evaluateAI}=opts;","const {eventHolderLedger,store,publish,evaluateAI,onTokenUpdate}=opts;",1)
    t=t.replace("const VERSION='V12.22';","const VERSION='V12.22+V30.2';",1)
    if "MF_V302_SINGLE_EVAL_PER_TRADE_EVENT" not in t:
        s=t.find("  function applyEvent(e){");e=t.find("\n  async function connect(){",s)
        if s<0 or e<0:raise RuntimeError("pump-live-trade-feed.mjs: applyEvent block not found")
        block=r'''  function applyEvent(e){
    // MF_V302_SINGLE_EVAL_PER_TRADE_EVENT
    metrics.tradeEventsDecoded++;
    metrics.lastMint=e.mint;
    metrics.lastUser=e.user;
    users.add(e.user);metrics.distinctUsers=users.size;
    const prev=mintCounts.get(e.mint)||0;
    mintCounts.set(e.mint,prev+1);
    if(prev>0)metrics.repeatTradeEvents++;
    metrics.distinctMints=mintCounts.size;
    let updatedForEval=null;

    try{
      const token=tokenFromStore(store,e.mint);
      const creator=token?.creator||token?.developer||token?.creatorWallet||null;
      if(creator)eventHolderLedger?.setCreator?.(e.mint,creator);
    }catch{}

    try{
      const snap=eventHolderLedger?.ingestTradeEventDirect?.(e);
      if(snap){
        metrics.holderSnapshots++;
        const updated=eventHolderLedger?.applyToStore?.(store,e.mint);
        if(updated)updatedForEval=updated;
      }
    }catch(err){metrics.lastError='holder:'+String(err?.message||err)}

    try{
      const m=marketFromEvent(e),buyPressure=updatePressure(e);
      const patch={marketSource:'ws-direct-trade-event',buyPressure,lastPriceAt:Date.now()};
      if(Number.isFinite(m.priceSol)&&m.priceSol>0)patch.priceSol=m.priceSol;
      if(Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0)patch.liquiditySol=m.liquiditySol;
      const updated=store?.setToken?.(e.mint,patch);
      if(updated){metrics.marketSnapshots++;updatedForEval=updated}
    }catch(err){metrics.lastError='market:'+String(err?.message||err)}

    if(updatedForEval){
      try{__v1226Evaluate(updatedForEval,e.mint,'trade-event')}catch{}
      try{onTokenUpdate?.(e.mint,updatedForEval)}catch{}
      try{publish?.(e.mint)}catch{}
    }
  }
'''
        t=t[:s]+block+t[e:]
    if t!=old:write(p,t)
    else:log("pump-live-trade-feed.mjs already patched")

def patch_paper():
    p=ROOT/"src/paper-engine.mjs";t=p.read_text(encoding="utf-8");old=t
    if "requireFreshHolderSnapshot: settings.requireFreshHolderSnapshot !== false" not in t:
        a="      exitOnWeakBuyPressure: settings.exitOnWeakBuyPressure !== false,\n"
        if a not in t:raise RuntimeError("paper-engine.mjs: settings anchor not found")
        t=t.replace(a,a+"      requireFreshHolderSnapshot: settings.requireFreshHolderSnapshot !== false,\n",1)
    t=t.replace("    const dataFresh = holderFresh && decisionFresh;","    const holderRequirementSatisfied = !s.requireFreshHolderSnapshot || holderFresh;\n    const dataFresh = holderRequirementSatisfied && decisionFresh;",1)
    t=t.replace("        code: holderFresh\n          ? 'STALE_DECISION'\n          : 'STALE_TOKEN_DATA'\n","        code: !decisionFresh\n          ? 'STALE_DECISION'\n          : 'STALE_TOKEN_DATA'\n",1)
    a="    const settings = this.settings(position.settingsSnapshot || {});"
    b="    // MF_V302_LIVE_EXIT_SETTINGS\n    const currentUserSettings=this.store.state.users?.[position.userId]?.settings||{};\n    const settings=this.settings({...position.settingsSnapshot,...currentUserSettings});"
    if a in t:t=t.replace(a,b,1)
    if t!=old:write(p,t)
    else:log("paper-engine.mjs already patched")

def patch_settings():
    p=ROOT/"src/settings.mjs";t=p.read_text(encoding="utf-8")
    n=t.replace("Minimum confidence must be between 0 and 100.","Minimum data confidence must be between 0 and 100.")
    if n!=t:write(p,n)

def patch_trading():
    files=[]
    if (ROOT/"trading.js").is_file():files.append(ROOT/"trading.js")
    for p in ROOT.glob("*trading*.js"):
        if p.is_file() and p not in files:files.append(p)
    if not files:log("trading.js not found; frontend fixes skipped");return
    for p in files:
        t=p.read_text(encoding="utf-8")
        if "/api/ai/decisions" not in t:continue
        old=t
        t=t.replace("scope=candidates","scope=all")
        t=t.replace("maxPositionSize: Math.max(num(state.settings.maxPositionSize, sizeSol), sizeSol)","maxPositionSize: num(state.settings.maxPositionSize, 0.5)")
        if t!=old:write(p,t)
        else:log(str(relative(p))+" already clean")

def checks():
    files=[ROOT/"app-server.mjs",ROOT/"src/evaluate.mjs",ROOT/"src/store.mjs",ROOT/"src/paper-engine.mjs",ROOT/"src/pump-live-trade-feed.mjs"]
    if (ROOT/"trading.js").is_file():files.append(ROOT/"trading.js")
    for p in files:
        r=subprocess.run(["node","--check",str(p)],cwd=ROOT,capture_output=True,text=True)
        if r.returncode:raise RuntimeError("node --check failed for "+str(relative(p))+"\n"+(r.stderr or r.stdout))
        log("syntax OK "+str(relative(p)))
    smoke=r'''
import {evaluate} from './src/evaluate.mjs';
const t={mint:'Tpump',name:'T',symbol:'T',discoveredAt:Date.now()-60000,holderCount:100,top10Pct:10,developerPct:2,buyPressure:2,priceSol:0.000001,holderFresh:true,liquidityUsd:50000,marketCapUsd:100000,dataQuality:.9};
const s={minScore:72,minConfidence:70,minHolders:30,maxTop10Pct:25,maxDeveloperPct:20,minBuyPressure:1.2,minLiquidityUsd:1000,maxTokenAgeMinutes:180,requireFreshHolderSnapshot:true};
const a=evaluate(t,s);if(a.state!=='BUY READY')throw Error('BUY READY smoke failed '+a.state+' '+a.reasons.join('|'));
const b=evaluate({...t,developerPct:40},s);if(b.state!=='BLOCKED')throw Error('BLOCKED smoke failed '+b.state);
const c=evaluate({...t,holderFresh:false},{...s,requireFreshHolderSnapshot:false});if(c.state==='WAITING')throw Error('fresh-holder toggle failed');
console.log(JSON.stringify({buy:a.state,blocked:b.state,noFresh:c.state,confidence:a.confidence}));
'''
    r=subprocess.run(["node","--input-type=module","-e",smoke],cwd=ROOT,capture_output=True,text=True)
    if r.returncode:raise RuntimeError("evaluator smoke failed\n"+(r.stderr or r.stdout))
    log("smoke OK "+r.stdout.strip())

try:
    log("root "+str(ROOT))
    patch_eval();patch_store();patch_server();patch_feed();patch_paper();patch_settings();patch_trading();checks()
    log("INSTALL COMPLETE")
    log("backup "+str(BACKUP))
    log("Restart Replit app/workflow now.")
except Exception as e:
    log("ERROR "+str(e))
    try:rollback()
    except Exception as rb:log("ROLLBACK ERROR "+str(rb))
    sys.exit(1)
