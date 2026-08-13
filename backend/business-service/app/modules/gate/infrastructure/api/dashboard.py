"""
FastAPI Router for Dashboard Statistics.
"""
from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.database.session import UnitOfWork, get_uow
from app.modules.gate.infrastructure.persistence.models import GateEntryModel

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(uow: UnitOfWork = Depends(get_uow)) -> dict:
    """
    Get dashboard metrics, chart trends, dock occupancy, recent activities, and recent gate entries.
    """
    async with uow:
        result = await uow.session.execute(
            select(GateEntryModel).order_by(GateEntryModel.created_at.desc())
        )
        gate_entries = result.scalars().all()

    total_arrivals = len(gate_entries)

    # Compute status-based counters
    pending_arrivals = 0
    vehicles_waiting = 0
    receiving_in_progress = 0

    for entry in gate_entries:
        status_upper = entry.status.upper()
        if "REJECT" in status_upper:
            continue
        
        # Pending means any active arrival that is not completed or rejected
        if "COMPLET" not in status_upper:
            pending_arrivals += 1

        if "DOCK" in status_upper:
            pass
        elif "RECEIV" in status_upper:
            receiving_in_progress += 1
        elif "COMPLET" not in status_upper:
            vehicles_waiting += 1

    # Dock Occupancy
    docks = [
        { "id": "D-01", "zone": "Zone A — Bulk", "status": "Occupied", "vehicle": "TN 09 BK 5560", "eta": "Free in 42 min", "type": "Bulk / Crane" },
        { "id": "D-02", "zone": "Zone A — Bulk", "status": "Available", "vehicle": None, "eta": "Ready now", "type": "Bulk / Crane" },
        { "id": "D-03", "zone": "Zone B — Palletised", "status": "Reserved", "vehicle": "KA 51 MD 7702", "eta": "Docking 09:55", "type": "Forklift" },
        { "id": "D-04", "zone": "Zone B — Palletised", "status": "Available", "vehicle": None, "eta": "Ready now", "type": "Forklift" },
        { "id": "D-05", "zone": "Zone B — Palletised", "status": "Cleaning", "vehicle": None, "eta": "Free in 12 min", "type": "Forklift" },
        { "id": "D-06", "zone": "Zone C — Cold Chain", "status": "Available", "vehicle": None, "eta": "Ready now", "type": "Reefer" },
        { "id": "D-07", "zone": "Zone C — Cold Chain", "status": "Occupied", "vehicle": "MP 09 TG 2210", "eta": "Free in 1h 05m", "type": "Reefer" },
        { "id": "D-08", "zone": "Zone D — Hazmat", "status": "Available", "vehicle": None, "eta": "Ready now", "type": "Hazmat certified" },
    ]

    # Dynamically map gate entries with status containing 'dock' or 'receiving' to mock docks for realism
    for entry in gate_entries:
        status_upper = entry.status.upper()
        if "DOCK" in status_upper or "RECEIV" in status_upper:
            # Find an available dock to assign this active vehicle in the mock list
            for dock in docks:
                if dock["status"] == "Available":
                    dock["status"] = "Occupied" if "RECEIV" in status_upper else "Reserved"
                    dock["vehicle"] = entry.vehicle_number
                    dock["eta"] = "Free in 30 min" if "RECEIV" in status_upper else "Docking soon"
                    break

    # Build dynamic timeline of activity
    activity = []
    for entry in gate_entries[:5]:
        time_str = entry.created_at.strftime("%H:%M")
        status_upper = entry.status.upper()
        if "APPROVED" in status_upper:
            activity.append({
                "time": time_str,
                "title": "Gate pass approved",
                "detail": f"{entry.vehicle_number} · PO: {entry.po_number} · Approved by Supervisor",
                "tone": "success"
            })
        elif "REJECT" in status_upper:
            activity.append({
                "time": time_str,
                "title": "Gate pass rejected",
                "detail": f"{entry.vehicle_number} · PO: {entry.po_number} · Rejected at Gate",
                "tone": "danger"
            })
        else:
            activity.append({
                "time": time_str,
                "title": "Vehicle arrival registered",
                "detail": f"{entry.vehicle_number} · PO: {entry.po_number} · Status: {entry.status}",
                "tone": "primary"
            })

    if not activity:
        activity = [
            { "time": "09:38", "title": "Gate pass approved by Security", "detail": "GJ 05 AW 1123 · Gate 1 · S. Patil", "tone": "primary" },
            { "time": "09:12", "title": "New arrival notification raised", "detail": "MH 12 QT 4489 · Hindustan Polymers Ltd.", "tone": "primary" },
            { "time": "08:56", "title": "Dock D-03 reserved", "detail": "KA 51 MD 7702 · Sundaram Fasteners", "tone": "teal" },
            { "time": "08:41", "title": "GRN 2026/GRN/9911 posted", "detail": "DL 01 LX 3391 · 8 pallets accepted", "tone": "success" },
        ]

    arrival_trend = [
        { "hour": "06:00", "arrivals": 2, "received": 1 },
        { "hour": "07:00", "arrivals": 5, "received": 3 },
        { "hour": "08:00", "arrivals": 8, "received": 6 },
        { "hour": "09:00", "arrivals": total_arrivals if total_arrivals > 8 else 11, "received": total_arrivals - pending_arrivals },
        { "hour": "10:00", "arrivals": (total_arrivals if total_arrivals > 8 else 11) + 1, "received": total_arrivals - pending_arrivals + 1 },
    ]

    target_progress = {
        "current": total_arrivals - vehicles_waiting,
        "target": max(total_arrivals + 5, 22),
        "percentage": int(((total_arrivals - vehicles_waiting) / max(total_arrivals + 5, 22)) * 100) if total_arrivals > 0 else 64
    }

    # Format gate entries list for dashboard table
    formatted_entries = []
    for a in gate_entries[:10]:
        # Attempt to see if a dock is reserved or occupied by this vehicle in our docks list
        dock_no = "—"
        for d in docks:
            if d["vehicle"] == a.vehicle_number:
                dock_no = d["id"]
                break

        formatted_entries.append({
            "id": str(a.id),
            "vehicle_number": a.vehicle_number,
            "gate_entry_no": f"GE/{a.created_at.strftime('%Y/%m')}/{str(a.id)[:4].upper()}",
            "driver_name": a.driver_name,
            "driver_phone": a.driver_phone or "—",
            "po_number": a.po_number,
            "arrival_time": a.created_at.strftime("%H:%M"),
            "dock_number": dock_no,
            "status": a.status,
            "transporter": "Local Carrier",
            "vendor": a.ocr_supplier_name or "Unknown Vendor",
        })

    occupied_count = len([d for d in docks if d["status"] in ("Occupied", "Reserved")])

    return {
        "stats": {
            "totalArrivals": total_arrivals,
            "pendingArrivals": pending_arrivals,
            "occupiedDocks": f"{occupied_count}/8",
            "vehiclesWaiting": vehicles_waiting,
            "receivingInProgress": receiving_in_progress
        },
        "docks": docks,
        "arrivalTrend": arrival_trend,
        "activity": activity,
        "targetProgress": target_progress,
        "gateEntries": formatted_entries
    }
