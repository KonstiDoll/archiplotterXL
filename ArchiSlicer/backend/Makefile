.PHONY: init sync db-up db-down db-logs migrate seed run setup clean

# Python environment (using uv)
init:
	uv venv

sync:
	uv sync --no-install-project

# Database
db-up:
	docker compose up -d
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 3

db-down:
	docker compose down

db-logs:
	docker compose logs -f db

# Migrations
migrate:
	uv run alembic upgrade head

# Seed data
seed:
	uv run python seed.py

# Run server
run:
	uv run uvicorn main:app --reload --host 0.0.0.0 --port 8035

# Full setup
setup: db-up sync migrate seed
	@echo "Setup complete! Run 'make run' to start the server."

# Clean up
clean:
	docker compose down -v
	@echo "Database volume removed."
