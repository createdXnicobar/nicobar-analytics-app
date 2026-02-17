import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_pos_webhook_invalid_numeric_fields():
    """Test that invalid numeric fields return 400 Bad Request instead of 500."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        
        # Valid base structure
        valid_line = {
            "Customer_No": "CUST001",
            "Customer_Email_ID": "test@example.com", 
            "Customer_Mobile": "1234567890",
            "Type": "Sale",
            "Document_Type": "Invoice",
            "Order_No": "ORD001",
            "OrderDt": "2025-01-01",
            "OrderDtm": "10:30:00",
            "Line_No": "1",
            "Item_Code": "ITEM001",
            "Price": "100.50",
            "Quantity": "2",
            "Billed_Price": "95.00",
            "Currency_Code": "USD",
            "StoreCode": "STORE001"
        }
        
        # Test invalid Price field
        invalid_price_line = {**valid_line, "Price": "abc"}
        response = await ac.post("/v1/webhooks/pos", json=[invalid_price_line])
        assert response.status_code == 400
        error_data = response.json()
        assert "detail" in error_data
        assert "validation_errors" in error_data["detail"]
        assert any("Price" in error for error in error_data["detail"]["validation_errors"])
        
        # Test invalid Quantity field
        invalid_qty_line = {**valid_line, "Quantity": "xyz"}
        response = await ac.post("/v1/webhooks/pos", json=[invalid_qty_line])
        assert response.status_code == 400
        error_data = response.json()
        assert "detail" in error_data
        assert "validation_errors" in error_data["detail"]
        assert any("Quantity" in error for error in error_data["detail"]["validation_errors"])
        
        # # Test invalid Billed_Price field
        invalid_billed_price_line = {**valid_line, "Billed_Price": "invalid"}
        response = await ac.post("/v1/webhooks/pos", json=[invalid_billed_price_line])
        assert response.status_code == 400
        error_data = response.json()
        assert "detail" in error_data
        assert "validation_errors" in error_data["detail"]
        assert any("Billed_Price" in error for error in error_data["detail"]["validation_errors"])

@pytest.mark.asyncio
async def test_pos_webhook_missing_required_fields():
    """Test that missing required fields return 400 Bad Request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        
        # Missing Order_No
        line_missing_order = {
            "Customer_Email_ID": "test@example.com",
            "Type": "Sale",
            "Document_Type": "Invoice",
            "OrderDt": "2025-01-01",
            "OrderDtm": "10:30:00",
            "Line_No": "1",
            "Item_Code": "ITEM001",
            "Price": "100.50",
            "Quantity": "2",
            "Billed_Price": "95.00",
            "Currency_Code": "USD",
            "StoreCode": "STORE001"
        }
        
        response = await ac.post("/v1/webhooks/pos", json=[line_missing_order])
        assert response.status_code == 422 # Unprocessable Entity
        error_data = response.json()
        assert "detail" in error_data
        assert "Order_No" in error_data["detail"][0]["loc"]

@pytest.mark.asyncio
async def test_pos_webhook_invalid_date_format():
    """Test that invalid date formats return 400 Bad Request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        
        valid_line = {
            "Customer_No": "CUST001",
            "Customer_Email_ID": "test@example.com",
            "Customer_Mobile": "1234567890",
            "Type": "Sale", 
            "Document_Type": "Invoice",
            "Order_No": "ORD001",
            "OrderDt": "invalid-date",  # Invalid date format
            "OrderDtm": "10:30:00",
            "Line_No": "1",
            "Item_Code": "ITEM001",
            "Price": "100.50",
            "Quantity": "2",
            "Billed_Price": "95.00",
            "Currency_Code": "USD",
            "StoreCode": "STORE001"
        }
        
        response = await ac.post("/v1/webhooks/pos", json=[valid_line])
        assert response.status_code == 400
        error_data = response.json()
        assert "validation_errors" in error_data
        assert "detail" in error_data
        assert "validation_errors" in error_data["detail"]
        assert any("date format" in error.lower() for error in error_data["detail"]["validation_errors"])

@pytest.mark.asyncio 
async def test_pos_webhook_multiple_validation_errors():
    """Test that multiple validation errors are properly collected and returned."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        
        # Line with multiple validation errors
        invalid_line = {
            "Customer_No": "CUST001",
            "Customer_Email_ID": "test@example.com", 
            "Customer_Mobile": "1234567890",
            "Type": "Sale",
            "Document_Type": "Invoice",
            # "Order_No": "ORD001", # missing
            "OrderDt": "2025-01-01",
            # "OrderDtm": "10:30:00", # missing
            "Line_No": "1",
            "Item_Code": "ITEM001",
            "Price": "abc", # invalid
            "Quantity": "2",
            "Billed_Price": "95.00",
            "Currency_Code": "USD",
            "StoreCode": "STORE001"
        }
        
        response = await ac.post("/v1/webhooks/pos", json=[invalid_line])
        assert response.status_code == 422 # Unprocessable Entity
        error_data = response.json()
        assert "detail" in error_data
        errors = error_data["detail"]
        assert len(errors) >= 2  # At least Order_No, OrderDtm

        missing_fields = []

        for error in errors:
            print("error box has: ", error["loc"])
            missing_fields.append(error["loc"][-1])

        assert "OrderDtm" in missing_fields
        assert "Order_No" in missing_fields