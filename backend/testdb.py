# setup_nicobar_analytics_db.py
import os
from datetime import datetime
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import CollectionInvalid

from dotenv import load_dotenv
load_dotenv()

DB_NAME = "nicobar-analytics-db"
MONGODB_USER = os.getenv("MONGODB_USER")
MONGODB_PW = os.getenv("MONGODB_PW")

def get_db():
    uri = f"mongodb+srv://{MONGODB_USER}:{MONGODB_PW}@cluster0.dhudqnb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
    client = MongoClient(uri)
    return client[DB_NAME]

def ensure_collection(db, name, validator):
    """
    Create collection with a JSON Schema validator if it doesn't exist.
    If it exists, update the validator via collMod.
    """
    if name in db.list_collection_names():
        # Update validator to latest (moderate = only invalid *new/updated* docs are rejected)
        db.command({
            "collMod": name,
            "validator": validator,
            "validationLevel": "moderate",
            "validationAction": "error"
        })
        print(f"[OK] Updated validator on {name}")
        return db.get_collection(name)
    else:
        try:
            db.create_collection(
                name,
                validator=validator,
                validationLevel="moderate",
                validationAction="error"
            )
            print(f"[OK] Created collection {name} with validator")
        except CollectionInvalid:
            # Race safety
            pass
        return db.get_collection(name)

def create_indexes(db):
    # === trial_events indexes ===
    trial = db.get_collection("trial_events")
    trial.create_index([("idemKey", ASCENDING)], unique=True, name="uq_idemKey")
    trial.create_index([("storeCode", ASCENDING), ("timestamp", ASCENDING)], name="ix_store_timestamp")
    trial.create_index([("sku", ASCENDING), ("timestamp", ASCENDING)], name="ix_sku_timestamp")
    trial.create_index([("sessionId", ASCENDING)], name="ix_sessionId")
    # feedback is a multikey array; add if you'll query by tag + time
    trial.create_index([("feedback", ASCENDING), ("timestamp", ASCENDING)], name="ix_feedback_timestamp")

    # === purchase_events indexes ===
    pur = db.get_collection("purchase_events")
    pur.create_index([("idemKey", ASCENDING)], unique=True, name="uq_idemKey")
    pur.create_index([("storeCode", ASCENDING), ("orderDate", ASCENDING)], name="ix_store_orderDate")
    pur.create_index([("sku", ASCENDING), ("orderDate", ASCENDING)], name="ix_sku_orderDate")
    pur.create_index([("customerHash", ASCENDING), ("orderDate", ASCENDING)], name="ix_customerHash_orderDate")

    # === stores indexes ===
    stores = db.get_collection("stores")
    # storeCode is the _id; uniqueness implied. Add helpers:
    stores.create_index([("city", ASCENDING), ("state", ASCENDING)], name="ix_city_state")
    stores.create_index([("active", ASCENDING)], name="ix_active")

    # === trial_purchase_links indexes ===
    links = db.get_collection("trial_purchase_links")
    links.create_index([("trialId", ASCENDING)], unique=True, name="uq_trialId")
    links.create_index([("orderNo", ASCENDING), ("lineNo", ASCENDING)], unique=True, name="uq_order_line")
    links.create_index([("storeCode", ASCENDING), ("sku", ASCENDING), ("linkedAt", ASCENDING)], name="ix_store_sku_linkedAt")

    # === insights_daily indexes ===
    ins = db.get_collection("insights_daily")
    # We support docs with and without size/color using two partial unique indexes.
    # 1) Unique for docs WITHOUT size & color
    ins.create_index(
        [("date", ASCENDING), ("storeCode", ASCENDING), ("sku", ASCENDING)],
        name="uq_date_store_sku_no_sizecolor",
        unique=True,
        partialFilterExpression={"size": {"$exists": False}, "color": {"$exists": False}}
    )
    # 2) Unique for docs WITH size & color
    ins.create_index(
        [("date", ASCENDING), ("storeCode", ASCENDING), ("sku", ASCENDING), ("size", ASCENDING), ("color", ASCENDING)],
        name="uq_date_store_sku_size_color",
        unique=True,
        partialFilterExpression={"size": {"$exists": True}, "color": {"$exists": True}}
    )
    # Helpful query accelerators:
    ins.create_index([("sku", ASCENDING), ("date", ASCENDING)], name="ix_sku_date")
    ins.create_index([("storeCode", ASCENDING), ("date", ASCENDING)], name="ix_store_date")

