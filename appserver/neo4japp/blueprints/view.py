import json
from typing import Dict

from flask import Blueprint, Response
from flask.views import MethodView
from flask_marshmallow import Schema
from webargs import fields
from webargs.flaskparser import use_args

from neo4japp.database import db
from neo4japp.models.views import View

bp = Blueprint('view', __name__, url_prefix='/view')


class SankeyViewSchema(Schema):
    networkTraceIdx = fields.Integer()
    viewBase = fields.Str()
    viewName = fields.Str()


class ViewBaseView(MethodView):
    def get(self, view_id):
        params = db.session.query(View.params) \
            .filter(View.id == view_id) \
            .one()[0]
        return json.dumps(params)

    @use_args(SankeyViewSchema, locations=['json'])
    def post(self, params: Dict):
        view = View()
        view_id = view.get_or_create(params).id
        db.session.commit()
        return Response(str(view_id), mimetype="text/plain")


bp.add_url_rule('/<int:view_id>', view_func=ViewBaseView.as_view('view'))
bp.add_url_rule('/', view_func=ViewBaseView.as_view('set_view'))
