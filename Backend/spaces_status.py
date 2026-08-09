import os

import httpx
from fastapi import APIRouter, Depends

from Backend.admin import require_admin

router = APIRouter(prefix="/api/spaces", tags=["spaces"])

SPACE_URLS = {
    "free": os.environ.get("SPACE_FREE_URL", ""),
    "pro": os.environ.get("SPACE_PRO_URL", ""),
    "max": os.environ.get("SPACE_MAX_URL", ""),
}


def _check_one(name: str, url: str) -> dict:
    if not url:
        return {"name": name, "url": None, "online": False, "models": [], "error": "not configured"}
    try:
        resp = httpx.get(f"{url.rstrip('/')}/health", timeout=5.0)
        resp.raise_for_status()
        data = resp.json()
        return {"name": name, "url": url, "online": True, "models": data.get("models", []), "error": None}
    except Exception as e:
        return {"name": name, "url": url, "online": False, "models": [], "error": str(e)}


@router.get("/status")
def get_spaces_status(admin: dict = Depends(require_admin)):
    return [_check_one(name, url) for name, url in SPACE_URLS.items()]
