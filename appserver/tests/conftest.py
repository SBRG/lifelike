import pytest
import os

from neo4j import GraphDatabase, Session, Transaction, basic_auth
from neo4j.graph import Node, Relationship
from pathlib import Path
from typing import Optional

from neo4japp.services.common import GraphBaseDao
from neo4japp.constants import DISPLAY_NAME_MAP
from neo4japp.database import db, reset_dao
from neo4japp.data_transfer_objects.visualization import (
    DuplicateEdgeConnectionData,
    DuplicateVisEdge,
    DuplicateVisNode,
    EdgeConnectionData,
    ReferenceTablePair,
    VisEdge,
    VisNode,
)
from neo4japp.factory import create_app
from neo4japp.models.neo4j import (
    GraphNode,
    GraphRelationship,
)
from neo4japp.services import (
    AccountService,
    AuthService,
    KgService,
    VisualizerService,
)
from neo4japp.services.elastic import ElasticService
from neo4japp.util import (
    get_first_known_label_from_node,
    snake_to_camel_dict,
)


@pytest.fixture(scope='function')
def app(request):
    """Session-wide test Flask application."""
    app = create_app('Functional Test Flask App', config='config.Testing')

    # Establish an application context before running the tests.
    ctx = app.app_context()
    ctx.push()

    def teardown():
        ctx.pop()

    request.addfinalizer(teardown)
    return app


@pytest.fixture(scope='function')
def session(app, request):
    """ Creates a new database session """
    connection = db.engine.connect()
    transaction = connection.begin()
    options = {'bind': connection, 'binds': {}}
    session = db.create_scoped_session(options=options)
    db.session = session

    def teardown():
        transaction.rollback()
        connection.close()
        session.remove()
        reset_dao()

    request.addfinalizer(teardown)
    return session


@pytest.fixture(scope='function')
def graph(request, app) -> Session:
    """Returns a graph connection to the Neo4J database.
    IMPORTANT: Tests may not behave as expected if the
    Neo4J database is not cleared before running tests!
    """
    host = os.getenv('NEO4J_HOST', 'localhost')
    scheme = os.getenv('NEO4J_SCHEME', 'bolt')
    port = os.getenv('NEO4J_PORT', '7687')
    url = f'{scheme}://{host}:{port}'
    username, password = os.getenv('NEO4J_AUTH', 'neo4j/password').split('/')
    driver = GraphDatabase.driver(url, auth=basic_auth(username, password))

    graph = driver.session()

    # Ensure a clean graph state before every test
    graph.write_transaction(lambda tx: tx.run('MATCH(n) DETACH DELETE n'))

    def teardown():
        graph.close()

    request.addfinalizer(teardown)
    return graph


@pytest.fixture(scope='function')
def graph_driver(request, app):
    host = os.getenv('NEO4J_HOST', 'localhost')
    scheme = os.getenv('NEO4J_SCHEME', 'bolt')
    port = os.getenv('NEO4J_PORT', '7687')
    url = f'{scheme}://{host}:{port}'
    username, password = os.getenv('NEO4J_AUTH', 'neo4j/password').split('/')
    return GraphDatabase.driver(url, auth=basic_auth(username, password))


@pytest.fixture(scope='function')
def account_service(app, session):
    return AccountService(session)


@pytest.fixture(scope='function')
def auth_service(app, session):
    return AuthService(session)


@pytest.fixture(scope='function')
def account_user(app, session):
    return AccountService(session)


@pytest.fixture(scope='function')
def kg_service(graph, session):
    return KgService(
        graph=graph,
        session=session
    )


@pytest.fixture(scope='function')
def visualizer_service(app, graph, session):
    return VisualizerService(
        graph=graph,
        session=session
    )


@pytest.fixture(scope='function')
def elastic_service(app, session):
    elastic_service = ElasticService()

    # Ensures that anytime the elastic service is requested for a test, that the environment is
    # clean
    elastic_service.recreate_indices_and_pipelines()

    return elastic_service

# Begin Graph Data Fixtures #

# Begin Graph Data Helpers #


def create_chemical_node(tx: Transaction, chem_name: str, chem_id: str) -> Node:
    """Creates a chemical node and adds it to the graph."""
    query = """
        CREATE (c:Chemical {name: $chem_name, eid: $chem_id}) RETURN c
    """
    return tx.run(
        query, chem_name=chem_name, chem_id=chem_id
    ).single()['c']


def create_disease_node(tx: Transaction, disease_name: str, disease_id: str) -> Node:
    """Creates a disease node and adds it to the graph."""
    query = """
        CREATE (d:Disease {name: $disease_name, eid: $disease_id}) RETURN d
    """
    return tx.run(
        query, disease_name=disease_name, disease_id=disease_id
    ).single()['d']


def create_gene_node(
    tx: Transaction,
    gene_name: str,
    gene_id: str,
) -> Node:
    """Creates a gene node and adds it to the graph."""
    query = """
        CREATE (g:Gene {name: $gene_name, eid: $gene_id}) RETURN g
    """
    return tx.run(
        query, gene_name=gene_name, gene_id=gene_id
    ).single()['g']


def create_taxonomy_node(
    tx: Transaction,
    name: str,
    rank: str,
    tax_id: str,
) -> Node:
    """Creates a taxonomy node and adds it to the graph."""
    query = """
        CREATE (t:Taxonomy {tax_id: $tax_id, name: $name, rank: $rank}) RETURN t
    """
    return tx.run(
        query,
        name=name,
        rank=rank,
        tax_id=tax_id
    ).single()['t']


