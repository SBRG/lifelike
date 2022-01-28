from ..constants import DatabaseType, EntityIdStr


def create_ner_type_anatomy(
    id: str,
    name: str,
    synonym: str
) -> dict:
    return {
        EntityIdStr.ANATOMY.value: id,
        'id_type': DatabaseType.MESH.value,
        'name': name,
        'synonym': synonym
    }


def create_ner_type_chemical(id: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.CHEMICAL.value: id,
        'id_type': DatabaseType.CHEBI.value,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_compound(id: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.COMPOUND.value: id,
        'id_type': DatabaseType.BIOCYC.value,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_disease(id: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.DISEASE.value: id,
        'id_type': DatabaseType.MESH.value,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_food(
    id: str,
    name: str,
    synonym: str
) -> dict:
    return {
        EntityIdStr.FOOD.value: id,
        'id_type': DatabaseType.MESH.value,
        'name': name,
        'synonym': synonym
    }


def create_ner_type_gene(
    name: str,
    synonym: str,
    data_source: str = DatabaseType.NCBI_GENE.value
) -> dict:
    return {
        'id_type': data_source,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_phenomena(
    id: str,
    name: str,
    synonym: str
) -> dict:
    return {
        EntityIdStr.PHENOMENA.value: id,
        'id_type': DatabaseType.MESH.value,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_phenotype(
    id: str,
    name: str,
    synonym: str
) -> dict:
    return {
        EntityIdStr.PHENOTYPE.value: id,
        'id_type': DatabaseType.CUSTOM.value,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_protein(name: str, synonym: str) -> dict:
    # changed protein_id to protein_name for now (JIRA LL-671)
    # will eventually change back to protein_id
    return {
        EntityIdStr.PROTEIN.value: name,
        'id_type': DatabaseType.UNIPROT.value,
        'name': name,
        'synonym': synonym,
    }


def create_ner_type_species(
    id: str,
    name: str,
    synonym: str,
    category: str = 'Uncategorized',
) -> dict:
    return {
        EntityIdStr.SPECIES.value: id,
        'id_type': DatabaseType.NCBI_TAXONOMY.value,
        'category': category,
        'name': name,
        'synonym': synonym,
    }


"""
None LMDB related entities
"""


def create_ner_type_company(id: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.COMPANY.value: id,
        'id_type': '',
        'name': name,
        'synonym': synonym
    }


def create_ner_type_entity(id: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.ENTITY.value: id,
        'id_type': '',
        'name': name,
        'synonym': synonym
    }


def create_ner_type_lab_sample(id: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.LAB_SAMPLE.value: id,
        'id_type': '',
        'name': name,
        'synonym': synonym
    }


def create_ner_type_lab_strain(id: str, name: str, synonym: str) -> dict:
    return {
        EntityIdStr.LAB_STRAIN.value: id,
        'id_type': '',
        'name': name,
        'synonym': synonym
    }
