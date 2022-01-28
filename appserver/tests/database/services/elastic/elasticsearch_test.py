import base64
import pytest

from neo4japp.constants import FILE_INDEX_ID, FRAGMENT_SIZE
from neo4japp.services.elastic.constants import ATTACHMENT_PIPELINE_ID


@pytest.fixture(scope='function')
def highlight():
    return {
        'fields': {
            'data.content': {},
        },
        'fragment_size': FRAGMENT_SIZE,
        'order': 'score',
        'pre_tags': ['@@@@$'],
        'post_tags': ['@@@@/$'],
        'number_of_fragments': 200,
    }


@pytest.fixture(scope='function')
def query_filter_map():
    return [
        {'terms': {'type': ['map']}},
    ]


@pytest.fixture(scope='function')
def query_filter_pdf():
    return [
        {'terms': {'type': ['pdf']}},
    ]


@pytest.fixture(scope='function')
def query_filter_map_and_pdf():
    return [
        {'terms': {'type': ['map', 'pdf']}},
    ]


@pytest.fixture(scope='function')
def text_fields():
    return ['description', 'data.content', 'filename']


@pytest.fixture(scope='function')
def text_field_boosts():
    return {'description': 1, 'data.content': 1, 'filename': 3}


@pytest.fixture(scope='function')
def return_fields():
    return ['id']


@pytest.fixture(scope='function')
def pdf_document(elastic_service):
    elastic_service.elastic_client.create(
        index=FILE_INDEX_ID,
        pipeline=ATTACHMENT_PIPELINE_ID,
        id='1',
        body={
            'filename': 'test_pdf',
            'description': 'mock pdf document for testing elasticsearch',
            'uploaded_date': None,
            'data': base64.b64encode('BOLA3'.encode('utf-8')).decode('utf-8'),
            'user_id': 1,
            'username': 'test_user',
            'project_id': 1,
            'project_name': 'test-project',
            'doi': None,
            'public': True,
            'id': '1',
            'type': 'pdf'
        },
        # This option is MANDATORY! Otherwise the document won't be immediately visible to search.
        refresh='true'
    )


@pytest.fixture(scope='function')
def map_document(elastic_service):
    elastic_service.elastic_client.create(
        index=FILE_INDEX_ID,
        pipeline=ATTACHMENT_PIPELINE_ID,
        id='2',
        body={
            'filename': 'test_map',
            'description': 'mock map document for testing elasticsearch',
            'uploaded_date': None,
            'data': base64.b64encode('COVID'.encode('utf-8')).decode('utf-8'),
            'user_id': 1,
            'username': 'test_user',
            'project_id': 1,
            'project_name': 'test-project',
            'doi': None,
            'public': True,
            'id': '2',
            'type': 'pdf'
        },
        # This option is MANDATORY! Otherwise the document won't be immediately visible to search.
        refresh='true'
    )


def test_should_not_get_results_from_empty_db(
    elastic_service,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    return_fields
):
    res, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='BOLA3',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=query_filter_map_and_pdf,
        highlight=highlight,
        return_fields=return_fields
    )
    res = res['hits']['hits']

    assert len(res) == 0


def test_can_get_results_from_pdf(
    elastic_service,
    pdf_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    return_fields
):
    res, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='BOLA3',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=query_filter_map_and_pdf,
        highlight=highlight,
        return_fields=return_fields
    )

    res = res['hits']['hits']

    assert len(res) > 0


def test_can_get_results_from_pdf_with_asterisk_wildcard_phrase(
    elastic_service,
    pdf_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    return_fields
):
    res, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='BO*A3',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=query_filter_map_and_pdf,
        highlight=highlight,
        return_fields=return_fields
    )
    res = res['hits']['hits']

    assert len(res) > 0


def test_can_get_results_from_pdf_with_question_mark_wildcard_phrase(
    elastic_service,
    pdf_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    return_fields
):
    res, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='BO?A3',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=query_filter_map_and_pdf,
        highlight=highlight,
        return_fields=return_fields
    )
    res = res['hits']['hits']

    assert len(res) > 0


