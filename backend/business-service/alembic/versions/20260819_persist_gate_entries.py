"""Persist complete gate-entry details.

Revision ID: 20260819_gate
Revises: 8c4c48db6de0
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260819_gate"
down_revision = "8c4c48db6de0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("gate_entry", sa.Column("gate_entry_number", sa.String(64), nullable=True))
    op.add_column("gate_entry", sa.Column("po_document_data", sa.LargeBinary(), nullable=True))
    op.add_column("gate_entry", sa.Column("vehicle_photo_data", sa.LargeBinary(), nullable=True))
    op.add_column("gate_entry", sa.Column("ocr_line_items", postgresql.JSONB(), nullable=True))
    op.execute("UPDATE gate_entry SET gate_entry_number = 'GE-LEGACY-' || upper(substr(replace(id::text, '-', ''), 1, 12)) WHERE gate_entry_number IS NULL")
    op.alter_column("gate_entry", "gate_entry_number", nullable=False)
    op.create_index("ix_gate_entry_gate_entry_number", "gate_entry", ["gate_entry_number"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_gate_entry_gate_entry_number", table_name="gate_entry")
    op.drop_column("gate_entry", "ocr_line_items")
    op.drop_column("gate_entry", "vehicle_photo_data")
    op.drop_column("gate_entry", "po_document_data")
    op.drop_column("gate_entry", "gate_entry_number")
