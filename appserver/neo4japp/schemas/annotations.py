import marshmallow.validate
from marshmallow import Schema, fields, post_load
from marshmallow_enum import EnumField

from neo4japp.models import FallbackOrganism
from neo4japp.models.files import AnnotationChangeCause
from neo4japp.schemas.account import UserSchema
from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.common import ResultListSchema


class FallbackOrganismSchema(Schema):  # Not camel case!
    organism_name = fields.String(required=True,
                                  validate=marshmallow.validate.Length(min=1, max=200))
    synonym = fields.String(required=True,
                            validate=marshmallow.validate.Length(min=1, max=200))
    tax_id = fields.String(required=True,
                           validate=marshmallow.validate.Length(min=1, max=200))

    @post_load
    def create(self, params, **kwargs):
        return FallbackOrganism(
            organism_name=params['organism_name'],
            organism_synonym=params['synonym'],
            organism_taxonomy_id=params['tax_id']
        )


class AnnotationMethod(CamelCaseSchema):
    nlp = fields.Boolean(required=True)
    rules_based = fields.Boolean(required=True)


class AnnotationConfigurations(CamelCaseSchema):
    annotation_methods = fields.Dict(
        keys=fields.String(),
        values=fields.Nested(AnnotationMethod)
    )
    exclude_references = fields.Boolean(required=False)


# ========================================
# Generation
# ========================================

# Requests
# ----------------------------------------

class AnnotationGenerationRequestSchema(CamelCaseSchema):
    """Request for initial annotation or re-annotation."""
    organism = fields.Nested(FallbackOrganismSchema, allow_none=True)
    annotation_configs = fields.Nested(AnnotationConfigurations)


# Responses
# ----------------------------------------

class AnnotationGenerationResultSchema(CamelCaseSchema):
    attempted = fields.Boolean()
    success = fields.Boolean()
    error = fields.String()


class MultipleAnnotationGenerationResponseSchema(CamelCaseSchema):
    mapping = fields.Dict(keys=fields.String(),
                          values=fields.Nested(AnnotationGenerationResultSchema))
    missing = fields.List(fields.String)


# ========================================
# Annotations Base
# ========================================

class AnnotationLinksSchema(Schema):
    # These fields are camel case even in Python
    ncbi_taxonomy = fields.String(required=True)
    ncbi_gene = fields.String(required=True)
    uniprot = fields.String(required=True)
    chebi = fields.String(required=True)
    pubchem = fields.String(required=True)
    mesh = fields.String(required=True)
    wikipedia = fields.String(required=True)
    google = fields.String(required=True)


class BaseAnnotationMetaSchema(Schema):
    # These fields are camel case even in Python
    type = fields.String(required=True)
    links = fields.Nested(AnnotationLinksSchema, required=True)
    id = fields.String(required=True)
    idType = fields.String(required=True)
    idHyperlinks = fields.List(fields.String(), required=True)
    isCustom = fields.Boolean(required=True)
    allText = fields.String(required=True)


class BaseAnnotationSchema(Schema):
    # These fields are camel case even in Python
    meta = fields.Nested(BaseAnnotationMetaSchema, required=True)
    pageNumber = fields.Integer(required=True)
    keywords = fields.List(fields.String(required=True))
    rects = fields.List(fields.List(fields.Float(required=True)))
    uuid = fields.String(required=False)


# ========================================
# System Annotations
# ========================================

class SystemAnnotationMetaSchema(BaseAnnotationMetaSchema):
    isExcluded = fields.Boolean(allow_none=True)
    exclusionReason = fields.String(allow_none=True)
    exclusionComment = fields.String(allow_none=True)


class SystemAnnotationSchema(BaseAnnotationSchema):
    # These fields are camel case even in Python
    meta = fields.Nested(SystemAnnotationMetaSchema, required=True)
    keyword = fields.String(required=True)
    textInDocument = fields.String(required=False)
    keywordLength = fields.Integer()
    loLocationOffset = fields.Integer()
    hiLocationOffset = fields.Integer()
    primaryName = fields.String(required=False)


# Responses
# ----------------------------------------

class SystemAnnotationListSchema(ResultListSchema):
    results = fields.List(fields.Nested(SystemAnnotationSchema))


class AnnotationUUIDListSchema(ResultListSchema):
    results = fields.List(fields.String())


class GlobalAnnotationListItemSchema(CamelCaseSchema):
    global_id = fields.Integer()
    synonym_id = fields.Integer(required=False, missing=lambda: None)
    file_uuid = fields.String()
    creator = fields.String()
    file_deleted = fields.Boolean()
    type = fields.String()
    creation_date = fields.Date()
    text = fields.String()
    case_insensitive = fields.Boolean()
    entity_type = fields.String()
    entity_id = fields.String()
    reason = fields.String()
    comment = fields.String()


