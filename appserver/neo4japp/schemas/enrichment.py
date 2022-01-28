from marshmallow import Schema, fields

from neo4japp.schemas.base import CamelCaseSchema


class EnrichmentValue(CamelCaseSchema):
    text = fields.String(required=True)
    annotatedText = fields.String(allow_none=True)
    link = fields.String(required=True)


class EnrichedGene(CamelCaseSchema):
    imported = fields.String(allow_none=True)
    matched = fields.String(allow_none=True)
    fullName = fields.String(allow_none=True)
    annotatedImported = fields.String(allow_none=True)
    annotatedMatched = fields.String(allow_none=True)
    annotatedFullName = fields.String(allow_none=True)
    link = fields.String(allow_none=True)
    domains = fields.Dict(
        keys=fields.String(), values=fields.Dict(
            keys=fields.String(), values=fields.Nested(EnrichmentValue)), allow_none=True)


class DomainInfo(CamelCaseSchema):
    labels = fields.List(fields.String())


class EnrichmentResult(CamelCaseSchema):
    domainInfo = fields.Dict(
        keys=fields.String(), values=fields.Nested(DomainInfo), required=True)
    genes = fields.List(fields.Nested(EnrichedGene), required=True)


class EnrichmentData(CamelCaseSchema):
    genes = fields.String(required=True)
    taxId = fields.String(required=True)
    organism = fields.String(required=True)
    sources = fields.List(fields.String())


# Requests
# ----------------------------------------

class EnrichmentTableSchema(CamelCaseSchema):
    data = fields.Nested(EnrichmentData, required=True)
    result = fields.Nested(EnrichmentResult, required=True)
