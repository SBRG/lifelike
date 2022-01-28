import marshmallow.validate
from marshmallow import post_load, fields

from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.fields import StringIntegerField
from neo4japp.utils.request import Pagination


class PaginatedRequestSchema(CamelCaseSchema):
    page = StringIntegerField(required=False,
                              missing=lambda: 1,
                              validate=marshmallow.validate.Range(min=1, max=10000))
    limit = StringIntegerField(required=False,
                               missing=lambda: 50,
                               validate=marshmallow.validate.Range(min=1, max=1000))

    @post_load
    def create(self, params, **kwargs):
        return Pagination(page=params['page'], limit=params['limit'])


class RankedItemSchema(CamelCaseSchema):
    """When you need to assign a rank to each item."""
    rank = fields.Number()
    # item = YourField()


class ResultQuerySchema(CamelCaseSchema):
    phrases = fields.List(fields.String)


class SingleResultSchema(CamelCaseSchema):
    """When you have one item to return."""
    # result = YourField()


class ResultListSchema(CamelCaseSchema):
    """When you have a list of items to return."""
    total = fields.Integer()
    query = fields.Nested(ResultQuerySchema)
    # results = fields.List(YourField())


class ResultMappingSchema(CamelCaseSchema):
    """When you have a key -> value map to return."""
    missing = fields.List(fields.String)
    # mapping = fields.Dict(YourField(), YourField())


# Note: The above schemas (SingleResult, ResultList, ResultMapping) have field names
# named in a way that lets you combine the schemas without conflicts!
# (i.e. ResultList + ResultMapping in the same response)


class ErrorResponseSchema(CamelCaseSchema):
    """All errors are emitted with this schema."""
    title = fields.String()
    message = fields.String()
    additional_msgs = fields.List(fields.String())
    stacktrace = fields.String()
    code = fields.Integer()
    version = fields.String()
    transaction_id = fields.String()
    fields_ = fields.Dict(
        keys=fields.String(),
        values=fields.Raw(),  # raw means can be anything
        attribute='fields', allow_none=True)
