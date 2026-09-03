"""Add material request approval, reservations, and pick tasks."""
from alembic import op
import sqlalchemy as sa

revision = "20260820_mr_outbound"
down_revision = "20260820_putaway_operator"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("material_request", sa.Column("approved_by", sa.String(128), nullable=True))
    op.add_column("material_request", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "stock_reservation",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("request_id", sa.Uuid(), sa.ForeignKey("material_request.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("request_item_id", sa.Uuid(), sa.ForeignKey("material_request_item.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("material_code", sa.String(64), nullable=False),
        sa.Column("warehouse_id", sa.String(64), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False),
        sa.Column("uom", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("allocations", sa.JSON(), nullable=False),
        sa.Column("reserved_by", sa.String(128), nullable=False),
        sa.Column("reserved_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("request_item_id", name="uq_stock_reservation_request_item"),
    )
    op.create_index("ix_stock_reservation_request_id", "stock_reservation", ["request_id"])
    op.create_index("ix_stock_reservation_material_code", "stock_reservation", ["material_code"])
    op.create_table(
        "pick_task",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("task_number", sa.String(64), nullable=False, unique=True),
        sa.Column("request_id", sa.Uuid(), sa.ForeignKey("material_request.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("request_number", sa.String(64), nullable=False),
        sa.Column("warehouse_id", sa.String(64), nullable=False),
        sa.Column("department", sa.String(64), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_pick_task_task_number", "pick_task", ["task_number"])
    op.create_index("ix_pick_task_request_id", "pick_task", ["request_id"])


def downgrade() -> None:
    op.drop_table("pick_task")
    op.drop_table("stock_reservation")
    op.drop_column("material_request", "approved_at")
    op.drop_column("material_request", "approved_by")
