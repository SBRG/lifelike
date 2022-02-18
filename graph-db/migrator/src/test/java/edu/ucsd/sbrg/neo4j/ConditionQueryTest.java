package edu.ucsd.sbrg.neo4j;

import org.junit.Before;
import org.junit.Ignore;
import org.junit.Test;
import org.neo4j.driver.Session;

import java.io.IOException;

public class ConditionQueryTest {
    private Neo4jGraph graph;
    final String neo4jHost = "bolt://localhost";
    final String neo4jCreds = "neo4j,password";
    final String neo4jDatabase = "neo4j";

    @Before
    public void setUp() {
        this.graph = new Neo4jGraph(this.neo4jHost, this.neo4jCreds, this.neo4jDatabase);
    }

    public int graphConditionCount(Session session, String cypher) {
        System.out.println("Executing condition cypher query: " + cypher);
        return session.readTransaction(tx -> tx.run(cypher).single().values().get(0).asInt());
    }

    @Ignore
    @Test
    public void testConditionQuery() throws IOException {
        final String conditionQuery = "MATCH (n:db_Literature) RETURN COUNT(n)";
        final String query = "CALL apoc.periodic.iterate(\n" +
                "'MATCH (n:db_Literature) RETURN n LIMIT 50000',\n" +
                "'DETACH DELETE n', {batchSize:10000})";

        Neo4jGraph graph = new Neo4jGraph(neo4jHost, neo4jCreds, neo4jDatabase);
        Session session = this.graph.getSession();
        int nodeCount = this.graphConditionCount(session, conditionQuery);
        System.out.printf("Node count before execution %s\n", nodeCount);

        try {
            while (nodeCount > 0) {
                session.writeTransaction(tx -> tx.run(query)).consume();
                nodeCount = this.graphConditionCount(session, conditionQuery);
            }
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
        session.close();
    }
}
