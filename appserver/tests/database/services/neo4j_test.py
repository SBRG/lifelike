import pytest


@pytest.mark.skip(
    reason='Does not work unless we upgrade the Neo4j docker image to 4.0+ because of apoc function'
)
def test_expand_node_gets_no_results_for_node_with_no_relationships(
    visualizer_service,
    gas_gangrene
):
    expand_query_result = visualizer_service.expand_graph(
        node_id=gas_gangrene.identity,
        filter_labels=['Chemical', 'Disease', 'Gene'],
    )

    assert expand_query_result.get('nodes', None) is not None
    assert expand_query_result.get('nodes', None) is not None

    assert expand_query_result['nodes'] == []
    assert expand_query_result['edges'] == []


def test_get_reference_table_data(
    visualizer_service,
    gas_gangrene_treatment_cluster_node_edge_pairs,
    gas_gangrene_with_associations_and_references,
):
    get_reference_table_data_result = visualizer_service.get_reference_table_data(
        gas_gangrene_treatment_cluster_node_edge_pairs,
    )

    assert get_reference_table_data_result.reference_table_rows is not None

    reference_table_rows = get_reference_table_data_result.reference_table_rows

    assert len(reference_table_rows) == 2
    assert reference_table_rows[0].node_display_name == 'Oxygen'
    assert reference_table_rows[0].snippet_count == 2
    assert reference_table_rows[1].node_display_name == 'Penicillins'
    assert reference_table_rows[1].snippet_count == 2


def test_get_snippets_for_edge(
    visualizer_service,
    gas_gangrene_treatement_edge_data,
    gas_gangrene_with_associations_and_references,
):
    get_edge_data_result = visualizer_service.get_snippets_for_edge(
        edge=gas_gangrene_treatement_edge_data,
        page=1,
        limit=25,
    )

    result = get_edge_data_result.snippet_data

    # Check snippet data
    assert len(result.snippets) == 2
    assert result.association == 'treatment/therapy (including investigatory)'

    snippet1 = result.snippets[0]
    snippet2 = result.snippets[1]

    sentences = [
        'Toxin suppression and rapid bacterial killing may...',
        '...suppresses toxins and rapidly kills bacteria...',
    ]

    # Both snippets come from the same publication, so can't guarantee the order
    if snippet1.reference.data['sentence'] == sentences[0]:
        assert snippet2.reference.data['sentence'] == '...suppresses toxins and rapidly kills bacteria...'  # noqa
    elif snippet2.reference.data['sentence'] == sentences[0]:
        assert snippet1.reference.data['sentence'] == '...suppresses toxins and rapidly kills bacteria...'  # noqa
    else:
        assert False


def test_get_snippets_for_edge_low_limit(
    visualizer_service,
    gas_gangrene_treatement_edge_data,
    gas_gangrene_with_associations_and_references,
):
    get_edge_data_result = visualizer_service.get_snippets_for_edge(
        edge=gas_gangrene_treatement_edge_data,
        page=1,
        limit=1,
    )

    result = get_edge_data_result.snippet_data

    # Check snippet data
    assert len(result.snippets) == 1
    assert result.association == 'treatment/therapy (including investigatory)'

    sentences = [
        'Toxin suppression and rapid bacterial killing may...',
        '...suppresses toxins and rapidly kills bacteria...',
    ]

    assert result.snippets[0].reference.data['sentence'] in sentences


def test_get_snippets_for_edge_orders_by_pub_year(
    visualizer_service,
    gas_gangrene_alleviates_edge_data,
    gas_gangrene_with_associations_and_references,
):
    get_edge_data_result = visualizer_service.get_snippets_for_edge(
        edge=gas_gangrene_alleviates_edge_data,
        page=1,
        limit=25,
    )

    result = get_edge_data_result.snippet_data

    # Check snippet data
    assert len(result.snippets) == 2
    assert result.association == 'alleviates, reduces'

    reference_node1 = result.snippets[0].reference.to_dict()
    reference_node2 = result.snippets[1].reference.to_dict()

    assert 'In a mouse model' in reference_node1['data']['sentence']
    assert 'penicillin was found to reduce' in reference_node2['data']['sentence']


def test_get_snippets_for_cluster(
    visualizer_service,
    gas_gangrene_treatement_duplicate_edge_data,
    gas_gangrene_with_associations_and_references,
):
    get_cluster_data_result = visualizer_service.get_snippets_for_cluster(
        edges=gas_gangrene_treatement_duplicate_edge_data,
        page=1,
        limit=25,
    )

    snippet_data = get_cluster_data_result.snippet_data

    # Check snippet data
    assert len(snippet_data) == 1

    result = snippet_data[0]

    assert len(result.snippets) == 2
    assert result.association == 'treatment/therapy (including investigatory)'

    snippet1 = result.snippets[0]
    snippet2 = result.snippets[1]

    sentences = [
        'Toxin suppression and rapid bacterial killing may...',
        '...suppresses toxins and rapidly kills bacteria...',
    ]

    # Both snippets come from the same publication, so can't guarantee the order
    if snippet1.reference.data['sentence'] == sentences[0]:
        assert snippet2.reference.data['sentence'] == '...suppresses toxins and rapidly kills bacteria...'  # noqa
    elif snippet2.reference.data['sentence'] == sentences[0]:
        assert snippet1.reference.data['sentence'] == '...suppresses toxins and rapidly kills bacteria...'  # noqa
    else:
        assert False


def test_get_snippets_for_cluster_low_limit(
    visualizer_service,
    gas_gangrene_treatement_duplicate_edge_data,
    gas_gangrene_with_associations_and_references,
):
    get_cluster_data_result = visualizer_service.get_snippets_for_cluster(
        edges=gas_gangrene_treatement_duplicate_edge_data,
        page=1,
        limit=1,
    )

    snippet_data = get_cluster_data_result.snippet_data

    # Check snippet data
    assert len(snippet_data) == 1

    result = snippet_data[0]

    assert len(result.snippets) == 1
    assert result.association == 'treatment/therapy (including investigatory)'

    sentences = [
        'Toxin suppression and rapid bacterial killing may...',
        '...suppresses toxins and rapidly kills bacteria...',
    ]

    assert result.snippets[0].reference.data['sentence'] in sentences


def test_get_snippets_for_cluster_orders_by_pub_year(
    visualizer_service,
    gas_gangrene_alleviates_duplicate_edge_data,
    gas_gangrene_with_associations_and_references,
):
    get_cluster_data_result = visualizer_service.get_snippets_for_cluster(
        edges=gas_gangrene_alleviates_duplicate_edge_data,
        page=1,
        limit=25,
    )

    snippet_data = get_cluster_data_result.snippet_data

    # Check snippet data
    assert len(snippet_data) == 1

    result = snippet_data[0]

    assert len(result.snippets) == 2
    assert result.association == 'alleviates, reduces'

    reference_node1 = result.snippets[0].reference.to_dict()
    reference_node2 = result.snippets[1].reference.to_dict()

    assert 'In a mouse model' in reference_node1['data']['sentence']
    assert 'penicillin was found to reduce' in reference_node2['data']['sentence']
