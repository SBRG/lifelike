import pytest
from neo4japp.models import (
    AccessRuleType,
    AccessActionType,
    AccessControlPolicy
)


@pytest.mark.parametrize('permission, expected', [
    (AccessActionType.READ, [AccessActionType.READ]),
    (AccessActionType.WRITE, [AccessActionType.READ, AccessActionType.WRITE]),
])
def test_can_grant_permissions(
        fix_owner, auth_service, fix_project,
        permission, expected):
    policies = auth_service.grant(
        permission, fix_project, fix_owner)
    for policy in policies:
        assert policy.action in expected


@pytest.mark.parametrize('revoke_permission', [
    AccessActionType.READ,
    AccessActionType.WRITE,
])
def test_can_revoke_permissions(
        fix_owner, auth_service, fix_project,
        revoke_permission, session):
    acp = AccessControlPolicy(
        action=revoke_permission,
        asset_type='project',
        asset_id=fix_project.id,
        principal_type='user',
        principal_id=fix_owner.id,
        rule_type=AccessRuleType.ALLOW
    )
    session.add(acp)
    session.flush()
    acp_id = acp.id

    assert AccessControlPolicy.query.get(acp_id)

    auth_service.revoke(
        revoke_permission,
        fix_project,
        fix_owner,
    )

    assert AccessControlPolicy.query.get(acp_id) is None
