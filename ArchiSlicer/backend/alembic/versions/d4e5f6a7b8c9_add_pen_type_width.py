"""Add width field to pen_types table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2025-01-30 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add width column with default value of 0.5mm
    op.add_column("pen_types", sa.Column("width", sa.Float(), nullable=False, server_default="0.5"))


def downgrade() -> None:
    op.drop_column("pen_types", "width")
