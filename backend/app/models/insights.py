# app/models/insights.py
from pydantic import BaseModel
from typing import List, Optional

class SkuRow(BaseModel):
    sku: str
    title: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    trials: int
    purchases: int
    tryNotBuy: int
    conversion: float

class StoreInsightsResponse(BaseModel):
    storeCode: str
    fromDate: str
    toDate: str
    totals: dict
    topTryNotBuy: List[SkuRow]
