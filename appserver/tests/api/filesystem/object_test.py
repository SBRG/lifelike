import hashlib
import typing
from urllib.parse import quote

import pytest
from sqlalchemy.orm import make_transient

from neo4japp.models import AppUser, Files, Projects
from tests.api.filesystem.conftest import ParameterizedFile as TestFile, \
    ParameterizedAppUser as TestUser
from tests.helpers.api import generate_jwt_headers
from tests.helpers.assertions import assert_project_response, assert_file_response


@pytest.mark.parametrize(
    'file_in_project, user_with_project_roles, status_code, readable, writable, commentable', [
        # All of these test cases are for the many combinations of privilege options we have
        # in the file system (public flag, project privileges, parent folder privileges,
        # file privileges)

        # Parent folder + File privileges + Private file
        (TestFile(public=False, in_folder=True, user_roles_for_file=[
            'file-read',
        ]), TestUser([], []), 200, True, False, False),
        (TestFile(public=False, in_folder=True, user_roles_for_file=[
            'file-write',
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_file=[
            'file-comment',
        ]), TestUser([], []), 200, True, False, True),
        (TestFile(public=False, in_folder=True, user_roles_for_file=[
            'file-read', 'file-write'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_file=[
            'file-write', 'file-comment'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_file=[
            'file-read', 'file-write', 'file-comment',
        ]), TestUser([], []), 200, True, True, True),

        # Parent folder + File privileges + Public file
        (TestFile(public=True, in_folder=True, user_roles_for_file=[
            'file-read',
        ]), TestUser([], []), 200, True, False, False),
        (TestFile(public=True, in_folder=True, user_roles_for_file=[
            'file-write',
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=True, in_folder=True, user_roles_for_file=[
            'file-comment',
        ]), TestUser([], []), 200, True, False, True),
        (TestFile(public=True, in_folder=True, user_roles_for_file=[
            'file-read', 'file-write'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=True, in_folder=True, user_roles_for_file=[
            'file-write', 'file-comment'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=True, in_folder=True, user_roles_for_file=[
            'file-read', 'file-write', 'file-comment',
        ]), TestUser([], []), 200, True, True, True),

        # Parent folder + Parent folder privileges + Private file
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-read',
        ]), TestUser([], []), 200, True, False, False),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-write',
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-comment',
        ]), TestUser([], []), 200, True, False, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-read', 'file-write'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-write', 'file-comment'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-read', 'file-write', 'file-comment',
        ]), TestUser([], []), 200, True, True, True),

        # Parent folder + Parent folder privileges + Public file
        (TestFile(public=True, in_folder=True, user_roles_for_folder=[
            'file-read',
        ]), TestUser([], []), 200, True, False, False),
        (TestFile(public=True, in_folder=True, user_roles_for_folder=[
            'file-write',
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=True, in_folder=True, user_roles_for_folder=[
            'file-comment',
        ]), TestUser([], []), 200, True, False, True),
        (TestFile(public=True, in_folder=True, user_roles_for_folder=[
            'file-read', 'file-write'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=True, in_folder=True, user_roles_for_folder=[
            'file-write', 'file-comment'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=True, in_folder=True, user_roles_for_folder=[
            'file-read', 'file-write', 'file-comment',
        ]), TestUser([], []), 200, True, True, True),

        # Parent folder + Parent folder privileges + File privileges + Private file
        # This is for handling combinations of privileges on files and their parent folders
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-read',
        ], user_roles_for_file=[
            'file-write'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-write',
        ], user_roles_for_file=[
            'file-read'
        ]), TestUser([], []), 200, True, True, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-read',
        ], user_roles_for_file=[
            'file-comment'
        ]), TestUser([], []), 200, True, False, True),
        (TestFile(public=False, in_folder=True, user_roles_for_folder=[
            'file-comment',
        ], user_roles_for_file=[
            'file-read'
        ]), TestUser([], []), 200, True, False, True),

        # No parent folder + App permissions + Private file
        (TestFile(public=False), TestUser([], []), 403, False, False, False),
        (TestFile(public=False), TestUser(['private-data-access'], []), 200, True, True, True),

        # No parent folder + App permissions + Public file
        (TestFile(public=True), TestUser([], []), 200, True, False, False),
        (TestFile(public=True), TestUser(['private-data-access'], []), 200, True, True, True),

        # No parent folder + Project permissions + Private file
        (TestFile(public=False), TestUser([], ['project-read']), 200, True, False, False),
        (TestFile(public=False), TestUser([], ['project-write']), 200, True, True, True),
        (TestFile(public=False), TestUser([], ['project-admin']), 200, True, True, True),
        (TestFile(public=False), TestUser([], ['project-write', 'project-admin']), 200, True, True,
         True),
        (TestFile(public=False), TestUser([], ['project-read', 'project-write']), 200, True, True,
         True),
        (TestFile(public=False), TestUser([], ['project-read', 'project-admin']), 200, True, True,
         True),
        (TestFile(public=False), TestUser([], ['project-read', 'project-write', 'project-admin']),
         200, True, True, True),

        # No parent folder + Project permissions + Public file
        (TestFile(public=True), TestUser([], ['project-read']), 200, True, False, False),
        (TestFile(public=True), TestUser([], ['project-write']), 200, True, True, True),
        (TestFile(public=True), TestUser([], ['project-admin']), 200, True, True, True),
        (TestFile(public=True), TestUser([], ['project-write', 'project-admin']), 200, True, True,
         True),
        (TestFile(public=True), TestUser([], ['project-read', 'project-write']), 200, True, True,
         True),
        (TestFile(public=True), TestUser([], ['project-read', 'project-admin']), 200, True, True,
         True),
        (TestFile(public=True), TestUser([], ['project-read', 'project-write', 'project-admin']),
         200, True, True, True),
    ],
    indirect=['file_in_project', 'user_with_project_roles'],
    ids=str,
)
def test_get_file(
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        status_code: int,
        readable: bool,
        writable: bool,
        commentable: bool,
        project: Projects,
        file_in_project: Files):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    resp = client.get(
        f'/filesystem/objects/{quote(file_in_project.hash_id)}',
        headers=headers,
        content_type='application/json'
    )

    assert resp.status_code == status_code

    if status_code == 200:
        resp_data = resp.get_json()
        resp_file = resp_data['result']
        assert_file_response(resp_file, file_in_project)
        assert_project_response(resp_file['project'], project)
        assert resp_file['privileges']['readable'] is readable
        assert resp_file['privileges']['writable'] is writable
        assert resp_file['privileges']['commentable'] is commentable


