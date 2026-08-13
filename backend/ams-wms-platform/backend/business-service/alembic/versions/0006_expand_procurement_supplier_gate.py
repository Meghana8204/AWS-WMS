"""Expand procurement, supplier management, and gate entry tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Suppliers table
    op.create_table(
        "suppliers",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("supplier_code", sa.String(64), nullable=False, unique=True),
        sa.Column("supplier_name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(100), nullable=False, server_default="General"),
        sa.Column("contact_person", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("gst_number", sa.String(100), nullable=True),
        sa.Column("payment_terms", sa.String(100), nullable=True, server_default="NET30"),
        sa.Column("bank_details", sa.String(500), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="ACTIVE"),
        sa.Column("on_time_delivery_rate", sa.Float(), nullable=False, server_default="100.0"),
        sa.Column("quality_score", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("total_orders_fulfilled", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # 2. Material Requests & Items
    op.create_table(
        "material_requests",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("request_number", sa.String(64), nullable=False, unique=True),
        sa.Column("warehouse_id", sa.String(64), nullable=False),
        sa.Column("department", sa.String(64), nullable=False),
        sa.Column("requested_by", sa.String(128), nullable=False),
        sa.Column("target_delivery_date", sa.Date(), nullable=False),
        sa.Column("priority", sa.String(32), nullable=False, server_default="MEDIUM"),
        sa.Column("status", sa.String(32), nullable=False, server_default="DRAFT"),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "material_request_items",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("material_request_id", sa.String(64), sa.ForeignKey("material_requests.id"), nullable=False),
        sa.Column("material_code", sa.String(64), nullable=False),
        sa.Column("material_name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(64), nullable=False, server_default="Raw Material"),
        sa.Column("unit_of_measure", sa.String(32), nullable=False, server_default="PCS"),
        sa.Column("requested_qty", sa.Numeric(18, 4), nullable=False),
        sa.Column("estimated_unit_cost", sa.Numeric(18, 4), nullable=False, server_default="0.00"),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    # 3. RFQs, Items, Suppliers
    op.create_table(
        "rfqs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("rfq_number", sa.String(64), nullable=False, unique=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("warehouse_id", sa.String(64), nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="DRAFT"),
        sa.Column("material_request_ids", sa.Text(), nullable=True),
        sa.Column("terms_and_conditions", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "rfq_items",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("rfq_id", sa.String(64), sa.ForeignKey("rfqs.id"), nullable=False),
        sa.Column("material_code", sa.String(64), nullable=False),
        sa.Column("material_name", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False),
        sa.Column("unit_of_measure", sa.String(32), nullable=False, server_default="PCS"),
    )

    op.create_table(
        "rfq_suppliers",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("rfq_id", sa.String(64), sa.ForeignKey("rfqs.id"), nullable=False),
        sa.Column("supplier_id", sa.String(64), nullable=False),
        sa.Column("supplier_code", sa.String(64), nullable=False),
        sa.Column("supplier_name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="INVITED"),
    )

    # 4. Supplier Quotations & Items
    op.create_table(
        "supplier_quotations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("quotation_number", sa.String(64), nullable=False, unique=True),
        sa.Column("rfq_id", sa.String(64), nullable=False),
        sa.Column("supplier_id", sa.String(64), nullable=False),
        sa.Column("supplier_code", sa.String(64), nullable=False),
        sa.Column("supplier_name", sa.String(255), nullable=False),
        sa.Column("submission_date", sa.Date(), nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("valid_until", sa.Date(), nullable=False),
        sa.Column("payment_terms", sa.String(64), nullable=False, server_default="NET30"),
        sa.Column("delivery_lead_time_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("status", sa.String(32), nullable=False, server_default="SUBMITTED"),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "quotation_items",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("quotation_id", sa.String(64), sa.ForeignKey("supplier_quotations.id"), nullable=False),
        sa.Column("material_code", sa.String(64), nullable=False),
        sa.Column("material_name", sa.String(255), nullable=False),
        sa.Column("offered_qty", sa.Numeric(18, 4), nullable=False),
        sa.Column("unit_price", sa.Numeric(18, 4), nullable=False),
        sa.Column("tax_rate", sa.Numeric(5, 4), nullable=False, server_default="0.18"),
        sa.Column("discount_percent", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
    )

    # 5. Finance Approvals
    op.create_table(
        "finance_approvals",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("po_id", sa.String(64), nullable=False),
        sa.Column("po_number", sa.String(64), nullable=False),
        sa.Column("total_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("requested_by", sa.String(128), nullable=False),
        sa.Column("budget_code", sa.String(64), nullable=True),
        sa.Column("currency", sa.String(8), nullable=False, server_default="USD"),
        sa.Column("status", sa.String(32), nullable=False, server_default="PENDING"),
        sa.Column("approver_id", sa.String(64), nullable=True),
        sa.Column("approver_name", sa.String(128), nullable=True),
        sa.Column("approval_notes", sa.Text(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # Add extra linkage columns to purchase_order table
    op.add_column("purchase_order", sa.Column("payment_terms", sa.String(64), nullable=True, server_default="NET30"))
    op.add_column("purchase_order", sa.Column("rfq_id", sa.String(64), nullable=True))
    op.add_column("purchase_order", sa.Column("quotation_id", sa.String(64), nullable=True))
    op.add_column("purchase_order", sa.Column("finance_approval_id", sa.String(64), nullable=True))

    # 6. Supplier ASNs & Items
    op.create_table(
        "supplier_asns",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("asn_number", sa.String(64), nullable=False, unique=True),
        sa.Column("po_id", sa.String(64), nullable=False),
        sa.Column("po_number", sa.String(64), nullable=False),
        sa.Column("supplier_id", sa.String(64), nullable=False),
        sa.Column("supplier_name", sa.String(255), nullable=False),
        sa.Column("warehouse_id", sa.String(64), nullable=False),
        sa.Column("shipped_date", sa.Date(), nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("expected_arrival_date", sa.Date(), nullable=False),
        sa.Column("transporter_name", sa.String(128), nullable=False),
        sa.Column("tracking_number", sa.String(128), nullable=False),
        sa.Column("vehicle_number", sa.String(64), nullable=False),
        sa.Column("driver_name", sa.String(128), nullable=True),
        sa.Column("driver_phone", sa.String(32), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="SUBMITTED"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "asn_items",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("asn_id", sa.String(64), sa.ForeignKey("supplier_asns.id"), nullable=False),
        sa.Column("po_item_id", sa.String(64), nullable=False),
        sa.Column("material_code", sa.String(64), nullable=False),
        sa.Column("material_name", sa.String(255), nullable=False),
        sa.Column("ordered_qty", sa.Numeric(18, 4), nullable=False),
        sa.Column("shipped_qty", sa.Numeric(18, 4), nullable=False),
        sa.Column("unit_of_measure", sa.String(32), nullable=False, server_default="PCS"),
        sa.Column("batch_number", sa.String(64), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
    )

    # 7. Arrival Notifications
    op.create_table(
        "arrival_notifications",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("asn_id", sa.String(64), nullable=False),
        sa.Column("asn_number", sa.String(64), nullable=False),
        sa.Column("po_id", sa.String(64), nullable=False),
        sa.Column("po_number", sa.String(64), nullable=False),
        sa.Column("warehouse_id", sa.String(64), nullable=False),
        sa.Column("supplier_name", sa.String(255), nullable=False),
        sa.Column("vehicle_number", sa.String(64), nullable=False),
        sa.Column("expected_arrival_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("driver_phone", sa.String(32), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="DISPATCHED"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # 8. Gate Entries
    op.create_table(
        "gate_entries",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("gate_entry_number", sa.String(64), nullable=False, unique=True),
        sa.Column("warehouse_id", sa.String(64), nullable=False),
        sa.Column("vehicle_number", sa.String(64), nullable=False),
        sa.Column("supplier_name", sa.String(255), nullable=False),
        sa.Column("driver_name", sa.String(128), nullable=False),
        sa.Column("driver_phone", sa.String(32), nullable=False),
        sa.Column("asn_id", sa.String(64), nullable=True),
        sa.Column("asn_number", sa.String(64), nullable=True),
        sa.Column("po_id", sa.String(64), nullable=True),
        sa.Column("po_number", sa.String(64), nullable=True),
        sa.Column("supplier_id", sa.String(64), nullable=True),
        sa.Column("assigned_dock_id", sa.String(64), nullable=True),
        sa.Column("security_officer_id", sa.String(64), nullable=True),
        sa.Column("verification_notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="CHECKED_IN"),
        sa.Column("entry_time", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("exit_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("gross_weight_kg", sa.Numeric(18, 2), nullable=False, server_default="0.00"),
        sa.Column("tare_weight_kg", sa.Numeric(18, 2), nullable=False, server_default="0.00"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def downgrade() -> None:
    op.drop_table("gate_entries")
    op.drop_table("arrival_notifications")
    op.drop_table("asn_items")
    op.drop_table("supplier_asns")

    op.drop_column("purchase_order", "finance_approval_id")
    op.drop_column("purchase_order", "quotation_id")
    op.drop_column("purchase_order", "rfq_id")
    op.drop_column("purchase_order", "payment_terms")

    op.drop_table("finance_approvals")
    op.drop_table("quotation_items")
    op.drop_table("supplier_quotations")
    op.drop_table("rfq_suppliers")
    op.drop_table("rfq_items")
    op.drop_table("rfqs")
    op.drop_table("material_request_items")
    op.drop_table("material_requests")
    op.drop_table("suppliers")
