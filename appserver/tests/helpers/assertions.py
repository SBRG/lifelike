import datetime
from typing import Optional, Dict

from dateutil.parser import parse

from neo4japp.models import AppUser, Projects, Files


def assert_datetime_response(actual: str, expected: datetime.datetime):
    if actual is None or expected is None:
        return actual == expected
    else:
        assert parse(actual) == expected


def assert_user_response(actual: Optional[Dict], expected: Optional[AppUser]):
    if actual is None or expected is None:
        return actual == expected
    else:
        assert actual['hashId'] == expected.hash_id


def assert_project_response(actual: Optional[Dict], expected: Optional[Projects]):
    if actual is None or expected is None:
        return actual == expected
    else:
        assert actual['hashId'] == expected.hash_id
        assert actual['name'] == expected.name
        assert actual['description'] == expected.description
        assert_datetime_response(actual['creationDate'], expected.creation_date)
        assert_datetime_response(actual['modifiedDate'], expected.modified_date)


def assert_file_response(actual: Optional[Dict], expected: Optional[Files]):
    if actual is None or expected is None:
        return actual == expected
    else:
        assert actual['hashId'] == expected.hash_id
        assert actual['filename'] == expected.filename
        assert actual['description'] == expected.description
        assert actual['doi'] == expected.doi
        assert actual['uploadUrl'] == expected.upload_url
        assert actual['public'] == expected.public
        assert_datetime_response(actual['annotationsDate'], expected.annotations_date)
        assert_datetime_response(actual['creationDate'], expected.creation_date)
        assert_datetime_response(actual['modifiedDate'], expected.modified_date)
        assert_datetime_response(actual['recyclingDate'], expected.recycling_date)
        assert_file_response(actual['parent'], expected.parent)
        assert_user_response(actual['user'], expected.user)
