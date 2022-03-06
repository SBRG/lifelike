package edu.ucsd.sbrg.storage;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import liquibase.Scope;
import liquibase.logging.Logger;

public abstract class CloudStorage implements Storage {
    static final Logger logger = Scope.getCurrentScope().getLog(CloudStorage.class);
    String connectionString;

    public abstract void writeToFile(ByteArrayOutputStream bao, String localSaveDir) throws IOException;
}