def create_association_node(
    tx: Transaction,
    assoc_type: str,
    description: str,
    assoc_id: int
) -> Node:
    """Creates an association node and adds it to the graph."""
    query = """
        CREATE (a:Association {assoc_type: $assoc_type, description: $description, eid: $assoc_id})
        RETURN a
    """
    return tx.run(
        query, assoc_type=assoc_type, description=description, assoc_id=assoc_id
    ).single()['a']


def create_snippet_node(
    tx: Transaction,
    snippet_id: int,
    sentence: str
) -> Node:
    """Creates a snippet node and adds it to the graph."""
    query = """
        CREATE (s:Snippet {
            eid: $snippet_id,
            sentence: $sentence
        }) RETURN s
    """
    return tx.run(
        query,
        snippet_id=snippet_id,
        sentence=sentence
    ).single()['s']


def create_publication_node(
    tx: Transaction,
    pub_id: int,
    pub_year: Optional[int] = None,
) -> Node:
    """Creates a publication node and adds it to the graph."""
    query = """
        CREATE (p:Publication {pmid: $pub_id, pub_year: $pub_year}) RETURN p
    """
    return tx.run(
        query, pub_id=pub_id, pub_year=pub_year
    ).single()['p']


def create_associated_relationship(
    tx: Transaction,
    source_id: int,
    target_id: int,
    assoc_type: str,
    description: str,
) -> Relationship:
    """
    Creates an association relationship between two nodes (these should already be in the
    graph!) and adds it to the graph.
    """
    query = """
        MATCH (source) WHERE ID(source)=$source_id
        MATCH (target) WHERE ID(target)=$target_id
        CREATE
            (source)-[r:ASSOCIATED {assoc_type: $assoc_type, description: $description}]->(target)
        RETURN r, source, target
    """
    result = tx.run(
        query,
        source_id=source_id,
        target_id=target_id,
        assoc_type=assoc_type,
        description=description
    )
    single = result.single()
    return single['r']


def create_has_association_relationship(
    tx: Transaction,
    source_id: int,
    target_id: int
) -> Relationship:
    """
    Creates a has_association relationship between two nodes (these should already be in the
    graph!) and adds it to the graph.
    """
    query = """
        MATCH (source) WHERE ID(source)=$source_id
        MATCH (target) WHERE ID(target)=$target_id
        CREATE (source)-[r:HAS_ASSOCIATION]->(target)
        RETURN r, source, target
    """
    return tx.run(
        query,
        source_id=source_id,
        target_id=target_id
    ).single()['r']


def create_predicts_relationship(
    tx: Transaction,
    source_id: int,
    target_id: int,
    entry1_text: str,
    entry2_text: str,
    raw_score: Optional[float] = None,
    normalized_score: Optional[float] = None,
) -> Relationship:
    """
    Creates a predicts relationship between two nodes (these should already be in the
    graph!) and adds it to the graph.
    """
    query = """
        MATCH (source) WHERE ID(source)=$source_id
        MATCH (target) WHERE ID(target)=$target_id
        CREATE (source)-[r:INDICATES {
            entry1_text: $entry1_text,
            entry2_text: $entry2_text,
            raw_score: $raw_score,
            normalized_score: $normalized_score
        }]->(target)
        RETURN r, source, target
    """
    return tx.run(
        query,
        entry1_text=entry1_text,
        entry2_text=entry2_text,
        source_id=source_id,
        target_id=target_id,
        raw_score=raw_score,
        normalized_score=normalized_score
    ).single()['r']


def create_in_pub_relationship(
    tx: Transaction,
    source_id: int,
    target_id: int
) -> Relationship:
    """
    Creates an in_pub relationship between two nodes (these should already be in the
    graph!) and adds it to the graph.
    """
    query = """
        MATCH (source) WHERE ID(source)=$source_id
        MATCH (target) WHERE ID(target)=$target_id
        CREATE (source)-[r:IN_PUB]->(target)
        RETURN r, source, target
    """
    return tx.run(
        query,
        source_id=source_id,
        target_id=target_id
    ).single()['r']


def create_has_taxonomy_relationship(
    tx: Transaction,
    source_id: int,
    target_id: int
) -> Relationship:
    """
    Creates a has_taxonomy relationship between two nodes (these should already be in the
    graph!) and adds it to the graph.
    """
    query = """
        MATCH (source) WHERE ID(source)=$source_id
        MATCH (target) WHERE ID(target)=$target_id
        CREATE (source)-[r:HAS_TAXONOMY]->(target)
        RETURN r, source, target
    """
    return tx.run(
        query,
        source_id=source_id,
        target_id=target_id
    ).single()['r']

# End Graph Data Helpers #


# Begin Entity Node Fixtures #
@pytest.fixture(scope='function')
def gas_gangrene(graph: Session) -> Node:
    with graph.begin_transaction() as tx:
        gas_gangrene = create_disease_node(tx, 'gas gangrene', 'MESH:D005738')
    return gas_gangrene


@pytest.fixture(scope='function')
def penicillins(graph: Session) -> Node:
    with graph.begin_transaction() as tx:
        penicillins = create_chemical_node(tx, 'Penicillins', 'MESH:D010406')
    return penicillins


