package edu.ucsd.sbrg.storage;

import static org.junit.Assert.assertNotEquals;
import org.junit.Before;
import org.junit.Ignore;
import org.junit.Test;

import java.io.IOException;

import java.io.ByteArrayOutputStream;
import java.io.File;

public class CloudStorageTest {
    private AzureCloudStorage cloudStorage;
    final String storageName = "";
    final String storageKey = "";
    final String saveDir = "";

    @Before
    public void setUp() {
        this.cloudStorage = new AzureCloudStorage(this.storageName, this.storageKey);
    }

    @Ignore // ignore and run manually, cause need storage keys etc
    @Test
    public void testDownloadToTSVFile() throws IOException {
        String fileName = "jira-LL-3625-add-entity-type-array.zip";
        this.cloudStorage.writeToFile((ByteArrayOutputStream) this.cloudStorage.download(fileName), this.saveDir);
        String filePath = this.saveDir + "/" + fileName.substring(0, fileName.lastIndexOf(".")) + ".tsv";
        File downloaded = new File(filePath);
        assertNotEquals(0, downloaded.length());
        downloaded.delete();
    }
}
