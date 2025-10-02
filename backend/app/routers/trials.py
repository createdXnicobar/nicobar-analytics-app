from fastapi import APIRouter, Header, HTTPException, Query
from datetime import datetime, timezone, timedelta
from app.models.trials import TrialIn, TrialAck, TrialBatchIn, TrialBatchAck, TrialResult, UserBundlesResponse, Bundle, TrialItem
from app.db.mongo import trial_events
from app.services.product_resolver import fetch_product_by_sku
from app.services.timeutil import to_utc, utc_now
from app.core.logging_config import get_logger
from bson import ObjectId
from typing import List

logger = get_logger(__name__)
router = APIRouter()

async def _process_single_trial(trial: TrialIn, idem_key: str) -> TrialResult:
    """Helper function to process a single trial"""
    logger.debug(f"Processing trial for SKU: {trial.sku}, Store: {trial.storeCode}, Bundle: {trial.bundleId}")
    
    try:
        # Check for duplicate idempotency key
        if await trial_events().find_one({"idemKey": idem_key}):
            logger.warning(f"Duplicate idempotency key detected for trial: {idem_key}")
            return TrialResult(
                trialId=trial.trialId or str(ObjectId()),
                storedAt=utc_now(),
                success=False,
                error="Duplicate idempotency key"
            )

        ts_utc = to_utc(trial.timestamp) if trial.timestamp else utc_now()
        trialId = trial.trialId or str(ObjectId())
        logger.debug(f"Generated trial ID: {trialId}")
        
        snap = await fetch_product_by_sku(trial.sku)
        if snap:
            logger.debug(f"Product snapshot retrieved for SKU {trial.sku}: {snap.title}")
        else:
            logger.warning(f"No product snapshot found for SKU: {trial.sku}")
        
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
            logger.debug(f"Product enrichment completed for trial {trialId}, stock at store: {stock_here}")

        await trial_events().insert_one(doc)
        logger.debug(f"Trial {trialId} successfully stored in database")
        return TrialResult(
            trialId=trialId,
            storedAt=ts_utc,
            success=True
        )
    except Exception as e:
        logger.error(f"Error processing trial for SKU {trial.sku}: {str(e)}", exc_info=True)
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
    logger.info(f"Processing batch of {len(body.trials)} trials with base idempotency key: {idem_key}")
    results: list[TrialResult] = []
    
    for idx, trial in enumerate(body.trials):
        # Create a unique idempotency key for each trial by appending the index
        trial_idem_key = f"{idem_key}_{idx}"
        result = await _process_single_trial(trial, trial_idem_key)
        results.append(result)
        
        # Log individual failures for monitoring
        if not result.success:
            logger.warning(f"Trial {idx} failed in batch {idem_key}: {result.error}")
    
    success_count = sum(1 for r in results if r.success)
    error_count = len(results) - success_count
    
    logger.info(f"Batch processing completed - Total: {len(results)}, Success: {success_count}, Errors: {error_count}")
    
    if error_count > 0:
        logger.warning(f"Batch {idem_key} had {error_count} failures out of {len(results)} trials")
    
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
    logger.info(f"Creating trial for SKU: {body.sku}, Store: {body.storeCode}, Session: {body.sessionId}")
    logger.debug(f"Trial request details: feedback={body.feedback}, bundleId={body.bundleId}")
    
    try:
        # Check for duplicate
        if await trial_events().find_one({"idemKey": idem_key}):
            logger.warning(f"Duplicate trial request detected with idempotency key: {idem_key}")
            raise HTTPException(status_code=409, detail="Duplicate")

        ts_utc = to_utc(body.timestamp) if body.timestamp else utc_now()
        trialId = body.trialId or str(ObjectId())
        
        logger.debug(f"Generated trial ID: {trialId}")
        
        # Fetch product information
        snap = await fetch_product_by_sku(body.sku)
        if snap:
            logger.debug(f"Product snapshot retrieved for SKU {body.sku}: {snap.title}")
        else:
            logger.warning(f"No product snapshot found for SKU: {body.sku}")
        
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
            logger.debug(f"Product enrichment completed, stock at store: {stock_here}")

        await trial_events().insert_one(doc)
        logger.info(f"Trial created successfully with ID: {trialId}")
        
        return TrialAck(storedAt=ts_utc)
        
    except HTTPException as he:
        # Re-raise HTTP exceptions (like duplicates) but log them for monitoring
        logger.warning(f"HTTP exception in trial creation: {he.detail}")
        raise
    except Exception as e:
        logger.error(f"Error creating trial for SKU {body.sku}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/v1/bundles/{user_id}", response_model=UserBundlesResponse)
async def get_user_bundles(
    user_id: str,
    days: int = Query(default=31, ge=1, le=31, description="Number of days to look back (1-31 days)")
):
    """
    Get all bundles scanned by a particular user from the specified number of days.
    Each bundle contains all items that were scanned together.
    
    Args:
        user_id: The ID of the user whose bundles to retrieve
        days: Number of days to look back (1-31 days, default: 31)
    """
    logger.info(f"Retrieving bundles for user {user_id} for the last {days} days")
    
    try:
        # Calculate the date based on the specified number of days
        cutoff_date = utc_now() - timedelta(days=days)
        logger.debug(f"Searching for bundles from {cutoff_date} onwards for user {user_id}")
        
        # Find all trials for this user that have a bundleId and are within the specified time range
        user_trials = await trial_events().find(
            {
                "scannedBy": user_id,
                "bundleId": {"$ne": None, "$exists": True},
                "timestamp": {"$gte": cutoff_date}
            }
        ).to_list(length=None)
        
        logger.debug(f"Found {len(user_trials)} trials with bundles for user {user_id}")
    
        if not user_trials:
            logger.info(f"No bundles found for user {user_id} in the last {days} days")
            return UserBundlesResponse(
                user=user_id,
                bundles=[],
                totalBundles=0
            )
        
        # Group trials by bundleId
        bundles_dict = {}
        for trial in user_trials:
            bundle_id = trial["bundleId"]
            if bundle_id not in bundles_dict:
                bundles_dict[bundle_id] = []
            
            trial_item = TrialItem(
                trialId=trial.get("trialId"),
                sku=trial["sku"],
                storeCode=trial["storeCode"],
                timestamp=trial["timestamp"],
                feedback=trial["feedback"],
                sessionId=trial.get("sessionId"),
                productSnapshot=trial.get("productSnapshot")
            )
            bundles_dict[bundle_id].append(trial_item)
        
        logger.debug(f"Grouped trials into {len(bundles_dict)} unique bundles for user {user_id}")
        
        # Create Bundle objects
        bundles = []
        for bundle_id, items in bundles_dict.items():
            # Sort items by timestamp for consistent ordering
            items.sort(key=lambda x: x.timestamp)
            
            bundle = Bundle(
                bundleId=bundle_id,
                scannedBy=user_id,
                items=items,
                totalItems=len(items),
                scanDate=items[0].timestamp  # Use the earliest scan time as bundle date
            )
            bundles.append(bundle)
        
        # Sort bundles by scan date (most recent first)
        bundles.sort(key=lambda x: x.scanDate, reverse=True)
        
        logger.info(f"Successfully retrieved {len(bundles)} bundles containing {len(user_trials)} total items for user {user_id}")
        
        return UserBundlesResponse(
            user=user_id,
            bundles=bundles,
            totalBundles=len(bundles)
        )
        
    except Exception as e:
        logger.error(f"Error retrieving bundles for user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
