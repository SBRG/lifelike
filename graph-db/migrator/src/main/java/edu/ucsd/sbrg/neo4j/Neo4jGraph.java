package edu.ucsd.sbrg.neo4j;

import static org.neo4j.driver.Values.parameters;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.neo4j.driver.Session;
import org.neo4j.driver.SessionConfig;
import org.neo4j.driver.TransactionConfig;

import liquibase.Scope;
import liquibase.exception.CustomChangeException;
import liquibase.logging.Logger;

public class Neo4jGraph {
    static final Logger logger = Scope.getCurrentScope().getLog(Neo4jGraph.class);
    private static final TransactionConfig transactionConfig = TransactionConfig.builder()
            .withTimeout(Duration.ofMinutes(15)).build();

    String neo4jHost;
    String neo4jUsername;
    String neo4jPassword;
    String databaseName;
    Driver driver;

    public Neo4jGraph(String neo4jHost, String neo4jCredentials, String databaseName) {
        String[] creds = neo4jCredentials.split(",");
        this.neo4jHost = neo4jHost;
        this.neo4jUsername = creds[0];
        this.neo4jPassword = creds[1];
        this.databaseName = databaseName;
        this.driver = GraphDatabase.driver(neo4jHost, AuthTokens.basic(neo4jUsername, neo4jPassword));
    }

    public Neo4jGraph(String neo4jHost, String neo4jCredentials) {
        this(neo4jHost, neo4jCredentials, "neo4j");
    }

    public String getNeo4jHost() {
        return this.neo4jPassword;
    }

    public String getNeo4jUsername() {
        return this.neo4jUsername;
    }

    public String getNeo4jPassword() {
        return this.neo4jPassword;
    }

    public Driver getDriver() {
        return this.driver;
    }

    public Session getSession() {
        return this.driver.session(SessionConfig.forDatabase(databaseName));
    }

    private Collection<List<String[]>> partitionData(List<String[]> data, int chunkSize) {
        AtomicInteger counter = new AtomicInteger();
        return data.stream().collect(Collectors.groupingBy(i -> counter.getAndIncrement() / chunkSize)).values();
    }

    public void execute(String query, List<String[]> data, String[] keys, int chunkSize) throws CustomChangeException {
        // Validate data
        if (keys.length != data.get(0).length) {
            logger.warning("Invalid length not equal; keys.length==" + keys.length + " and data.get(0).length=="
                    + data.get(0).length);
            throw new IllegalArgumentException("The number of keys do not match number of data entries!");
        }

        Collection<List<String[]>> chunkedData = this.partitionData(data, chunkSize);
        List<List<Map<String, String>>> chunkedCypherParams = new ArrayList<>();

        logger.fine("Creating chunks of cypher parameters for query: " + query);
        chunkedData.forEach(contentChunk -> {
            List<Map<String, String>> cypherParamsChunk = new ArrayList<>();
            contentChunk.forEach(row -> {
                Map<String, String> param = new HashMap<>();
                for (int i = 0; i < keys.length; i++) {
                    try {
                        param.put(keys[i], row[i]);
                    } catch (IndexOutOfBoundsException e) {
                        throw new IndexOutOfBoundsException();
                    }
                }
                cypherParamsChunk.add(param);
            });
            chunkedCypherParams.add(cypherParamsChunk);
        });

        Session session = this.driver.session(SessionConfig.forDatabase(databaseName));
        chunkedCypherParams.forEach(paramChunk -> {
            try {
                session.writeTransaction(
                        tx -> tx.run(query, parameters("rows", paramChunk)),
                        transactionConfig);
            } catch (Exception e) {
                logger.severe(e.toString());
            }
        });
        session.close();
    }
}
