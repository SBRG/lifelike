from sqlalchemy import inspect, and_, literal

from neo4japp.database import db
from neo4japp.models import Projects, AppRole, AppUser, projects_collaborator_role
from neo4japp.models.projects import ProjectPrivileges


def add_project_user_role_columns(query, project_table, user_id, role_names=None,
                                  column_format=None, access_override=False):
    """
    Add columns to a query for fetching the value of the provided roles for the
    provided user ID for projects in the provided project table.

    :param query: the query to modify
    :param project_table: the project table
    :param role_names: a list of roles to check
    :param user_id: the user ID to check for
    :param column_format: the format for the name of the column, where {} is the role name
    :parameter access_override: if true, give full access
    :return: the new query
    """

    role_names = role_names if role_names is not None else [
        'project-read',
        'project-write',
        'project-admin'
    ]
    column_format = column_format if column_format is not None else f'has_{{}}_{user_id}'

    for role_name in role_names:
        if access_override:
            query = query.add_column(literal(True).label(column_format.format(role_name)))
        else:
            t_role = db.aliased(AppRole)
            t_user = db.aliased(AppUser)

            project_role_sq = db.session.query(projects_collaborator_role, t_role.name) \
                .join(t_role, t_role.id == projects_collaborator_role.c.app_role_id) \
                .join(t_user, t_user.id == projects_collaborator_role.c.appuser_id) \
                .subquery()

            query = query \
                .outerjoin(project_role_sq, and_(project_role_sq.c.projects_id == project_table.id,
                                                 project_role_sq.c.appuser_id == user_id,
                                                 project_role_sq.c.name == role_name)) \
                .add_column(project_role_sq.c.name.isnot(None)
                            .label(column_format.format(role_name)))

    return query


class ProjectCalculator:
    """
    This class can be used to populate the calculated fields (namely privileges)
    on the Projects model.
    """

    def __init__(self, result, project_table):
        self.result = result._asdict()
        self.project_table = project_table
        # TODO: The following line probably is hacky because I can't figure out the SQLAlchemy API
        # with its terrible docs
        self.project_key = inspect(
            self.project_table).name if project_table != Projects else 'Projects'

    @property
    def project(self) -> Projects:
        return self.result[self.project_key]

    def calculate_privileges(self, user_ids):
        project: Projects = self.result[self.project_key]

        for user_id in user_ids:
            project_manageable = self.result[f'has_project-admin_{user_id}']
            project_readable = self.result[f'has_project-read_{user_id}']
            project_writable = self.result[f'has_project-write_{user_id}']

            privileges = ProjectPrivileges(
                readable=project_manageable or project_readable or project_writable,
                writable=project_manageable or project_writable,
                administrable=project_manageable,
            )

            project.calculated_privileges[user_id] = privileges
