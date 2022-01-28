import binascii
import json
import hashlib
import os
import types
import hashlib
import pytest
from datetime import date, datetime

from neo4japp.models import (
    AppRole,
    AppUser,
    GlobalList,
    Projects,
    projects_collaborator_role,
    FileContent,
    Files,
    DomainURLsMap,
    AnnotationStyle,
    FallbackOrganism
)
from neo4japp.services import AccountService
from neo4japp.services.annotations import AnnotationGraphService, ManualAnnotationService
from neo4japp.services.annotations.constants import EntityType, ManualAnnotationType
from neo4japp.services.elastic import ElasticService


#################
# Service mocks
################
from neo4japp.services.file_types.providers import DirectoryTypeProvider, MapTypeProvider, \
    PDFTypeProvider


@pytest.fixture(scope='function')
def mock_global_compound_inclusion(session):
    annotation = {
        'meta': {
            'id': 'BIOC:Fake',
            'type': EntityType.COMPOUND.value,
        },
        'keyword': 'compound-(12345)'
    }

    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    inclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.INCLUSION.value,
        file_content_id=file_content.id,
        reviewed=True,
        approved=True,
    )

    session.add(inclusion)
    session.flush()


@pytest.fixture(scope='function')
def mock_global_gene_exclusion(session):
    annotation = {
        'meta': {
            'id': '59272',
            'type': EntityType.GENE.value,
        },
        'keyword': 'fake-gene'
    }

    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    exclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.EXCLUSION.value,
        file_content_id=file_content.id,
        reviewed=True,
        approved=True,
    )

    session.add(exclusion)
    session.flush()


@pytest.fixture(scope='function')
def mock_global_list(fix_admin_user, fix_project, session):
    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    f = Files(
        hash_id='pdf1',
        mime_type=PDFTypeProvider.MIME_TYPE,
        filename='pdf1',
        description='a test pdf',
        user=fix_admin_user,
        content=file_content,
        parent=fix_project.root,
    )
    session.add(f)
    session.flush()

    annotation = {
        'meta': {
            'id': 'BIOC:Fake',
            'type': EntityType.COMPOUND.value,
            'allText': 'compound-(12345)'
        },
        'user_id': fix_admin_user.id
    }
    # inclusion = GlobalList(
    #     annotation=annotation,
    #     type=ManualAnnotationType.INCLUSION.value,
    #     file_content_id=file_content.id,
    #     reviewed=True,
    #     approved=True,
    # )
    # session.add(inclusion)
    session.flush()

    annotation = {
        'id': '59272',
        'type': EntityType.GENE.value,
        'text': 'fake-gene',
        'user_id': fix_admin_user.id
    }
    exclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.EXCLUSION.value,
        file_content_id=file_content.id,
        reviewed=True,
        approved=True,
    )
    session.add(exclusion)
    session.flush()


@pytest.fixture(scope='function')
def mock_get_combined_annotations_result(monkeypatch):
    def get_combined_annotations_result(*args, **kwargs):
        return [
            {
                'meta': {
                    'type': EntityType.GENE.value,
                    'id': '945771',
                },
                'keyword': 'cysB',
                'primaryName': 'cysB',
            },
            {
                'meta': {
                    'type': EntityType.SPECIES.value,
                    'id': '511145',
                },
                'keyword': 'e. coli',
                'primaryName': 'Escherichia coli str. K-12 substr. MG1655',
            },
        ]

    monkeypatch.setattr(
        ManualAnnotationService,
        'get_file_annotations',
        get_combined_annotations_result,
    )


@pytest.fixture(scope='function')
def mock_get_organisms_from_gene_ids_result(monkeypatch):
    def get_organisms_from_gene_ids_result(*args, **kwargs):
        return [
            {
                'gene_id': '945771',
                'gene_name': 'cysB',
                'taxonomy_id': '511145',
                'species_name': 'Escherichia coli str. K-12 substr. MG1655',
            }
        ]

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_organisms_from_gene_ids_query',
        get_organisms_from_gene_ids_result,
    )


@pytest.fixture(scope='function')
def mock_index_files(monkeypatch):
    def index_files(*args, **kwargs):
        return None

    monkeypatch.setattr(
        ElasticService,
        'index_files',
        index_files,
    )


@pytest.fixture(scope='function')
def mock_index_maps(monkeypatch):
    def index_maps(*args, **kwargs):
        return None

    monkeypatch.setattr(
        ElasticService,
        'index_maps',
        index_maps,
    )


@pytest.fixture(scope='function')
def mock_delete_elastic_documents(monkeypatch):
    def delete_documents_with_index(*args, **kwargs):
        return None

    monkeypatch.setattr(
        ElasticService,
        'delete_documents_with_index',
        delete_documents_with_index,
    )


####################
# End service mocks
####################

