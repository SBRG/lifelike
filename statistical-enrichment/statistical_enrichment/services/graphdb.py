import os

from flask import g
from neo4j import GraphDatabase, basic_auth

HOST = os.getenv("NEO4J_HOST", "localhost")
PORT = os.getenv("NEO4J_PORT", "7687")
SCHEME = os.getenv("NEO4J_SCHEME", "bolt")
AUTH = os.getenv("NEO4J_AUTH", "neo4j/password")
DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

url = f"{SCHEME}://{HOST}:{PORT}/{DATABASE}"
auth = basic_auth(*AUTH.split("/", 1))
driver = GraphDatabase.driver(url, auth=auth)


def get_neo4j_db():
    if not hasattr(g, "neo4j_db"):
        g.neo4j_db = driver.session()
    return g.neo4j_db
