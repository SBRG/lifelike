import csv
import hashlib
import html
import io
import json
import time

import sqlalchemy as sa

from datetime import datetime
from flask import (
    Blueprint,
    current_app,
    g,
    make_response,
    request,
    jsonify,
)
from flask.views import MethodView
from flask_apispec import use_kwargs
from json import JSONDecodeError
from marshmallow import validate, fields
from sqlalchemy import and_
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional, List, Dict, Any
from webargs.flaskparser import use_args

from .auth import auth
from .filesystem import bp as filesystem_bp, FilesystemBaseView
from .permissions import requires_role

from ..constants import LogEventType, TIMEZONE
from ..database import (
    db,
    get_excel_export_service,
    get_enrichment_table_service
)
from ..exceptions import AnnotationError, ServerException
from ..models import (
    AppUser,
    Files,
    GlobalList,
    FallbackOrganism
)
from ..schemas.formats.enrichment_tables import validate_enrichment_table
from ..models.files import AnnotationChangeCause, FileAnnotationsVersion
from ..models.files_queries import get_nondeleted_recycled_children_query
from ..schemas.annotations import (
    AnnotationGenerationRequestSchema,
    GlobalAnnotationTableType,
    MultipleAnnotationGenerationResponseSchema,
    GlobalAnnotationsDeleteSchema,
    GlobalAnnotationListSchema,
    CustomAnnotationCreateSchema,
    CustomAnnotationDeleteSchema,
    AnnotationUUIDListSchema,
    AnnotationExclusionCreateSchema,
    AnnotationExclusionDeleteSchema,
    SystemAnnotationListSchema,
    CustomAnnotationListSchema
)
from ..schemas.common import PaginatedRequestSchema
from ..schemas.enrichment import EnrichmentTableSchema
from ..schemas.filesystem import BulkFileRequestSchema
from ..services.annotations.constants import (
    DEFAULT_ANNOTATION_CONFIGS,
    EntityType,
    ManualAnnotationType,
)
from ..services.annotations.pipeline import Pipeline
from ..services.annotations.initializer import (
    get_annotation_service,
    get_annotation_db_service,
    get_annotation_graph_service,
    get_annotation_tokenizer,
    get_bioc_document_service,
    get_enrichment_annotation_service,
    get_manual_annotation_service,
    get_recognition_service,
    get_sorted_annotation_service
)
from ..services.annotations.sorted_annotation_service import (
    default_sorted_annotation,
    sorted_annotations_dict
)
from ..services.annotations.utils.graph_queries import (
    get_global_inclusions_paginated_query,
    get_global_inclusions_query,
    get_global_inclusions_count_query,
    get_delete_global_inclusion_query
)
from ..services.enrichment.data_transfer_objects import EnrichmentCellTextMapping
from ..utils.logger import UserEventLog
from ..utils.http import make_cacheable_file_response


bp = Blueprint('annotations', __name__, url_prefix='/annotations')


class FileAnnotationsView(FilesystemBaseView):
    decorators = [auth.login_required]

    def get(self, hash_id: str):
        """Fetch annotations for a file.."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

        if file.annotations:
            annotations = file.annotations['documents'][0]['passages'][0]['annotations']

            def terms_match(term_in_exclusion, term_in_annotation, is_case_insensitive):
                if is_case_insensitive:
                    return term_in_exclusion.lower() == term_in_annotation.lower()
                return term_in_exclusion == term_in_annotation

            # Add additional information for annotations that were excluded
            for annotation in annotations:
                for exclusion in file.excluded_annotations:
                    if (exclusion.get('type') == annotation['meta']['type'] and
                            terms_match(
                                exclusion.get('text', 'True'),
                                annotation.get('textInDocument', 'False'),
                                exclusion['isCaseInsensitive'])):
                        annotation['meta']['isExcluded'] = True
                        annotation['meta']['exclusionReason'] = exclusion['reason']
                        annotation['meta']['exclusionComment'] = exclusion['comment']
        else:
            annotations = []

        results = annotations + file.custom_annotations

        return jsonify(SystemAnnotationListSchema().dump({
            'results': results,
            'total': len(results),
        }))


class EnrichmentAnnotationsView(FilesystemBaseView):
    decorators = [auth.login_required]

    def get(self, hash_id: str):
        """Fetch annotations for enrichment table."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

        if file.enrichment_annotations:
            annotations = file.enrichment_annotations
        else:
            annotations = None

        return jsonify({
            'results': EnrichmentTableSchema().dump(annotations)
        })


