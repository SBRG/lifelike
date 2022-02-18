package edu.ucsd.sbrg.neo4j;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.neo4j.driver.Values.parameters;

import org.junit.Before;
import org.junit.Test;
import org.neo4j.driver.Record;
import org.neo4j.driver.Session;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;

/**
 * Depends on Zenodo literature data being in the graph.
 * See: lifelike-graph/changelogs/changelog-0020.xml
 */
public class ZenodoNeo4jTest {
    private Neo4jGraph graph;
    final String neo4jHost = "bolt://localhost";
    final String neo4jCreds = "neo4j,password";
    final String neo4jDatabase = "neo4j";
    final String saveDir = "";
    final String TSV_DELIMITER = "\t";
    final String CYPHER = "UNWIND $rows AS row\n" +
            "MATCH (s:Snippet)-[r:INDICATES]->(a:Association)\n" +
            "WHERE s.eid = row.snippetId AND\n" +
            "a.eid = row.associationId AND\n" +
            "s.sentence = row.sentence AND\n" +
            "r.entry1_text = row.entityOneText AND\n" +
            "r.entry2_text = row.entityTwoText AND\n" +
            "a.type = row.snippetTheme AND\n" +
            "a.description = row.description AND\n" +
            "a.entry1_type = row.entityOneType AND\n" +
            "a.entry2_type = row.entityTwoType AND\n" +
            "r.raw_score = toFloat(row.rawScore) AND\n" +
            "r.normalized_score = toFloat(row.normalizedScore) AND\n" +
            "r.path = row.path\n" +
            "RETURN s.eid AS snippetId,\n" +
            "a.eid AS associationId,\n" +
            "s.sentence AS sentence,\n" +
            "r.entry1_text AS entityOneText,\n" +
            "r.entry2_text AS entityTwoText,\n" +
            "a.type AS snippetTheme,\n" +
            "a.description AS description,\n" +
            "a.entry1_type AS entityOneType,\n" +
            "a.entry2_type AS entityTwoType,\n" +
            "toString(r.raw_score) AS rawScore,\n" +
            "toString(r.normalized_score) AS normalizedScore,\n" +
            "r.path AS path";
    final int CHUNK_SIZE = 5000;

    /**
     * Execute cypher and validate the results are a 1:1 match.
     *
     * @param session
     * @param cypher Takes as a parameter in case want to use a different cypher.
     * @param content
     */
    private void validate(Session session, String cypher, List<Map<String, String>> content) {
        List<Record> results = session.readTransaction(tx -> tx.run(cypher, parameters("rows", content)).list());
        Map<String, Integer> validate = new HashMap<>();
        content.forEach(param -> {
            String validateValue = param.get("snippetId") + "\t" +
                    param.get("associationId") + "\t" +
                    param.get("sentence") + "\t" +
                    param.get("entityOneText") + "\t" +
                    param.get("entityTwoText") + "\t" +
                    param.get("snippetTheme") + "\t" +
                    param.get("description") + "\t" +
                    param.get("path") + "\t" +
                    param.get("normalizedScore") + "\t" +
                    param.get("rawScore") + "\t" +
                    param.get("entityOneType") + "\t" +
                    param.get("entityTwoType");
            validate.put(validateValue, 0);
        });

        results.forEach(result -> {
            String value = result.get("snippetId").asString() + "\t" +
                    result.get("associationId").asString() + "\t" +
                    result.get("sentence").asString() + "\t" +
                    result.get("entityOneText").asString() + "\t" +
                    result.get("entityTwoText").asString() + "\t" +
                    result.get("snippetTheme").asString() + "\t" +
                    result.get("description").asString() + "\t" +
                    result.get("path").asString() + "\t" +
                    result.get("normalizedScore").asString() + "\t" +
                    result.get("rawScore").asString() + "\t" +
                    result.get("entityOneType").asString() + "\t" +
                    result.get("entityTwoType").asString();
            validate.put(value, validate.get(value) + 1);
        });

        validate.forEach((k,v) -> {
            try {
                assertEquals(1, v.intValue());
            } catch (AssertionError e) {
                String[] error = k.split("\t");
                System.out.printf(
                        "Snippet id: %s, Association id: %s, Entity 1 text: %s, Entity 2 text: %s, Entity 1 type: %s, Entity 2 type: %s, Theme: %s, Description: %s, Path: %s, Normalized score: %s, Raw score: %s, Sentence: %s",
                        error[0], error[1], error[3], error[4], error[10], error[11], error[5], error[6], error[7], error[8], error[9], error[2]);
                throw new AssertionError(e);
            }
        });
    }

