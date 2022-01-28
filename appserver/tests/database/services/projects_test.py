import json
from datetime import date

import pytest

from neo4japp.models import Files
from neo4japp.models.auth import (
    AppRole, AppUser,
)
from neo4japp.models.projects import (
    Projects,
)
from neo4japp.services import ProjectsService
from neo4japp.services.file_types.providers import DirectoryTypeProvider


def test_can_add_project_collaborator(session, fix_projects, test_user):
    proj_service = ProjectsService(session)
    role = AppRole.query.filter(AppRole.name == 'project-read').one()
    proj_service.add_collaborator(test_user, role, fix_projects)

    user_role = Projects.query_project_roles(
        test_user.id, fix_projects.id
    ).one_or_none()

    assert user_role.name == 'project-read'


def test_can_delete_project_collaborator(session, fix_projects, test_user):
    proj_service = ProjectsService(session)
    proj_service.remove_collaborator(test_user, fix_projects)

    user_role = Projects.query_project_roles(
        test_user.id, fix_projects.id
    ).one_or_none()

    assert user_role is None


def test_owner_gets_default_admin_permission(session, test_user: AppUser):
    proj_service = ProjectsService(session)
    root_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        user=test_user,
    )
    projects = Projects(
        name='cookie',
        description='monster',
        root=root_dir,
    )
    session.add(root_dir)
    session.add(projects)
    session.flush()
    new_project = proj_service.create_projects(test_user, projects)

    user_role = Projects.query_project_roles(
        test_user.id, new_project.id
    ).one_or_none()

    assert user_role.name == 'project-admin'
