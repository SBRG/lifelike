package edu.ucsd.sbrg;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Scanner;

import edu.ucsd.sbrg.extract.FileExtract;
import edu.ucsd.sbrg.extract.FileExtractFactory;
import edu.ucsd.sbrg.extract.FileType;
import edu.ucsd.sbrg.neo4j.Neo4jGraph;
import edu.ucsd.sbrg.storage.AzureCloudStorage;
import liquibase.Scope;
import liquibase.change.custom.CustomTaskChange;
import liquibase.database.Database;
import liquibase.exception.CustomChangeException;
import liquibase.exception.SetupException;
import liquibase.exception.ValidationErrors;
import liquibase.logging.Logger;
import liquibase.resource.ResourceAccessor;

/**
 * <changeSet id="..." author="...">
 * <comment>...</comment>
 * <customChange
 * class="edu.ucsd.sbrg.liquibase.FileQueryHandler"
 * query="..."
 * fileName="<filename>.zip"
 * startAt="1"
 * fileType="TSV"
 * neo4jHost="${neo4jHost}"
 * neo4jCredentials="${neo4jCredentials}" -> these ${} are parameters set in
 * liquibase.properties
 * neo4jDatabase="${neo4jDatabase}"
 * azureStorageName="${azureStorageName}"
 * azureStorageKey="${azureStorageKey}"
 * localSaveFileDir="${localSaveFileDir}"/>
 * </changeSet>
 *
 * query: the cypher query to be executed.
 * fileName: the data file (ZIP) on Azure to download and use.
 * startAt: the starting index (default should be 1 to skip header line) for the
 * data processing.
 * headers are not included, so first data line is zero.
 * fileType: the type of file within the zip (e.g CSV, TSV, etc...).
 */
public class FileQueryHandler implements CustomTaskChange {
    static final Logger logger = Scope.getCurrentScope().getLog(FileQueryHandler.class);

    private String query;
    private String fileName;
    private String fileType;
    private int startAt;
    private String neo4jHost;
    private String neo4jCredentials;
    private String neo4jDatabase;
    private String azureStorageName;
    private String azureStorageKey;
    private String localSaveFileDir;
    private ResourceAccessor resourceAccessor;

    public FileQueryHandler() {

    }

