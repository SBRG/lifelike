from flask import Blueprint

from .auth import auth
from ..models.annotations import LMDB

URL_FETCH_MAX_LENGTH = 1024 * 1024 * 30
URL_FETCH_TIMEOUT = 10
DOWNLOAD_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' \
                      'Chrome/51.0.2704.103 Safari/537.36 Lifelike'

bp = Blueprint('files', __name__, url_prefix='/files')


# TODO: LL-415 Migrate the code to the projects folder once GUI is complete and API refactored
# is this used anymore?
@bp.route('/lmdbs_dates', methods=['GET'])
@auth.login_required
def get_lmdbs_dates():
    rows = LMDB.query.all()
    return {row.name: row.modified_date for row in rows}
