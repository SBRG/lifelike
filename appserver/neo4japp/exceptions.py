class ServerException(Exception):
    def __init__(self, title=None, message=None, additional_msgs=None, fields=None, code=500, *args):  # noqa
        """
        Create a new exception.
        :param title: the title of the error, which sometimes used on the client
        :param message: a message that can be displayed to the user
        :param additional_msgs: a list of messages that contain more details for the user
        :param code: the error code
        :param fields:
        :param args: extra args
        """
        if not title:
            title = 'We\'re sorry!'

        if not message:
            message = 'Looks like something went wrong!'

        self.title = title
        self.message = message
        self.additional_msgs = additional_msgs
        self.code = code
        self.fields = fields
        super().__init__(*args)

    @property
    def stacktrace(self):
        return self._stacktrace

    @stacktrace.setter
    def stacktrace(self, stacktrace):
        self._stacktrace = stacktrace

    @property
    def version(self):
        return self._version

    @version.setter
    def version(self, version):
        self._version = version

    @property
    def transaction_id(self):
        return self._transaction_id

    @transaction_id.setter
    def transaction_id(self, transaction_id):
        self._transaction_id = transaction_id

    def __str__(self):
        return f'<Exception> {self.title}:{self.message}'

    def to_dict(self):
        retval = {}
        retval['title'] = self.title
        retval['message'] = self.message
        return retval


class StatisticalEnrichmentError(ServerException):
    def __init__(self, title=None, message=None, additional_msgs=[], code=500):
        super().__init__(
            title=title,
            message=message,
            additional_msgs=additional_msgs,
            code=code)


class AnnotationError(ServerException):
    def __init__(self, title=None, message=None, additional_msgs=[], code=500):
        super().__init__(
            title=title,
            message=message,
            additional_msgs=additional_msgs,
            code=code)


class LMDBError(ServerException):
    def __init__(self, title=None, message=None, additional_msgs=[], code=500):
        super().__init__(
            title=title,
            message=message,
            additional_msgs=additional_msgs,
            code=code)


class FileUploadError(ServerException):
    def __init__(self, title=None, message=None, additional_msgs=[], code=500):
        super().__init__(
            title=title,
            message=message,
            additional_msgs=additional_msgs,
            code=code)


class NotAuthorized(ServerException):
    def __init__(self, title=None, message=None, additional_msgs=[], code=403):
        super().__init__(
            title=title,
            message=message,
            additional_msgs=additional_msgs,
            code=code)


class RecordNotFound(ServerException):
    def __init__(self, title=None, message=None, additional_msgs=[], code=404):
        super().__init__(
            title=title,
            message=message,
            additional_msgs=additional_msgs,
            code=code)


class InvalidArgument(ServerException):
    def __init__(self, title=None, message=None, additional_msgs=[], code=400):
        super().__init__(
            title=title,
            message=message,
            additional_msgs=additional_msgs,
            code=code)


class JWTTokenException(ServerException):
    """Signals JWT token issue"""

    def __init__(self, title=None, message=None, additional_msgs=[], code=401):
        super().__init__(
            title=title,
            message=message,
            additional_msgs=additional_msgs,
            code=code)


class JWTAuthTokenException(JWTTokenException):
    """Signals the JWT auth token has an issue"""

    def __init__(self, title=None, message=None, additional_msgs=[], code=401):
        super().__init__(
            title=title,
            message=message,
            additional_msgs=additional_msgs,
            code=code)


class FormatterException(ServerException):
    """Signals that a CamelDictMixin object was not formatted to/from
    dict correctly."""

    def __init__(self, title=None, message=None, additional_msgs=[], code=500):
        super().__init__(
            title=title,
            message=message,
            additional_msgs=additional_msgs,
            code=code)


# TODO: finish this
# class FilesystemAccessRequestRequired(ServerException):
#     """
#     Raised when access needs to be requested for a file or folder. The end goal is to
#     provide enough data in this error to the client that we can pop up a
#     dialog to allow the user to request permission. As of writing, this error has not been
#     fleshed out and will probably need rethinking.

#     On the client, this error just shows a generic permission error.

#     We may want to merge this exception with AccessRequestRequiredError.
#     """

#     def __init__(self, message=None, file_hash_id):
#         super().__init__('Access Request Required Error',
#                          message,
#                          code='access_request_required',
#                          error_return_props={
#                              'request': {
#                                  'file': {
#                                      'hash_id': file_hash_id,
#                                  }
#                              }
#                          })


class AccessRequestRequiredError(ServerException):
    """
    Raised when access needs to be requested for a project. The end goal is to
    provide enough data in this error to the client that we can pop up a
    dialog to allow the user to request permission. As of writing, this error has not been
    fleshed out and will probably need rethinking.

    On the client, this error just shows a generic permission error.

    We may want to merge this exception with FilesystemAccessRequestRequired.
    """
    def __init__(self, curr_access, req_access, hash_id, additional_msgs=[], code=403):  # noqa
        message = f'You have "{curr_access}" access. Please request "{req_access}" ' \
                  f'access at minimum for this content.'
        super().__init__(
            'You need access',
            message=message,
            additional_msgs=additional_msgs,
            code=code)
