import asyncio
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:1234@localhost:5432/WMS_DB"

DOCKS = [
    {
        "code": "RM-01",
        "name": "Raw Material Dock 01",
        "type": "RAW_MATERIAL",
        "location": "North Warehouse - Bay 1",
        "description": "Dedicated inbound dock for raw materials, metals, and standard fabrication items.",
    },
    {
        "code": "RM-02",
        "name": "Raw Material Dock 02",
        "type": "RAW_MATERIAL",
        "location": "North Warehouse - Bay 2",
        "description": "Secondary inbound dock for raw materials and heavy bulk cargo.",
    },
    {
        "code": "EL-01",
        "name": "Electrical Dock 01",
        "type": "ELECTRICAL",
        "location": "East Warehouse - Bay 1",
        "description": "Specialized inbound dock for electrical components, wires, cables, and switchgear.",
    },
    {
        "code": "EL-02",
        "name": "Electrical Dock 02",
        "type": "ELECTRICAL",
        "location": "East Warehouse - Bay 2",
        "description": "Secondary dock for electrical hardware and sub-assemblies.",
    },
    {
        "code": "EC-01",
        "name": "Electronics Dock 01",
        "type": "ELECTRONICS",
        "location": "West Warehouse - Bay 1",
        "description": "ESD-controlled dock for sensitive electronic circuits, microcontrollers, and chips.",
    },
    {
        "code": "EC-02",
        "name": "Electronics Dock 02",
        "type": "ELECTRONICS",
        "location": "West Warehouse - Bay 2",
        "description": "Secondary ESD-compliant dock for electronic devices and sensor components.",
    },
    {
        "code": "CH-01",
        "name": "Chemical/Hazardous Dock 01",
        "type": "CHEMICAL_HAZARDOUS",
        "location": "South Warehouse - HazMat Bay 1",
        "description": "Ventilated hazardous cargo bay with containment protocol for chemicals and coatings.",
    },
    {
        "code": "CH-02",
        "name": "Chemical/Hazardous Dock 02",
        "type": "CHEMICAL_HAZARDOUS",
        "location": "South Warehouse - HazMat Bay 2",
        "description": "Secondary hazardous and volatile materials receiving dock.",
    },
    {
        "code": "MR-01",
        "name": "Main Receiving Dock 01",
        "type": "MAIN_RECEIVING",
        "location": "Central Receiving - Main Bay 1",
        "description": "Primary high-throughput receiving dock for general consignments and mixed shipments.",
    },
    {
        "code": "MR-02",
        "name": "Main Receiving Dock 02",
        "type": "MAIN_RECEIVING",
        "location": "Central Receiving - Main Bay 2",
        "description": "Secondary high-throughput receiving dock for overflow inbound shipments.",
    },
]

async def seed_docks():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        print("Seeding 10 docks into database...")
        now = datetime.now(timezone.utc)

        for d in DOCKS:
            # 1. Insert into warehouse_dock
            wh_dock_id = uuid.uuid4()
            await conn.execute(
                text("""
                    INSERT INTO warehouse_dock (id, dock_number, warehouse_id, dock_type, capacity, status, created_at, updated_at)
                    VALUES (:id, :dock_number, 'WH-01', :dock_type, 1, 'AVAILABLE', :created_at, :updated_at)
                    ON CONFLICT (dock_number) DO UPDATE
                    SET dock_type = EXCLUDED.dock_type,
                        status = 'AVAILABLE',
                        updated_at = EXCLUDED.updated_at
                """),
                {
                    "id": wh_dock_id,
                    "dock_number": d["code"],
                    "dock_type": d["type"],
                    "created_at": now,
                    "updated_at": now,
                }
            )

            # 2. Insert into dock_masters
            dock_master_id = uuid.uuid4()
            await conn.execute(
                text("""
                    INSERT INTO dock_masters (id, dock_code, dock_name, dock_type, location, description, status, is_active, created_at, updated_at)
                    VALUES (:id, :dock_code, :dock_name, :dock_type, :location, :description, 'AVAILABLE', true, :created_at, :updated_at)
                    ON CONFLICT (dock_code) DO UPDATE
                    SET dock_name = EXCLUDED.dock_name,
                        dock_type = EXCLUDED.dock_type,
                        location = EXCLUDED.location,
                        description = EXCLUDED.description,
                        status = 'AVAILABLE',
                        is_active = true,
                        updated_at = EXCLUDED.updated_at
                """),
                {
                    "id": dock_master_id,
                    "dock_code": d["code"],
                    "dock_name": d["name"],
                    "dock_type": d["type"],
                    "location": d["location"],
                    "description": d["description"],
                    "created_at": now,
                    "updated_at": now,
                }
            )

        print("10 docks seeded successfully into warehouse_dock and dock_masters!")

if __name__ == "__main__":
    asyncio.run(seed_docks())