@pytest.fixture(scope='function')
def fix_admin_role(account_service: AccountService) -> AppRole:
    return account_service.get_or_create_role('admin')


@pytest.fixture(scope='function')
def fix_superuser_role(account_service: AccountService) -> AppRole:
    return account_service.get_or_create_role('private-data-access')


@pytest.fixture(scope='function')
def fix_user_role(account_service: AccountService) -> AppRole:
    return account_service.get_or_create_role('user')


@pytest.fixture(scope='function')
def fix_admin_user(session, fix_admin_role, fix_superuser_role) -> AppUser:
    user = AppUser(
        id=100,
        username='api_owner',
        email='admin@lifelike.bio',
        first_name='Jim',
        last_name='Melancholy',
    )
    user.set_password('password')
    user.roles.extend([fix_admin_role, fix_superuser_role])
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def test_user(session, fix_user_role) -> AppUser:
    user = AppUser(
        id=200,
        username='test',
        email='test@lifelike.bio',
        first_name='Jim',
        last_name='Melancholy'
    )
    user.set_password('password')
    user.roles.append(fix_user_role)
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def test_user_2(session) -> AppUser:
    user = AppUser(
        id=300,
        username='pleb',
        email='pleblife@hut.org',
        first_name='pleb',
        last_name='life',
    )
    user.set_password('password')
    user.roles.append(fix_user_role)
    session.add(user)
    session.flush()
    return user


@pytest.fixture(scope='function')
def test_user_with_pdf(
        session, test_user: AppUser,
        fix_directory: Files,
        pdf_dir: str) -> Files:
    pdf_path = os.path.join(pdf_dir, 'example4.pdf')

    with open(pdf_path, 'rb') as pdf_file:
        pdf_content = pdf_file.read()

        file_content = FileContent(
            raw_file=pdf_content,
            checksum_sha256=hashlib.sha256(pdf_content).digest(),
            creation_date=datetime.now(),
        )

        fallback = FallbackOrganism(
            organism_name='Escherichia coli str. K-12 substr. MG1655',
            organism_synonym='Escherichia coli',
            organism_taxonomy_id='511145'
        )

        fake_file = Files(
            filename='example4.pdf',
            content_id=file_content.id,
            user_id=test_user.id,
            mime_type=PDFTypeProvider.MIME_TYPE,
            creation_date=datetime.now(),
            parent_id=fix_directory.id,
            fallback_organism_id=fallback.id
        )

        session.add(fallback)
        session.add(file_content)
        session.add(fake_file)
        session.flush()

    return fake_file


@pytest.fixture(scope='function')
def fix_project(test_user: AppUser, session) -> Projects:
    root_dir = Files(
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        filename='/',
        user=test_user,
    )
    project = Projects(
        name='Lifelike',
        description='Test project',
        root=root_dir,
        creation_date=datetime.now(),
    )
    session.add(root_dir)
    session.add(project)
    session.flush()

    role = AppRole.query.filter(
        AppRole.name == 'project-admin'
    ).one()

    session.execute(
        projects_collaborator_role.insert(),
        [{
            'appuser_id': test_user.id,
            'app_role_id': role.id,
            'projects_id': project.id,
        }]
    )
    session.flush()
    return project


@pytest.fixture(scope='function')
def fix_directory(session, test_user: AppUser) -> Files:
    dir = Files(
        filename='/',
        mime_type=DirectoryTypeProvider.MIME_TYPE,
        user=test_user,
    )

    project = Projects(
        name='test-project',
        description='test project',
        root=dir,
    )

    session.add(project)
    session.add(dir)
    session.flush()

    return dir


def login_as_user(self, email, password) -> AppUser:
    """ Returns the authenticated JWT tokens """
    credentials = {'email': email, 'password': password}
    login_resp = self.post(
        '/auth/login',
        data=json.dumps(credentials),
        content_type='application/json',
    )
    return login_resp.get_json()


@pytest.fixture(scope='function')
def client(app):
    """Creates a HTTP client for REST actions for a test."""
    client = app.test_client()
    client.login_as_user = types.MethodType(login_as_user, client)
    return client


@pytest.fixture(scope='function')
def user_client(client, test_user: AppUser):
    """ Returns an authenticated client as well as the JWT information """
    auth = client.login_as_user('test@lifelike.bio', 'password')
    return client, auth


@pytest.fixture(scope='function')
def uri_fixture(client, session) -> DomainURLsMap:
    uri1 = DomainURLsMap(domain="CHEBI",
                         base_URL="https://www.ebi.ac.uk/chebi/searchId.do?chebiId={}")  # noqa
    uri2 = DomainURLsMap(domain="MESH", base_URL="https://www.ncbi.nlm.nih.gov/mesh/?term={}")

    session.add(uri1)
    session.add(uri2)
    session.flush()

    return uri1

# TODO: Need to create actual mock data for these
