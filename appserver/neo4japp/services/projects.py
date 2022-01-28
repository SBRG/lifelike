from typing import Sequence, Optional, Tuple

from sqlalchemy import and_
from sqlalchemy.orm import aliased
from sqlalchemy.orm.session import Session

from neo4japp.database import db, get_authorization_service
from neo4japp.models import (
    AppUser,
    AppRole,
    Projects,
    projects_collaborator_role, Files,
)
from neo4japp.services.common import RDBMSBaseDao
from neo4japp.services.file_types.providers import DirectoryTypeProvider


class ProjectsService(RDBMSBaseDao):

    def __init__(self, session: Session):
        super().__init__(session)

    def get_accessible_projects(self, user: AppUser, filter=None) -> Sequence[Projects]:
        """ Return list a of projects that user either has collab rights to
            or owns it
        """

        t_role = aliased(AppRole)
        t_user = aliased(AppUser)

        project_role_sq = db.session.query(projects_collaborator_role, t_role.name) \
            .join(t_role, t_role.id == projects_collaborator_role.c.app_role_id) \
            .join(t_user, t_user.id == projects_collaborator_role.c.appuser_id) \
            .subquery()

        query = db.session.query(Projects) \
            .outerjoin(project_role_sq,
                       and_(project_role_sq.c.projects_id == Projects.id,
                            project_role_sq.c.appuser_id == user.id,
                            project_role_sq.c.name.in_(
                                ['project-read', 'project-write', 'project-admin'])))

        if filter:
            query = query.filter(filter)

        if not get_authorization_service().has_role(user, 'private-data-access'):
            query = query.filter(project_role_sq.c.name.isnot(None))

        return query.all()

    def create_project_uncommitted(self, user: AppUser, projects: Projects) -> Projects:
        db.session.add(projects)

        root = Files()
        root.mime_type = DirectoryTypeProvider.MIME_TYPE
        root.filename = '/'
        root.user = user
        root.creator = user
        db.session.add(root)

        projects.root = root

        # Set default ownership
        admin_role = db.session.query(AppRole).filter(AppRole.name == 'project-admin').one()
        self.add_collaborator_uncommitted(user, admin_role, projects)

        return projects

    def create_projects(self, user: AppUser, projects: Projects) -> Projects:
        projects = self.create_project_uncommitted(user, projects)
        db.session.commit()
        return projects

    def has_role(self, user: AppUser, projects: Projects) -> Optional[AppRole]:
        user_role = Projects.query_project_roles(user.id, projects.id).one_or_none()
        return user_role

    def add_collaborator_uncommitted(self, user: AppUser, role: AppRole, projects: Projects):
        """ Add a collaborator to a project or modify existing role """
        existing_role = self.session.execute(
            projects_collaborator_role.select().where(
                and_(
                    projects_collaborator_role.c.appuser_id == user.id,
                    projects_collaborator_role.c.projects_id == projects.id,
                    )
            )
        ).fetchone()

        # Removes existing role if it exists
        if existing_role and existing_role != role:
            self._remove_role(user, role, projects)

        self.session.execute(
            projects_collaborator_role.insert(),
            [{
                'appuser_id': user.id,
                'app_role_id': role.id,
                'projects_id': projects.id,
            }]
        )

    def add_collaborator(self, user: AppUser, role: AppRole, projects: Projects):
        self.add_collaborator_uncommitted(user, role, projects)
        self.session.commit()

    def edit_collaborator(self, user: AppUser, role: AppRole, projects: Projects):
        self.remove_collaborator(user, projects)
        self.add_collaborator(user, role, projects)

    def remove_collaborator(self, user: AppUser, projects: Projects):
        """ Removes a collaborator """
        self.session.execute(
            projects_collaborator_role.delete().where(
                and_(
                    projects_collaborator_role.c.appuser_id == user.id,
                    projects_collaborator_role.c.projects_id == projects.id,
                )
            )
        )

        self.session.commit()

    def _remove_role(self, user: AppUser, role: AppRole, projects: Projects):
        """ Remove a role """
        self.session.execute(
            projects_collaborator_role.delete().where(
                and_(
                    projects_collaborator_role.c.appuser_id == user.id,
                    projects_collaborator_role.c.projects_id == projects.id,
                    projects_collaborator_role.c.app_role_id == role.id,
                )
            )
        )
        self.session.commit()
