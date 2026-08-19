from enum import Enum


class GrnStatus(str, Enum):
    CONFIRMED = "CONFIRMED"
    UNDER_INSPECTION = "UNDER_INSPECTION"
    PUT_AWAY = "PUT_AWAY"
    REJECTED = "REJECTED"