@pytest.fixture(scope='function')
def oxygen(graph: Session) -> Node:
    with graph.begin_transaction() as tx:
        oxygen = create_chemical_node(tx, 'Oxygen', 'MESH:D010100')
    return oxygen


@pytest.fixture(scope='function')
def pomc(graph: Session) -> Node:
    with graph.begin_transaction() as tx:
        pomc = create_gene_node(tx, 'POMC', '5443')
    return pomc


# End Entity Nodes Fixtures #

# Begin Entity -> Entity Relationship Fixtures #

@pytest.fixture(scope='function')
def pomc_to_gas_gangrene_pathogenesis_edge(
    graph: Session,
    gas_gangrene: Node,
    pomc: Node,
) -> Relationship:
    with graph.begin_transaction() as tx:
        pomc_to_gas_gangrene_pathogenesis_edge = create_associated_relationship(
            tx=tx,
            source_id=pomc.id,
            target_id=gas_gangrene.id,
            assoc_type='J',
            description='role in disease pathogenesis',
        )
    return pomc_to_gas_gangrene_pathogenesis_edge


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_alleviates_edge(
    graph: Session,
    gas_gangrene: Node,
    penicillins: Node,
) -> Relationship:
    with graph.begin_transaction() as tx:
        penicillins_to_gas_gangrene_alleviates_edge = create_associated_relationship(
            tx=tx,
            source_id=penicillins.id,
            target_id=gas_gangrene.id,
            assoc_type='Pa',
            description='alleviates, reduces',
        )
    return penicillins_to_gas_gangrene_alleviates_edge


@pytest.fixture(scope='function')
def oxygen_to_gas_gangrene_treatment_edge(
    graph: Session,
    gas_gangrene: Node,
    oxygen: Node,
) -> Relationship:
    with graph.begin_transaction() as tx:
        oxygen_to_gas_gangrene_treatment_edge = create_associated_relationship(
            tx=tx,
            source_id=oxygen.id,
            target_id=gas_gangrene.id,
            assoc_type='Pa',
            description='treatment/therapy (including investigatory)',
        )
    return oxygen_to_gas_gangrene_treatment_edge


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_treatment_edge(
    graph: Session,
    gas_gangrene: Node,
    penicillins: Node,
) -> Relationship:
    with graph.begin_transaction() as tx:
        penicillins_to_gas_gangrene_treatment_edge = create_associated_relationship(
            tx=tx,
            source_id=penicillins.id,
            target_id=gas_gangrene.id,
            assoc_type='Pa',
            description='treatment/therapy (including investigatory)',
        )
    return penicillins_to_gas_gangrene_treatment_edge

# End Entity -> Entity Relationship Fixtures #


