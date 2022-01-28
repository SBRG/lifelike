import functools

from flask import g


def scope_flask_app_ctx(name):
    """Memoize a return value to the current Flask app context."""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            if name not in g:
                setattr(g, name, func(*args, **kwargs))
            return getattr(g, name)

        return wrapper

    return decorator
