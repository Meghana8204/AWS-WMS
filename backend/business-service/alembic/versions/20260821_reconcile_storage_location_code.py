"""Reconcile legacy storage locations with the current storage model.

Revision ID: 20260821_storage_location_code
Revises: 20260820_putaway_operator
"""
from alembic import op


revision = "20260821_storage_location_code"
down_revision = "20260820_putaway_operator"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE storage_location ADD COLUMN IF NOT EXISTS location_code VARCHAR(64)")
    op.execute(
        """
        UPDATE storage_location
           SET location_code = UPPER(
               REGEXP_REPLACE(
                   CONCAT_WS('-', warehouse_id, zone, rack, bin),
                   '[^A-Za-z0-9-]+', '-', 'g'
               )
           )
         WHERE location_code IS NULL
        """
    )
    op.execute("ALTER TABLE storage_location ALTER COLUMN location_code SET NOT NULL")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_storage_location_location_code ON storage_location (location_code)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_storage_location_warehouse_id ON storage_location (warehouse_id)")
    op.execute(
        """
        DO $$ BEGIN
            ALTER TABLE storage_location
                ADD CONSTRAINT uq_storage_location_path UNIQUE (warehouse_id, zone, rack, bin);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
        """
    )
    op.execute(
        """
        INSERT INTO storage_location
            (id, location_code, warehouse_id, zone, rack, bin, capacity, occupied_quantity, active)
        VALUES
            ('71000000-0000-0000-0000-000000000001', 'WH-01-RM-A-05', 'WH-01', 'Raw Material Zone', 'Rack A', 'Bin 05', 10000, 0, TRUE),
            ('71000000-0000-0000-0000-000000000002', 'WH-01-RM-A-06', 'WH-01', 'Raw Material Zone', 'Rack A', 'Bin 06', 10000, 0, TRUE),
            ('71000000-0000-0000-0000-000000000003', 'WH-PUNE-01-RM-A-05', 'WH-PUNE-01', 'Raw Material Zone', 'Rack A', 'Bin 05', 10000, 0, TRUE),
            ('71000000-0000-0000-0000-000000000004', 'WH-PUNE-01-RM-B-01', 'WH-PUNE-01', 'Raw Material Zone', 'Rack B', 'Bin 01', 20000, 0, TRUE)
        ON CONFLICT (location_code) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_constraint("uq_storage_location_path", "storage_location", type_="unique")
    op.drop_index("ix_storage_location_warehouse_id", table_name="storage_location")
    op.drop_index("ix_storage_location_location_code", table_name="storage_location")
    op.drop_column("storage_location", "location_code")
