import uuid

from app.modules.procurement.domain.value_objects import SupplierId


def test_new_supplier_id_is_database_compatible_uuid() -> None:
    supplier_id = SupplierId.new_id(1)

    assert uuid.UUID(supplier_id.value)
