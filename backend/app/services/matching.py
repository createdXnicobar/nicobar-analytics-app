# app/services/matching.py
from datetime import datetime, timedelta, timezone
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.timeutil import ist_day_bounds
from app.core.logging_config import get_logger

logger = get_logger(__name__)

async def link_trials_to_purchases_for_date(
    db: AsyncIOMotorDatabase,
    date_str: str,
    window_hours: int = 2,
    *,
    backward_minutes: int | None = None,
    forward_minutes: int | None = None,
    matching_version: str = "1.1.0",
):
    """
    Link trials to purchases for a given IST calendar date.

    Matching strategy (v1.1.0):
    - Consider trials in a symmetric/asymmetric time window around the purchase timestamp:
      [purchase_ts - backward_minutes, purchase_ts + forward_minutes]
    - Select the closest trial by absolute time difference.
    - If tie, prefer pre-purchase over post-purchase.
    - Never reuse a trial already linked to another purchase.

    Backward compatibility: if backward/forward minutes are not provided, fallback to `window_hours`
    as the backward-only window, and zero forward window.
    """
    # Resolve windows (backward compatible defaults)
    bwd = backward_minutes if backward_minutes is not None else (window_hours * 60)
    fwd = forward_minutes if forward_minutes is not None else 0

    logger.info(
        f"Starting trial-purchase matching for date: {date_str} (bwd: {bwd}m, fwd: {fwd}m)"
    )
    start_utc, end_utc = ist_day_bounds(date_str)
    logger.debug(f"UTC time bounds: {start_utc} to {end_utc}")

    purchases_cur = db.purchase_events.find({"orderDtm": {"$gte": start_utc, "$lt": end_utc}})
    count_linked = 0
    count_processed = 0

    async for p in purchases_cur:
        count_processed += 1
        # already linked?
        existing = await db.trial_purchase_links.find_one({"orderNo": p["orderNo"], "lineNo": p["lineNo"]})
        if existing:
            continue

        store = p["storeCode"]
        sku = p["sku"]
        # Use the precise orderDtm timestamp
        purchase_ts = p.get("orderDtm")
        window_start = purchase_ts - timedelta(minutes=bwd)
        window_end = purchase_ts + timedelta(minutes=fwd)

        # find candidate trials around purchase within the combined window, same store & sku
        # we keep the candidate set small for in-Python ranking
        candidates_cur = db.trial_events.find({
            "storeCode": store,
            "sku": sku,
            "timestamp": {"$gte": window_start, "$lte": window_end}
        }).sort("timestamp", 1).limit(20)

        # Collect all candidate trials first to avoid N+1 queries
        # Also extract and store trial IDs to avoid duplicate extraction logic
        candidates = []
        async for t in candidates_cur:
            trial_id_val = t.get("trialId")
            if trial_id_val is None:
                trial_id_val = str(t.get("_id")) if t.get("_id") else None
            else:
                trial_id_val = str(trial_id_val)
            
            if trial_id_val is None:
                continue
            # Store trial with its extracted ID for later use
            candidates.append((t, trial_id_val))

        # Batch query: find all already-linked trial IDs in one DB round-trip
        if candidates:
            candidate_trial_ids = [trial_id for _, trial_id in candidates]
            linked_trials_cur = db.trial_purchase_links.find(
                {"trialId": {"$in": candidate_trial_ids}}
            )
            linked_trial_ids = {str(doc.get("trialId")) async for doc in linked_trials_cur if doc.get("trialId")}
        else:
            linked_trial_ids = set()

        # Now find the best candidate from the unlinked trials
        best = None
        best_trial_id = None
        best_abs_delta = None
        for t, trial_id_val in candidates:
            # Skip if already linked
            if trial_id_val in linked_trial_ids:
                continue

            delta_min = (purchase_ts - t["timestamp"]).total_seconds() / 60.0  # can be negative (post-purchase)
            abs_delta = abs(delta_min)

            if best is None:
                best = t
                best_trial_id = trial_id_val
                best_abs_delta = abs_delta
                best_delta_min = delta_min
            else:
                # Prefer smaller absolute delta; if tie, prefer pre-purchase (delta >= 0)
                if abs_delta < best_abs_delta or (
                    abs_delta == best_abs_delta and delta_min >= 0 and best_delta_min < 0
                ):
                    best = t
                    best_trial_id = trial_id_val
                    best_abs_delta = abs_delta
                    best_delta_min = delta_min

        # if we found a candidate trial, write a link
        if best:
            # recompute to ensure value available
            delta_min = (purchase_ts - best["timestamp"]).total_seconds() / 60.0
            direction = "pre" if delta_min >= 0 else "post"
            logger.debug(
                f"Linking trial {best_trial_id} to purchase {p['orderNo']}-{p['lineNo']} "
                f"(delta: {delta_min:.1f} minutes, dir: {direction})"
            )

            link_doc = {
                "trialId": best_trial_id,
                "orderNo": p["orderNo"],
                "lineNo": p["lineNo"],
                "sku": sku,
                "storeCode": store,
                "linkedAt": datetime.now(timezone.utc),
                "deltaMinutes": delta_min,  # signed: negative means post-purchase
                "direction": direction,
                "strategy": "heuristic",
                "matchingVersion": matching_version,
            }
            await db.trial_purchase_links.insert_one(link_doc)
            count_linked += 1
        else:
            logger.debug(
                f"No matching trial found for purchase {p['orderNo']}-{p['lineNo']} "
                f"(store: {store}, sku: {sku})"
            )

    logger.info(f"Matching completed for {date_str}: {count_linked} links created from {count_processed} purchases")
    return {"linked": count_linked}