class FileCustomAnnotationsListView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(CustomAnnotationCreateSchema)
    def post(self, params, hash_id):
        current_user = g.current_user
        manual_annotation_service = get_manual_annotation_service()

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=True)

        results = manual_annotation_service.add_inclusions(
            file, current_user, params['annotation'], params['annotate_all']
        )

        return jsonify(CustomAnnotationListSchema().dump({
            'results': results,
            'total': len(results),
        }))


class FileCustomAnnotationsDetailView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(CustomAnnotationDeleteSchema)
    def delete(self, params, hash_id, uuid):
        current_user = g.current_user
        manual_annotation_service = get_manual_annotation_service()

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=True)

        results = manual_annotation_service.remove_inclusions(
            file, current_user, uuid, params['remove_all']
        )

        return jsonify(AnnotationUUIDListSchema().dump({
            'results': results,
            'total': len(results),
        }))


class FileAnnotationExclusionsListView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(AnnotationExclusionCreateSchema)
    def post(self, params, hash_id):
        current_user = g.current_user
        manual_annotation_service = get_manual_annotation_service()

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=True)

        manual_annotation_service.add_exclusion(file, current_user, params['exclusion'])

        return jsonify({})

    @use_args(AnnotationExclusionDeleteSchema)
    def delete(self, params, hash_id):
        current_user = g.current_user
        manual_annotation_service = get_manual_annotation_service()

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=True)

        manual_annotation_service.remove_exclusion(file, current_user, params['type'],
                                                   params['text'])

        return jsonify({})


class FileAnnotationCountsView(FilesystemBaseView):
    decorators = [auth.login_required]

    def get_rows(self, files):
        manual_annotations_service = get_manual_annotation_service()

        yield [
            'entity_id',
            'type',
            'text',
            'primary_name',
            'count',
        ]

        counts = {}

        for file in files:
            annotations = manual_annotations_service.get_file_annotations(file)
            for annotation in annotations:
                key = annotation['meta']['id']
                if key not in counts:
                    counts[key] = {
                        'annotation': annotation,
                        'count': 1
                    }
                else:
                    counts[key]['count'] += 1

        count_keys = sorted(
            counts,
            key=lambda key: counts[key]['count'],
            reverse=True
        )

        for key in count_keys:
            annotation = counts[key]['annotation']
            meta = annotation['meta']
            if annotation.get('keyword', None) is not None:
                text = annotation['keyword'].strip()
            else:
                text = annotation['meta']['allText'].strip()
            yield [
                meta['id'],
                meta['type'],
                text,
                annotation.get('primaryName', '').strip(),
                counts[key]['count']
            ]

    def post(self, hash_id: str):
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)
        files = get_nondeleted_recycled_children_query(
            Files.id == file.id,
            children_filter=Files.mime_type == 'application/pdf',
            lazy_load_content=True
        ).all()

        buffer = io.StringIO()
        writer = csv.writer(buffer, delimiter="\t", quotechar='"')
        for row in self.get_rows(files):
            writer.writerow(row)

        result = buffer.getvalue().encode('utf-8')

        return make_cacheable_file_response(
            request,
            result,
            etag=hashlib.sha256(result).hexdigest(),
            filename=f'{file.filename} - Annotations.tsv',
            mime_type='text/tsv'
        )


class FileAnnotationSortedView(FilesystemBaseView):
    decorators = [auth.login_required]

    def get_rows(self, files, annotation_service):
        values = annotation_service.get_annotations(files)

        yield [
            'entity_id',
            'type',
            'text',
            'primary_name',
            'value',
        ]

        value_keys = sorted(
                values,
                key=lambda key: values[key]['value'],
                reverse=True
        )

        for key in value_keys:
            annotation = values[key]['annotation']
            meta = annotation['meta']
            if annotation.get('keyword', None) is not None:
                text = annotation['keyword'].strip()
            else:
                text = annotation['meta']['allText'].strip()
            yield [
                meta['id'],
                meta['type'],
                text,
                annotation.get('primaryName', '').strip(),
                values[key]['value']
            ]

    @use_args({
        "sort": fields.Str(
                missing=default_sorted_annotation.id,
                validate=validate.OneOf(sorted_annotations_dict)
        ),
        "hash_id": fields.Str()
    })
    def post(self, args: Dict[str, str], hash_id: str):
        sort = args['sort']
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

        buffer = io.StringIO()
        writer = csv.writer(buffer, delimiter="\t", quotechar='"')

        if file.mime_type == 'vnd.lifelike.document/enrichment-table':
            files = self.get_nondeleted_recycled_files(
                    Files.id == file.id,
                    lazy_load_content=True
            )

            annotation_service = get_sorted_annotation_service(sort, mime_type=file.mime_type)
            for row in self.get_rows(files, annotation_service):
                writer.writerow(row)
        else:
            files = get_nondeleted_recycled_children_query(
                    Files.id == file.id,
                    children_filter=and_(
                            Files.mime_type == 'application/pdf',
                            Files.recycling_date.is_(None)
                    ),
                    lazy_load_content=True
            ).all()

            annotation_service = get_sorted_annotation_service(sort)
            for row in self.get_rows(files, annotation_service):
                writer.writerow(row)

        result = buffer.getvalue().encode('utf-8')

        return make_cacheable_file_response(
                request,
                result,
                etag=hashlib.sha256(result).hexdigest(),
                filename=f'{file.filename} - {sort} - Annotations.tsv',
                mime_type='text/tsv'
        )


