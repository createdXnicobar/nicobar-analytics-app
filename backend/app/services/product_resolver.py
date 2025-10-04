# app/services/product_resolver.py
import httpx
from typing import Optional
from pydantic import BaseModel
from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

class ProductSnapshot(BaseModel):
    title: Optional[str] = None
    price: Optional[float] = None
    size: Optional[str] = None
    color: Optional[str] = None
    category: Optional[dict] = None
    imageUrl: Optional[str] = None
    stockByLocation: Optional[dict[str, int]] = None

def _to_float(x) -> Optional[float]:
    try:
        if x is None: 
            return None
        return float(x)
    except Exception:
        return None

async def fetch_product_by_sku(sku: str) -> Optional[ProductSnapshot]:
    """
    Best-effort fetch. Never raises; returns None if upstream is unavailable
    or the SKU is unknown or the payload is missing fields.
    """
    logger.debug(f"Fetching product information for SKU: {sku}")
    url = f"{settings.NICOBAR_API_BASE}/api/getProductsbySKU"
    
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url, params={"sku": sku})
    except Exception as e:
        logger.warning(f"HTTP error fetching product for SKU {sku}: {repr(e)}")
        return None

    if resp.status_code != 200:
        logger.info(f"Non-200 response for SKU {sku}: status {resp.status_code}")
        return None

    try:
        body = resp.json()
    except ValueError as e:
        logger.warning(f"Invalid JSON response for SKU {sku}: {repr(e)}")
        return None

    data = body.get("data") or {}  # <- key change: coalesce None to {}
    # If data is empty/None, just return None (unknown SKU)
    if not isinstance(data, dict) or not data:
        logger.info(f"No product data found for SKU: {sku}")
        return None

    attr = data.get("attributes") or {}
    det  = data.get("productDetails") or {}
    hier = data.get("category_hierarchy") or {}
    images = det.get("images") or []

    stock_map: dict[str, int] = {}
    for x in attr.get("stockByLocation") or []:
        try:
            code = (x.get("storeCode") or "").upper()
            stock_map[code] = int(x.get("stock") or 0)
        except Exception:
            continue

    snap = ProductSnapshot(
        title=det.get("title"),
        price=_to_float(det.get("price")),
        size=attr.get("size"),
        color=attr.get("color"),
        category=hier if isinstance(hier, dict) else None,
        imageUrl=(images[0] if images else None),
        stockByLocation=stock_map or None,
    )

    # If literally nothing meaningful, treat as not found
    if not any([snap.title, snap.size, snap.color, snap.category, snap.imageUrl]):
        logger.debug(f"Product snapshot for SKU {sku} contains no meaningful data")
        return None

    logger.debug(f"Successfully resolved product for SKU {sku}: {snap.title}")
    return snap

async def fetch_products_by_skus(skus: list[str]) -> dict[str, Optional[ProductSnapshot]]:
    """
    Batch fetch multiple products by SKUs. Returns a dict mapping SKU to ProductSnapshot.
    More efficient than individual calls for multiple SKUs.
    """
    if not skus:
        return {}
    
    unique_skus = list(set(skus))
    logger.debug(f"Batch fetching product information for {len(unique_skus)} unique SKUs")
    
    results: dict[str, Optional[ProductSnapshot]] = {}
    
    # For now, we'll use the individual endpoint in parallel
    # This could be optimized further if the API supports batch endpoints
    import asyncio
    
    async def fetch_single(sku: str) -> tuple[str, Optional[ProductSnapshot]]:
        result = await fetch_product_by_sku(sku)
        return sku, result
    
    try:
        # Use asyncio.gather to fetch all SKUs in parallel
        tasks = [fetch_single(sku) for sku in unique_skus]
        fetch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in fetch_results:
            if isinstance(result, Exception):
                logger.warning(f"Exception in batch product fetch: {result}")
                continue
            sku, snapshot = result
            results[sku] = snapshot
            
        logger.debug(f"Batch product fetch completed. Found {sum(1 for v in results.values() if v is not None)} products out of {len(unique_skus)} SKUs")
        return results
        
    except Exception as e:
        logger.error(f"Error in batch product fetch: {str(e)}", exc_info=True)
        # Fallback: return empty results for all SKUs
        return {sku: None for sku in unique_skus}
