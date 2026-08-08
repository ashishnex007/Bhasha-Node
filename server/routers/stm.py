"""
Bhasha Node - STM Router
Manages Semantic Translation Memory dictionary terms.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from services.stm_engine import STMService

router = APIRouter(prefix="/api/stm", tags=["stm"])

# Lazy reference — will be set by main.py at startup
_stm: STMService | None = None


def init(stm_service: STMService):
    global _stm
    _stm = stm_service


class AddTermRequest(BaseModel):
    source_term: str
    target_term: str
    target_language: str
    domain: str = "agriculture"


@router.get("/terms")
async def get_terms(target_language: str = ""):
    """List all STM dictionary terms."""
    return {"terms": _stm.get_terms(target_language)}


@router.post("/terms")
async def add_term(request: AddTermRequest):
    """Add a new domain term correction."""
    _stm.add_term(request.source_term, request.target_term, request.target_language, request.domain)
    return {"status": "added"}


@router.delete("/terms/{term_id}")
async def delete_term(term_id: int):
    """Remove a term from the STM dictionary."""
    _stm.delete_term(term_id)
    return {"status": "deleted", "id": term_id}