# Start Misc. Fixtures #
@pytest.fixture(scope='function')
def gas_gangrene_with_associations_and_references(
    graph: Session,
    gas_gangrene: Node,
    oxygen: Node,
    penicillins: Node,
    pomc: Node,
    oxygen_to_gas_gangrene_treatment_edge: Relationship,
    pomc_to_gas_gangrene_pathogenesis_edge: Relationship,
    penicillins_to_gas_gangrene_alleviates_edge: Relationship,
    penicillins_to_gas_gangrene_treatment_edge: Relationship,
):
    with graph.begin_transaction() as tx:
        # Association Nodes
        oxygen_to_gas_gangrene_association_node = create_association_node(
            tx=tx,
            assoc_type='J',
            description='treatment/therapy (including investigatory)',
            assoc_id=1089126,
        )
        pomc_to_gas_gangrene_association_node = create_association_node(
            tx=tx,
            assoc_type='J',
            description='role in disease pathogenesis',
            assoc_id=1387448,
        )
        penicillins_to_gas_gangrene_association_node1 = create_association_node(
            tx=tx,
            assoc_type='Pa',
            description='alleviates, reduces',
            assoc_id=2771500,
        )
        penicillins_to_gas_gangrene_association_node2 = create_association_node(
            tx=tx,
            assoc_type='J',
            description='treatment/therapy (including investigatory)',
            assoc_id=2771501,
        )

        # Snippet Nodes
        oxygen_to_gas_gangrene_snippet_node1 = create_snippet_node(
            tx=tx,
            snippet_id=7430189,
            sentence='In this study , we aimed to investigate the effect of HBO2...',
        )
        oxygen_to_gas_gangrene_snippet_node2 = create_snippet_node(
            tx=tx,
            snippet_id=1890743,
            sentence='Hyperbaric oxygen therapy has an adjunctive role...',
        )
        penicillins_to_gas_gangrene_snippet_node1 = create_snippet_node(
            tx=tx,
            snippet_id=9810347,
            sentence='In a mouse model of gas_gangrene caused by...',
        )
        penicillins_to_gas_gangrene_snippet_node2 = create_snippet_node(
            tx=tx,
            snippet_id=9810346,
            sentence='Toxin suppression and rapid bacterial killing may...',
        )
        penicillins_to_gas_gangrene_snippet_node3 = create_snippet_node(
            tx=tx,
            snippet_id=9810348,
            sentence='...penicillin was found to reduce the affect of...',
        )
        penicillins_to_gas_gangrene_snippet_node4 = create_snippet_node(
            tx=tx,
            snippet_id=9810349,
            sentence='...suppresses toxins and rapidly kills bacteria...',
        )

        # Publication Nodes
        oxygen_to_gas_gangrene_publication_node = create_publication_node(
            tx=tx,
            pub_id=3,
            pub_year=2019,
        )
        penicillins_to_gas_gangrene_publication_node1 = create_publication_node(
            tx=tx,
            pub_id=1,
            pub_year=2014
        )
        penicillins_to_gas_gangrene_publication_node2 = create_publication_node(
            tx=tx,
            pub_id=2,
        )

        # Entity -> Association Relationships
        entity_to_association_rels = [
            [oxygen, oxygen_to_gas_gangrene_association_node],
            [pomc, pomc_to_gas_gangrene_association_node],
            [penicillins, penicillins_to_gas_gangrene_association_node1],
            [penicillins, penicillins_to_gas_gangrene_association_node2]
        ]
        for rel in entity_to_association_rels:
            create_has_association_relationship(
                tx=tx,
                source_id=rel[0].id,
                target_id=rel[1].id
            )

        # Association -> Entity Relationships
        association_to_entity_rels = [
            [oxygen_to_gas_gangrene_association_node, gas_gangrene],
            [pomc_to_gas_gangrene_association_node, gas_gangrene],
            [penicillins_to_gas_gangrene_association_node1, gas_gangrene],
            [penicillins_to_gas_gangrene_association_node2, gas_gangrene]
        ]
        for rel in association_to_entity_rels:
            create_has_association_relationship(
                tx=tx,
                source_id=rel[0].id,
                target_id=rel[1].id,
            )

        # Snippet -> Association Relationships
        snippet_to_association_rels = [
            [oxygen_to_gas_gangrene_snippet_node1, oxygen_to_gas_gangrene_association_node, None, None, 'oxygen', 'gas gangrene'],  # noqa
            [oxygen_to_gas_gangrene_snippet_node2, oxygen_to_gas_gangrene_association_node, None, None, 'oxygen', 'gas gangrene'],  # noqa
            [penicillins_to_gas_gangrene_snippet_node1, penicillins_to_gas_gangrene_association_node1, 2, 0.385, 'penicillin', 'gas gangrene'],  # noqa
            [penicillins_to_gas_gangrene_snippet_node3, penicillins_to_gas_gangrene_association_node1, 5, 0.693, 'penicillin', 'gas gangrene'],  # noqa
            [penicillins_to_gas_gangrene_snippet_node2, penicillins_to_gas_gangrene_association_node2, 1, 0.222, 'penicillin', 'gas gangrene'],  # noqa
            [penicillins_to_gas_gangrene_snippet_node4, penicillins_to_gas_gangrene_association_node2, 3, 0.456, 'penicillin', 'gas gangrene'],  # noqa
        ]
        for rel in snippet_to_association_rels:
            create_predicts_relationship(
                tx=tx,
                source_id=rel[0].id,
                target_id=rel[1].id,
                raw_score=rel[2],
                normalized_score=rel[3],
                entry1_text=rel[4],
                entry2_text=rel[5],
            )

        # Snippet -> Publication Relationships
        snippet_to_pub_rels = [
            [oxygen_to_gas_gangrene_snippet_node1, oxygen_to_gas_gangrene_publication_node],
            [oxygen_to_gas_gangrene_snippet_node2, oxygen_to_gas_gangrene_publication_node],
            [penicillins_to_gas_gangrene_snippet_node1, penicillins_to_gas_gangrene_publication_node1],  # noqa
            [penicillins_to_gas_gangrene_snippet_node3, penicillins_to_gas_gangrene_publication_node2],  # noqa
            [penicillins_to_gas_gangrene_snippet_node2, penicillins_to_gas_gangrene_publication_node2],  # noqa
            [penicillins_to_gas_gangrene_snippet_node4, penicillins_to_gas_gangrene_publication_node2]  # noqa
        ]
        for rel in snippet_to_pub_rels:
            create_in_pub_relationship(
                tx=tx,
                source_id=rel[0].id,
                target_id=rel[1].id
            )
    return gas_gangrene


@pytest.fixture(scope='function')
def example4_pdf_gene_and_organism_network(
    graph: Session,
):
    with graph.begin_transaction() as tx:
        cysB = create_gene_node(
            tx=tx,
            gene_name='cysB',
            gene_id='945771',
        )

        mcrB = create_gene_node(
            tx=tx,
            gene_name='mcrB',
            gene_id='949122',
        )

        oxyR_e_coli = create_gene_node(
            tx=tx,
            gene_name='oxyR',
            gene_id='948462',
        )

        oxyR_salmonella = create_gene_node(
            tx=tx,
            gene_name='cysB',
            gene_id='1255651',
        )

        e_coli = create_taxonomy_node(
            tx=tx,
            name='Escherichia coli',
            rank='species',
            tax_id='562'
        )

        salmonella = create_taxonomy_node(
            tx=tx,
            name='Salmonella enterica',
            rank='species',
            tax_id='28901'
        )

        gene_to_organism_rels = [
            [cysB, e_coli],
            [mcrB, e_coli],
            [oxyR_e_coli, e_coli],
            [oxyR_salmonella, salmonella]
        ]
        for rel in gene_to_organism_rels:
            create_has_taxonomy_relationship(
                tx=tx,
                source_id=rel[0].id,
                target_id=rel[1].id
            )
    return graph

# End Graph Data Fixtures #

# Start DTO Fixtures #


