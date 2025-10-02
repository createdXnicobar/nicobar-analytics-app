from fastapi import APIRouter, Header, HTTPException
from datetime import datetime, timezone
from app.models.trials import TrialIn, TrialAck, TrialBatchIn, TrialBatchAck, TrialResult
from app.db.mongo import trial_events
from app.services.product_resolver import fetch_product_by_sku
from app.services.timeutil import to_utc, utc_now
from bson import ObjectId

router = APIRouter()

async def _process_single_trial(trial: TrialIn, idem_key: str) -> TrialResult:
    """Helper function to process a single trial"""
    try:
        # Check for duplicate idempotency key
        if await trial_events().find_one({"idemKey": idem_key}):
            return TrialResult(
                trialId=trial.trialId or str(ObjectId()),
                storedAt=utc_now(),
                success=False,
                error="Duplicate idempotency key"
            )

        ts_utc = to_utc(trial.timestamp) if trial.timestamp else utc_now()
        trialId = trial.trialId or str(ObjectId())
        snap = await fetch_product_by_sku(trial.sku)
        
        doc = {
            "trialId": trialId,
            "timestamp": ts_utc,
            "storeCode": trial.storeCode.upper(),
            "sku": trial.sku,
            "feedback": trial.feedback,
            "sessionId": trial.sessionId,
            "idemKey": idem_key,
            "productSnapshot": None,
            "enrichment": {"status": "pending", "lastTriedAt": ts_utc},
            "scannedBy": trial.scannedBy,
            "bundleId": trial.bundleId
        }
        
        if snap:
            stock_here = (snap.stockByLocation or {}).get(doc["storeCode"])
            doc["productSnapshot"] = {
                "title": snap.title,
                "price": snap.price,
                "size": snap.size,
                "color": snap.color,
                "category": snap.category,
                "imageUrl": snap.imageUrl,
                "stockAtTrial": stock_here
            }
            doc["enrichment"]["status"] = "done"

        await trial_events().insert_one(doc)
        return TrialResult(
            trialId=trialId,
            storedAt=ts_utc,
            success=True
        )
    except Exception as e:
        return TrialResult(
            trialId=trial.trialId or str(ObjectId()),
            storedAt=utc_now(),
            success=False,
            error=str(e)
        )

@router.post("/v1/trials", response_model=TrialBatchAck, status_code=201)
async def create_trials(body: TrialBatchIn, idem_key: str = Header(..., alias="X-Idempotency-Key")):
    """
    Create multiple trials in a batch. Each trial in the batch will use a derived idempotency key
    based on the main idempotency key and the trial index.
    """
    results: list[TrialResult] = []
    
    for idx, trial in enumerate(body.trials):
        # Create a unique idempotency key for each trial by appending the index
        trial_idem_key = f"{idem_key}_{idx}"
        result = await _process_single_trial(trial, trial_idem_key)
        results.append(result)
    
    success_count = sum(1 for r in results if r.success)
    error_count = len(results) - success_count
    
    return TrialBatchAck(
        results=results,
        totalProcessed=len(results),
        successCount=success_count,
        errorCount=error_count
    )

@router.post("/v1/trial", response_model=TrialAck, status_code=201)
async def create_single_trial(body: TrialIn, idem_key: str = Header(..., alias="X-Idempotency-Key")):
    """
    Create a single trial (legacy endpoint for backward compatibility).
    """
    if await trial_events().find_one({"idemKey": idem_key}):
        raise HTTPException(status_code=409, detail="Duplicate")

    ts_utc = to_utc(body.timestamp) if body.timestamp else utc_now()

    trialId = body.trialId or str(ObjectId())
    snap = await fetch_product_by_sku(body.sku)
    doc = {
        "trialId": trialId,
        "timestamp": ts_utc,
        "storeCode": body.storeCode.upper(),
        "sku": body.sku,
        "feedback": body.feedback,
        "sessionId": body.sessionId,
        "idemKey": idem_key,
        "productSnapshot": None,
        "enrichment": {"status": "pending", "lastTriedAt": ts_utc},
        "scannedBy": body.scannedBy,
        "bundleId": body.bundleId
    }
    if snap:
        stock_here = (snap.stockByLocation or {}).get(doc["storeCode"])
        doc["productSnapshot"] = {
            "title": snap.title,
            "price": snap.price,
            "size": snap.size,
            "color": snap.color,
            "category": snap.category,
            "imageUrl": snap.imageUrl,
            "stockAtTrial": stock_here
        }
        doc["enrichment"]["status"] = "done"

    await trial_events().insert_one(doc)
    return TrialAck(storedAt=ts_utc)
