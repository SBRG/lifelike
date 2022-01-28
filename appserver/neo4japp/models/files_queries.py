"""TODO: Possibly turn this into a DAO in the future.
For now, it's just a file with query functions to help DRY.
"""
from typing import Set, Optional, Union, Literal

from flask_sqlalchemy import BaseQuery
from sqlalchemy import and_, inspect, literal
from sqlalchemy.orm import aliased, contains_eager, defer, joinedload, lazyload, Query, raiseload

from neo4japp.database import db
from . import AppUser, AppRole, Projects
from .files import Files, FileContent, file_collaborator_role, FallbackOrganism
from .projects_queries import add_project_user_role_columns, ProjectCalculator
from ..schemas.filesystem import FilePrivileges


def get_all_files_and_content_by_id(file_ids: Set[str], project_id: int):
    sub_query = db.session.query(FallbackOrganism.id.label('fallback_organism_id')).subquery()
    query = db.session.query(
        Files.id,
        Files.annotations,
        Files.custom_annotations,
        Files.excluded_annotations,
        Files.file_id,
        Files.filename,
        FileContent.id.label('file_content_id'),
        FileContent.raw_file,
        sub_query.c.fallback_organism_id
    ).join(
        FileContent,
        FileContent.id == Files.content_id,
    ).filter(
        and_(
            Files.project == project_id,
            Files.file_id.in_(file_ids),
        ),
    )

    return query.outerjoin(
        sub_query,
        and_(sub_query.c.fallback_organism_id == Files.fallback_organism_id))


def get_all_files_by_id(file_ids: Set[str], project_id: int):
    files = db.session.query(
        Files,
    ).filter(
        and_(
            Files.project == project_id,
            Files.file_id.in_(file_ids),
        ),
    ).all()
    return files


def _build_file_cte(direction: Union[Literal['children'], Literal['parents']],
                    filter, max_depth=Files.MAX_DEPTH,
                    files_table=Files, projects_table=Projects) -> BaseQuery:
    """
    Build a query for fetching *just* the parent (or) child IDs of a file,
    and the file itself. The query returned is to be combined with another query to actually
    fetch file or file information (see :func:`get_file_hierarchy_query`).

    :param filter: WHERE for finding the desired file (i.e. Files.id == X)
    :param max_depth: a maximum number of parents to return (infinite recursion mitigation)
    :param files_table: a files table to use, if not the default Files model
    :param projects_table: a projects table to use, if not the default Projects model
    :return: a hierarchy CTE query
    """
    get_children = direction == 'children'
    assert get_children or direction == 'parents'

    # This CTE gets the child and then joins all parents of the child, getting us
    # the whole hierarchy. We need the whole hierarchy to (1) determine the
    # project (projects have one root level directory), (2) determine the
    # permissions assigned by every level above, and the (3) full
    # filesystem path of the target file or directory

    q_hierarchy = db.session.query(
        files_table.id,
        files_table.parent_id,
        projects_table.id.label('project_id'),
        # If are querying several files, we need to track what file a
        # hierarchy is for, so we put the file ID in initial_id
        files_table.id.label('initial_id'),
        # The level is a depth counter, which is useful for sorting the results
        # and also to provide in a basic infinite recursion mitigation
        db.literal(0).label('level')
    ) \
        .outerjoin(projects_table, projects_table.root_id == files_table.id) \
        .filter(filter) \
        .cte(recursive=True)

    t_parent = db.aliased(q_hierarchy, name="parent")  # Names help debug the query
    t_children = db.aliased(files_table, name="child")

    relationship = t_children.parent_id == t_parent.c.id if \
        get_children else t_children.id == t_parent.c.parent_id

    q_hierarchy = q_hierarchy.union_all(
        db.session.query(
            t_children.id,
            t_children.parent_id,
            projects_table.id.label('project_id'),
            t_parent.c.initial_id,
            (t_parent.c.level + 1).label("level")
        ).outerjoin(
            projects_table,
            projects_table.root_id == t_children.id
        ).filter(
            relationship,
            t_parent.c.level < max_depth
        ))  # len(results) will max at (max_depth + 1)

    # The returned hierarchy doesn't provide any permissions or project information --
    # it only provides a sequence of file IDs (and related hierarchy information)
    # that can be joined onto a query

    return q_hierarchy


