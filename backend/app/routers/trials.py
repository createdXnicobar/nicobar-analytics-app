from fastapi import APIRouter, Header, HTTPException
from datetime import datetime, timezone
from app.models.trials import TrialIn, TrialAck
from app.db.mongo import trial_events
from app.services.product_resolver import fetch_product_by_sku
from app.services.timeutil import to_utc, utc_now

router = APIRouter()

@router.post("/v1/trials", response_model=TrialAck, status_code=201)
async def create_trial(body: TrialIn, idem_key: str = Header(..., alias="X-Idempotency-Key")):
    if await trial_events().find_one({"idemKey": idem_key}):
        raise HTTPException(status_code=409, detail="Duplicate")

    ts_utc = to_utc(body.timestamp) if body.timestamp else utc_now()
    snap = await fetch_product_by_sku(body.sku)
    doc = {
        # "trialId": body.trialId,
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

