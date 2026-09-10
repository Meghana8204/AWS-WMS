"""
Pydantic schemas for Store Master, Store Zone, Store Bin, and Store Manager User accounts.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field


class StoreCreate(BaseModel):
    store_name: str = Field(..., min_length=2, max_length=128, description="Store display name")
    description: Optional[str] = Field(None, max_length=1000)
    warehouse_id: str = Field(default="Main Warehouse", max_length=64)
    store_manager_id: Optional[str] = Field(None, max_length=128)
    store_manager_name: Optional[str] = Field(None, max_length=128)
    status: str = Field(default="ACTIVE", max_length=32)
    store_code: Optional[str] = Field(None, description="System-generated code; client inputs are auto-assigned")


class StoreUpdate(BaseModel):
    store_name: Optional[str] = Field(None, min_length=2, max_length=128)
    description: Optional[str] = Field(None, max_length=1000)
    warehouse_id: Optional[str] = Field(None, max_length=64)
    store_manager_id: Optional[str] = Field(None, max_length=128)
    store_manager_name: Optional[str] = Field(None, max_length=128)
    status: Optional[str] = Field(None, max_length=32)


class StoreStatusUpdate(BaseModel):
    status: str = Field(..., max_length=32, description="ACTIVE or INACTIVE")


class StoreManagerAssign(BaseModel):
    store_manager_id: str = Field(..., max_length=128)
    store_manager_name: Optional[str] = Field(None, max_length=128)


class ZoneCreate(BaseModel):
    zone_name: str = Field(..., min_length=2, max_length=128, description="Zone name (e.g. High Voltage Bay)")
    description: Optional[str] = Field(None, max_length=1000)
    zone_code: Optional[str] = Field(None, max_length=64, description="Optional custom code or auto-generated STR-001-Z01")
    status: str = Field(default="ACTIVE", max_length=32)


class ZoneUpdate(BaseModel):
    zone_name: Optional[str] = Field(None, min_length=2, max_length=128)
    description: Optional[str] = Field(None, max_length=1000)
    status: Optional[str] = Field(None, max_length=32)


class ZoneStatusUpdate(BaseModel):
    status: str = Field(..., max_length=32, description="ACTIVE or INACTIVE")


class BinCreate(BaseModel):
    bin_name: str = Field(..., min_length=2, max_length=128, description="Bin name or description (e.g. Cable Reel Bin A1)")
    bin_code: Optional[str] = Field(None, max_length=64, description="Optional custom code or auto-generated BIN-E01-001")
    rack: Optional[str] = Field(None, max_length=64, description="Rack identifier e.g. R01")
    shelf: Optional[str] = Field(None, max_length=64, description="Shelf/Level identifier e.g. S01")
    capacity: Decimal = Field(default=Decimal("1000.0"), ge=0, description="Max storage capacity")
    status: str = Field(default="ACTIVE", max_length=32)


class BinUpdate(BaseModel):
    bin_name: Optional[str] = Field(None, min_length=2, max_length=128)
    rack: Optional[str] = Field(None, max_length=64)
    shelf: Optional[str] = Field(None, max_length=64)
    capacity: Optional[Decimal] = Field(None, ge=0)
    status: Optional[str] = Field(None, max_length=32)


class BinStatusUpdate(BaseModel):
    status: str = Field(..., max_length=32, description="ACTIVE or INACTIVE")


class BinResponse(BaseModel):
    id: str
    store_id: str
    zone_id: str
    bin_code: str
    bin_name: str
    rack: Optional[str] = None
    shelf: Optional[str] = None
    capacity: Decimal
    occupied_quantity: Decimal
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BinQRResponse(BaseModel):
    bin_id: str
    bin_code: str
    bin_name: str
    zone_id: str
    zone_code: str
    zone_name: str
    store_id: str
    store_code: str
    store_name: str
    warehouse_id: str
    rack: Optional[str] = None
    shelf: Optional[str] = None
    capacity: Decimal
    status: str
    qr_payload: str
    generated_at: datetime


class BinScanLookupRequest(BaseModel):
    scan_value: str = Field(..., min_length=1, description="Scanned QR payload, Bin UUID, or Bin Code")


class ZoneResponse(BaseModel):
    id: str
    store_id: str
    zone_code: str
    zone_name: str
    description: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    bins_count: Optional[int] = 0

    class Config:
        from_attributes = True


class ZoneWithBinsResponse(BaseModel):
    id: str
    store_id: str
    zone_code: str
    zone_name: str
    description: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    bins: List[BinResponse] = []

    class Config:
        from_attributes = True


class StoreResponse(BaseModel):
    id: str
    store_code: str
    store_name: str
    description: Optional[str] = None
    warehouse_id: str
    store_manager_id: Optional[str] = None
    store_manager_name: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    zones_count: Optional[int] = 0
    bins_count: Optional[int] = 0

    class Config:
        from_attributes = True


class StoreWithZonesResponse(BaseModel):
    id: str
    store_code: str
    store_name: str
    description: Optional[str] = None
    warehouse_id: str
    store_manager_id: Optional[str] = None
    store_manager_name: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    zones: List[ZoneWithBinsResponse] = []

    class Config:
        from_attributes = True


class StoreManagerOption(BaseModel):
    manager_id: str
    manager_name: str
    email: Optional[str] = None
    assigned_store_code: Optional[str] = None


class StoreManagerCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=128)
    employee_id: str = Field(..., min_length=2, max_length=64)
    username: str = Field(..., min_length=2, max_length=64)
    email: str = Field(..., min_length=3, max_length=128)
    password: str = Field(..., min_length=4, max_length=128)
    store_id: str = Field(..., description="UUID or Store Code of assigned store")
    status: str = Field(default="ACTIVE", max_length=32)


class StoreManagerUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=128)
    email: Optional[str] = Field(None, min_length=3, max_length=128)
    password: Optional[str] = Field(None, min_length=4, max_length=128)
    store_id: Optional[str] = Field(None, description="UUID or Store Code of assigned store")
    status: Optional[str] = Field(None, max_length=32)


class StoreManagerStatusUpdate(BaseModel):
    status: str = Field(..., max_length=32, description="ACTIVE or INACTIVE")


class StoreManagerUserResponse(BaseModel):
    id: str
    employee_id: str
    username: str
    full_name: str
    email: str
    store_id: str
    store_code: Optional[str] = None
    store_name: Optional[str] = None
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


StoreManagerResponse = StoreManagerUserResponse


class ZoneQRResponse(BaseModel):
    zone_id: str
    zone_code: str
    zone_name: str
    store_id: str
    store_code: str
    store_name: str
    warehouse_id: str
    status: str
    qr_payload: str
    generated_at: datetime


class ZoneScanLookupRequest(BaseModel):
    scan_value: str = Field(..., min_length=1, description="Scanned QR payload, Zone UUID, or Zone Code")
