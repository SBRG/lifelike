package edu.ucsd.sbrg.storage;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;

public class GoogleCloudStorage extends CloudStorage {
    @Override
    public OutputStream download(String fileName) {
        return null;
    }

    @Override
    public void downloadToFile(String fileName, String saveDir) throws IOException {
        //
    }

    @Override
    public void writeToFile(ByteArrayOutputStream bao, String localSaveDir) throws IOException {
        //
    }
}
