from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from schemas import PenTypeCreate, PenTypeUpdate, PenTypeResponse
import crud

router = APIRouter(prefix="/api/pen-types", tags=["pen-types"])


@router.get("", response_model=list[PenTypeResponse])
def list_pen_types(db: Session = Depends(get_db)):
    """Get all pen types."""
    return crud.get_pen_types(db)


@router.get("/{pen_type_id}", response_model=PenTypeResponse)
def get_pen_type(pen_type_id: str, db: Session = Depends(get_db)):
    """Get a single pen type by ID."""
    db_pen_type = crud.get_pen_type(db, pen_type_id)
    if db_pen_type is None:
        raise HTTPException(status_code=404, detail="Pen type not found")
    return db_pen_type


@router.post("", response_model=PenTypeResponse, status_code=201)
def create_pen_type(pen_type: PenTypeCreate, db: Session = Depends(get_db)):
    """Create a new pen type."""
    # Check if ID already exists
    existing = crud.get_pen_type(db, pen_type.id)
    if existing:
        raise HTTPException(status_code=400, detail="Pen type with this ID already exists")
    return crud.create_pen_type(db, pen_type)


@router.put("/{pen_type_id}", response_model=PenTypeResponse)
def update_pen_type(pen_type_id: str, pen_type: PenTypeUpdate, db: Session = Depends(get_db)):
    """Update an existing pen type."""
    db_pen_type = crud.update_pen_type(db, pen_type_id, pen_type)
    if db_pen_type is None:
        raise HTTPException(status_code=404, detail="Pen type not found")
    return db_pen_type


@router.delete("/{pen_type_id}", status_code=204)
def delete_pen_type(pen_type_id: str, db: Session = Depends(get_db)):
    """Delete a pen type."""
    success = crud.delete_pen_type(db, pen_type_id)
    if not success:
        raise HTTPException(status_code=404, detail="Pen type not found")
