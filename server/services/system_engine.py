"""
Bhasha Node - System Telemetry Engine
Provides real-time CPU, RAM, and disk usage for the frontend dashboard.
"""
import os
import platform

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


class SystemService:
    """Collects live system resource telemetry."""

    def __init__(self):
        if HAS_PSUTIL:
            print("[LOAD] System Telemetry Engine (psutil) ready.")
        else:
            print("[WARN] psutil not installed. Telemetry will return mock data.")

    def get_stats(self) -> dict:
        if not HAS_PSUTIL:
            return self._mock_stats()

        try:
            mem = psutil.virtual_memory()

            # Windows needs a drive letter; Linux/Mac uses "/"
            disk_path = os.environ.get("SystemDrive", "C:\\") if platform.system() == "Windows" else "/"
            disk = psutil.disk_usage(disk_path)

            return {
                "cpu_percent": psutil.cpu_percent(interval=0.3),
                "ram_used_gb": round(mem.used / (1024 ** 3), 1),
                "ram_total_gb": round(mem.total / (1024 ** 3), 1),
                "ram_percent": mem.percent,
                "disk_used_gb": round(disk.used / (1024 ** 3), 1),
                "disk_total_gb": round(disk.total / (1024 ** 3), 1),
                "disk_percent": round(disk.percent, 1),
            }
        except Exception as e:
            print(f"[WARN] Telemetry collection failed: {e}")
            return self._mock_stats()

    def _mock_stats(self) -> dict:
        return {
            "cpu_percent": 0.0,
            "ram_used_gb": 0.0,
            "ram_total_gb": 16.0,
            "ram_percent": 0.0,
            "disk_used_gb": 0.0,
            "disk_total_gb": 0.0,
            "disk_percent": 0.0,
        }
