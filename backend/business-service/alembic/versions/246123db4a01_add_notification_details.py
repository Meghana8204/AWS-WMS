"""add notification details

Revision ID: 246123db4a01
Revises: 20260831_ensure_mat_cols
Create Date: 2026-09-01 13:45:51.153337
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '246123db4a01'
down_revision: Union[str, None] = '20260831_ensure_mat_cols'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("notification", sa.Column("dock_code", sa.String(), nullable=True))
    op.add_column("notification", sa.Column("dock_name", sa.String(), nullable=True))
    op.add_column("notification", sa.Column("dock_location", sa.String(), nullable=True))
    op.add_column("notification", sa.Column("dock_type", sa.String(), nullable=True))
    op.add_column("notification", sa.Column("warehouse_name", sa.String(), nullable=True))
    op.add_column("notification", sa.Column("allocation_time", sa.DateTime(), nullable=True))
    op.add_column("notification", sa.Column("gate_pass_number", sa.String(), nullable=True))
    op.add_column("notification", sa.Column("vehicle_number", sa.String(), nullable=True))
    op.add_column("notification", sa.Column("driver_name", sa.String(), nullable=True))
    op.add_column("notification", sa.Column("driver_phone", sa.String(), nullable=True))
    op.add_column("notification", sa.Column("asn_number", sa.String(), nullable=True))
    op.add_column("notification", sa.Column("po_number", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("notification", "po_number")
    op.drop_column("notification", "asn_number")
    op.drop_column("notification", "driver_phone")
    op.drop_column("notification", "driver_name")
    op.drop_column("notification", "vehicle_number")
    op.drop_column("notification", "gate_pass_number")
    op.drop_column("notification", "allocation_time")
    op.drop_column("notification", "warehouse_name")
    op.drop_column("notification", "dock_type")
    op.drop_column("notification", "dock_location")
    op.drop_column("notification", "dock_name")
    op.drop_column("notification", "dock_code")