class FileAnnotationGeneCountsView(FileAnnotationCountsView):
    def get_rows(self, files: List[Files]):
        manual_annotations_service = get_manual_annotation_service()
        annotation_graph_service = get_annotation_graph_service()

        yield [
            'gene_id',
            'gene_name',
            'organism_id',
            'organism_name',
            'gene_annotation_count'
        ]

        gene_ids: Dict[Any, int] = {}

        for file in files:
            combined_annotations = manual_annotations_service.get_file_annotations(file)
            for annotation in combined_annotations:
                if annotation['meta']['type'] == EntityType.GENE.value:
                    gene_id = annotation['meta']['id']
                    if gene_ids.get(gene_id, None) is not None:
                        gene_ids[gene_id] += 1
                    else:
                        gene_ids[gene_id] = 1

        gene_organism_pairs = annotation_graph_service.get_organisms_from_gene_ids_query(
            gene_ids=list(gene_ids.keys())
        )
        sorted_pairs = sorted(gene_organism_pairs, key=lambda pair: gene_ids[pair['gene_id']],
                              reverse=True)  # noqa

        for pair in sorted_pairs:
            yield [
                pair['gene_id'],
                pair['gene_name'],
                pair['taxonomy_id'],
                pair['species_name'],
                gene_ids[pair['gene_id']],
            ]


