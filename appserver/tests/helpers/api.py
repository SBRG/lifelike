def generate_jwt_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}
