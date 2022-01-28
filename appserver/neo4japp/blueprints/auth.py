import jwt
import sentry_sdk

from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

from datetime import datetime, timedelta, timezone
from flask import current_app, request, Blueprint, g, jsonify
from flask_httpauth import HTTPTokenAuth
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.exc import NoResultFound
from typing_extensions import TypedDict

from neo4japp.database import db
from neo4japp.constants import LogEventType, MAX_ALLOWED_LOGIN_FAILURES
from neo4japp.exceptions import (
    JWTTokenException,
    JWTAuthTokenException,
    ServerException,
)
from neo4japp.schemas.auth import JWTTokenResponse
from neo4japp.models.auth import AppUser
from neo4japp.utils.logger import EventLog, UserEventLog


bp = Blueprint('auth', __name__, url_prefix='/auth')

auth = HTTPTokenAuth('Bearer')


JWTToken = TypedDict(
    'JWTToken', {'sub': str, 'iat': datetime, 'exp': datetime, 'token_type': str, 'token': str})

JWTResp = TypedDict(
    'JWTResp', {'sub': str, 'iat': str, 'exp': int, 'type': str})


class TokenService:

    def __init__(self, app_secret: str, algorithm: str = 'HS256'):
        self.app_secret = app_secret
        # See JWT library documentation for available algorithms
        self.algorithm = algorithm

    def _generate_jwt_token(
            self,
            sub: str,
            secret: str,
            token_type: str = 'access',
            time_offset: int = 1,
            time_unit: str = 'hours',
    ) -> JWTToken:
        """
        Generates an authentication or refresh JWT Token

        Args:
            sub - the subject of the token (e.g. user email)
            secret - secret that should not be shared for encryption
            token_type - one of 'access' or 'refresh'
            time_offset - the difference in time before token expiration
            time_unit - time offset for expiration (days, hours, etc) (see datetime docs)
        """
        time_now = datetime.now(timezone.utc)
        expiration = time_now + timedelta(**{time_unit: time_offset})
        token = jwt.encode({
            'iat': time_now,
            'sub': sub,
            'exp': expiration,
            'type': token_type,
        }, secret, algorithm=self.algorithm).decode('utf-8')
        return {
            'sub': sub,
            'iat': time_now,
            'exp': expiration,
            'token_type': token_type,
            'token': token
        }

    def get_access_token(
            self, subj, token_type='access', time_offset=1, time_unit='hours') -> JWTToken:
        return self._generate_jwt_token(
            sub=subj, secret=self.app_secret, token_type=token_type,
            time_offset=time_offset, time_unit=time_unit)

    def get_refresh_token(
            self, subj, token_type='refresh', time_offset=7, time_unit='days') -> JWTToken:
        return self._generate_jwt_token(
            sub=subj, secret=self.app_secret, token_type=token_type,
            time_offset=time_offset, time_unit=time_unit)

    def decode_token(self, token: str) -> JWTResp:
        try:
            payload = jwt.decode(token, self.app_secret, algorithms=[self.algorithm])
            jwt_resp: JWTResp = {
                'sub': payload['sub'], 'iat': payload['iat'], 'exp': payload['exp'],
                'type': payload['type']}
        # default to generic error message
        # NOTE: is this better than avoiding to
        # display an error message about
        # authorization header (for security purposes)?
        except InvalidTokenError:
            raise JWTTokenException(
                title='Failed to Authenticate',
                message='The current authentication session is invalid, please try logging back in.')  # noqa
        except ExpiredSignatureError:
            raise JWTTokenException(
                title='Failed to Authenticate',
                message='The current authentication session has expired, please try logging back in.')  # noqa
        else:
            return jwt_resp


