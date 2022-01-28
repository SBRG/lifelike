import os
from typing import Dict

from flask import Flask
from flask_marshmallow import Marshmallow


def create_app(test_config: Dict = None):
    """Create and configure an instance of the Flask application."""
    app = Flask(__name__)

    app.config.from_envvar("CONFIG_SETTINGS", silent=True)

    if test_config:
        app.config.update(test_config)

    Marshmallow().init_app(app)

    @app.get("/healthz")
    def healthz():
        return "Ok"

    # Apply the blueprints to the app
    from .views import bp

    app.register_blueprint(bp)

    # Initialize Elastic APM if configured
    if os.getenv("ELASTIC_APM_SERVER_URL"):
        from elasticapm.contrib.flask import ElasticAPM

        ElasticAPM(app)

    return app