class FileAnnotationsGenerationView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(lambda request: BulkFileRequestSchema())
    @use_args(lambda request: AnnotationGenerationRequestSchema())
    def post(self, targets, params):
        """Generate annotations for one or more files."""
        current_user = g.current_user

        files = self.get_nondeleted_recycled_files(Files.hash_id.in_(targets['hash_ids']),
                                                   lazy_load_content=True)
        self.check_file_permissions(files, current_user, ['writable'], permit_recycled=False)

        override_organism = None
        override_annotation_configs = None

        if params.get('organism'):
            override_organism = params['organism']
            db.session.add(override_organism)
            db.session.flush()

        if params.get('annotation_configs'):
            override_annotation_configs = params['annotation_configs']

        updated_files = []
        versions = []
        results = {}
        missing = self.get_missing_hash_ids(targets['hash_ids'], files)

        for file in files:
            if override_organism is not None:
                effective_organism = override_organism
            else:
                effective_organism = file.fallback_organism

            if override_annotation_configs is not None:
                effective_annotation_configs = override_annotation_configs
            elif file.annotation_configs is not None:
                effective_annotation_configs = file.annotation_configs
            else:
                effective_annotation_configs = DEFAULT_ANNOTATION_CONFIGS

            if file.mime_type == 'application/pdf':
                try:
                    annotations, version = self._annotate(
                        file=file,
                        cause=AnnotationChangeCause.SYSTEM_REANNOTATION,
                        configs=effective_annotation_configs,
                        organism=effective_organism,
                        user_id=current_user.id,
                    )
                except AnnotationError as e:
                    current_app.logger.error(
                        'Could not annotate file: %s, %s, %s', file.hash_id, file.filename, e)
                    results[file.hash_id] = {
                        'attempted': True,
                        'success': False,
                        'error': e.message
                    }
                else:
                    current_app.logger.debug(
                        'File successfully annotated: %s, %s', file.hash_id, file.filename)
                    updated_files.append(annotations)
                    versions.append(version)
                    results[file.hash_id] = {
                        'attempted': True,
                        'success': True,
                        'error': ''
                    }
            elif file.mime_type == 'vnd.lifelike.document/enrichment-table':
                try:
                    enrichment = json.loads(file.content.raw_file_utf8)
                except JSONDecodeError:
                    current_app.logger.error(
                        f'Cannot annotate file with invalid content: {file.hash_id}, {file.filename}')  # noqa
                    results[file.hash_id] = {
                        'attempted': False,
                        'success': False,
                        'error': 'Enrichment table content is not valid JSON.'
                    }
                    continue
                enrich_service = get_enrichment_table_service()

                try:
                    enriched = enrich_service.create_annotation_mappings(enrichment)

                    annotations, version = self._annotate_enrichment_table(
                        file=file,
                        enriched=enriched,
                        cause=AnnotationChangeCause.SYSTEM_REANNOTATION,
                        configs=effective_annotation_configs,
                        organism=effective_organism,
                        user_id=current_user.id,
                        enrichment=enrichment
                    )

                    validate_enrichment_table(annotations['enrichment_annotations'])
                except AnnotationError as e:
                    current_app.logger.error(
                        'Could not annotate file: %s, %s, %s', file.hash_id, file.filename, e)  # noqa
                    results[file.hash_id] = {
                        'attempted': True,
                        'success': False,
                        'error': e.message
                    }
                else:
                    current_app.logger.debug(
                        'File successfully annotated: %s, %s', file.hash_id, file.filename)
                    updated_files.append(annotations)
                    versions.append(version)
                    results[file.hash_id] = {
                        'attempted': True,
                        'success': True,
                        'error': ''
                    }
            else:
                results[file.hash_id] = {
                    'attempted': False,
                    'success': False,
                    'error': 'Invalid file type, can only annotate PDFs or Enrichment tables.'
                }

        db.session.bulk_insert_mappings(FileAnnotationsVersion, versions)
        db.session.bulk_update_mappings(Files, updated_files)
        db.session.commit()

        return jsonify(MultipleAnnotationGenerationResponseSchema().dump({
            'mapping': results,
            'missing': missing,
        }))

    def _annotate(
        self,
        file: Files,
        cause: AnnotationChangeCause,
        configs: dict,
        organism: Optional[FallbackOrganism] = None,
        user_id: int = None
    ):
        """Annotate PDF files."""
        text, parsed = Pipeline.parse(
            file.mime_type, file_id=file.id, exclude_references=configs['exclude_references'])

        pipeline = Pipeline(
            {
                'adbs': get_annotation_db_service,
                'ags': get_annotation_graph_service,
                'aers': get_recognition_service,
                'tkner': get_annotation_tokenizer,
                'as': get_annotation_service,
                'bs': get_bioc_document_service
            },
            text=text, parsed=parsed)

        annotations_json = pipeline.get_globals(
            excluded_annotations=file.excluded_annotations or [],
            custom_annotations=file.custom_annotations or []
        ).identify(
            annotation_methods=configs['annotation_methods']
        ).annotate(
            specified_organism_synonym=organism.organism_synonym if organism else '',  # noqa
            specified_organism_tax_id=organism.organism_taxonomy_id if organism else '',  # noqa
            custom_annotations=file.custom_annotations or [],
            filename=file.filename)

        update = {
            'id': file.id,
            'annotations': annotations_json,
            'annotations_date': datetime.now(TIMEZONE),
        }

        if organism:
            update['fallback_organism'] = organism
            update['fallback_organism_id'] = organism.id

        version = {
            'file_id': file.id,
            'cause': cause,
            'custom_annotations': file.custom_annotations,
            'excluded_annotations': file.excluded_annotations,
            'user_id': user_id,
        }

        return update, version

    def _annotate_enrichment_table(
        self,
        file: Files,
        enriched: EnrichmentCellTextMapping,
        cause: AnnotationChangeCause,
        user_id: int,
        enrichment: dict,
        configs: dict,
        organism: Optional[FallbackOrganism] = None
    ):
        """Annotate all text in enrichment table."""
        text, parsed = Pipeline.parse(file.mime_type, text=enriched.text)

        pipeline = Pipeline(
            {
                'adbs': get_annotation_db_service,
                'ags': get_annotation_graph_service,
                'aers': get_recognition_service,
                'tkner': get_annotation_tokenizer,
                'as': get_enrichment_annotation_service,
                'bs': get_bioc_document_service
            },
            text=text, parsed=parsed)

        annotations_json = pipeline.get_globals(
            excluded_annotations=file.excluded_annotations or [],
            custom_annotations=file.custom_annotations or []
        ).identify(
            annotation_methods=configs['annotation_methods']
        ).annotate(
            specified_organism_synonym=organism.organism_synonym if organism else '',  # noqa
            specified_organism_tax_id=organism.organism_taxonomy_id if organism else '',  # noqa
            custom_annotations=file.custom_annotations or [],
            filename=file.filename,
            enrichment_mappings=enriched.text_index_map)

        # NOTE: code below to calculate the correct offsets for enrichment table
        # and correctly highlight based on cell is not pretty
        annotations_list = annotations_json['documents'][0]['passages'][0]['annotations']
        # sort by lo_location_offset to go from beginning to end
        sorted_annotations_list = sorted(annotations_list, key=lambda x: x['loLocationOffset'])

        prev_index = -1
        enriched_gene = ''

        start = time.time()
        for index, cell_text in enriched.text_index_map:
            annotation_chunk = [anno for anno in sorted_annotations_list if anno.get(
                'hiLocationOffset', None) and anno.get('hiLocationOffset') <= index]
            # it's sorted so we can do this to make the list shorter every iteration
            sorted_annotations_list = sorted_annotations_list[len(annotation_chunk):]

            # update JSON to have enrichment row and domain...
            for anno in annotation_chunk:
                if prev_index != -1:
                    # only do this for subsequent cells b/c
                    # first cell will always have the correct index
                    # update index offset to be relative to the cell again
                    # since they're relative to the combined text
                    anno['loLocationOffset'] = anno['loLocationOffset'] - (prev_index + 1) - 1  # noqa
                    anno['hiLocationOffset'] = anno['loLocationOffset'] + anno['keywordLength'] - 1  # noqa

                if 'domain' in cell_text:
                    # imported should come first for each row
                    if cell_text['domain'] == 'Imported':
                        enriched_gene = cell_text['text']
                    anno['enrichmentGene'] = enriched_gene
                    if cell_text['domain'] == 'Regulon':
                        anno['enrichmentDomain']['domain'] = cell_text['domain']
                        anno['enrichmentDomain']['subDomain'] = cell_text['label']
                    else:
                        anno['enrichmentDomain']['domain'] = cell_text['domain']

            snippet = self._highlight_annotations(
                original_text=cell_text['text'],
                annotations=annotation_chunk
            )
            if cell_text['domain'] == 'Imported':
                enrichment['result']['genes'][cell_text[
                    'index']]['annotatedImported'] = snippet
            elif cell_text['domain'] == 'Matched':
                enrichment['result']['genes'][cell_text[
                    'index']]['annotatedMatched'] = snippet
            elif cell_text['domain'] == 'Full Name':
                enrichment['result']['genes'][cell_text[
                    'index']]['annotatedFullName'] = snippet
            else:
                enrichment['result'][
                    'genes'][cell_text[
                        'index']]['domains'][cell_text[
                            'domain']][cell_text[
                                'label']]['annotatedText'] = snippet

            prev_index = index

        current_app.logger.info(
            f'Time to create enrichment snippets {time.time() - start}')

        update = {
            'id': file.id,
            'annotations': annotations_json,
            'annotations_date': datetime.now(TIMEZONE),
            'enrichment_annotations': enrichment
        }

        if organism:
            update['fallback_organism'] = organism
            update['fallback_organism_id'] = organism.id

        version = {
            'file_id': file.id,
            'cause': cause,
            'custom_annotations': file.custom_annotations,
            'excluded_annotations': file.excluded_annotations,
            'user_id': user_id,
        }

        return update, version

    def _highlight_annotations(self, original_text: str, annotations: List[dict]):
        # If done right, we would parse the XML but the built-in XML libraries in Python
        # are susceptible to some security vulns, but because this is an internal API,
        # we can accept that it can be janky

        texts = []
        prev_ending_index = -1

        for annotation in annotations:
            meta = annotation['meta']
            meta_type = annotation['meta']['type']
            term = annotation['textInDocument']
            lo_location_offset = annotation['loLocationOffset']
            hi_location_offset = annotation['hiLocationOffset']

            text = f'<annotation type="{meta_type}" meta="{html.escape(json.dumps(meta))}">{term}</annotation>'  # noqa

            if lo_location_offset == 0:
                prev_ending_index = hi_location_offset
                texts.append(text)
            else:
                if not texts:
                    texts.append(original_text[:lo_location_offset])
                    prev_ending_index = hi_location_offset
                    texts.append(text)
                else:
                    # TODO: would lo_location_offset == prev_ending_index ever happen?
                    # if yes, need to handle it
                    texts.append(original_text[prev_ending_index + 1:lo_location_offset])
                    prev_ending_index = hi_location_offset
                    texts.append(text)

        texts.append(original_text[prev_ending_index + 1:])
        final_text = ''.join(texts)
        return f'<snippet>{final_text}</snippet>'


