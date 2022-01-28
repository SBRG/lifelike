import attr

from neo4japp.models import AppUser
from neo4japp.util import CamelDictMixin

from typing import List


@attr.s(frozen=True)
class UserRequest(CamelDictMixin):
    hash_id: str = attr.ib()
    username: str = attr.ib()
    password: str = attr.ib()
    first_name: str = attr.ib()
    last_name: str = attr.ib()
    email: str = attr.ib()
    # failed_login_count: int = attr.ib()
    roles: List[str] = attr.ib(default=attr.Factory(list))


@attr.s(frozen=True)
class UserUpdateRequest(UserRequest):
    new_password: str = attr.ib(default='')


@attr.s(frozen=True)
class UserData(CamelDictMixin):
    id: str = attr.ib()
    username: str = attr.ib()

    @classmethod
    def from_model(cls, user: AppUser):
        if user is None:
            return None
        return UserData(
            id=user.id,
            username=user.username,
        )