@pytest.fixture(scope='function')
def gas_gangrene_vis_node(gas_gangrene: Node):
    """Creates a VisNode from gas gangrene"""
    labels = list(gas_gangrene.labels)
    node_as_graph_node = GraphNode(
        id=gas_gangrene.id,
        label=labels[0],
        sub_labels=labels,
        domain_labels=[],
        display_name=gas_gangrene.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(gas_gangrene)]),  # noqa
        data=snake_to_camel_dict(dict(gas_gangrene), {}),
        url=None,
    )

    gas_gangrene_vis_node = VisNode(
        id=node_as_graph_node.id,
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
    )

    return gas_gangrene_vis_node


@pytest.fixture(scope='function')
def gas_gangrene_duplicate_vis_node(gas_gangrene: Node):
    """Creates a DuplicateVisNode from gas gangrene"""
    labels = list(gas_gangrene.labels)
    node_as_graph_node = GraphNode(
        id=gas_gangrene.id,
        label=labels[0],
        sub_labels=labels,
        domain_labels=[],
        display_name=gas_gangrene.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(gas_gangrene)]),  # noqa
        data=snake_to_camel_dict(dict(gas_gangrene), {}),
        url=None,
    )

    gas_gangrene_duplicate_vis_node = DuplicateVisNode(
        id=f'duplicateNode:{node_as_graph_node.id}',
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
        duplicate_of=node_as_graph_node.id
    )

    return gas_gangrene_duplicate_vis_node


@pytest.fixture(scope='function')
def oxygen_duplicate_vis_node(oxygen: Node):
    """Creates a DuplicateVisNode from oxygen"""
    labels = list(oxygen.labels)
    node_as_graph_node = GraphNode(
        id=oxygen.id,
        label=labels[0],
        sub_labels=labels,
        domain_labels=[],
        display_name=oxygen.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(oxygen)]),  # noqa
        data=snake_to_camel_dict(dict(oxygen), {}),
        url=None,
    )

    oxygen_duplicate_vis_node = DuplicateVisNode(
        id=f'duplicateNode:{node_as_graph_node.id}',
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
        duplicate_of=node_as_graph_node.id
    )

    return oxygen_duplicate_vis_node


@pytest.fixture(scope='function')
def penicillins_vis_node(penicillins: Node):
    """Creates a VisNode from penicillins"""
    labels = list(penicillins.labels)
    node_as_graph_node = GraphNode(
        id=penicillins.id,
        label=labels[0],
        sub_labels=labels,
        domain_labels=[],
        display_name=penicillins.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(penicillins)]),  # noqa
        data=snake_to_camel_dict(dict(penicillins), {}),
        url=None,
    )

    penicillins_vis_node = VisNode(
        id=node_as_graph_node.id,
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
    )

    return penicillins_vis_node


@pytest.fixture(scope='function')
def penicillins_duplicate_vis_node(penicillins: Node):
    """Creates a DuplicateVisNode from penicillins"""
    labels = list(penicillins.labels)
    node_as_graph_node = GraphNode(
        id=penicillins.id,
        label=labels[0],
        sub_labels=labels,
        domain_labels=[],
        display_name=penicillins.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(penicillins)]),  # noqa
        data=snake_to_camel_dict(dict(penicillins), {}),
        url=None,
    )

    penicillins_duplicate_vis_node = DuplicateVisNode(
        id=f'duplicateNode:{node_as_graph_node.id}',
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
        duplicate_of=node_as_graph_node.id
    )

    return penicillins_duplicate_vis_node


@pytest.fixture(scope='function')
def pomc_vis_node(pomc: Node):
    """Creates a VisNode from pomc"""
    labels = list(pomc.labels)
    node_as_graph_node = GraphNode(
        id=pomc.id,
        label=labels[0],
        sub_labels=labels,
        domain_labels=[],
        display_name=pomc.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(pomc)]),  # noqa
        data=snake_to_camel_dict(dict(pomc), {}),
        url=None,
    )

    pomc_vis_node = VisNode(
        id=node_as_graph_node.id,
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
    )

    return pomc_vis_node


@pytest.fixture(scope='function')
def pomc_duplicate_vis_node(pomc: Node):
    """Creates a DuplicateVisNode from pomc"""
    labels = list(pomc.labels)
    node_as_graph_node = GraphNode(
        id=pomc.id,
        label=labels[0],
        sub_labels=labels,
        domain_labels=[],
        display_name=pomc.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(pomc)]),  # noqa
        data=snake_to_camel_dict(dict(pomc), {}),
        url=None,
    )

    pomc_duplicate_vis_node = DuplicateVisNode(
        id=f'duplicateNode:{node_as_graph_node.id}',
        label=node_as_graph_node.label,
        data=node_as_graph_node.data,
        sub_labels=node_as_graph_node.sub_labels,
        display_name=node_as_graph_node.display_name,
        primary_label=node_as_graph_node.sub_labels[0],
        color={},
        expanded=False,
        duplicate_of=node_as_graph_node.id
    )

    return pomc_duplicate_vis_node


