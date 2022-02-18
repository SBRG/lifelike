# Migrations

## Table of Contents
* [What The Folders Mean](#what-the-folders-mean)
* [Why Use Migrations](#why-use-migration)
* [How Liquibase Works](#how-liquibase-works)
* [Checking Migration Version Logs](#checking-migration-version-logs)
* [Rolling Back](#rolling-back)
* [Running Migrations](#running-migrations)

## What The Folders Mean
`lifelike-graph`
- this folder contains migration for the current PROD graph (starting at whatever state on 9/10/2021).

`new-lifelike-graph`
- this folder contains migration to create a **new** graph. Run these migrations first, then run the ones in `lifelike-graph`.

`small-test-graph`
- this folder contains migration to create a small subset graph for development or testing purposes. Run these migrations first, then run the ones in `lifelike-graph`.

## Why Use Migrations
Using migrations allows us to consistently deploy a copy of the current graph model on any server. Like all migration frameworks, if liquibase fails at a step, it will start at that step when you re-run it.

## How Liquibase Works
Liquibase uses `.xml`, `.json` etc files to do its migrations. We will use `.xml` since it's most common.

The `migration/<subfolder_name>/changelog-master.xml` is the entry point that liquibase uses. In that file, it sets `<includeAll>` which tells liquibase where to look for all changelog files. The files in this folder are ran **ALPHABETICALLY**.

**IMPORTANT**: The files in `changelogs` are ran **ALPHABETICALLY**.

What this means is we have to be careful of how we name our files.

- changelog-1.0.xml
- changelog-10.0.xml
- changelog-2.0.xml

The above order, `changelog-10.0.xml` will run **before** `changelog-2.0.xml`. Obviously this is not what we want (since 10 comes after 2), we will need some sort of convention here.

- changelog-0010.xml
- changelog-0020.xml
- changelog-0030.xml
- changelog-0200.xml

We will increment by 10s, as this should allow us to increment alphabetically up to 1000, 1010, 1020, etc...

The simplest changeset `.xml` should be something like this:

```xml
<!--
    < : &lt;
    > : &gt;
    some reason the < character breaks the xml, the > is fine;
    so need to escape that character
-->
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
  xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:pro="http://www.liquibase.org/xml/ns/pro"
  xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-3.8.xsd http://www.liquibase.org/xml/ns/pro http://www.liquibase.org/xml/ns/pro/liquibase-pro-3.8.xsd">

  <!-- BOTH `id` and `author` ARE REQUIRED. -->
  <changeSet id="<JIRA_number>" author="<name>">
    <comment>Testing create query</comment>
    <sql>CREATE (:FOO {name: 'Foo'})</sql>
  </changeSet>
  <changeSet id="<JIRA_number>" author="<name>">
    <!-- more queries -->
  </changeSet>
</databaseChangeLog>
```
**IMPORTANT NOTE**: Each `changeSet` represents a transaction, neo4j does not allow changing the schema (dropping an index, etc) and a write query in the same transaction, otherwise you will get the error `Tried to execute Write query after executing Schema modification`. This means you will need two `changeSet`, so group them together using the `id="some text-#"` naming convention. (See for more info: https://stackoverflow.com/a/56705198).

**IMPORTANT**: Each `changeSet` can only have **one** `<sql>` tag, to run multiple queries, you separate each with a semi-colon "`;`" and set `<sql splitStatements="true">` (splitStatements is true by default). If you have multiple `<sql>` tags in one change set, it will create a deadlock in the database and never finish.

```xml
<changeSet>
  <comment>Testing create query</comment>
  <sql>
    CREATE (:Foo {name: 'Foo'});
    CREATE (:Foo {name: 'Foo Boo'});
  </sql>
</changeSet>
```
More information can be found: https://docs.liquibase.com/concepts/home.html

## Checking Migration Version Logs
Liquibase will create node labels in the database, two of them include: `__LiquibaseChangeLog` and `__LiquibaseChangeSet`.
- `__LiquibaseChangeLog`: when the database was last updated and the related changelog files.
- `__LiquibaseChangeSet`: the migration version chain (or changesets) associated with the changelog files.

## Rolling Back
Liquibase handles rolling back automatically if there is an error: https://docs.liquibase.com/concepts/basic/changeset.html

> Liquibase attempts to execute each changeset in a transaction that is committed at the end, or rolled back if there is an error. Some databases will auto-commit statements which interferes with this transaction setup and could lead to an unexpected database state. Therefore, it is best practice to have just one change per changeset unless there is a group of non-auto-committing changes that you want to apply as a transaction such as inserting data.
  - Again, see for more info: https://stackoverflow.com/a/56705198

However, if you prefer to rollback manually, you can do so...

Before running migrations, you can tag the current state of the database so if the migration fails, you can rollback.
```bash
liquibase tag "some text description" --url jdbc:neo4j:bolt://<ip_address> --username <db_name> --password <db_pass>

liquibase rollback "some text description" --url jdbc:neo4j:bolt://<ip_address> --username <db_name> --password <db_pass> --changeLogFile migrations/changelog-master.xml
```

## Running Migrations
**IMPORTANT: The neo4j version needs to be at least 4.2.11**.

```bash
cd graph-db/migration/liquibase
```
You should be in the `graph-db/migration/liquibase`, look for the `liquibase.properties` file to know if you're in the right folder. Liquibase will use this file to get the credentials for Neo4j.

```bash
> cat liquibase.properties

# properties used by liquibase command line
changeLogFile=lifelike-graph/changelog-master.xml
url=jdbc:neo4j:bolt://localhost?database=
username=
password=

...
```
The `changeLogFile` will tell liquibase which changelogs to run. Choose the correct folder base on your needs. The `url`, `username` and `password` properties are for your Neo4j instance.

There are two commands you can use. The first time you run these commands, you will see a prompt:
```bash
Do you want to see this operation's report in Liquibase Hub, which improves team collaboration? 
If so, enter your email. If not, enter [N] to no longer be prompted, or [S] to skip for now, but ask again next time (default "S"):
```
Simply enter `N` and continue.

```bash
liquibase updateSQL
```
This command (dry run) will give you a preview of what liquibase will run. You can use this command to **make sure the changelog files are going to execute in order**. **IMPORTANT** If the changeset has a `customChange` that calls a Java class, it **WILL** update the database even with this dry run command. So be careful and use a test database.

```bash
liquibase --log-level=info update
```
This command will run the queries and update the database.
