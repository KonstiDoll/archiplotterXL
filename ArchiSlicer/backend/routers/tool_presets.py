from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from schemas import ToolPresetCreate, ToolPresetUpdate, ToolPresetResponse
import crud

router = APIRouter(prefix="/tool-presets", tags=["tool-presets"])


@router.get("/", response_model=list[ToolPresetResponse])
def list_tool_presets(db: Session = Depends(get_db)):
    """Get all tool presets."""
    return crud.get_tool_presets(db)


@router.get("/{preset_id}", response_model=ToolPresetResponse)
def get_tool_preset(preset_id: int, db: Session = Depends(get_db)):
    """Get a single tool preset by ID."""
    preset = crud.get_tool_preset(db, preset_id)
    if preset is None:
        raise HTTPException(status_code=404, detail="Tool preset not found")
    return preset


@router.post("/", response_model=ToolPresetResponse, status_code=201)
def create_tool_preset(preset: ToolPresetCreate, db: Session = Depends(get_db)):
    """Create a new tool preset."""
    # Check if name already exists
    existing = crud.get_tool_preset_by_name(db, preset.name)
    if existing:
        raise HTTPException(status_code=400, detail="Preset with this name already exists")
    return crud.create_tool_preset(db, preset)


@router.put("/{preset_id}", response_model=ToolPresetResponse)
def update_tool_preset(preset_id: int, preset: ToolPresetUpdate, db: Session = Depends(get_db)):
    """Update an existing tool preset."""
    # Check if new name conflicts with existing preset
    if preset.name is not None:
        existing = crud.get_tool_preset_by_name(db, preset.name)
        if existing and existing.id != preset_id:
            raise HTTPException(status_code=400, detail="Preset with this name already exists")

    updated = crud.update_tool_preset(db, preset_id, preset)
    if updated is None:
        raise HTTPException(status_code=404, detail="Tool preset not found")
    return updated


@router.delete("/{preset_id}", status_code=204)
def delete_tool_preset(preset_id: int, db: Session = Depends(get_db)):
    """Delete a tool preset."""
    if not crud.delete_tool_preset(db, preset_id):
        raise HTTPException(status_code=404, detail="Tool preset not found")
