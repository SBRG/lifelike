package edu.ucsd.sbrg.storage;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

public abstract class CloudStorage implements Storage {
    String connectionString;

    public abstract void writeToFile(ByteArrayOutputStream bao, String localSaveDir) throws IOException;
}
