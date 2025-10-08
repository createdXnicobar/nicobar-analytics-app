# app/routers/pos_webhook.py
from fastapi import APIRouter, Header, HTTPException
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import List, Tuple, Optional
from app.services.timeutil import to_utc, utc_now, IST
from app.db.mongo import purchase_events
from app.models.purchases import InvoiceLine
from app.services.product_resolver import fetch_product_by_sku, fetch_products_by_skus
from app.services.hash_util import customer_hash
from app.core.logging_config import get_logger
from pymongo import InsertOne
from pymongo.errors import BulkWriteError

logger = get_logger(__name__)
router = APIRouter()

def _to_float(x: str | None) -> float:
    """Convert string to float, returning 0.0 for None or empty strings."""
    if x is None or x == "":
        return 0.0
    return float(Decimal(x))

def _safe_to_float(x: str | None, field_name: str, line_ref: str) -> Tuple[float, Optional[str]]:
    """Safely convert string to float, returning (value, error_message)."""
    try:
        if x is None or x == "":
            return 0.0, None
        return float(Decimal(x)), None
    except (ValueError, InvalidOperation, TypeError) as e:
        error_msg = f"Invalid numeric value '{x}' for field '{field_name}' in {line_ref}: {str(e)}"
        return 0.0, error_msg

def _safe_to_int(x: str | None, field_name: str, line_ref: str) -> Tuple[int, Optional[str]]:
    """Safely convert string to int, returning (value, error_message)."""
    try:
        if x is None or x == "":
            return 0, None
        return int(x), None
    except (ValueError, TypeError) as e:
        error_msg = f"Invalid integer value '{x}' for field '{field_name}' in {line_ref}: {str(e)}"
        return 0, error_msg

def _validate_date_format(order_dt: str, order_dtm: str | None, line_ref: str) -> Optional[str]:
    """Validate date format and return error message if invalid."""
    try:
        _parse_order_dt(order_dt, order_dtm)
        return None
    except Exception as e:
        return f"Invalid date format for OrderDt='{order_dt}', OrderDtm='{order_dtm}' in {line_ref}: {str(e)}"

def _validate_invoice_line(line: InvoiceLine) -> List[str]:
    """Validate an invoice line and return list of error messages."""
    errors = []
    line_ref = f"Order {line.Order_No}, Line {line.Line_No}"
    
    # Validate required string fields are not empty
    if not line.Order_No or line.Order_No.strip() == "":
        errors.append(f"Order_No is required and cannot be empty in {line_ref}")
    
    if not line.Line_No or line.Line_No.strip() == "":
        errors.append(f"Line_No is required and cannot be empty in {line_ref}")
    
    if not line.Item_Code or line.Item_Code.strip() == "":
        errors.append(f"Item_Code is required and cannot be empty in {line_ref}")
    
    if not line.StoreCode or line.StoreCode.strip() == "":
        errors.append(f"StoreCode is required and cannot be empty in {line_ref}")
    
    if not line.OrderDt or line.OrderDt.strip() == "":
        errors.append(f"OrderDt is required and cannot be empty in {line_ref}")
    else:
        # Validate date format
        date_error = _validate_date_format(line.OrderDt, line.OrderDtm, line_ref)
        if date_error:
            errors.append(date_error)
    
    # Validate numeric fields
    _, price_error = _safe_to_float(line.Price, "Price", line_ref)
    if price_error:
        errors.append(price_error)
    
    _, billed_price_error = _safe_to_float(line.Billed_Price, "Billed_Price", line_ref)
    if billed_price_error:
        errors.append(billed_price_error)
    
    _, qty_error = _safe_to_int(line.Quantity, "Quantity", line_ref)
    if qty_error:
        errors.append(qty_error)
    
    # Validate optional numeric fields if present
    if line.Shipping_Charges is not None:
        _, shipping_error = _safe_to_float(line.Shipping_Charges, "Shipping_Charges", line_ref)
        if shipping_error:
            errors.append(shipping_error)
    
    if line.Total_Order_Value is not None:
        _, total_error = _safe_to_float(line.Total_Order_Value, "Total_Order_Value", line_ref)
        if total_error:
            errors.append(total_error)
    
    return errors

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
        logger.debug(f"Parsing order datetime: order_dt={order_dt}, order_dtm={order_dtm}")
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
    except Exception as e:
        logger.warning(f"Error parsing order datetime (order_dt={order_dt}, order_dtm={order_dtm}): {e}")
        return utc_now()

