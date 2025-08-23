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
MONGODB_URI=mongodb+srv://<db_user>:<db_pw>@cluster0.dhudqnb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
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
```bash
curl -i -X POST "http://localhost:8000/v1/webhooks/pos" \
  -H "Content-Type: application/json" \
  --data-binary @scripts/sample_invoice.json
```
* First run → {"created":4,"skipped_duplicates":0}
* Running again with the same file → {"created":0,"skipped_duplicates":4}

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