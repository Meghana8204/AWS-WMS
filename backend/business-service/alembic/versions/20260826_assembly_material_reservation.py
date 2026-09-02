"""Reserve material when an assembly order is released.

Revision ID: 20260826_assembly_reservation
Revises: 20260825_supplier_codes
"""

from alembic import op
import sqlalchemy as sa


revision = "20260826_assembly_reservation"
down_revision = "20260825_supplier_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assembly_material_reservation",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("assembly_order_id", sa.Uuid(), nullable=False),
        sa.Column("material_code", sa.String(length=64), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False),
        sa.Column("uom", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="RESERVED"),
        sa.Column("reserved_by", sa.String(length=128), nullable=False),
        sa.Column("reserved_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["assembly_order_id"], ["assembly_order.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assembly_order_id", "material_code", name="uq_assembly_reservation_order_material"),
    )
    op.create_index("ix_assembly_material_reservation_order", "assembly_material_reservation", ["assembly_order_id"])
    op.create_index("ix_assembly_material_reservation_material", "assembly_material_reservation", ["material_code"])


def downgrade() -> None:
    op.drop_index("ix_assembly_material_reservation_material", table_name="assembly_material_reservation")
    op.drop_index("ix_assembly_material_reservation_order", table_name="assembly_material_reservation")
    op.drop_table("assembly_material_reservation")
