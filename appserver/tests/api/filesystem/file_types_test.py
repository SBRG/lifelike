import importlib.resources as pkg_resources
from io import BytesIO
from typing import Tuple
from urllib.parse import quote

import pytest

from neo4japp.models import AppUser, Files
from tests.api.filesystem.conftest import ParameterizedFile, ParameterizedAppUser
from tests.helpers.api import generate_jwt_headers
from . import sample_files

blocked_file_exts = [
    '.exe', '.pif', '.application', '.gadget', '.msi', '.msp', '.com', '.scr', '.hta',
    '.cpl', '.msc', '.jar', '.bat', '.dll', '.cmd', '.vb', '.vbs', '.vbe', '.js', '.jse', '.ws',
    '.wsf', '.wsc', '.wsh', '.ps1', '.ps1xml', '.ps2', '.ps2xml', '.psc1', '.psc2',
    '.scf', '.lnk', '.inf', '.reg', '.sh', '.dmg', '.app', '.apk', '.ade', '.adp',
    '.appx', '.appxbundle', '.cab', '.chm', '.ex', '.ex_', '.ins', '.isp', '.iso',
    '.lib', '.mde', '.msix', '.msixbundle', '.mst', '.nsh', '.sct', '.shb', '.sys',
    '.vxd',
]


@pytest.mark.parametrize(
    'user_with_project_roles', [
        ParameterizedAppUser([], ['project-write']),
    ],
    indirect=['user_with_project_roles'],
    ids='_',
)
@pytest.mark.parametrize(
    'file_in_project', [
        ParameterizedFile(public=False),
    ],
    indirect=['file_in_project'],
    ids='_',
)
@pytest.mark.parametrize(
    'file_data', [
        ('sample.txt', 'text/plain'),
        ('sample.pdf', 'application/pdf'),
        ('sample.png', 'image/png'),
        ('sample.json', 'application/json'),
        ('sample.zip', 'application/zip'),
        ('sample.html', 'text/html'),
        ('covid_19_vaccine.llmap.zip', 'vnd.lifelike.document/map'),
    ],
    ids=lambda x: x[1],
)
def test_upload_file_mime_type_detection(
        request,
        session,
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        file_in_project: Files,
        file_data: Tuple[str, str]):
    file_content = pkg_resources.read_binary(sample_files, file_data[0])

    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    resp = client.post(
        f'/filesystem/objects',
        headers=headers,
        content_type='multipart/form-data',
        data={
            'contentValue': (BytesIO(file_content), 'test.file'),
            'parentHashId': file_in_project.parent.hash_id,
            'filename': 'test',
        },
    )

    assert resp.status_code == 200

    resp_data = resp.get_json()

    assert file_data[1] == session.query(Files.mime_type) \
        .filter(Files.hash_id == resp_data['result']['hashId']) \
        .one()[0]


@pytest.mark.parametrize(
    'user_with_project_roles', [
        ParameterizedAppUser([], ['project-write']),
    ],
    indirect=['user_with_project_roles'],
    ids='_',
)
@pytest.mark.parametrize(
    'file_in_project', [
        ParameterizedFile(public=False),
    ],
    indirect=['file_in_project'],
    ids='_',
)
@pytest.mark.parametrize(
    'ext', blocked_file_exts,
)
def test_upload_file_with_blocked_ext(
        request,
        session,
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        file_in_project: Files,
        ext: str):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    resp = client.post(
        f'/filesystem/objects',
        headers=headers,
        content_type='multipart/form-data',
        data={
            'contentValue': (BytesIO(b'hello world'), f'test{ext.capitalize()}'),
            'parentHashId': file_in_project.parent.hash_id,
            'filename': f'test{ext.capitalize()}',
        },
    )

    assert resp.status_code == 400


@pytest.mark.parametrize(
    'user_with_project_roles', [
        ParameterizedAppUser([], ['project-write']),
    ],
    indirect=['user_with_project_roles'],
    ids='_',
)
@pytest.mark.parametrize(
    'file_in_project', [
        ParameterizedFile(public=False),
    ],
    indirect=['file_in_project'],
    ids='_',
)
@pytest.mark.parametrize(
    'ext', blocked_file_exts,
)
def test_rename_file_to_blocked_ext(
        request,
        session,
        client,
        login_password: str,
        user_with_project_roles: AppUser,
        file_in_project: Files,
        ext: str):
    login_resp = client.login_as_user(user_with_project_roles.email, login_password)
    headers = generate_jwt_headers(login_resp['accessToken']['token'])

    resp = client.patch(
        f'/filesystem/objects/{quote(file_in_project.hash_id)}',
        headers=headers,
        json={
            'filename': f"file_in_project.filename{ext.capitalize()}",
        },
    )

    assert resp.status_code == 400
