# POS Webhook Timestamp Enhancement - Query Parameter Approach

## Overview
Enhanced the POS webhook to accept a timestamp as a query parameter, providing more accurate purchase timing information while keeping the request body unchanged.

## Implementation Details

### Changes Made

#### 1. Webhook Endpoint Updates (`app/routers/pos_webhook.py`)
- Added `Query` import from FastAPI
- Added optional `timestamp` query parameter to the endpoint
- Enhanced `_parse_order_dt()` function to handle timestamp parsing
- Maintains complete backward compatibility

#### 2. Timestamp Parsing Logic
- **Time Format**: Accepts "HH:MM:SS" format (e.g., "16:45:30")
- **ISO Format**: Accepts full ISO timestamp (e.g., "2025-08-31T16:45:30+05:30")
- **Fallback**: Uses order date at midnight IST when no timestamp provided
- **Timezone**: Assumes IST for naive timestamps, converts to UTC for storage

## API Usage

### Current Endpoint Signature
```python
@router.post("/v1/webhooks/pos")
async def pos_webhook(
    lines: List[InvoiceLine], 
    x_signature: str | None = Header(default=None),
    timestamp: str | None = Query(default=None, description="Purchase timestamp in HH:MM:SS format or ISO format")
):
```

### Usage Examples

#### 1. With Timestamp (Enhanced Precision)
```bash
POST /v1/webhooks/pos?timestamp=16:45:30
Content-Type: application/json

[
  {
    "Customer_No": "NBC00308212",
    "Type": "SALE",
    "Document_Type": "POS Invoice", 
    "Order_No": "BN2SU250001167",
    "OrderDt": "2025-08-31",
    "Line_No": "20000",
    "Item_Code": "NBI005311",
    "Price": "950.00",
    "Quantity": "1",
    "Billed_Price": "950",
    "Currency_Code": "INR",
    "StoreCode": "BIN"
  }
]
```

#### 2. With ISO Timestamp
```bash
POST /v1/webhooks/pos?timestamp=2025-08-31T16:45:30%2B05:30
```

#### 3. Without Timestamp (Backward Compatible)
```bash
POST /v1/webhooks/pos
Content-Type: application/json

[
  {
    "OrderDt": "2025-08-31",
    "Order_No": "BN2SU250001167",
    // ... same body structure as before
  }
]
```

### URL Encoding
When using special characters in query parameters:
- `+` becomes `%2B`
- `:` becomes `%3A` (though usually not required)
- Space becomes `%20`

## Benefits

### 1. Unchanged Request Body
- Existing integrations continue to work without modification
- No changes needed to invoice line data structure
- Clean separation between timing metadata and business data

### 2. Enhanced Analytics Precision
- **Trial-to-Purchase Matching**: More accurate time-to-purchase calculations
- **Daily Insights**: Better understanding of purchase patterns throughout the day
- **Conversion Tracking**: Precise timing for behavioral analysis

### 3. Flexible Implementation
- Optional parameter - defaults gracefully
- Supports multiple timestamp formats
- Easy to add to existing API calls

## Technical Implementation

### Timestamp Processing Flow
1. **Query Parameter Parsing**: FastAPI automatically extracts `timestamp` parameter
2. **Format Detection**: Function determines if timestamp is time-only or full ISO
3. **Date Combination**: For time-only format, combines with order date
4. **Timezone Normalization**: Converts to UTC for consistent storage
5. **Fallback Handling**: Uses midnight IST if no timestamp provided

### Database Impact
- **Field**: `orderDate` in `purchase_events` collection
- **Type**: Still datetime (UTC)
- **Enhancement**: Now contains actual purchase time instead of midnight default
- **Compatibility**: All existing queries and aggregations work unchanged

### Error Handling
- Invalid timestamp formats fall back to current timestamp
- Malformed dates default to order date midnight IST
- Robust parsing prevents webhook failures

## Testing

### Manual Testing
```bash
# Test with time format
curl -X POST "http://localhost:8000/v1/webhooks/pos?timestamp=14:30:45" \
     -H "Content-Type: application/json" \
     -d @sample_invoice.json

# Test without timestamp (backward compatibility)
curl -X POST "http://localhost:8000/v1/webhooks/pos" \
     -H "Content-Type: application/json" \
     -d @sample_invoice.json

# Test with ISO timestamp
curl -X POST "http://localhost:8000/v1/webhooks/pos?timestamp=2025-08-31T16:45:30%2B05:30" \
     -H "Content-Type: application/json" \
     -d @sample_invoice.json
```

### Expected Behavior
- ✅ Existing calls without timestamp continue to work
- ✅ New calls with timestamp get enhanced precision
- ✅ Invalid timestamps gracefully fall back
- ✅ All downstream services automatically benefit

## Migration Path

### For Existing Integrations
1. **No action required** - existing integrations continue working
2. **Optional enhancement** - add `?timestamp=HH:MM:SS` when available
3. **Gradual rollout** - can be implemented POS system by POS system

### For New Integrations
- Include timestamp parameter for better analytics
- Use format: `?timestamp=HH:MM:SS` for simple time
- Use format: `?timestamp=YYYY-MM-DDTHH:MM:SS+TZ` for full precision

## Alternative Approaches Considered

1. **Custom Header** (`X-Timestamp`) - Good separation but less visible
2. **Request Body Modification** - More complex, breaks existing integrations
3. **Separate Endpoint** - Unnecessary complexity for optional parameter

**Query parameter was chosen for:**
- Simplicity and visibility
- Standard HTTP practice for optional metadata
- Easy testing and debugging
- No request body changes required