@router.post("/v1/webhooks/pos")
async def pos_webhook(
    lines: List[InvoiceLine], 
    x_signature: str | None = Header(default=None)
):
    logger.info(f"Received POS webhook with {len(lines)} invoice lines")
    logger.debug(f"Signature provided: {'Yes' if x_signature else 'No'}")
    
    # Validate all lines first and collect any validation errors
    all_validation_errors = []
    for i, line in enumerate(lines):
        line_errors = _validate_invoice_line(line)
        if line_errors:
            all_validation_errors.extend([f"Line {i+1}: {error}" for error in line_errors])
    
    # If there are validation errors, return 400 Bad Request
    if all_validation_errors:
        error_message = f"Invalid input format in request body. Validation errors: {'; '.join(all_validation_errors)}"
        logger.warning(f"Validation failed: {error_message}")
        raise HTTPException(status_code=400, detail={
            "error": "Invalid input format",
            "message": "The request body contains invalid data formats",
            "validation_errors": all_validation_errors
        })
    
    try:
        # (optional) verify x_signature here
        
        # Step 1: Generate idempotency keys and check for duplicates in bulk
        idem_keys = [f"{line.Order_No}_{line.Line_No}" for line in lines]
        
        # Bulk duplicate check with error handling
        existing_idem_keys = set()
        try:
            existing_purchases = await purchase_events().find(
                {"idemKey": {"$in": idem_keys}}
            ).to_list(length=None)
            existing_idem_keys = {purchase["idemKey"] for purchase in existing_purchases}
            logger.debug(f"Found {len(existing_idem_keys)} existing purchases out of {len(idem_keys)} requested")
        except Exception as e:
            logger.warning(f"Error checking for duplicate purchases: {str(e)}")
            # Continue processing - duplicates will be caught at insert time
        
        # Step 2: Batch fetch all unique SKUs with error handling
        product_snapshots = {}
        try:
            unique_skus = list(set(line.Item_Code for line in lines))
            product_snapshots = await fetch_products_by_skus(unique_skus)
            logger.debug(f"Fetched product data for {len(unique_skus)} unique SKUs")
        except Exception as e:
            logger.warning(f"Error fetching product snapshots: {str(e)}")
            # Continue processing without product data
        
        # Step 3: Process each line individually with error isolation
        docs_to_insert = []
        doc_to_line_mapping = []  # Track which line corresponds to which doc
        processed_results = []  # Track processing status for each line
        
        for idx, line in enumerate(lines):
            idem_key = idem_keys[idx]
            line_ref = f"Order {line.Order_No}, Line {line.Line_No}"
            
            try:
                # Handle duplicate idempotency keys
                if idem_key in existing_idem_keys:
                    logger.debug(f"Skipping duplicate line {idx} with key {idem_key}")
                    processed_results.append({"success": False, "error": "Duplicate", "skipped": True})
                    continue
                
                # These conversions should now be safe since we validated above
                price_list, _ = _safe_to_float(line.Price, "Price", line_ref)
                price_billed, _ = _safe_to_float(line.Billed_Price, "Billed_Price", line_ref)
                qty, _ = _safe_to_int(line.Quantity, "Quantity", line_ref)

                # Parse dates - should be safe since we validated above, but handle gracefully
                try:
                    order_date = _parse_order_dt(line.OrderDt)
                    order_dtm = _parse_order_dt(line.OrderDt, line.OrderDtm)
                except Exception as e:
                    logger.error(f"Unexpected date parsing error for {line_ref} after validation: {e}")
                    processed_results.append({"success": False, "error": f"Date parsing error: {str(e)}", "skipped": False})
                    continue

                # Get product snapshot from batch lookup (may be None if fetch failed)
                snap = product_snapshots.get(line.Item_Code)
                
                doc = {
                    "orderNo": line.Order_No,
                    "lineNo": line.Line_No,
                    "orderDate": order_date,
                    "orderDtm": order_dtm,
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
                    try:
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
                    except Exception as e:
                        logger.warning(f"Error processing product snapshot for line {idx}, SKU {line.Item_Code}: {str(e)}")
                        # Continue without product snapshot

                docs_to_insert.append(doc)
                doc_to_line_mapping.append(len(processed_results))  # Track result index for this doc
                processed_results.append({"success": True, "error": None, "skipped": False})  # Will be updated if insert fails
                
            except Exception as e:
                logger.error(f"Error processing line {idx} ({line_ref}): {str(e)}", exc_info=True)
                processed_results.append({"success": False, "error": f"Processing error: {str(e)}", "skipped": False})
        
        # Step 4: Bulk insert all valid documents with proper BulkWriteError handling
        if docs_to_insert:
            try:
                insert_operations = [InsertOne(doc) for doc in docs_to_insert]
                bulk_result = await purchase_events().bulk_write(insert_operations, ordered=False)
                logger.debug(f"Bulk insert completed successfully: {bulk_result.inserted_count} documents inserted")
                
            except BulkWriteError as bwe:
                # BulkWriteError is raised even when some operations succeed
                bulk_result = bwe.details
                inserted_count = bulk_result.get('nInserted', 0)
                write_errors = bulk_result.get('writeErrors', [])
                
                logger.info(f"Bulk insert completed with partial success: {inserted_count} inserted, {len(write_errors)} errors")
                
                # Create a set of failed indices for quick lookup
                failed_indices = {error['index'] for error in write_errors}
                
                # Update results based on which specific operations failed
                for doc_idx, result_idx in enumerate(doc_to_line_mapping):
                    if doc_idx in failed_indices:
                        # Find the specific error for this index
                        error_detail = next((e for e in write_errors if e['index'] == doc_idx), None)
                        error_msg = "Insert failed"
                        if error_detail:
                            error_msg = error_detail.get('errmsg', 'Unknown insert error')
                            # Common duplicate key error handling
                            if error_detail.get('code') == 11000:  # Duplicate key error code
                                error_msg = "Duplicate idempotency key"
                        
                        processed_results[result_idx]["success"] = False
                        processed_results[result_idx]["error"] = error_msg
                        logger.debug(f"Purchase line at doc index {doc_idx} failed: {error_msg}")
                    # else: operation succeeded, result already marked as success=True
                
                logger.info(f"Processed BulkWriteError: {inserted_count} successful inserts, {len(failed_indices)} failures")
                
            except Exception as e:
                logger.error(f"Database error in bulk insert operation: {str(e)}", exc_info=True)
                # For unexpected database errors (connection issues, auth failures, etc.), 
                # re-raise as HTTP 500 so upstream systems know to retry
                raise HTTPException(
                    status_code=500, 
                    detail=f"Database operation failed: Unable to process purchase events"
                )
        
        # Step 5: Calculate final counts and return
        created = sum(1 for r in processed_results if r["success"])
        skipped = sum(1 for r in processed_results if r.get("skipped", False))
        
        logger.info(f"POS webhook processed: {created} created, {skipped} skipped duplicates")
        return {"created": created, "skipped_duplicates": skipped}
        
    except Exception as e:
        logger.error(f"Error processing POS webhook: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
