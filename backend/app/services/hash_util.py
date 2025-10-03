# app/services/hash_util.py
import os, hashlib
from app.core.logging_config import get_logger

logger = get_logger(__name__)
_SALT = os.getenv("CUSTOMER_HASH_SALT", "dev-salt").encode("utf-8")

def customer_hash(mobile: str | None, email: str | None) -> str | None:
    v = (mobile or email)
    if not v:
        logger.debug("No mobile or email provided for customer hash")
        return None
    
    # Log hash generation without exposing sensitive data
    logger.debug(f"Generating customer hash for {'mobile' if mobile else 'email'}")
    return hashlib.sha256(_SALT + v.encode("utf-8")).hexdigest()