@pytest.mark.parametrize(
    'user_with_project_roles', [
        TestUser(app_roles=['private-data-access']),
        TestUser(project_roles=['project-read']),
        TestUser(project_roles=['project-write']),
        TestUser(project_roles=['project-admin']),
    ],
    indirect=['user_with_project_roles'],
    ids=str,
)
@pytest.mark.parametrize(
    'file_in_project', [
        TestFile(recycled=True),
        TestFile(in_folder=True, folder_recycled=True),
    ],
    indirect=['file_in_project'],
    ids=str,
)
def test_get_recycled_file(
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        project: Projects,
        file_in_project: Files):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    resp = client.get(
        f'/filesystem/objects/{quote(file_in_project.hash_id)}',
        headers=headers,
        content_type='application/json'
    )

    # Recycled files still can be read
    assert resp.status_code == 200

    resp_data = resp.get_json()
    resp_file = resp_data['result']
    assert_file_response(resp_file, file_in_project)
    assert_project_response(resp_file['project'], project)


@pytest.mark.parametrize(
    'user_with_project_roles', [
        TestUser(app_roles=['private-data-access']),
        TestUser(project_roles=['project-read']),
        TestUser(project_roles=['project-write']),
        TestUser(project_roles=['project-admin']),
    ],
    indirect=['user_with_project_roles'],
    ids=str,
)
@pytest.mark.parametrize(
    'file_in_project, status_code', [
        (TestFile(deleted=True), 404),
        (TestFile(in_folder=True, folder_deleted=True), 200),
        (TestFile(in_folder=True, deleted=True, folder_deleted=True), 404),
    ],
    indirect=['file_in_project'],
    ids=str,
)
def test_get_deleted_file(
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        status_code: int,
        project: Projects,
        file_in_project: Files):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    resp = client.get(
        f'/filesystem/objects/{quote(file_in_project.hash_id)}',
        headers=headers,
        content_type='application/json'
    )

    assert resp.status_code == status_code

    if status_code == 200:
        resp_data = resp.get_json()
        resp_file = resp_data['result']
        assert_file_response(resp_file, file_in_project)
        assert_project_response(resp_file['project'], project)


