import html
import re
from typing import List, Optional


from flask import Blueprint, current_app, jsonify, g
from flask_apispec import use_kwargs
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.projects import ProjectBaseView
from neo4japp.constants import FILE_INDEX_ID, FRAGMENT_SIZE, LogEventType
from neo4japp.blueprints.filesystem import FilesystemBaseView
from neo4japp.data_transfer_objects.common import ResultQuery
from neo4japp.database import (
    get_search_service_dao,
    get_elastic_service,
    get_file_type_service
)
from neo4japp.exceptions import ServerException
from neo4japp.models import (
    Files,
    Projects,
)
from neo4japp.schemas.common import PaginatedRequestSchema
from neo4japp.schemas.search import (
    ContentSearchSchema,
    ContentSearchResponseSchema,
    OrganismSearchSchema,
    SynonymSearchSchema,
    SynonymSearchResponseSchema,
    VizSearchSchema,
)
from neo4japp.services.file_types.providers import (
    DirectoryTypeProvider,
)
from neo4japp.util import jsonify_with_class, SuccessResponse

from neo4japp.utils.logger import EventLog, UserEventLog
from neo4japp.utils.request import Pagination

bp = Blueprint('search', __name__, url_prefix='/search')


@bp.route('/viz-search', methods=['POST'])
@auth.login_required
@use_kwargs(VizSearchSchema)
def visualizer_search(
        query,
        page,
        limit,
        domains,
        entities,
        organism
):
    search_dao = get_search_service_dao()
    current_app.logger.info(
        f'Term: {query}, Organism: {organism}, Entities: {entities}, Domains: {domains}',
        extra=UserEventLog(
            username=g.current_user.username,
            event_type=LogEventType.VISUALIZER_SEARCH.value).to_dict()
    )

    results = search_dao.visualizer_search(
        term=query,
        organism=organism,
        page=page,
        limit=limit,
        domains=domains,
        entities=entities,
    )
    return jsonify({
        'result': results.to_dict(),
    })


# Start Search Helpers #

def content_search_params_are_empty(params):
    """
    Checks if the given content search params are completely empty. We do checking on
    specific fields, because for some options we don't want to execute a search if only that option
    is present. E.g., a request with only the `synonyms` option doesn't make sense.
    """
    if 'q' in params and params['q']:
        return False
    elif 'types' in params and params['types']:
        return False
    elif 'folders' in params and params['folders']:
        return False
    return True


def get_types_from_params(q, advanced_args):
    """
    Adds "types" filters to `q` for each type specified in `advanced_args`, or returns `q`
    unmodified if `types` was not present or empty.
    """
    types = []
    try:
        if advanced_args['types'] != '':
            types = advanced_args['types'].split(';')
        return f'{q} ({" OR ".join([f"type:{t}" for t in types])})' if len(types) else q
    except KeyError:
        return q


def get_folders_from_params(advanced_args):
    """
    Extracts and returns the list of file hash IDs from the input `advanced_args`. `folders` is an
    expected property on `advanced_args`, if it does not exist, or it is empty, then an empty list
    is returned instead.
    """
    try:
        if advanced_args['folders'] != '':
            return advanced_args['folders'].split(';')
        else:
            return []
    except KeyError:
        return []


def get_filepaths_filter(accessible_folders: List[Files], accessible_projects: List[Projects]):
    """
    Generates an elastic boolean query which filters documents based on folder/project access. Takes
    as input two options:
        - accessible_folders: a list of Files objects representing folders to be included in the
        query
        - accessible_projects: a list of Projects objects representing projects to be included in
        the query
    Any files present in accessible_folders which are not children of accessible_projects will be
    ignored, and returned along with the query.
    """
    accessible_projects_ids = [
        project.id
        for project in accessible_projects
    ]

    filepaths = []
    for file in accessible_folders:
        filepaths.append(file.filename_path)

    if len(filepaths):
        return {
            'bool': {
                'should': [
                    {
                        "term": {
                            "file_path.tree": file_path
                        }
                    }
                    for file_path in filepaths
                ]
            }
        }
    else:
        # If there were no accessible filepaths in the given list, search all accessible projects
        return {
            'bool': {
                'should': [
                    # If the user has access to the project the document is in...
                    {'terms': {'project_id': accessible_projects_ids}},
                    # OR if the document is public.
                    {'term': {'public': True}}
                ]
            }
        }

# End Search Helpers #


