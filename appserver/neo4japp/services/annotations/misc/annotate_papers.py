# import io
# import os
# import json

# import requests

# from neo4japp.database import db
# from neo4japp.factory import create_app
# from neo4japp.models import Files
# from neo4japp.services.annotations.constants import DEFAULT_ANNOTATION_CONFIGS
# from neo4japp.services.annotations.pipeline import (
#     create_annotations_from_pdf,
#     create_annotations_from_text
# )


# # reference to this directory
# directory = os.path.realpath(os.path.dirname(__file__))


# FALLBACK_ORGANISM_SYNONYM = ''
# FALLBACK_ORGANISM_TAXID = ''


# TODO: commenting out cause it is a standalone script
# will update later to work with current codebase


# def annotate_pdf():
#     req = requests.post(
#         'http://localhost:5000/auth/login',
#         data=json.dumps({'email': 'admin@example.com', 'password': 'password'}),
#         headers={'Content-type': 'application/json'})

#     access_token = json.loads(req.text)['accessToken']['token']

#     hash_ids = set()

#     for parent, subfolders, filenames in os.walk(os.path.join(directory, 'pdfs/')):
#         for fn in filenames:
#             if fn.lower().endswith('.pdf'):
#                 with open(os.path.join(parent, fn), 'rb') as f:
#                     upload_req = requests.post(
#                         'http://localhost:5000/filesystem/objects',
#                         headers={'Authorization': f'Bearer {access_token}'},
#                         files={'contentValue': f},
#                         data={
#                             'filename': fn,
#                             'parentHashId': 'lazhauxymcrahybaxcvkathnofyissffuidu'}
#                     )
#                     hash_ids.add(json.loads(upload_req.text)['result']['hashId'])

#     files = db.session.query(Files).filter(Files.hash_id.in_(hash_ids)).all()

#     annotations_list = []
#     failed = set()
#     for f in files:
#         try:
#             annotations = create_annotations_from_pdf(
#                 annotation_configs=DEFAULT_ANNOTATION_CONFIGS,
#                 specified_organism_synonym=FALLBACK_ORGANISM_SYNONYM,
#                 specified_organism_tax_id=FALLBACK_ORGANISM_TAXID,
#                 document=f,
#                 filename=f.filename)
#             annotations_list.append(
#                 (f.filename,
#                 annotations['documents'][0]['passages'][0]['text'],  # noqa
#                 annotations['documents'][0]['passages'][0]['annotations']))  # noqa
#         except Exception:
#             try:
#                 annotations = create_annotations_from_pdf(
#                     annotation_configs=DEFAULT_ANNOTATION_CONFIGS,
#                     specified_organism_synonym=FALLBACK_ORGANISM_SYNONYM,
#                     specified_organism_tax_id=FALLBACK_ORGANISM_TAXID,
#                     document=f,
#                     filename=f.filename)
#                 annotations_list.append(
#                     (f.filename,
#                     annotations['documents'][0]['passages'][0]['text'],  # noqa
#                     annotations['documents'][0]['passages'][0]['annotations']))  # noqa
#             except Exception:
#                 failed.add(f.filename)

#     print(f'Failed: {failed}')
#     return annotations_list


# def annotate_text():
#     annotations_list = []
#     failed = set()

#     for parent, subfolders, filenames in os.walk(os.path.join(directory, 'text/')):
#         for fn in filenames:
#             if fn.lower().endswith('.txt'):
#                 with open(os.path.join(parent, fn), 'rb') as f:
#                     title = fn.lower().split('.txt')[0]
#                     text = f.read().decode('utf-8')

#                     try:
#                         annotations = create_annotations_from_text(
#                             annotation_configs=DEFAULT_ANNOTATION_CONFIGS,
#                             specified_organism_synonym=FALLBACK_ORGANISM_SYNONYM,
#                             specified_organism_tax_id=FALLBACK_ORGANISM_TAXID,
#                             text=text)
#                         annotations_list.append(
#                             (title,
#                             annotations['documents'][0]['passages'][0]['text'],  # noqa
#                             annotations['documents'][0]['passages'][0]['annotations']))  # noqa
#                     except Exception:
#                         try:
#                             annotations = create_annotations_from_text(
#                                 annotation_configs=DEFAULT_ANNOTATION_CONFIGS,
#                                 specified_organism_synonym=FALLBACK_ORGANISM_SYNONYM,
#                                 specified_organism_tax_id=FALLBACK_ORGANISM_TAXID,
#                                 text=text)
#                             annotations_list.append(
#                                 (title,
#                                 annotations['documents'][0]['passages'][0]['text'],  # noqa
#                                 annotations['documents'][0]['passages'][0]['annotations']))  # noqa
#                         except Exception:
#                             failed.add(title)

#     print(f'Failed: {failed}')
#     return annotations_list


# def main():
#     app = create_app('Functional Test Flask App', config='config.QA')

#     # TODO: refactor to use multiprocessing
#     # app_context needs to be in the mp function
#     # to avoid weird stuff happening with py2neo
#     with app.app_context():
#         annotations_list = annotate_text()

#         identifier = '1234567'
#         for (filename, text, annos) in annotations_list:
#             print(f'Creating bioc for {filename}.txt...')
#             with open(os.path.join(directory, 'output', f'{filename}.txt'), 'w') as f:
#                 mem_file = io.StringIO()
#                 print(f'{identifier}|t|{filename}', file=mem_file)
#                 print(f'{identifier}|t|{text}', file=mem_file)

#                 for anno in annos:
#                     lo_offset = anno['loLocationOffset']
#                     hi_offset = anno['hiLocationOffset']
#                     keyword = anno['textInDocument']
#                     keyword_type = anno['meta']['type']
#                     id = anno['meta']['id']

#                     print(
#                         f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
#                         file=mem_file,
#                     )

#                 print(mem_file.getvalue(), file=f)


# if __name__ == '__main__':
#     main()
