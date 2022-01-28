from urllib.parse import quote

import pytest
import typing

from neo4japp.models import AppUser, Files, Projects
from neo4japp.services.file_types.providers import DirectoryTypeProvider
from tests.api.filesystem.conftest import ParameterizedFile as TestFile, \
    ParameterizedAppUser as TestUser
from tests.helpers.api import generate_jwt_headers
from tests.helpers.assertions import assert_file_response


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
    'mime_type_tree', [
        # Folders
        [],
        [DirectoryTypeProvider.MIME_TYPE],
        [DirectoryTypeProvider.MIME_TYPE] * 5,
        [DirectoryTypeProvider.MIME_TYPE] * (Files.MAX_DEPTH - 1),
        # TODO: Implement max parent depth and test it here
    ],
    ids=str,
)
def test_patch_file_parent_to_object(
        session,
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        project_owner_user: AppUser,
        file_in_project: Files,
        project: Projects,
        mime_type_tree: typing.List[str]):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    assert file_in_project.parent.id == project.root.id

    new_parent = file_in_project.parent
    parents = []

    for i, mime_type in enumerate(mime_type_tree):
        parent = Files(
            mime_type=mime_type,
            filename='parent #{}'.format(i),
            description='desc',
            user=project_owner_user,
            parent=new_parent,
        )
        session.add(parent)

        parents.append(parent)
        file_in_project.parent = parent
        new_parent = parent

    if len(parents):
        session.flush()

    resp = client.patch(
        f'/filesystem/objects/{quote(file_in_project.hash_id)}',
        headers=headers,
        json={
            'parentHashId': new_parent.hash_id,
        },
    )

    assert resp.status_code == 200

    resp_data = resp.get_json()
    resp_file = resp_data['result']

    updated_file: Files = session.query(Files) \
        .filter(Files.id == file_in_project.id) \
        .one()

    assert_file_response(resp_file, updated_file)

    assert updated_file.parent.id == new_parent.id


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
def test_patch_file_parent_to_self(
        session,
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        file_in_project: Files,
        project: Projects):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    assert file_in_project.parent.id == project.root.id

    resp = client.patch(
        f'/filesystem/objects/{quote(file_in_project.hash_id)}',
        headers=headers,
        json={
            'parentHashId': file_in_project.hash_id,
        },
    )

    assert resp.status_code == 400

    resp_data = resp.get_json()

    updated_file: Files = session.query(Files) \
        .filter(Files.id == file_in_project.id) \
        .one()

    assert updated_file.parent.id == project.root.id


@pytest.mark.parametrize(
    'user_with_project_roles', [
        TestUser([], ['project-write']),
    ],
    indirect=['user_with_project_roles'],
    ids=str,
)
@pytest.mark.parametrize(
    'file_in_project', [
        TestFile(public=False, in_folder=True),
    ],
    indirect=['file_in_project'],
    ids=str,
)
def test_patch_file_parent_recursively(
        session,
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        file_in_project: Files,
        project: Projects):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    resp = client.patch(
        f'/filesystem/objects/{quote(file_in_project.parent.hash_id)}',
        headers=headers,
        json={
            'parentHashId': file_in_project.hash_id,
        },
    )

    assert resp.status_code == 400

    resp_data = resp.get_json()

    updated_parent_folder: Files = session.query(Files) \
        .filter(Files.id == file_in_project.parent.id) \
        .one()

    assert updated_parent_folder.parent.id == project.root.id
