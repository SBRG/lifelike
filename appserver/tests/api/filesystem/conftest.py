import datetime
import pytest

from collections import namedtuple
from typing import Optional

from neo4japp.models import (
    AppUser,
    Files,
    FileContent,
    Projects,
    projects_collaborator_role,
    file_collaborator_role
)
from neo4japp.services import AccountService
from neo4japp.services.file_types.providers import DirectoryTypeProvider, GraphTypeProvider


@pytest.fixture(scope='function')
def login_password() -> str:
    return 'some password'


@pytest.fixture(scope='function')
def project_owner_user(
        request,
        session,
        account_user: AccountService,
        login_password: str) -> AppUser:
    user = AppUser(
        username='project owner',
        email=f'somebody@lifelike.bio',
        first_name='joe',
        last_name='taylor',
    )
    user.set_password(login_password)
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def project(
        session,
        project_owner_user: AppUser) -> Projects:
    root_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        user=project_owner_user,
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


ParameterizedAppUser = namedtuple('ParameterizedAppUser', (
    'app_roles',
    'project_roles',
), defaults=([], []))


@pytest.fixture(scope='function')
def user_with_project_roles(
        request,
        session,
        account_user: AccountService,
        login_password: str,
        project: Projects) -> AppUser:
    if hasattr(request, 'param'):
        param: ParameterizedAppUser = request.param
    else:
        param = ParameterizedAppUser([], [])

    user = AppUser(
        username='user_with_project_roles',
        email=f'somehow@lifelike.bio',
        first_name='erica',
        last_name='samuel',
    )
    user.set_password(login_password)
    user.roles.extend([account_user.get_or_create_role(role_name)
                       for role_name in param.app_roles])
    session.add(user)
    session.flush()

    for role_name in param.project_roles:
        session.execute(
            projects_collaborator_role.insert(),
            [{
                'appuser_id': user.id,
                'app_role_id': account_user.get_or_create_role(role_name).id,
                'projects_id': project.id,
            }]
        )
    session.flush()
    return user


ParameterizedFile = namedtuple('ParameterizedFile', (
    'public', 'in_folder', 'user_roles_for_folder', 'user_roles_for_file',
    'recycled', 'folder_recycled', 'deleted', 'folder_deleted',
), defaults=(False, False, [], [], False, False, False, False))


@pytest.fixture(scope='function')
def file_in_project(
        request,
        session,
        account_user: AccountService,
        project: Projects,
        user_with_project_roles: AppUser,
        project_owner_user: AppUser) -> Files:
    content = FileContent()
    content.raw_file_utf8 = '{}'

    if hasattr(request, 'param'):
        param: ParameterizedFile = request.param
    else:
        param = ParameterizedFile(False, False, [], [], False, False, False, False)

    file = Files(
        mime_type=GraphTypeProvider.MIME_TYPE,
        filename='a sankey',
        description='desc',
        user=project_owner_user,
        content=content,
        parent=project.root,
        public=param.public,
    )

    folder: Optional[Files] = None
    if param.in_folder:
        folder = Files(
            mime_type=DirectoryTypeProvider.MIME_TYPE,
            filename='a folder',
            description='desc',
            user=project_owner_user,
            parent=project.root,
        )
        file.parent = folder
        session.add(folder)

    if param.recycled:
        file.recycling_date = datetime.datetime.now()

    if param.folder_recycled:
        assert folder is not None
        folder.recycling_date = datetime.datetime.now()

    if param.deleted:
        file.deletion_date = datetime.datetime.now()

    if param.folder_deleted:
        assert folder is not None
        folder.deletion_date = datetime.datetime.now()

    session.add(content)
    session.add(file)
    session.flush()

    if param.user_roles_for_file:
        assert param.in_folder

        for role_name in param.user_roles_for_file:
            session.execute(
                file_collaborator_role.insert(),
                [{
                    'file_id': file.id,
                    'collaborator_id': user_with_project_roles.id,
                    'owner_id': user_with_project_roles.id,
                    'role_id': account_user.get_or_create_role(role_name).id,
                    'creator_id': user_with_project_roles.id,
                    'modifier_id': user_with_project_roles.id,
                }]
            )

    if param.user_roles_for_folder:
        assert folder is not None

        for role_name in param.user_roles_for_folder:
            session.execute(
                file_collaborator_role.insert(),
                [{
                    'file_id': folder.id,
                    'collaborator_id': user_with_project_roles.id,
                    'owner_id': user_with_project_roles.id,
                    'role_id': account_user.get_or_create_role(role_name).id,
                    'creator_id': user_with_project_roles.id,
                    'modifier_id': user_with_project_roles.id,
                }]
            )

    return file
