from fastapi import APIRouter, Depends, HTTPException

from database import get_project_repository
from repositories import ProjectRepository
from schemas import (
    ProjectCreate,
    ProjectListItem,
    ProjectResponse,
    ProjectUpdate,
    ProjectVersionListItem,
    ProjectVersionResponse,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectListItem])
def list_projects(
    repo: ProjectRepository = Depends(get_project_repository),
):
    """Get all projects (summary without full project_data)."""
    return repo.get_all()


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    repo: ProjectRepository = Depends(get_project_repository),
):
    """Get a single project by ID with full data."""
    project = repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(
    project: ProjectCreate,
    repo: ProjectRepository = Depends(get_project_repository),
):
    """Create a new project."""
    return repo.create(project)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project: ProjectUpdate,
    repo: ProjectRepository = Depends(get_project_repository),
):
    """Update an existing project."""
    updated = repo.update(project_id, project)
    if updated is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return updated


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    repo: ProjectRepository = Depends(get_project_repository),
):
    """Delete a project."""
    if not repo.delete(project_id):
        raise HTTPException(status_code=404, detail="Project not found")


# --- Version Endpoints ---


@router.get("/{project_id}/versions", response_model=list[ProjectVersionListItem])
def list_project_versions(
    project_id: int,
    repo: ProjectRepository = Depends(get_project_repository),
):
    """Get all versions of a project."""
    project = repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return repo.get_versions(project_id)


@router.get("/{project_id}/versions/{version}", response_model=ProjectVersionResponse)
def get_project_version(
    project_id: int,
    version: int,
    repo: ProjectRepository = Depends(get_project_repository),
):
    """Get a specific version of a project."""
    project = repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    db_version = repo.get_version(project_id, version)
    if db_version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return db_version


@router.post("/{project_id}/versions/{version}/restore", response_model=ProjectResponse)
def restore_project_version(
    project_id: int,
    version: int,
    repo: ProjectRepository = Depends(get_project_repository),
):
    """Restore a project to a previous version."""
    restored = repo.restore_version(project_id, version)
    if restored is None:
        raise HTTPException(status_code=404, detail="Project or version not found")
    return restored
