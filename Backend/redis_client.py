import os

import redis

REDIS_URL = os.environ.get("REDIS_URL")

_client: redis.Redis | None = None
_unavailable = False


def get_redis() -> redis.Redis | None:
    global _client, _unavailable
    if REDIS_URL is None or _unavailable:
        return None
    if _client is None:
        _client = redis.from_url(REDIS_URL, decode_responses=False, socket_connect_timeout=1)
    try:
        _client.ping()
    except redis.exceptions.RedisError:
        _unavailable = True
        return None
    return _client
