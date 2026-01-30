"""
In-memory implementations of repository interfaces.

These implementations are useful for testing, as they don't require
a database connection and can be easily reset between tests.
"""

import copy
from datetime import datetime

from models import PenType, Project, ProjectVersion, ToolPreset
from schemas import (
    PenTypeCreate,
    PenTypeUpdate,
    ProjectCreate,
    ProjectUpdate,
    ToolPresetCreate,
    ToolPresetUpdate,
)


class InMemoryPenTypeRepository:
    """In-memory implementation of PenTypeRepository for testing."""

    def __init__(self):
        self.storage: dict[str, PenType] = {}

    def get_all(self) -> list[PenType]:
        """Get all pen types."""
        return list(self.storage.values())

    def get_by_id(self, pen_type_id: str) -> PenType | None:
        """Get a single pen type by ID."""
        return self.storage.get(pen_type_id)

    def create(self, pen_type: PenTypeCreate) -> PenType:
        """Create a new pen type."""
        db_pen_type = PenType(
            id=pen_type.id,
            display_name=pen_type.display_name,
            pen_up=pen_type.pen_up,
            pen_down=pen_type.pen_down,
            pump_distance_threshold=pen_type.pump_distance_threshold,
            pump_height=pen_type.pump_height,
            width=pen_type.width,
        )
        self.storage[pen_type.id] = db_pen_type
        return db_pen_type

    def update(self, pen_type_id: str, pen_type: PenTypeUpdate) -> PenType | None:
        """Update an existing pen type."""
        db_pen_type = self.get_by_id(pen_type_id)
        if db_pen_type is None:
            return None

        update_data = pen_type.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_pen_type, key, value)

        return db_pen_type

    def delete(self, pen_type_id: str) -> bool:
        """Delete a pen type. Returns True if deleted, False if not found."""
        if pen_type_id in self.storage:
            del self.storage[pen_type_id]
            return True
        return False

    def clear(self):
        """Clear all data (useful for test cleanup)."""
        self.storage.clear()


class InMemoryToolPresetRepository:
    """In-memory implementation of ToolPresetRepository for testing."""

    def __init__(self):
        self.storage: dict[int, ToolPreset] = {}
        self._next_id = 1

    def get_all(self) -> list[ToolPreset]:
        """Get all tool presets."""
        return list(self.storage.values())

    def get_by_id(self, preset_id: int) -> ToolPreset | None:
        """Get a single tool preset by ID."""
        return self.storage.get(preset_id)

    def get_by_name(self, name: str) -> ToolPreset | None:
        """Get a tool preset by name."""
        for preset in self.storage.values():
            if preset.name == name:
                return preset
        return None

    def create(self, preset: ToolPresetCreate) -> ToolPreset:
        """Create a new tool preset."""
        tool_configs_data = [tc.model_dump() for tc in preset.tool_configs]
        db_preset = ToolPreset(
            id=self._next_id,
            name=preset.name,
            tool_configs=tool_configs_data,
        )
        self.storage[self._next_id] = db_preset
        self._next_id += 1
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

        return db_preset

    def delete(self, preset_id: int) -> bool:
        """Delete a tool preset. Returns True if deleted, False if not found."""
        if preset_id in self.storage:
            del self.storage[preset_id]
            return True
        return False

    def clear(self):
        """Clear all data (useful for test cleanup)."""
        self.storage.clear()
        self._next_id = 1


class InMemoryProjectRepository:
    """In-memory implementation of ProjectRepository for testing."""

    def __init__(self):
        self.storage: dict[int, Project] = {}
        self.versions: dict[int, list[ProjectVersion]] = {}
        self._next_project_id = 1
        self._next_version_id = 1

    def get_all(self) -> list[Project]:
        """Get all projects (ordered by updated_at descending)."""
        projects = list(self.storage.values())
        return sorted(projects, key=lambda p: p.updated_at or datetime.min, reverse=True)

    def get_by_id(self, project_id: int) -> Project | None:
        """Get a single project by ID."""
        return self.storage.get(project_id)

    def create(self, project: ProjectCreate) -> Project:
        """Create a new project."""
        now = datetime.now()
        db_project = Project(
            id=self._next_project_id,
            name=project.name,
            description=project.description,
            project_data=copy.deepcopy(project.project_data),
            current_version=1,
            created_at=now,
            updated_at=now,
        )
        self.storage[self._next_project_id] = db_project
        self.versions[self._next_project_id] = []
        self._next_project_id += 1
        return db_project

    def update(self, project_id: int, project: ProjectUpdate) -> Project | None:
        """Update an existing project. Creates a version snapshot before updating."""
        db_project = self.get_by_id(project_id)
        if db_project is None:
            return None

        # If project_data is being updated, archive current version first
        if project.project_data is not None:
            db_version = ProjectVersion(
                id=self._next_version_id,
                project_id=db_project.id,
                version=db_project.current_version,
                project_data=copy.deepcopy(db_project.project_data),
                message=project.version_message,
                created_at=datetime.now(),
            )
            self.versions[project_id].append(db_version)
            self._next_version_id += 1
            db_project.current_version += 1

        if project.name is not None:
            db_project.name = project.name
        if project.description is not None:
            db_project.description = project.description
        if project.project_data is not None:
            db_project.project_data = copy.deepcopy(project.project_data)

        db_project.updated_at = datetime.now()
        return db_project

    def delete(self, project_id: int) -> bool:
        """Delete a project and all its versions."""
        if project_id not in self.storage:
            return False

        del self.storage[project_id]
        if project_id in self.versions:
            del self.versions[project_id]
        return True

    def get_versions(self, project_id: int) -> list[ProjectVersion]:
        """Get all versions of a project (ordered by version descending)."""
        versions = self.versions.get(project_id, [])
        return sorted(versions, key=lambda v: v.version, reverse=True)

    def get_version(self, project_id: int, version: int) -> ProjectVersion | None:
        """Get a specific version of a project."""
        for v in self.versions.get(project_id, []):
            if v.version == version:
                return v
        return None

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
            id=self._next_version_id,
            project_id=db_project.id,
            version=db_project.current_version,
            project_data=copy.deepcopy(db_project.project_data),
            message=f"Vor Wiederherstellung von v{version}",
            created_at=datetime.now(),
        )
        self.versions[project_id].append(archive_version)
        self._next_version_id += 1

        # Restore old data and increment version
        db_project.project_data = copy.deepcopy(db_version.project_data)
        db_project.current_version += 1
        db_project.updated_at = datetime.now()

        return db_project

    def clear(self):
        """Clear all data (useful for test cleanup)."""
        self.storage.clear()
        self.versions.clear()
        self._next_project_id = 1
        self._next_version_id = 1


__all__ = [
    "InMemoryPenTypeRepository",
    "InMemoryToolPresetRepository",
    "InMemoryProjectRepository",
]
