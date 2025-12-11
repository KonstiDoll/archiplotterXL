"""Add project versioning

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2025-12-11 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add current_version column to projects table
    op.add_column('projects', sa.Column('current_version', sa.Integer(), nullable=True))

    # Set default value for existing rows
    op.execute("UPDATE projects SET current_version = 1 WHERE current_version IS NULL")

    # Make column non-nullable
    op.alter_column('projects', 'current_version', nullable=False)

    # Create project_versions table
    op.create_table('project_versions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('project_data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_project_versions_project_id', 'project_versions', ['project_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_project_versions_project_id', table_name='project_versions')
    op.drop_table('project_versions')
    op.drop_column('projects', 'current_version')
