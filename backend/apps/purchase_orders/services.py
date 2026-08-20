from django.db import transaction
from .models import PurchaseOrder, POVersion, POLineItem
import json
from django.core.serializers.json import DjangoJSONEncoder

class POVersioningService:
    @staticmethod
    @transaction.atomic
    def create_version(po, change_reason, user):
        # 1. Create a snapshot of current data
        snapshot = {
            "header": {
                "po_number": po.po_number,
                "po_type": po.po_type,
                "expected_delivery_date": po.expected_delivery_date.isoformat(),
                "total_amount": str(po.total_amount),
                "status": po.status,
            },
            "lines": [
                {
                    "item_id": str(line.item.id),
                    "quantity": str(line.quantity),
                    "unit_price": str(line.unit_price),
                    "line_total": str(line.line_total),
                } for line in po.lines.all()
            ]
        }

        # 2. Save version
        version = POVersion.objects.create(
            purchase_order=po,
            version_number=po.version,
            snapshot_data=snapshot,
            change_reason=change_reason,
            changed_by=user
        )

        # 3. Increment PO version
        po.version += 1
        po.is_amended = True
        po.save()

        return version
