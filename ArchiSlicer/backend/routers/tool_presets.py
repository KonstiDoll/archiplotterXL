from fastapi import APIRouter, Depends, HTTPException

from database import get_tool_preset_repository
from repositories import ToolPresetRepository
from schemas import ToolPresetCreate, ToolPresetResponse, ToolPresetUpdate

router = APIRouter(prefix="/api/tool-presets", tags=["tool-presets"])


@router.get("", response_model=list[ToolPresetResponse])
def list_tool_presets(
    repo: ToolPresetRepository = Depends(get_tool_preset_repository),
):
    """Get all tool presets."""
    return repo.get_all()


@router.get("/{preset_id}", response_model=ToolPresetResponse)
def get_tool_preset(
    preset_id: int,
    repo: ToolPresetRepository = Depends(get_tool_preset_repository),
):
    """Get a single tool preset by ID."""
    preset = repo.get_by_id(preset_id)
    if preset is None:
        raise HTTPException(status_code=404, detail="Tool preset not found")
    return preset


@router.post("", response_model=ToolPresetResponse, status_code=201)
def create_tool_preset(
    preset: ToolPresetCreate,
    repo: ToolPresetRepository = Depends(get_tool_preset_repository),
):
    """Create a new tool preset."""
    existing = repo.get_by_name(preset.name)
    if existing:
        raise HTTPException(status_code=400, detail="Preset with this name already exists")
    return repo.create(preset)


@router.put("/{preset_id}", response_model=ToolPresetResponse)
def update_tool_preset(
    preset_id: int,
    preset: ToolPresetUpdate,
    repo: ToolPresetRepository = Depends(get_tool_preset_repository),
):
    """Update an existing tool preset."""
    if preset.name is not None:
        existing = repo.get_by_name(preset.name)
        if existing and existing.id != preset_id:
            raise HTTPException(status_code=400, detail="Preset with this name already exists")

    updated = repo.update(preset_id, preset)
    if updated is None:
        raise HTTPException(status_code=404, detail="Tool preset not found")
    return updated


@router.delete("/{preset_id}", status_code=204)
def delete_tool_preset(
    preset_id: int,
    repo: ToolPresetRepository = Depends(get_tool_preset_repository),
):
    """Delete a tool preset."""
    if not repo.delete(preset_id):
        raise HTTPException(status_code=404, detail="Tool preset not found")
