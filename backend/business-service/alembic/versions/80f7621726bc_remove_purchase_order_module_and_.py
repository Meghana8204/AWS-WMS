"""remove purchase order module and decouple asns

Revision ID: 80f7621726bc
Revises: 550255efe0aa
Create Date: 2026-08-14 13:20:20.403187
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '80f7621726bc'
down_revision: Union[str, None] = '550255efe0aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:


    op.drop_constraint('fk_asn_po_id_purchase_order', 'asn', type_='foreignkey')

    op.add_column('asn', sa.Column('po_number', sa.String(length=64), nullable=True))

    op.alter_column('asn', 'po_id', nullable=True)



    op.alter_column('arrival_notification', 'po_id', nullable=True, type_=sa.String(length=64))


    op.drop_table('purchase_order_approval_log')
    op.drop_table('purchase_order_line')
    op.drop_table('purchase_order')


def downgrade() -> None:


    pass
