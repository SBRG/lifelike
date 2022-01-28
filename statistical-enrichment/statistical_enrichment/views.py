from flask import Blueprint, jsonify
from webargs.flaskparser import use_args

from .schemas import EnrichmentSchema
from .services import get_enrichment_visualisation_service, redis_cached

bp = Blueprint("statistical_enrichment", __name__, url_prefix="/")


@bp.post("/enrich-with-go-terms")
@use_args(EnrichmentSchema)
def enrich_go(args):
    gene_names = args["geneNames"]
    organism = args["organism"]
    analysis = args["analysis"]

    return jsonify(
        redis_cached(
            f'enrich_go_{",".join(gene_names)}_{analysis}_{organism}',
            lambda: get_enrichment_visualisation_service().enrich_go(
                gene_names, analysis, organism
            ),
        )
    )
