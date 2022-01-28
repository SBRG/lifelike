import pytest

from neo4japp.data_transfer_objects.visualization import (
    DuplicateVisEdge,
    VisEdge,
)
from neo4japp.exceptions import (
    FormatterException,
)


@pytest.mark.parametrize('vis_edge_dict', [
    {
        'id': 1,
        'label': 'Test Edge Label',
        'data': {},
        'to': 1,
        'from_': 2,
        'to_label': 'Test Node',
        'from_label': 'Test Node',
        'arrows': 'to',
    },
    {
        'id': 1,
        'label': 'Test Edge Label',
        'data': {},
        'to': 1,
        'from': 2,
        'to_label': 'Test Node',
        'from_label': 'Test Node',
        'arrows': 'to',
    },
])
def test_can_build_vis_edge_from_dict(vis_edge_dict):
    vis_edge = VisEdge.build_from_dict(vis_edge_dict)

    assert vis_edge.id == 1
    assert vis_edge.label == 'Test Edge Label'
    assert vis_edge.data == {}
    assert vis_edge.to == 1
    assert vis_edge.from_ == 2


@pytest.mark.parametrize('vis_edge_dict', [
    {
        'id': 1,
        'label': 'Test Edge Label',
        'data': {},
        'to': 1,
        'from_': 2,
        'from': 2,
        'to_label': 'Test Node',
        'from_label': 'Test Node',
        'arrows': 'to',
    },
    {
        'id': 1,
        'label': 'Test Edge Label',
        'data': {},
        'to': 1,
        'to_label': 'Test Node',
        'from_label': 'Test Node',
        'arrows': 'to',
    },
])
def test_cannot_build_vis_edge_from_invalid_dict(vis_edge_dict):
    with pytest.raises(FormatterException):
        VisEdge.build_from_dict(vis_edge_dict)


@pytest.mark.parametrize('vis_edge', [
    VisEdge(
        id=1,
        label='Test Edge Label',
        data={},
        to=1,
        from_=2,
        to_label='Test Node',
        from_label='Test Node',
        arrows='to',
    ),
])
def test_can_create_dict_from_vis_edge(vis_edge):
    vis_edge_dict = vis_edge.to_dict()

    assert vis_edge_dict['id'] == 1
    assert vis_edge_dict['label'] == 'Test Edge Label'
    assert vis_edge_dict['data'] == {}
    assert vis_edge_dict['to'] == 1
    assert vis_edge_dict['from'] == 2
    assert vis_edge_dict['arrows'] == 'to'


@pytest.mark.parametrize('duplicate_vis_edge_dict', [
    {
        'id': 'duplicateEdge:1',
        'label': 'Test Edge Label',
        'data': {},
        'to': 'duplicateNode:1',
        'from_': 'duplicateNode:2',
        'to_label': 'Test Node',
        'from_label': 'Test Node',
        'arrows': 'to',
        'duplicate_of': 1,
        'original_from': 2,
        'original_to': 1,
    },
    {
        'id': 'duplicateEdge:1',
        'label': 'Test Edge Label',
        'data': {},
        'to': 'duplicateNode:1',
        'from': 'duplicateNode:2',
        'to_label': 'Test Node',
        'from_label': 'Test Node',
        'arrows': 'to',
        'duplicate_of': 1,
        'original_from': 2,
        'original_to': 1,
    },
])
def test_can_build_duplicate_vis_edge_from_dict(duplicate_vis_edge_dict):
    duplicate_vis_edge = DuplicateVisEdge.build_from_dict(duplicate_vis_edge_dict)
    assert duplicate_vis_edge.id == 'duplicateEdge:1'
    assert duplicate_vis_edge.label == 'Test Edge Label'
    assert duplicate_vis_edge.data == {}
    assert duplicate_vis_edge.to == 'duplicateNode:1'
    assert duplicate_vis_edge.from_ == 'duplicateNode:2'
    assert duplicate_vis_edge.duplicate_of == 1
    assert duplicate_vis_edge.original_from == 2
    assert duplicate_vis_edge.original_to == 1


@pytest.mark.parametrize('duplicate_vis_edge_dict', [
    {
        'id': 'duplicateEdge:1',
        'label': 'Test Edge Label',
        'data': {},
        'to': 'duplicateNode:1',
        'from_': 'duplicateNode:2',
        'from': 'duplicateNode:2',
        'to_label': 'Test Node',
        'from_label': 'Test Node',
        'arrows': 'to',
        'duplicate_of': 1,
        'original_from': 2,
        'original_to': 1,
    },
    {
        'id': 'duplicateEdge:1',
        'label': 'Test Edge Label',
        'data': {},
        'to': 'duplicateNode:1',
        'to_label': 'Test Node',
        'from_label': 'Test Node',
        'arrows': 'to',
        'duplicate_of': 1,
        'original_from': 2,
        'original_to': 1,
    },
])
def test_cannot_build_duplicate_vis_edge_from_invalid_dict(duplicate_vis_edge_dict):
    with pytest.raises(FormatterException):
        DuplicateVisEdge.build_from_dict(duplicate_vis_edge_dict)


@pytest.mark.parametrize('duplicate_vis_edge', [
    DuplicateVisEdge(
        id='duplicateEdge:1',
        label='Test Edge Label',
        data={},
        to='duplicateNode:1',
        from_='duplicateNode:2',
        to_label='Test Node',
        from_label='Test Node',
        arrows='to',
        duplicate_of=1,
        original_from=2,
        original_to=1,
    ),
])
def test_can_create_dict_from_duplicate_vis_edge(duplicate_vis_edge):
    duplicate_vis_edge_dict = duplicate_vis_edge.to_dict()

    assert duplicate_vis_edge_dict['id'] == 'duplicateEdge:1'
    assert duplicate_vis_edge_dict['label'] == 'Test Edge Label'
    assert duplicate_vis_edge_dict['data'] == {}
    assert duplicate_vis_edge_dict['to'] == 'duplicateNode:1'
    assert duplicate_vis_edge_dict['from'] == 'duplicateNode:2'
    assert duplicate_vis_edge_dict['toLabel'] == 'Test Node'
    assert duplicate_vis_edge_dict['fromLabel'] == 'Test Node'
    assert duplicate_vis_edge_dict['arrows'] == 'to'
    assert duplicate_vis_edge_dict['duplicateOf'] == 1
    assert duplicate_vis_edge_dict['originalFrom'] == 2
    assert duplicate_vis_edge_dict['originalTo'] == 1
