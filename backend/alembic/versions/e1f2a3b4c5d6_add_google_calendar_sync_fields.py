"""Add google calendar sync fields to randevular

Revision ID: e1f2a3b4c5d6
Revises: dde2f46421d6
Create Date: 2026-01-17 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'a60e5c02ae56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add Google Calendar sync columns to randevular
    op.add_column('randevular', sa.Column('google_event_id', sa.String(), nullable=True))
    op.add_column('randevular', sa.Column('google_calendar_id', sa.String(), nullable=True))
    op.add_column('randevular', sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_randevular_google_event_id'), 'randevular', ['google_event_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_randevular_google_event_id'), table_name='randevular')
    op.drop_column('randevular', 'last_synced_at')
    op.drop_column('randevular', 'google_calendar_id')
    op.drop_column('randevular', 'google_event_id')