@pytest.fixture(scope='function')
def oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge(
    oxygen_to_gas_gangrene_treatment_edge: Relationship,
):
    """Creates a DuplicateVisEdge from the oxygen to gas_gangrene
    alleviates/reduces relationship."""

    edge_as_graph_relationship = GraphRelationship(
        id=oxygen_to_gas_gangrene_treatment_edge.id,
        label=type(oxygen_to_gas_gangrene_treatment_edge).__name__,
        data=dict(oxygen_to_gas_gangrene_treatment_edge),
        to=oxygen_to_gas_gangrene_treatment_edge.end_node.id,
        _from=oxygen_to_gas_gangrene_treatment_edge.start_node.id,
        to_label=list(oxygen_to_gas_gangrene_treatment_edge.end_node.labels)[0],
        from_label=list(oxygen_to_gas_gangrene_treatment_edge.start_node.labels)[0]
    )

    oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge = DuplicateVisEdge(
        id=edge_as_graph_relationship.id,
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=f'duplicateNode:{edge_as_graph_relationship.to}',  # type:ignore
        from_=f'duplicateNode:{edge_as_graph_relationship._from}',  # type:ignore
        to_label='Disease',
        from_label='Chemical',
        arrows='to',
        duplicate_of=edge_as_graph_relationship.id,
        original_from=edge_as_graph_relationship._from,
        original_to=edge_as_graph_relationship.to,
    )

    return oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge


@pytest.fixture(scope='function')
def pomc_to_gas_gangrene_pathogenesis_as_vis_edge(
    pomc_to_gas_gangrene_pathogenesis_edge: Relationship,
):
    """Creates a VisEdge from the pomc to gas gangrene
    role in disease pathogenesis relationship."""
    edge_as_graph_relationship = GraphRelationship(
        id=pomc_to_gas_gangrene_pathogenesis_edge.id,
        label=type(pomc_to_gas_gangrene_pathogenesis_edge).__name__,
        data=dict(pomc_to_gas_gangrene_pathogenesis_edge),
        to=pomc_to_gas_gangrene_pathogenesis_edge.end_node.id,
        _from=pomc_to_gas_gangrene_pathogenesis_edge.start_node.id,
        to_label=list(pomc_to_gas_gangrene_pathogenesis_edge.end_node.labels)[0],
        from_label=list(pomc_to_gas_gangrene_pathogenesis_edge.start_node.labels)[0]
    )

    pomc_to_gas_gangrene_pathogenesis_as_vis_edge = VisEdge(
        id=edge_as_graph_relationship.id,
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=edge_as_graph_relationship.to,
        from_=edge_as_graph_relationship._from,
        to_label='Disease',
        from_label='Gene',
        arrows='to',
    )

    return pomc_to_gas_gangrene_pathogenesis_as_vis_edge


@pytest.fixture(scope='function')
def pomc_to_gas_gangrene_pathogenesis_as_duplicate_vis_edge(
    pomc_to_gas_gangrene_pathogenesis_edge: Relationship,
):
    """Creates a DuplicateVisEdge from the pomc to gas_gangrene
    role in disease pathogenesis relationship."""
    edge_as_graph_relationship = GraphRelationship(
        id=pomc_to_gas_gangrene_pathogenesis_edge.id,
        label=type(pomc_to_gas_gangrene_pathogenesis_edge).__name__,
        data=dict(pomc_to_gas_gangrene_pathogenesis_edge),
        to=pomc_to_gas_gangrene_pathogenesis_edge.end_node.id,
        _from=pomc_to_gas_gangrene_pathogenesis_edge.start_node.id,
        to_label=list(pomc_to_gas_gangrene_pathogenesis_edge.end_node.labels)[0],
        from_label=list(pomc_to_gas_gangrene_pathogenesis_edge.start_node.labels)[0]
    )

    pomc_to_gas_gangrene_pathogenesis_as_duplicate_vis_edge = DuplicateVisEdge(
        id=edge_as_graph_relationship.id,
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=f'duplicateNode:{edge_as_graph_relationship.to}',  # type:ignore
        from_=f'duplicateNode:{edge_as_graph_relationship._from}',  # type:ignore
        to_label='Disease',
        from_label='Gene',
        arrows='to',
        duplicate_of=edge_as_graph_relationship.id,
        original_from=edge_as_graph_relationship._from,
        original_to=edge_as_graph_relationship.to,
    )

    return pomc_to_gas_gangrene_pathogenesis_as_duplicate_vis_edge


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_alleviates_as_vis_edge(
    penicillins_to_gas_gangrene_alleviates_edge: Relationship,
):
    """Creates a VisEdge from the penicillins to gas gangrene
    alleviates/reduces relationship."""
    edge_as_graph_relationship = GraphRelationship(
        id=penicillins_to_gas_gangrene_alleviates_edge.id,
        label=type(penicillins_to_gas_gangrene_alleviates_edge).__name__,
        data=dict(penicillins_to_gas_gangrene_alleviates_edge),
        to=penicillins_to_gas_gangrene_alleviates_edge.end_node.id,
        _from=penicillins_to_gas_gangrene_alleviates_edge.start_node.id,
        to_label=list(penicillins_to_gas_gangrene_alleviates_edge.end_node.labels)[0],
        from_label=list(penicillins_to_gas_gangrene_alleviates_edge.start_node.labels)[0]
    )

    penicillins_to_gas_gangrene_alleviates_as_vis_edge = VisEdge(
        id=edge_as_graph_relationship.id,
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=edge_as_graph_relationship.to,
        from_=edge_as_graph_relationship._from,
        to_label='Disease',
        from_label='Chemical',
        arrows='to',
    )

    return penicillins_to_gas_gangrene_alleviates_as_vis_edge


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_alleviates_as_duplicate_vis_edge(
    penicillins_to_gas_gangrene_alleviates_edge: Relationship,
):
    """Creates a DuplicateVisEdge from the penicillins to gas_gangrene
    alleviates/reduces relationship."""
    edge_as_graph_relationship = GraphRelationship(
        id=penicillins_to_gas_gangrene_alleviates_edge.id,
        label=type(penicillins_to_gas_gangrene_alleviates_edge).__name__,
        data=dict(penicillins_to_gas_gangrene_alleviates_edge),
        to=penicillins_to_gas_gangrene_alleviates_edge.end_node.id,
        _from=penicillins_to_gas_gangrene_alleviates_edge.start_node.id,
        to_label=list(penicillins_to_gas_gangrene_alleviates_edge.end_node.labels)[0],
        from_label=list(penicillins_to_gas_gangrene_alleviates_edge.start_node.labels)[0]
    )

    penicillins_to_gas_gangrene_alleviates_as_duplicate_vis_edge = DuplicateVisEdge(
        id=edge_as_graph_relationship.id,
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=f'duplicateNode:{edge_as_graph_relationship.to}',  # type:ignore
        from_=f'duplicateNode:{edge_as_graph_relationship._from}',  # type:ignore
        to_label='Disease',
        from_label='Chemical',
        arrows='to',
        duplicate_of=edge_as_graph_relationship.id,
        original_from=edge_as_graph_relationship._from,
        original_to=edge_as_graph_relationship.to,
    )

    return penicillins_to_gas_gangrene_alleviates_as_duplicate_vis_edge


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_treatment_as_vis_edge(
    penicillins_to_gas_gangrene_treatment_edge: Relationship,
):
    """Creates a VisEdge from the penicillins to gas_gangrene
    treatment/therapy relationship."""
    edge_as_graph_relationship = GraphRelationship(
        id=penicillins_to_gas_gangrene_treatment_edge.id,
        label=type(penicillins_to_gas_gangrene_treatment_edge).__name__,
        data=dict(penicillins_to_gas_gangrene_treatment_edge),
        to=penicillins_to_gas_gangrene_treatment_edge.end_node.id,
        _from=penicillins_to_gas_gangrene_treatment_edge.start_node.id,
        to_label=list(penicillins_to_gas_gangrene_treatment_edge.end_node.labels)[0],
        from_label=list(penicillins_to_gas_gangrene_treatment_edge.start_node.labels)[0]
    )

    penicillins_to_gas_gangrene_treatment_as_vis_edge = VisEdge(
        id=edge_as_graph_relationship.id,
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=edge_as_graph_relationship.to,
        from_=edge_as_graph_relationship._from,
        to_label='Disease',
        from_label='Chemical',
        arrows='to',
    )

    return penicillins_to_gas_gangrene_treatment_as_vis_edge


