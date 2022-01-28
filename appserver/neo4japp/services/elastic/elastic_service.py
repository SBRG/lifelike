import base64

from elasticsearch.exceptions import RequestError as ElasticRequestError
from elasticsearch.helpers import parallel_bulk, streaming_bulk
from flask import current_app
from io import BytesIO
import json

from pyparsing import (
    CaselessLiteral,
    Optional,
    ParserElement,
    QuotedString,
    Word,
    ZeroOrMore,
    infixNotation,
    opAssoc,
    printables,
)
from sqlalchemy import and_
from sqlalchemy.orm import joinedload, raiseload
from typing import (
    Any,
    Dict,
    List,
)

from neo4japp.constants import FILE_INDEX_ID, LogEventType
from neo4japp.database import get_file_type_service, ElasticConnection, GraphConnection
from neo4japp.exceptions import ServerException
from neo4japp.models import (
    Files, Projects,
)
from neo4japp.models.files_queries import build_file_hierarchy_query
from neo4japp.services.elastic import (
    ATTACHMENT_PIPELINE_ID,
    ELASTIC_INDEX_SEED_PAIRS,
    ELASTIC_PIPELINE_SEED_PAIRS,
)
from neo4japp.services.elastic.query_parser_helpers import (
    BoolMust,
    BoolMustNot,
    BoolOperand,
    BoolShould
)
from neo4japp.utils import EventLog
from app import app

ParserElement.enablePackrat()


