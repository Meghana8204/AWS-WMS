"""Persist complete material-master fields.

Revision ID: 20260904_material_master
Revises: 20260903_material_identity
"""
from alembic import op
import sqlalchemy as sa

revision = "20260904_material_master"
down_revision = "20260903_material_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("material", sa.Column("sub_category", sa.String(64), nullable=True))
    op.add_column("material", sa.Column("material_type", sa.String(64), nullable=False, server_default="Raw Material"))
    op.add_column("material", sa.Column("uom", sa.String(32), nullable=False, server_default="Nos"))
    op.add_column("material", sa.Column("status", sa.String(16), nullable=False, server_default="Active"))


def downgrade() -> None:
    op.drop_column("material", "status")
    op.drop_column("material", "uom")
    op.drop_column("material", "material_type")
    op.drop_column("material", "sub_category")
