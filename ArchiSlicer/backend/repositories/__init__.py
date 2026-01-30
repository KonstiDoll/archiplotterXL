"""
Repository interfaces (protocols) for data access abstraction.

This module defines Protocol classes that establish contracts for data access,
enabling dependency injection and easy testing with mock implementations.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from models import PenType, Project, ProjectVersion, ToolPreset
    from schemas import (
        PenTypeCreate,
        PenTypeUpdate,
        ProjectCreate,
        ProjectUpdate,
        ToolPresetCreate,
        ToolPresetUpdate,
    )


@runtime_checkable
class PenTypeRepository(Protocol):
    """Repository interface for PenType operations."""

    def get_all(self) -> list[PenType]:
        """Get all pen types."""
        ...

    def get_by_id(self, pen_type_id: str) -> PenType | None:
        """Get a single pen type by ID."""
        ...

    def create(self, pen_type: PenTypeCreate) -> PenType:
        """Create a new pen type."""
        ...

    def update(self, pen_type_id: str, pen_type: PenTypeUpdate) -> PenType | None:
        """Update an existing pen type."""
        ...

    def delete(self, pen_type_id: str) -> bool:
        """Delete a pen type. Returns True if deleted, False if not found."""
        ...


@runtime_checkable
class ToolPresetRepository(Protocol):
    """Repository interface for ToolPreset operations."""

    def get_all(self) -> list[ToolPreset]:
        """Get all tool presets."""
        ...

    def get_by_id(self, preset_id: int) -> ToolPreset | None:
        """Get a single tool preset by ID."""
        ...

    def get_by_name(self, name: str) -> ToolPreset | None:
        """Get a tool preset by name."""
        ...

    def create(self, preset: ToolPresetCreate) -> ToolPreset:
        """Create a new tool preset."""
        ...

    def update(self, preset_id: int, preset: ToolPresetUpdate) -> ToolPreset | None:
        """Update an existing tool preset."""
        ...

    def delete(self, preset_id: int) -> bool:
        """Delete a tool preset. Returns True if deleted, False if not found."""
        ...


@runtime_checkable
class ProjectRepository(Protocol):
    """Repository interface for Project operations."""

    def get_all(self) -> list[Project]:
        """Get all projects (ordered by updated_at descending)."""
        ...

    def get_by_id(self, project_id: int) -> Project | None:
        """Get a single project by ID."""
        ...

    def create(self, project: ProjectCreate) -> Project:
        """Create a new project."""
        ...

    def update(self, project_id: int, project: ProjectUpdate) -> Project | None:
        """Update an existing project. Creates a version snapshot before updating."""
        ...

    def delete(self, project_id: int) -> bool:
        """Delete a project and all its versions."""
        ...

    def get_versions(self, project_id: int) -> list[ProjectVersion]:
        """Get all versions of a project (ordered by version descending)."""
        ...

    def get_version(self, project_id: int, version: int) -> ProjectVersion | None:
        """Get a specific version of a project."""
        ...

    def restore_version(self, project_id: int, version: int) -> Project | None:
        """Restore a project to a previous version. Archives current state first."""
        ...


__all__ = [
    "PenTypeRepository",
    "ToolPresetRepository",
    "ProjectRepository",
]
