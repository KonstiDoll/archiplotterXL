# ArchiSlicer Backend

FastAPI backend for the ArchiSlicer pen plotter application.

## Quick Start

```bash
# Install dependencies
uv sync --extra dev --extra test

# Start development server
uv run uvicorn main:app --reload --port 8000

# Run tests
uv run pytest tests/ -v
```

## Architecture

The backend follows a clean architecture with dependency injection:

```
backend/
├── main.py                 # FastAPI app entry point
├── database.py             # DB connection + DI providers
├── models.py               # SQLAlchemy ORM models
├── schemas.py              # Pydantic request/response schemas
│
├── routers/                # API endpoints (presentation layer)
│   ├── pen_types.py        # /api/pen-types/
│   ├── tool_presets.py     # /api/tool-presets/
│   ├── projects.py         # /api/projects/
│   └── infill.py           # /api/infill/
│
├── repositories/           # Data access layer (Repository Pattern)
│   ├── __init__.py         # Protocol definitions (interfaces)
│   ├── sqlalchemy.py       # SQLAlchemy implementations
│   └── memory.py           # In-memory implementations (testing)
│
├── services/               # Business logic layer
│   ├── infill/             # Infill pattern generation
│   │   ├── patterns.py     # InfillGenerator ABC + implementations
│   │   ├── utils.py        # Generation utilities
│   │   └── service.py      # InfillService (DI wrapper)
│   ├── optimization/       # Path optimization (TSP)
│   │   ├── path_optimizer.py
│   │   └── service.py      # PathOptimizerService
│   ├── centerline/         # Centerline extraction
│   │   ├── extractor.py    # Skeleton/Voronoi methods
│   │   ├── smoothing.py    # Chaikin smoothing
│   │   └── service.py      # CenterlineService
│   └── geometry/
│       └── utils.py        # Shapely utilities
│
├── alembic/                # Database migrations
├── tests/                  # pytest test suite
└── pyproject.toml          # Dependencies + tool config
```

## Design Patterns

### Repository Pattern

Data access is abstracted through Protocol classes:

```python
# repositories/__init__.py
class PenTypeRepository(Protocol):
    def get_all(self) -> list[PenType]: ...
    def get_by_id(self, id: str) -> PenType | None: ...
    def create(self, data: PenTypeCreate) -> PenType: ...
    # ...
```

Implementations:
- `SQLAlchemyPenTypeRepository` - Production (PostgreSQL)
- `InMemoryPenTypeRepository` - Testing

### Dependency Injection

FastAPI's `Depends()` is used throughout:

```python
# routers/pen_types.py
@router.get("")
def list_pen_types(
    repo: PenTypeRepository = Depends(get_pen_type_repository),
):
    return repo.get_all()
```

DI providers in `database.py` use lazy imports to avoid circular dependencies.

### Service Layer

Business logic is encapsulated in service classes:

```python
# services/infill/service.py
class InfillService:
    def generate(self, polygons, pattern_type, density, angle, outline_offset):
        return generate_infill_for_polygons(...)

def get_infill_service() -> InfillService:
    return InfillService()
```

## API Endpoints

### Pen Types (`/api/pen-types/`)
- `GET /` - List all pen types
- `POST /` - Create pen type
- `GET /{id}` - Get pen type
- `PUT /{id}` - Update pen type
- `DELETE /{id}` - Delete pen type

### Tool Presets (`/api/tool-presets/`)
- `GET /` - List all presets
- `POST /` - Create preset
- `GET /{id}` - Get preset
- `PUT /{id}` - Update preset
- `DELETE /{id}` - Delete preset

### Projects (`/api/projects/`)
- `GET /` - List all projects
- `POST /` - Create project
- `GET /{id}` - Get project
- `PUT /{id}` - Update project (creates version snapshot)
- `DELETE /{id}` - Delete project
- `GET /{id}/versions` - List versions
- `POST /{id}/restore/{version}` - Restore version

### Infill (`/api/infill/`)
- `POST /generate` - Generate infill patterns
- `POST /optimize` - Optimize path order (TSP)
- `POST /optimize-polylines` - Optimize polyline order
- `POST /centerlines` - Extract centerlines

## Development

### Code Quality

```bash
# Install pre-commit hooks
uv run pre-commit install

# Run linter
uv run ruff check . --fix

# Run formatter
uv run ruff format .

# Run all checks
uv run pre-commit run --all-files
```

### Testing

```bash
# Run all tests
uv run pytest tests/ -v

# With coverage
uv run pytest tests/ --cov=. --cov-report=html

# Run specific test
uv run pytest tests/test_pen_types.py -v
```

Tests use in-memory repositories via dependency override:

```python
# tests/conftest.py
@pytest.fixture
def client(in_memory_pen_type_repo, ...):
    app.dependency_overrides[get_pen_type_repository] = lambda: in_memory_pen_type_repo
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
```

### Database Migrations

```bash
# Create migration
uv run alembic revision --autogenerate -m "description"

# Apply migrations
uv run alembic upgrade head

# Rollback
uv run alembic downgrade -1
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://archislicer:archislicer@localhost:5435/archislicer` | PostgreSQL connection string |

## Dependencies

Core:
- **FastAPI** - Web framework
- **SQLAlchemy 2.0** - ORM
- **Pydantic 2.x** - Validation
- **Shapely** - Geometry processing
- **OR-Tools** - TSP optimization
- **OpenCV** - Centerline extraction

Dev:
- **ruff** - Linting + formatting
- **pre-commit** - Git hooks
- **pytest** - Testing
