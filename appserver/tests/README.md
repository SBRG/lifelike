# Appserver Test Dev README

The server has three test types:

- `unit`: Unit tests run completely independent of the database.
- `database`: Database tests use a `session` fixture to roll back any changes
  after the test ends.
- `api`: API tests have `httpclient` and `session` fixtures. They also roll back
  changes after the test ends.

## FAQ

### How Do I Run pytest

First, remove the existing graph database. The pytests expect a clean graph, otherwise you may get unexpected results. You can remove the graph data quickly with this command:

```bash
# cd into the root project directory
rm -rf ./db/data/databases/graph.db
```

Then, build the app with docker-compose:

```bash
docker-compose up --build
```

To run `pytest` inside the appserver Docker container, run this command:

```bash
docker-compose exec appserver pytest tests
```
