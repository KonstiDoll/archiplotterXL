from sqlalchemy.orm import Session
from models import PenType, ToolPreset, Project, ProjectVersion
from schemas import (
    PenTypeCreate, PenTypeUpdate,
    ToolPresetCreate, ToolPresetUpdate,
    ProjectCreate, ProjectUpdate
)


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


# --- Project CRUD ---

def get_projects(db: Session) -> list[Project]:
    """Get all projects (ordered by updated_at descending)."""
    return db.query(Project).order_by(Project.updated_at.desc()).all()


def get_project(db: Session, project_id: int) -> Project | None:
    """Get a single project by ID."""
    return db.query(Project).filter(Project.id == project_id).first()


def create_project(db: Session, project: ProjectCreate) -> Project:
    """Create a new project."""
    db_project = Project(
        name=project.name,
        description=project.description,
        project_data=project.project_data
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


def update_project(db: Session, project_id: int, project: ProjectUpdate) -> Project | None:
    """Update an existing project. Creates a version snapshot before updating."""
    db_project = get_project(db, project_id)
    if db_project is None:
        return None

    # If project_data is being updated, archive current version first
    if project.project_data is not None:
        # Create version snapshot of current state
        db_version = ProjectVersion(
            project_id=db_project.id,
            version=db_project.current_version,
            project_data=db_project.project_data
        )
        db.add(db_version)
        # Increment version number
        db_project.current_version += 1

    if project.name is not None:
        db_project.name = project.name
    if project.description is not None:
        db_project.description = project.description
    if project.project_data is not None:
        db_project.project_data = project.project_data

    db.commit()
    db.refresh(db_project)
    return db_project


def delete_project(db: Session, project_id: int) -> bool:
    """Delete a project and all its versions. Returns True if deleted, False if not found."""
    db_project = get_project(db, project_id)
    if db_project is None:
        return False

    # Delete all versions first
    db.query(ProjectVersion).filter(ProjectVersion.project_id == project_id).delete()
    db.delete(db_project)
    db.commit()
    return True


# --- Project Version CRUD ---

def get_project_versions(db: Session, project_id: int) -> list[ProjectVersion]:
    """Get all versions of a project (ordered by version descending)."""
    return db.query(ProjectVersion).filter(
        ProjectVersion.project_id == project_id
    ).order_by(ProjectVersion.version.desc()).all()


def get_project_version(db: Session, project_id: int, version: int) -> ProjectVersion | None:
    """Get a specific version of a project."""
    return db.query(ProjectVersion).filter(
        ProjectVersion.project_id == project_id,
        ProjectVersion.version == version
    ).first()


def restore_project_version(db: Session, project_id: int, version: int) -> Project | None:
    """Restore a project to a previous version. Archives current state first."""
    db_project = get_project(db, project_id)
    if db_project is None:
        return None

    db_version = get_project_version(db, project_id, version)
    if db_version is None:
        return None

    # Archive current state before restoring
    archive_version = ProjectVersion(
        project_id=db_project.id,
        version=db_project.current_version,
        project_data=db_project.project_data
    )
    db.add(archive_version)

    # Restore old data and increment version
    db_project.project_data = db_version.project_data
    db_project.current_version += 1

    db.commit()
    db.refresh(db_project)
    return db_project
