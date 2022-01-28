import json

from typing import Dict, List

from .constants import (
    EntityType,
    ANATOMY_LMDB,
    CHEMICALS_LMDB,
    COMPOUNDS_LMDB,
    DISEASES_LMDB,
    FOODS_LMDB,
    GENES_LMDB,
    PHENOMENAS_LMDB,
    PHENOTYPES_LMDB,
    PROTEINS_LMDB,
    SPECIES_LMDB,
    MAX_GENE_WORD_LENGTH,
    MAX_FOOD_WORD_LENGTH
)
from .data_transfer_objects import (
    RecognizedEntities,
    LMDBMatch,
    NLPResults,
    PDFWord,
    GlobalExclusions,
    GlobalInclusions
)
from .lmdb_service import LMDBService


class EntityRecognitionService:
    def __init__(
        self,
        exclusions: GlobalExclusions,
        inclusions: GlobalInclusions,
        lmdb: LMDBService
    ):
        self.lmdb = lmdb
        self.entity_exclusions = exclusions
        self.entity_inclusions = inclusions

    def _check_lmdb_genes(self, nlp_results: NLPResults, tokens: List[PDFWord]):
        keys = {token.normalized_keyword for token in tokens}

        global_inclusion = self.entity_inclusions.included_genes
        global_exclusion = self.entity_exclusions.excluded_genes
        global_exclusion_case_insensitive = self.entity_exclusions.excluded_genes_case_insensitive

        key_results: Dict[str, List[dict]] = {}

        with self.lmdb.begin(dbname=GENES_LMDB) as txn:
            cursor = txn.cursor()
            matched_results = cursor.getmulti([k.encode('utf-8') for k in keys], dupdata=True)

            for key, value in matched_results:
                decoded_key = key.decode('utf-8')
                match_list = key_results.get(decoded_key, [])
                match_list.append(json.loads(value))
                key_results[decoded_key] = match_list

        # gene is a bit different
        # we want both from lmdb and inclusions
        # not only check inclusions for keys not in lmdb
        # because a global could normalize to something already in
        # LMDB, e.g IL-8 is a global inclusion, but il8 is already
        # normalized in LMDB from IL8
        for key in keys:
            found = global_inclusion.get(key, None)
            if found:
                match_list = key_results.get(key, [])
                match_list += found
                key_results[key] = match_list

        lmdb_matches = []
        for token in tokens:
            if token.normalized_keyword in key_results:
                lowered = token.keyword.lower()
                if token.keyword in global_exclusion or lowered in global_exclusion_case_insensitive:  # noqa
                    continue

                exact = [data for data in key_results[token.normalized_keyword] if data['synonym'] == token.keyword]  # noqa
                if not exact:
                    continue

                match = LMDBMatch(
                    entities=[data for data in exact if data['synonym'] == data['name']] or exact,
                    token=token
                )
                offset_key = (token.lo_location_offset, token.hi_location_offset)
                # if an entity set in nlp_results is not empty
                # that means NLP was used
                # NLP is veto, so if not found it vetos
                if nlp_results.genes:
                    if offset_key in nlp_results.genes:
                        lmdb_matches.append(match)
                else:
                    lmdb_matches.append(match)
        return lmdb_matches

    def _check_lmdb_species(self, tokens: List[PDFWord]):
        keys = {token.normalized_keyword for token in tokens}

        global_inclusion = self.entity_inclusions.included_species
        local_inclusion = self.entity_inclusions.included_local_species
        global_exclusion = self.entity_exclusions.excluded_species

        key_results: Dict[str, List[dict]] = {}
        key_results_local: Dict[str, List[dict]] = {}

        with self.lmdb.begin(dbname=SPECIES_LMDB) as txn:
            cursor = txn.cursor()
            matched_results = cursor.getmulti([k.encode('utf-8') for k in keys], dupdata=True)

            for key, value in matched_results:
                decoded_key = key.decode('utf-8')
                match_list = key_results.get(decoded_key, [])
                match_list.append(json.loads(value))
                key_results[decoded_key] = match_list

        unmatched_keys = keys - set(key_results)

        # for species, check both global and local inclusions
        for key in unmatched_keys:
            found = global_inclusion.get(key, None)
            if found:
                key_results[key] = found

        unmatched_keys = keys - set(key_results)

        for key in unmatched_keys:
            found = local_inclusion.get(key, None)
            if found:
                key_results_local[key] = found

        lmdb_matches = []
        lmdb_matches_local = []
        for token in tokens:
            if token.keyword.lower() not in global_exclusion:
                if token.normalized_keyword in key_results:
                    lmdb_matches.append(
                        LMDBMatch(
                            entities=[
                                data for data in key_results[token.normalized_keyword] if data['synonym'] == data['name']  # noqa
                            ] or key_results[token.normalized_keyword],
                            token=token
                        )
                    )
                elif token.normalized_keyword in key_results_local:
                    lmdb_matches_local.append(
                        LMDBMatch(
                            entities=[
                                data for data in key_results_local[token.normalized_keyword] if data['synonym'] == data['name']  # noqa
                            ] or key_results_local[token.normalized_keyword],
                            token=token
                        )
                    )
        return lmdb_matches, lmdb_matches_local

    def check_lmdb(self, nlp_results: NLPResults, tokens: List[PDFWord]):
        results = RecognizedEntities()
        original_keys = {token.normalized_keyword for token in tokens}

        for entity_type in [entity.value for entity in EntityType]:
            # because an entity type can create its own set of keys
            # need to reset for next iteration
            keys = original_keys
            dbname = None
            global_inclusion = None
            global_exclusion = None
            global_exclusion_case_insensitive = None

            if entity_type == EntityType.ANATOMY.value:
                dbname = ANATOMY_LMDB
                global_inclusion = self.entity_inclusions.included_anatomy
                global_exclusion = self.entity_exclusions.excluded_anatomy

            elif entity_type == EntityType.CHEMICAL.value:
                dbname = CHEMICALS_LMDB
                global_inclusion = self.entity_inclusions.included_chemicals
                global_exclusion = self.entity_exclusions.excluded_chemicals

            elif entity_type == EntityType.COMPOUND.value:
                dbname = COMPOUNDS_LMDB
                global_inclusion = self.entity_inclusions.included_compounds
                global_exclusion = self.entity_exclusions.excluded_compounds

            elif entity_type == EntityType.DISEASE.value:
                dbname = DISEASES_LMDB
                global_inclusion = self.entity_inclusions.included_diseases
                global_exclusion = self.entity_exclusions.excluded_diseases

            elif entity_type == EntityType.FOOD.value:
                dbname = FOODS_LMDB
                global_inclusion = self.entity_inclusions.included_foods
                global_exclusion = self.entity_exclusions.excluded_foods
                keys = {token.normalized_keyword for token in tokens
                        if len(token.keyword.split(' ')) <= MAX_FOOD_WORD_LENGTH}

            elif entity_type == EntityType.GENE.value:
                gene_matches = self._check_lmdb_genes(
                    nlp_results=nlp_results,
                    tokens=[token for token in tokens if len(
                        token.keyword.split(' ')) <= MAX_GENE_WORD_LENGTH])
                results.recognized_genes = gene_matches
                continue

            elif entity_type == EntityType.PHENOMENA.value:
                dbname = PHENOMENAS_LMDB
                global_inclusion = self.entity_inclusions.included_phenomenas
                global_exclusion = self.entity_exclusions.excluded_phenomenas

            elif entity_type == EntityType.PHENOTYPE.value:
                dbname = PHENOTYPES_LMDB
                global_inclusion = self.entity_inclusions.included_phenotypes
                global_exclusion = self.entity_exclusions.excluded_phenotypes

            elif entity_type == EntityType.PROTEIN.value:
                dbname = PROTEINS_LMDB
                global_inclusion = self.entity_inclusions.included_proteins
                global_exclusion = self.entity_exclusions.excluded_proteins
                global_exclusion_case_insensitive = self.entity_exclusions.excluded_proteins_case_insensitive  # noqa

            elif entity_type == EntityType.SPECIES.value:
                species_matches, species_matches_local = self._check_lmdb_species(
                    tokens=tokens)
                results.recognized_species = species_matches
                results.recognized_local_species = species_matches_local
                continue

            # non lmdb lookups
            elif entity_type == EntityType.COMPANY.value:
                global_inclusion = self.entity_inclusions.included_companies
                global_exclusion = self.entity_exclusions.excluded_companies
                results.recognized_companies = [
                    LMDBMatch(
                        entities=global_inclusion[token.normalized_keyword],
                        token=token
                    ) for token in tokens if global_inclusion.get(
                        token.normalized_keyword) and token.keyword.lower() not in global_exclusion]
                continue

            # non lmdb lookups
            elif entity_type == EntityType.ENTITY.value:
                global_inclusion = self.entity_inclusions.included_entities
                global_exclusion = self.entity_exclusions.excluded_entities
                results.recognized_entities = [
                    LMDBMatch(
                        entities=global_inclusion[token.normalized_keyword],
                        token=token
                    ) for token in tokens if global_inclusion.get(
                        token.normalized_keyword) and token.keyword.lower() not in global_exclusion]
                continue

            # non lmdb lookups
            elif entity_type == EntityType.LAB_SAMPLE.value:
                global_inclusion = self.entity_inclusions.included_lab_samples
                global_exclusion = self.entity_exclusions.excluded_lab_samples
                results.recognized_lab_samples = [
                    LMDBMatch(
                        entities=global_inclusion[token.normalized_keyword],
                        token=token
                    ) for token in tokens if global_inclusion.get(
                        token.normalized_keyword) and token.keyword.lower() not in global_exclusion]
                continue

            # non lmdb lookups
            elif entity_type == EntityType.LAB_STRAIN.value:
                global_inclusion = self.entity_inclusions.included_lab_strains
                global_exclusion = self.entity_exclusions.excluded_lab_strains
                results.recognized_lab_strains = [
                    LMDBMatch(
                        entities=global_inclusion[token.normalized_keyword],
                        token=token
                    ) for token in tokens if global_inclusion.get(
                        token.normalized_keyword) and token.keyword.lower() not in global_exclusion]
                continue

            if dbname is not None and global_inclusion is not None and global_exclusion is not None:  # noqa
                key_results: Dict[str, List[dict]] = {}

                with self.lmdb.begin(dbname=dbname) as txn:
                    cursor = txn.cursor()
                    matched_results = cursor.getmulti([k.encode('utf-8') for k in keys], dupdata=True)  # noqa

                    for key, value in matched_results:
                        decoded_key = key.decode('utf-8')
                        match_list = key_results.get(decoded_key, [])
                        match_list.append(json.loads(value))
                        key_results[decoded_key] = match_list

                unmatched_keys = keys - set(key_results)

                for key in unmatched_keys:
                    found = global_inclusion.get(key, None)
                    if found:
                        key_results[key] = found

                lmdb_matches = []
                for token in tokens:
                    if token.normalized_keyword in key_results:
                        lowered = token.keyword.lower()
                        if global_exclusion_case_insensitive:
                            if token.keyword in global_exclusion or lowered in global_exclusion_case_insensitive:  # noqa
                                continue
                        else:
                            if lowered in global_exclusion:
                                continue

                        match = LMDBMatch(
                            entities=[
                                data for data in key_results[token.normalized_keyword] if data['synonym'] == data['name']  # noqa
                            ] or key_results[token.normalized_keyword],
                            token=token
                        )
                        offset_key = (token.lo_location_offset, token.hi_location_offset)
                        # only a few entities currently have NLP
                        # if an entity set in nlp_results is not empty
                        # that means NLP was used
                        # NLP is veto, so if not found it vetos
                        if entity_type == EntityType.CHEMICAL.value and nlp_results.chemicals:
                            if offset_key in nlp_results.chemicals:
                                lmdb_matches.append(match)
                        elif entity_type == EntityType.COMPOUND.value and nlp_results.compounds:
                            if offset_key in nlp_results.compounds:
                                lmdb_matches.append(match)
                        elif entity_type == EntityType.DISEASE.value and nlp_results.diseases:
                            if offset_key in nlp_results.diseases:
                                lmdb_matches.append(match)
                        else:
                            lmdb_matches.append(match)

                if entity_type == EntityType.ANATOMY.value:
                    results.recognized_anatomy = lmdb_matches

                elif entity_type == EntityType.CHEMICAL.value:
                    results.recognized_chemicals = lmdb_matches

                elif entity_type == EntityType.COMPOUND.value:
                    results.recognized_compounds = lmdb_matches

                elif entity_type == EntityType.DISEASE.value:
                    results.recognized_diseases = lmdb_matches

                elif entity_type == EntityType.FOOD.value:
                    results.recognized_foods = lmdb_matches

                elif entity_type == EntityType.PHENOMENA.value:
                    results.recognized_phenomenas = lmdb_matches

                elif entity_type == EntityType.PHENOTYPE.value:
                    results.recognized_phenotypes = lmdb_matches

                elif entity_type == EntityType.PROTEIN.value:
                    results.recognized_proteins = lmdb_matches
        return results

    def identify(self, tokens: List[PDFWord], nlp_results: NLPResults) -> RecognizedEntities:
        return self.check_lmdb(nlp_results=nlp_results, tokens=tokens)
