# app/services/matching.py
from datetime import datetime, timedelta, timezone
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.timeutil import ist_day_bounds
import logging

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

async def link_trials_to_purchases_for_date(
    db: AsyncIOMotorDatabase,
    date_str: str,
    window_hours: int = 8,
    matching_version: str = "1.0.0",
):
    start_utc, end_utc = ist_day_bounds(date_str)

    purchases_cur = db.purchase_events.find({"orderDtm": {"$gte": start_utc, "$lt": end_utc}})
    # logger.info(await purchases_cur.to_list())
    count_linked = 0

    async for p in purchases_cur:
        # already linked?
        existing = await db.trial_purchase_links.find_one({"orderNo": p["orderNo"], "lineNo": p["lineNo"]})
        if existing:
            continue

        store = p["storeCode"]
        sku = p["sku"]
        # Use the precise orderDtm timestamp
        purchase_ts = p.get("orderDtm")
        window_start = purchase_ts - timedelta(hours=window_hours)

        # find candidate trials before purchase, same store & sku, in window
        candidates = db.trial_events.find({
            "storeCode": store,
            "sku": sku,
            "timestamp": {"$lte": purchase_ts, "$gte": window_start}
        }).sort("timestamp", -1).limit(5)

        # logger.info("Candidate trials for purchase:",await candidates.to_list())
        best = None
        async for t in candidates:
            # ensure trial not already linked to some other purchase
            already = await db.trial_purchase_links.find_one({"trialId": str(t["trialId"])})
            if already:
                continue
            best = t
            break

        # if we found a candidate trial, write a link
        if best:
            delta_min = (purchase_ts - best["timestamp"]).total_seconds() / 60.0
            link_doc = {
                "trialId": best.get("trialId") or str(best["_id"]),
                "orderNo": p["orderNo"],
                "lineNo": p["lineNo"],
                "sku": sku,
                "storeCode": store,
                "linkedAt": datetime.now(timezone.utc),
                "deltaMinutes": delta_min,
                "strategy": "heuristic",
                "matchingVersion": matching_version,
            }
            await db.trial_purchase_links.insert_one(link_doc)
            count_linked += 1

    return {"linked": count_linked}
