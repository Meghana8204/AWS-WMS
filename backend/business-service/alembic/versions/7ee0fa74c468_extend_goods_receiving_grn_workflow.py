"""Extend Goods Receiving / GRN workflow.

Revision ID: 7ee0fa74c468
Revises: 20260820_putaway_operator
Create Date: 2026-08-27

This migration intentionally contains GRN/receiving changes only.
It does NOT drop or modify Storage, Putaway, Handling Unit,
Procurement, Supplier, RFQ, Notification, or unrelated tables.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7ee0fa74c468"
down_revision: Union[str, None] = "20260820_putaway_operator"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _assert_one_grn_per_po() -> None:
    """Fail with a clear message before unique PO indexes are created."""

    bind = op.get_bind()

    duplicate_po_id = bind.execute(
        sa.text(
            """
            SELECT po_id
            FROM grn
            WHERE po_id IS NOT NULL
            GROUP BY po_id
            HAVING COUNT(*) > 1
            LIMIT 1
            """
        )
    ).first()

    if duplicate_po_id is not None:
        raise RuntimeError(
            "Cannot enforce one-PO-one-GRN: duplicate non-null po_id "
            f"exists in grn: {duplicate_po_id[0]}"
        )

    duplicate_po_number = bind.execute(
        sa.text(
            """
            SELECT po_number
            FROM grn
            WHERE po_number IS NOT NULL
            GROUP BY po_number
            HAVING COUNT(*) > 1
            LIMIT 1
            """
        )
    ).first()

    if duplicate_po_number is not None:
        raise RuntimeError(
            "Cannot enforce one-PO-one-GRN: duplicate non-null po_number "
            f"exists in grn: {duplicate_po_number[0]}"
        )


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Pre-check one PO -> one GRN rule
    # ------------------------------------------------------------------

    _assert_one_grn_per_po()

    # ------------------------------------------------------------------
    # 2. GRN document uploads
    # ------------------------------------------------------------------

    op.create_table(
        "grn_document",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("grn_id", sa.UUID(), nullable=False),
        sa.Column("document_type", sa.String(length=64), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("uploaded_by", sa.String(length=128), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["grn_id"],
            ["grn.id"],
            name="fk_grn_document_grn_id_grn",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name="pk_grn_document",
        ),
    )

    op.create_index(
        "ix_grn_document_grn_id",
        "grn_document",
        ["grn_id"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 3. GRN batches
    # ------------------------------------------------------------------

    op.create_table(
        "grn_batch",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("grn_line_id", sa.UUID(), nullable=False),
        sa.Column("batch_number", sa.String(length=64), nullable=False),
        sa.Column(
            "batch_quantity",
            sa.Numeric(precision=18, scale=4),
            nullable=False,
        ),
        sa.Column("created_by", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["grn_line_id"],
            ["grn_line.id"],
            name="fk_grn_batch_grn_line_id_grn_line",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name="pk_grn_batch",
        ),
    )

    op.create_index(
        "ix_grn_batch_batch_number",
        "grn_batch",
        ["batch_number"],
        unique=True,
    )

    op.create_index(
        "ix_grn_batch_grn_line_id",
        "grn_batch",
        ["grn_line_id"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 4. Damage evidence / multiple photos
    # ------------------------------------------------------------------

    op.create_table(
        "grn_damage_evidence",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("grn_line_id", sa.UUID(), nullable=False),
        sa.Column(
            "damaged_quantity",
            sa.Numeric(precision=18, scale=4),
            nullable=False,
        ),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("uploaded_by", sa.String(length=128), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["grn_line_id"],
            ["grn_line.id"],
            name="fk_grn_damage_evidence_grn_line_id_grn_line",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name="pk_grn_damage_evidence",
        ),
    )

    op.create_index(
        "ix_grn_damage_evidence_grn_line_id",
        "grn_damage_evidence",
        ["grn_line_id"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 5. One batch -> one QR code
    # ------------------------------------------------------------------

    op.create_table(
        "grn_batch_qr",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("batch_id", sa.UUID(), nullable=False),
        sa.Column("qr_code", sa.String(length=128), nullable=False),
        sa.Column("qr_payload", sa.Text(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["grn_batch.id"],
            name="fk_grn_batch_qr_batch_id_grn_batch",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name="pk_grn_batch_qr",
        ),
    )

    op.create_index(
        "ix_grn_batch_qr_batch_id",
        "grn_batch_qr",
        ["batch_id"],
        unique=True,
    )

    op.create_index(
        "ix_grn_batch_qr_qr_code",
        "grn_batch_qr",
        ["qr_code"],
        unique=True,
    )

    # ------------------------------------------------------------------
    # 6. GRN header fields
    # ------------------------------------------------------------------

    op.add_column(
        "grn",
        sa.Column(
            "gate_entry_id",
            sa.UUID(),
            nullable=True,
        ),
    )

    op.add_column(
        "grn",
        sa.Column(
            "gate_entry_number",
            sa.String(length=64),
            nullable=True,
        ),
    )

    op.add_column(
        "grn",
        sa.Column(
            "supplier_company_name",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.add_column(
        "grn",
        sa.Column(
            "warehouse_name",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.add_column(
        "grn",
        sa.Column(
            "driver_name",
            sa.String(length=128),
            nullable=True,
        ),
    )

    op.add_column(
        "grn",
        sa.Column(
            "invoice_number",
            sa.String(length=128),
            nullable=True,
        ),
    )

    op.add_column(
        "grn",
        sa.Column(
            "receipt_type",
            sa.String(length=32),
            server_default="PO_RECEIPT",
            nullable=False,
        ),
    )

    op.add_column(
        "grn",
        sa.Column(
            "receipt_date",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "grn",
        sa.Column(
            "received_by",
            sa.String(length=128),
            nullable=True,
        ),
    )

    # Existing GRNs may already contain rows. Add temporary DB defaults
    # so PostgreSQL can populate existing records safely, then remove the
    # defaults because the ORM supplies these values for new rows.
    op.add_column(
        "grn",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )

    op.add_column(
        "grn",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )

    op.alter_column(
        "grn",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=None,
        nullable=False,
    )

    op.alter_column(
        "grn",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=None,
        nullable=False,
    )

    # One PO -> one GRN.
    # PostgreSQL permits multiple NULL values in a normal unique index,
    # which keeps UNEXPECTED_DELIVERY rows possible.
    op.create_index(
        "ix_grn_po_id",
        "grn",
        ["po_id"],
        unique=True,
    )

    op.create_index(
        "ix_grn_po_number",
        "grn",
        ["po_number"],
        unique=True,
    )

    # ------------------------------------------------------------------
    # 7. GRN line workflow fields
    # ------------------------------------------------------------------

    op.add_column(
        "grn_line",
        sa.Column(
            "material_category",
            sa.String(length=128),
            nullable=True,
        ),
    )

    op.add_column(
        "grn_line",
        sa.Column(
            "good_quantity",
            sa.Numeric(precision=18, scale=4),
            server_default="0",
            nullable=False,
        ),
    )

    op.add_column(
        "grn_line",
        sa.Column(
            "quality_approved_quantity",
            sa.Numeric(precision=18, scale=4),
            server_default="0",
            nullable=False,
        ),
    )

    op.add_column(
        "grn_line",
        sa.Column(
            "balance_quantity",
            sa.Numeric(precision=18, scale=4),
            server_default="0",
            nullable=False,
        ),
    )

    # Older rows may contain NULL for these columns.
    op.execute(
        """
        UPDATE grn_line
        SET damaged_quantity = 0
        WHERE damaged_quantity IS NULL
        """
    )

    op.execute(
        """
        UPDATE grn_line
        SET rejected_quantity = 0
        WHERE rejected_quantity IS NULL
        """
    )

    op.alter_column(
        "grn_line",
        "damaged_quantity",
        existing_type=sa.Numeric(precision=18, scale=4),
        nullable=False,
        server_default="0",
    )

    op.alter_column(
        "grn_line",
        "rejected_quantity",
        existing_type=sa.Numeric(precision=18, scale=4),
        nullable=False,
        server_default="0",
    )

    op.create_index(
        "ix_grn_line_grn_id",
        "grn_line",
        ["grn_id"],
        unique=False,
    )

    op.create_index(
        "ix_grn_line_item_code",
        "grn_line",
        ["item_code"],
        unique=False,
    )

    # Existing FK is the same relationship but without ON DELETE CASCADE.
    op.drop_constraint(
        "fk_grn_line_grn_id_grn",
        "grn_line",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "fk_grn_line_grn_id_grn",
        "grn_line",
        "grn",
        ["grn_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # ------------------------------------------------------------------
    # Reverse GRN line FK/index/columns
    # ------------------------------------------------------------------

    op.drop_constraint(
        "fk_grn_line_grn_id_grn",
        "grn_line",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "fk_grn_line_grn_id_grn",
        "grn_line",
        "grn",
        ["grn_id"],
        ["id"],
    )

    op.drop_index(
        "ix_grn_line_item_code",
        table_name="grn_line",
    )

    op.drop_index(
        "ix_grn_line_grn_id",
        table_name="grn_line",
    )

    op.alter_column(
        "grn_line",
        "rejected_quantity",
        existing_type=sa.Numeric(precision=18, scale=4),
        nullable=True,
        server_default=None,
    )

    op.alter_column(
        "grn_line",
        "damaged_quantity",
        existing_type=sa.Numeric(precision=18, scale=4),
        nullable=True,
        server_default=None,
    )

    op.drop_column(
        "grn_line",
        "balance_quantity",
    )

    op.drop_column(
        "grn_line",
        "quality_approved_quantity",
    )

    op.drop_column(
        "grn_line",
        "good_quantity",
    )

    op.drop_column(
        "grn_line",
        "material_category",
    )

    # ------------------------------------------------------------------
    # Reverse GRN header fields
    # ------------------------------------------------------------------

    op.drop_index(
        "ix_grn_po_number",
        table_name="grn",
    )

    op.drop_index(
        "ix_grn_po_id",
        table_name="grn",
    )

    op.drop_column("grn", "updated_at")
    op.drop_column("grn", "created_at")
    op.drop_column("grn", "received_by")
    op.drop_column("grn", "receipt_date")
    op.drop_column("grn", "receipt_type")
    op.drop_column("grn", "invoice_number")
    op.drop_column("grn", "driver_name")
    op.drop_column("grn", "warehouse_name")
    op.drop_column("grn", "supplier_company_name")
    op.drop_column("grn", "gate_entry_number")
    op.drop_column("grn", "gate_entry_id")

    # ------------------------------------------------------------------
    # Reverse new child tables in dependency order
    # ------------------------------------------------------------------

    op.drop_index(
        "ix_grn_batch_qr_qr_code",
        table_name="grn_batch_qr",
    )

    op.drop_index(
        "ix_grn_batch_qr_batch_id",
        table_name="grn_batch_qr",
    )

    op.drop_table("grn_batch_qr")

    op.drop_index(
        "ix_grn_damage_evidence_grn_line_id",
        table_name="grn_damage_evidence",
    )

    op.drop_table("grn_damage_evidence")

    op.drop_index(
        "ix_grn_batch_grn_line_id",
        table_name="grn_batch",
    )

    op.drop_index(
        "ix_grn_batch_batch_number",
        table_name="grn_batch",
    )

    op.drop_table("grn_batch")

    op.drop_index(
        "ix_grn_document_grn_id",
        table_name="grn_document",
    )

    op.drop_table("grn_document")
