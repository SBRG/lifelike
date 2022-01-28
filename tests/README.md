# Lifelike testing tools

This directory contains various types of test for ensuring perfomance and correctness of the Lifelike application.

- Broser performance testing
- Server stress testing
- Smoke testing

## [Locust](locust/)

These tests are written in Python using the [Locust framework](https://locust.io/)
and are run against the API server to generate load and determine how it performs
responding to expected HTTP requests done by the client.

### Requirements

- Puyhon
- Pipenv

Install Python dependencies:

```bash
cd locust
pipenv install
```

### Run locust interatively

```bash
pipenv run locust
```

Then, navigate to <http://localhost:8089> in a browser.

### To run a test in headless mode

```bash
# Set varibles for the environment to run the tests against
export BASE_URL=https://localhost:5000/api
export USER_EMAIL="user@lifelike.bio"
export USER_PASSWORD="[replace]"
export NUM_USERS=10  # Peak number of concurrent Locust users.
export RUN_TIME=60s  # Stop after the specified amount of time, e.g. (300s, 20m, 3h, 1h30m, etc.).

pipenv run locust \
  --headless \
  --host $BASE_URL \
  --users $NUM_USERS \
  --run-time $RUN_TIME
```

## Element - Browser load testing

These tests are written in Typescript using the [Element](https://element.flood.io/docs/) tool.
They are run in real browsers and are intended to mimic real use case scenarios.


### Running the tests

Install NPM dependencies:

```bash
cd element
yarn install
```

## Cypress (Browser smoke tests)
