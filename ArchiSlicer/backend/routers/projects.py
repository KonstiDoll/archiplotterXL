from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListItem,
    ProjectVersionListItem, ProjectVersionResponse
)
import crud

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("/", response_model=list[ProjectListItem])
def list_projects(db: Session = Depends(get_db)):
    """Get all projects (summary without full project_data)."""
    return crud.get_projects(db)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Get a single project by ID with full data."""
    project = crud.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/", response_model=ProjectResponse, status_code=201)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project."""
    return crud.create_project(db, project)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, project: ProjectUpdate, db: Session = Depends(get_db)):
    """Update an existing project."""
    updated = crud.update_project(db, project_id, project)
    if updated is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return updated


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """Delete a project."""
    if not crud.delete_project(db, project_id):
        raise HTTPException(status_code=404, detail="Project not found")


# --- Version Endpoints ---

@router.get("/{project_id}/versions", response_model=list[ProjectVersionListItem])
def list_project_versions(project_id: int, db: Session = Depends(get_db)):
    """Get all versions of a project."""
    project = crud.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return crud.get_project_versions(db, project_id)


@router.get("/{project_id}/versions/{version}", response_model=ProjectVersionResponse)
def get_project_version(project_id: int, version: int, db: Session = Depends(get_db)):
    """Get a specific version of a project."""
    project = crud.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    db_version = crud.get_project_version(db, project_id, version)
    if db_version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return db_version


@router.post("/{project_id}/versions/{version}/restore", response_model=ProjectResponse)
def restore_project_version(project_id: int, version: int, db: Session = Depends(get_db)):
    """Restore a project to a previous version."""
    restored = crud.restore_project_version(db, project_id, version)
    if restored is None:
        raise HTTPException(status_code=404, detail="Project or version not found")
    return restored