@pytest.mark.parametrize(
    'user_with_project_roles', [
        TestUser([], []),
    ],
    indirect=['user_with_project_roles'],
    ids=str,
)
def test_get_file_missing(
        client,
        login_password: str,
        user_with_project_roles: AppUser):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    resp = client.get(
        f'/filesystem/objects/test_get_file_missing',
        headers=headers,
        content_type='application/json'
    )

    assert resp.status_code == 404


@pytest.mark.parametrize(
    'user_with_project_roles, status_code', [
        (TestUser([], []), 403),
        (TestUser(['private-data-access'], []), 200),
        (TestUser([], ['project-read']), 403),
        (TestUser([], ['project-write']), 200),
        (TestUser([], ['project-admin']), 200),
        (TestUser([], ['project-write', 'project-admin']), 200),
        (TestUser([], ['project-read', 'project-write']), 200),
        (TestUser([], ['project-read', 'project-admin']), 200),
        (TestUser([], ['project-read', 'project-write', 'project-admin']), 200),
    ],
    indirect=['user_with_project_roles'],
    ids=str
)
@pytest.mark.parametrize(
    'file_in_project', [
        TestFile(public=False),
        TestFile(public=True),
    ],
    indirect=['file_in_project'],
    ids=str,
)
def test_patch_file_permitted(
        request,
        session,
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        status_code: int,
        file_in_project: Files):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    original_filename = session.query(Files.filename) \
        .filter(Files.id == file_in_project.id) \
        .one()[0]
    new_filename = hashlib.sha1(request.node.name.encode('utf-8')).hexdigest()
    assert original_filename != new_filename

    resp = client.patch(
        f'/filesystem/objects/{quote(file_in_project.hash_id)}',
        headers=headers,
        json={
            'filename': new_filename,
        },
    )

    assert resp.status_code == status_code

    # Let's make sure the database did or did not change!
    updated_filename = session.query(Files.filename) \
        .filter(Files.id == file_in_project.id) \
        .one()[0]
    if status_code == 200:
        assert updated_filename == new_filename
    else:
        assert updated_filename != new_filename


