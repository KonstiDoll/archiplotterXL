import os
from collections.abc import Generator

from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

# Database URL from environment or default for local development
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://archislicer:archislicer@localhost:5435/archislicer"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency for FastAPI endpoints to get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Repository DI Providers ---
# These use lazy imports to avoid circular import issues


def get_pen_type_repository(db: Session = Depends(get_db)):
    """Dependency provider for PenTypeRepository."""
    from repositories.sqlalchemy import SQLAlchemyPenTypeRepository

    return SQLAlchemyPenTypeRepository(db)


def get_tool_preset_repository(db: Session = Depends(get_db)):
    """Dependency provider for ToolPresetRepository."""
    from repositories.sqlalchemy import SQLAlchemyToolPresetRepository

    return SQLAlchemyToolPresetRepository(db)


def get_project_repository(db: Session = Depends(get_db)):
    """Dependency provider for ProjectRepository."""
    from repositories.sqlalchemy import SQLAlchemyProjectRepository

    return SQLAlchemyProjectRepository(db)
