from io import BytesIO
from typing import Tuple

import pytest

from app import app
from neo4japp.database import get_file_type_service
from neo4japp.models import Files


@pytest.mark.parametrize(
    'pair', [
        ('vnd.lifelike.filesystem/directory', True),
        ('vnd.lifelike.document/map', True),
        ('vnd.lifelike.document/enrichment-table', True),
        ('application/pdf', True),
        ('image/png', True),
        ('text/plain', True),
        ('application/octet-stream', True),
        ('application/vnd.microsoft.portable-executable', True),
    ],
    ids=lambda x: x[0],
)
def test_file_type_can_create(pair):
    file = Files()
    file.mime_type = pair[0]

    with app.app_context():
        service = get_file_type_service()
        assert pair[1] == service.get(file).can_create()


@pytest.mark.parametrize(
    'pair', [
        ('vnd.lifelike.filesystem/directory', False),
        ('vnd.lifelike.document/map', False),
        ('vnd.lifelike.document/enrichment-table', True),
        ('application/pdf', True),
        ('image/png', False),
        ('text/plain', True),
        ('application/octet-stream', False),
        ('application/vnd.microsoft.portable-executable', False),
    ],
    ids=lambda x: x[0],
)
def test_file_type_should_highlight_content_text_matches(pair):
    file = Files()
    file.mime_type = pair[0]

    with app.app_context():
        service = get_file_type_service()
        assert pair[1] == service.get(file).should_highlight_content_text_matches()


@pytest.mark.parametrize(
    'pair', [
        ('vnd.lifelike.filesystem/directory', BytesIO(), BytesIO()),
        ('application/pdf', BytesIO(b'raw data'), BytesIO(b'raw data')),
        ('image/png', BytesIO(b'data'), BytesIO()),
        ('text/plain', BytesIO(b'data'), BytesIO(b'data')),
    ],
    ids=lambda x: x[0],
)
def test_file_type_to_indexable_content(pair: Tuple[str, BytesIO, BytesIO]):
    file = Files()
    file.mime_type = pair[0]

    with app.app_context():
        service = get_file_type_service()
        assert pair[2].getvalue() == service.get(file).to_indexable_content(pair[1]).getvalue()