class ContentSearchView(ProjectBaseView, FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(ContentSearchSchema)
    @use_args(PaginatedRequestSchema)
    def get(self, params: dict, pagination: Pagination):
        current_app.logger.info(
            f'Term: {params["q"]}',
            extra=UserEventLog(
                username=g.current_user.username,
                event_type=LogEventType.CONTENT_SEARCH.value).to_dict()
        )

        current_user = g.current_user
        file_type_service = get_file_type_service()

        if content_search_params_are_empty(params):
            return jsonify(ContentSearchResponseSchema(context={
                'user_privilege_filter': g.current_user.id,
            }).dump({
                'total': 0,
                'query': ResultQuery(phrases=[]),
                'results': [],
            }))

        offset = (pagination.page - 1) * pagination.limit

        q = params['q']
        q = get_types_from_params(q, params)
        folders = get_folders_from_params(params)

        # Set the search term once we've parsed the params for all advanced options
        user_search_query = q.strip()

        text_fields = ['description', 'data.content', 'filename']
        text_field_boosts = {'description': 1, 'data.content': 1, 'filename': 3}
        highlight = {
            'fields': {
                'data.content': {},
            },
            # Need to be very careful with this option. If fragment_size is too large, search
            # will be slow because elastic has to generate large highlight fragments. Setting
            # to 0 generates cleaner sentences, but also runs the risk of pulling back huge
            # sentences.
            'fragment_size': FRAGMENT_SIZE,
            'order': 'score',
            'pre_tags': ['@@@@$'],
            'post_tags': ['@@@@/$'],
            'number_of_fragments': 100,
        }

        EXCLUDE_FIELDS = ['enrichment_annotations', 'annotations']
        # Gets the full list of projects accessible by the current user.
        accessible_projects, _ = self.get_nondeleted_projects(None, accessible_only=True)
        # Gets the full list of folders accessible by the current user.
        accessible_folders = self.get_nondeleted_recycled_files(
            Files.hash_id.in_(folders),
            attr_excl=EXCLUDE_FIELDS
        )
        accessible_folder_hash_ids = [folder.hash_id for folder in accessible_folders]
        dropped_folders = [folder for folder in folders if folder not in accessible_folder_hash_ids]
        filepaths_filter = get_filepaths_filter(
            accessible_folders,
            accessible_projects
        )
        # These are the document fields that will be returned by elastic
        return_fields = ['id']

        filter_ = [
            # The file must be accessible by the user, and in the specified list of
            # filepaths or public if no list is given...
            filepaths_filter,
            # ...And it shouldn't be a directory. Right now there's not really any helpful info
            # attached to directory type documents (including a filename, for top-level
            # directories), so instead just ignore them.
            {
                'bool': {
                    'must_not': [
                        {'term': {'mime_type': DirectoryTypeProvider.MIME_TYPE}}
                    ]
                }
            }
        ]

        elastic_service = get_elastic_service()
        elastic_result, search_phrases = elastic_service.search(
            index_id=FILE_INDEX_ID,
            user_search_query=user_search_query,
            offset=offset,
            limit=pagination.limit,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            return_fields=return_fields,
            filter_=filter_,
            highlight=highlight
        )

        elastic_result = elastic_result['hits']

        highlight_tag_re = re.compile('@@@@(/?)\\$')

        # So while we have the results from Elasticsearch, they don't contain up to date or
        # complete data about the matched files, so we'll take the hash IDs returned by Elastic
        # and query our database
        file_ids = [doc['fields']['id'][0] for doc in elastic_result['hits']]
        file_map = {
            file.id: file
            for file in self.get_nondeleted_recycled_files(
                Files.id.in_(file_ids),
                attr_excl=['enrichment_annotations', 'annotations']
            )
        }

        results = []
        for document in elastic_result['hits']:
            file_id = document['fields']['id'][0]
            file: Optional[Files] = file_map.get(file_id)

            if file and file.calculated_privileges[current_user.id].readable:
                file_type = file_type_service.get(file)
                if file_type.should_highlight_content_text_matches() and \
                        document.get('highlight') is not None:
                    if document['highlight'].get('data.content') is not None:
                        snippets = document['highlight']['data.content']
                        for i, snippet in enumerate(snippets):
                            snippet = html.escape(snippet)
                            snippet = highlight_tag_re.sub('<\\1highlight>', snippet)
                            snippets[i] = f"<snippet>{snippet}</snippet>"
                        file.calculated_highlight = snippets

                results.append({
                    'item': file,
                    'rank': document['_score'],
                })

        return jsonify(ContentSearchResponseSchema(context={
            'user_privilege_filter': g.current_user.id,
        }).dump({
            'total': elastic_result['total'],
            'query': ResultQuery(phrases=search_phrases),
            'results': results,
            'dropped_folders': dropped_folders
        }))


class SynonymSearchView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(SynonymSearchSchema)
    @use_args(PaginatedRequestSchema)
    def get(self, params, pagination: Pagination):
        search_term = params.get('term', None)

        organisms = []
        if len(params['organisms']):
            organisms = params['organisms'].split(';')

        types = []
        if len(params['types']):
            types = params['types'].split(';')

        if search_term is None:
            return jsonify(SynonymSearchResponseSchema().dump({
                'data': [],
            }))

        page = pagination.page
        limit = pagination.limit
        offset = (page - 1) * limit

        try:
            search_dao = get_search_service_dao()
            results = search_dao.get_synonyms(search_term, organisms, types, offset, limit)
            count = search_dao.get_synonyms_count(search_term, organisms, types)
        except Exception as e:
            current_app.logger.error(
                f'Failed to get synonym data for term: {search_term}',
                exc_info=e,
                extra=EventLog(event_type=LogEventType.CONTENT_SEARCH.value).to_dict()
            )
            raise ServerException(
                title='Unexpected error during synonym search',
                message='A system error occurred while searching for synonyms, we are ' +
                        'working on a solution. Please try again later.'
            )

        return jsonify(SynonymSearchResponseSchema().dump({
            'data': results,
            'count': count
        }))


bp.add_url_rule('content', view_func=ContentSearchView.as_view('content_search'))
bp.add_url_rule('synonyms', view_func=SynonymSearchView.as_view('synonym_search'))


@bp.route('/organism/<string:organism_tax_id>', methods=['GET'])
@auth.login_required
@jsonify_with_class()
def get_organism(organism_tax_id: str):
    search_dao = get_search_service_dao()
    result = search_dao.get_organism_with_tax_id(organism_tax_id)
    return SuccessResponse(result=result, status_code=200)


@bp.route('/organisms', methods=['POST'])
@auth.login_required
@use_kwargs(OrganismSearchSchema)
def get_organisms(query, limit):
    search_dao = get_search_service_dao()
    results = search_dao.get_organisms(query, limit)
    return jsonify({'result': results})
