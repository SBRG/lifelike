import json
import logging
import os

import requests
from flask import (
    Blueprint, request, Response
)

from neo4japp.blueprints.auth import auth
from neo4japp.exceptions import StatisticalEnrichmentError
from requests.exceptions import ConnectionError

bp = Blueprint('enrichment-visualisation-api', __name__, url_prefix='/enrichment-visualisation')

SE_URL = os.getenv('STATISTICAL_ENRICHMENT_URL', 'http://statistical-enrichment:5000')


def _forward_request(resource):
    url = f'{SE_URL}{resource}'
    try:
        resp = requests.request(
                method=request.method,
                url=url,
                headers={key: value for (key, value) in request.headers if key != 'Host'},
                data=request.get_data(),
                cookies=request.cookies,
                allow_redirects=False,
                timeout=120,
        )
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        headers = [
            (name, value) for (name, value) in resp.raw.headers.items()
            if name.lower() not in excluded_headers
        ]
    except ConnectionError as e:
        raise StatisticalEnrichmentError(
            'Unable to process request',
            'An unexpected connection error occurred to statistical enrichment service.'
        )

    # 500 should contain message from service so we try to include it
    if resp.status_code == 500:
        try:
            decoded_error_message = json.loads(resp.content)['message']
        except Exception as e:
            # log and proceed so general error can be raised
            logging.exception(e)
        else:
            raise StatisticalEnrichmentError(
                    'Statistical enrichment error',
                    decoded_error_message,
                    code=500,
            )

    # All errors including failure to parse internal error message
    if 400 <= resp.status_code < 600:
        raise StatisticalEnrichmentError(
                'Unable to process request',
                'An error of statistical enrichment service occurred.',
                code=resp.status_code
        )

    return Response(resp.content, resp.status_code, headers)

@bp.route('/enrich-with-go-terms', methods=['POST'])
@auth.login_required
def enrich_go():
    return _forward_request('/enrich-with-go-terms')
