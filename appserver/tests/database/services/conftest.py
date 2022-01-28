from datetime import date

import pytest

from neo4japp.models import AppUser, Projects, Files, FileContent
from neo4japp.services.file_types.providers import DirectoryTypeProvider, MapTypeProvider


@pytest.fixture(scope='function')
def fix_owner(session) -> AppUser:
    user = AppUser(
        id=100,
        username='test_admin_user',
        email='admin@lifelike.bio',
        password_hash='password',
        first_name='Jim',
        last_name='Melancholy'
    )
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def test_user(session) -> AppUser:
    user = AppUser(
        id=200,
        username='test_user',
        email='test@lifelike.bio',
        password_hash='password',
        first_name='Jim',
        last_name='Melancholy'
    )
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def fix_projects(session, test_user: AppUser) -> Projects:
    root_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        user=test_user,
    )
    projects = Projects(
        name='test-project',
        description='test project',
        root=root_dir,
    )
    session.add(root_dir)
    session.add(projects)
    session.flush()

    return projects


@pytest.fixture(scope='function')
def fix_directory(session, fix_projects: Projects, test_user: AppUser) -> Files:
    dir = Files(
        filename='/',
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        user=test_user,
    )
    session.add(dir)
    session.flush()
    return dir


@pytest.fixture(scope='function')
def fix_project(fix_owner, fix_directory, session) -> Files:
    content = FileContent()
    content.raw_file_utf8 = '{}'
    file = Files(
        hash_id='map1',
        mime_type=MapTypeProvider.MIME_TYPE,
        filename='Project1',
        description='a test project',
        user=fix_owner,
        content=content,
        parent=fix_directory,
    )
    session.add(content)
    session.add(file)
    session.flush()
    return file


@pytest.fixture(scope='function')
def fix_nested_dir(fix_owner, fix_directory, session) -> Files:
    child_dir = Files(
        filename='child-level-1',
        parent=fix_directory,
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        user_id=fix_owner.id,
    )
    session.add(child_dir)
    session.flush()
    return child_dir
