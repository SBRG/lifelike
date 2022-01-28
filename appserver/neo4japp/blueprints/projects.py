from typing import List, Optional, Tuple, Dict, Iterable

from flask import jsonify, Blueprint, g
from flask.views import MethodView
from marshmallow import ValidationError
from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import raiseload, joinedload
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.database import db, get_projects_service, get_authorization_service
from neo4japp.exceptions import AccessRequestRequiredError, RecordNotFound
from neo4japp.models import (
    AppRole,
    AppUser,
    Projects,
    projects_collaborator_role
)
from neo4japp.models.projects_queries import add_project_user_role_columns, ProjectCalculator
from neo4japp.schemas.common import PaginatedRequestSchema
from neo4japp.schemas.filesystem import (
    ProjectListSchema,
    ProjectListRequestSchema,
    ProjectSearchRequestSchema,
    ProjectCreateSchema,
    ProjectResponseSchema,
    BulkProjectRequestSchema,
    BulkProjectUpdateRequestSchema,
    MultipleProjectResponseSchema,
    ProjectUpdateRequestSchema
)
from neo4japp.schemas.projects import (
    ProjectCollaboratorListSchema,
    ProjectMultiCollaboratorUpdateRequest
)
from neo4japp.utils.request import Pagination


class ProjectBaseView(MethodView):
    """Base view class for dealing with projects."""

    def get_nondeleted_project_query(self, user: AppUser, accessible_only=False):
        """
        Return a query for fetching non-deleted projects accessible by the passed
        in user. You can add additional filters if needed.

        :param user: the user to check
        :param accessible_only: true to not include non-accessible projects
        :return: the query
        """
        t_role = db.aliased(AppRole)
        t_user = db.aliased(AppUser)

        private_data_access = get_authorization_service().has_role(
            user, 'private-data-access'
        )

        # The following code gets a collection of projects, complete with permission
        # information for the current user, all in one go. Unfortunately, it's complex, but
        # it should be manageable if the only instance of this kind of code is in one place
        # (right here). The upside is that all downstream code, including the client, is very
        # simple because all the needed information has already been loaded.

        query = db.session.query(Projects) \
            .options(joinedload(Projects.root),
                     raiseload('*')) \
            .filter(Projects.deletion_date.is_(None)) \
            .distinct()

        if accessible_only and not private_data_access:
            expected_roles = ['project-read', 'project-write', 'project-admin']

            project_role_sq = db.session.query(projects_collaborator_role, t_role.name) \
                .join(t_role, t_role.id == projects_collaborator_role.c.app_role_id) \
                .join(t_user, t_user.id == projects_collaborator_role.c.appuser_id) \
                .subquery()

            # This code does an inner join of the necessary role columns, so if the user
            # doesn't have the roles, they don't have permission
            query = query.join(project_role_sq, and_(project_role_sq.c.projects_id == Projects.id,
                                                     project_role_sq.c.appuser_id == user.id,
                                                     project_role_sq.c.name.in_(expected_roles)))

        # Add extra boolean columns to the result indicating various permissions (read, write, etc.)
        # for the current user, which then can be read later by ProjectCalculator or manually
        query = add_project_user_role_columns(query, Projects, user.id,
                                              access_override=private_data_access)

        return query

    def get_nondeleted_project(self, filter):
        """
        Returns a project that is guaranteed to be non-deleted that
        matches the provided filter.

        :param filter: the SQL Alchemy filter
        :return: a non-null project
        """
        files, *_ = self.get_nondeleted_projects(filter)
        if not len(files):
            raise RecordNotFound(
                title='File Not Found',
                message='The requested project could not be found.',
                code=404)
        return files[0]

    def get_nondeleted_projects(self, filter, accessible_only=False, sort=None,
                                require_hash_ids: List[str] = None,
                                pagination: Optional[Pagination] = None) \
            -> Tuple[List[Projects], int]:
        """
        Returns files that are guaranteed to be non-deleted that match the
        provided filter.

        :param filter: the SQL Alchemy filter
        :param accessible_only: true to only get projects accessible by the current user
        :param sort: optional list of sort columns
        :param pagination: optional pagination
        :return: the result, which may be an empty list
        """
        current_user = g.current_user

        query = self.get_nondeleted_project_query(current_user, accessible_only=accessible_only) \
            .order_by(*sort or [])

        if filter is not None:
            query = query.filter(filter)

        if pagination:
            paginated_results = query.paginate(pagination.page, pagination.limit)
            results = paginated_results.items
            total = paginated_results.total
        else:
            results = query.all()
            total = len(results)

        projects = []

        # We added permission columns to the result of the query, but we need to put them
        # into the instances of Projects (since we only return a list of Projects at the end
        # of this method)
        for row in results:
            calculator = ProjectCalculator(row, Projects)
            calculator.calculate_privileges([current_user.id])
            projects.append(calculator.project)

        # Handle helper require_hash_ids argument that check to see if all projected wanted
        # actually appeared in the results
        if require_hash_ids:
            missing_hash_ids = self.get_missing_hash_ids(require_hash_ids, projects)

            if len(missing_hash_ids):
                raise RecordNotFound(
                    title='File Not Found',
                    message=f"The request specified one or more projects "
                    f"({', '.join(missing_hash_ids)}) that could not be found.",
                    code=404)

        return projects, total

    def check_project_permissions(self, projects: List[Projects], user: AppUser,
                                  require_permissions: List[str]):
        """
        Helper method to check permissions on the provided projects. On error, an
        exception is thrown.

        :param projects: the projects to check
        :param user: the user to check permissions for
        :param require_permissions: a list of permissions to require (like 'writable')
        """
        # Check each file
        for project in projects:
            for permission in require_permissions:
                if not getattr(project.calculated_privileges[user.id], permission):
                    # Do not reveal the project name with the error!
                    raise AccessRequestRequiredError(
                        curr_access='no',
                        req_access=permission,
                        hash_id=project.hash_id)

    def get_project_response(self, hash_id: str, user: AppUser):
        """
        Fetch a project and return a response that can be sent to the client. Permissions
        are checked and this method will throw a relevant response exception.

        :param hash_id: the hash ID of the project
        :param user: the user to check permissions for
        :return: the response
        """
        return_project = self.get_nondeleted_project(Projects.hash_id == hash_id)
        self.check_project_permissions([return_project], user, ['readable'])

        return jsonify(ProjectResponseSchema(context={
            'user_privilege_filter': g.current_user.id,
        }).dump({
            'result': return_project,
        }))

    def get_bulk_project_response(self, hash_ids: List[str], user: AppUser, *,
                                  missing_hash_ids: Iterable[str] = None):
        projects, total = self.get_nondeleted_projects(Projects.hash_id.in_(hash_ids),
                                                       require_hash_ids=hash_ids)
        self.check_project_permissions(projects, user, ['readable'])

        returned_projects = {}

        for project in projects:
            returned_projects[project.hash_id] = project

        return jsonify(MultipleProjectResponseSchema(context={
            'user_privilege_filter': user.id,
        }).dump(dict(
            mapping=returned_projects,
            missing=list(missing_hash_ids) if missing_hash_ids else [],
        )))

    def update_projects(self, hash_ids: List[str], params: Dict, user: AppUser):
        changed_fields = set()

        projects, total = self.get_nondeleted_projects(Projects.hash_id.in_(hash_ids))
        self.check_project_permissions(projects, user, ['readable'])
        missing_hash_ids = self.get_missing_hash_ids(hash_ids, projects)

        for project in projects:
            for field in ('name', 'description'):
                if field in params:
                    if getattr(project, field) != params[field]:
                        setattr(project, field, params[field])
                        changed_fields.add(field)

        if len(changed_fields):
            try:
                db.session.commit()
            except IntegrityError as e:
                raise ValidationError("The project name is already taken.")

        return missing_hash_ids

    def get_missing_hash_ids(self, expected_hash_ids: Iterable[str], files: Iterable[Projects]):
        found_hash_ids = set(file.hash_id for file in files)
        missing = set()
        for hash_id in expected_hash_ids:
            if hash_id not in found_hash_ids:
                missing.add(hash_id)
        return missing


