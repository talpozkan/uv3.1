"""add hidden and audit to user

Revision ID: a6304343bee4
Revises: 746c1a695148
Create Date: 2026-02-01 19:55:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a6304343bee4'
down_revision = '746c1a695148'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_hidden', sa.Boolean(), nullable=True, server_default=sa.text('false')))
    op.add_column('users', sa.Column('skip_audit', sa.Boolean(), nullable=True, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('users', 'skip_audit')
    op.drop_column('users', 'is_hidden')
