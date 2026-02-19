"""fix_null_sira_no_in_kasalar

Revision ID: a60e5c02ae56
Revises: 4df55a25f3c5
Create Date: 2026-01-06 12:42:47.311806

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a60e5c02ae56'
down_revision: Union[str, None] = '4df55a25f3c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Fix existing NULL values
    op.execute("UPDATE kasalar SET sira_no = 0 WHERE sira_no IS NULL")
    # Alternately, could alter column to be non-nullable if desired, but just fixing data is sufficient for now
    pass


def downgrade() -> None:
    pass
