import attr


@attr.s(frozen=True)
class EventLog():
    """ Used to describe a specific event """
    event_type: str = attr.ib()

    def to_dict(self):
        return attr.asdict(self)


@attr.s(frozen=True)
class UserEventLog(EventLog):
    """ Used to describe an event triggered by a user """
    username: str = attr.ib()


@attr.s(frozen=True)
class ErrorLog(UserEventLog, EventLog):
    """ Used to describe errors """
    error_name: str = attr.ib()
    expected: bool = attr.ib()
    transaction_id: str = attr.ib()


@attr.s(frozen=True)
class ClientErrorLog(ErrorLog):
    """ Used to describe client side errors """
    url: str = attr.ib()