class RefreshEnrichmentAnnotationsView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(lambda request: BulkFileRequestSchema())
    def post(self, targets):
        """Clear out the annotations."""
        current_user = g.current_user

        files = self.get_nondeleted_recycled_files(Files.hash_id.in_(targets['hash_ids']),
                                                   lazy_load_content=True)
        self.check_file_permissions(files, current_user, ['writable'], permit_recycled=False)

        updated_files = []
        for file in files:
            update = {
                'id': file.id,
                'annotations': [],
                'annotations_date': None,
                'enrichment_annotations': None
            }
            updated_files.append(update)
        db.session.bulk_update_mappings(Files, updated_files)
        db.session.commit()
        return jsonify({'results': 'Success'})


class GlobalAnnotationExportInclusions(MethodView):
    decorators = [auth.login_required, requires_role('admin')]

    def get(self):
        yield g.current_user

        graph = get_annotation_graph_service()
        inclusions = graph.exec_read_query(get_global_inclusions_query())

        file_uuids = {inclusion['file_reference'] for inclusion in inclusions}
        file_data_query = db.session.query(
            Files.hash_id.label('file_uuid'),
            Files.deleter_id.label('file_deleted_by')
        ).filter(
            Files.hash_id.in_([fid for fid in file_uuids])
        )

        file_uuids_map = {d.file_uuid: d.file_deleted_by for d in file_data_query}

        def get_inclusion_for_review(inclusion, file_uuids_map, graph):
            user = AppUser.query.filter_by(id=file_uuids_map[inclusion['file_reference']]).one_or_none()  # noqa
            deleter = f'User with id {file_uuids_map[inclusion["file_reference"]]} does not exist.'  # noqa
            if user is None:
                deleter = None
            elif user:
                deleter = f'{user.username} ({user.first_name} {user.last_name})'

            return {
                'creator': inclusion['creator'],
                'file_uuid': inclusion['file_reference'],
                'file_deleted': deleter,
                'type': ManualAnnotationType.INCLUSION.value,
                'creation_date': str(graph.convert_datetime(inclusion['creation_date'])),
                'text': inclusion['synonym'],
                'case_insensitive': True,
                'entity_type': inclusion['entity_type'],
                'entity_id': inclusion['entity_id'],
                'reason': '',
                'comment': ''
            }

        data = [get_inclusion_for_review(
            inclusion, file_uuids_map, graph) for inclusion in inclusions if inclusion['file_reference'] in file_uuids_map]  # noqa

        exporter = get_excel_export_service()
        response = make_response(exporter.get_bytes(data), 200)
        response.headers['Content-Type'] = exporter.mimetype
        response.headers['Content-Disposition'] = \
            f'attachment; filename={exporter.get_filename("global_inclusions")}'
        yield response


