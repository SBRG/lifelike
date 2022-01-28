# import attr
# import io
# import os
# import multiprocessing as mp
# from itertools import islice

# from neo4japp.factory import create_app
# from neo4japp.util import normalize_str

# from neo4japp.services.annotations.constants import DEFAULT_ANNOTATION_CONFIGS
# from neo4japp.services.annotations.pipeline import create_annotations_from_text


# # reference to this directory
# directory = os.path.realpath(os.path.dirname(__file__))

# app = create_app('Functional Test Flask App', config='config.QA')


# TODO: commenting out cause it is a standalone script
# will update later to work with current codebase


# @attr.s(frozen=True)
# class BadData():
#     line = attr.ib()
#     counter = attr.ib()
#     nothing_found = attr.ib(default='')
#     gene_not_found = attr.ib(default='')
#     disease_not_found = attr.ib(default='')
#     annotated_type_different = attr.ib(default='')


# def get_data():
#     with open(os.path.join(directory, 'text', 'snippet-sorted.tsv'), 'r') as zenodo:  # noqa
#         for file_line, line in enumerate(islice(zenodo, 0, 1000)):  # 5086
#             yield file_line, line


# def do_annotation(data):
#     with app.app_context():
#         file_line, line = data
#         counter = file_line + 1

#         # headers
#         # id:ID(Snippet-ID)
#         # pmid
#         # sentence_num
#         # entry1_text
#         # entry1_type
#         # entry2_text
#         # entry2_type
#         # path
#         # sentence
#         split_line = line.split('\t')
#         pubmed_id = split_line[1]
#         sentence_num = split_line[2]
#         first_entity = split_line[3]
#         first_entity_type = split_line[4]
#         second_entity = split_line[5]
#         second_entity_type = split_line[6]
#         sentence = split_line[8]

#         annotations = create_annotations_from_text(
#             annotation_configs=DEFAULT_ANNOTATION_CONFIGS,
#             specified_organism_synonym='Homo sapiens',
#             specified_organism_tax_id='9606',
#             text=sentence
#         )['documents'][0]['passages'][0]['annotations']

#         if len(annotations) == 0:
#             str_to_add = f'{file_line+1}\tfound nothing\t{line[:-1]}'
#             return BadData(
#                 line=str_to_add, nothing_found=str_to_add, counter=counter)
#         else:
#             first_entity_normed = normalize_str(first_entity)
#             second_entity_normed = normalize_str(second_entity)
#             anno_dict = {normalize_str(anno['textInDocument']): anno['meta']['type'].lower() for anno in annotations}  # noqa

#             if first_entity_normed not in anno_dict:
#                 str_to_add = f'{file_line+1}\t{first_entity} not found\t{line[:-1]}'
#                 if first_entity_type == 'gene':
#                     return BadData(
#                         line=str_to_add, gene_not_found=str_to_add, counter=counter)
#                 elif first_entity_type == 'disease':
#                     return BadData(
#                         line=str_to_add, disease_not_found=str_to_add, counter=counter)
#                 return None

#             if second_entity_normed not in anno_dict:
#                 str_to_add = f'{file_line+1}\t{second_entity} not found\t{line[:-1]}'
#                 if second_entity_type == 'gene':
#                     return BadData(
#                         line=str_to_add, gene_not_found=str_to_add, counter=counter)
#                 elif second_entity_type == 'disease':
#                     return BadData(
#                         line=str_to_add, disease_not_found=str_to_add, counter=counter)
#                 return None

#             if anno_dict[first_entity_normed] != first_entity_type:
#                 str_to_add = f'{file_line+1}\t{first_entity} type annotated {anno_dict[first_entity_normed]}\t{line[:-1]}'  # noqa
#                 if first_entity_type != 'gene' and anno_dict[first_entity_normed] != 'protein':  # noqa
#                     return BadData(
#                         line=str_to_add,
#                         annotated_type_different=str_to_add,
#                         counter=counter)
#                 return None

#             if anno_dict[second_entity_normed] != second_entity_type:
#                 str_to_add = f'{file_line+1}\t{second_entity} type annotated {anno_dict[second_entity_normed]}\t{line[:-1]}'  # noqa
#                 if second_entity_type != 'gene' and anno_dict[second_entity_normed] != 'protein':  # noqa
#                     return BadData(
#                         line=str_to_add,
#                         annotated_type_different=str_to_add,
#                         counter=counter)
#                 return None

#             return None


# def main():
#     # app = create_app('Functional Test Flask App', config='config.QA')
#     stringio = io.StringIO()
#     output_file = open(os.path.join(directory, 'text', 'snippet-removed.tsv'), 'w')

#     nothing_found = set()
#     gene_not_found = set()
#     disease_not_found = set()
#     annotated_type_different = set()
#     counter = 0

#     # app = create_app('Functional Test Flask App', config='config.QA')
#     with app.app_context():
#         # check if KG is online
#         from neo4japp.database import driver
#         sess = driver.session()
#         print(sess.read_transaction(
#           lambda tx: list(tx.run('MATCH (n:Taxonomy) RETURN n LIMIT 1'))))
#         print(sess.read_transaction(
#           lambda tx: list(tx.run('MATCH (n:Chemical) RETURN n LIMIT 1'))))
#         sess.close()

