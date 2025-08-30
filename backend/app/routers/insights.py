# app/routers/insights.py
from tracemalloc import start
from fastapi import APIRouter, Query, HTTPException
from datetime import datetime, timedelta, timezone
from app.db.mongo import insights_daily
from app.models.insights import StoreInsightsResponse, SkuRow

router = APIRouter()

@router.get("/v1/insights/store/{storeCode}", response_model=StoreInsightsResponse)
async def get_store_insights(
    storeCode: str,
    date: str = Query(..., description="YYYY-MM-DD UTC (end date inclusive)"),
    days: int = Query(7, ge=1, le=31)
):
    end_str = date                         # e.g., "2025-08-13" (IST)
    start_dt = datetime.strptime(end_str, "%Y-%m-%d") - timedelta(days=days-1)
    start_str = start_dt.strftime("%Y-%m-%d")

    cur = insights_daily().find({
        "storeCode": storeCode,
        "date": {"$gte": start_str, "$lte": end_str}   # lexicographic works for YYYY-MM-DD
    })

    rows = {}
    total_trials = total_purchases = 0

    async for doc in cur:
        key = (doc["sku"], doc.get("size"), doc.get("color"))
        r = rows.get(key) or {"sku": key[0], "size": key[1], "color": key[2],
                              "trials": 0, "purchases": 0, "title": None}
        r["trials"] += doc.get("trials", 0)
        r["purchases"] += doc.get("purchases", 0)
        # carry one title from snapshot if you saved it into insights; if not, skip
        # r["title"] = doc.get("title")
        rows[key] = r
        total_trials += doc.get("trials", 0)
        total_purchases += doc.get("purchases", 0)

    items: list[SkuRow] = []
    for r in rows.values():
        conv = (r["purchases"]/r["trials"]) if r["trials"] else 0.0
        items.append(SkuRow(
            sku=r["sku"], title=r.get("title"),
            size=r["size"], color=r["color"],
            trials=r["trials"], purchases=r["purchases"],
            tryNotBuy=r["trials"] - r["purchases"], conversion=conv
        ))

    items.sort(key=lambda x: (x.tryNotBuy, -x.trials), reverse=True)
    totals = {
        "trials": total_trials,
        "purchases": total_purchases,
        "conversion": (total_purchases/total_trials) if total_trials else 0.0
    }

    return StoreInsightsResponse(
        storeCode=storeCode,
        fromDate=start_str,
        toDate=end_str,
        totals=totals,
        topTryNotBuy=items[:20]
    )
