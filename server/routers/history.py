"""
Bhasha Node - History Router
Provides CRUD endpoints for inference history.
"""
from fastapi import APIRouter
from db.database import db

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
async def get_history(limit: int = 50, offset: int = 0):
    """Retrieve inference history with pagination."""
    items = db.get_history(limit=limit, offset=offset)
    total = db.get_history_count()
    return {"items": items, "total": total}


@router.delete("/{inference_id}")
async def delete_inference(inference_id: int):
    """Delete a single inference record."""
    db.delete_inference(inference_id)
    return {"status": "deleted", "id": inference_id}