@auth.verify_token
def verify_token(token):
    """ Verify JWT """
    token_service = TokenService(current_app.config['JWT_SECRET'])
    decoded = token_service.decode_token(token)
    if decoded['type'] == 'access':
        token = request.headers.get('Authorization')
        if token is None:
            current_app.logger.error(
                f'No authorization header found <{request.headers}>.',
                extra=EventLog(event_type=LogEventType.AUTHENTICATION.value).to_dict()
            )
            # default to generic error message
            # NOTE: is this better than avoiding to
            # display an error message about
            # authorization header (for security purposes)?
            raise JWTAuthTokenException(
                title='Failed to Authenticate',
                message='There was a problem verifying the authentication session, please try again.')  # noqa
        else:
            token = token.split(' ')[-1].strip()
            try:
                user = AppUser.query_by_email(decoded['sub']).one()
                current_app.logger.info(
                    f'Active user: {user.email}',
                    extra=UserEventLog(
                        username=user.username,
                        event_type=LogEventType.LAST_ACTIVE.value).to_dict()
                )
            except NoResultFound:
                raise ServerException(
                    title='Failed to Authenticate',
                    message='There was a problem authenticating, please try again.',
                    code=404)
            else:
                g.current_user = user
                with sentry_sdk.configure_scope() as scope:
                    scope.set_tag('user_email', user.email)
                return True
    else:
        raise ServerException(
            title='Failed to Authenticate',
            message='There was a problem authenticating, please try again.')


@bp.route('/refresh', methods=['POST'])
def refresh():
    """ Renew access token with refresh token """
    data = request.get_json()
    token = data.get('jwt')
    token_service = TokenService(current_app.config['JWT_SECRET'])
    decoded = token_service.decode_token(token)
    if decoded['type'] != 'refresh':
        raise JWTTokenException(
            message='Your authentication session expired, but there was an error attempting to renew it.')  # noqa

    # Create access & refresh token pair
    token_subj = decoded['sub']
    access_jwt = token_service.get_access_token(token_subj)
    refresh_jwt = token_service.get_refresh_token(token_subj)

    try:
        user = AppUser.query.filter_by(email=decoded['sub']).one()
    except NoResultFound:
        raise ServerException(
            title='Failed to Authenticate',
            message='There was a problem authenticating, please try again.',
            code=404)
    else:
        return jsonify(JWTTokenResponse().dump({
            'access_token': access_jwt,
            'refresh_token': refresh_jwt,
            'user': {
                'hash_id': user.hash_id,
                'email': user.email,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'id': user.id,
                'roles': [u.name for u in user.roles],
            },
        }))


@bp.route('/login', methods=['POST'])
def login():
    """
        Generate JWT to validate graph API calls
        based on successful user login
    """
    data = request.get_json()

    # Pull user by email
    try:
        user = AppUser.query.filter_by(email=data.get('email')).one()
    except NoResultFound:
        raise ServerException(
            title='Failed to Authenticate',
            message='There was a problem authenticating, please try again.',
            code=404)
    else:
        if user.failed_login_count >= MAX_ALLOWED_LOGIN_FAILURES:
            raise ServerException(
                title='Failed to Login',
                message='The account has been suspended after too many failed login attempts.\
                Please contact an administrator for help.',
                code=423)
        elif user.check_password(data.get('password')):
            current_app.logger.info(
                UserEventLog(
                    username=user.username,
                    event_type=LogEventType.AUTHENTICATION.value).to_dict())
            token_service = TokenService(current_app.config['JWT_SECRET'])
            access_jwt = token_service.get_access_token(user.email)
            refresh_jwt = token_service.get_refresh_token(user.email)
            user.failed_login_count = 0
            return jsonify(JWTTokenResponse().dump({
                'access_token': access_jwt,
                'refresh_token': refresh_jwt,
                'user': {
                    'hash_id': user.hash_id,
                    'email': user.email,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'id': user.id,
                    'reset_password': user.forced_password_reset,
                    'roles': [u.name for u in user.roles],
                },
            }))
        else:
            user.failed_login_count += 1
            try:
                db.session.add(user)
                db.session.commit()
            except SQLAlchemyError:
                db.session.rollback()
                raise

            raise ServerException(
                title='Failed to Authenticate',
                message='There was a problem authenticating, please try again.',
                code=404)