class GlobalAnnotationListSchema(ResultListSchema):
    results = fields.List(fields.Nested(GlobalAnnotationListItemSchema))


# ========================================
# Custom Annotations
# ========================================

class CustomAnnotationMetaSchema(BaseAnnotationMetaSchema):
    includeGlobally = fields.Boolean(required=True)
    isCaseInsensitive = fields.Boolean(required=True)


class CustomAnnotationSchema(BaseAnnotationSchema):
    meta = fields.Nested(CustomAnnotationMetaSchema, required=True)


# Requests
# ----------------------------------------

class CustomAnnotationCreateSchema(CamelCaseSchema):
    annotation = fields.Nested(CustomAnnotationSchema, required=True)
    annotate_all = fields.Boolean(required=False, missing=lambda: False)


class CustomAnnotationDeleteSchema(CamelCaseSchema):
    remove_all = fields.Boolean(required=False, missing=lambda: False)


# this is used in the admin global annotations table
class GlobalAnnotationTableType(CamelCaseSchema):
    global_annotation_type = fields.String(required=True)


# Responses
# ----------------------------------------

class CustomAnnotationListSchema(ResultListSchema):
    results = fields.List(fields.Nested(CustomAnnotationSchema))


# ========================================
# Combined Annotations
# ========================================

class CombinedAnnotationMetaSchema(SystemAnnotationMetaSchema, CustomAnnotationMetaSchema):
    isExcluded = fields.Boolean()
    exclusionReason = fields.String()
    exclusionComment = fields.String()


class CombinedAnnotationSchema(SystemAnnotationSchema, CustomAnnotationSchema):
    meta = fields.Nested(CombinedAnnotationMetaSchema)


# Responses
# ----------------------------------------

class CombinedAnnotationListSchema(ResultListSchema):
    results = fields.List(fields.Nested(CombinedAnnotationSchema))


# ========================================
# Annotation Exclusions
# ========================================

class AnnotationExclusionSchema(Schema):  # Camel case in Python
    id = fields.String(required=True)
    idHyperlinks = fields.List(fields.String(), required=True)
    text = fields.String(required=True)
    type = fields.String(required=True)
    rects = fields.List(fields.List(fields.Float(required=True)))
    pageNumber = fields.Integer(required=True)
    reason = fields.String(required=True)
    comment = fields.String(required=True)
    excludeGlobally = fields.Boolean(required=True)
    isCaseInsensitive = fields.Boolean(required=True)


# Requests
# ----------------------------------------

class AnnotationExclusionCreateSchema(CamelCaseSchema):
    exclusion = fields.Nested(AnnotationExclusionSchema, required=True)


class AnnotationExclusionDeleteSchema(CamelCaseSchema):
    text = fields.String(required=True)
    type = fields.String(required=True)


# ========================================
# History
# ========================================

class AnnotationChangeExclusionMetaSchema(CamelCaseSchema):
    id = fields.String(required=True)
    idHyperlinks = fields.List(fields.String(), required=True)
    text = fields.String(required=True)
    type = fields.String(required=True)
    reason = fields.String(required=True)
    comment = fields.String(required=True)
    excludeGlobally = fields.Boolean(required=True)
    isCaseInsensitive = fields.Boolean(required=True)


class AnnotationInclusionChangeSchema(CamelCaseSchema):
    action = fields.String()
    date = fields.DateTime()
    meta = fields.Nested(CombinedAnnotationMetaSchema)


class AnnotationExclusionChangeSchema(CamelCaseSchema):
    action = fields.String()
    meta = fields.Nested(AnnotationChangeExclusionMetaSchema)


class FileAnnotationChangeSchema(CamelCaseSchema):
    date = fields.DateTime()
    user = fields.Nested(UserSchema)
    cause = EnumField(AnnotationChangeCause, by_value=True)
    inclusion_changes = fields.List(fields.Nested(AnnotationInclusionChangeSchema))
    exclusion_changes = fields.List(fields.Nested(AnnotationExclusionChangeSchema))


# Responses
# ----------------------------------------

class FileAnnotationHistoryResponseSchema(ResultListSchema):
    results = fields.List(fields.Nested(FileAnnotationChangeSchema))


# ========================================
# Global Annotations
# ========================================

# Requests
# ----------------------------------------

class GlobalAnnotationsDeleteSchema(Schema):
    pids = fields.List(fields.Tuple((fields.Integer(), fields.Integer())))
