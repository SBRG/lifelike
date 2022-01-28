from sqlalchemy import and_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.session import Session

from neo4japp.services.common import RDBMSBaseDao
from neo4japp.models.common import RDBMSBase
from neo4japp.models.auth import (
    AccessActionType,
    AccessControlPolicy,
    AccessRuleType,
    AppUser,
    AppRole,
)

from typing import Iterable, Sequence


class AuthService(RDBMSBaseDao):
    def __init__(self, session: Session):
        super().__init__(session)

    # TODO: Doesn't seem to be used anywhere except in tests
    def grant(
        self,
        permission: AccessActionType,
        asset: RDBMSBase,
        user: AppUser,
        commit_now: bool = True,
    ) -> Sequence[AccessControlPolicy]:
        """ Grant a permission, or privilege on an asset to a user

        Returns the number of access control policies created
        from granting that privilege. Multiple policies
        may be created from a single permission or privilege.

        """
        retval = []
        policy = AccessControlPolicy(
            action=permission,
            asset_type=asset.__tablename__,
            asset_id=asset.id,
            principal_type=user.__tablename__,
            principal_id=user.id,
            rule_type=AccessRuleType.ALLOW,
        )

        existing_permissions_query = self.session.query(
            AccessControlPolicy.action,
        ).filter(
            and_(
                AccessControlPolicy.asset_id == asset.id,
                AccessControlPolicy.principal_id == user.id,
                AccessControlPolicy.rule_type == AccessRuleType.ALLOW,
            )
        )

        existing_permissions = [p[0] for p in existing_permissions_query.all()]

        if permission not in existing_permissions:
            self.session.add(policy)
            retval.append(policy)

            # 'write' permission implies 'read' permission
            if (permission == AccessActionType.WRITE and
                    AccessActionType.READ not in existing_permissions):
                p2 = AccessControlPolicy(
                    action=AccessActionType.READ,
                    asset_type=asset.__tablename__,
                    asset_id=asset.id,
                    principal_type=user.__tablename__,
                    principal_id=user.id,
                    rule_type=AccessRuleType.ALLOW,
                )
                self.session.add(p2)
                retval.append(p2)
        try:
            self.commit_or_flush(commit_now)
        except SQLAlchemyError:
            raise
        return retval

    # TODO: Doesn't seem to be used anywhere except in tests
    def revoke(
        self,
        permission: AccessActionType,
        asset: RDBMSBase,
        user: AppUser,
        commit_now: bool = True,
    ) -> None:
        """ Revokes a permission, or privilege on an asset to a user """
        # only removes the write permission on the specific asset
        if permission == AccessActionType.WRITE:
            AccessControlPolicy.query.filter(
                and_(
                    AccessControlPolicy.action == AccessActionType.WRITE,
                    AccessControlPolicy.asset_id == asset.id,
                    AccessControlPolicy.principal_id == user.id,
                    AccessControlPolicy.rule_type == AccessRuleType.ALLOW,
                )
            ).delete()
        elif permission == AccessActionType.READ:
            AccessControlPolicy.query.filter(
                and_(
                    AccessControlPolicy.action == AccessActionType.READ,
                    AccessControlPolicy.asset_id == asset.id,
                    AccessControlPolicy.rule_type == AccessRuleType.ALLOW,
                )
            ).delete()
        try:
            self.commit_or_flush(commit_now)
        except SQLAlchemyError:
            raise

    def has_role(
        self,
        principal: RDBMSBase,
        role: str,
    ) -> bool:
        # TODO: Add other principal types
        if isinstance(principal, AppUser):
            return role in [r.name for r in principal.roles]
        raise NotImplementedError

    def is_allowed(
        self,
        principal: RDBMSBase,
        action: AccessActionType,
        asset: RDBMSBase,
    ) -> bool:
        return self.has_allow_and_no_deny(
            AccessControlPolicy.query_acp(
                principal, asset, action
            ).all()
        )

    def has_allow_and_no_deny(
        self,
        acp: Iterable[AccessControlPolicy],
    ) -> bool:
        """ Return True if there is AT LEAST one 'ALLOW'
        rule and no 'DENY' rule in the list.

        Any 'DENY' rule overrides an 'ALLOW' rule
        for the same specificity
        """
        retval = False
        for access in acp:
            if access.rule_type == AccessRuleType.DENY:
                return False
            if access.rule_type == AccessRuleType.ALLOW:
                retval = True
        return retval
