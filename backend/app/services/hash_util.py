# app/services/hash_util.py
import os, hashlib

_SALT = os.getenv("CUSTOMER_HASH_SALT", "dev-salt").encode("utf-8")

def customer_hash(mobile: str | None, email: str | None) -> str | None:
    v = (mobile or email)
    if not v:
        return None
    return hashlib.sha256(_SALT + v.encode("utf-8")).hexdigest()
