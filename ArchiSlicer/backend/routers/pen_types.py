from fastapi import APIRouter, Depends, HTTPException

from database import get_pen_type_repository
from repositories import PenTypeRepository
from schemas import PenTypeCreate, PenTypeResponse, PenTypeUpdate

router = APIRouter(prefix="/api/pen-types", tags=["pen-types"])


@router.get("", response_model=list[PenTypeResponse])
def list_pen_types(
    repo: PenTypeRepository = Depends(get_pen_type_repository),
):
    """Get all pen types."""
    return repo.get_all()


@router.get("/{pen_type_id}", response_model=PenTypeResponse)
def get_pen_type(
    pen_type_id: str,
    repo: PenTypeRepository = Depends(get_pen_type_repository),
):
    """Get a single pen type by ID."""
    db_pen_type = repo.get_by_id(pen_type_id)
    if db_pen_type is None:
        raise HTTPException(status_code=404, detail="Pen type not found")
    return db_pen_type


@router.post("", response_model=PenTypeResponse, status_code=201)
def create_pen_type(
    pen_type: PenTypeCreate,
    repo: PenTypeRepository = Depends(get_pen_type_repository),
):
    """Create a new pen type."""
    existing = repo.get_by_id(pen_type.id)
    if existing:
        raise HTTPException(status_code=400, detail="Pen type with this ID already exists")
    return repo.create(pen_type)


@router.put("/{pen_type_id}", response_model=PenTypeResponse)
def update_pen_type(
    pen_type_id: str,
    pen_type: PenTypeUpdate,
    repo: PenTypeRepository = Depends(get_pen_type_repository),
):
    """Update an existing pen type."""
    db_pen_type = repo.update(pen_type_id, pen_type)
    if db_pen_type is None:
        raise HTTPException(status_code=404, detail="Pen type not found")
    return db_pen_type


@router.delete("/{pen_type_id}", status_code=204)
def delete_pen_type(
    pen_type_id: str,
    repo: PenTypeRepository = Depends(get_pen_type_repository),
):
    """Delete a pen type."""
    success = repo.delete(pen_type_id)
    if not success:
        raise HTTPException(status_code=404, detail="Pen type not found")