def test_can_get_results_from_map(
    elastic_service,
    map_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    return_fields
):
    res, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='COVID',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=query_filter_map_and_pdf,
        highlight=highlight,
        return_fields=return_fields
    )
    res = res['hits']['hits']

    assert len(res) > 0


def test_can_get_results_from_map_with_wildcard_phrase(
    elastic_service,
    map_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    return_fields
):
    res, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='CO*ID',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=query_filter_map_and_pdf,
        highlight=highlight,
        return_fields=return_fields
    )
    res = res['hits']['hits']

    assert len(res) > 0


def test_can_get_results_with_quoted_phrase(
    elastic_service,
    map_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    return_fields
):
    res, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='"mock map document"',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=query_filter_map_and_pdf,
        highlight=highlight,
        return_fields=return_fields
    )
    res = res['hits']['hits']

    assert len(res) > 0


def test_using_wildcard_in_phrase_does_not_work(
    elastic_service,
    pdf_document,
    highlight,
    query_filter_map_and_pdf,
    text_fields,
    text_field_boosts,
    return_fields
):
    res, _ = elastic_service.search(
        index_id=FILE_INDEX_ID,
        user_search_query='"BO*A3"',
        offset=0,
        limit=1,
        text_fields=text_fields,
        text_field_boosts=text_field_boosts,
        filter_=query_filter_map_and_pdf,
        highlight=highlight,
        return_fields=return_fields
    )

    res = res['hits']['hits']

    assert len(res) == 0


@pytest.mark.parametrize(
    'test, expected',
    [
        (
            'p q',
            'p and q',
        ),
        (
            'p AND q',
            'p AND q',
        ),
        (
            'p or q',
            'p or q',
        ),
        (
            'p q or r',
            'p and q or r',

        ),
        (
            'p or q r',
            'p or q and r',
        ),
        (
            '"p AND q"',
            '"p AND q"',
        ),
        (
            '"p AND q" r',
            '"p AND q" and r',
        ),
        (
            '"p AND q" AND r',
            '"p AND q" AND r',
        ),
        (
            '"p AND q" or r',
            '"p AND q" or r',
        ),
        (
            'r "p AND q" t',
            'r and "p AND q" and t',
        ),
        (
            'r "p AND q" m or n',
            'r and "p AND q" and m or n',
        ),
        (
            '("p AND q" r) (m or n)',
            '("p AND q" and r) and (m or n)',
        ),
        (
            '(r AND "p AND q") (m or n)',
            '(r AND "p AND q") and (m or n)',
        ),
        (
            '("p or q" or r) or (m n)',
            '("p or q" or r) or (m and n)',
        ),
        (
            '(r or "p or q") or (m AND n)',
            '(r or "p or q") or (m AND n)',
        ),
        (
            '(r "p AND q" m) or n',
            '(r and "p AND q" and m) or n',
        ),
        (
            '(("p AND q" r s) or (t u v)) w',
            '(("p AND q" and r and s) or (t and u and v)) and w',
        ),
        (
            'p not q',
            'p and not q',
        ),
        (
            'p AND not q',
            'p AND not q',
        ),
        (
            'not p q',
            'not p and q',
        ),
        (
            'not p AND q',
            'not p AND q',
        ),
        (
            'p or not q',
            'p or not q',
        ),
        (
            'not p or q',
            'not p or q',
        ),
        (
            '"(p and q)"',
            '"(p and q)"',
        ),
        (
            '"(p and q"',
            '"(p and q"',
        ),
        (
            '"p and q)"',
            '"p and q)"',
        ),
        (
            '"((p and q))"',
            '"((p and q))"',
        ),
        (
            '"p and q))"',
            '"p and q))"',
        ),
    ],
)
def test_pre_process_query(
    elastic_service,
    test,
    expected
):
    res = elastic_service._pre_process_query(test)
    assert res == expected


