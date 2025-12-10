from sqlalchemy.orm import Session
from models import PenType, ToolPreset
from schemas import PenTypeCreate, PenTypeUpdate, ToolPresetCreate, ToolPresetUpdate


def get_pen_types(db: Session) -> list[PenType]:
    """Get all pen types."""
    return db.query(PenType).all()


def get_pen_type(db: Session, pen_type_id: str) -> PenType | None:
    """Get a single pen type by ID."""
    return db.query(PenType).filter(PenType.id == pen_type_id).first()


def create_pen_type(db: Session, pen_type: PenTypeCreate) -> PenType:
    """Create a new pen type."""
    db_pen_type = PenType(**pen_type.model_dump())
    db.add(db_pen_type)
    db.commit()
    db.refresh(db_pen_type)
    return db_pen_type


def update_pen_type(db: Session, pen_type_id: str, pen_type: PenTypeUpdate) -> PenType | None:
    """Update an existing pen type."""
    db_pen_type = get_pen_type(db, pen_type_id)
    if db_pen_type is None:
        return None

    update_data = pen_type.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_pen_type, key, value)

    db.commit()
    db.refresh(db_pen_type)
    return db_pen_type


def delete_pen_type(db: Session, pen_type_id: str) -> bool:
    """Delete a pen type. Returns True if deleted, False if not found."""
    db_pen_type = get_pen_type(db, pen_type_id)
    if db_pen_type is None:
        return False

    db.delete(db_pen_type)
    db.commit()
    return True


# --- Tool Preset CRUD ---

def get_tool_presets(db: Session) -> list[ToolPreset]:
    """Get all tool presets."""
    return db.query(ToolPreset).all()


def get_tool_preset(db: Session, preset_id: int) -> ToolPreset | None:
    """Get a single tool preset by ID."""
    return db.query(ToolPreset).filter(ToolPreset.id == preset_id).first()


def get_tool_preset_by_name(db: Session, name: str) -> ToolPreset | None:
    """Get a tool preset by name."""
    return db.query(ToolPreset).filter(ToolPreset.name == name).first()


def create_tool_preset(db: Session, preset: ToolPresetCreate) -> ToolPreset:
    """Create a new tool preset."""
    # Convert Pydantic models to dicts for JSON storage
    tool_configs_data = [tc.model_dump() for tc in preset.tool_configs]
    db_preset = ToolPreset(name=preset.name, tool_configs=tool_configs_data)
    db.add(db_preset)
    db.commit()
    db.refresh(db_preset)
    return db_preset


def update_tool_preset(db: Session, preset_id: int, preset: ToolPresetUpdate) -> ToolPreset | None:
    """Update an existing tool preset."""
    db_preset = get_tool_preset(db, preset_id)
    if db_preset is None:
        return None

    if preset.name is not None:
        db_preset.name = preset.name
    if preset.tool_configs is not None:
        db_preset.tool_configs = [tc.model_dump() for tc in preset.tool_configs]

    db.commit()
    db.refresh(db_preset)
    return db_preset


def delete_tool_preset(db: Session, preset_id: int) -> bool:
    """Delete a tool preset. Returns True if deleted, False if not found."""
    db_preset = get_tool_preset(db, preset_id)
    if db_preset is None:
        return False

    db.delete(db_preset)
    db.commit()
    return True
