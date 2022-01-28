import re

from dataclasses import dataclass
from flask import current_app
from sqlalchemy import (
    event,
    orm,
    and_,
    or_,
)
from sqlalchemy.orm import validates
from sqlalchemy.orm.query import Query
from typing import Dict

from neo4japp.constants import LogEventType
from neo4japp.database import db
from neo4japp.exceptions import ServerException
from neo4japp.models.auth import (
    AccessActionType,
    AccessControlPolicy,
    AccessRuleType,
    AppRole,
    AppUser,
)
from neo4japp.models.common import RDBMSBase, FullTimestampMixin, HashIdMixin
from neo4japp.utils import EventLog

projects_collaborator_role = db.Table(
    'projects_collaborator_role',
    db.Column(
        'appuser_id',
        db.Integer,
        db.ForeignKey('appuser.id', ondelete='CASCADE'),
        primary_key=True,
        index=True
    ),
    db.Column(
        'app_role_id',
        db.Integer,
        db.ForeignKey('app_role.id', ondelete='CASCADE'),
        primary_key=True,
        index=True
    ),
    db.Column(
        'projects_id',
        db.Integer,
        db.ForeignKey('projects.id', ondelete='CASCADE'),
        primary_key=True,
        index=True
    )
)


@dataclass
class ProjectPrivileges:
    readable: bool
    writable: bool
    administrable: bool


class Projects(RDBMSBase, FullTimestampMixin, HashIdMixin):  # type: ignore
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(250), unique=True, nullable=False)
    description = db.Column(db.Text)
    root_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=False, index=True)
    root = db.relationship('Files', foreign_keys=root_id)

    # These fields are not available when initially queried but you can set these fields
    # yourself or use helpers that populate these fields. These fields are used by
    # a lot of the API endpoints, and some of the helper methods that query for Files
    # will populate these fields for you
    calculated_privileges: Dict[int, ProjectPrivileges]  # key = AppUser.id

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._init_model()

    @orm.reconstructor
    def _init_model(self):
        self.calculated_privileges = {}

    @validates('name')
    def validate_name(self, key, name):
        if not re.match(r'^[\w\-()\[\]+{}^%$!.,\'@#]+$', name):
            raise ValueError(f'incorrect project name format')
        return name

    @classmethod
    def query_project_roles(cls, user_id: int, project_id: int) -> Query:
        return db.session.query(
            AppRole
        ).join(
            projects_collaborator_role
        ).join(
            cls
        ).filter(
            cls.id == project_id
        ).join(
            AppUser, AppUser.id == projects_collaborator_role.c.appuser_id,
        ).filter(
            AppUser.id == user_id
        )

    @classmethod
    def get_projects_accessible_by_user(cls, user_id: int) -> Query:
        return db.session.query(
            Projects.id
        ).join(
            projects_collaborator_role,
            and_(
                projects_collaborator_role.c.projects_id == Projects.id,
                projects_collaborator_role.c.appuser_id == user_id,
            )
        ).join(
            AppRole,
            and_(
                AppRole.id == projects_collaborator_role.c.app_role_id,
                or_(
                    AppRole.name == 'project-read',
                    AppRole.name == 'project-write',
                    AppRole.name == 'project-admin'
                )
            )
        )