@pytest.fixture(scope='function')
def penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge(
    penicillins_to_gas_gangrene_treatment_edge: Relationship,
):
    """Creates a DuplicateVisEdge from the penicillins to gas_gangrene
    treatment/therapy relationship."""
    edge_as_graph_relationship = GraphRelationship(
        id=penicillins_to_gas_gangrene_treatment_edge.id,
        label=type(penicillins_to_gas_gangrene_treatment_edge).__name__,
        data=dict(penicillins_to_gas_gangrene_treatment_edge),
        to=penicillins_to_gas_gangrene_treatment_edge.end_node.id,
        _from=penicillins_to_gas_gangrene_treatment_edge.start_node.id,
        to_label=list(penicillins_to_gas_gangrene_treatment_edge.end_node.labels)[0],
        from_label=list(penicillins_to_gas_gangrene_treatment_edge.start_node.labels)[0]
    )

    penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge = DuplicateVisEdge(
        id=f'duplicateEdge:{edge_as_graph_relationship.id}',
        label=edge_as_graph_relationship.data['description'],
        data=edge_as_graph_relationship.data,
        to=f'duplicateNode:{edge_as_graph_relationship.to}',  # type:ignore
        from_=f'duplicateNode:{edge_as_graph_relationship._from}',  # type:ignore
        to_label='Disease',
        from_label='Chemical',
        arrows='to',
        duplicate_of=edge_as_graph_relationship.id,
        original_from=edge_as_graph_relationship._from,
        original_to=edge_as_graph_relationship.to,
    )

    return penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge


@pytest.fixture(scope='function')
def gas_gangrene_treatment_cluster_node_edge_pairs(
    oxygen_duplicate_vis_node,
    oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge,
    penicillins_duplicate_vis_node,
    penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge
):
    """Creates a list of DuplicateNodeEdgePairs. Used for testing the
    reference table endpoints and services."""
    return [
        ReferenceTablePair(
            node=ReferenceTablePair.NodeData(
                id=oxygen_duplicate_vis_node.id,
                display_name=oxygen_duplicate_vis_node.display_name,
                label=oxygen_duplicate_vis_node.primary_label
            ),
            edge=ReferenceTablePair.EdgeData(
                original_from=oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge.original_from,  # noqa
                original_to=oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge.original_to,
                label=oxygen_to_gas_gangrene_treatment_as_duplicate_vis_edge.label,
            ),
        ),
        ReferenceTablePair(
            node=ReferenceTablePair.NodeData(
                id=penicillins_duplicate_vis_node.id,
                display_name=penicillins_duplicate_vis_node.display_name,
                label=penicillins_duplicate_vis_node.primary_label
            ),
            edge=ReferenceTablePair.EdgeData(
                original_from=penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge.original_from,  # noqa
                original_to=penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge.original_to,
                label=penicillins_to_gas_gangrene_treatment_as_duplicate_vis_edge.label,
            ),
        )
    ]