    public void validateRelationshipToCorrectEntity(Session session, String query, List<Map<String, String>> content, String entityOneType, String entityTwoType) {
        List<Record> results = session.readTransaction(tx -> tx.run(query, parameters("rows", content)).list());
        results.forEach(result -> {
            try {
                assertEquals(entityOneType, result.get("entityOneType").asString());
                assertEquals(entityTwoType, result.get("entityTwoType").asString());
                assertTrue(result.get("entityOneLabels").asList().stream().anyMatch(l -> l.equals(entityOneType)));
                assertTrue(result.get("entityTwoLabels").asList().stream().anyMatch(l -> l.equals(entityTwoType)));
            } catch (AssertionError e) {
                StringBuilder sb1 = new StringBuilder();
                StringBuilder sb2 = new StringBuilder();

                sb1.append("[");
                result.get("entityOneLabels").asList().forEach(l -> sb1.append(l.toString()).append(", "));
                sb1.append("]");

                sb2.append("[");
                result.get("entityTwoLabels").asList().forEach(l -> sb2.append(l.toString()).append(", "));
                sb2.append("]");
                System.out.printf("Association Id: %s, Entity one type: %s, Entity one labels: %s, Entity two type: %s, Entity two labels: %s",
                        result.get("associationId").toString(), entityOneType, sb1, entityTwoType, sb2);
                throw new AssertionError(e);
            }
        });
    }

    @Before
    public void setUp() {
        this.graph = new Neo4jGraph(this.neo4jHost, this.neo4jCreds, this.neo4jDatabase);
    }

    @Test
    public void testChemicalToDiseaseLiterature() throws IOException {
        String fileName = "jira-LL-3782-Chemical2Disease_assoc_theme.tsv";
        String filePath = this.saveDir + "/" + fileName;
        final String ENTITY_ONE_TYPE = "Chemical";
        final String ENTITY_TWO_TYPE = "Disease";

        if (!Files.exists(Paths.get(filePath))) {
            throw new IOException("File " + fileName + " does not exist!");
        }

        FileInputStream input = new FileInputStream(filePath);
        Scanner sc = new Scanner(input);
        sc.useDelimiter(TSV_DELIMITER);
        String[] header = null;
        Session session = graph.getSession();
        List<Map<String, String>> content = new ArrayList<>();

        while (sc.hasNextLine()) {
            String currentLine = sc.nextLine();
            if (header == null) {
                header = currentLine.split(TSV_DELIMITER, -1);
            } else {
                String[] line = currentLine.split(TSV_DELIMITER, -1);

                String snippetId = line[1];
                String sentence = line[6];
                String entityOneText = line[4];
                String entityTwoText = line[5];
                String snippetTheme = line[8];
                String description = line[11];
                String path = line[7];
                String normalizedScore = line[10];
                String rawScore = line[9];
                String associationId = line[2] + "-" + line[3] + "-" + snippetTheme;

                Map<String, String> block = new HashMap<>();
                block.put("snippetId", snippetId);
                block.put("associationId", associationId);
                block.put("sentence", sentence);
                block.put("entityOneText", entityOneText);
                block.put("entityTwoText", entityTwoText);
                block.put("snippetTheme", snippetTheme);
                block.put("description", description);
                block.put("path", path);
                block.put("normalizedScore", normalizedScore);
                block.put("rawScore", rawScore);
                block.put("entityOneType", ENTITY_ONE_TYPE);
                block.put("entityTwoType", ENTITY_TWO_TYPE);

                if ((content.size() > 0 && (content.size() % (CHUNK_SIZE * 4) == 0))) {
                    validate(session, CYPHER, content);
                    content.clear();
                }
                content.add(block);
            }
        }
        session.close();
    }