@event.listens_for(Projects, 'after_insert')
def init_default_access(mapper, connection, target):
    # Sets up the "READ" role
    read_role = connection.execute(AppRole.__table__.select().where(
        AppRole.__table__.c.name == 'project-read'
    )).fetchone()
    if read_role is None:
        connection.execute(AppRole.__table__.insert().values(name='project-read'))
        read_role = connection.execute(AppRole.__table__.select().where(
            AppRole.__table__.c.name == 'project-read'
        )).fetchone()

    connection.execute(AccessControlPolicy.__table__.insert().values(
        action=AccessActionType.READ,
        asset_type=target.__tablename__,
        asset_id=target.id,
        principal_type=AppRole.__tablename__,
        principal_id=read_role.id,
        rule_type=AccessRuleType.ALLOW,
    ))
    connection.execute(AccessControlPolicy.__table__.insert().values(
        action=AccessActionType.WRITE,
        asset_type=target.__tablename__,
        asset_id=target.id,
        principal_type=AppRole.__tablename__,
        principal_id=read_role.id,
        rule_type=AccessRuleType.DENY,
    ))

    # Sets up the "WRITE" role
    write_role = connection.execute(AppRole.__table__.select().where(
        AppRole.__table__.c.name == 'project-write'
    )).fetchone()
    if write_role is None:
        connection.execute(AppRole.__table__.insert().values(name='project-write'))
        write_role = connection.execute(AppRole.__table__.select().where(
            AppRole.__table__.c.name == 'project-write'
        )).fetchone()

    connection.execute(AccessControlPolicy.__table__.insert().values(
        action=AccessActionType.READ,
        asset_type=target.__tablename__,
        asset_id=target.id,
        principal_type=AppRole.__tablename__,
        principal_id=write_role.id,
        rule_type=AccessRuleType.ALLOW,
    ))
    connection.execute(AccessControlPolicy.__table__.insert().values(
        action=AccessActionType.WRITE,
        asset_type=target.__tablename__,
        asset_id=target.id,
        principal_type=AppRole.__tablename__,
        principal_id=write_role.id,
        rule_type=AccessRuleType.ALLOW,
    ))

    # Sets up the "ADMIN" role
    admin_role = connection.execute(AppRole.__table__.select().where(
        AppRole.__table__.c.name == 'project-admin'
    )).fetchone()
    if admin_role is None:
        connection.execute(AppRole.__table__.insert().values(name='project-admin'))
        admin_role = connection.execute(AppRole.__table__.select().where(
            AppRole.__table__.c.name == 'project-admin'
        )).fetchone()

    connection.execute(AccessControlPolicy.__table__.insert().values(
        action=AccessActionType.READ,
        asset_type=target.__tablename__,
        asset_id=target.id,
        principal_type=AppRole.__tablename__,
        principal_id=admin_role.id,
        rule_type=AccessRuleType.ALLOW,
    ))
    connection.execute(AccessControlPolicy.__table__.insert().values(
        action=AccessActionType.WRITE,
        asset_type=target.__tablename__,
        asset_id=target.id,
        principal_type=AppRole.__tablename__,
        principal_id=admin_role.id,
        rule_type=AccessRuleType.ALLOW,
    ))


@event.listens_for(Projects, 'after_update')
def project_update(mapper, connection, target: Projects):
    # Import what we need, when we need it (Helps to avoid circular dependencies)
    from neo4japp.database import get_elastic_service
    from neo4japp.models.files import Files
    from neo4japp.models.files_queries import get_nondeleted_recycled_children_query

    try:
        elastic_service = get_elastic_service()
        family = get_nondeleted_recycled_children_query(
            Files.id == target.root_id,
            children_filter=and_(
                Files.recycling_date.is_(None)
            ),
            lazy_load_content=True
        ).all()
        files_to_update = [member.hash_id for member in family]

        current_app.logger.info(
            f'Attempting to update files in elastic with hash_ids: ' +
            f'{files_to_update}',
            extra=EventLog(event_type=LogEventType.ELASTIC.value).to_dict()
        )
        # TODO: Change this to an update operation, and only update file path
        elastic_service.index_files(files_to_update)
    except Exception as e:
        current_app.logger.error(
            f'Elastic search update failed for project with root_id: {target.root_id}',
            exc_info=e,
            extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
        )
        raise ServerException(
            title='Failed to Update Project',
            message='Something unexpected occurred while updating your file! Please try again ' +
                    'later.'
        )

# TODO: Need to implment some kind of deletion handler if we ever allow deletion of projects.