class ElasticService(ElasticConnection, GraphConnection):
    # Begin indexing methods
    def update_or_create_index(self, index_id, index_mapping_file):
        """Creates an index with the given index id and mapping file. If the index already exists,
        we update it and re-index any documents using that index."""
        with open(index_mapping_file) as f:
            index_definition_data = f.read()
        index_definition = json.loads(index_definition_data)

        if self.elastic_client.indices.exists(index_id):
            # Here, we delete the index and re-create it. The reason for this is that, if
            # we update the type of a field in the index, elastic will complain and fail to update
            # the index. So to prevent this from happening, we just trash the index and re-create
            # it.
            try:
                self.elastic_client.indices.delete(index=index_id)
                current_app.logger.info(
                    f'Deleted ElasticSearch index {index_id}',
                    extra=EventLog(event_type=LogEventType.ELASTIC.value).to_dict()
                )
            except Exception as e:
                current_app.logger.error(
                    f'Failed to delete ElasticSearch index {index_id}',
                    exc_info=e,
                    extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
                )
                return

        try:
            self.elastic_client.indices.create(index=index_id, body=index_definition)
            current_app.logger.info(
                f'Created ElasticSearch index {index_id}',
                extra=EventLog(event_type=LogEventType.ELASTIC.value).to_dict()
            )
        except Exception as e:
            current_app.logger.error(
                f'Failed to create ElasticSearch index {index_id}',
                exc_info=e,
                extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
            )
            return

        # If we trash the index we also need to re-index all the documents that used it.
        # Currently we take the safe route and simply re-index ALL documents, regardless of
        # which index was actually re-created.
        self.reindex_all_documents()

    def update_or_create_pipeline(self, pipeline_id, pipeline_definition_file):
        """Creates a pipeline with the given pipeline id and definition file. If the pipeline
        already exists, we update it."""
        with open(pipeline_definition_file) as f:
            pipeline_definition = f.read()
        pipeline_definition_json = json.loads(pipeline_definition)

        try:
            self.elastic_client.ingest.put_pipeline(id=pipeline_id, body=pipeline_definition_json)
        except Exception as e:
            current_app.logger.error(
                f'Failed to create or update ElasticSearch pipeline {pipeline_id}',
                exc_info=e,
                extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
            )
            return

        current_app.logger.info(
            f'Created or updated ElasticSearch pipeline {pipeline_id}',
            extra=EventLog(event_type=LogEventType.ELASTIC.value).to_dict()
        )

    def recreate_indices_and_pipelines(self):
        """Recreates all currently defined Elastic pipelines and indices. If any indices/pipelines
        do not exist, we create them here. If an index/pipeline does exist, we update it."""
        for (pipeline_id, pipeline_definition_file) in ELASTIC_PIPELINE_SEED_PAIRS:
            self.update_or_create_pipeline(pipeline_id, pipeline_definition_file)

        for (index_id, index_mapping_file) in ELASTIC_INDEX_SEED_PAIRS:
            self.update_or_create_index(index_id, index_mapping_file)
        return 'done'

    def reindex_all_documents(self):
        self.index_files()

    def update_files(self, hash_ids: List[str] = None):
        raise NotImplementedError()

    def delete_files(self, hash_ids: List[str]):
        self._streaming_bulk_documents([
            self._get_delete_obj(hash_id, FILE_INDEX_ID)
            for hash_id in hash_ids
        ])
        self.elastic_client.indices.refresh(FILE_INDEX_ID)

    def index_files(self, hash_ids: List[str] = None, batch_size: int = 100):
        """
        Adds the files with the given ids to Elastic. If no IDs are given,
        all non-deleted files will be indexed.
        :param ids: a list of file table IDs (integers)
        :param batch_size: number of documents to index per batch
        """
        filters = [
            Files.deletion_date.is_(None),
            Files.recycling_date.is_(None),
        ]

        if hash_ids is not None:
            filters.append(Files.hash_id.in_(hash_ids))

        # Gets the file/project pairs -- plus _all_ parents -- for the given file ids
        query = self._get_file_hierarchy_query(
            and_(*filters)
        )

        # Removes any unnecessary parent rows, we only need to index what was given in hash_ids,
        # if anything
        if hash_ids is not None:
            query = query.filter(
                Files.hash_id.in_(hash_ids)
            )

        # Just return Files and Projects data, we don't care about any other columns
        query = query.with_entities(Files, Projects)

        self._streaming_bulk_documents(
            self._lazy_create_index_docs_for_streaming_bulk(
                self._windowed_query(query, Files.hash_id, batch_size)
            )
        )

    def _get_file_hierarchy_query(self, filter):
        """
        Generate the query to get files that will be indexed.
        :param filter: SQL Alchemy filter
        :return: the query
        """
        return build_file_hierarchy_query(filter, Projects, Files) \
            .options(raiseload('*'),
                     joinedload(Files.user),
                     joinedload(Files.content))

    def _windowed_query(self, q, column, windowsize):
        """"Break a Query into chunks on a given column."""

        single_entity = q.is_single_entity
        q = q.add_column(column).order_by(column)
        last_id = None

        while True:
            subq = q
            if last_id is not None:
                subq = subq.filter(column > last_id)
            chunk = subq.limit(windowsize).all()
            if not chunk:
                break
            last_id = chunk[-1][-1]
            for row in chunk:
                if single_entity:
                    yield row[0]
                else:
                    yield row[0:-1]

    def _transform_data_for_indexing(self, file: Files) -> BytesIO:
        """
        Get the file's contents in a format that can be indexed by Elastic, or is
        better indexed by Elatic.
        :param file: the file
        :return: the bytes to send to Elastic
        """
        if file.content:
            content = file.content.raw_file
            file_type_service = get_file_type_service()
            return file_type_service.get(file).to_indexable_content(BytesIO(content))
        else:
            return BytesIO()

    def _lazy_create_index_docs_for_parallel_bulk(self, batch):
        """
        Creates a generator out of the elastic document creation
        process to prevent loading everything into memory.
        :param batch: iterable of file/project pairs
        :return: indexable object in generator form
        """

        # Preserve context that is lost from threading when used
        # with the elasticsearch parallel_bulk
        with app.app_context():
            for file, project in batch:
                yield self._get_index_obj(file, project, FILE_INDEX_ID)

    def _lazy_create_index_docs_for_streaming_bulk(self, batch):
        """
        Creates a generator out of the elastic document creation
        process to prevent loading everything into memory.
        :param batch: iterable of file/project pairs
        :return: indexable object in generator form
        """
        for file, project in batch:
            yield self._get_index_obj(file, project, FILE_INDEX_ID)

    def _get_update_action_obj(self, file_hash_id: str, index_id: str, changes: dict = {}) -> dict:
        # 'filename': file.filename,
        # 'description': file.description,
        # 'uploaded_date': file.creation_date,
        # 'data': base64.b64encode(indexable_content).decode('utf-8'),
        # 'user_id': file.user_id,
        # 'username': file.user.username,
        # 'project_id': project.id,
        # 'project_hash_id': project.hash_id,
        # 'project_name': project.name,
        # 'doi': file.doi,
        # 'public': file.public,
        # 'id': file.id,
        # 'hash_id': file.hash_id,
        # 'mime_type': file.mime_type,
        # 'data_ok': data_ok,
        return {
            '_op_type': 'update',
            '_index': index_id,
            '_id': file_hash_id,
            'doc': changes,
        }

    def _get_delete_obj(self, file_hash_id: str, index_id: str) -> dict:
        return {
            '_op_type': 'delete',
            '_index': index_id,
            '_id': file_hash_id
        }

    def _get_index_obj(self, file: Files, project: Projects, index_id) -> dict:
        """
        Generate an index operation object from the given file and project
        :param file: the file
        :param project: the project that file is within
        :param index_id: the index
        :return: a document
        """
        try:
            indexable_content = self._transform_data_for_indexing(file).getvalue()
            data_ok = True
        except Exception as e:
            # We should still index the file even if we can't transform it for
            # indexing because the file won't ever appear otherwise and it will be
            # harder to track down the bug
            indexable_content = b''
            data_ok = False

            # TODO: Threading caused us to lose context, but we should rethink
            # how we do logging. Do we actually need to use the app_context?
            current_app.logger.error(
                f'Failed to generate indexable data for file '
                f'#{file.id} (hash={file.hash_id}, mime type={file.mime_type})',
                exc_info=e,
                extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
            )

        return {
            '_index': index_id,
            'pipeline': ATTACHMENT_PIPELINE_ID,
            '_id': file.hash_id,
            '_source': {
                'filename': file.filename,
                'file_path': file.filename_path,
                'description': file.description,
                'uploaded_date': file.creation_date,
                'data': base64.b64encode(indexable_content).decode('utf-8'),
                'user_id': file.user_id,
                'username': file.user.username,
                'project_id': project.id,
                'project_hash_id': project.hash_id,
                'project_name': project.name,
                'doi': file.doi,
                'public': file.public,
                'id': file.id,
                'hash_id': file.hash_id,
                'mime_type': file.mime_type,
                'data_ok': data_ok,
            }
        }

    def _parallel_bulk_documents(self, documents):
        """
        Performs a series of bulk operations in elastic, determined by the `documents` input.
        These operations are executed in parallel, on 4 threads by default.
        """
        # `raise_on_exception` set to False so that we don't error out if one of the documents
        # fails to index
        results = parallel_bulk(
            self.elastic_client,
            documents,
            raise_on_error=False,
            raise_on_exception=False
        )

        for success, info in results:
            # TODO: Evaluate the data egress size. When seeding the staging database
            # locally, this could output ~1gb of data. Question: Should we conditionally
            # turn this off?
            if success:
                current_app.logger.info(
                    f'Elastic search bulk operation succeeded: {info}',
                    extra=EventLog(event_type=LogEventType.ELASTIC.value).to_dict()
                )
            else:
                current_app.logger.warning(
                    f'Elastic search bulk operation failed: {info}',
                    extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
                )

    def _streaming_bulk_documents(self, documents):
        """
        Performs a series of bulk operations in elastic, determined by the `documents` input.
        These operations are done in series.
        """
        # `raise_on_exception` set to False so that we don't error out if one of the documents
        # fails to index
        results = streaming_bulk(
            client=self.elastic_client,
            actions=documents,
            max_retries=5,
            raise_on_error=False,
            raise_on_exception=False
        )

        for success, info in results:
            # TODO: Evaluate the data egress size. When seeding the staging database
            # locally, this could output ~1gb of data. Question: Should we conditionally
            # turn this off?
            if success:
                current_app.logger.info(
                    f'Elastic search bulk operation succeeded: {info}',
                    extra=EventLog(event_type=LogEventType.ELASTIC.value).to_dict()
                )
            else:
                current_app.logger.warning(
                    f'Elastic search bulk operation failed: {info}',
                    extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
                )

    # End indexing methods

    # Begin search methods
    def _strip_unmatched_parens(self, s: str) -> str:
        open_paren_indexes = []
        close_paren_indexes = []
        in_quoted_phrase = False
        for i, char in enumerate(s):
            if char == '"':
                in_quoted_phrase = not in_quoted_phrase
                continue
            if in_quoted_phrase:
                continue
            if char == '(':
                open_paren_indexes.append(i)
            if char == ')':
                if len(open_paren_indexes):
                    open_paren_indexes.pop()
                else:
                    close_paren_indexes.append(i)

        unmatched_parens = open_paren_indexes + close_paren_indexes
        unmatched_parens.sort()
        for i, idx in enumerate(unmatched_parens):
            s = s[:idx - i] + s[idx - i + 1:]

        return s

    def _strip_unmatched_quotations(self, s: str) -> str:
        if (s.count('"') % 2 == 1):
            odd_quote_idx = s.rfind('"')
            return s[:odd_quote_idx] + s[odd_quote_idx + 1:]
        return s

    def _strip_unmatched_characters(self, s: str) -> str:
        s = self._strip_unmatched_quotations(s)
        s = self._strip_unmatched_parens(s)
        return s

    def _strip_reserved_characters(self, s: str) -> str:
        """Strips "reserved" characters from the input string and returns the new string. Currently
        this only includes open and closed parentheses, but may include additional characters in
        the future.

        Args:
            s (str): String to strip reserved characters from.

        Returns:
            (str): The input string stripped of all reserved characters.
        """

        # Remove all parens
        s = ''.join([c for c in s if c not in ['(', ')']])
        return s

    def _get_words_phrases_and_wildcards(self, string):
        """
        Extracts all word, phrase, and wildcard tokens from the given input string. Duplicates are
        removed, and the keywords "and," "not," and "or" are discarded.
        """
        if not len(string):
            return []

        string = self._strip_unmatched_characters(string)

        token = QuotedString('"', unquoteResults=False) | Word(printables)
        parser = ZeroOrMore(token)

        unique_non_keyword_tokens = list(set([
                t for t in list(parser.parseString(string))
                if t.lower() not in ['and', 'not', 'or']
            ])
        )

        words_phrases_and_wildcards = []
        for token in unique_non_keyword_tokens:
            if '"' in token:
                # Token is a phrase, with '"' as the first and last characters. *Don't* remove
                # punctuation!
                words_phrases_and_wildcards.append(token[1:-1])
            else:
                token = self._strip_reserved_characters(token).strip()
                if len(token):
                    words_phrases_and_wildcards.append(token)

        return words_phrases_and_wildcards

    def _pre_process_query(self, query):
        """
        Given a user-generated query string, returns a new string in a psuedo-Lucene grammar. The
        user-generated query is expected to be a space-delimited list of search terms, operators,
        and filters.

        The output of this function is expected to be used as the input to the parser generated by
        `_get_query_parser` below.
        """
        query = self._strip_unmatched_characters(query)

        open_parens = Word('(')
        closed_parens = Word(')')
        term = term = Word(printables)
        # Need to include these optional parens, otherwise something like '(r and "p and q")' will
        # be tokenized as ['(r', 'and', '"p', 'and', 'q")']
        quoted_term = QuotedString('"', unquoteResults=False)
        quoted_term_with_parens = Optional(open_parens) + quoted_term + Optional(closed_parens)
        quoted_term_with_parens.setParseAction(''.join)
        operand = quoted_term_with_parens | term
        query_parser = ZeroOrMore(operand)

        unstackable_logical_ops = ['and', 'or']
        new_query = []
        _next = None
        tokens = list(query_parser.parseString(query))
        for i, curr in enumerate(tokens):
            # If we're at the last element in the list, just add it to the new list of tokens.
            if i == len(tokens) - 1:
                new_query += [curr]
                continue

            _next = tokens[i + 1]

            if curr in ['(', ')']:
                new_query += [curr]
            elif curr.lower() == 'not':
                if _next.lower() in unstackable_logical_ops:
                    raise ServerException(
                        title='Content Search Error',
                        message='Your query appears malformed. A logical operator (AND/OR) was ' +
                                'encountered immediately following a NOT operator, e.g. ' +
                                '"dog not and cat." Please examine your query for possible ' +
                                'errors and try again.',
                        code=400
                    )
                new_query += [curr]
            elif curr.lower() in unstackable_logical_ops:
                if _next.lower() in unstackable_logical_ops:
                    raise ServerException(
                        title='Content Search Error',
                        message='Your query appears malformed. Two logical operators (AND/OR) ' +
                                'were encountered in succession, e.g. "dog and and cat." Please ' +
                                'examine your query for possible errors and try again.',
                        code=400
                    )
                new_query += [curr]
            elif _next.lower() not in unstackable_logical_ops + [')']:
                new_query += [curr, 'and']
            else:
                new_query += [curr]
        return ' '.join(new_query)

    def _get_query_parser(
        self,
        text_fields: List[str],
        text_field_boosts: Dict[str, int],
    ):
        """
        Generates a parser which expects a pseudo-Lucene query string, and returns an object
        representing:

        - A simple Elastic match query in the case of a single term
        - An Elastic bool query in the case of a logical expression

        See the helper classes in `query_parser_helpers.py` for the object structure.
        """
        boolOperand = QuotedString('"', unquoteResults=False) | Word(printables, excludeChars='()')
        boolOperand.setParseAction(
            lambda token: BoolOperand(
                token,
                text_fields,
                text_field_boosts
            ),
        )

        # Define expression, based on expression operand and list of operations in precedence order
        boolExpr = infixNotation(
            boolOperand,
            [
                (CaselessLiteral('not'), 1, opAssoc.RIGHT, BoolMustNot),
                (CaselessLiteral('and'), 2, opAssoc.LEFT, BoolMust),
                (CaselessLiteral('or'), 2, opAssoc.LEFT, BoolShould),
            ],
        )

        return boolExpr

    def _build_query_clause(
        self,
        user_search_query: str,
        text_fields: List[str],
        text_field_boosts: Dict[str, int],
        return_fields: List[str],
        filter_: List[Any],
        highlight: Dict[Any, Any],
    ):
        """
        Given a user-generated query string and Elastic match option objects, generates an Elastic
        match object.
        """
        if user_search_query == '':
            # Even if the user_search_query is empty, we may still want to get results. E.g. if a
            # user is looking only for content in a specific folder.
            return {
                'query': {
                    'bool': {
                        'must': filter_,
                    }
                },
                'fields': return_fields,
                'highlight': highlight,
                # Set `_source` to False so we only return the properties specified in `fields`
                '_source': False,
            }, []

        words_phrases_and_wildcards = self._get_words_phrases_and_wildcards(user_search_query)
        processed_query = self._pre_process_query(user_search_query)
        parser = self._get_query_parser(text_fields, text_field_boosts)
        result = parser.parseString(processed_query)[0].to_dict()

        return {
            'query': {
                'bool': {
                    'must': [result] + filter_,
                }
            },
            'fields': return_fields,
            'highlight': highlight,
            # Set `_source` to False so we only return the properties specified in `fields`
            '_source': False,
        }, words_phrases_and_wildcards

    def search(
            self,
            index_id: str,
            user_search_query: str,
            text_fields: List[str],
            text_field_boosts: Dict[str, int],
            return_fields: List[str],
            offset: int = 0,
            limit: int = 10,
            filter_=None,
            highlight=None
    ):
        es_query, search_phrases = self._build_query_clause(
            user_search_query=user_search_query,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            return_fields=return_fields,
            filter_=filter_,
            highlight=highlight,
        )

        try:
            es_response = self.elastic_client.search(
                index=index_id,
                body=es_query,
                from_=offset,
                size=limit,
                rest_total_hits_as_int=True,
            )
        except ElasticRequestError:
            raise ServerException(
                title='Content Search Error',
                message='Something went wrong during content search. Please simplify your query ' +
                        '(e.g. remove terms, filters, flags, etc.) and try again.',
                code=400
            )

        es_response['hits']['hits'] = [doc for doc in es_response['hits']['hits']]
        return es_response, search_phrases
    # End search methods
