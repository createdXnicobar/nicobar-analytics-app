from pydantic import BaseModel, Field
from datetime import datetime

class TrialIn(BaseModel):
    trialId: str | None = None
    sku: str
    storeCode: str
    timestamp: datetime | None = None
    feedback: list[str] = []
    sessionId: str | None = None
    scannedBy: str # kept it as required for now
    bundleId: str | None = None # kept it as optional for now

class TrialBatchIn(BaseModel):
    trials: list[TrialIn]

class TrialResult(BaseModel):
    trialId: str
    storedAt: datetime
    success: bool
    error: str | None = None

class TrialAck(BaseModel):
    storedAt: datetime

class TrialBatchAck(BaseModel):
    results: list[TrialResult]
    totalProcessed: int
    successCount: int
    errorCount: int
