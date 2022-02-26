package edu.ucsd.sbrg.extract;

import java.io.IOException;
import java.util.List;

public class CSVFileExtract extends FileExtract {
    @Override
    public String getDelimiter() {
        return null;
    }

    /**
     * TODO
     * http://opencsv.sourceforge.net/#where_can_i_get_it
     *
     * OR
     *
     * https://www.univocity.com/pages/univocity_parsers_documentation
     * https://mvnrepository.com/artifact/com.univocity/univocity-parsers
     */
    @Override
    public List<String[]> getFileContent() throws IOException {
        return null;
    }
}
