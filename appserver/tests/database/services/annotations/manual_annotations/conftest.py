import json
import pytest
import requests

from collections import namedtuple
from os import path

from neo4japp.models import (
    AppUser,
    Files,
    FileContent,
    Projects
)
from neo4japp.services.file_types.providers import DirectoryTypeProvider, PDFTypeProvider


class MockResponse():
    def __init__(self, data):
        self.data = data

    def json(self):
        return self.data

    def close(self):
        pass


# reference to this directory
directory = path.realpath(path.dirname(__file__))

ParameterizedFile = namedtuple('FilesParam', (
    'public', 'in_folder', 'user_roles_for_folder', 'user_roles_for_file',
    'recycled', 'folder_recycled', 'deleted', 'folder_deleted',
), defaults=(False, False, [], [], False, False, False, False))


@pytest.fixture(scope='function')
def project_owner(request, session):
    user = AppUser(
        username='project owner',
        email='somebody@lifelike.bio',
        first_name='joe',
        last_name='taylor',
    )
    user.set_password('password')
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def project(session, project_owner):
    root_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        user=project_owner,
    )
    project = Projects(
        name='my-life-work',
        description='random stuff',
        root=root_dir,
    )
    session.add(root_dir)
    session.add(project)
    session.flush()
    return project


@pytest.fixture(scope='function')
def basic_file_content(session):
    content = FileContent()
    content.raw_file_utf8 = 'I just caught a Pikachu! That\'s right, I caught a Pikachu.'
    session.add(content)
    session.flush()
    return content


@pytest.fixture(scope='function')
def file_in_project(
    session,
    project,
    project_owner,
    basic_file_content
):
    param = ParameterizedFile()

    file = Files(
        mime_type=PDFTypeProvider.MIME_TYPE,
        filename='a map',
        description='desc',
        user=project_owner,
        content=basic_file_content,
        parent=project.root,
        public=param.public,
    )
    session.add(file)
    session.flush()
    return file


@pytest.fixture(scope='function')
def mock_add_custom_annotation_inclusion(monkeypatch):
    def get_parsed(*args, **kwargs):
        pdf = path.join(
            directory, '..',
            'pdf_samples/manual_annotations_test/test_add_custom_annotation_inclusion.json')
        with open(pdf, 'rb') as f:
            return MockResponse(json.load(f))

    monkeypatch.setattr(requests, 'post', get_parsed)
