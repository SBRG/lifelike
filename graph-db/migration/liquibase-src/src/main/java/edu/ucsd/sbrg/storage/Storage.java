package edu.ucsd.sbrg.storage;

import java.io.IOException;
import java.io.OutputStream;

public interface Storage {
    public OutputStream download(String fileName) throws IOException;

    public void downloadToFile(String fileName, String saveDir) throws IOException;
}