    @Test
    public void testChemicalToGeneLiterature() throws IOException {
        String fileName = "jira-LL-3782-Chemical2Gene_assoc_theme.tsv";
        String filePath = this.saveDir + "/" + fileName;
        final String ENTITY_ONE_TYPE = "Chemical";
        final String ENTITY_TWO_TYPE = "Gene";

        if (!Files.exists(Paths.get(filePath))) {
            throw new IOException("File " + fileName + " does not exist!");
        }

        FileInputStream input = new FileInputStream(filePath);
        Scanner sc = new Scanner(input);
        sc.useDelimiter(TSV_DELIMITER);
        String[] header = null;
        Session session = graph.getSession();
        List<Map<String, String>> content = new ArrayList<>();

        while (sc.hasNextLine()) {
            String currentLine = sc.nextLine();
            if (header == null) {
                header = currentLine.split(TSV_DELIMITER, -1);
            } else {
                String[] line = currentLine.split(TSV_DELIMITER, -1);

                String snippetId = line[1];
                String sentence = line[6];
                String entityOneText = line[4];
                String entityTwoText = line[5];
                String snippetTheme = line[8];
                String description = line[11];
                String path = line[7];
                String normalizedScore = line[10];
                String rawScore = line[9];
                String associationId = line[2] + "-" + line[3] + "-" + snippetTheme;

                Map<String, String> block = new HashMap<>();
                block.put("snippetId", snippetId);
                block.put("associationId", associationId);
                block.put("sentence", sentence);
                block.put("entityOneText", entityOneText);
                block.put("entityTwoText", entityTwoText);
                block.put("snippetTheme", snippetTheme);
                block.put("description", description);
                block.put("path", path);
                block.put("normalizedScore", normalizedScore);
                block.put("rawScore", rawScore);
                block.put("entityOneType", ENTITY_ONE_TYPE);
                block.put("entityTwoType", ENTITY_TWO_TYPE);

                if ((content.size() > 0 && (content.size() % (CHUNK_SIZE * 4) == 0))) {
                    validate(session, CYPHER, content);
                    content.clear();
                }
                content.add(block);
            }
        }
        session.close();
    }

    @Test
    public void testGeneToDiseaseLiterature() throws IOException {
        String fileName = "jira-LL-3782-Gene2Disease_assoc_theme.tsv";
        String filePath = this.saveDir + "/" + fileName;
        final String ENTITY_ONE_TYPE = "Gene";
        final String ENTITY_TWO_TYPE = "Disease";

        if (!Files.exists(Paths.get(filePath))) {
            throw new IOException("File " + fileName + " does not exist!");
        }

        FileInputStream input = new FileInputStream(filePath);
        Scanner sc = new Scanner(input);
        sc.useDelimiter(TSV_DELIMITER);
        String[] header = null;
        Session session = graph.getSession();
        List<Map<String, String>> content = new ArrayList<>();

        while (sc.hasNextLine()) {
            String currentLine = sc.nextLine();
            if (header == null) {
                header = currentLine.split(TSV_DELIMITER, -1);
            } else {
                String[] line = currentLine.split(TSV_DELIMITER, -1);

                String snippetId = line[1];
                String sentence = line[6];
                String entityOneText = line[4];
                String entityTwoText = line[5];
                String snippetTheme = line[8];
                String description = line[11];
                String path = line[7];
                String normalizedScore = line[10];
                String rawScore = line[9];
                String associationId = line[2] + "-" + line[3] + "-" + snippetTheme;

                Map<String, String> block = new HashMap<>();
                block.put("snippetId", snippetId);
                block.put("associationId", associationId);
                block.put("sentence", sentence);
                block.put("entityOneText", entityOneText);
                block.put("entityTwoText", entityTwoText);
                block.put("snippetTheme", snippetTheme);
                block.put("description", description);
                block.put("path", path);
                block.put("normalizedScore", normalizedScore);
                block.put("rawScore", rawScore);
                block.put("entityOneType", ENTITY_ONE_TYPE);
                block.put("entityTwoType", ENTITY_TWO_TYPE);

                if ((content.size() > 0 && (content.size() % (CHUNK_SIZE * 4) == 0))) {
                    validate(session, CYPHER, content);
                    content.clear();
                }
                content.add(block);
            }
        }
        session.close();
    }

    @Test
    public void testGeneToGeneLiterature() throws IOException {
        String fileName = "jira-LL-3782-Gene2Gene_assoc_theme.tsv";
        String filePath = this.saveDir + "/" + fileName;
        final String ENTITY_ONE_TYPE = "Gene";
        final String ENTITY_TWO_TYPE = "Gene";

        if (!Files.exists(Paths.get(filePath))) {
            throw new IOException("File " + fileName + " does not exist!");
        }

        FileInputStream input = new FileInputStream(filePath);
        Scanner sc = new Scanner(input);
        sc.useDelimiter(TSV_DELIMITER);
        String[] header = null;
        Session session = graph.getSession();
        List<Map<String, String>> content = new ArrayList<>();

        while (sc.hasNextLine()) {
            String currentLine = sc.nextLine();
            if (header == null) {
                header = currentLine.split(TSV_DELIMITER, -1);
            } else {
                String[] line = currentLine.split(TSV_DELIMITER, -1);

                String snippetId = line[1];
                String sentence = line[6];
                String entityOneText = line[4];
                String entityTwoText = line[5];
                String snippetTheme = line[8];
                String description = line[11];
                String path = line[7];
                String normalizedScore = line[10];
                String rawScore = line[9];
                String associationId = line[2] + "-" + line[3] + "-" + snippetTheme;

                Map<String, String> block = new HashMap<>();
                block.put("snippetId", snippetId);
                block.put("associationId", associationId);
                block.put("sentence", sentence);
                block.put("entityOneText", entityOneText);
                block.put("entityTwoText", entityTwoText);
                block.put("snippetTheme", snippetTheme);
                block.put("description", description);
                block.put("path", path);
                block.put("normalizedScore", normalizedScore);
                block.put("rawScore", rawScore);
                block.put("entityOneType", ENTITY_ONE_TYPE);
                block.put("entityTwoType", ENTITY_TWO_TYPE);

                if ((content.size() > 0 && (content.size() % (CHUNK_SIZE * 4) == 0))) {
                    validate(session, CYPHER, content);
                    content.clear();
                }
                content.add(block);
            }
        }
        session.close();
    }