class GlobalAnnotationExportExclusions(MethodView):
    decorators = [auth.login_required, requires_role('admin')]

    def get(self):
        yield g.current_user

        exclusions = db.session.query(
            GlobalList.id.label('global_list_id'),
            AppUser.username.label('creator'),
            Files.hash_id.label('file_uuid'),
            Files.deleter_id.label('file_deleted_by'),
            GlobalList.creation_date.label('creation_date'),
            GlobalList.annotation['text'].astext.label('text'),
            GlobalList.annotation['isCaseInsensitive'].astext.label('case_insensitive'),
            GlobalList.annotation['type'].astext.label('entity_type'),
            GlobalList.annotation['id'].astext.label('entity_id'),
            GlobalList.annotation['reason'].astext.label('reason'),
            GlobalList.annotation['comment'].astext.label('comment')
        ).join(
            AppUser,
            AppUser.id == GlobalList.annotation['user_id'].as_integer()
        ).outerjoin(
            Files,
            Files.id == GlobalList.file_id
        ).filter(
            GlobalList.type == ManualAnnotationType.EXCLUSION.value
        ).order_by(
            sa.asc(GlobalList.annotation['text'].astext.label('text'))
        )

        def get_exclusion_for_review(exclusion):
            user = AppUser.query.filter_by(id=exclusion.file_deleted_by).one_or_none()
            deleter = f'User with id {exclusion.file_deleted_by} does not exist.'
            if user is None:
                deleter = None
            elif user:
                deleter = f'{user.username} ({user.first_name} {user.last_name})'

            return {
                'creator': exclusion.creator,
                'file_uuid': exclusion.file_uuid,
                'file_deleted_by': deleter,
                'type': ManualAnnotationType.EXCLUSION.value,
                'creation_date': str(exclusion.creation_date),
                'text': exclusion.text,
                'case_insensitive': True if exclusion.case_insensitive == 'true' else False,
                'entity_type': exclusion.entity_type,
                'entity_id': exclusion.entity_id,
                'reason': exclusion.reason,
                'comment': exclusion.comment
            }
        data = [get_exclusion_for_review(exclusion) for exclusion in exclusions]

        exporter = get_excel_export_service()
        response = make_response(exporter.get_bytes(data), 200)
        response.headers['Content-Type'] = exporter.mimetype
        response.headers['Content-Disposition'] = \
            f'attachment; filename={exporter.get_filename("global_exclusions")}'
        yield response