    public String getQuery() {
        return this.query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getFileName() {
        return this.fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getFileType() {
        return this.fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public int getStartAt() {
        return this.startAt;
    }

    public void setStartAt(String startAt) {
        this.startAt = Integer.parseInt(startAt);
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

    public String getAzureStorageName() {
        return this.azureStorageName;
    }

    public void setAzureStorageName(String azureStorageName) {
        this.azureStorageName = azureStorageName;
    }

    public String getAzureStorageKey() {
        return this.azureStorageKey;
    }

    public void setAzureStorageKey(String azureStorageKey) {
        this.azureStorageKey = azureStorageKey;
    }

    public String getLocalSaveFileDir() {
        return this.localSaveFileDir;
    }

    public void setLocalSaveFileDir(String localSaveFileDir) {
        this.localSaveFileDir = localSaveFileDir;
    }

    @Override
    public void execute(Database database) throws CustomChangeException {
        logger.info("Executing FileQueryHandler for: " + this.getFileName());

        AzureCloudStorage cloudStorage = new AzureCloudStorage(this.getAzureStorageName(), this.getAzureStorageKey());
        FileExtract fileExtract = new FileExtractFactory(
                FileType.valueOf(this.getFileType())).getInstance(this.getFileName(), this.getLocalSaveFileDir());

        if (!Files.exists(Paths.get(fileExtract.getFilePath()))) {
            // we need to check for prefix because sometimes
            // the data is different from different environments
            // and we need to consider that, e.g drop specific nodes
            String prefix = System.getenv("DATAFILES_PREFIX"); // prod or stage
            if (prefix != null && prefix.length() > 0) {
                String prefixName = prefix + "-" + fileExtract.getFileName();
                if (cloudStorage.fileExists(prefixName)) {
                    fileExtract.setFileName(prefixName);
                    String newPath = fileExtract.getFileDir() + "/"
                            + prefixName.substring(0, prefixName.lastIndexOf(".")) + fileExtract.getFileExtension();
                    fileExtract.setFilePath(newPath);
                }
            }
            logger.info("Downloading file " + fileExtract.getFileName() + " from Azure Cloud.");
            try {
                cloudStorage.downloadToFile(fileExtract.getFileName(), fileExtract.getFileDir());
            } catch (IOException e) {
                logger.severe(e.toString());
            }
        }

        Neo4jGraph graph = new Neo4jGraph(this.getNeo4jHost(), this.getNeo4jCredentials(), this.getNeo4jDatabase());

        final int chunkSize = System.getenv("CHUNK_SIZE") != null
                ? Integer.parseInt(System.getenv("CHUNK_SIZE"))
                : 2000;
        int processed = 0, skippedCount = 0;
        String[] header = null;
        List<String[]> content = new ArrayList<>();

        logger.info("Processing file: " + fileExtract.getFilePath());

        try (FileInputStream input = new FileInputStream(fileExtract.getFilePath())) {
            try (Scanner sc = new Scanner(input).useDelimiter(fileExtract.getDelimiter())) {
                try {
                    while (sc.hasNextLine()) {
                        String[] currentRow = sc.nextLine().split(fileExtract.getDelimiter(), -1);

                        if (header == null) {
                            header = currentRow;
                            skippedCount++;
                            continue;
                        } else if (skippedCount < this.getStartAt()) {
                            skippedCount++;
                            continue;
                        } else if (content.size() == 0 || (content.size() % chunkSize) != 0) {
                            content.add(currentRow);
                            continue;
                        }

                        // logger.fine(String.format(processed + " \t " +
                        // Runtime.getRuntime().freeMemory() +
                        // " \t \t " + Runtime.getRuntime().totalMemory() +
                        // " \t \t " + Runtime.getRuntime().maxMemory()));

                        logger.info("Executing next chunk from " + this.fileName + ". Processed: " + processed);
                        try {
                            graph.execute(this.getQuery(), content, header, chunkSize);
                        } catch (CustomChangeException ce) {
                            ce.printStackTrace();
                            String lastProcessedLine = Arrays.toString(content.get(content.size() - 1));
                            String output = "Encountered error! Set startAt to line " +
                                    (processed + 1) + " (last value processed in file: " + lastProcessedLine +
                                    ") to pick up where left off.";
                            logger.severe(output);
                            throw new CustomChangeException();
                        } finally {
                            processed += content.size();
                            content.clear();
                        }

                    }
                } finally {
                    sc.close();
                }
            }
            input.close();
        } catch (IOException e) {
            logger.severe(e.toString());
        }

        logger.info("Deleting file: " + fileExtract.getFilePath());
        new File(fileExtract.getFilePath()).delete();

        // wrap up any leftovers in content
        // since file could be smaller than chunkSize * 4
        if (content.size() > 0) {
            try {
                logger.info("Executing remaining query chunk");
                graph.execute(this.getQuery(), content, header, chunkSize);
                processed += content.size();
                content.clear();
            } catch (CustomChangeException ce) {
                ce.printStackTrace();
                String lastProcessedLine = Arrays.toString(content.get(content.size() - 1));
                String output = "Encountered error! Set startAt to line " +
                        (processed + 1) + " (last value processed in file: " + lastProcessedLine +
                        ") to pick up where left off.";
                logger.severe(output);
                throw new CustomChangeException();
            }
        }

        graph.getDriver().close();
        graph = null;
        logger.info("Finished processing");
    }

    @Override
    public String getConfirmationMessage() {
        return "Changelog executed successfully" + this.getFileName();
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
