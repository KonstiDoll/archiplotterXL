"""Test configuration and fixtures."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import (
    Base,
    get_db,
    get_pen_type_repository,
    get_project_repository,
    get_tool_preset_repository,
)
from main import app
from repositories.memory import (
    InMemoryPenTypeRepository,
    InMemoryProjectRepository,
    InMemoryToolPresetRepository,
)
from repositories.sqlalchemy import (
    SQLAlchemyPenTypeRepository,
    SQLAlchemyProjectRepository,
    SQLAlchemyToolPresetRepository,
)

# Use in-memory SQLite for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for tests."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database override."""
    app.dependency_overrides[get_db] = override_get_db

    # Override repository providers to use SQLAlchemy with test DB
    def override_pen_type_repo():
        db = TestingSessionLocal()
        try:
            yield SQLAlchemyPenTypeRepository(db)
        finally:
            db.close()

    def override_tool_preset_repo():
        db = TestingSessionLocal()
        try:
            yield SQLAlchemyToolPresetRepository(db)
        finally:
            db.close()

    def override_project_repo():
        db = TestingSessionLocal()
        try:
            yield SQLAlchemyProjectRepository(db)
        finally:
            db.close()

    app.dependency_overrides[get_pen_type_repository] = override_pen_type_repo
    app.dependency_overrides[get_tool_preset_repository] = override_tool_preset_repo
    app.dependency_overrides[get_project_repository] = override_project_repo

    Base.metadata.create_all(bind=engine)

    with TestClient(app) as test_client:
        yield test_client

    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


# --- In-Memory Repository Fixtures ---


@pytest.fixture
def in_memory_pen_type_repo():
    """Create an in-memory pen type repository."""
    repo = InMemoryPenTypeRepository()
    yield repo
    repo.clear()


@pytest.fixture
def in_memory_tool_preset_repo():
    """Create an in-memory tool preset repository."""
    repo = InMemoryToolPresetRepository()
    yield repo
    repo.clear()


@pytest.fixture
def in_memory_project_repo():
    """Create an in-memory project repository."""
    repo = InMemoryProjectRepository()
    yield repo
    repo.clear()


@pytest.fixture
def client_with_memory_repos(
    in_memory_pen_type_repo,
    in_memory_tool_preset_repo,
    in_memory_project_repo,
):
    """Create a test client with in-memory repository overrides."""
    app.dependency_overrides[get_pen_type_repository] = lambda: in_memory_pen_type_repo
    app.dependency_overrides[get_tool_preset_repository] = lambda: in_memory_tool_preset_repo
    app.dependency_overrides[get_project_repository] = lambda: in_memory_project_repo

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
