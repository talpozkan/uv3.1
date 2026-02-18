"""add doctor_name to randevular

Revision ID: g1a2b3c4d5e6
Revises: f1cd7bfbf6a2
Create Date: 2025-12-23 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g1a2b3c4d5e6'
down_revision: Union[str, None] = '02b317236b70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add doctor_name column to randevular table if not exists
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'randevular' AND column_name = 'doctor_name'
            ) THEN
                ALTER TABLE randevular ADD COLUMN doctor_name VARCHAR(255);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.drop_column('randevular', 'doctor_name')