    @Test
    public void testChemicalToDiseaseCorrectEntityType() throws IOException {
        String fileName = "jira-LL-3782-Chemical2Disease_assoc_theme.tsv";
        String filePath = this.saveDir + "/" + fileName;
        final String ENTITY_ONE_TYPE = "Chemical";
        final String ENTITY_TWO_TYPE = "Disease";

        String query = "UNWIND $rows AS row\n" +
                "MATCH (e1)<-[:MAPPED_TO]-(le1)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(le2)-[:MAPPED_TO]->(e2)\n" +
                "WHERE a.eid = row.associationId\n" +
                "RETURN labels(e1) AS entityOneLabels, labels(e2) AS entityTwoLabels, a.entry1_type AS entityOneType, a.entry2_type AS entityTwoType, a.eid AS associationId";

        if (!Files.exists(Paths.get(filePath))) {
            throw new IOException("File " + fileName + " does not exist!");
        }

        FileInputStream input = new FileInputStream(filePath);
        Scanner sc = new Scanner(input);
        sc.useDelimiter(TSV_DELIMITER);
        String[] header = null;
        Session session = graph.getSession();

        Set<String> ids = new HashSet<>();

        while (sc.hasNextLine()) {
            String currentLine = sc.nextLine();
            if (header == null) {
                header = currentLine.split(TSV_DELIMITER, -1);
            } else {
                String[] line = currentLine.split(TSV_DELIMITER, -1);
                String associationId = line[2] + "-" + line[3] + "-" + line[8];

                if ((ids.size() > 0 && (ids.size() % (CHUNK_SIZE * 4) == 0))) {
                    List<Map<String, String>> content = new ArrayList<>();
                    ids.forEach(id -> {
                        Map<String, String> block = new HashMap<>();
                        block.put("associationId", id);
                        content.add(block);
                    });
                    validateRelationshipToCorrectEntity(session, query, content, ENTITY_ONE_TYPE, ENTITY_TWO_TYPE);
                    ids.clear();
                }
                ids.add(associationId);
            }
        }
        session.close();
    }

    @Test
    public void testChemicalToGeneCorrectEntityType() throws IOException {
        String fileName = "jira-LL-3782-Chemical2Gene_assoc_theme.tsv";
        String filePath = this.saveDir + "/" + fileName;
        final String ENTITY_ONE_TYPE = "Chemical";
        final String ENTITY_TWO_TYPE = "Gene";

        String query = "UNWIND $rows AS row\n" +
                "MATCH (e1)<-[:MAPPED_TO]-(le1)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(le2)-[:MAPPED_TO]->(e2)\n" +
                "WHERE a.eid = row.associationId\n" +
                "RETURN labels(e1) AS entityOneLabels, labels(e2) AS entityTwoLabels, a.entry1_type AS entityOneType, a.entry2_type AS entityTwoType, a.eid AS associationId";

        if (!Files.exists(Paths.get(filePath))) {
            throw new IOException("File " + fileName + " does not exist!");
        }

        FileInputStream input = new FileInputStream(filePath);
        Scanner sc = new Scanner(input);
        sc.useDelimiter(TSV_DELIMITER);
        String[] header = null;
        Session session = graph.getSession();

        Set<String> ids = new HashSet<>();

        while (sc.hasNextLine()) {
            String currentLine = sc.nextLine();
            if (header == null) {
                header = currentLine.split(TSV_DELIMITER, -1);
            } else {
                String[] line = currentLine.split(TSV_DELIMITER, -1);
                String associationId = line[2] + "-" + line[3] + "-" + line[8];

                if ((ids.size() > 0 && (ids.size() % (CHUNK_SIZE * 4) == 0))) {
                    List<Map<String, String>> content = new ArrayList<>();
                    ids.forEach(id -> {
                        Map<String, String> block = new HashMap<>();
                        block.put("associationId", id);
                        content.add(block);
                    });
                    validateRelationshipToCorrectEntity(session, query, content, ENTITY_ONE_TYPE, ENTITY_TWO_TYPE);
                    ids.clear();
                }
                ids.add(associationId);
            }
        }
        session.close();
    }

