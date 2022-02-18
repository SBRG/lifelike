package edu.ucsd.sbrg.extract;

public class FileExtractFactory {
    FileExtract instance;
    FileType factory;

    public FileExtractFactory(FileType factory) {
        this.factory = factory;
    }

    public FileExtract getInstance(String fileName, String fileDir) {
        switch (this.factory) {
            case CSV:
                //
                break;
            case TSV:
                this.instance = new TSVFileExtract(fileName, fileDir, ".tsv");
                break;
        }
        return this.instance;
    }
}
