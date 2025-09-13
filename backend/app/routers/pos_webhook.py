# app/routers/pos_webhook.py
from fastapi import APIRouter, Header
from datetime import datetime, timezone
from decimal import Decimal
from typing import List
from app.services.timeutil import to_utc, utc_now, IST
from app.db.mongo import purchase_events
from app.models.purchases import InvoiceLine
from app.services.product_resolver import fetch_product_by_sku
from app.services.hash_util import customer_hash

router = APIRouter()

def _to_float(x: str | None) -> float:
    if x is None or x == "":
        return 0.0
    return float(Decimal(x))

# Edit the below method in case the order_dtm's offset value is changed or timezone is modified. 
# Currently the timezone is IST (+05:30) and offset value is +0530
def _parse_order_dt(order_dt: str, order_dtm: str | None = None) -> datetime:
    """
    Accepts 'YYYY-MM-DD' for order date and optional OrderDtm timestamp.
    - If OrderDtm is provided, use it as the actual purchase time (expects IST timezone)
    - If OrderDtm is missing, fall back to order date (midnight IST)
    - Always return UTC-aware datetime.
    """
    try:
        # If we have OrderDtm, prioritize it
        if order_dtm:
            # Handle ISO format with timezone info like "2025-06-08T12:05:51.000+0530"
            if "T" in order_dtm:
                # Handle IST timezone offset (+0530)
                if "+0530" in order_dtm:
                    order_dtm = order_dtm.replace("+0530", "+05:30")
                
                # Remove milliseconds if present for easier parsing
                if "." in order_dtm and "+05:30" in order_dtm:
                    parts = order_dtm.split(".")
                    order_dtm = parts[0] + "+05:30"
                
                dt = datetime.fromisoformat(order_dtm)
                # If no timezone info, assume IST
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=IST)
            else:
                # If OrderDtm is just time (HH:MM:SS), combine with order date
                order_date = datetime.strptime(order_dt, "%Y-%m-%d")
                time_part = datetime.strptime(order_dtm, "%H:%M:%S").time()
                dt = datetime.combine(order_date.date(), time_part).replace(tzinfo=IST)
            return to_utc(dt)
        
        # Fall back to order date logic (existing behavior)
        if "T" in order_dt:
            dt = datetime.fromisoformat(order_dt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=IST)
        else:
            # Date-only -> interpret as midnight IST of that calendar day
            dt = datetime.strptime(order_dt, "%Y-%m-%d").replace(tzinfo=IST)
        return to_utc(dt)
    except Exception:
        return utc_now()

@router.post("/v1/webhooks/pos")
async def pos_webhook(
    lines: List[InvoiceLine], 
    x_signature: str | None = Header(default=None)
):
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
            "orderDtm": _parse_order_dt(line.OrderDt, line.OrderDtm),
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
