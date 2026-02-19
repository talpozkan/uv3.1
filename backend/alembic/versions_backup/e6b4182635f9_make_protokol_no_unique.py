"""make_protokol_no_unique

Revision ID: e6b4182635f9
Revises: 25936d7f3371
Create Date: 2025-12-26 10:40:47.795248

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6b4182635f9'
down_revision: Union[str, None] = '25936d7f3371'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop existing index if it exists
    try:
        op.drop_index('ix_hastalar_protokol_no', table_name='hastalar')
    except:
        pass
    
    # Create unique index
    op.create_index(op.f('ix_hastalar_protokol_no'), 'hastalar', ['protokol_no'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_hastalar_protokol_no'), table_name='hastalar')
    op.create_index('ix_hastalar_protokol_no', 'hastalar', ['protokol_no'], unique=False)
