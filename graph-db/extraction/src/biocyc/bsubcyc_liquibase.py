from biocyc.biocyc_liquibase import *

gene_link_cypher = """
match(n:Gene:db_BsubCyc) where n.accession starts with 'BSU' 
with n, replace(n.accession, 'BSU', 'BSU_') as locus_tag 
match(g:Gene) where g.locus_tag=locus_tag merge (n)-[:IS]->(g);

match(n:Gene:db_BsubCyc) where not (n)-[:HAS_GENE]-() and size(n.accession)>0 
with n match (g:Gene) where g.locus_tag = n.accession merge (n)-[:IS]->(g);

match(n:Gene:db_BsubCyc) where not (n)-[:HAS_GENE]-() and size(n.name)>0 with n 
match (g:Gene) where g.name = n.name and g.tax_id='224308' merge (n)-[:IS]->(g);
"""

def generate_changelog_files(zip_datafile, biocyc_dbname):
    proc = BioCycChangeLogsGenerator('rcai', biocyc_dbname, zip_datafile, True)
    proc.add_all_change_sets()
    proc.generate_init_changelog_file()

    proc = BioCycCypherChangeLogsGenerator('rcai', biocyc_dbname, gene_link_cypher)
    proc.generate_post_load_changlog_file()
    proc.generate_gds_changelog_file()


if __name__ == "__main__":
    generate_changelog_files('BsubCyc-data-47.zip', DB_BSUBCYC)

