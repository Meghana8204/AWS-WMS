"""
FastAPI Router for Dashboard Statistics.
"""
from __future__ import annotations

import base64
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database.session import UnitOfWork, get_uow
from app.modules.gate.infrastructure.persistence.models import GateEntryModel

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    uow: UnitOfWork = Depends(get_uow)
) -> dict:
    """
    Get real-time dashboard metrics from the gate repository.
    """

    result = await uow.session.execute(
        select(GateEntryModel).order_by(GateEntryModel.created_at.desc())
    )
    models = result.scalars().all()

    total_arrivals = len(models)


    verified_arrivals = 0
    unscheduled_arrivals = 0
    vehicles_waiting = 0
    receiving_in_progress = 0
    awaiting_dock_count = 0

    for m in models:
        status_upper = (m.status or "").upper()

        if "REJECT" in status_upper or "CANCEL" in status_upper:
            continue

        if status_upper == "PO_VERIFIED" or status_upper == "APPROVED":
            verified_arrivals += 1
        elif status_upper == "UNSCHEDULED_ARRIVAL":
            unscheduled_arrivals += 1


        if "DOCK" in status_upper or "RECEIV" in status_upper:
            receiving_in_progress += 1
        elif "COMPLET" not in status_upper:
            vehicles_waiting += 1

        # Check Awaiting Dock condition: approved, dock not assigned, not completed/exited
        is_approved = any(kw in status_upper for kw in ["APPROVED", "GATE_ENTRY_APPROVED", "AWAITING_DOCK", "DOCK_PENDING"])
        has_no_dock = not m.assigned_dock_id or m.assigned_dock_id.strip() == "" or m.assigned_dock_id.upper() == "UNASSIGNED"
        is_active = not any(kw in status_upper for kw in ["COMPLET", "EXIT", "REJECT", "CANCEL"])
        if is_approved and has_no_dock and is_active:
            awaiting_dock_count += 1


    docks = [
        { "id": "D-01", "zone": "Zone A — Bulk", "status": "Available", "vehicle": None, "eta": "Ready now", "type": "Bulk / Crane" },
        { "id": "D-02", "zone": "Zone A — Bulk", "status": "Available", "vehicle": None, "eta": "Ready now", "type": "Bulk / Crane" },
        { "id": "D-03", "zone": "Zone B — Palletised", "status": "Available", "vehicle": None, "eta": "Ready now", "type": "Forklift" },
        { "id": "D-04", "zone": "Zone B — Palletised", "status": "Available", "vehicle": None, "eta": "Ready now", "type": "Forklift" },
        { "id": "D-05", "zone": "Zone B — Palletised", "status": "Available", "vehicle": None, "eta": "Ready now", "type": "Forklift" },
        { "id": "D-06", "zone": "Zone C — Cold Chain", "status": "Available", "vehicle": None, "eta": "Ready now", "type": "Reefer" },
        { "id": "D-07", "zone": "Zone C — Cold Chain", "status": "Available", "vehicle": None, "eta": "Ready now", "type": "Reefer" },
        { "id": "D-08", "zone": "Zone D — Hazmat", "status": "Available", "vehicle": None, "eta": "Ready now", "type": "Hazmat certified" },
    ]


    for m in models:
        status_upper = (m.status or "").upper()
        if "DOCK" in status_upper or "RECEIV" in status_upper:
            for dock in docks:
                if dock["status"] == "Available":
                    dock["status"] = "Occupied" if "RECEIV" in status_upper else "Reserved"
                    dock["vehicle"] = m.vehicle_number
                    dock["eta"] = "Free in 30 min" if "RECEIV" in status_upper else "Docking soon"
                    break


    activity = []
    for m in models[:5]:

        time_str = m.created_at.strftime("%H:%M")
        status_upper = (m.status or "").upper()

        if status_upper == "PO_VERIFIED":
            activity.append({
                "time": time_str,
                "title": "Vehicle verified",
                "detail": f"{m.vehicle_number} ({m.driver_name}) · PO: {m.po_number} · Automated verification success",
                "tone": "success"
            })
        elif status_upper == "UNSCHEDULED_ARRIVAL":
            activity.append({
                "time": time_str,
                "title": "Unscheduled arrival",
                "detail": f"{m.vehicle_number} ({m.driver_name}) · PO: {m.po_number} · Not found in schedule",
                "tone": "warning"
            })
        elif "APPROVED" in status_upper:
            activity.append({
                "time": time_str,
                "title": "Gate pass approved",
                "detail": f"{m.vehicle_number} ({m.driver_name}) · PO: {m.po_number} · Approved by Supervisor",
                "tone": "success"
            })
        elif "REJECT" in status_upper:
            activity.append({
                "time": time_str,
                "title": "Gate pass rejected",
                "detail": f"{m.vehicle_number} · PO: {m.po_number} · Rejected at Gate",
                "tone": "danger"
            })
        else:
            activity.append({
                "time": time_str,
                "title": "Vehicle registered",
                "detail": f"{m.vehicle_number} · PO: {m.po_number} · Status: {m.status}",
                "tone": "primary"
            })

    if not activity:
        activity = [
            { "time": "09:38", "title": "Dashboard active", "detail": "Waiting for real-time gate arrivals...", "tone": "primary" },
        ]

    arrival_trend = [
        { "hour": "08:00", "arrivals": 2, "received": 1 },
        { "hour": "09:00", "arrivals": total_arrivals, "received": receiving_in_progress },
        { "hour": "10:00", "arrivals": total_arrivals, "received": receiving_in_progress },
    ]

    target_progress = {
        "current": total_arrivals - vehicles_waiting,
        "target": max(total_arrivals + 2, 10),
        "percentage": int(((total_arrivals - vehicles_waiting) / max(total_arrivals + 2, 10)) * 100) if total_arrivals > 0 else 0
    }


    from app.modules.dock.infrastructure.persistence.models import DockMasterModel, DockAllocationRequestModel

    dock_models_res = await uow.session.execute(select(DockMasterModel).where(DockMasterModel.is_active == True))
    dock_models = dock_models_res.scalars().all()

    dock_master_map = {}
    if dock_models:
        for dm in dock_models:
            dock_master_map[str(dm.id)] = (dm.dock_code, dm.dock_name)
            dock_master_map[dm.dock_code] = (dm.dock_code, dm.dock_name)

    alloc_req_res = await uow.session.execute(
        select(DockAllocationRequestModel).options(selectinload(DockAllocationRequestModel.assigned_dock))
    )
    alloc_reqs = alloc_req_res.scalars().all()
    alloc_map_by_pass = {}
    alloc_map_by_vehicle = {}
    for ar in alloc_reqs:
        if ar.assigned_dock:
            code = ar.assigned_dock.dock_code
            name = ar.assigned_dock.dock_name or ar.assigned_dock.dock_code
        elif ar.assigned_dock_id and str(ar.assigned_dock_id) in dock_master_map:
            code, name = dock_master_map[str(ar.assigned_dock_id)]
        else:
            continue
        if ar.existing_gate_pass_id:
            alloc_map_by_pass[ar.existing_gate_pass_id] = (code, name)
        if ar.vehicle_number:
            alloc_map_by_vehicle[ar.vehicle_number] = (code, name)

    formatted_entries = []
    for m in models[:10]:
        dock_no = "—"
        dock_name = "—"

        if m.assigned_dock_id and m.assigned_dock_id.strip() and m.assigned_dock_id.upper() != "UNASSIGNED":
            val = m.assigned_dock_id.strip()
            if val in dock_master_map:
                dock_no, dock_name = dock_master_map[val]
            else:
                dock_no = val
                dock_name = f"Dock {val}" if not val.startswith("Dock") else val

        if (dock_no == "—" or not dock_no) and m.gate_entry_number in alloc_map_by_pass:
            dock_no, dock_name = alloc_map_by_pass[m.gate_entry_number]

        if (dock_no == "—" or not dock_no) and m.vehicle_number in alloc_map_by_vehicle:
            dock_no, dock_name = alloc_map_by_vehicle[m.vehicle_number]

        if dock_no == "—" or not dock_no:
            for d in docks:
                if d["vehicle"] == m.vehicle_number:
                    dock_no = d["id"]
                    dock_name = f"Dock {d['id']}"
                    break

        formatted_entries.append({
            "id": str(m.id),
            "vehicle_number": m.vehicle_number,
            "gate_entry_no": m.gate_entry_number,
            "driver_name": m.driver_name,
            "po_number": m.po_number,
            "arrival_time": m.created_at.strftime("%H:%M"),
            "dock_number": dock_no,
            "dock_name": dock_name if dock_name != "—" else (f"Dock {dock_no}" if dock_no != "—" else "—"),
            "assigned_dock_id": m.assigned_dock_id or (dock_no if dock_no != "—" else None),
            "status": m.status,
            "vendor": m.ocr_supplier_name or "Unknown Vendor",
            "material": m.ocr_product_material or "—",
            "quantity": float(m.ocr_quantity) if m.ocr_quantity is not None else 0,
            "truck_photo_base64": base64.b64encode(m.vehicle_photo_data).decode("ascii") if m.vehicle_photo_data else None,
        })

    if dock_models:
        total_dock_count = len(dock_models)
        occupied_count = sum(1 for d in dock_models if d.status in ("OCCUPIED", "RESERVED"))
    else:
        occupied_count = len([d for d in docks if d["status"] in ("Occupied", "Reserved")])
        total_dock_count = 8

    return {
        "stats": {
            "totalArrivals": total_arrivals,
            "verifiedArrivals": verified_arrivals,
            "unscheduledArrivals": unscheduled_arrivals,
            "occupiedDocks": f"{occupied_count}/{total_dock_count}",
            "vehiclesWaiting": vehicles_waiting,
            "receivingInProgress": receiving_in_progress,
            "awaitingDock": awaiting_dock_count,
            "awaiting_dock": awaiting_dock_count,
        },
        "docks": docks,
        "arrivalTrend": arrival_trend,
        "activity": activity,
        "targetProgress": target_progress,
        "gateEntries": formatted_entries
    }
