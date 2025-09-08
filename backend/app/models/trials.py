from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

class TrialIn(BaseModel):
    # trialId: str
    sku: str
    storeCode: str
    timestamp: datetime | None = None
    feedback: list[str] = []
    sessionId: str | None = None
    scannedBy: str # kept it as required for now
    bundleId: str | None = None # kept it as optional for now

class TrialAck(BaseModel):
    storedAt: datetime

class BasketItem(BaseModel):
    sku: str
    productTitle: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    price: Optional[float] = None

class BasketIn(BaseModel):
    basketId: str
    storeCode: str
    items: List[BasketItem]
    timestamp: datetime | None = None
    sessionId: str | None = None

class BasketAck(BaseModel):
    basketId: str
    storedAt: datetime
    itemCount: int