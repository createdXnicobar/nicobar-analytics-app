# app/routers/pos_webhook.py
from fastapi import APIRouter, Header
from datetime import datetime, timezone
from decimal import Decimal
from typing import List
from app.services.tz import to_utc, utc_now, IST
from app.db.mongo import purchase_events
from app.models.purchases import InvoiceLine
from app.services.product_resolver import fetch_product_by_sku
from app.services.hash_util import customer_hash

router = APIRouter()

def _to_float(x: str | None) -> float:
    if x is None or x == "":
        return 0.0
    return float(Decimal(x))

def _parse_order_dt(s: str) -> datetime:
    """
    Accepts 'YYYY-MM-DD' or ISO strings.
    - If it's date-only or naive, assume IST calendar/time, then convert to UTC.
    - Always return UTC-aware datetime.
    """
    try:
        if "T" in s:
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=IST)
        else:
            # Date-only -> interpret as midnight IST of that calendar day
            dt = datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=IST)
        return to_utc(dt)
    except Exception:
        return utc_now()

@router.post("/v1/webhooks/pos")
async def pos_webhook(lines: List[InvoiceLine], x_signature: str | None = Header(default=None)):
    # (optional) verify x_signature here
    created, skipped = 0, 0

    for line in lines:
        idem_key = f"{line.Order_No}_{line.Line_No}"
        exists = await purchase_events().find_one({"idemKey": idem_key})
        if exists:
            skipped += 1
            continue

        snap = await fetch_product_by_sku(line.Item_Code)
        price_list = _to_float(line.Price)
        price_billed = _to_float(line.Billed_Price)
        qty = int(line.Quantity)

        doc = {
            "orderNo": line.Order_No,
            "lineNo": line.Line_No,
            "orderDate": _parse_order_dt(line.OrderDt),
            "storeCode": line.StoreCode.upper(),
            "sku": line.Item_Code,
            "qty": qty,
            "priceList": price_list,
            "priceBilled": price_billed,
            "currency": line.Currency_Code,
            "isFreeItem": (price_billed == 0),
            "customerHash": customer_hash(line.Customer_Mobile, line.Customer_Email_ID),
            "idemKey": idem_key,
            "productSnapshot": None,
            "ingestion": {
                "source": "webhook",
                "ingestedAt": utc_now(),
                "signatureValid": True if x_signature else None
            }
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
                "stockAtPurchase": stock_here,
            }

        await purchase_events().insert_one(doc)
        created += 1

    return {"created": created, "skipped_duplicates": skipped}
