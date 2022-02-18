package edu.ucsd.sbrg.storage;

import com.azure.core.util.Context;
import com.azure.storage.file.share.ShareDirectoryClient;
import com.azure.storage.file.share.ShareFileClient;
import com.azure.storage.file.share.ShareFileClientBuilder;
import com.azure.storage.file.share.models.ShareFileRange;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipInputStream;

public class AzureCloudStorage extends CloudStorage {
    ShareDirectoryClient storageClient;
    static final String CLOUD_SHARE_NAME = "knowledge-graph";
    static final String CLOUD_FILE_DIR = "migration";

    public AzureCloudStorage(String storageAccountName, String storageAccountKey) {
        this.connectionString = "DefaultEndpointsProtocol=https;" +
                "AccountName=" + storageAccountName + ";" +
                "AccountKey=" + storageAccountKey;
    }

    private ShareDirectoryClient initStorageClient() {
        this.storageClient = new ShareFileClientBuilder().connectionString(this.connectionString)
                .shareName(CLOUD_SHARE_NAME).resourcePath(CLOUD_FILE_DIR).buildDirectoryClient();
        return this.storageClient;
    }

    public boolean fileExists(String filename) {
        return this.initStorageClient().getFileClient(filename).exists();
    }

    /**
     * Download the entire file blob from the cloud storage.
     *
     * @param fileName file to download.
     * @return
     * @throws IOException
     */
    @Override
    public OutputStream download(String fileName) throws IOException {
        ShareFileClient fileClient = this.initStorageClient().getFileClient(fileName);
        OutputStream out = new ByteArrayOutputStream();
        fileClient.download(out);
        return out;
    }

    /**
     * Download the file from the cloud storage in chunks.
     *
     * @param fileName file to download.
     * @param saveDir  local folder to save file to.
     * @throws IOException
     */
    @Override
    public void downloadToFile(String fileName, String saveDir) throws IOException {
        ShareFileClient fileClient = this.initStorageClient().getFileClient(fileName);

        // chunk download
        int chunkSize = 1024 * 1024 * 100; // 100MB
        long totalFileSize = fileClient.getProperties().getContentLength();
        long remainingChunks = totalFileSize;
        long startPosition = 0;
        String localZip = saveDir + "/" + fileName;
        new File(localZip).createNewFile();

        do {
            ByteArrayOutputStream bao = new ByteArrayOutputStream();
            fileClient.downloadWithResponse(bao, new ShareFileRange(startPosition, startPosition + chunkSize),
                    false, Duration.ofSeconds(60), Context.NONE);

            try (FileOutputStream out = new FileOutputStream(localZip, true)) {
                FileChannel ch = out.getChannel();
                ch.write(ByteBuffer.wrap(bao.toByteArray()));
            }
            bao.close();
            startPosition += chunkSize + 1;
            remainingChunks -= chunkSize;
            System.out.printf("Downloaded %s / %s total file size\n", totalFileSize - remainingChunks, totalFileSize);
        } while (remainingChunks > 0);

        this.unzipFile(saveDir + "/" + fileName, saveDir);
    }

    /**
     * Read the byte stream into a zip stream and unzip the file.
     *
     * @param bao          the zip file in bytes.
     * @param localSaveDir local directory to save file to.
     * @throws IOException
     */
    @Override
    public void writeToFile(ByteArrayOutputStream bao, String localSaveDir) throws IOException {
        ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bao.toByteArray()));

        FileOutputStream out;
        byte[] buffer = new byte[1024];
        int read;
        ZipEntry entry;

        while ((entry = zip.getNextEntry()) != null) {
            String filePath = localSaveDir + "/" + entry.getName();
            out = new FileOutputStream(filePath);
            while ((read = zip.read(buffer, 0, buffer.length)) != -1) {
                out.write(buffer, 0, read);
            }
            zip.closeEntry();
            out.close();
        }
        zip.close();
    }

    private List<String> unzipFile(String path, String localSaveDir) throws IOException {
        FileOutputStream out;
        byte[] buffer = new byte[1024];
        ZipEntry entry;
        List<String> unzipped = new ArrayList<>();
        int read;

        System.out.println("Unzipping file: " + path);
        ZipFile zip = new ZipFile(path);
        Enumeration<? extends ZipEntry> entries = zip.entries();

        while (entries.hasMoreElements()) {
            entry = entries.nextElement();
            String filePath = localSaveDir + "/" + entry.getName();
            out = new FileOutputStream(filePath);
            InputStream is = zip.getInputStream(entry);
            while ((read = is.read(buffer, 0, buffer.length)) != -1) {
                out.write(buffer, 0, read);
            }
            is.close();
            out.close();
            unzipped.add(filePath);
            System.out.println("Unzipped: " + filePath);
        }
        zip.close();

        new File(path).delete();
        System.out.println("Deleted zip file: " + path);

        return unzipped;
    }
}