class GlobalAnnotationListView(MethodView):
    decorators = [auth.login_required, requires_role('admin')]

    @use_args(PaginatedRequestSchema())
    @use_args(GlobalAnnotationTableType())
    def get(self, params, global_type):
        """Since we need to aggregate from two different
        sources, we'll just query (paginate) for x number of results from
        each and combine them together.
        """
        yield g.current_user

        limit = min(200, int(params.limit))
        page = max(1, int(params.page))

        if global_type['global_annotation_type'] == ManualAnnotationType.EXCLUSION.value:
            exclusions = db.session.query(
                GlobalList.id.label('global_list_id'),
                AppUser.username.label('creator'),
                Files.hash_id.label('file_uuid'),
                Files.deleter_id.label('file_deleted_by'),
                GlobalList.creation_date.label('creation_date'),
                GlobalList.annotation['text'].astext.label('text'),
                GlobalList.annotation['isCaseInsensitive'].astext.label('case_insensitive'),
                GlobalList.annotation['type'].astext.label('entity_type'),
                GlobalList.annotation['id'].astext.label('entity_id'),
                GlobalList.annotation['reason'].astext.label('reason'),
                GlobalList.annotation['comment'].astext.label('comment')
            ).join(
                AppUser,
                AppUser.id == GlobalList.annotation['user_id'].as_integer()
            ).outerjoin(
                Files,
                Files.id == GlobalList.file_id
            ).filter(
                GlobalList.type == ManualAnnotationType.EXCLUSION.value
            ).order_by(
                sa.asc(GlobalList.annotation['text'].astext.label('text'))
            ).paginate(page, limit)

            data = [{
                'global_id': r.global_list_id,
                'creator': r.creator,
                'file_uuid': r.file_uuid if r.file_uuid else '',
                'file_deleted': True if r.file_deleted_by else False,
                'type': ManualAnnotationType.EXCLUSION.value,
                'creation_date': r.creation_date,
                'text': r.text,
                'case_insensitive': True if r.case_insensitive == 'true' else False,
                'entity_type': r.entity_type,
                'entity_id': r.entity_id,
                'reason': r.reason,
                'comment': r.comment
            } for r in exclusions.items]
            query_total = exclusions.total
        else:
            graph = get_annotation_graph_service()
            global_inclusions = graph.exec_read_query_with_params(
                get_global_inclusions_paginated_query(), {'skip': 0 if page == 1 else (page - 1) * limit, 'limit': limit})  # noqa

            file_uuids = {inclusion['file_reference'] for inclusion in global_inclusions}
            file_data_query = db.session.query(
                Files.hash_id.label('file_uuid'),
                Files.deleter_id.label('file_deleted_by')
            ).filter(
                Files.hash_id.in_([fid for fid in file_uuids])
            )

            file_uuids_map = {d.file_uuid: d.file_deleted_by for d in file_data_query}
            data = [{
                'global_id': i['node_internal_id'],
                'synonym_id': i['syn_node_internal_id'],
                'creator': i['creator'],
                'file_uuid': i['file_reference'],
                # if not in this something must've happened to the file
                # since a global inclusion referenced it
                # so mark it as deleted
                # mapping is {file_uuid: user_id} where user_id is null if file is not deleted
                'file_deleted': True if file_uuids_map.get(i['file_reference'], True) else False,
                'type': ManualAnnotationType.INCLUSION.value,
                'creation_date': graph.convert_datetime(i['creation_date']),
                'text': i['synonym'],
                'case_insensitive': True,
                'entity_type': i['entity_type'],
                'entity_id': i['entity_id'],
                'reason': '',
                'comment': ''
            } for i in global_inclusions]
            query_total = graph.exec_read_query(
                get_global_inclusions_count_query())[0]['total']

        results = {
            'total': query_total,
            'results': data
        }
        yield jsonify(GlobalAnnotationListSchema().dump(results))

    @use_args(GlobalAnnotationsDeleteSchema())
    def delete(self, params):
        yield g.current_user

        # exclusions in postgres will not have synonym_id
        # those are for the graph nodes, and -1 represents not having one
        exclusion_pids = [gid for gid, sid in params['pids'] if sid == -1]
        inclusion_pids = [(gid, sid) for gid, sid in params['pids'] if sid != -1]

        if exclusion_pids:
            query = GlobalList.__table__.delete().where(
                GlobalList.id.in_(exclusion_pids)
            )
            try:
                db.session.execute(query)
                db.session.commit()

                current_app.logger.info(
                    f'Deleted {len(exclusion_pids)} global exclusions',
                    extra=UserEventLog(
                        username=g.current_user.username,
                        event_type=LogEventType.ANNOTATION.value).to_dict()
                )
            except SQLAlchemyError:
                db.session.rollback()
                raise ServerException(
                    title='Could not delete exclusion',
                    message='A database error occurred when deleting the global exclusion(s).')

        if inclusion_pids:
            manual_as = get_manual_annotation_service()
            try:
                manual_as.remove_global_inclusions(inclusion_pids)
                current_app.logger.info(
                    f'Deleted {len(inclusion_pids)} global inclusions',
                    extra=UserEventLog(
                        username=g.current_user.username,
                        event_type=LogEventType.ANNOTATION.value).to_dict()
                )
            except Exception as e:
                current_app.logger.error(
                    f'{str(e)}',
                    extra=UserEventLog(
                        username=g.current_user.username,
                        event_type=LogEventType.ANNOTATION.value).to_dict()
                )
                raise ServerException(
                    title='Could not delete inclusion',
                    message='A database error occurred when deleting the global inclusion(s).')

        yield jsonify(dict(result='success'))