class ProjectListView(ProjectBaseView):
    decorators = [auth.login_required]

    @use_args(ProjectListRequestSchema)
    @use_args(PaginatedRequestSchema)
    def get(self, params, pagination: Pagination):
        """Endpoint to fetch a list of projects accessible by the user."""
        current_user = g.current_user

        projects, total = self.get_nondeleted_projects(
            None, accessible_only=True,
            sort=params['sort'], pagination=pagination,
        )
        # Not necessary (due to accessible_only=True), but check anyway
        self.check_project_permissions(projects, current_user, ['readable'])

        return jsonify(ProjectListSchema(context={
            'user_privilege_filter': g.current_user.id,
        }).dump({
            'total': total,
            'results': projects,
        }))

    @use_args(ProjectCreateSchema)
    def post(self, params):
        """Endpoint to create a project."""
        current_user = g.current_user

        project_service = get_projects_service()

        project = Projects()
        project.name = params['name']
        project.description = params['description']
        project.creator = current_user

        try:
            db.session.begin_nested()
            project_service.create_project_uncommitted(current_user, project)
            db.session.commit()
            db.session.flush()
        except IntegrityError:
            db.session.rollback()
            raise ValidationError('The project name already is already taken.', 'name')

        db.session.commit()

        return self.get_project_response(project.hash_id, current_user)

    @use_args(lambda request: BulkProjectRequestSchema())
    @use_args(lambda request: BulkProjectUpdateRequestSchema(partial=True))
    def patch(self, targets, params):
        """Project update endpoint."""

        current_user = g.current_user
        missing_hash_ids = self.update_projects(targets['hash_ids'], params, current_user)
        return self.get_bulk_project_response(targets['hash_ids'], current_user,
                                              missing_hash_ids=missing_hash_ids)


