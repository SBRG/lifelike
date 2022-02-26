package edu.ucsd.sbrg;

import edu.ucsd.sbrg.neo4j.Neo4jGraph;

import liquibase.change.custom.CustomTaskChange;
import liquibase.database.Database;
import liquibase.exception.CustomChangeException;
import liquibase.exception.SetupException;
import liquibase.exception.ValidationErrors;
import liquibase.resource.ResourceAccessor;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.neo4j.driver.Session;

/**
 * <changeSet id="..." author="...">
 * <comment>...</comment>
 * <customChange
 * class="edu.ucsd.sbrg.ConditionQueryHandler"
 * query="..."
 * conditionQuery="..."
 * neo4jHost="${neo4jHost}"
 * neo4jCredentials="${neo4jCredentials}"
 * neo4jDatabase="${neo4jDatabase}"
 * />
 * </changeSet>
 *
 * query: The cypher query to be executed.
 * conditionQuery: The cypher query that acts as the loop condition.
 * E.g MATCH (...) RETURN COUNT(n)
 *
 * This class does not use a file - if one is needed, then make a new
 * ConditionFileQueryHandler?
 */
public class ConditionQueryHandler implements CustomTaskChange {
    private String query;
    private String conditionQuery;
    private ResourceAccessor resourceAccessor;
    static final Logger logger = LogManager.getLogger(FileQueryHandler.class);

    private String neo4jHost;
    private String neo4jCredentials;
    private String neo4jDatabase;

    public ConditionQueryHandler() {
    }

    public String getQuery() {
        return this.query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getConditionQuery() {
        return this.conditionQuery;
    }

    public void setConditionQuery(String conditionQuery) {
        this.conditionQuery = conditionQuery;
    }

    public String getNeo4jHost() {
        return this.neo4jHost;
    }

    public void setNeo4jHost(String neo4jHost) {
        this.neo4jHost = neo4jHost;
    }

    public String getNeo4jCredentials() {
        return this.neo4jCredentials;
    }

    public void setNeo4jCredentials(String neo4jCredentials) {
        this.neo4jCredentials = neo4jCredentials;
    }

    public String getNeo4jDatabase() {
        return this.neo4jDatabase;
    }

    public void setNeo4jDatabase(String neo4jDatabase) {
        this.neo4jDatabase = neo4jDatabase;
    }

    /**
     * Return results from a MATCH (...) RETURN COUNT(...)
     *
     * @param session Graph session.
     * @param cypher  The count cypher.
     * @return
     */
    public int graphConditionCount(Session session, String cypher) {
        return session.readTransaction(tx -> tx.run(cypher).single().values().get(0).asInt());
    }

    @Override
    public void execute(Database database) throws CustomChangeException {
        Neo4jGraph graph = new Neo4jGraph(this.getNeo4jHost(), this.getNeo4jCredentials(), this.getNeo4jDatabase());
        Session session = graph.getSession();
        System.out.println("Executing condition cypher query: " + this.getConditionQuery());
        int nodeCount = this.graphConditionCount(session, this.getConditionQuery());
        System.out.printf("Node count before execution %s\n", nodeCount);
        System.out.println("Executing cypher query: " + this.getQuery());

        try {
            while (nodeCount > 0) {
                session.writeTransaction(tx -> tx.run(this.getQuery())).consume();
                nodeCount = this.graphConditionCount(session, this.getConditionQuery());
                System.out.printf("Node count after execution %s\n", nodeCount);
            }
        } catch (Exception e) {
            e.printStackTrace();
            throw new CustomChangeException();
        }
        session.close();
    }

    @Override
    public String getConfirmationMessage() {
        return "Working";
    }

    @Override
    public void setUp() throws SetupException {
        // Any setup steps go here
        // Liquibase calls before execute()
    }

    @Override
    public void setFileOpener(ResourceAccessor resourceAccessor) {
        this.resourceAccessor = resourceAccessor;
    }

    @Override
    public ValidationErrors validate(Database database) {
        return new ValidationErrors();
    }
}
