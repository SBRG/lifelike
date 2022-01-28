from neo4japp.database import ma


class GlobalAnnotationsDeleteSchema(ma.Schema):
    pids = ma.List(ma.Integer())
