from __future__ import annotations

import os
from datetime import datetime, timezone
from types import SimpleNamespace
from collections.abc import Iterator

import pytest
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("APP_NAME", "test-app")
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test-db")
os.environ.setdefault("NICOBAR_API_BASE", "http://example.com")

from app.main import app

import app.routers.admin_jobs as admin_jobs_router
import app.routers.insights as insights_router
import app.routers.pos_webhook as pos_webhook_router
import app.routers.trials as trials_router

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


class _FakeCursor:
    """Simple async cursor used by the insights endpoint test."""

    def __init__(self, docs: list[dict]):
        self._docs = docs
        self._iter: Iterator[dict] | None = None

    def __aiter__(self):  # pragma: no cover - simple helper
        self._iter = iter(self._docs)
        return self

    async def __anext__(self):
        assert self._iter is not None
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


class _FakeTrialCollection:
    def __init__(self):
        self.docs: list[dict] = []

    async def find_one(self, query: dict):
        idem = query.get("idemKey")
        for doc in self.docs:
            if doc.get("idemKey") == idem:
                return doc
        return None

    async def insert_one(self, doc: dict):
        self.docs.append(doc)


class _FakePurchaseCollection:
    def __init__(self):
        self.docs: list[dict] = []

    async def find_one(self, query: dict):
        idem = query.get("idemKey")
        for doc in self.docs:
            if doc.get("idemKey") == idem:
                return doc
        return None

    async def insert_one(self, doc: dict):
        self.docs.append(doc)


class _FakeInsightsCollection:
    def __init__(self, docs: list[dict]):
        self.docs = docs
        self.received_query: dict | None = None

    def find(self, query: dict):
        self.received_query = query
        return _FakeCursor(self.docs)


async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/health")
        assert r.status_code == 200
        assert r.json()["ok"] is True


async def test_create_trial_inserts_snapshot_and_returns_ack(monkeypatch):
    collection = _FakeTrialCollection()
    monkeypatch.setattr(trials_router, "trial_events", lambda: collection)

    fixed_now = datetime(2024, 1, 1, 12, 30, tzinfo=timezone.utc)
    monkeypatch.setattr(trials_router, "utc_now", lambda: fixed_now)

    async def fake_fetch_product_by_sku(sku: str):
        assert sku == "SKU-1"
        return SimpleNamespace(
            title="A Linen Shirt",
            price=1290.5,
            size="M",
            color="Blue",
            category={"segment": "tops"},
            imageUrl="http://example.com/image.jpg",
            stockByLocation={"BLR01": 7},
        )

    monkeypatch.setattr(trials_router, "fetch_product_by_sku", fake_fetch_product_by_sku)

    transport = ASGITransport(app=app)
    payload = {
        "sku": "SKU-1",
        "storeCode": "blr01",
        "feedback": ["fit"],
        "sessionId": "sess-1",
        "scannedBy": "alice",
        "bundleId": "bundle-42",
    }
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.post("/v1/trials", json=payload, headers={"X-Idempotency-Key": "idem-1"})

    assert r.status_code == 201
    data = r.json()
    assert data["storedAt"].startswith("2024-01-01T12:30:00")

    assert len(collection.docs) == 1
    stored = collection.docs[0]
    assert stored["storeCode"] == "BLR01"
    assert stored["sku"] == "SKU-1"
    assert stored["feedback"] == ["fit"]
    assert stored["sessionId"] == "sess-1"
    assert stored["scannedBy"] == "alice"
    assert stored["bundleId"] == "bundle-42"
    assert stored["idemKey"] == "idem-1"
    assert stored["timestamp"] == fixed_now
    assert stored["enrichment"]["status"] == "done"
    assert stored["productSnapshot"]["stockAtTrial"] == 7


