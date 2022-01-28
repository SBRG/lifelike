import marshmallow.validate
from marshmallow import fields

from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.common import ResultListSchema


# ========================================
# Users
# ========================================

class UserCreateSchema(CamelCaseSchema):
    first_name = fields.String()
    last_name = fields.String()
    username = fields.String()
    email = fields.Email()
    password = fields.String()
    created_by_admin = fields.Boolean()
    roles = fields.List(fields.String())


class UserChangePasswordSchema(CamelCaseSchema):
    password = fields.String()
    new_password = fields.String()


class UserUpdateSchema(CamelCaseSchema):
    """ Only these attributes can be modified for AppUsers """
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()
    roles = fields.List(fields.String())


class UserSchema(CamelCaseSchema):
    """Generic schema for returning public information about a user."""
    hash_id = fields.String()
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()
    # DO NOT return private information (like email) in this schema


class UserProfileSchema(UserSchema):
    id = fields.Integer()
    email = fields.Email()
    locked = fields.Boolean()
    reset_password = fields.Boolean()
    roles = fields.List(fields.String())


# Requests
# ----------------------------------------

class UserSearchSchema(CamelCaseSchema):
    """Used to search for users (i.e. user auto-complete)."""
    query = fields.String(required=True, validate=[
        marshmallow.validate.Length(min=1, max=100),
        marshmallow.validate.Regexp('[^\\s]+')
    ])
    exclude_self = fields.Boolean(missing=lambda: False)


# Responses
# ----------------------------------------

class UserProfileListSchema(ResultListSchema):
    results = fields.List(fields.Nested(UserProfileSchema))


class UserListSchema(ResultListSchema):
    """A list of users."""
    results = fields.List(fields.Nested(UserSchema))
