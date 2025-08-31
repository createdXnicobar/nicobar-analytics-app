# app/services/aggregation.py
from datetime import datetime, timezone, timedelta
from statistics import median
from collections import Counter, defaultdict
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.timeutil import ist_day_bounds

async def build_insights_for_date(db: AsyncIOMotorDatabase, date_str: str):
    start_utc, end_utc = ist_day_bounds(date_str)

    # 1) Trials grouped by store+sku (+optional size/color from snapshot)
    trials_map: dict[tuple, int] = Counter()
    reasons_map: dict[tuple, Counter] = defaultdict(Counter)

    cur_t = db.trial_events.find({"timestamp": {"$gte": start_utc, "$lt": end_utc}})
    async for t in cur_t:
        store = t["storeCode"]
        sku = t["sku"]
        snap = t.get("productSnapshot") or {}
        size = snap.get("size")
        color = snap.get("color")
        key = (store, sku, size, color)
        trials_map[key] += 1
        for tag in t.get("feedback", []):
            reasons_map[key][tag] += 1

    # 2) Purchases grouped by store+sku (+size/color snapshot at purchase time)
    purchases_map: dict[tuple, int] = Counter()

    cur_p = db.purchase_events.find({"orderDate": {"$gte": start_utc, "$lt": end_utc}, "isFreeItem": {"$ne": True}})
    async for p in cur_p:
        store = p["storeCode"]
        sku = p["sku"]
        snap = p.get("productSnapshot") or {}
        size = snap.get("size")
        color = snap.get("color")
        key = (store, sku, size, color)
        purchases_map[key] += int(p.get("qty", 1))

    # 3) Median TTP (minutes) from links on that date (purchase date window)
    ttp_map: dict[tuple, list[float]] = defaultdict(list)
    links_cur = db.trial_purchase_links.find({
        "storeCode": {"$exists": True},  # guard
        "linkedAt": {"$gte": start_utc, "$lt": end_utc}
    })
    async for L in links_cur:
        # fetch the linked purchase to get its size/color snapshot (optional)
        p = await db.purchase_events.find_one({"orderNo": L["orderNo"], "lineNo": L["lineNo"]})
        if not p: 
            continue
        store, sku = L["storeCode"], L["sku"]
        snap = p.get("productSnapshot") or {}
        size = snap.get("size")
        color = snap.get("color")
        key = (store, sku, size, color)
        if L.get("deltaMinutes") is not None:
            ttp_map[key].append(float(L["deltaMinutes"]))

    # 4) Upsert into insights_daily
    bulk = []
    for key in set(trials_map.keys()) | set(purchases_map.keys()) | set(ttp_map.keys()):
        store, sku, size, color = key
        trials = trials_map.get(key, 0)
        purchases = purchases_map.get(key, 0)
        conv = (purchases / trials) if trials else 0.0
        med_ttp = median(ttp_map[key]) if ttp_map.get(key) else None

        doc = {
            "date": date_str,
            "storeCode": store,
            "sku": sku,
            "trials": trials,
            "purchases": purchases,
            "conversion": conv,
            "medianTTPMinutes": med_ttp,
        }
        if size:  doc["size"] = size
        if color: doc["color"] = color
        rc = reasons_map.get(key)
        if rc:
            doc["reasonCounts"] = dict(rc)

        # two upsert patterns depending on presence of size/color
        if size and color:
            filt = {"date": date_str, "storeCode": store, "sku": sku, "size": size, "color": color}
        else:
            filt = {"date": date_str, "storeCode": store, "sku": sku, "size": {"$exists": False}, "color": {"$exists": False}}

        bulk.append(
            db.insights_daily.update_one(filt, {"$set": doc}, upsert=True)
        )

    if bulk:
        # await db.client.get_default_database().command("ping")  # ensure connection
        await db.insights_daily.database.client.admin.command("ping")  # no-op; keep loop alive
        # motor doesn't support bulk via list directly; run sequentially (ok for daily volume)
        for op in bulk:
            await op
    return {"upserts": len(bulk)}
