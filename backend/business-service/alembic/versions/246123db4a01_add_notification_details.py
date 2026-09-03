"""add notification details

Revision ID: 246123db4a01

Revises: 20260831_ensure_mat_cols

Create Date: 2026-09-01 13:45:51.153337

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "246123db4a01"

down_revision: Union[str, None] = "20260831_ensure_mat_cols"

branch_labels: Union[str, Sequence[str], None] = None

depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    notification_cols = {
        column["name"]
        for column in inspector.get_columns("notification")
    }

    if "dock_code" not in notification_cols:
        op.add_column(
            "notification",
            sa.Column("dock_code", sa.String(), nullable=True),
        )

    if "dock_name" not in notification_cols:
        op.add_column(
            "notification",
            sa.Column("dock_name", sa.String(), nullable=True),
        )

    if "dock_location" not in notification_cols:
        op.add_column(
            "notification",
            sa.Column("dock_location", sa.String(), nullable=True),
        )

    if "dock_type" not in notification_cols:
        op.add_column(
            "notification",
            sa.Column("dock_type", sa.String(), nullable=True),
        )

    if "warehouse_name" not in notification_cols:
        op.add_column(
            "notification",
            sa.Column("warehouse_name", sa.String(), nullable=True),
        )

    if "allocation_time" not in notification_cols:
        op.add_column(
            "notification",
            sa.Column("allocation_time", sa.DateTime(), nullable=True),
        )

    if "gate_pass_number" not in notification_cols:
        op.add_column(
            "notification",
            sa.Column("gate_pass_number", sa.String(), nullable=True),
        )

    if "vehicle_number" not in notification_cols:
        op.add_column(
            "notification",
            sa.Column("vehicle_number", sa.String(), nullable=True),
        )

    if "driver_name" not in notification_cols:
        op.add_column(
            "notification",
            sa.Column("driver_name", sa.String(), nullable=True),
        )

    if "driver_phone" not in notification_cols:
        op.add_column(
            "notification",
            sa.Column("driver_phone", sa.String(), nullable=True),
        )

    if "asn_number" not in notification_cols:
        op.add_column(
            "notification",
            sa.Column("asn_number", sa.String(), nullable=True),
        )

    if "po_number" not in notification_cols:
        op.add_column(
            "notification",
            sa.Column("po_number", sa.String(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    notification_cols = {
        column["name"]
        for column in inspector.get_columns("notification")
    }

    columns_to_remove = [
        "po_number",
        "asn_number",
        "driver_phone",
        "driver_name",
        "vehicle_number",
        "gate_pass_number",
        "allocation_time",
        "warehouse_name",
        "dock_type",
        "dock_location",
        "dock_name",
        "dock_code",
    ]

    for column_name in columns_to_remove:
        if column_name in notification_cols:
            op.drop_column("notification", column_name)