async def test_create_trial_duplicate_conflict(monkeypatch):
    collection = _FakeTrialCollection()
    collection.docs.append({"idemKey": "dup-1"})
    monkeypatch.setattr(trials_router, "trial_events", lambda: collection)

    async def fake_fetch_product_by_sku(sku: str):
        raise AssertionError("should not fetch product when duplicate")

    monkeypatch.setattr(trials_router, "fetch_product_by_sku", fake_fetch_product_by_sku)

    payload = {
        "sku": "SKU-2",
        "storeCode": "blr02",
        "timestamp": "2024-01-05T10:00:00Z",
        "feedback": [],
        "sessionId": None,
        "scannedBy": "bob",
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.post("/v1/trials", json=payload, headers={"X-Idempotency-Key": "dup-1"})

    assert r.status_code == 409
    assert len(collection.docs) == 1


async def test_pos_webhook_creates_and_skips_duplicates(monkeypatch):
    collection = _FakePurchaseCollection()
    monkeypatch.setattr(pos_webhook_router, "purchase_events", lambda: collection)

    fixed_now = datetime(2024, 2, 1, 9, 15, tzinfo=timezone.utc)
    monkeypatch.setattr(pos_webhook_router, "utc_now", lambda: fixed_now)

    async def fake_fetch_product_by_sku(sku: str):
        return SimpleNamespace(
            title="Dress",
            price=1790.0,
            size="L",
            color="Red",
            category={"line": "evening"},
            imageUrl=None,
            stockByLocation={"BLR01": 3},
        )

    monkeypatch.setattr(pos_webhook_router, "fetch_product_by_sku", fake_fetch_product_by_sku)
    monkeypatch.setattr(pos_webhook_router, "customer_hash", lambda mobile, email: "hash-value")

    line = {
        "Customer_No": "C1",
        "Customer_Email_ID": "c@example.com",
        "Customer_Mobile": "9999999999",
        "Type": "Sale",
        "Document_Type": "Invoice",
        "Order_No": "INV-1",
        "OrderDt": "2024-02-01",
        "OrderDtm": "2024-02-01T14:45:00.000+0530",
        "Line_No": "1",
        "Item_Code": "SKU-5",
        "Price": "1290.50",
        "Quantity": "1",
        "Billed_Price": "1290.50",
        "Currency_Code": "INR",
        "StoreCode": "blr01",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.post("/v1/webhooks/pos", json=[line, dict(line)])

    assert r.status_code == 200
    data = r.json()
    assert data == {"created": 1, "skipped_duplicates": 1}

    assert len(collection.docs) == 1
    stored = collection.docs[0]
    assert stored["orderNo"] == "INV-1"
    assert stored["lineNo"] == "1"
    assert stored["storeCode"] == "BLR01"
    assert stored["priceList"] == pytest.approx(1290.50)
    assert stored["priceBilled"] == pytest.approx(1290.50)
    assert stored["qty"] == 1
    assert stored["customerHash"] == "hash-value"
    assert stored["idemKey"] == "INV-1_1"
    assert stored["ingestion"]["ingestedAt"] == fixed_now
    assert stored["productSnapshot"]["stockAtPurchase"] == 3
    assert stored["orderDate"].tzinfo is not None
    assert stored["orderDtm"].tzinfo is not None


async def test_admin_match_job_invokes_service(monkeypatch):
    fake_db = object()
    monkeypatch.setattr(admin_jobs_router, "get_db", lambda: fake_db)

    called: dict[str, tuple] = {}

    async def fake_link_trials(db, date: str):
        called["args"] = (db, date)
        return {"linked": 3}

    monkeypatch.setattr(admin_jobs_router, "link_trials_to_purchases_for_date", fake_link_trials)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.post("/jobs/match", params={"date": "2024-03-15"})

    assert r.status_code == 200
    assert r.json() == {"linked": 3}
    assert called["args"] == (fake_db, "2024-03-15")


async def test_admin_aggregate_job_invokes_service(monkeypatch):
    fake_db = object()
    monkeypatch.setattr(admin_jobs_router, "get_db", lambda: fake_db)

    called: dict[str, tuple] = {}

    async def fake_build_insights(db, date: str):
        called["args"] = (db, date)
        return {"upserts": 5}

    monkeypatch.setattr(admin_jobs_router, "build_insights_for_date", fake_build_insights)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.post("/jobs/aggregate", params={"date": "2024-03-20"})

    assert r.status_code == 200
    assert r.json() == {"upserts": 5}
    assert called["args"] == (fake_db, "2024-03-20")


async def test_get_store_insights_aggregates_documents(monkeypatch):
    docs = [
        {"storeCode": "BLR01", "sku": "SKU1", "trials": 5, "purchases": 2},
        {"storeCode": "BLR01", "sku": "SKU1", "trials": 3, "purchases": 1},
        {"storeCode": "BLR01", "sku": "SKU2", "trials": 2, "purchases": 0, "size": "M"},
    ]
    collection = _FakeInsightsCollection(docs)
    monkeypatch.setattr(insights_router, "insights_daily", lambda: collection)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/v1/insights/store/BLR01", params={"date": "2024-01-10", "days": 3})

    assert r.status_code == 200
    data = r.json()

    assert data["storeCode"] == "BLR01"
    assert data["fromDate"] == "2024-01-08"
    assert data["toDate"] == "2024-01-10"
    assert data["totals"]["trials"] == 10
    assert data["totals"]["purchases"] == 3
    assert data["totals"]["conversion"] == pytest.approx(0.3)

    top = data["topTryNotBuy"]
    assert [item["sku"] for item in top] == ["SKU1", "SKU2"]
    assert top[0]["trials"] == 8
    assert top[0]["tryNotBuy"] == 5
    assert top[0]["conversion"] == pytest.approx(3 / 8)

    assert collection.received_query is not None
    assert collection.received_query["storeCode"] == "BLR01"
    assert collection.received_query["date"]["$gte"] == "2024-01-08"
    assert collection.received_query["date"]["$lte"] == "2024-01-10"
