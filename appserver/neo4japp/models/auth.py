from typing import Sequence

import bcrypt
import enum

import sqlalchemy as sa

from sqlalchemy import and_
from sqlalchemy.orm.query import Query

from neo4japp.database import db, ma

from .common import RDBMSBase, TimestampMixin, HashIdMixin

user_role = db.Table(
    'app_user_role',
    db.Column(
        'appuser_id',
        db.Integer,
        db.ForeignKey('appuser.id', ondelete='CASCADE'),
        index=True,
        primary_key=True,
    ),
    db.Column(
        'app_role_id',
        db.Integer,
        db.ForeignKey('app_role.id', ondelete='CASCADE'),
        index=True,
        primary_key=True,
    )
)


class AppRole(RDBMSBase):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), unique=True, nullable=False)


class AppUser(RDBMSBase, TimestampMixin, HashIdMixin):
    """
        User models to tie ownership of resources to
    """
    __tablename__ = 'appuser'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    first_name = db.Column(db.String(120), nullable=False)
    last_name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(256))
    failed_login_count = db.Column(db.Integer, default=0)
    forced_password_reset = db.Column(db.Boolean)

    # load all roles associated with the user eagerly using subquery
    roles = db.relationship(
        'AppRole',
        secondary=user_role,
        lazy='subquery',
        # create a backreference in Role named
        # `users`, but don't load them
        backref=db.backref('users', lazy=True)
    )

    @property
    def password(self):
        raise NotImplementedError('password is hashed and cannot be retrieved')

    @password.setter
    def password(self, password):
        self.set_password(password)

    def set_password(self, password):
        pwhash = bcrypt.hashpw(password.encode('utf8'), bcrypt.gensalt())
        self.password_hash = pwhash.decode('utf8')

    def check_password(self, password):
        return bcrypt.checkpw(
            password.encode("utf-8"),
            self.password_hash.encode("utf-8")
        )

    def has_role(self, role: str):
        return role in [r.name for r in self.roles]

    @classmethod
    def query_by_email(cls, email: str) -> Query:
        return cls.query.filter(cls.email == email)

    @classmethod
    def query_by_username(cls, username: str) -> Query:
        return cls.query.filter(cls.username == username)

    def to_dict(self, exclude=None, **kwargs):
        return super().to_dict(exclude=['password_hash'] + (exclude or []), **kwargs)


class AppUserSchema(ma.ModelSchema):  # type: ignore
    class Meta:
        model = AppUser


class AccessRuleType(enum.Enum):
    """ Allow or Deny """
    ALLOW = 'allow'
    DENY = 'deny'


class AccessActionType(enum.Enum):
    READ = 'read'
    WRITE = 'write'


class AccessControlPolicy(RDBMSBase):
    """ Which user, group, etc have what access to protected resources """
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.Enum(AccessActionType), nullable=False)
    asset_type = db.Column(db.String(200), nullable=False)
    asset_id = db.Column(db.Integer, nullable=True)
    principal_type = db.Column(db.String(50), nullable=False)
    principal_id = db.Column(db.Integer, nullable=True)
    rule_type = db.Column(db.Enum(AccessRuleType), nullable=False)

    __table_args__ = (
        sa.Index(
            'ix_acp_asset_key',
            'asset_type',
            'asset_id',
        ),
        sa.Index(
            'ix_acp_principal_key',
            'principal_type',
            'principal_id',
        ),
    )

    @classmethod
    def query_acp(cls, principal: RDBMSBase, asset: RDBMSBase, action: AccessActionType) -> Query:
        return AccessControlPolicy.query.filter(
            and_(
                cls.asset_id == asset.id,
                cls.asset_type == asset.__tablename__,
                cls.principal_id == principal.id,
                cls.principal_type == principal.__tablename__,
                cls.action == action,
            )
        )


class AccessControlPolicySchema(ma.ModelSchema):  # type: ignore
    class Meta:
        model = AccessControlPolicy