    @Test
    public void testGeneToDiseaseCorrectEntityType() throws IOException {
        String fileName = "jira-LL-3782-Gene2Disease_assoc_theme.tsv";
        String filePath = this.saveDir + "/" + fileName;
        final String ENTITY_ONE_TYPE = "Gene";
        final String ENTITY_TWO_TYPE = "Disease";

        String query = "UNWIND $rows AS row\n" +
                "MATCH (e1)<-[:MAPPED_TO]-(le1)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(le2)-[:MAPPED_TO]->(e2)\n" +
                "WHERE a.eid = row.associationId\n" +
                "RETURN labels(e1) AS entityOneLabels, labels(e2) AS entityTwoLabels, a.entry1_type AS entityOneType, a.entry2_type AS entityTwoType, a.eid AS associationId";

        if (!Files.exists(Paths.get(filePath))) {
            throw new IOException("File " + fileName + " does not exist!");
        }

        FileInputStream input = new FileInputStream(filePath);
        Scanner sc = new Scanner(input);
        sc.useDelimiter(TSV_DELIMITER);
        String[] header = null;
        Session session = graph.getSession();

        Set<String> ids = new HashSet<>();

        while (sc.hasNextLine()) {
            String currentLine = sc.nextLine();
            if (header == null) {
                header = currentLine.split(TSV_DELIMITER, -1);
            } else {
                String[] line = currentLine.split(TSV_DELIMITER, -1);
                String associationId = line[2] + "-" + line[3] + "-" + line[8];

                if ((ids.size() > 0 && (ids.size() % (CHUNK_SIZE * 4) == 0))) {
                    List<Map<String, String>> content = new ArrayList<>();
                    ids.forEach(id -> {
                        Map<String, String> block = new HashMap<>();
                        block.put("associationId", id);
                        content.add(block);
                    });
                    validateRelationshipToCorrectEntity(session, query, content, ENTITY_ONE_TYPE, ENTITY_TWO_TYPE);
                    ids.clear();
                }
                ids.add(associationId);
            }
        }
        session.close();
    }

    @Test
    public void testGeneToGeneCorrectEntityType() throws IOException {
        String fileName = "jira-LL-3782-Gene2Gene_assoc_theme.tsv";
        String filePath = this.saveDir + "/" + fileName;
        final String ENTITY_ONE_TYPE = "Gene";
        final String ENTITY_TWO_TYPE = "Gene";

        String query = "UNWIND $rows AS row\n" +
                "MATCH (e1)<-[:MAPPED_TO]-(le1)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(le2)-[:MAPPED_TO]->(e2)\n" +
                "WHERE a.eid = row.associationId\n" +
                "RETURN labels(e1) AS entityOneLabels, labels(e2) AS entityTwoLabels, a.entry1_type AS entityOneType, a.entry2_type AS entityTwoType, a.eid AS associationId";

        if (!Files.exists(Paths.get(filePath))) {
            throw new IOException("File " + fileName + " does not exist!");
        }

        FileInputStream input = new FileInputStream(filePath);
        Scanner sc = new Scanner(input);
        sc.useDelimiter(TSV_DELIMITER);
        String[] header = null;
        Session session = graph.getSession();

        Set<String> ids = new HashSet<>();

        while (sc.hasNextLine()) {
            String currentLine = sc.nextLine();
            if (header == null) {
                header = currentLine.split(TSV_DELIMITER, -1);
            } else {
                String[] line = currentLine.split(TSV_DELIMITER, -1);
                String associationId = line[2] + "-" + line[3] + "-" + line[8];

                if ((ids.size() > 0 && (ids.size() % (CHUNK_SIZE * 4) == 0))) {
                    List<Map<String, String>> content = new ArrayList<>();
                    ids.forEach(id -> {
                        Map<String, String> block = new HashMap<>();
                        block.put("associationId", id);
                        content.add(block);
                    });
                    validateRelationshipToCorrectEntity(session, query, content, ENTITY_ONE_TYPE, ENTITY_TWO_TYPE);
                    ids.clear();
                }
                ids.add(associationId);
            }
        }
        session.close();
    }
}
