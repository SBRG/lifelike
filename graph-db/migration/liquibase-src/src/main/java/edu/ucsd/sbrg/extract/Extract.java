package edu.ucsd.sbrg.extract;

import java.io.IOException;
import java.util.List;

public interface Extract {
    public List<String[]> getFileContent() throws IOException;
}