FILE_PATCH_TEST_CASES = [
    ('filename', None, None, False),
    ('filename', '', None, False),
    ('filename', ' ', None, False),
    ('filename', '\u200b', None, False),
    ('filename', ' test\t\u200a', 'test', True),
    ('filename', '\u200btest', 'test', True),
    ('filename', '\0what\'s\0 up\4', 'what\'s up', True),
    ('filename', 'null', 'null', True),
    ('filename', '-$1.00', '-$1.00', True),
    ('filename', 'Tôi muốn một chút cà phê', 'Tôi muốn một chút cà phê', True),
    ('filename', '防暴节', '防暴节', True),
    ('filename', 'دعنا نذهب إلى الجبال', 'دعنا نذهب إلى الجبال', True),
    ('filename', '‪‪test‪', 'test', True),
    ('filename', '💝python, sometimes', '💝python, sometimes', True),
    ('filename', '!@#$%^&*()`~', '!@#$%^&*()`~', True),
    ('filename',
     '𝓣𝓱𝓮 𝓺𝓾𝓲𝓬𝓴 𝓫𝓻𝓸𝔀𝓷 𝓯𝓸𝔁 𝓳𝓾𝓶𝓹𝓼 𝓸𝓿𝓮𝓻 𝓽𝓱𝓮 𝓵𝓪𝔃𝔂 𝓭𝓸𝓰',
     '𝓣𝓱𝓮 𝓺𝓾𝓲𝓬𝓴 𝓫𝓻𝓸𝔀𝓷 𝓯𝓸𝔁 𝓳𝓾𝓶𝓹𝓼 𝓸𝓿𝓮𝓻 𝓽𝓱𝓮 𝓵𝓪𝔃𝔂 𝓭𝓸𝓰', True),
    ('filename', 'ABC<div style="x:\xC2\xA0expression(javascript:alert(1)">DEF',
     'ABC<div style="x:\xC2\xA0expression(javascript:alert(1)">DEF', True),
    ('filename', 'test', 'test', True),
    ('filename', '1;DROP TABLE files', '1;DROP TABLE files', True),
    ('filename', '1\'; DROP TABLE users-- 1', '1\'; DROP TABLE users-- 1', True),
    ('filename', '\' OR 1=1 -- 1', '\' OR 1=1 -- 1', True),
    ('filename', '$(touch /tmp/blns.fail)', '$(touch /tmp/blns.fail)', True),
    ('filename', '$HOME', '$HOME', True),
    ('filename', '$ENV{\'HOME\'}', '$ENV{\'HOME\'}', True),
    ('filename', 'Documents/Papers', 'Documents/Papers', True),
    ('description', None, None, False),
    ('description', '', '', True),
    ('description', 'blah', 'blah', True),
    ('description', ' bl\nah ', ' bl\nah ', True),
    ('public', None, None, False),
    ('public', True, True, True),
    ('public', False, False, True),
    ('upload_url', 'http://www.example.com', None, True),
]


def assert_patch_file_results(session, file_in_project: Files,
                              project: Projects,
                              user_with_project_roles: AppUser,
                              original_file: Files, field: str,
                              value: typing.Any,
                              expect_success: bool,
                              resp,
                              resp_file_getter):
    updated_file: Files = session.query(Files) \
        .filter(Files.id == file_in_project.id) \
        .one()

    if expect_success:
        assert resp.status_code == 200

        resp_data = resp.get_json()
        resp_file = resp_file_getter(resp_data)

        # Make sure that the field changed
        assert getattr(updated_file, field) == value

        # Make sure that the modification info changed
        assert updated_file.modified_date is not None
        assert updated_file.modified_date > original_file.modified_date
        assert updated_file.modifier == user_with_project_roles

        # Make sure the returned file from the PATCH matches the file in the DB
        assert_file_response(resp_file, updated_file)
        assert_project_response(resp_file['project'], project)

        # Make sure that no other fields changed
        setattr(original_file, field, value)
        original_file.modified_date = updated_file.modified_date
        original_file.modifier = updated_file.modifier
        assert_file_response(resp_file, original_file)
        assert_project_response(resp_file['project'], project)

    else:
        assert resp.status_code == 400

        resp_data = resp.get_json()

        # Make sure that nothing changed
        for f in [field, 'modifier', 'modified_date']:
            assert getattr(original_file, f) == getattr(updated_file, f)


@pytest.mark.parametrize(
    'user_with_project_roles', [
        TestUser([], ['project-write']),
    ],
    indirect=['user_with_project_roles'],
    ids=str,
)
@pytest.mark.parametrize(
    'file_in_project', [
        TestFile(public=False),
    ],
    indirect=['file_in_project'],
    ids=str,
)
@pytest.mark.parametrize(
    'field, sent_value, value, expect_success',
    FILE_PATCH_TEST_CASES,
    ids=str,
)
def test_patch_file(
        session,
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        file_in_project: Files,
        project: Projects,
        field: str,
        sent_value: typing.Any,
        value: typing.Any,
        expect_success: bool):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    original_file: Files = session.query(Files) \
        .filter(Files.id == file_in_project.id) \
        .one()

    # Make sure that there will be a change
    assert original_file.modifier != user_with_project_roles

    make_transient(original_file)

    resp = client.patch(
        f'/filesystem/objects/{quote(file_in_project.hash_id)}',
        headers=headers,
        json={
            field: sent_value,
        },
    )

    assert_patch_file_results(session, file_in_project, project, user_with_project_roles,
                              original_file, field, value, expect_success, resp,
                              lambda resp_data: resp_data['result'])


