from slowapi import Limiter
from slowapi.util import get_remote_address

from Backend.redis_client import get_redis

_storage_uri = None
if get_redis() is not None:
    from Backend.redis_client import REDIS_URL
    _storage_uri = REDIS_URL

limiter = Limiter(key_func=get_remote_address, storage_uri=_storage_uri)
