from marshmallow import fields
from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.account import UserProfileSchema


class JWTTokenSchema(CamelCaseSchema):
    sub = fields.String()
    iat = fields.DateTime()
    exp = fields.DateTime()
    token_type = fields.String()
    token = fields.String()


class JWTTokenResponse(CamelCaseSchema):
    access_token = fields.Nested(JWTTokenSchema)
    refresh_token = fields.Nested(JWTTokenSchema)
    user = fields.Nested(UserProfileSchema)
