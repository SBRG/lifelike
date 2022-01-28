import abc
from datetime import datetime

from neo4j.exceptions import ServiceUnavailable
from sqlalchemy.exc import SQLAlchemyError


class TransactionContext(metaclass=abc.ABCMeta):
    """Both __enter__ and __exit__ allows the class to be
    used with a `with` block.

    E.g
        engine = DatabaseConnection()
        with engine.begin() as session:
            ...

    E.g
        def __init__(self, conn):
            self.conn = conn

        def __enter__(self):
            self.session = self.conn.session()
            return self.session

        def __exit__(self, exc_type, exc_val, exc_traceback):
            self.session.close()

    This very much mirrors SQLAlchemy:
        https://github.com/sqlalchemy/sqlalchemy/blob/master/lib/sqlalchemy/future/engine.py#L394

    We don't need to do this for SQLAlchemy because
    flask-sqlalchemy does it for us, other databases we do.
    """
    @abc.abstractmethod
    def __enter__(self):
        raise NotImplementedError

    @abc.abstractmethod
    def __exit__(self, exc_type, exc_val, exc_traceback):
        raise NotImplementedError


class DatabaseConnection(metaclass=abc.ABCMeta):
    """Potentially using alongside a `with` context manager
    can have performance issues since python's `with` block is slow
    due to setting up a context manager.

    If multiple queries are needed within the same context, it might
    be worthwhile to implement:

    @property
    def session(self):
        if not self._session:
            self._session = self.conn.session()
        return self._session
    """
    @abc.abstractmethod
    def begin(self, **kwargs):
        """Needs to return an instance of TransactionContext
        as a nested class.
        """
        raise NotImplementedError


class GraphConnection(DatabaseConnection):
    def __init__(self, conn):
        self.conn = conn

    class _context(TransactionContext):
        def __init__(self, conn):
            self.conn = conn

        def __enter__(self):
            self.session = self.conn.session()
            return self.session

        def __exit__(self, exc_type, exc_val, exc_traceback):
            self.session.close()

    def convert_datetime(self, graph_date):
        """Convert a neo4j Datetime to python datetime"""
        return datetime(
            graph_date.year,
            graph_date.month,
            graph_date.day,
            graph_date.hour,
            graph_date.minute,
            int(graph_date.second),
            int(graph_date.second * 1000000 % 1000000),
            tzinfo=graph_date.tzinfo)

    def begin(self, **kwargs):
        return self._context(self.conn)

    def exec_read_query(self, query: str):
        try:
            with self.begin() as session:
                return session.read_transaction(lambda tx: list(tx.run(query)))
        except BrokenPipeError:
            raise BrokenPipeError(
                'The graph connection became stale while processing data. '
                'Please refresh the browser and try again.')
        except ServiceUnavailable:
            raise ServiceUnavailable(
                'Timed out trying to establish connection to the graph database. '
                'Please try again at a later time.')
        except Exception:
            raise

    def exec_write_query(self, query: str):
        try:
            with self.begin() as session:
                return session.write_transaction(lambda tx: list(tx.run(query)))
        except BrokenPipeError:
            raise BrokenPipeError(
                'The graph connection became stale while processing data, '
                'Please refresh the browser and try again.')
        except ServiceUnavailable:
            raise ServiceUnavailable(
                'Timed out trying to establish connection to the graph database. '
                'Please try again at a later time.')
        except Exception:
            raise

    def exec_read_query_with_params(self, query: str, values: dict):
        try:
            with self.begin() as session:
                return session.read_transaction(lambda tx: list(tx.run(query, **values)))
        except BrokenPipeError:
            raise BrokenPipeError(
                'The graph connection became stale while processing data, '
                'Please refresh the browser and try again.')
        except ServiceUnavailable:
            raise ServiceUnavailable(
                'Timed out trying to establish connection to the graph database. '
                'Please try again at a later time.')
        except Exception:
            raise

    def exec_write_query_with_params(self, query: str, values: dict):
        try:
            with self.begin() as session:
                return session.write_transaction(lambda tx: list(tx.run(query, **values)))
        except BrokenPipeError:
            raise BrokenPipeError(
                'The graph connection became stale while processing data, '
                'Please refresh the browser and try again.')
        except ServiceUnavailable:
            raise ServiceUnavailable(
                'Timed out trying to establish connection to the graph database. '
                'Please try again at a later time.')
        except Exception:
            raise


class GraphBaseDao:
    def __init__(self, graph, **kwargs):
        # TODO LL-2916: Should rename this to neo4j_session or something similar.
        # Also, use the correct typing.
        self.graph = graph
        super().__init__(**kwargs)


class RDBMSBaseDao:
    def __init__(self, session, **kwargs):
        self.session = session
        super().__init__(**kwargs)

    def exists(self, query) -> bool:
        return self.session.query(query.exists()).scalar()

    def commit(self):
        try:
            self.session.commit()
        except SQLAlchemyError:
            self.session.rollback()
            raise

    def commit_or_flush(self, commit_now=True):
        if commit_now:
            self.commit()
        else:
            self.session.flush()


class HybridDBDao(GraphBaseDao, RDBMSBaseDao):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
