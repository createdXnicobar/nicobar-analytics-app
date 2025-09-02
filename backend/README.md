# Nicobar Trial→Purchase – Backend

FastAPI + MongoDB backend that ingests **trial events** and **POS invoices**

---

## Prerequisites

- **Python 3.12.7** (use `pyenv` or your OS package manager)

---

## 1) Create and activate a Python virtual environment (3.12.7)

> Run all commands from the `backend/` folder unless noted.

```bash
# Check Python version
python3 --version

# Create venv with Python 3.12
python3.12 -m venv venv

# Activate it
source venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1

# Upgrade pip
python -m pip install --upgrade pip

# Install all necessary requirements
pip install -r requirements.txt

```

## 2) Configure environment variables

> Create a file backend/.env

```bash
APP_NAME=nicobar-analytics
MONGO_USER=<db_user>
MONGO_PW=<db_pw>
MONGODB_URI=mongodb+srv://${MONGO_USER}:${MONGO_PW}@cluster0.dhudqnb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
DB_NAME=nicobar-analytics-db
NICOBAR_API_BASE=https://bronco.nicobar.com
ENV=dev
```

## 3) Run the backend API

```bash
# From backend/
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 4) Test the endpoints

#### Health Check
This endpoint returns OK status
```bash
curl http://localhost:8000/health
```

#### Trial Ingestion
```bash
curl -i -X POST "http://localhost:8000/v1/trials" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: trial-001" \
  -d '{
        "trialId":"trial-001",
        "sku":"NBI018587",
        "storeCode":"BIN",
        "feedback":["FIT","SIZE"]
      }'
```
* First run → 201 Created
* Re-running with the same X-Idempotency-Key → 409 Conflict (idempotency)

#### POS Webhook
Query Parameter : time in either of the two formats HH:MM:SS (IST) or ISO time
If the first format is provided, date will be picked up from the request's JSON body
```bash
curl -i -X POST "http://localhost:8000/v1/webhooks/pos?timestamp=14:30:00" \
  -H "Content-Type: application/json" \
  --data-binary @scripts/sample_invoice.json
```
For the sample json file refer to > backend/scripts/sample_invoice.json
* First run → {"created":4,"skipped_duplicates":0}
* Running again with the same file → {"created":0,"skipped_duplicates":4}

#### Admin Endpoints
There are two admin endpoints which currently need to be triggered manually each day - the /match and /aggregate endpoints. Both help in generation of analytics data and save daily analytics to the DB. These will run as scheduled jobs automatically triggered each day at a later stage.
```bash
curl -i -X POST "http://localhost:8000/v1/jobs/match?date=2025-09-02" 

Response Body:
{
  "linked": 1
}
```
```bash
curl -i -X POST "http://localhost:8000/v1/jobs/aggregate?date=2025-09-02"

Response Body:
{
  "upserts": 3
}
```

#### Analytics Endpoint
This is the analytics endpoint which provides real analytics data
```bash
curl -i -X GET "http://localhost:8000/v1/insights/store/{storeCode}?date=2025-09-02&days=7"

Response Body:
{
  "storeCode": "MBN",
  "fromDate": "2025-08-27",
  "toDate": "2025-09-02",
  "totals": {
    "trials": 3,
    "purchases": 4,
    "conversion": 1.3333333333333333
  },
  "topTryNotBuy": [
    {
      "sku": "NBI00036",
      "title": null,
      "size": null,
      "color": null,
      "trials": 1,
      "purchases": 0,
      "tryNotBuy": 1,
      "conversion": 0
    },
    {
      "sku": "NBI00034",
      "title": null,
      "size": null,
      "color": null,
      "trials": 1,
      "purchases": 0,
      "tryNotBuy": 1,
      "conversion": 0
    },
    {
      "sku": "NBI000589",
      "title": null,
      "size": "M",
      "color": "Charcoal",
      "trials": 1,
      "purchases": 1,
      "tryNotBuy": 0,
      "conversion": 1
    },
    {
      "sku": "NBI000385",
      "title": null,
      "size": "L",
      "color": "Soft Grey",
      "trials": 0,
      "purchases": 1,
      "tryNotBuy": -1,
      "conversion": 0
    },
    {
      "sku": "NBI000384",
      "title": null,
      "size": "M",
      "color": "Soft Grey",
      "trials": 0,
      "purchases": 1,
      "tryNotBuy": -1,
      "conversion": 0
    },
    {
      "sku": "456",
      "title": null,
      "size": null,
      "color": null,
      "trials": 0,
      "purchases": 1,
      "tryNotBuy": -1,
      "conversion": 0
    }
  ]
}
```

## 5) Troubleshooting
1. 422 Unprocessable Entity posting a JSON file
    * Validate the file: python -m json.tool backend/scripts/sample_invoice.json
    * Ensure correct path / working directory:
    ```bash
    curl -i -X POST http://localhost:8000/v1/webhooks/pos \
    -H "Content-Type: application/json" \
    --data-binary @backend/scripts/sample_invoice.json
    ```

2. File not found from curl

    * pwd → where am I?
    * ls -l scripts/sample_invoice.json → does it exist here?

3. 500 from product resolver

    * ensure the real endpoint is reachable.
    * Resolver is defensive; if upstream returns data:null, it stores with productSnapshot: null (no crash).

4. Timezones look “wrong” in Mongo

    * Mongo stores Date in UTC by design. The app interprets days in IST when matching and aggregating, and you can format IST for display.

## 6) Project Structure
```bash
backend/
  app/
    core/               # config, logging, security
    db/                 # motor client + collection handles
    models/             # Pydantic DTOs
    routers/            # health, trials, pos_webhook, jobs, insights
    services/           # product_resolver, matching, aggregation, tz, etc.
    main.py
  scripts/
    mock_nicobar.py     # optional mock Nicobar API
    seed_stores.py
    sample_invoice.json
  setup_nicobar_analytics_db.py
  requirements.txt
  README.md
```