class ProjectSearchView(ProjectBaseView):
    decorators = [auth.login_required]

    @use_args(ProjectSearchRequestSchema)
    @use_args(PaginatedRequestSchema)
    def post(self, params: dict, pagination: Pagination):
        """Endpoint to search for projects that match certain criteria."""
        current_user = g.current_user

        projects, total = self.get_nondeleted_projects(
            Projects.name == params['name'],
            accessible_only=True,
            sort=params['sort'],
            pagination=pagination,
        )
        # Not necessary (due to accessible_only=True), but check anyway
        self.check_project_permissions(projects, current_user, ['readable'])

        return jsonify(ProjectListSchema(context={
            'user_privilege_filter': g.current_user.id,
        }).dump({
            'total': total,
            'results': projects,
        }))


class ProjectDetailView(ProjectBaseView):
    decorators = [auth.login_required]

    def get(self, hash_id: str):
        """Endpoint to fetch a project by hash ID."""
        current_user = g.current_user
        return self.get_project_response(hash_id, current_user)

    @use_args(lambda request: ProjectUpdateRequestSchema(partial=True))
    def patch(self, params: dict, hash_id: str):
        """Update a single project."""
        current_user = g.current_user
        self.update_projects([hash_id], params, current_user)
        return self.get(hash_id)


class ProjectCollaboratorsListView(ProjectBaseView):
    decorators = [auth.login_required]

    def get_bulk_collaborator_response(self, hash_id, pagination: Pagination):
        """
        Generate a list of colloborators for aproject.
        """
        current_user = g.current_user
        project = self.get_nondeleted_project(Projects.hash_id == hash_id)
        self.check_project_permissions([project], current_user, ['administrable'])

        query = db.session.query(AppUser, AppRole.name) \
            .join(projects_collaborator_role,
                  AppUser.id == projects_collaborator_role.c.appuser_id) \
            .join(AppRole, AppRole.id == projects_collaborator_role.c.app_role_id) \
            .filter(projects_collaborator_role.c.projects_id == project.id)

        paginated_result = query.paginate(pagination.page, pagination.limit, False)

        return jsonify(ProjectCollaboratorListSchema().dump({
            'results': [{
                'user': item[0],
                'role_name': item[1],
            } for item in paginated_result.items]
        }))

    @use_args(PaginatedRequestSchema)
    def get(self, pagination: Pagination, hash_id):
        """Endpoint to fetch a list of collaborators for a project."""
        return self.get_bulk_collaborator_response(hash_id, pagination)

    @use_args(ProjectMultiCollaboratorUpdateRequest)
    def post(self, params, hash_id):
        proj_service = get_projects_service()
        current_user = g.current_user

        private_data_access = get_authorization_service().has_role(
            current_user, 'private-data-access'
        )

        project = self.get_nondeleted_project(Projects.hash_id == hash_id)
        self.check_project_permissions([project], current_user, ['administrable'])

        user_hash_ids = set([item['user_hash_id'] for item in params['update_or_create']] +
                            params['remove_user_hash_ids'])
        role_names = set([item['role_name'] for item in params['update_or_create']])

        target_users = db.session.query(AppUser) \
            .filter(AppUser.hash_id.in_(user_hash_ids)) \
            .options(raiseload('*')) \
            .all()

        roles = db.session.query(AppRole) \
            .filter(AppRole.name.in_(role_names)) \
            .options(raiseload('*')) \
            .all()

        if len(target_users) != len(user_hash_ids):
            raise ValidationError(f"One or more specified users does not exist.")

        if len(roles) != len(role_names):
            raise ValidationError(f"One or more specified roles does not exist.")

        user_map = {}
        for user in target_users:
            user_map[user.hash_id] = user

        role_map = {}
        for role in roles:
            role_map[role.name] = role

        # Super admin users need to be able to change anyone on a project
        if not private_data_access:
            for user in target_users:
                if user.id == current_user.id:
                    raise ValidationError(f"You cannot edit yourself.")

        for entry in params['update_or_create']:
            proj_service.edit_collaborator(user_map[entry['user_hash_id']],
                                           role_map[entry['role_name']],
                                           project)

        for user_hash_id in params['remove_user_hash_ids']:
            proj_service.remove_collaborator(user_map[user_hash_id], project)

        return self.get_bulk_collaborator_response(hash_id, Pagination(1, 100))


bp = Blueprint('projects', __name__, url_prefix='/projects')
bp.add_url_rule('/search', view_func=ProjectSearchView.as_view('project_search'))
bp.add_url_rule('/projects', view_func=ProjectListView.as_view('project_list'))
bp.add_url_rule('/projects/<string:hash_id>', view_func=ProjectDetailView.as_view('project_detail'))
bp.add_url_rule('/projects/<string:hash_id>/collaborators',
                view_func=ProjectCollaboratorsListView.as_view('project_collaborators_list'))