def main():
    db = get_db()

    # =========================
    # Validators (JSON Schema)
    # =========================

    trial_events_validator = {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["timestamp", "storeCode", "sku", "idemKey"],
            "properties": {
                "trialId": {"bsonType": "string"},
                "timestamp": {"bsonType": "date"},
                "storeCode": {"bsonType": "string", "description": "UPPER store code"},
                "sku": {"bsonType": "string"},
                "feedback": {
                    "bsonType": "array",
                    "items": {"bsonType": "string"}
                },
                "sessionId": {"bsonType": ["string", "null"]},
                "scannedBy": {"bsonType": ["string", "null"]},
                "deviceId": {"bsonType": ["string", "null"]},
                "idemKey": {"bsonType": "string"},
                "productSnapshot": {
                    "bsonType": ["object", "null"],
                    "properties": {
                        "title": {"bsonType": ["string", "null"]},
                        "price": {"bsonType": ["double", "decimal", "int", "long", "null"]},
                        "size": {"bsonType": ["string", "null"]},
                        "color": {"bsonType": ["string", "null"]},
                        "category": {
                            "bsonType": ["object", "null"],
                            "properties": {
                                "product_category": {"bsonType": ["string", "null"]},
                                "product_subcategory": {"bsonType": ["string", "null"]},
                                "product_class": {"bsonType": ["string", "null"]},
                                "product_subclass": {"bsonType": ["string", "null"]}
                            },
                            "additionalProperties": True
                        },
                        "imageUrl": {"bsonType": ["string", "null"]},
                        "stockAtTrial": {"bsonType": ["int", "long", "null"]}
                    },
                    "additionalProperties": True
                },
                "enrichment": {
                    "bsonType": ["object", "null"],
                    "properties": {
                        "status": {"enum": ["done", "pending", "failed"]},
                        "lastTriedAt": {"bsonType": ["date", "null"]},
                        "apiLatencyMs": {"bsonType": ["int", "long", "null"]}
                    },
                    "additionalProperties": True
                },
                "schemaVersion": {"bsonType": ["int", "null"]}
            },
            "additionalProperties": True
        }
    }

    purchase_events_validator = {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["orderNo", "lineNo", "orderDate", "storeCode", "sku", "qty", "priceList", "priceBilled", "currency", "idemKey"],
            "properties": {
                "orderNo": {"bsonType": "string"},
                "lineNo": {"bsonType": "string"},
                "orderDate": {"bsonType": "date"},
                "storeCode": {"bsonType": "string"},
                "sku": {"bsonType": "string"},
                "qty": {"bsonType": ["int", "long"]},
                "priceList": {"bsonType": ["double", "decimal", "int", "long"]},
                "priceBilled": {"bsonType": ["double", "decimal", "int", "long"]},
                "currency": {"bsonType": "string"},
                "isFreeItem": {"bsonType": ["bool", "null"]},
                "customerHash": {"bsonType": ["string", "null"]},
                "idemKey": {"bsonType": "string"},
                "productSnapshot": {
                    "bsonType": ["object", "null"],
                    "properties": {
                        "title": {"bsonType": ["string", "null"]},
                        "price": {"bsonType": ["double", "decimal", "int", "long", "null"]},
                        "size": {"bsonType": ["string", "null"]},
                        "color": {"bsonType": ["string", "null"]},
                        "category": {
                            "bsonType": ["object", "null"],
                            "properties": {
                                "product_category": {"bsonType": ["string", "null"]},
                                "product_subcategory": {"bsonType": ["string", "null"]},
                                "product_class": {"bsonType": ["string", "null"]},
                                "product_subclass": {"bsonType": ["string", "null"]}
                            },
                            "additionalProperties": True
                        },
                        "imageUrl": {"bsonType": ["string", "null"]},
                        "stockAtPurchase": {"bsonType": ["int", "long", "null"]}
                    },
                    "additionalProperties": True
                },
                "ingestion": {
                    "bsonType": ["object", "null"],
                    "properties": {
                        "source": {"bsonType": ["string", "null"]},
                        "ingestedAt": {"bsonType": ["date", "null"]},
                        "signatureValid": {"bsonType": ["bool", "null"]}
                    },
                    "additionalProperties": True
                },
                "schemaVersion": {"bsonType": ["int", "null"]}
            },
            "additionalProperties": True
        }
    }

    stores_validator = {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["storeCode", "storeName", "city", "state", "active"],
            "properties": {
                "_id": {"bsonType": ["string", "null"]},
                "storeCode": {"bsonType": "string"},
                "storeName": {"bsonType": "string"},
                "city": {"bsonType": "string"},
                "state": {"bsonType": "string"},
                "region": {"bsonType": ["string", "null"]},
                "timezone": {"bsonType": ["string", "null"]},
                "active": {"bsonType": "bool"},
                "schemaVersion": {"bsonType": ["int", "null"]}
            },
            "additionalProperties": True
        }
    }

    trial_purchase_links_validator = {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["trialId", "orderNo", "lineNo", "sku", "storeCode", "linkedAt", "strategy", "matchingVersion"],
            "properties": {
                "trialId": {"bsonType": "string"},
                "orderNo": {"bsonType": "string"},
                "lineNo": {"bsonType": "string"},
                "sku": {"bsonType": "string"},
                "storeCode": {"bsonType": "string"},
                "linkedAt": {"bsonType": "date"},
                "deltaMinutes": {"bsonType": ["int", "long", "double", "null"]},
                "strategy": {"enum": ["deterministic", "heuristic"]},
                "matchingVersion": {"bsonType": "string"},
                "schemaVersion": {"bsonType": ["int", "null"]}
            },
            "additionalProperties": True
        }
    }

    insights_daily_validator = {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["date", "storeCode", "sku", "trials", "purchases", "conversion"],
            "properties": {
                # date stored as "YYYY-MM-DD" string (use a date only if you prefer)
                "date": {"bsonType": "string"},
                "storeCode": {"bsonType": "string"},
                "sku": {"bsonType": "string"},
                "size": {"bsonType": ["string", "null"]},
                "color": {"bsonType": ["string", "null"]},
                "trials": {"bsonType": ["int", "long"]},
                "purchases": {"bsonType": ["int", "long"]},
                "conversion": {"bsonType": ["double", "decimal"]},
                "medianTTPMinutes": {"bsonType": ["int", "long", "double", "null"]},
                "uniqueSessions": {"bsonType": ["int", "long", "null"]},
                "reasonCounts": {
                    "bsonType": ["object", "null"],
                    "additionalProperties": {
                        "bsonType": ["int", "long"]
                    }
                },
                "schemaVersion": {"bsonType": ["int", "null"]}
            },
            "additionalProperties": True
        }
    }

    # =========================
    # Create collections
    # =========================
    ensure_collection(db, "trial_events", trial_events_validator)
    ensure_collection(db, "purchase_events", purchase_events_validator)
    ensure_collection(db, "stores", stores_validator)
    ensure_collection(db, "trial_purchase_links", trial_purchase_links_validator)
    ensure_collection(db, "insights_daily", insights_daily_validator)

    # =========================
    # Create indexes
    # =========================
    create_indexes(db)

    print(f"\n[DONE] Database '{DB_NAME}' is ready.\n")

if __name__ == "__main__":
    main()
