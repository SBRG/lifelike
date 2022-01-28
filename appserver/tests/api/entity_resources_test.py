
def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def test_user_can_get_colors_and_styles(client, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    response = client.get('/entity-resources/style', headers=headers)
    styles = response.get_json()['styles']

    assert response.status_code == 200
    assert len(styles) > 0
    assert styles[0]['label'] and styles[0]['color']


def test_user_can_get_specific_color_and_style(client, test_user):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])

    get_response = client.get('/entity-resources/style/association', headers=headers)

    assert get_response.status_code == 200
    assert {
               "label": "association",
               "color": "#d7d9f8",
               "icon_code": None,
               "style": {
                   "border": "#d7d9f8",
                   "background": "#d7d9f8",
                   "color": "#000"
               }
           } == get_response.get_json()


def test_user_can_get_uri(client, test_user, uri_fixture):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])
    headers['content_type'] = 'application/json'

    post_payload = {'domain': 'CHEBI', 'term': 'CHEBI:27732'}

    post_response = client.post('/entity-resources/uri', headers=headers, json=post_payload)
    assert post_response.status_code == 200
    assert post_response.json == {'uri': 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:27732'}  # noqa


def test_user_can_get_many_uris(client, test_user, uri_fixture):
    login_resp = client.login_as_user(test_user.email, 'password')
    headers = generate_headers(login_resp['accessToken']['token'])
    headers['content_type'] = 'application/json'

    post_payload = {'batch': [
        {'domain': 'CHEBI', 'term': 'CHEBI:27732'},
        {'domain': 'CHEBI', 'term': 'CHEBI:28177'},
        {'domain': 'MESH', 'term': '68017572'},
        {'domain': 'MESH', 'term': '68017594'}
        ]
    }

    post_response = client.post('/entity-resources/uri/batch', headers=headers, json=post_payload)
    assert post_response.status_code == 200
    assert len(post_response.json['batch']) == 4
    assert post_response.json == {
        'batch': [
            {'uri': 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:27732'},
            {'uri': 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:28177'},
            {'uri': 'https://www.ncbi.nlm.nih.gov/mesh/?term=68017572'},
            {'uri': 'https://www.ncbi.nlm.nih.gov/mesh/?term=68017594'}
        ]
    }
