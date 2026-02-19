"""Migrate hastalar.id from Integer to UUID

Revision ID: h1_patient_uuid
Revises: 41fced6c0561
Create Date: 2025-12-29

This migration:
1. Adds a new UUID column to hastalar table
2. Adds UUID columns to all related tables
3. Generates UUIDs for existing records
4. Updates foreign key references
5. Drops old integer columns
6. Renames UUID columns to 'id' and 'hasta_id'
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = 'h1_patient_uuid'
down_revision = '41fced6c0561'
branch_labels = None
depends_on = None


def get_existing_tables(connection):
    """Get list of existing tables in the database"""
    inspector = inspect(connection)
    return inspector.get_table_names()


def upgrade() -> None:
    # Get connection to check existing tables
    connection = op.get_bind()
    existing_tables = get_existing_tables(connection)
    
    # Tables that have hasta_id foreign key - only include existing tables
    ALL_RELATED_TABLES = [
        'muayeneler',
        'operasyonlar',
        'hasta_notlari',
        'planlar',
        'fotograf_arsivi',
        'tetkik_sonuclari',
        'telefon_gorusmeleri',
        'istirahat_raporlari',
        'durum_bildirir_raporlari',
        'tibbi_mudahale_raporlari',
        'genel_lab_sonuclari',
        'sperm_analizleri',
        'idrar_tahlilleri',
        'urodinamiler',
        'lab_uroflowmetri',
        'goruntuleme_sonuclari',
        'randevular',
        'anamnezler',
        'hasta_dosyalari',
        'hasta_finans_hareketleri',
    ]
    
    # Filter to only include tables that exist
    RELATED_TABLES = [t for t in ALL_RELATED_TABLES if t in existing_tables]
    
    print(f"Found existing tables: {RELATED_TABLES}")
    
    # Enable uuid-ossp extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    
    # Step 1: Add UUID column to hastalar
    op.add_column('hastalar', sa.Column('uuid', UUID(as_uuid=True), nullable=True))
    
    # Generate UUIDs for existing patients
    op.execute("UPDATE hastalar SET uuid = uuid_generate_v4()")
    
    # Make uuid not nullable and unique
    op.alter_column('hastalar', 'uuid', nullable=False)
    op.create_unique_constraint('uq_hastalar_uuid', 'hastalar', ['uuid'])
    
    # Step 2: Add UUID columns to all related tables
    for table in RELATED_TABLES:
        print(f"Adding hasta_uuid column to {table}")
        op.add_column(table, sa.Column('hasta_uuid', UUID(as_uuid=True), nullable=True))
    
    # Step 3: Populate hasta_uuid in related tables based on hasta_id
    for table in RELATED_TABLES:
        print(f"Populating hasta_uuid in {table}")
        op.execute(f"""
            UPDATE {table} 
            SET hasta_uuid = hastalar.uuid 
            FROM hastalar 
            WHERE {table}.hasta_id = hastalar.id
        """)
    
    # Step 4: Drop old foreign key constraints
    for table in RELATED_TABLES:
        fk_name = f'{table}_hasta_id_fkey'
        print(f"Dropping foreign key {fk_name} from {table}")
        try:
            op.drop_constraint(fk_name, table, type_='foreignkey')
        except Exception as e:
            print(f"  Could not drop constraint {fk_name}: {e}")
    
    # Step 5: Drop indexes on old hasta_id columns
    for table in RELATED_TABLES:
        idx_name = f'ix_{table}_hasta_id'
        try:
            op.drop_index(idx_name, table_name=table)
        except Exception as e:
            print(f"  Could not drop index {idx_name}: {e}")
    
    # Step 6: Drop old hasta_id columns from related tables
    for table in RELATED_TABLES:
        print(f"Dropping hasta_id column from {table}")
        op.drop_column(table, 'hasta_id')
    
    # Step 7: Rename hasta_uuid to hasta_id
    for table in RELATED_TABLES:
        print(f"Renaming hasta_uuid to hasta_id in {table}")
        op.alter_column(table, 'hasta_uuid', new_column_name='hasta_id')
    
    # Step 8: Drop old id column and rename uuid to id in hastalar
    print("Migrating hastalar primary key")
    op.drop_constraint('hastalar_pkey', 'hastalar', type_='primary')
    op.drop_column('hastalar', 'id')
    op.alter_column('hastalar', 'uuid', new_column_name='id')
    op.create_primary_key('hastalar_pkey', 'hastalar', ['id'])
    
    # Drop the temporary unique constraint
    try:
        op.drop_constraint('uq_hastalar_uuid', 'hastalar', type_='unique')
    except Exception as e:
        print(f"  Could not drop constraint uq_hastalar_uuid: {e}")
    
    # Step 9: Create new foreign key constraints
    for table in RELATED_TABLES:
        print(f"Creating foreign key constraint for {table}")
        if table == 'randevular':
            # randevular allows null hasta_id
            op.create_foreign_key(
                f'{table}_hasta_id_fkey', 
                table, 
                'hastalar', 
                ['hasta_id'], 
                ['id'],
                ondelete='SET NULL'
            )
        elif table == 'anamnezler':
            # anamnezler has unique constraint on hasta_id
            op.alter_column(table, 'hasta_id', nullable=False)
            op.create_unique_constraint(f'uq_{table}_hasta_id', table, ['hasta_id'])
            op.create_foreign_key(
                f'{table}_hasta_id_fkey', 
                table, 
                'hastalar', 
                ['hasta_id'], 
                ['id'],
                ondelete='CASCADE'
            )
        else:
            # Make hasta_id NOT NULL for most tables
            op.alter_column(table, 'hasta_id', nullable=False)
            op.create_foreign_key(
                f'{table}_hasta_id_fkey', 
                table, 
                'hastalar', 
                ['hasta_id'], 
                ['id'],
                ondelete='CASCADE'
            )
    
    # Step 10: Create indexes on hasta_id columns (for performance)
    for table in RELATED_TABLES:
        print(f"Creating index on hasta_id for {table}")
        op.create_index(f'ix_{table}_hasta_id', table, ['hasta_id'])
    
    print("Migration completed successfully!")


def downgrade() -> None:
    """
    WARNING: Downgrade will convert UUIDs back to integers.
    This may cause data loss if there are more records than can fit in an integer sequence.
    """
    # This is a complex migration and downgrade is not recommended
    # For safety, we just raise an error
    raise NotImplementedError(
        "Downgrade from UUID to Integer is not supported. "
        "Please restore from backup if needed."
    )
