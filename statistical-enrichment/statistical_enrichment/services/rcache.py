""" Redis Cache """
import os
import redis

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
REDIS_DB = os.getenv("REDIS_DB", "0")
REDIS_SSL = os.getenv("REDIS_SSL", "").lower()

DEFAULT_CACHE_SETTINGS = {"ex": int(os.getenv("CACHE_TTL", 3600 * 24))}

schema = "rediss" if REDIS_SSL in ["true", "1"] else "redis"
connection_url = f"{schema}://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
redis_server = redis.Redis(
    connection_pool=redis.BlockingConnectionPool.from_url(connection_url)
)

# Helper method to use redis cache
#   If:
#       load and dump defined - returns result_provider() results as is
#       only dump defined - returns dump(result_provider())
#       only load defined - returns load(result_provider()) if cached,
#                           but result_provider() otherwise!
#                           use with caution!!!
#
#
# TODO: switch to the three functions below
def redis_cached(
    uid: str,
    # TODO: why is this a function? Better if it's a data type...
    # Needs refactor to be generic for other uses
    result_provider,
    cache_setting=None,
    load=None,
    dump=None,
):
    if cache_setting is None:
        cache_setting = DEFAULT_CACHE_SETTINGS
    cached_result = redis_server.get(uid)
    if cached_result:
        return load(cached_result) if load else cached_result
    else:
        result = result_provider()
        dumped_result = dump(result) if dump else result
        redis_server.set(uid, dumped_result, **cache_setting)
        if load is None:
            return dumped_result
        return result


def getcache(uid: str):
    return redis_server.get(uid)


def delcache(uid: str):
    if redis_server.get(uid):
        redis_server.delete(uid)


def setcache(
    uid: str,
    data,
    load=None,
    dump=None,
    cache_setting=None,
):
    if cache_setting is None:
        cache_setting = DEFAULT_CACHE_SETTINGS
    dumped_data = dump(data) if dump else data
    redis_server.set(uid, dumped_data, **cache_setting)
    return load(dumped_data) if load else dumped_data
