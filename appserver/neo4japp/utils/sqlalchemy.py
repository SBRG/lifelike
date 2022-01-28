import sqlalchemy
from sqlalchemy import inspect
from sqlalchemy_searchable import inspect_search_vectors, search_manager


def ft_search(query, search_query, vector=None, regconfig=None):
    if not search_query.strip():
        return query

    if vector is None:
        entity = query._entities[0].entity_zero.class_
        search_vectors = inspect_search_vectors(entity)
        vector = search_vectors[0]

    if regconfig is None:
        regconfig = search_manager.options['regconfig']

    query = query.filter(
        vector.op('@@')(sqlalchemy.func.tsq_parse(regconfig, search_query))
    )

    query = query.add_columns(sqlalchemy.func.ts_rank_cd(
        vector,
        sqlalchemy.func.tsq_parse(search_query)
    ).label('rank'))

    return query.params(term=search_query)


def get_model_changes(model):
    """
    Return a dictionary containing changes made to the model since it was
    fetched from the database.

    The dictionary is of the form {'property_name': [old_value, new_value]}

    Example:
      user = get_user_by_id(402)
      >>> '<User id=402 email="business_email@gmail.com">'
      get_model_changes(user)
      >>> {}
      user.email = 'new_email@who-dis.biz'
      get_model_changes(user)
      >>> {'email': ['business_email@gmail.com', 'new_email@who-dis.biz']}
    """

    state = inspect(model)
    changes = {}
    for attr in state.attrs:
        hist = state.get_history(attr.key, True)

        if not hist.has_changes():
            continue

        old_value = hist.deleted[0] if hist.deleted else None
        new_value = hist.added[0] if hist.added else None
        changes[attr.key] = [old_value, new_value]

    return changes
