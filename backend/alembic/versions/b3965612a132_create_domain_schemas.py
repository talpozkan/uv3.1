"""create_domain_schemas

Revision ID: b3965612a132
Revises: 964172eb296a
Create Date: 2026-01-29 22:42:58.445169

Epic 1: Safe Migration & Integrity Verification
Story: Create Empty Sharded Schemas

This migration creates the 3 domain-isolated PostgreSQL schemas:
- patient: Demographics, contact info, preferences
- clinical: Examinations, surgeries, notes, labs
- finance: Transactions, payments, invoices
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3965612a132'
down_revision: Union[str, None] = '964172eb296a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Domain schemas per architecture document
DOMAIN_SCHEMAS = ["patient", "clinical", "finance"]


def upgrade() -> None:
    """Create domain-isolated PostgreSQL schemas."""
    for schema in DOMAIN_SCHEMAS:
        op.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
        # Grant usage to the application user
        # Note: In production, this should use the specific DB user
        op.execute(f"GRANT ALL PRIVILEGES ON SCHEMA {schema} TO PUBLIC")


def downgrade() -> None:
    """Drop domain schemas (DANGEROUS: data loss)."""
    for schema in reversed(DOMAIN_SCHEMAS):
        # CASCADE will drop all objects in the schema
        op.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")

