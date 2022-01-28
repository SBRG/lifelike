from marshmallow import fields
from neo4japp.schemas.base import CamelCaseSchema


class ClientErrorSchema(CamelCaseSchema):
    title = fields.String(required=True)
    message = fields.String()
    detail = fields.String(allow_none=True)
    transaction_id = fields.String(required=True)
    url = fields.String()
    label = fields.String()
    expected = fields.Boolean()
