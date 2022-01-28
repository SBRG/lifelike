import json
import logging
import os
import random

from faker import Factory
from locust import HttpUser, SequentialTaskSet, TaskSet, between, task

USER_EMAIL = os.getenv("USER_EMAIL", "user@lifelike.bio")
USER_PASSWORD = os.getenv("USER_PASSWORD", "password")
UPLOAD_PROJECT_ID = os.getenv("UPLOAD_PROJECT_ID", "02oJFsTL07cpI7TUUenlF8")

fake = Factory.create()
fake.seed(0)


def get_random_search_terms(num=3):
    return ' '.join(fake.words(num))


class FileBrowserTaskSet(TaskSet):
    def on_start(self):
        self.user.projects = []
        self.user.files = []
        self.list_projects()

    def _get_random_project_id(self):
        return self.user.projects and random.choice(self.user.projects)['root']['hashId']

    def _get_random_file_id(self):
        return self.user.files and random.choice(self.user.files)['hashId']

    @task(1)
    def list_projects(self):
        logging.info(f"Listing first 100 user projects by name")
        with self.client.get(
                "/projects/projects",
                name="/projects/projects (list user projects)",
                params={"limit": 100, "sort": "name"}
        ) as response:
            self.user.projects = response.json().get('results')

    @task(2)
    def list_project_files(self):
        hashId = self._get_random_project_id()
        if hashId:
            logging.info(f"Listing files for project '{hashId}'")
            with self.client.get(
                f"/filesystem/objects/{hashId}",
                name="/filesystem/objects/[hashId] (get objects for project)"
            ) as response:
                files = response.json().get('result').get('children', [])
                logging.info(f"Found {len(files)} files in '{hashId}'")
                if files:
                    self.user.files = files

    @task(3)
    def list_project_annotations(self):
        hashId = self._get_random_project_id()
        if hashId:
            logging.info(
                f"Getting annotations by frequency for whole project {hashId}")
            self.client.post(
                f"/filesystem/objects/{hashId}/annotations/sorted",
                name="/filesystem/objects/[hashId]/annotations/sorted (get sorted annotations)",
                params={"sort": "frequency"})

    @task(6)
    def get_file(self):
        hashId = self._get_random_file_id()
        if hashId:
            logging.info(f"Getting file with id {hashId}")
            self.client.get(
                f"/filesystem/objects/{hashId}",
                name="/filesystem/objects/[hashId] (get single file object)")

    @task(6)
    def get_file_contents(self):
        hashId = self._get_random_file_id()
        if hashId:
            logging.info(f"Getting file contents with id {hashId}")
            self.client.get(
                f"/filesystem/objects/{hashId}/content",
                name="/filesystem/objects/[hashId]/contents (get file object content)")


# class WriteUser(HttpUser):

class UploadFileTaskSet(SequentialTaskSet):
    @task
    def upload_pdf(self):
        projectId = UPLOAD_PROJECT_ID
        filename = fake.file_name(extension='pdf')
        logging.info(f"Uploading new file: {filename} to project {projectId}")
        with self.client.post(
                "/filesystem/objects",
                name="/filesystem/objects (upload file)",
                files=dict(
                    contentValue=(filename, open(self._get_random_pdf(), 'rb'), 'application/pdf')),
                data={"json$": json.dumps(
                    dict(filename=filename,
                         parentHashId=projectId,
                         description=fake.sentence(),
                         public=False,
                         annotationConfigs=self.defaultAnnotationConfigs))}
        ) as response:
            self.hashId = response.json().get('result').get('hashId')
            logging.info(f"File uploaded: {filename} with id {self.hashId}")

    @task
    def generate_annotations(self):
        if self.hashId:
            logging.info(f"Annotating new file: {self.hashId}")
            self.client.post(
                f"/filesystem/annotations/generate",
                name="/filesystem/annotations/generate (Generate annotations)",
                json=dict(hashIds=[self.hashId],
                          annotationConfigs=self.defaultAnnotationConfigs,
                          organism=None))

    def _get_random_pdf(self):
        return random.choice((
            'files/sample.pdf',
            'files/sample2.pdf'))

    defaultAnnotationConfigs = dict(
        excludeReferences=True, annotationMethods=dict(
            Chemical={"nlp": False, "rulesBased": True},
            Disease={"nlp": False, "rulesBased": True},
            Gene={"nlp": False, "rulesBased": True}
        )
    )


class ReadUser(HttpUser):
    wait_time = between(2, 15)
    tasks = [FileBrowserTaskSet, UploadFileTaskSet]

    def on_start(self):
        self.login()

    def login(self):
        with self.client.post(
                "/auth/login",
                name="/auth/login (login)",
                json=dict(email=USER_EMAIL, password=USER_PASSWORD)
        ) as response:
            token = response.json().get('accessToken').get('token')
            self.client.headers = {'Authorization': f'Bearer {token}'}
            logging.info(f"Logged in as {USER_EMAIL}")

    @task(2)
    def get_annotation_legends(self):
        logging.info("Getting annotation legends")
        self.client.get("/visualizer/get-annotation-legend",
                        name="/visualizer/get-annotation-legend (get annotation legends)")

    @task(2)
    def list_public_files(self):
        logging.info("Listing 100 public files by creation date")
        self.client.post(
            "/filesystem/search",
            name="/filesystem/search (list public files)",
            json=dict(type="public", sort="-creationDate", limit=100))

    @task(3)
    def search_public_files(self):
        query = get_random_search_terms()
        logging.info(f"Searching public files with query '{query}'")
        self.client.post(
            "/filesystem/search",
            name="/filesystem/search (search public files)",
            json=dict(type="public", query=query, sort="-creationDate", limit=100))

    @task(4)
    def search_own_content(self):
        query = get_random_search_terms()
        logging.info(f"Searching own content with query '{query}'")
        self.client.get(
            "/search/content",
            name="/search/content (search own content)",
            params=dict(q=query, sort="+name", limit=20))

    @task(4)
    def search_organisms(self):
        query = get_random_search_terms()
        logging.info(f"Searching organisms with query '{query}'")
        self.client.post(
            "/search/organisms",
            name="/search/organisms (search organisms)",
            json=dict(query=query, limit=10))

    @task(5)
    def search_knowledge_graph(self):
        query = get_random_search_terms()
        logging.info(f"Searching knowledge graph with query '{query}'")
        self.client.post(
            "/search/viz-search",
            name=f"/search/viz-search (search knowledge graph)",
            json=dict(query=query, organism="", domains=[],
                      entities=[], page=1, limit=10)
        )

    @task(2)
    def search_synonyms(self):
        term = get_random_search_terms(1)
        logging.info(f"Searching synonyms of '{term}'")
        self.client.get(
            "/search/synonyms",
            name="/search/synonyms (search for synonyms)",
            params=dict(term=term, organisms="", types="", limit=100))