@pytest.fixture(scope='function')
def gas_gangrene_treatement_edge_data(
    penicillins_to_gas_gangrene_treatment_edge: Relationship,
):
    edge_as_graph_relationship = GraphRelationship(
        id=penicillins_to_gas_gangrene_treatment_edge.id,
        label=type(penicillins_to_gas_gangrene_treatment_edge).__name__,
        data=dict(penicillins_to_gas_gangrene_treatment_edge),
        to=penicillins_to_gas_gangrene_treatment_edge.end_node.id,
        _from=penicillins_to_gas_gangrene_treatment_edge.start_node.id,
        to_label=list(penicillins_to_gas_gangrene_treatment_edge.end_node.labels)[0],
        from_label=list(penicillins_to_gas_gangrene_treatment_edge.start_node.labels)[0]
    )

    return EdgeConnectionData(
        label=edge_as_graph_relationship.data['description'],
        to=edge_as_graph_relationship.to,
        from_=edge_as_graph_relationship._from,
        to_label='Disease',
        from_label='Chemical',
    )


@pytest.fixture(scope='function')
def gas_gangrene_alleviates_edge_data(
    penicillins_to_gas_gangrene_alleviates_edge: Relationship,
):
    edge_as_graph_relationship = GraphRelationship(
        id=penicillins_to_gas_gangrene_alleviates_edge.id,
        label=type(penicillins_to_gas_gangrene_alleviates_edge).__name__,
        data=dict(penicillins_to_gas_gangrene_alleviates_edge),
        to=penicillins_to_gas_gangrene_alleviates_edge.end_node.id,
        _from=penicillins_to_gas_gangrene_alleviates_edge.start_node.id,
        to_label=list(penicillins_to_gas_gangrene_alleviates_edge.end_node.labels)[0],
        from_label=list(penicillins_to_gas_gangrene_alleviates_edge.start_node.labels)[0]
    )

    return EdgeConnectionData(
        label=edge_as_graph_relationship.data['description'],
        to=edge_as_graph_relationship.to,
        from_=edge_as_graph_relationship._from,
        to_label='Disease',
        from_label='Chemical',
    )


@pytest.fixture(scope='function')
def gas_gangrene_treatement_duplicate_edge_data(
    penicillins_to_gas_gangrene_treatment_edge: Relationship,
):
    edge_as_graph_relationship = GraphRelationship(
        id=penicillins_to_gas_gangrene_treatment_edge.id,
        label=type(penicillins_to_gas_gangrene_treatment_edge).__name__,
        data=dict(penicillins_to_gas_gangrene_treatment_edge),
        to=penicillins_to_gas_gangrene_treatment_edge.end_node.id,
        _from=penicillins_to_gas_gangrene_treatment_edge.start_node.id,
        to_label=list(penicillins_to_gas_gangrene_treatment_edge.end_node.labels)[0],
        from_label=list(penicillins_to_gas_gangrene_treatment_edge.start_node.labels)[0]
    )

    return [
            DuplicateEdgeConnectionData(
                label=edge_as_graph_relationship.data['description'],
                to=f'duplicateNode:{edge_as_graph_relationship.to}',  # type:ignore
                from_=f'duplicateNode:{edge_as_graph_relationship._from}',  # type:ignore
                to_label='Disease',
                from_label='Chemical',
                original_from=edge_as_graph_relationship._from,
                original_to=edge_as_graph_relationship.to,
            )
    ]


@pytest.fixture(scope='function')
def gas_gangrene_alleviates_duplicate_edge_data(
    penicillins_to_gas_gangrene_alleviates_edge: Relationship,
):
    edge_as_graph_relationship = GraphRelationship(
        id=penicillins_to_gas_gangrene_alleviates_edge.id,
        label=type(penicillins_to_gas_gangrene_alleviates_edge).__name__,
        data=dict(penicillins_to_gas_gangrene_alleviates_edge),
        to=penicillins_to_gas_gangrene_alleviates_edge.end_node.id,
        _from=penicillins_to_gas_gangrene_alleviates_edge.start_node.id,
        to_label=list(penicillins_to_gas_gangrene_alleviates_edge.end_node.labels)[0],
        from_label=list(penicillins_to_gas_gangrene_alleviates_edge.start_node.labels)[0]
    )

    return [
            DuplicateEdgeConnectionData(
                label=edge_as_graph_relationship.data['description'],
                to=f'duplicateNode:{edge_as_graph_relationship.to}',  # type:ignore
                from_=f'duplicateNode:{edge_as_graph_relationship._from}',  # type:ignore
                to_label='Disease',
                from_label='Chemical',
                original_from=edge_as_graph_relationship._from,
                original_to=edge_as_graph_relationship.to,
            )
    ]

# End DTO Fixtures #


@pytest.fixture(scope='session')
def pdf_dir() -> str:
    """ Returns the directory of the example PDFs """
    return os.path.join(Path(__file__).parent, 'database', 'services', 'annotations', 'pdf_samples')
