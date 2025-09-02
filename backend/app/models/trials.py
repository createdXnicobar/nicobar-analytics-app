from pydantic import BaseModel, Field
from datetime import datetime

class TrialIn(BaseModel):
    trialId: str
    sku: str
    storeCode: str
    timestamp: datetime | None = None
    feedback: list[str] = []
    sessionId: str | None = None

class TrialAck(BaseModel):
    storedAt: datetime
