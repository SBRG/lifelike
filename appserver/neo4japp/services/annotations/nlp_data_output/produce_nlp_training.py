import attr
import json
import os

from io import StringIO
from neo4japp.factory import create_app
from neo4japp.services.annotations.constants import EntityType
from neo4japp.services.annotations.initializer import get_annotation_service

import paramiko
import multiprocessing as mp
from itertools import islice

annotator = get_annotation_service()
create_annotations_helper = annotator.create_annotations

# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))
error_file_path = os.path.join(directory, 'errors.txt')
processed_records_path = os.path.join(directory, 'processed_records.txt')


@attr.s(frozen=True)
class NLPAnnotations():
    filename: str = attr.ib()
    text: str = attr.ib()


def create_annotations_from_text(text, title):
    nlp_annotations_list = []
    app = create_app('Functional Test Flask App', config='config.Testing')

    with app.app_context():
        try:
            pdf_text, bioc_json = create_annotations_helper(
                annotation_method='Rules Based',
                specified_organism_synonym='',
                specified_organism_tax_id='',
                document=text,
                filename=title
            )

            nlp_annotations_list.append((NLPAnnotations(
                filename=title,
                text=pdf_text,
            ), bioc_json))
        except Exception as ex:
            raise ex
    return nlp_annotations_list


def mp_text_to_pubtator2(line):
    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('', username='', password='')
    sftp = client.open_sftp()

    split_line = line.replace('\n', '').split(',')
    file_path = split_line[1].replace('"', '')
    identifier = split_line[2].replace('"', '')
    pmcid = split_line[3].replace('"', '')
    title = f'{pmcid}.no-anns.txt'

    stdin, stdout, stderr = client.exec_command(f'cat {file_path}/{title}')
    ltext = list(stdout)
    if not stderr.read() and ltext:
        try:
            text = ltext[0]
        except Exception:
            with open(error_file_path, 'a') as error_file:
                print(line.replace('\n', ''), file=error_file)
            sftp.close()
            client.close()
            return
        results = create_annotations_from_text(text, f'{title}')

        add_offset = False
        offset_length = len(f'{title}') + 1 if add_offset else 0

        mem_file = StringIO()
        print(f'{identifier}|t|{title}', file=mem_file)
        print(f'{identifier}|a|{text}', file=mem_file)

        for (_, bioc_json) in results:
            nlp_annotations = bioc_json['documents'][0]['passages'][0]['annotations']

            for annotation in nlp_annotations:
                lo_offset = annotation['loLocationOffset'] + offset_length
                hi_offset = annotation['hiLocationOffset'] + offset_length
                keyword = annotation['textInDocument']
                keyword_type = annotation['meta']['type']
                id = annotation['meta']['id']

                if keyword_type == EntityType.GENE.value:
                    print(
                        f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
                        file=mem_file,
                    )

        local_file_path = os.path.join(directory, f'processed/{pmcid}.dict.txt')

        with open(local_file_path, 'w') as local_copy:
            print(mem_file.getvalue(), file=local_copy)

        mem_file.close()
        sftp.put(local_file_path, f'{file_path}/{pmcid}.dict.txt')
        with open(processed_records_path, 'a') as processed:
            print(line.replace('\n', ''), file=processed)
    else:
        with open(error_file_path, 'a') as error_file:
            print(line.replace('\n', ''), file=error_file)

    sftp.close()
    client.close()


def mp_text_to_pubtator(
    text,
    chem_file,
    gene_file,
    disease_file,
    species_file
):
    title = 'Nurnberg_et_al._PLOS_Genetics_2020'
    identifier = '12345678'
    results = create_annotations_from_text(text, f'{title}')

    add_offset = False
    offset_length = len(f'{title}') + 1 if add_offset else 0

    chem_mem = StringIO()
    gene_mem = StringIO()
    disease_mem = StringIO()
    species_mem = StringIO()

    pdf_text = results[0][0].text

    for mem_file in [chem_mem, gene_mem, disease_mem, species_mem]:
        print(f'{identifier}|t|{title}', file=mem_file)
        print(f'{identifier}|a|{pdf_text}', file=mem_file)

    for (_, bioc_json) in results:
        nlp_annotations = bioc_json['documents'][0]['passages'][0]['annotations']

        for annotation in nlp_annotations:
            lo_offset = annotation['loLocationOffset'] + offset_length
            hi_offset = annotation['hiLocationOffset'] + offset_length
            keyword = annotation['textInDocument']
            keyword_type = annotation['meta']['type']
            id = annotation['meta']['id']

            if keyword_type == EntityType.CHEMICAL.value:
                print(
                    f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
                    file=chem_mem,
                )
            elif keyword_type == EntityType.GENE.value:
                print(
                    f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
                    file=gene_mem,
                )
            elif keyword_type == EntityType.DISEASE.value:
                print(
                    f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
                    file=disease_mem,
                )
            elif keyword_type == EntityType.SPECIES.value:
                print(
                    f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
                    file=species_mem,
                )

    print(chem_mem.getvalue(), file=chem_file)
    print(gene_mem.getvalue(), file=gene_file)
    print(disease_mem.getvalue(), file=disease_file)
    print(species_mem.getvalue(), file=species_file)

    for mem_file in [chem_mem, gene_mem, disease_mem, species_mem]:
        mem_file.close()


def text_to_pubtator2():
    def get_data():
        with open(os.path.join(directory, 'abstracts/data-1602546717626.csv')) as path_file:
            for line in islice(path_file, 0, 150000):
                yield line

    with mp.Pool(processes=8) as pool:
        pool.map(mp_text_to_pubtator2, get_data())


def text_to_pubtator(
    chem_file,
    gene_file,
    disease_file,
    species_file
):
    with open(os.path.join(directory, 'abstracts/Nurnberg_et_al._PLOS_Genetics_2020.txt')) as path_file:  # noqa
        file_str = path_file.read().replace('\n', ' ')

    mp_text_to_pubtator(file_str, chem_file, gene_file, disease_file, species_file)


def main():
    chemical_pubtator = open(os.path.join(directory, 'chemical_pubtator.txt'), 'w+')
    gene_pubtator = open(os.path.join(directory, 'gene_pubtator.txt'), 'w+')
    disease_pubtator = open(os.path.join(directory, 'disease_pubtator.txt'), 'w+')
    species_pubtator = open(os.path.join(directory, 'species_pubtator.txt'), 'w+')

    # text_to_pubtator2()

    text_to_pubtator(
        chemical_pubtator,
        gene_pubtator,
        disease_pubtator,
        species_pubtator
    )

    # client = paramiko.SSHClient()
    # client.load_system_host_keys()
    # client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    # client.connect('', username='', password='')
    # sftp = client.open_sftp()
    # date = datetime.now()
    # sftp.put(
    #     os.path.join(directory, 'processed_records.txt'),
    #     f'/home/jining/processed_nlp_dict_training_data/processed_records-{date}.txt')  # noqa
    # sftp.put(
    #     os.path.join(directory, 'errors.txt'),
    #     f'/home/jining/processed_nlp_dict_training_data/errors-{date}.txt')  # noqa

    # client.close()
    # sftp.close()

    for f in [chemical_pubtator, gene_pubtator, disease_pubtator, species_pubtator]:
        f.close()


if __name__ == '__main__':
    main()