def build_file_parents_cte(filter, max_depth=Files.MAX_DEPTH,
                           files_table=Files, projects_table=Projects) -> BaseQuery:
    """
    Build a query for fetching *just* the parent IDs of a file, and the file itself.
    The query returned is to be combined with another query to actually
    fetch file or file information (see :func:`get_file_hierarchy_query`).

    :param filter: WHERE for finding the desired file (i.e. Files.id == X)
    :param max_depth: a maximum number of parents to return (infinite recursion mitigation)
    :param files_table: a files table to use, if not the default Files model
    :param projects_table: a projects table to use, if not the default Projects model
    :return: a hierarchy CTE query
    """
    return _build_file_cte('parents', filter, max_depth, files_table, projects_table)


def build_file_children_cte(filter, max_depth=Files.MAX_DEPTH,
                            files_table=Files, projects_table=Projects) -> BaseQuery:
    """
    Build a query for fetching *just* the child IDs of a file, and the file itself.
    The query returned is to be combined with another query to actually
    fetch file or file information (see :func:`get_file_hierarchy_query`).

    :param filter: WHERE for finding the desired file (i.e. Files.id == X)
    :param max_depth: a maximum number of parents to return (infinite recursion mitigation)
    :param files_table: a files table to use, if not the default Files model
    :param projects_table: a projects table to use, if not the default Projects model
    :return: a hierarchy CTE query
    """
    return _build_file_cte('children', filter, max_depth, files_table, projects_table)


def join_projects_to_parents_cte(q_hierarchy: Query):
    """
    Using the query from :func:`get_get_file_parent_hierarchy_query`, this methods joins
    the project ID for the initial file row(s), provided the top-most parent (root) of
    that initial file row has a project.

    :param q_hierarchy: the hierarchy query
    :return: a new query
    """
    return db.session.query(
        q_hierarchy.c.initial_id,
        db.func.max(q_hierarchy.c.project_id).label('project_id'),
    ) \
        .select_from(q_hierarchy) \
        .group_by(q_hierarchy.c.initial_id) \
        .subquery()


def build_file_hierarchy_query(condition, projects_table, files_table,
                               include_deleted_projects=False,
                               include_deleted_files=False,
                               file_attr_excl=None):
    """
    Build a query for fetching a file, its parents, and the related project(s), while
    (optionally) excluding deleted projects and deleted projects.

    :param condition: the condition to limit the files returned
    :param projects_table: a reference to the projects table used in the query
    :param files_table: a reference to the files table used in the query
    :param include_deleted_projects: whether to include deleted projects
    :param file_attr_excl: list of file attributes to exclude from the query
    :return: a query
    """

    # Goals:
    # - Remove deleted files (done in recursive CTE)
    # - Remove deleted projects (done in main query)
    # - Fetch permissions (done in main query)
    # Do it in one query efficiently

    # Fetch the target file and its parents
    q_hierarchy = build_file_parents_cte(and_(
        condition,
        *([files_table.deleted_date.is_(None)] if include_deleted_files else []),
    ))

    # Only the top-most directory has a project FK, so we need to reorganize
    # the query results from the CTE so we have a project ID for every file row
    q_hierarchy_project = join_projects_to_parents_cte(q_hierarchy)

    t_parent_files = aliased(files_table)

    # By default, we query for all columns within the File table.
    if file_attr_excl:
        col_defer = [defer(attr) for attr in file_attr_excl]
    else:
        col_defer = []

    # Main query
    query = db.session.query(files_table,  # Warning: Do not change this order, but you can add
                             q_hierarchy.c.initial_id,
                             q_hierarchy.c.level,
                             projects_table) \
        .join(q_hierarchy, q_hierarchy.c.id == files_table.id) \
        .join(q_hierarchy_project, q_hierarchy_project.c.initial_id == q_hierarchy.c.initial_id) \
        .join(projects_table, projects_table.id == q_hierarchy_project.c.project_id) \
        .outerjoin(t_parent_files, t_parent_files.id == files_table.parent_id) \
        .options(
            contains_eager(files_table.parent, alias=t_parent_files).options(*col_defer),
            *col_defer,
        ) \
        .order_by(q_hierarchy.c.level)

    if not include_deleted_projects:
        query = query.filter(projects_table.deletion_date.is_(None))

    return query