#     with mp.Pool(4) as pool:
#         results = pool.map(do_annotation, get_data())
#         for r in [bad for bad in results if bad is not None]:
#             counter = r.counter
#             print(r.line, file=stringio)
#             if r.nothing_found:
#                 nothing_found.add(r.nothing_found)
#             if r.gene_not_found:
#                 gene_not_found.add(r.gene_not_found)
#             if r.disease_not_found:
#                 disease_not_found.add(r.disease_not_found)
#             if r.annotated_type_different:
#                 annotated_type_different.add(r.annotated_type_different)

#     print(f'Found nothing {len(nothing_found)} / {counter} total', file=stringio)
#     print(f'Gene not found {len(gene_not_found)} / {counter} total', file=stringio)
#     print(f'Disease not found {len(disease_not_found)} / {counter} total', file=stringio)
#     print(f'Different type annotated {len(annotated_type_different)} / {counter} total', file=stringio)  # noqa
#     print(stringio.getvalue(), file=output_file)
#     stringio.close()
#     output_file.close()

#     # with app.app_context():
#     #     nothing_found = set()
#     #     gene_not_found = set()
#     #     disease_not_found = set()
#     #     annotated_type_different = set()

#     #     stringio = io.StringIO()
#     #     output_file = open(os.path.join(directory, 'text', 'snippet-removed.tsv'), 'w')

#     #     counter = 0
#     #     with open(os.path.join(directory, 'text', 'snippet.tsv'), 'r') as zenodo:  # noqa
#     #         for file_line, line in enumerate(zenodo):
#     #             counter = file_line + 1

#     #             # headers
#     #             # id:ID(Snippet-ID)
#     #             # pmid
#     #             # sentence_num
#     #             # entry1_text
#     #             # entry1_type
#     #             # entry2_text
#     #             # entry2_type
#     #             # path
#     #             # sentence
#     #             split_line = line.split('\t')
#     #             pubmed_id = split_line[1]
#     #             sentence_num = split_line[2]
#     #             first_entity = split_line[3]
#     #             first_entity_type = split_line[4]
#     #             second_entity = split_line[5]
#     #             second_entity_type = split_line[6]
#     #             sentence = split_line[8]

#     #             annotations = create_annotations_from_text(
#     #                 annotation_configs=DEFAULT_ANNOTATION_CONFIGS,
#     #                 specified_organism_synonym='Homo sapiens',
#     #                 specified_organism_tax_id='9606',
#     #                 text=sentence
#     #             )['documents'][0]['passages'][0]['annotations']

#     #             if len(annotations) == 0:
#     #                 str_to_add = f'{file_line+1}\tfound nothing\t{line[:-1]}'
#     #                 nothing_found.add(str_to_add)
#     #                 print(str_to_add, file=stringio)
#     #             else:
#     #                 first_entity_normed = normalize_str(first_entity)
#     #                 second_entity_normed = normalize_str(second_entity)
#     #                 anno_dict = {normalize_str(anno['textInDocument']): anno['meta']['type'].lower() for anno in annotations}  # noqa

#     #                 if first_entity_normed not in anno_dict:
#     #                     str_to_add = f'{file_line+1}\t{first_entity} not found\t{line[:-1]}'
#     #                     if first_entity_type == 'gene':
#     #                         gene_not_found.add(str_to_add)
#     #                         print(str_to_add, file=stringio)
#     #                     elif first_entity_type == 'disease':
#     #                         disease_not_found.add(str_to_add)
#     #                         print(str_to_add, file=stringio)
#     #                     continue

#     #                 if second_entity_normed not in anno_dict:
#     #                     str_to_add = f'{file_line+1}\t{second_entity} not found\t{line[:-1]}'
#     #                     if second_entity_type == 'gene':
#     #                         gene_not_found.add(str_to_add)
#     #                         print(str_to_add, file=stringio)
#     #                     elif second_entity_type == 'disease':
#     #                         disease_not_found.add(str_to_add)
#     #                         print(str_to_add, file=stringio)
#     #                     continue

#     #                 if anno_dict[first_entity_normed] != first_entity_type:
#     #                     str_to_add = f'{file_line+1}\t{first_entity} type annotated {anno_dict[first_entity_normed]}\t{line[:-1]}'  # noqa
#     #                     if first_entity_type != 'gene' and anno_dict[first_entity_normed] != 'protein':  # noqa
#     #                         annotated_type_different.add(str_to_add)
#     #                         print(str_to_add, file=stringio)
#     #                     continue

#     #                 if anno_dict[second_entity_normed] != second_entity_type:
#     #                     str_to_add = f'{file_line+1}\t{second_entity} type annotated {anno_dict[second_entity_normed]}\t{line[:-1]}'  # noqa
#     #                     if second_entity_type != 'gene' and anno_dict[second_entity_normed] != 'protein':  # noqa
#     #                         annotated_type_different.add(str_to_add)
#     #                         print(str_to_add, file=stringio)
#     #                     continue

#     #     print(f'Found nothing {len(nothing_found)} / {counter} total', file=stringio)
#     #     print(f'Gene not found {len(gene_not_found)} / {counter} total', file=stringio)
#     #     print(f'Disease not found {len(disease_not_found)} / {counter} total', file=stringio)
#     #     print(f'Different type annotated {len(annotated_type_different)} / {counter} total', file=stringio)  # noqa
#     #     print(stringio.getvalue(), file=output_file)
#     #     stringio.close()
#     #     output_file.close()


# if __name__ == '__main__':
#     main()
