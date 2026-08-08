"""
Bhasha Node - System Telemetry Router
Real-time CPU, RAM, and disk metrics for the frontend dashboard.
"""
from fastapi import APIRouter
from services.system_engine import SystemService

router = APIRouter(prefix="/api/system", tags=["system"])

_system: SystemService | None = None


def init(system_service: SystemService):
    global _system
    _system = system_service


@router.get("/stats")
async def get_stats():
    """Returns live system telemetry."""
    return _system.get_stats()
