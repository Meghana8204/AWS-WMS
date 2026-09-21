"""add notification details

Revision ID: 246123db4a01

Revises: 20260831_ensure_mat_cols

Create Date: 2026-09-01 13:45:51.153337

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "246123db4a01"

down_revision: Union[str, None] = "20260831_ensure_mat_cols"

branch_labels: Union[str, Sequence[str], None] = None

depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "notification" not in existing_tables:
        op.create_table(
            "notification",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_role", sa.String(length=32), nullable=False),
            sa.Column("title", sa.String(length=256), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("link", sa.String(length=512), nullable=True),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("dock_code", sa.String(length=64), nullable=True),
            sa.Column("dock_name", sa.String(length=128), nullable=True),
            sa.Column("dock_location", sa.String(length=256), nullable=True),
            sa.Column("dock_type", sa.String(length=64), nullable=True),
            sa.Column("warehouse_name", sa.String(length=128), nullable=True),
            sa.Column("allocation_time", sa.DateTime(), nullable=True),
            sa.Column("gate_pass_number", sa.String(length=64), nullable=True),
            sa.Column("vehicle_number", sa.String(length=64), nullable=True),
            sa.Column("driver_name", sa.String(length=128), nullable=True),
            sa.Column("driver_phone", sa.String(length=32), nullable=True),
            sa.Column("asn_number", sa.String(length=64), nullable=True),
            sa.Column("po_number", sa.String(length=64), nullable=True),
            sa.Column("grn_number", sa.String(length=64), nullable=True),
            sa.Column("supplier_name", sa.String(length=255), nullable=True),
            sa.Column("notification_type", sa.String(length=64), nullable=True),
            sa.Column("idempotency_key", sa.String(length=255), nullable=True),
            sa.Column("payload_json", sa.Text(), nullable=True),
        )
    else:
        notification_cols = {
            column["name"]
            for column in inspector.get_columns("notification")
        }
        detail_cols = [
            ("dock_code", sa.String(length=64)),
            ("dock_name", sa.String(length=128)),
            ("dock_location", sa.String(length=256)),
            ("dock_type", sa.String(length=64)),
            ("warehouse_name", sa.String(length=128)),
            ("allocation_time", sa.DateTime()),
            ("gate_pass_number", sa.String(length=64)),
            ("vehicle_number", sa.String(length=64)),
            ("driver_name", sa.String(length=128)),
            ("driver_phone", sa.String(length=32)),
            ("asn_number", sa.String(length=64)),
            ("po_number", sa.String(length=64)),
            ("grn_number", sa.String(length=64)),
            ("supplier_name", sa.String(length=255)),
            ("notification_type", sa.String(length=64)),
            ("idempotency_key", sa.String(length=255)),
            ("payload_json", sa.Text()),
        ]
        for col_name, col_type in detail_cols:
            if col_name not in notification_cols:
                op.add_column(
                    "notification",
                    sa.Column(col_name, col_type, nullable=True),
                )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "notification" not in existing_tables:
        return

    notification_cols = {
        column["name"]
        for column in inspector.get_columns("notification")
    }

    columns_to_remove = [
        "payload_json",
        "idempotency_key",
        "notification_type",
        "supplier_name",
        "grn_number",
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