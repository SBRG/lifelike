package edu.ucsd.sbrg.extract;

import liquibase.Scope;
import liquibase.logging.Logger;

public abstract class FileExtract implements Extract {
    static final Logger logger = Scope.getCurrentScope().getLog(FileExtract.class);

    String fileDir;
    String fileExtension;
    String fileName;
    String filePath;

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getFileName() {
        return this.fileName;
    }

    public void setFileExtension(String fileExtension) {
        this.fileExtension = fileExtension;
    }

    public String getFileExtension() {
        return this.fileExtension;
    }

    public void setFileDir(String fileDir) {
        this.fileDir = fileDir;
    }

    public String getFileDir() {
        return this.fileDir;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getFilePath() {
        return this.filePath;
    }

    public abstract String getDelimiter();
}