@pytest.mark.parametrize(
    'user_with_project_roles', [
        TestUser([], []),
    ],
    indirect=['user_with_project_roles'],
    ids=str,
)
def test_patch_file_missing(
        client,
        login_password: str,
        user_with_project_roles: AppUser):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    resp = client.patch(
        f'/filesystem/objects/test_get_file_missing',
        headers=headers,
        json={
            'filename': 'whatever, man',
        },
    )

    assert resp.status_code == 404


@pytest.mark.parametrize(
    'user_with_project_roles, status_code', [
        (TestUser([], []), 403),
        (TestUser(['private-data-access'], []), 200),
        (TestUser([], ['project-read']), 403),
        (TestUser([], ['project-write']), 200),
        (TestUser([], ['project-admin']), 200),
        (TestUser([], ['project-write', 'project-admin']), 200),
        (TestUser([], ['project-read', 'project-write']), 200),
        (TestUser([], ['project-read', 'project-admin']), 200),
        (TestUser([], ['project-read', 'project-write', 'project-admin']), 200),
    ],
    indirect=['user_with_project_roles'],
    ids=str
)
@pytest.mark.parametrize(
    'file_in_project', [
        TestFile(public=False),
        TestFile(public=True),
    ],
    indirect=['file_in_project'],
    ids=str,
)
def test_bulk_patch_files_permitted(
        request,
        session,
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        status_code: int,
        file_in_project: Files):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    original_filename = session.query(Files.filename) \
        .filter(Files.id == file_in_project.id) \
        .one()[0]
    new_filename = hashlib.sha1(request.node.name.encode('utf-8')).hexdigest()
    assert original_filename != new_filename

    resp = client.patch(
        f'/filesystem/objects',
        headers=headers,
        json={
            'hashIds': [
                file_in_project.hash_id,
            ],
            'filename': new_filename,
        },
    )

    assert resp.status_code == status_code

    updated_filename = session.query(Files.filename) \
        .filter(Files.id == file_in_project.id) \
        .one()[0]
    if status_code == 200:
        assert updated_filename == new_filename
    else:
        assert updated_filename != new_filename


@pytest.mark.parametrize(
    'user_with_project_roles', [
        TestUser([], ['project-write']),
    ],
    indirect=['user_with_project_roles'],
    ids=str,
)
@pytest.mark.parametrize(
    'file_in_project', [
        TestFile(public=False),
    ],
    indirect=['file_in_project'],
    ids=str,
)
@pytest.mark.parametrize(
    'field, sent_value, value, expect_success',
    FILE_PATCH_TEST_CASES,
    ids=str,
)
def test_bulk_patch_files(
        session,
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        file_in_project: Files,
        project: Projects,
        field: str,
        sent_value: typing.Any,
        value: typing.Any,
        expect_success: bool):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    original_file: Files = session.query(Files) \
        .filter(Files.id == file_in_project.id) \
        .one()

    # Make sure that there will be a change
    assert original_file.modifier != user_with_project_roles

    make_transient(original_file)

    resp = client.patch(
        f'/filesystem/objects',
        headers=headers,
        json={
            'hashIds': [
                file_in_project.hash_id,
            ],
            field: sent_value,
        },
    )

    assert_patch_file_results(session, file_in_project, project, user_with_project_roles,
                              original_file, field, value, expect_success, resp,
                              lambda resp_data: resp_data['mapping'][file_in_project.hash_id])


@pytest.mark.parametrize(
    'user_with_project_roles', [
        TestUser([], []),
    ],
    indirect=['user_with_project_roles'],
    ids=str,
)
def test_bulk_patch_files_missing(
        client,
        login_password: str,
        user_with_project_roles: AppUser):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    resp = client.patch(
        f'/filesystem/objects',
        headers=headers,
        json={
            'hashIds': [
                'test_bulk_patch_files_missing',
            ],
            'filename': 'punk isn\'t dead.gif',
        },
    )

    assert resp.status_code == 200

    resp_data = resp.get_json()
    assert resp_data['mapping'] == dict()
    assert resp_data['missing'] == ['test_bulk_patch_files_missing']
