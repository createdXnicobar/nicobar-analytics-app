# app/models/purchases.py
from pydantic import BaseModel
from typing import Optional

class InvoiceLine(BaseModel):
    Customer_No: Optional[str] = None
    Customer_Email_ID: Optional[str] = None
    Customer_Mobile: Optional[str] = None
    Type: str
    Document_Type: str
    Order_No: str
    OrderDt: str
    Line_No: str
    Item_Code: str
    Price: str
    Quantity: str
    Billed_Price: str
    Currency_Code: str
    Shipping_Charges: Optional[str] = None
    Total_Order_Value: Optional[str] = None
    StoreCode: str
