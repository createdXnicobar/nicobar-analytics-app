import httpx
from pydantic import BaseModel
from app.core.config import settings

class ProductSnapshot(BaseModel):
    title: str | None = None
    price: float | None = None
    size: str | None = None
    color: str | None = None
    category: dict | None = None
    imageUrl: str | None = None
    stockByLocation: dict[str,int] | None = None

async def fetch_product_by_sku(sku: str) -> ProductSnapshot | None:
    url = f"{settings.NICOBAR_API_BASE}/api/getProductsbySKU"
    async with httpx.AsyncClient(timeout=4.0) as client:
        r = await client.get(url, params={"sku": sku})
        if r.status_code != 200:
            return None
        raw = r.json().get("data", {})
        attr = raw.get("attributes", {}) or {}
        det = raw.get("productDetails", {}) or {}
        hier = raw.get("category_hierarchy", {}) or {}
        images = det.get("images") or []
        stock_map = { (x.get("storeCode") or "").upper(): int(x.get("stock") or 0)
                      for x in (attr.get("stockByLocation") or []) }
        try:
            price = float(det.get("price")) if det.get("price") is not None else None
        except Exception:
            price = None
        return ProductSnapshot(
            title=det.get("title"),
            price=price,
            size=attr.get("size"),
            color=attr.get("color"),
            category=hier,
            imageUrl=(images[0] if images else None),
            stockByLocation=stock_map
        )
