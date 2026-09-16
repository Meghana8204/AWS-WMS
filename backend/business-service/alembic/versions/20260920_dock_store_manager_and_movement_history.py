"""add store manager assignment to dock allocation and create inventory_movement_history table

Revision ID: 20260920_dock_sm_move_hist
Revises: 20260919_chem_store_only
Create Date: 2026-09-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260920_dock_sm_move_hist"
down_revision: Union[str, None] = "20260919_chem_store_only"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add Store Manager columns to dock_allocation_requests
    op.add_column("dock_allocation_requests", sa.Column("assigned_store_manager_id", sa.String(128), nullable=True))
    op.add_column("dock_allocation_requests", sa.Column("assigned_store_manager_username", sa.String(128), nullable=True))
    op.add_column("dock_allocation_requests", sa.Column("assigned_store_manager_name", sa.String(128), nullable=True))
    op.create_index("ix_dock_allocation_requests_assigned_sm_id", "dock_allocation_requests", ["assigned_store_manager_id"])
    op.create_index("ix_dock_allocation_requests_assigned_sm_user", "dock_allocation_requests", ["assigned_store_manager_username"])

    # 2. Add Store Manager columns to dock_assignment
    op.add_column("dock_assignment", sa.Column("assigned_store_manager_id", sa.String(128), nullable=True))
    op.add_column("dock_assignment", sa.Column("assigned_store_manager_username", sa.String(128), nullable=True))
    op.add_column("dock_assignment", sa.Column("assigned_store_manager_name", sa.String(128), nullable=True))
    op.create_index("ix_dock_assignment_assigned_sm_id", "dock_assignment", ["assigned_store_manager_id"])
    op.create_index("ix_dock_assignment_assigned_sm_user", "dock_assignment", ["assigned_store_manager_username"])

    # 3. Create inventory_movement_history table
    op.create_table(
        "inventory_movement_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("movement_type", sa.String(32), nullable=False),
        sa.Column("material_code", sa.String(64), nullable=False),
        sa.Column("material_name", sa.String(256), nullable=False),
        sa.Column("material_qr", sa.String(128), nullable=True),
        sa.Column("grn_number", sa.String(64), nullable=True),
        sa.Column("batch_lot", sa.String(128), nullable=True),
        sa.Column("from_location", sa.String(128), nullable=False),
        sa.Column("to_location", sa.String(128), nullable=False),
        sa.Column("from_bin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("store_bin.id", ondelete="SET NULL"), nullable=True),
        sa.Column("to_bin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("store_bin.id", ondelete="SET NULL"), nullable=True),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False),
        sa.Column("uom", sa.String(32), nullable=False, server_default="PCS"),
        sa.Column("stock_before", sa.Numeric(18, 4), nullable=True),
        sa.Column("stock_after", sa.Numeric(18, 4), nullable=True),
        sa.Column("performed_by", sa.String(128), nullable=False),
        sa.Column("user_role", sa.String(64), nullable=True),
        sa.Column("warehouse_id", sa.String(64), nullable=False, server_default="MAIN"),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("store.id", ondelete="SET NULL"), nullable=True),
        sa.Column("store_code", sa.String(64), nullable=True),
        sa.Column("reference_document", sa.String(128), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("performed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_inv_move_hist_type", "inventory_movement_history", ["movement_type"])
    op.create_index("ix_inv_move_hist_mat_code", "inventory_movement_history", ["material_code"])
    op.create_index("ix_inv_move_hist_mat_qr", "inventory_movement_history", ["material_qr"])
    op.create_index("ix_inv_move_hist_grn", "inventory_movement_history", ["grn_number"])
    op.create_index("ix_inv_move_hist_user", "inventory_movement_history", ["performed_by"])
    op.create_index("ix_inv_move_hist_store_id", "inventory_movement_history", ["store_id"])
    op.create_index("ix_inv_move_hist_store_code", "inventory_movement_history", ["store_code"])


def downgrade() -> None:
    op.drop_table("inventory_movement_history")
    op.drop_index("ix_dock_assignment_assigned_sm_user", "dock_assignment")
    op.drop_index("ix_dock_assignment_assigned_sm_id", "dock_assignment")
    op.drop_column("dock_assignment", "assigned_store_manager_name")
    op.drop_column("dock_assignment", "assigned_store_manager_username")
    op.drop_column("dock_assignment", "assigned_store_manager_id")

    op.drop_index("ix_dock_allocation_requests_assigned_sm_user", "dock_allocation_requests")
    op.drop_index("ix_dock_allocation_requests_assigned_sm_id", "dock_allocation_requests")
    op.drop_column("dock_allocation_requests", "assigned_store_manager_name")
    op.drop_column("dock_allocation_requests", "assigned_store_manager_username")
    op.drop_column("dock_allocation_requests", "assigned_store_manager_id")
