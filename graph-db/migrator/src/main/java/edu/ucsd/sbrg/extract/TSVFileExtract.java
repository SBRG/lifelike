package edu.ucsd.sbrg.extract;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;

public class TSVFileExtract extends FileExtract {
    static final String DELIMITER = "\t";

    public TSVFileExtract(String fileName, String fileDir, String fileExtension) {
        this.fileDir = fileDir;
        this.fileExtension = fileExtension;
        this.fileName = fileName;
        this.filePath = fileDir + "/" + fileName.substring(0, fileName.lastIndexOf(".")) + fileExtension;
        System.out.println("Processing file: " + this.filePath);
    }

    @Override
    public String getDelimiter() {
        return DELIMITER;
    }

    /**
     * Return the contents of the extracted file, skipping header.
     *
     * @return Each row is an array, so returns list of string arrays.
     * @throws IOException
     */
    @Override
    public List<String[]> getFileContent() throws IOException {
        return Files.lines(Paths.get(this.getFilePath()))
                // skip header
                .skip(1).map(line -> line.split(DELIMITER)).collect(Collectors.toList());
    }
}
