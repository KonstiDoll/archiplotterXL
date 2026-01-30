"""Add version message column

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2025-12-11 15:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: str | Sequence[str] | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add message column to project_versions table."""
    op.add_column("project_versions", sa.Column("message", sa.Text(), nullable=True))


def downgrade() -> None:
    """Remove message column from project_versions table."""
    op.drop_column("project_versions", "message")
