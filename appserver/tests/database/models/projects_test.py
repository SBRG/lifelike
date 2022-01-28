import pytest

from neo4japp.models import Files
from neo4japp.models.auth import (
    AccessControlPolicy,
    AppRole,
    AppUser,
)
from neo4japp.models.projects import (
    Projects,
    projects_collaborator_role,
)
from neo4japp.services.file_types.providers import DirectoryTypeProvider


@pytest.mark.parametrize('name', [
    ('!nva!d|'),
    ('i3cr3e@m>i4cr4e@m'),
    ('s t y l e'),
])
def test_flag_invalid_projects_name(session, name):
    with pytest.raises(ValueError):
        project = Projects(
            name=name,
            description='description',
        )


@pytest.mark.parametrize('name', [
    ('test-project'),
    ('project1'),
    ('valid_underscore'),
    ('ö-german'),
    ('æØÅ_nordic#letters$are@valid')
])
def test_can_add_projects(session, name, test_user):
    root_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        user=test_user,
    )
    project = Projects(
        name=name,
        description='description',
        root=root_dir,
    )
    session.add(root_dir)
    session.add(project)
    session.flush()

    proj = Projects.query.filter_by(name=name).one()
    assert project.name == name


@pytest.mark.parametrize('name, user_fks', [
    ('test-project', [1, 2, 3]),
    ('project1', [100, 200, 300]),
])
def test_can_add_users_to_projects(session, name, user_fks, test_user: AppUser):
    root_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        user=test_user,
    )
    project = Projects(
        name=name,
        description='description',
        root=root_dir,
    )
    session.add(root_dir)
    session.add(project)
    session.flush()

    proj = Projects.query.filter_by(name=name).one()

    proj.users = user_fks

    session.flush()

    assert len(proj.users) == len(user_fks)


@pytest.mark.parametrize('role', [
    'project-admin',
    'project-read',
    'project-write',
])
def test_can_set_user_role(session, role):

    test_user = AppUser(
        username='test',
        email='test@lifelike.bio',
        password_hash='pw',
        first_name='test',
        last_name='tester',
    )
    session.add(test_user)
    session.flush()

    root_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        user=test_user,
    )
    new_projects = Projects(
        name='they-see-me',
        description='rolling',
        root=root_dir,
    )

    session.add(root_dir)
    session.add(new_projects)
    session.flush()

    # NOTE: This already exists since there's an event
    # that creates roles anytime a "Projects" is created.
    # "fixed_projects" creates a "Projects"
    # @event.listens_for(Projects, 'after_insert')
    app_role = AppRole.query.filter(AppRole.name == role).one()

    session.execute(
        projects_collaborator_role.insert(),
        [{
            'appuser_id': test_user.id,
            'app_role_id': app_role.id,
            'projects_id': new_projects.id,
        }]
    )
    session.flush()

    user_role = Projects.query_project_roles(
        test_user.id, new_projects.id
    ).one_or_none()

    assert user_role.name == role


def test_projects_init_with_roles(session, test_user: AppUser):

    root_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        user=test_user,
    )
    p = Projects(
        name='they-see-me',
        description='rolling',
        root=root_dir,
    )
    session.add(root_dir)
    session.add(p)
    session.flush()

    acp_roles = session.query(
        AccessControlPolicy.id,
        AppRole.name,
    ).filter(
        AccessControlPolicy.principal_type == AppRole.__tablename__,
    ).filter(
        AccessControlPolicy.asset_type == Projects.__tablename__,
        AccessControlPolicy.asset_id == p.id,
    ).join(
        AppRole,
        AppRole.id == AccessControlPolicy.principal_id,
    ).all()

    roles = [role for _, role in acp_roles]
    assert 'project-admin' in roles
    assert 'project-read' in roles
    assert 'project-write' in roles
