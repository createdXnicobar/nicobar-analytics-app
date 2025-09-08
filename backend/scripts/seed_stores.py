from pymongo import MongoClient
import os
from dotenv import load_dotenv
from app.core.config import settings

load_dotenv()
client = MongoClient(settings.MONGODB_URI)
DB_NAME = settings.DB_NAME
db = client[DB_NAME]
stores = [
  {"_id":"BIN","storeCode":"BIN","storeName":"Indiranagar","city":"Bengaluru","state":"Karnataka","region":"South","timezone":"Asia/Kolkata","active":True},
  {"_id":"MBN","storeCode":"MBN","storeName":"Bandra","city":"Mumbai","state":"Maharashtra","region":"West","timezone":"Asia/Kolkata","active":True}
]
for s in stores:
    db.stores.update_one({"_id":s["_id"]},{"$set":s}, upsert=True)
print("Seeded stores")
