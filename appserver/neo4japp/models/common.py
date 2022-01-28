from decimal import Decimal

import sqlalchemy as sa
import timeflake
from marshmallow import fields
from marshmallow_sqlalchemy.convert import ModelConverter as BaseModelConverter
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.types import TIMESTAMP
from sqlalchemy_utils.types import TSVectorType

from neo4japp.database import db
from neo4japp.util import snake_to_camel, camel_to_snake


def generate_hash_id():
    # Roughly-ordered identifier with an extremely low chance of collision
    return timeflake.random().base62


class NEO4JBase():
    """ Base class for all neo4j related ORM """

    def to_dict(self, keyfn=None):
        d = self.__dict__
        keyfn = keyfn or snake_to_camel
        retval = {}
        for k in d:
            key = keyfn(k)
            retval[key] = d[k]
        return retval

    @classmethod
    def from_dict(cls, d, keyfn=None):
        keyfn = keyfn or camel_to_snake
        retval = {}
        for k in d:
            retval[keyfn(k)] = d[k]
        return cls(**retval)


class RDBMSBase(db.Model):  # type: ignore
    """ Base class for RDBMS database (e.g. Postgres)

        An unambiguous string representation of this object.
        In the form of <class_name>#<id>.

        The string can be passed as is, or after encryption, to the
        client for the purpose of unambiguously identifying a database
        object in the system.
    """
    __abstract__ = True

    def __repr__(self) -> str:
        identifier = sa.inspect(self).identity
        pk = self.id if identifier else 'None'
        return f'{type(self).__name__}#{pk}'

    def __get_columns(self):
        return {x.name: x.type for x in sa.inspect(self).mapper.columns}

    def to_dict(self, exclude=None, include=None, only=None, keyfn=None, valuefn=None):
        """Returns a dictionary of the model object.

        Attribute names (exclude, include, only, etc) are in snake_case.

        Enum's are converted to strings because the default JSON
        encoder does not convert them.  This behavior may change later
        if we decide to keep the Enum's as they are in the dictionary
        but add a custom JSON encoder for that.

        Args:
            exclude (list): Properties that should be excluded.
                Always excludes attributes in TimestampMixin.

            include (list): Properties that should be included.  Using
                this allows python properties to be called.

            only (list): Only these properties will be in the dictionary.

            keyfn (function): If supplied, the function is applied to
                the column attributes before they are added as keys in
                the returned dictionary.  By default uses
                snake_to_camel to convert to lowerCamelCase.

        Returns:
            a dictionary of the model object

        """
        columns = self.__get_columns()
        if only:
            attrs = only
        else:
            if include:
                attrs = include
            else:
                exclude = (exclude or [])
                attrs = [k for k in columns.keys() if k not in exclude]

        keyfn = keyfn or snake_to_camel
        valuefn = valuefn or snake_to_camel
        retval = {}
        for k in attrs:
            key = keyfn(k)
            retval[key] = valuefn(getattr(self, k))
        return retval

    def from_dict(self, data, exclude=None, include=None, only=None, keyfn=None):
        """Binds a model object's attributes with values from a dictionary.

        Attribute names (exclude, include, only, etc) are in snake_case.

        Will bind datetime in http date format (RFC 822).

        Args:
            data (dictionary): Contains key-value pairs to set the
                attributes in the model object.

            exclude (list): Properties that should be excluded.
                Always excludes attributes in TimestampMixin.
                # TODO: Handle TimestampMixin serialization

            include (list): Properties that should be included.  Using
                this allows python properties to be called.

            only (list): Only these properties will be set in the object.

            keyfn (function): If supplied, the function is applied to
                the keys in the dictionary before they are used to
                look up attributes in the model object dictionary.  By
                default uses camel_to_snake to convert to snake_case.

        Returns:
            a model object whose attribtes are set from the dictionary

        """
        columns = self.__get_columns()

        if only:
            attrs = only
        else:
            exclude = (exclude or [])
            attrs = (include or []) + [
                k for k in columns.keys() if k not in exclude]

        update_keys = set(map(snake_to_camel, attrs)) & set(data.keys())

        keyfn = keyfn or camel_to_snake
        for k in update_keys:
            attr = keyfn(k)
            coltype = columns[attr]
            if isinstance(coltype, sa.sql.sqltypes.Enum):
                if data[k]:
                    value = coltype._object_lookup[data[k]]
                else:
                    value = None
            elif isinstance(coltype, sa.sql.sqltypes.Numeric):
                value = Decimal(data[k])
            else:
                value = data[k]
            setattr(self, attr, value)
        return self


class ModelConverter(BaseModelConverter):
    """ Custom Model Converter to extend the BaseModelConverter to allow new types
        for example: TSVector type for full text search.
        This is been explain in the issue on the sqlalchemy repo:
        https://github.com/marshmallow-code/marshmallow-sqlalchemy/issues/55#issuecomment-472684594
    """
    SQLA_TYPE_MAPPING = {
        **BaseModelConverter.SQLA_TYPE_MAPPING,
        **{TSVectorType: fields.Field},
    }


class TimestampMixin:
    """ Tables that need a created/updated """
    creation_date = db.Column(TIMESTAMP(timezone=True), default=db.func.now(), nullable=False)
    modified_date = db.Column(
        TIMESTAMP(timezone=True), default=db.func.now(), nullable=False, onupdate=db.func.now())


class FullTimestampMixin(TimestampMixin):
    """ Tables that need a created/updated """
    deletion_date = db.Column(TIMESTAMP(timezone=True), nullable=True)

    @declared_attr
    def creator_id(cls):
        return db.Column(db.Integer, db.ForeignKey('appuser.id'), nullable=True)

    @declared_attr
    def creator(cls):
        return db.relationship('AppUser', foreign_keys=cls.creator_id, uselist=False)

    @declared_attr
    def modifier_id(cls):
        return db.Column(db.Integer, db.ForeignKey('appuser.id'), nullable=True)

    @declared_attr
    def modifier(cls):
        return db.relationship('AppUser', foreign_keys=cls.modifier_id, uselist=False)

    @declared_attr
    def deleter_id(cls):
        return db.Column(db.Integer, db.ForeignKey('appuser.id'), nullable=True)

    @declared_attr
    def deleter(cls):
        return db.relationship('AppUser', foreign_keys=cls.deleter_id, uselist=False)

    @property
    def deleted(self):
        return self.deletion_date is not None


class RecyclableMixin:
    """
    A model that is recyclable supports a recycle bin.
    """
    recycling_date = db.Column(TIMESTAMP(timezone=True), nullable=True)

    @declared_attr
    def recycler_id(cls):
        return db.Column(db.Integer, db.ForeignKey('appuser.id'), nullable=True)

    @declared_attr
    def recycler(cls):
        return db.relationship('AppUser', foreign_keys=cls.recycler_id, uselist=False)

    @property
    def recycled(self):
        return self.recycling_date is not None


class HashIdMixin:
    """
    A model with a roughly-ordered hash ID with a bit of randomness.
    """
    hash_id = db.Column(db.String(36), unique=True, nullable=False, default=generate_hash_id)