@pytest.mark.parametrize(
    'test, expected',
    [
        (
            'dog',
            {
                'multi_match': {
                    'query': 'dog',
                    'type': 'phrase',
                    'fields': [
                        'description^1',
                        'data.content^1',
                        'filename^3',
                    ]
                }
            },
        ),
        (
            '"dog"',
            {
                'multi_match': {
                    'query': 'dog',
                    'type': 'phrase',
                    'fields': [
                        'description^1',
                        'data.content^1',
                        'filename^3',
                    ]
                }
            },
        ),
        (
            'dog cat',
            {
                'bool': {
                    'must': [
                        {
                            'multi_match': {
                                'query': 'dog',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'dog AND cat',
            {
                'bool': {
                    'must': [
                        {
                            'multi_match': {
                                'query': 'dog',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                    ]
                }
            },
        ),
        (
            '"dog cat"',
            {
                'multi_match': {
                    'query': 'dog cat',
                    'type': 'phrase',
                    'fields': [
                        'description^1',
                        'data.content^1',
                        'filename^3',
                    ]
                }
            },
        ),
        (
            'dog not cat',
            {
                'bool': {
                    'must': [
                        {
                            'multi_match': {
                                'query': 'dog',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must_not': [
                                    {
                                        'multi_match': {
                                            'query': 'cat',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'dog AND not cat',
            {
                'bool': {
                    'must': [
                        {
                            'multi_match': {
                                'query': 'dog',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must_not': [
                                    {
                                        'multi_match': {
                                            'query': 'cat',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'not not dog',
            {
                'bool': {
                    'must_not': [
                        {
                            'bool': {
                                'must_not': [
                                    {
                                        'multi_match': {
                                            'query': 'dog',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'not(dog cat)',
            {
                'bool': {
                    'must_not': [
                        {
                            'bool': {
                                'must': [
                                    {
                                        'multi_match': {
                                            'query': 'dog',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                    {
                                        'multi_match': {
                                            'query': 'cat',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'not(dog AND cat)',
            {
                'bool': {
                    'must_not': [
                        {
                            'bool': {
                                'must': [
                                    {
                                        'multi_match': {
                                            'query': 'dog',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                    {
                                        'multi_match': {
                                            'query': 'cat',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'not "(dog AND cat)"',
            {
                'bool': {
                    'must_not': [
                        {
                            'multi_match': {
                                'query': '(dog AND cat)',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                    ]
                }
            },
        ),
        (
            'dog or cat',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'dog',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                    ]
                }
            },
        ),
        (
            'dog or not cat',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'dog',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must_not': [
                                    {
                                        'multi_match': {
                                            'query': 'cat',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'cat or not dog mouse',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must': [
                                    {
                                        'bool': {
                                            'must_not': [
                                                {
                                                    'multi_match': {
                                                        'query': 'dog',
                                                        'type': 'phrase',
                                                        'fields': [
                                                            'description^1',
                                                            'data.content^1',
                                                            'filename^3',
                                                        ]
                                                    }
                                                },
                                            ]
                                        }
                                    },
                                    {
                                        'multi_match': {
                                            'query': 'mouse',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'cat or not dog AND mouse',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must': [
                                    {
                                        'bool': {
                                            'must_not': [
                                                {
                                                    'multi_match': {
                                                        'query': 'dog',
                                                        'type': 'phrase',
                                                        'fields': [
                                                            'description^1',
                                                            'data.content^1',
                                                            'filename^3',
                                                        ]
                                                    }
                                                },
                                            ]
                                        }
                                    },
                                    {
                                        'multi_match': {
                                            'query': 'mouse',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'cat dog mouse',
            {
                'bool': {
                    'must': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'dog',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'mouse',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                    ]
                }
            },
        ),
        (
            'cat AND dog AND mouse',
            {
                'bool': {
                    'must': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'dog',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'mouse',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                    ]
                }
            },
        ),
        (
            'cat or dog or mouse',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'dog',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'mouse',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                    ]
                }
            },
        ),
        (
            'cat or not dog or not mouse',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must_not': [
                                    {
                                        'multi_match': {
                                            'query': 'dog',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must_not': [
                                    {
                                        'multi_match': {
                                            'query': 'mouse',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'cat or not (dog mouse)',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must_not': [
                                    {
                                        'bool': {
                                            'must': [
                                                {
                                                    'multi_match': {
                                                        'query': 'dog',
                                                        'type': 'phrase',
                                                        'fields': [
                                                            'description^1',
                                                            'data.content^1',
                                                            'filename^3',
                                                        ]
                                                    }
                                                },
                                                {
                                                    'multi_match': {
                                                        'query': 'mouse',
                                                        'type': 'phrase',
                                                        'fields': [
                                                            'description^1',
                                                            'data.content^1',
                                                            'filename^3',
                                                        ]
                                                    }
                                                },
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'cat or not (dog AND mouse)',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must_not': [
                                    {
                                        'bool': {
                                            'must': [
                                                {
                                                    'multi_match': {
                                                        'query': 'dog',
                                                        'type': 'phrase',
                                                        'fields': [
                                                            'description^1',
                                                            'data.content^1',
                                                            'filename^3',
                                                        ]
                                                    }
                                                },
                                                {
                                                    'multi_match': {
                                                        'query': 'mouse',
                                                        'type': 'phrase',
                                                        'fields': [
                                                            'description^1',
                                                            'data.content^1',
                                                            'filename^3',
                                                        ]
                                                    }
                                                },
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'cat or dog or mouse fish',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'dog',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must': [
                                    {
                                        'multi_match': {
                                            'query': 'mouse',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                    {
                                        'multi_match': {
                                            'query': 'fish',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'cat or dog or mouse AND fish',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'dog',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must': [
                                    {
                                        'multi_match': {
                                            'query': 'mouse',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                    {
                                        'multi_match': {
                                            'query': 'fish',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            '(cat or dog or mouse) fish',
            {
                'bool': {
                    'must': [
                        {
                            'bool': {
                                'should': [
                                    {
                                        'multi_match': {
                                            'query': 'cat',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                    {
                                        'multi_match': {
                                            'query': 'dog',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                    {
                                        'multi_match': {
                                            'query': 'mouse',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'fish',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                    ]
                }
            },
        ),
        (
            '(cat or dog or mouse) AND fish',
            {
                'bool': {
                    'must': [
                        {
                            'bool': {
                                'should': [
                                    {
                                        'multi_match': {
                                            'query': 'cat',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                    {
                                        'multi_match': {
                                            'query': 'dog',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                    {
                                        'multi_match': {
                                            'query': 'mouse',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'fish',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                    ]
                }
            },
        ),
        (
            'cat or "not dog" or not mouse',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'not dog',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must_not': [
                                    {
                                        'multi_match': {
                                            'query': 'mouse',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'cat or not "dog mouse"',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must_not': [
                                    {
                                        'multi_match': {
                                            'query': 'dog mouse',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'cat or not "dog AND mouse"',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must_not': [
                                    {
                                        'multi_match': {
                                            'query': 'dog AND mouse',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'cat or "dog or mouse" fish',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must': [
                                    {
                                        'multi_match': {
                                            'query': 'dog or mouse',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                    {
                                        'multi_match': {
                                            'query': 'fish',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'cat or "dog or mouse" AND fish',
            {
                'bool': {
                    'should': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'must': [
                                    {
                                        'multi_match': {
                                            'query': 'dog or mouse',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                    {
                                        'multi_match': {
                                            'query': 'fish',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'cat "or dog or" mouse fish',
            {
                'bool': {
                    'must': [
                        {
                            'multi_match': {
                                'query': 'cat',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'or dog or',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'mouse',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'fish',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                    ]
                }
            },
        ),
        (
            '(cat or "dog or mouse") "AND fish"',
            {
                'bool': {
                    'must': [
                        {
                            'bool': {
                                'should': [
                                    {
                                        'multi_match': {
                                            'query': 'cat',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                    {
                                        'multi_match': {
                                            'query': 'dog or mouse',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                ]
                            }
                        },
                        {
                            'multi_match': {
                                'query': 'AND fish',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                    ]
                }
            },
        ),
        (
            'co*id',
            {
                'bool': {
                    'should': [
                        {
                            'wildcard': {
                                'description': {
                                    'value': 'co*id',
                                    'boost': 1,
                                    'case_insensitive': True
                                },
                            }
                        },
                        {
                            'wildcard': {
                                'data.content': {
                                    'value': 'co*id',
                                    'boost': 1,
                                    'case_insensitive': True
                                },
                            }
                        },
                        {
                            'wildcard': {
                                'filename': {
                                    'value': 'co*id',
                                    'boost': 3,
                                    'case_insensitive': True
                                }
                            }
                        },
                    ]
                }
            }
        ),
        (
            'human type:map',
            {
                'bool': {
                    'must': [
                        {
                            'multi_match': {
                                'query': 'human',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {'term': {'mime_type': 'vnd.lifelike.document/map'}}
                    ]
                }
            },
        ),
        (
            'epinephrine benzene-1,2-diol;hydrochloride',
            {
                'bool': {
                    'must': [
                        {
                            'multi_match': {
                                'query': 'epinephrine',
                                'type': 'phrase',
                                'fields': [
                                    'description^1',
                                    'data.content^1',
                                    'filename^3',
                                ]
                            }
                        },
                        {
                            'bool': {
                                'should': [
                                    {
                                        'multi_match': {
                                            'query': 'benzene-1,2-diol;hydrochloride',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                    {
                                        'term': {
                                            'description': {
                                                'value': 'benzene-1,2-diol;hydrochloride',
                                                'boost': 1
                                            }
                                        }
                                    },
                                    {
                                        'term': {
                                            'data.content': {
                                                'value': 'benzene-1,2-diol;hydrochloride',
                                                'boost': 1
                                            }
                                        }
                                    },
                                    {
                                        'term': {
                                            'filename': {
                                                'value': 'benzene-1,2-diol;hydrochloride',
                                                'boost': 3
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
        ),
        (
            'co*id benzene-1,2-diol;hydrochloride type:map',
            {
                'bool': {
                    'must': [
                        {
                            'bool': {
                                'should': [
                                    {
                                        'wildcard': {
                                            'description': {
                                                'value': 'co*id',
                                                'boost': 1,
                                                'case_insensitive': True
                                            },
                                        }
                                    },
                                    {
                                        'wildcard': {
                                            'data.content': {
                                                'value': 'co*id',
                                                'boost': 1,
                                                'case_insensitive': True
                                            },
                                        }
                                    },
                                    {
                                        'wildcard': {
                                            'filename': {
                                                'value': 'co*id',
                                                'boost': 3,
                                                'case_insensitive': True
                                            }
                                        }
                                    },
                                ]
                            }
                        },
                        {
                            'bool': {
                                'should': [
                                    {
                                        'multi_match': {
                                            'query': 'benzene-1,2-diol;hydrochloride',
                                            'type': 'phrase',
                                            'fields': [
                                                'description^1',
                                                'data.content^1',
                                                'filename^3',
                                            ]
                                        }
                                    },
                                    {
                                        'term': {
                                            'description': {
                                                'value': 'benzene-1,2-diol;hydrochloride',
                                                'boost': 1
                                            }
                                        }
                                    },
                                    {
                                        'term': {
                                            'data.content': {
                                                'value': 'benzene-1,2-diol;hydrochloride',
                                                'boost': 1
                                            }
                                        }
                                    },
                                    {
                                        'term': {
                                            'filename': {
                                                'value': 'benzene-1,2-diol;hydrochloride',
                                                'boost': 3
                                            }
                                        }
                                    }
                                ]
                            }
                        },
                        {'term': {'mime_type': 'vnd.lifelike.document/map'}}
                    ]
                }
            }
        ),
        (
            '"(dog and cat)"',
            {
                'multi_match': {
                    'query': '(dog and cat)',
                    'type': 'phrase',
                    'fields': [
                        'description^1',
                        'data.content^1',
                        'filename^3',
                    ]
                }
            },
        ),
        (
            '"(dog and cat"',
            {
                'multi_match': {
                    'query': '(dog and cat',
                    'type': 'phrase',
                    'fields': [
                        'description^1',
                        'data.content^1',
                        'filename^3',
                    ]
                }
            },
        ),
        (
            '"dog and cat)"',
            {
                'multi_match': {
                    'query': 'dog and cat)',
                    'type': 'phrase',
                    'fields': [
                        'description^1',
                        'data.content^1',
                        'filename^3',
                    ]
                }
            },
        ),
    ],
)
def test_user_query_parser(
    elastic_service,
    test,
    expected
):
    text_fields = ['description', 'data.content', 'filename']
    text_field_boosts = {'description': 1, 'data.content': 1, 'filename': 3}

    processed_query = elastic_service._pre_process_query(test)
    parser = elastic_service._get_query_parser(text_fields, text_field_boosts)
    res = parser.parseString(processed_query)[0].to_dict()

    assert res == expected


@pytest.mark.parametrize(
    'test, expected',
    [
        (
            '"dog and cat"',
            '"dog and cat"',
        ),
        (
            '"dog and" cat"',
            '"dog and" cat',
        ),
        (
            '"dog " and cat"',
            '"dog " and cat',
        ),
    ],
)
def test_strip_unmatched_quotations(
    elastic_service,
    test,
    expected
):
    res = elastic_service._strip_unmatched_quotations(test)
    assert res == expected


@pytest.mark.parametrize(
    'test, expected',
    [
        (
            '()',
            '()'
        ),
        (
            '(())',
            '(())'
        ),
        (
            '() ()',
            '() ()'
        ),
        (
            '(()) ()',
            '(()) ()'
        ),
        (
            '(',
            ''
        ),
        (
            '(()',
            '()'
        ),
        (
            '() (',
            '() '
        ),
        (
            '(() ()',
            '() ()'
        ),
        (
            '( ()',
            ' ()'
        ),
        (
            '(()) (',
            '(()) '
        ),
        (
            ')(',
            ''
        ),
        (
            ')',
            ''
        ),
        (
            '())',
            '()'
        ),
        (
            '()) ()',
            '() ()'
        ),
        (
            ')))',
            ''
        ),
        (
            '(((',
            ''
        ),
        (
            '())))',
            '()'
        ),
        (
            '((()',
            '()'
        ),
    ],
)
def test_strip_unmatched_parens(
    elastic_service,
    test,
    expected
):
    res = elastic_service._strip_unmatched_parens(test)
    assert res == expected


@pytest.mark.parametrize(
    'test, expected',
    [
        (
            '"(p and q"',
            ['(p and q']
        ),
        (
            'cat or not (dog AND mouse)',
            ['cat', 'dog', 'mouse']
        ),
        (
            '(cat or "dog or mouse") "AND fish"',
            ['cat', 'dog or mouse', 'AND fish']
        ),
        (
            'epinephrine benzene-1,2-diol;hydrochloride',
            ['epinephrine', 'benzene-1,2-diol;hydrochloride']
        ),
        (
            '"epinephrine benzene-1,2-diol;hydrochloride"',
            ['epinephrine benzene-1,2-diol;hydrochloride']
        ),
        (
            '"epinephrine benzene-1,2-diol;hydrochloride',
            ['epinephrine', 'benzene-1,2-diol;hydrochloride']
        ),
        (
            'co*id benzene-1,2-diol;hydrochloride',
            ['co*id', 'benzene-1,2-diol;hydrochloride']
        ),
    ]
)
def test_get_words_phrases_and_wildcards(
    elastic_service,
    test,
    expected
):
    res = elastic_service._get_words_phrases_and_wildcards(test)
    assert set(res) == set(expected)
