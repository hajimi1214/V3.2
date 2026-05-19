from __future__ import annotations

import time

SERVER_START_TIME = time.time()
PLATFORM_LAUNCH_TEXT = "2026-03-05 09:46:00"
PLATFORM_LAUNCH_TS = time.mktime(time.strptime(PLATFORM_LAUNCH_TEXT, "%Y-%m-%d %H:%M:%S"))

def platform_runtime_text() -> str:
    total = max(0, int(time.time() - PLATFORM_LAUNCH_TS))
    days, rem = divmod(total, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, seconds = divmod(rem, 60)
    return f"{days}天 {hours:02d}:{minutes:02d}:{seconds:02d}"

def now_text() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")
