from marshmallow import fields, validate

from neo4japp.database import ma
from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.common import ResultListSchema
from neo4japp.schemas.fields import SearchQuery
from neo4japp.schemas.filesystem import RankedFileSchema

# ========================================
# Content Search
# ========================================

# Requests
# ----------------------------------------


class ContentSearchSchema(CamelCaseSchema):
    q = SearchQuery(
        required=True,
    )
    types = ma.String(default='', required=False)
    folders = ma.String(default='', required=False)


class SynonymSearchSchema(CamelCaseSchema):
    term = fields.String()
    organisms = fields.String(default='', required=False)
    types = fields.String(default='', required=False)

# Response
# ----------------------------------------


class ContentSearchResponseSchema(ResultListSchema):
    results = fields.List(fields.Nested(RankedFileSchema))
    dropped_folders = fields.List(fields.String())


class SynonymData(CamelCaseSchema):
    type = fields.String()
    name = fields.String()
    organism = fields.String()
    synonyms = fields.List(fields.String())


class SynonymSearchResponseSchema(CamelCaseSchema):
    data = fields.List(fields.Nested(SynonymData))
    count = fields.Integer()


# ========================================
# Text Annotation API
# ========================================


class AnnotateRequestSchema(ma.Schema):
    texts = fields.List(fields.String(validate=validate.Length(min=1, max=1500)),
                        validate=validate.Length(min=1, max=40))


# ========================================
# Organisms
# ========================================

class OrganismSearchSchema(ma.Schema):
    query = ma.String(required=True)
    limit = ma.Integer(required=True, validate=validate.Range(min=0, max=1000))


# ========================================
# Visualizer
# ========================================

class VizSearchSchema(ma.Schema):
    query = ma.String(required=True)
    page = ma.Integer(required=True, validate=validate.Range(min=1))
    limit = ma.Integer(required=True, validate=validate.Range(min=0, max=1000))
    domains = ma.List(ma.String(required=True))
    entities = ma.List(ma.String(required=True))
    organism = ma.String(required=True)
