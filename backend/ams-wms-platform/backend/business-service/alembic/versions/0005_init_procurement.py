"""init procurement tables and add purchase order columns

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns to purchase_order table
    op.add_column("purchase_order", sa.Column("po_date", sa.Date(), nullable=False, server_default=sa.text("CURRENT_DATE")))
    op.add_column("purchase_order", sa.Column("status", sa.String(32), nullable=False, server_default="DRAFT"))
    op.add_column("purchase_order", sa.Column("supplier_id", sa.String(64), nullable=True))
    op.add_column("purchase_order", sa.Column("warehouse_id", sa.String(64), nullable=True))
    op.add_column("purchase_order", sa.Column("department", sa.String(64), nullable=True))
    op.add_column("purchase_order", sa.Column("buyer", sa.String(128), nullable=True))
    op.add_column("purchase_order", sa.Column("expected_delivery_date", sa.Date(), nullable=True))
    op.add_column("purchase_order", sa.Column("supplier_code", sa.String(64), nullable=True))
    op.add_column("purchase_order", sa.Column("supplier_name", sa.String(255), nullable=True))
    op.add_column("purchase_order", sa.Column("contact_person", sa.String(128), nullable=True))
    op.add_column("purchase_order", sa.Column("phone", sa.String(32), nullable=True))
    op.add_column("purchase_order", sa.Column("email", sa.String(128), nullable=True))
    op.add_column("purchase_order", sa.Column("gst_number", sa.String(32), nullable=True))
    op.add_column("purchase_order", sa.Column("supplier_address", sa.Text(), nullable=True))
    op.add_column("purchase_order", sa.Column("delivery_warehouse", sa.String(64), nullable=True))
    op.add_column("purchase_order", sa.Column("delivery_address", sa.Text(), nullable=True))
    op.add_column("purchase_order", sa.Column("delivery_expected_date", sa.Date(), nullable=True))
    op.add_column("purchase_order", sa.Column("transporter", sa.String(128), nullable=True))
    op.add_column("purchase_order", sa.Column("tax_rate", sa.Numeric(5, 4), nullable=False, server_default="0.18"))
    op.add_column("purchase_order", sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")))
    op.add_column("purchase_order", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")))

    # Add columns to purchase_order_line table
    op.add_column("purchase_order_line", sa.Column("material_name", sa.String(255), nullable=True))
    op.add_column("purchase_order_line", sa.Column("category", sa.String(64), nullable=True))
    op.add_column("purchase_order_line", sa.Column("unit_price", sa.Numeric(18, 4), nullable=False, server_default="0.0"))

    # Create purchase_order_attachment table
    op.create_table(
        "purchase_order_attachment",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("purchase_order.id"), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("file_type", sa.String(64), nullable=False),
        sa.Column("file_path", sa.String(512), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def downgrade() -> None:
    op.drop_table("purchase_order_attachment")
    op.drop_column("purchase_order_line", "unit_price")
    op.drop_column("purchase_order_line", "category")
    op.drop_column("purchase_order_line", "material_name")

    for col in [
        "updated_at", "created_at", "tax_rate", "transporter", "delivery_expected_date",
        "delivery_address", "delivery_warehouse", "supplier_address", "gst_number",
        "email", "phone", "contact_person", "supplier_name", "supplier_code",
        "expected_delivery_date", "buyer", "department", "warehouse_id", "supplier_id",
        "status", "po_date"
    ]:
        op.drop_column("purchase_order", col)
