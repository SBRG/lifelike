from ..constants import EntityType


source_labels = {
    EntityType.ANATOMY.value: 'db_MESH',
    EntityType.DISEASE.value: 'db_MESH',
    EntityType.FOOD.value: 'db_MESH',
    EntityType.PHENOMENA.value: 'db_MESH',
    EntityType.PHENOTYPE.value: 'db_MESH',
    EntityType.CHEMICAL.value: 'db_CHEBI',
    EntityType.COMPOUND.value: 'db_BioCyc',
    EntityType.GENE.value: 'db_NCBI',
    EntityType.SPECIES.value: 'db_NCBI',
    EntityType.PROTEIN.value: 'db_UniProt'
}

node_labels = {
    EntityType.ANATOMY.value: 'Anatomy',
    EntityType.DISEASE.value: 'Disease',
    EntityType.FOOD.value: 'Food',
    EntityType.PHENOMENA.value: 'Phenomena',
    EntityType.CHEMICAL.value: 'Chemical',
    EntityType.COMPOUND.value: 'Compound',
    EntityType.GENE.value: 'Gene',
    EntityType.SPECIES.value: 'Taxonomy',
    EntityType.PATHWAY.value: 'Pathway',
    EntityType.PROTEIN.value: 'Protein',
    EntityType.PHENOTYPE.value: 'Phenotype',
    EntityType.ENTITY.value: 'Entity',
    EntityType.COMPANY.value: 'Company',
    EntityType.LAB_SAMPLE.value: 'LabSample',
    EntityType.LAB_STRAIN.value: 'LabStrain'
}


def query_builder(parts):
    return '\n'.join(parts)


def get_organisms_from_gene_ids_query():
    return """
    MATCH (g:Gene) WHERE g.eid IN $gene_ids
    WITH g
    MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)
    RETURN g.eid AS gene_id, g.name as gene_name, t.eid as taxonomy_id,
        t.name as species_name
    """


def get_gene_to_organism_query():
    return """
    MATCH (s:Synonym)-[]-(g:Gene)
    WHERE s.name IN $genes
    WITH s, g MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)-[:HAS_PARENT*0..2]->(p:Taxonomy)
    WHERE p.eid IN $organisms
    RETURN g.name AS gene_name, s.name AS gene_synonym, g.eid AS gene_id,
        p.eid AS organism_id, g.data_source AS data_source
    """


def get_protein_to_organism_query():
    return """
    MATCH (s:Synonym)-[]-(g:db_UniProt)
    WHERE s.name IN $proteins
    WITH s, g MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)-[:HAS_PARENT*0..2]->(p:Taxonomy)
    WHERE p.eid IN $organisms
    RETURN s.name AS protein, collect(g.eid) AS protein_ids, p.eid AS organism_id
    """


def get_global_inclusions_count_query():
    return """
    MATCH (s:GlobalInclusion:Synonym)-[r:HAS_SYNONYM]-(n)
    WHERE r.global_inclusion = true AND exists(r.inclusion_date)
    RETURN count(s) AS total
    """


def get_global_inclusions_query():
    return """
    MATCH (s:GlobalInclusion:Synonym)-[r:HAS_SYNONYM]-(n)
    WHERE r.global_inclusion = true AND exists(r.inclusion_date)
    RETURN
        id(n) AS node_internal_id,
        id(s) AS syn_node_internal_id,
        n.eid AS entity_id,
        s.name AS synonym,
        n.data_source AS data_source,
        r.entity_type AS entity_type,
        r.file_reference AS file_reference,
        r.user AS creator,
        r.inclusion_date AS creation_date
    ORDER BY toLower(synonym)
    """


def get_global_inclusions_paginated_query():
    return """
    MATCH (s:GlobalInclusion:Synonym)-[r:HAS_SYNONYM]-(n)
    WHERE r.global_inclusion = true AND exists(r.inclusion_date)
    RETURN
        id(n) AS node_internal_id,
        id(s) AS syn_node_internal_id,
        n.eid AS entity_id,
        s.name AS synonym,
        n.data_source AS data_source,
        r.entity_type AS entity_type,
        r.file_reference AS file_reference,
        r.user AS creator,
        r.inclusion_date AS creation_date
    ORDER BY toLower(synonym)
    SKIP $skip
    LIMIT $limit
    """


