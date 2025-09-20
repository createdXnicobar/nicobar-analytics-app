# app/security/thirdparty_auth.py
import time
import httpx
from jose import jwt
from fastapi import Header, HTTPException
from app.core.config import settings

# tiny in-memory TTL cache (single-process)
_token_cache: dict[str, float] = {}

def _cache_ok(token: str) -> bool:
    exp = _token_cache.get(token)
    return bool(exp and exp > time.time())

def _cache_set(token: str, ttl_sec: int = 120):
    _token_cache[token] = time.time() + ttl_sec

async def require_store_user(
    x_auth_token: str | None = Header(default=None, alias=None),  # we set alias dynamically below
):
    # read the correct header name (X-Auth-Token by default)
    header_name = settings.AUTH_HEADER_NAME
    if x_auth_token is None:
        # try to fetch manually if alias didn't bind (FastAPI quirk with dynamic name)
        # NOTE: You can also define two params, one for X-Auth-Token and one for Authorization
        raise HTTPException(status_code=401, detail=f"Missing {header_name}")

    token = x_auth_token.strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty auth token")

    # Short TTL cache to avoid hitting userAuth for every request
    if not _cache_ok(token):
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(
                    settings.AUTH_VALIDATE_URL,
                    headers={header_name: token},
                )
        except Exception:
            # If the auth service is down, fail closed
            raise HTTPException(status_code=503, detail="Auth service unavailable")

        # Expect JSON: { status: <bool>, userAuth: <bool|null>, message: <str> }
        try:
            data = resp.json()
        except ValueError:
            raise HTTPException(status_code=502, detail="Invalid auth response")

        if not data.get("status", False):
            # server-side error at IdP
            msg = data.get("message") or "Authentication service error"
            raise HTTPException(status_code=503, detail=msg)

        if not data.get("userAuth", False):
            # user not authorized anymore
            msg = data.get("message") or "User not authorized"
            raise HTTPException(status_code=403, detail=msg)

        _cache_set(token, ttl_sec=120)  # cache success for 2 minutes

    # Optionally read claims WITHOUT verifying signature (safe after userAuth=true)
    claims = {}
    try:
        claims = jwt.get_unverified_claims(token)  # e.g., { "_id", "email", "storeCode", "exp", ... }
    except Exception:
        pass

    # Return both the (unverified) claims & raw token if you need it down the stack
    return {"claims": claims, "token": token}
