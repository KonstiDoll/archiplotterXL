"""
SQLAlchemy implementations of repository interfaces.

These classes wrap SQLAlchemy session operations and implement
the repository protocols defined in repositories/__init__.py.
"""

from sqlalchemy.orm import Session

from models import PenType, Project, ProjectVersion, ToolPreset
from schemas import (
    PenTypeCreate,
    PenTypeUpdate,
    ProjectCreate,
    ProjectUpdate,
    ToolPresetCreate,
    ToolPresetUpdate,
)


class SQLAlchemyPenTypeRepository:
    """SQLAlchemy implementation of PenTypeRepository."""

    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> list[PenType]:
        """Get all pen types."""
        return self.db.query(PenType).all()

    def get_by_id(self, pen_type_id: str) -> PenType | None:
        """Get a single pen type by ID."""
        return self.db.query(PenType).filter(PenType.id == pen_type_id).first()

    def create(self, pen_type: PenTypeCreate) -> PenType:
        """Create a new pen type."""
        db_pen_type = PenType(**pen_type.model_dump())
        self.db.add(db_pen_type)
        self.db.commit()
        self.db.refresh(db_pen_type)
        return db_pen_type

    def update(self, pen_type_id: str, pen_type: PenTypeUpdate) -> PenType | None:
        """Update an existing pen type."""
        db_pen_type = self.get_by_id(pen_type_id)
        if db_pen_type is None:
            return None

        update_data = pen_type.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_pen_type, key, value)

        self.db.commit()
        self.db.refresh(db_pen_type)
        return db_pen_type

    def delete(self, pen_type_id: str) -> bool:
        """Delete a pen type. Returns True if deleted, False if not found."""
        db_pen_type = self.get_by_id(pen_type_id)
        if db_pen_type is None:
            return False

        self.db.delete(db_pen_type)
        self.db.commit()
        return True


class SQLAlchemyToolPresetRepository:
    """SQLAlchemy implementation of ToolPresetRepository."""

    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> list[ToolPreset]:
        """Get all tool presets."""
        return self.db.query(ToolPreset).all()

    def get_by_id(self, preset_id: int) -> ToolPreset | None:
        """Get a single tool preset by ID."""
        return self.db.query(ToolPreset).filter(ToolPreset.id == preset_id).first()

    def get_by_name(self, name: str) -> ToolPreset | None:
        """Get a tool preset by name."""
        return self.db.query(ToolPreset).filter(ToolPreset.name == name).first()

    def create(self, preset: ToolPresetCreate) -> ToolPreset:
        """Create a new tool preset."""
        tool_configs_data = [tc.model_dump() for tc in preset.tool_configs]
        db_preset = ToolPreset(name=preset.name, tool_configs=tool_configs_data)
        self.db.add(db_preset)
        self.db.commit()
        self.db.refresh(db_preset)
        return db_preset

    def update(self, preset_id: int, preset: ToolPresetUpdate) -> ToolPreset | None:
        """Update an existing tool preset."""
        db_preset = self.get_by_id(preset_id)
        if db_preset is None:
            return None

        if preset.name is not None:
            db_preset.name = preset.name
        if preset.tool_configs is not None:
            db_preset.tool_configs = [tc.model_dump() for tc in preset.tool_configs]

        self.db.commit()
        self.db.refresh(db_preset)
        return db_preset

    def delete(self, preset_id: int) -> bool:
        """Delete a tool preset. Returns True if deleted, False if not found."""
        db_preset = self.get_by_id(preset_id)
        if db_preset is None:
            return False

        self.db.delete(db_preset)
        self.db.commit()
        return True


class SQLAlchemyProjectRepository:
    """SQLAlchemy implementation of ProjectRepository."""

    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> list[Project]:
        """Get all projects (ordered by updated_at descending)."""
        return self.db.query(Project).order_by(Project.updated_at.desc()).all()

    def get_by_id(self, project_id: int) -> Project | None:
        """Get a single project by ID."""
        return self.db.query(Project).filter(Project.id == project_id).first()

    def create(self, project: ProjectCreate) -> Project:
        """Create a new project."""
        db_project = Project(
            name=project.name, description=project.description, project_data=project.project_data
        )
        self.db.add(db_project)
        self.db.commit()
        self.db.refresh(db_project)
        return db_project

    def update(self, project_id: int, project: ProjectUpdate) -> Project | None:
        """Update an existing project. Creates a version snapshot before updating."""
        db_project = self.get_by_id(project_id)
        if db_project is None:
            return None

        # If project_data is being updated, archive current version first
        if project.project_data is not None:
            db_version = ProjectVersion(
                project_id=db_project.id,
                version=db_project.current_version,
                project_data=db_project.project_data,
                message=project.version_message,
            )
            self.db.add(db_version)
            db_project.current_version += 1

        if project.name is not None:
            db_project.name = project.name
        if project.description is not None:
            db_project.description = project.description
        if project.project_data is not None:
            db_project.project_data = project.project_data

        self.db.commit()
        self.db.refresh(db_project)
        return db_project

    def delete(self, project_id: int) -> bool:
        """Delete a project and all its versions."""
        db_project = self.get_by_id(project_id)
        if db_project is None:
            return False

        # Delete all versions first
        self.db.query(ProjectVersion).filter(ProjectVersion.project_id == project_id).delete()
        self.db.delete(db_project)
        self.db.commit()
        return True

    def get_versions(self, project_id: int) -> list[ProjectVersion]:
        """Get all versions of a project (ordered by version descending)."""
        return (
            self.db.query(ProjectVersion)
            .filter(ProjectVersion.project_id == project_id)
            .order_by(ProjectVersion.version.desc())
            .all()
        )

    def get_version(self, project_id: int, version: int) -> ProjectVersion | None:
        """Get a specific version of a project."""
        return (
            self.db.query(ProjectVersion)
            .filter(ProjectVersion.project_id == project_id, ProjectVersion.version == version)
            .first()
        )

    def restore_version(self, project_id: int, version: int) -> Project | None:
        """Restore a project to a previous version. Archives current state first."""
        db_project = self.get_by_id(project_id)
        if db_project is None:
            return None

        db_version = self.get_version(project_id, version)
        if db_version is None:
            return None

        # Archive current state before restoring
        archive_version = ProjectVersion(
            project_id=db_project.id,
            version=db_project.current_version,
            project_data=db_project.project_data,
            message=f"Vor Wiederherstellung von v{version}",
        )
        self.db.add(archive_version)

        # Restore old data and increment version
        db_project.project_data = db_version.project_data
        db_project.current_version += 1

        self.db.commit()
        self.db.refresh(db_project)
        return db_project


__all__ = [
    "SQLAlchemyPenTypeRepository",
    "SQLAlchemyToolPresetRepository",
    "SQLAlchemyProjectRepository",
]
