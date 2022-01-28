from flask import g
from ..graphdb import get_neo4j_db
from .enrichment_visualisation import EnrichmentVisualisationService


def get_enrichment_visualisation_service():
    if "enrichment_visualisation_service" not in g:
        graph = get_neo4j_db()
        g.enrichment_visualisation_service = EnrichmentVisualisationService(graph=graph)
    return g.enrichment_visualisation_service
