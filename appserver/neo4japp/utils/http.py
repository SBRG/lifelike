from urllib.parse import quote

from flask import make_response


def make_cacheable_file_response(request, content, etag: str, filename: str, mime_type: str = None):
    """
    Make a Flask response for a file, as a download, with support for browser
    caching. Headers are sent to make the browser always check for the latest version,
    but if there is no change, the browser is told to use its stored version.
    """
    # Handle ETag cache response
    if request.if_none_match and etag in request.if_none_match:
        return '', 304
    else:
        fallback_filename = filename.encode('ascii', errors='ignore').decode('ascii')
        quoted_filename = quote(filename)
        response = make_response(content)
        response.headers['Cache-Control'] = 'no-cache, max-age=0'
        if mime_type:
            response.headers['Content-Type'] = mime_type
        response.headers['Content-Length'] = len(content)
        response.headers['Content-Disposition'] = \
            f'attachment; filename="{fallback_filename}"; filename*=UTF-8\'\'{quoted_filename}'
        response.headers['ETag'] = f'"{etag}"'
        return response
