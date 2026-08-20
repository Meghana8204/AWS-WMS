import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'supplier_po_backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from accounts.models import Role
from organization.models import Company
from warehouses.models import Warehouse
from masters.models import Category, UOM, Currency, PaymentTerm
from items.models import Item

User = get_user_model()

def seed():
    print("Seeding Enterprise Data...")

    # 1. Create Roles
    roles = [
        ("Admin", "System Administrator"),
        ("Procurement Officer", "PO Creation and Vendor Mgmt"),
        ("Procurement Manager", "PO and Supplier Approvals"),
        ("Supplier", "Vendor Portal Access"),
        ("Warehouse Receiver", "Goods Receiving Operations"),
        ("Warehouse Manager", "Warehouse Operations Management"),
        ("Warehouse Supervisor", "Floor Supervision"),
        ("Quality Inspector", "Quality Control and Inspection"),
        ("Document Control Officer", "Document and OCR Validation"),
        ("Finance Officer", "Invoicing and Three-Way Match"),
        ("Compliance/EHS Officer", "Safety and Compliance Audit"),
        ("Inventory Controller", "Inventory Accuracy and Allocation"),
        ("Logistics Manager", "Shipment and ASN Tracking"),
        ("Auditor", "System Audit and Reporting"),
    ]

    role_objs = {}
    for r_name, r_desc in roles:
        role, _ = Role.objects.get_or_create(name=r_name, defaults={"description": r_desc})
        role_objs[r_name] = role

    # 2. Create Users
    users = [
        ("admin", "admin@example.com", "Admin"),
        ("procurement", "procurement@example.com", "Procurement Officer"),
        ("manager", "manager@example.com", "Procurement Manager"),
        ("supplier_user", "supplier@example.com", "Supplier"),
        ("warehouse", "warehouse@example.com", "Warehouse Manager"),
        ("quality", "quality@example.com", "Quality Inspector"),
        ("finance", "finance@example.com", "Finance Officer"),
        ("auditor", "auditor@example.com", "Auditor"),
    ]

    for username, email, role_name in users:
        if not User.objects.filter(username=username).exists():
            u = User.objects.create_user(
                username=username,
                email=email,
                password="password123",
                first_name=username.capitalize()
            )
            u.roles.add(role_objs[role_name])
            if username == "admin":
                u.is_staff = True
                u.is_superuser = True
                u.save()
            print(f"User created: {username} ({role_name})")

    # 3. Organization Master
    company, _ = Company.objects.get_or_create(
        company_code="CORP-001",
        defaults={
            "company_name": "ProcureHQ Global",
            "legal_name": "ProcureHQ Global Solutions Ltd",
            "country": "India",
            "base_currency": "INR",
            "status": "ACTIVE"
        }
    )

    # 4. Warehouse Master
    Warehouse.objects.get_or_create(
        warehouse_code="WH-NORTH",
        defaults={
            "warehouse_name": "North Regional Hub",
            "company": company,
            "address": "123 Industrial Area, North City",
            "country": "India",
            "status": "ACTIVE"
        }
    )
    Warehouse.objects.get_or_create(
        warehouse_code="WH-SOUTH",
        defaults={
            "warehouse_name": "South Logistics Center",
            "company": company,
            "address": "456 Port Road, South City",
            "country": "India",
            "status": "ACTIVE"
        }
    )

    # 5. Masters
    uoms = [("UNIT", "Unit", "U"), ("KG", "Kilogram", "kg"), ("METER", "Meter", "m")]
    uom_objs = {}
    for code, name, symbol in uoms:
        uom, _ = UOM.objects.get_or_create(code=code, defaults={"name": name, "symbol": symbol})
        uom_objs[code] = uom

    currencies = [("INR", "Indian Rupee", "₹"), ("USD", "US Dollar", "$")]
    for code, name, symbol in currencies:
        Currency.objects.get_or_create(code=code, defaults={"name": name, "symbol": symbol})

    payment_terms = [
        ("IMMEDIATE", "Due on Receipt", 0),
        ("NET_30", "Net 30", 30),
        ("NET_60", "Net 60", 60),
    ]
    for code, name, days in payment_terms:
        PaymentTerm.objects.get_or_create(code=code, defaults={"name": name, "days": days})

    categories = [
        "Transformer Components", "Switchgear Components", "UPS Components",
        "Battery", "Cable", "Connector"
    ]
    cat_objs = {}
    for c_name in categories:
        cat, _ = Category.objects.get_or_create(
            code=c_name.upper().replace(" ", "_"),
            defaults={"name": c_name, "status": "ACTIVE"}
        )
        cat_objs[c_name] = cat

    # 6. Items
    items = [
        ("Transformer Core", "TRANS_CORE_01", "Transformer Components", "UNIT", True, False),
        ("Switchgear Panel", "SW_PANEL_01", "Switchgear Components", "UNIT", True, False),
        ("UPS Control Board", "UPS_CTRL_01", "UPS Components", "UNIT", True, False),
        ("Battery Cell", "BATT_CELL_01", "Battery", "UNIT", False, True),
        ("Copper Cable", "CABLE_CU_01", "Cable", "METER", False, True),
        ("Connector", "CONN_IND_01", "Connector", "UNIT", False, False),
    ]

    for name, code, cat_name, uom_code, serial, batch in items:
        Item.objects.get_or_create(
            item_code=code,
            defaults={
                "item_name": name,
                "category": cat_objs[cat_name],
                "uom": uom_objs[uom_code],
                "serial_controlled": serial,
                "batch_controlled": batch,
            }
        )

    print("Seeding Complete.")

if __name__ == "__main__":
    seed()