# noinspection DuplicatedCode
def add_file_user_role_columns(query, file_table, user_id, role_names=None, column_format=None,
                               access_override=False):
    """
    Add columns to a query for fetching the value of the provided roles for the
    provided user ID for files in the provided file table.

    :param query: the query to modify
    :param file_table: the file table
    :param role_names: a list of roles to check
    :param user_id: the user ID to check for
    :param column_format: the format for the name of the column, where {} is the role name
    :parameter access_override: if true, give full access
    :return: the new query
    """

    role_names = role_names if role_names is not None else [
        'file-read',
        'file-write',
        'file-comment'
    ]
    column_format = column_format if column_format is not None else f'has_{{}}_{user_id}'

    for role_name in role_names:
        if access_override:
            query = query.add_column(literal(True).label(column_format.format(role_name)))
        else:
            t_role = db.aliased(AppRole)
            t_user = db.aliased(AppUser)

            file_role_sq = db.session.query(file_collaborator_role, t_role.name) \
                .join(t_role, t_role.id == file_collaborator_role.c.role_id) \
                .join(t_user, t_user.id == file_collaborator_role.c.collaborator_id) \
                .subquery()

            query = query \
                .outerjoin(file_role_sq, and_(file_role_sq.c.file_id == file_table.id,
                                              file_role_sq.c.collaborator_id == user_id,
                                              file_role_sq.c.name == role_name)) \
                .add_column(file_role_sq.c.name.isnot(None).label(column_format.format(role_name)))

    return query


def get_nondeleted_recycled_children_query(
        filter,
        children_filter=None,
        lazy_load_content=False
):
    """
    Retrieve all files that match the provided filter, including the children of those
    files, even if those children do not match the filter. The files returned by
    this method do not have complete information to determine permissions.

    :param filter: the SQL Alchemy filter
    :param lazy_load_content: whether to load the file's content into memory
    :return: the result, which may be an empty list
    """
    q_hierarchy = build_file_children_cte(and_(
        filter,
        Files.deletion_date.is_(None)
    ))

    t_parent_files = aliased(Files)

    query = db.session.query(Files) \
        .join(q_hierarchy, q_hierarchy.c.id == Files.id) \
        .outerjoin(t_parent_files, t_parent_files.id == Files.parent_id) \
        .options(
            raiseload('*'),
            contains_eager(Files.parent, alias=t_parent_files),
            joinedload(Files.user),
            joinedload(Files.fallback_organism)) \
        .order_by(q_hierarchy.c.level)

    if children_filter is not None:
        query = query.filter(children_filter)

    if lazy_load_content:
        query = query.options(lazyload(Files.content))

    return query


class FileHierarchy:
    """
    This class can be used to populate the calculated fields on the Files model (like project,
    privileges, etc.). This class uses the query results returned by
    :func:`build_file_hierarchy_query` that are returned in a specific way
    (aka has the right queried columns).
    """

    def __init__(self, results, file_table, project_table):
        self.results = [row._asdict() for row in results]
        self.file_table = file_table
        self.project_table = project_table
        self.file_key = inspect(self.file_table).name
        self.project_key = inspect(self.project_table).name

        self.project_calculator = ProjectCalculator(results[0], self.project_table)

        if self.project_key is None or self.file_key is None:
            raise RuntimeError("the file_table or project_table need to be aliased")

    @property
    def project(self) -> Projects:
        return self.results[0][self.project_key]

    @property
    def file(self) -> Files:
        return self.results[0][self.file_key]

    def calculate_properties(self, user_ids):
        self.project_calculator.calculate_privileges(user_ids)
        self.file.calculated_project = self.project_calculator.project

        parent_deleted = False
        parent_recycled = False

        for row in reversed(self.results):
            file: Files = row[self.file_key]

            file.calculated_parent_deleted = parent_deleted
            file.calculated_parent_recycled = parent_recycled

            parent_deleted = parent_deleted or file.deleted
            parent_recycled = parent_recycled or file.recycled

    def calculate_privileges(self, user_ids):
        parent_file: Optional[Files] = None

        # We need to iterate through the files from parent to child because
        # permissions are inherited and must be calculated in that order
        for row in reversed(self.results):
            file: Files = row[self.file_key]

            for user_id in user_ids:
                project_manageable = row[f'has_project-admin_{user_id}']
                project_readable = row[f'has_project-read_{user_id}']
                project_writable = row[f'has_project-write_{user_id}']
                file_readable = row[f'has_file-read_{user_id}']
                file_writable = row[f'has_file-write_{user_id}']
                file_commentable = row[f'has_file-comment_{user_id}']
                parent_privileges = parent_file.calculated_privileges[
                    user_id] if parent_file else None

                commentable = any([
                    project_manageable,
                    project_readable and project_writable,
                    file_commentable,
                    parent_privileges and parent_privileges.commentable,
                ])
                writable = any([
                    project_manageable,
                    project_writable,
                    file_writable,
                    parent_privileges and parent_privileges.writable,
                    ])
                readable = commentable or writable or any([
                    project_manageable,
                    project_readable,
                    file_readable,
                    file.public,
                    parent_privileges and parent_privileges.readable,
                ])
                commentable = commentable or writable

                privileges = FilePrivileges(
                    readable=readable,
                    writable=writable,
                    commentable=commentable,
                )

                file.calculated_privileges[user_id] = privileges

            parent_file = file
