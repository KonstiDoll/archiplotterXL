from datetime import datetime
from typing import Any
from pydantic import BaseModel


class PenTypeBase(BaseModel):
    """Base schema for pen type data."""
    display_name: str
    pen_up: float
    pen_down: float
    pump_distance_threshold: float = 0
    pump_height: float = 50


class PenTypeCreate(PenTypeBase):
    """Schema for creating a new pen type."""
    id: str


class PenTypeUpdate(BaseModel):
    """Schema for updating an existing pen type (all fields optional)."""
    display_name: str | None = None
    pen_up: float | None = None
    pen_down: float | None = None
    pump_distance_threshold: float | None = None
    pump_height: float | None = None


class PenTypeResponse(PenTypeBase):
    """Schema for pen type response."""
    id: str

    model_config = {"from_attributes": True}


# --- Tool Preset Schemas ---

class ToolConfigItem(BaseModel):
    """Single tool configuration."""
    penType: str
    color: str


class ToolPresetBase(BaseModel):
    """Base schema for tool preset data."""
    name: str
    tool_configs: list[ToolConfigItem]


class ToolPresetCreate(ToolPresetBase):
    """Schema for creating a new tool preset."""
    pass


class ToolPresetUpdate(BaseModel):
    """Schema for updating an existing tool preset."""
    name: str | None = None
    tool_configs: list[ToolConfigItem] | None = None


class ToolPresetResponse(ToolPresetBase):
    """Schema for tool preset response."""
    id: int

    model_config = {"from_attributes": True}


# --- Project Schemas ---

class ProjectBase(BaseModel):
    """Base schema for project data."""
    name: str
    description: str | None = None


class ProjectCreate(ProjectBase):
    """Schema for creating a new project."""
    project_data: dict[str, Any]


class ProjectUpdate(BaseModel):
    """Schema for updating an existing project."""
    name: str | None = None
    description: str | None = None
    project_data: dict[str, Any] | None = None


class ProjectListItem(ProjectBase):
    """Schema for project list item (without full data)."""
    id: int
    current_version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectResponse(ProjectBase):
    """Schema for full project response."""
    id: int
    project_data: dict[str, Any]
    current_version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Project Version Schemas ---

class ProjectVersionListItem(BaseModel):
    """Schema for version list item."""
    id: int
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectVersionResponse(BaseModel):
    """Schema for full version response (with project data)."""
    id: int
    project_id: int
    version: int
    project_data: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}
