## Java Project Setup
This is a JAVA maven project, so you will need some sort of IDE so the project can download the dependencies.

IntelliJ: https://www.jetbrains.com/idea/ (Download community version)

Once repo is cloned, open IntelliJ and go to File > Open (select **liquibase-src** folder)

If you want to add new dependencies, you will need to update the `pom.xml` file, then right-click the file, go to Maven (bottom) > Reload Project.
- To update the `pom.xml` file, go to the maven repository listing to find the dependencies you want: https://mvnrepository.com/

## Installation
Before installing liquibase and maven, make sure you have the openjdk installed and added to your path in the `.bash_profile`.
```bash
> brew install openjdk openjdk@11
> vim ~/<path>/<to>/.bash_profile

# in .bash_profile (if file doesn't exist, then create it in ~/.bash_profile)
export PATH="/usr/local/opt/openjdk/bin:$PATH"

# :wq to exit vim and save
> source <path>/<to>/.bash_profile
```

Migration uses Liquibase for Neo4j (https://neo4j.com/labs/liquibase/):
- https://github.com/liquibase/liquibase-neo4j

To get started, install the liquibase CLI based on your operating system: https://docs.liquibase.com/concepts/installation/home.html
- For Mac OS, you can also install with `homebrew` (https://brew.sh/) with the command: `brew install liquibase`.

Once installed, you need to set the `LIQUIBASE_HOME` path. If you used homebrew, it will tell you:
```bash
You should set the environment variable LIQUIBASE_HOME to
  /usr/local/opt/liquibase/libexec
```
So edit your `.bash_profile`:
```bash
> vim ~/<path>/<to>/.bash_profile
# then add the below to the file
# where liquibase was installed
LIQUIBASE_HOME="<liquibase>/<installed>" # e.g "/usr/local/opt/liquibase/libexec"
...
export PATH="...:$LIQUIBASE_HOME"

# :wq to exit vim and save
> source <path>/<to>/.bash_profile
```

You will also need the Java JDK (version 8+). Again, if you're on Mac OS, you can use `brew install openjdk@<version>`. To see the available versions do `brew list`. Once installed, you can see a similar output:
```bash
> java --version
openjdk 16.0.1 2021-04-20
OpenJDK Runtime Environment Homebrew (build 16.0.1+0)
OpenJDK 64-Bit Server VM Homebrew (build 16.0.1+0, mixed mode, sharing)
```

Run the command below to confirm the liquibase CLI is installed.

```bash
> liquibase -version
####################################################
##   _     _             _ _                      ##
##  | |   (_)           (_) |                     ##
##  | |    _  __ _ _   _ _| |__   __ _ ___  ___   ##
##  | |   | |/ _` | | | | | '_ \ / _` / __|/ _ \  ##
##  | |___| | (_| | |_| | | |_) | (_| \__ \  __/  ##
##  \_____/_|\__, |\__,_|_|_.__/ \__,_|___/\___|  ##
##              | |                               ##
##              |_|                               ##
##                                                ## 
##  Get documentation at docs.liquibase.com       ##
##  Get certified courses at learn.liquibase.com  ## 
##  Free schema change activity reports at        ##
##      https://hub.liquibase.com                 ##
##                                                ##
####################################################
Starting Liquibase at 15:30:24 (version 4.4.1 #29 built at 2021-07-09 16:46+0000)
Running Java under /usr/local/Cellar/openjdk/16.0.1/libexec/openjdk.jdk/Contents/Home (Version 16.0.1)

Liquibase Version: 4.4.1
Liquibase Community 4.4.1 by Datical
```

### JAR Files
You will need two JAR (`.jar`) files for liquibase to work:
- liquibase-neo4j: https://github.com/liquibase/liquibase-neo4j/releases
- Neo4j JDBC: https://github.com/neo4j-contrib/neo4j-jdbc/releases

Download them based on the neo4j version, e.g 4.x for our neo4j. Put them in the `$LIQUIBASE_HOME/lib` folder location.

```bash
> pwd
/usr/local/opt/liquibase/libexec/lib
> ls -lt
total 27112
-rw-r--r--@ 1 ...  10830098 Sep 10 14:53 neo4j-jdbc-driver-4.0.3.jar
-rw-r--r--@ 1 ...    25529 Sep 10 14:53 liquibase-neo4j-4.4.3.jar
-rw-r--r--  1 ...  2303679 Jul  9 09:50 h2-1.4.200.jar
-rw-r--r--  1 ...   125632 Jul  9 09:50 jaxb-api-2.3.0.jar
-rw-r--r--  1 ...   255502 Jul  9 09:50 jaxb-core-2.3.0.jar
-rw-r--r--  1 ...   963660 Jul  9 09:50 jaxb-impl-2.3.0.jar
-rw-r--r--  1 ...     3225 Jul  9 09:50 liquibase_autocomplete.sh
-rw-r--r--  1 ...     2578 Jul  9 09:50 liquibase_autocomplete_mac.bash
-rw-r--r--  1 ...   402057 Jul  9 09:50 picocli-4.6.1.jar
-rw-r--r--  1 ...   310104 Jul  9 09:50 snakeyaml-1.27.jar
```

### Custom Java Classes
Some of our queries are advance queries or require some sort of data file parsing that liquibase does not have support for. To workaround this, we created `*Handler.java` Java classes (located in `migration/liquibase-src`) that need to be compiled into JAR files and also copied into the `$LIQUIBASE_HOME/lib` folder.

NOTE: If you do not have `mvn` command, run `brew install maven`.

```bash
cd migration/liquibase-src
# we skip the unit tests because those require connection to the graph
# so these should be ran before first
mvn package -DskipTests
cp target/lifelike-liquibase-<version>-SNAPSHOT.jar /usr/local/opt/liquibase/libexec/lib/
```

To use these classes, check the comment docs in the source code.

### Useful Neo4j Java Documentation
Useful documentations...
- https://docs.liquibase.com/change-types/community/custom-change.html
- https://github.com/liquibase/liquibase/tree/master/liquibase-core/src/test/java/liquibase/change/custom
- https://github.com/neo4j/neo4j-java-driver
- https://neo4j.com/docs/java-manual/current/session-api/
- https://neo4j.com/docs/api/java-driver/current/
- Naming convention: https://docs.microsoft.com/en-us/rest/api/storageservices/naming-and-referencing-containers--blobs--and-metadata
- Azure SDK References: https://docs.microsoft.com/en-us/java/api/com.azure.storage.file.share?view=azure-java-stable
- GCloud SDK References: https://cloud.google.com/storage/docs/apis & https://pypi.org/project/google-cloud-storage/
