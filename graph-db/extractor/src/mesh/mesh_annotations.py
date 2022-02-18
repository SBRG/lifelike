from neo4j import GraphDatabase
from common.database import *
from common.utils import get_data_dir
import logging

def add_annotation_entity_labels(database:Database):
    """
    Add additional entity labels (e.g. Disease, Anatomy, Phenomonea, Food) to mesh topical description.

    Disease: MeSH terms under tree number 'C' as Disease, excluding the top two levels (C and Cxx)
    Anatomy: under tree number 'A', and remove the following terms:[Anatomy, Body Region, Animal Structures, Bacterial Structures, Plant Structures, Fungal Structures and Viral Structures]

    Phenomena:
    1. Phenomena and Process: G
        Exclude Physical Phenomena [G01]
        Exclude Genetic Phenomena (which includes Gene Expression branch) [G05]
        Exclude Food (G07.203.300), Beverage(G07.203.100) and Fermented foods and beverages(G07.203.200)
        Exclude Reproductive Physiological Phenomena [G08.686]
        Exclude Respiratory Physiological Phenomena [G09.772]
        Exclude Environment [G16.500.275]
        Exclude mathematical concepts (G17)
        Exclude all terms contains 'phenomena'
    Psychiatry and Psychology Category: F
        Eliminate all BUT Mental Disorders [F03]
        Exclude the first two levels in hierarchy tree except 'mental disorders'
    """
    query_disease = """
    match (t:TreeNumber) where t.obsolete=0 and t.eid starts with 'C' and t.eid contains '.' 
    with t match (t)-[:HAS_TREENUMBER]-(td:TopicalDescriptor) where td.obsolete = 0 
    with distinct td as t set t:Disease
    """
    database.run_query(query_disease)

    query_anatomy = """
    match (n:TreeNumber) 
    where n.obsolete = 0 and n.eid starts with 'A' and not n.eid in ['A', 'A01', 'A13', 'A18', 'A19', 'A20', 'A21']
    with n match (n)-[]-(td:TopicalDescriptor) where td.obsolete = 0
    with distinct td as t set t:Anatomy
    """
    database.run_query(query_anatomy)

    query_phenomena = """
    match (t:TreeNumber) 
    where t.eid starts with 'G' or t.eid starts with 'F03'
    with t match (t)-[:HAS_TREENUMBER]-(mesh:TopicalDescriptor) where mesh.obsolete = 0 and t.obsolete = 0
    with mesh match (mesh)-[:HAS_TREENUMBER]-(t) where t.obsolete = 0
    with mesh, collect(t.eid) as treenumbers
    where not mesh.name contains 'Phenomena' 
    and none(t in treenumbers where t starts with 'G07.203.300'
    or t starts with 'G07.203.100' 
    or t starts with 'G07.203.200'
    or t starts with 'G01'
    or t starts with 'G05'
    or t starts with 'G08.686'
    or t starts with 'G09.772'
    or t starts with 'G16.500.275'
    or t starts with 'G17')
    with distinct mesh as m set m:Phenomena
    """
    database.run_query(query_phenomena)

    query_food = """
    match (n:db_MESH {name:'Food'})-[:HAS_TREENUMBER]-(t:TreeNumber) 
    with t match (tr:TreeNumber) where tr.eid starts with t.eid and tr.eid <> t.eid
    match (tr)-[:HAS_TREENUMBER]-(m:db_MESH) where m.obsolete = 0
    with distinct m as term set term:Food
    """
    database.run_query(query_food)


def main():
    database = get_database()
    add_annotation_entity_labels(database)
    database.close()


if __name__ == "__main__":
    main()