@bp.route('/files/<int:file_id>', methods=['GET'])
def get_pdf_to_annotate(file_id):
    """This endpoint is sent by the annotation pipeline to the
    pdfparse service, and acts as a resource pull.
    """

    doc = Files.query.get(file_id)

    if not doc:
        raise AnnotationError(
            title='Failed to Annotate',
            message=f'File with file id {file_id} not found.',
            code=404)

    res = make_response(doc.content.raw_file)
    res.headers['Content-Type'] = 'application/pdf'
    res.headers['Content-Disposition'] = f'attachment;filename={doc.filename}.pdf'
    return res


bp.add_url_rule(
    '/global-list',
    view_func=GlobalAnnotationListView.as_view('global_annotations_list'))
bp.add_url_rule(
    '/global-list/exclusions',
    view_func=GlobalAnnotationExportExclusions.as_view('export_global_exclusions'))
bp.add_url_rule(
    '/global-list/inclusions',
    view_func=GlobalAnnotationExportInclusions.as_view('export_global_inclusions'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations',
    view_func=FileAnnotationsView.as_view('file_annotations_list'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/enrichment/annotations',
    view_func=EnrichmentAnnotationsView.as_view('enrichment_file_annotations_list'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/custom',
    view_func=FileCustomAnnotationsListView.as_view('file_custom_annotations_list'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/custom/<string:uuid>',
    view_func=FileCustomAnnotationsDetailView.as_view('file_custom_annotations_detail'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/exclusions',
    view_func=FileAnnotationExclusionsListView.as_view('file_annotation_exclusions_list'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/counts',
    view_func=FileAnnotationCountsView.as_view('file_annotation_counts'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/sorted',
    view_func=FileAnnotationSortedView.as_view('file_annotation_sorted'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/gene-counts',
    view_func=FileAnnotationGeneCountsView.as_view('file_annotation_gene_counts'))
filesystem_bp.add_url_rule(
    'annotations/generate',
    view_func=FileAnnotationsGenerationView.as_view('file_annotation_generation'))
filesystem_bp.add_url_rule(
    'annotations/refresh',
    # TODO: this can potentially become a generic annotations refresh
    view_func=RefreshEnrichmentAnnotationsView.as_view('refresh_annotations'))