def get_nodes_by_ids(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    if entity_type in source_labels:
        query_label = f'{source_labels[entity_type]}:{query_label}'

    return f"""
    MATCH (n:{query_label}) WHERE n.eid IN $ids
    RETURN n.eid AS entity_id, n.name AS entity_name
    """


# NOTE DEPRECATED: just used in old migration
def get_mesh_by_ids():
    return """
    MATCH (n:db_MESH:TopicalDescriptor) WHERE n.eid IN $ids
    RETURN n.eid AS mesh_id, n.name AS mesh_name
    """


def get_node_labels_and_relationship_query():
    return """
    MATCH (n)-[r:HAS_SYNONYM]-()
    WHERE id(n) IN $node_ids AND exists(n.original_entity_types)
    RETURN id(n) AS node_id, n.eid AS entity_id,
        [l IN labels(n) WHERE NOT l starts WITH 'db_' AND
            NOT l IN [
                'TopicalDescriptor',
                'TreeNumber',
                'BioCycClass',
                'GlobalInclusion',
                'Complex']
            ] AS node_labels,
        n.original_entity_types AS valid_entity_types,
        collect(DISTINCT r.entity_type) AS rel_entity_types
    """


def get_delete_global_inclusion_query():
    return """
    UNWIND $node_ids AS node_ids
    MATCH (s)-[r:HAS_SYNONYM]-(n)
    WHERE id(n) = node_ids[0] AND id(s) = node_ids[1]
    DELETE r
    WITH s
    MATCH (s)-[r:HAS_SYNONYM]-()
    WHERE r.global_inclusion = true AND exists(r.inclusion_date)
    WITH s, collect(r) AS synonym_rel
    CALL apoc.do.when(
        size(synonym_rel) = 0,
        'REMOVE s:GlobalInclusion', '', {synonym_rel: synonym_rel, s:s}
    )
    YIELD value
    RETURN COUNT(*)
    """


def get_global_inclusions_by_type_query(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]

    if entity_type in source_labels:
        query_label = f'{source_labels[entity_type]}:{query_label}'

    return f"""
    MATCH (s:GlobalInclusion:Synonym)-[r:HAS_SYNONYM]-(n:{query_label})
    WHERE r.global_inclusion = true AND exists(r.inclusion_date)
    RETURN
        id(n) AS internal_id,
        n.eid AS entity_id,
        n.name AS entity_name,
        n.data_source AS data_source,
        s.name AS synonym,
        r.hyperlinks AS hyperlinks
    """


def get_lifelike_global_inclusions_by_type_query(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    if entity_type == EntityType.SPECIES.value:
        query_label = 'Organism'

    return f"""
    MATCH (s:GlobalInclusion:Synonym)-[r:HAS_SYNONYM]-(n:db_Lifelike:{query_label})
    RETURN
        id(n) AS internal_id,
        n.eid AS entity_id,
        n.name AS entity_name,
        n.data_source AS data_source,
        s.name AS synonym,
        r.hyperlinks AS hyperlinks
    """


def get_mesh_global_inclusion_exist_query(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    return f"""
    OPTIONAL MATCH (n:db_MESH)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        '{query_label}' IN labels(n) AS node_has_entity_label,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_chemical_global_inclusion_exist_query():
    return """
    OPTIONAL MATCH (n:db_CHEBI:Chemical)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_compound_global_inclusion_exist_query():
    return """
    OPTIONAL MATCH (n:db_BioCyc:Compound)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_gene_global_inclusion_exist_query():
    return """
    OPTIONAL MATCH (n:Gene)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_pathway_global_inclusion_exist_query():
    return """
    OPTIONAL MATCH (n:Pathway)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_protein_global_inclusion_exist_query():
    return """
    OPTIONAL MATCH (n:db_UniProt:Protein)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_species_global_inclusion_exist_query():
    return """
    OPTIONAL MATCH (n:db_NCBI:Taxonomy)-[:HAS_SYNONYM]->(s)
    WHERE n.eid = $entity_id
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) AS synonym_exist
    """


def get_lifelike_global_inclusion_exist_query(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    return f"""
    OPTIONAL MATCH (n:db_Lifelike:{query_label})-[r:HAS_SYNONYM]->(s)
    WHERE n.name = $common_name AND r.entity_type = $entity_type
    RETURN n IS NOT NULL AS node_exist,
        $synonym IN collect(s.name) OR
        CASE WHEN
            n IS NOT NULL THEN NOT 'NULL_' IN n.eid
        ELSE false END AS synonym_exist
    """


def get_create_mesh_global_inclusion_query(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    return """
    MATCH (n:db_MESH) WHERE n.eid = $entity_id
    SET n:replace_with_param
    MERGE (s: Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = $entity_type,
        r.hyperlinks = $hyperlinks
    """.replace('replace_with_param', query_label)


def get_create_chemical_global_inclusion_query():
    return """
    MATCH (n:db_CHEBI:Chemical) WHERE n.eid = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = 'Chemical',
        r.hyperlinks = $hyperlinks
    """


def get_create_compound_global_inclusion_query():
    return """
    MATCH (n:db_BioCyc:Compound) WHERE n.eid = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = 'Compound',
        r.hyperlinks = $hyperlinks
    """


def get_create_gene_global_inclusion_query():
    return """
    MATCH (n:Gene) WHERE n.eid = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = 'Gene',
        r.hyperlinks = $hyperlinks
    """


def get_create_species_global_inclusion_query():
    return """
    MATCH (n:db_NCBI:Taxonomy) WHERE n.eid = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = 'Species',
        r.hyperlinks = $hyperlinks
    """


def get_create_protein_global_inclusion_query():
    return """
    MATCH (n:db_UniProt:Protein) WHERE n.eid = $entity_id
    MERGE (s:Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = 'Protein',
        r.hyperlinks = $hyperlinks
    """


def get_create_lifelike_global_inclusion_query(entity_type):
    if entity_type not in node_labels:
        return ''

    query_label = node_labels[entity_type]
    if entity_type == EntityType.SPECIES.value:
        query_label = 'Organism'

    # NOTE: a new gene should not be created, because
    # we have no option to specify an organism relationship
    # rather a new synonym of an existing gene can be created
    # so no need to add a :Master Gene label

    return """
    MERGE (n:db_Lifelike {name: $common_name})
    ON CREATE
    SET n.eid = $entity_id,
        n:GlobalInclusion:replace_with_param,
        n.data_source = $data_source,
        n.name = $common_name
    WITH n
    MERGE (s:Synonym {name: $synonym})
    SET s:GlobalInclusion, s.lowercase_name = toLower($synonym)
    MERGE (n)-[r:HAS_SYNONYM]->(s)
    ON CREATE
    SET r.inclusion_date = apoc.date.parseAsZonedDateTime($inclusion_date),
        r.global_inclusion = true,
        r.user = $user,
        r.file_reference = $file_uuid,
        r.entity_type = $entity_type,
        r.hyperlinks = $hyperlinks
    """.replace('replace_with_param', query_label)
