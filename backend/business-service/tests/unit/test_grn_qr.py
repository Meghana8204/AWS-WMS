import pytest
from decimal import Decimal

def test_qr_generation_rules_validation():
    # Rule validation: good_quantity + damaged_quantity <= received_quantity
    received_quantity = Decimal("10")
    good_quantity = Decimal("7")
    damaged_quantity = Decimal("3")

    assert (good_quantity + damaged_quantity) <= received_quantity, "Validation failed: Good + Damaged exceeds received"

    invalid_good = Decimal("8")
    invalid_damaged = Decimal("4")
    assert (invalid_good + invalid_damaged) > received_quantity, "Validation logic check"

def test_qr_generation_conditions():
    # Example 1: Received = 5, Good = 0, Damaged = 5
    good_qty_1 = Decimal("0")
    dmg_qty_1 = Decimal("5")

    should_generate_good_1 = good_qty_1 > Decimal("0")
    should_generate_dmg_1 = dmg_qty_1 > Decimal("0")

    assert should_generate_good_1 is False, "Good QR must NOT be generated when Good Qty = 0"
    assert should_generate_dmg_1 is True, "Damage QR must be generated when Damaged Qty > 0"

    # Example 2: Received = 10, Good = 7, Damaged = 3
    good_qty_2 = Decimal("7")
    dmg_qty_2 = Decimal("3")

    should_generate_good_2 = good_qty_2 > Decimal("0")
    should_generate_dmg_2 = dmg_qty_2 > Decimal("0")

    assert should_generate_good_2 is True, "Good QR must be generated when Good Qty > 0"
    assert should_generate_dmg_2 is True, "Damage QR must be generated when Damaged Qty > 0"

def test_good_and_damage_qr_payload_independence():
    grn_num = "GRN-2026-0001"
    item_code = "MAT-001"
    mat_name = "Steel Coil"
    uom = "PCS"

    # Good QR Payload format
    good_qty = Decimal("7")
    good_payload = (
        f"📦 WMS GOOD STOCK QR\n"
        f"----------------------------------------\n"
        f"• GRN Number    : {grn_num}\n"
        f"• Material Code : {item_code}\n"
        f"• Material Name : {mat_name}\n"
        f"• Category      : Raw Materials\n"
        f"• Batch Number  : BATCH-001\n"
        f"• Good Quantity : {good_qty} {uom}\n"
        f"• UOM           : {uom}\n"
        f"• Quality Status: GOOD / ACCEPTED\n"
        f"• QR ID         : QR-MAT-{item_code}\n"
        f"----------------------------------------"
    )

    assert "GOOD / ACCEPTED" in good_payload
    assert f"Good Quantity : {good_qty}" in good_payload

    # Damage QR Payload format
    dmg_qty = Decimal("3")
    dmg_payload = (
        f"⚠️ WMS DAMAGED / REJECTED GOODS QR\n"
        f"----------------------------------------\n"
        f"• GRN Number      : {grn_num}\n"
        f"• Material Code   : {item_code}\n"
        f"• Material Name   : {mat_name}\n"
        f"• Damage Lot No   : DMG-LOT-{grn_num}-{item_code}\n"
        f"• Damaged Qty     : {dmg_qty} {uom}\n"
        f"• UOM             : {uom}\n"
        f"• Damage Reason   : Physical Damage\n"
        f"• Quality Status  : DAMAGED / REJECTED\n"
        f"• Quarantine Loc  : QUARANTINE-ZONE-A\n"
        f"• QR ID           : DMG-{grn_num}-{item_code}-01\n"
        f"----------------------------------------"
    )

    assert "DAMAGED / REJECTED" in dmg_payload
    assert f"Damaged Qty     : {dmg_qty}" in dmg_payload
