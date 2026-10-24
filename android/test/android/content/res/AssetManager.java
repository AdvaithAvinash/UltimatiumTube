package android.content.res;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;

/** Stands in for Android's, so the server can be exercised on a plain JVM. */
public class AssetManager {
    public static byte[] page = new byte[0];

    public InputStream open(String name) throws IOException {
        return new ByteArrayInputStream(page);
    }
}
