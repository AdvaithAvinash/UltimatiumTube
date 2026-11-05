package app.ultimatiumtube.tv;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The requests of the Stremio page's Grayjay plugins. A plugin sets headers a web page may not
 * (User-Agent, Cookie, Referer), so the request is made here: the request arrives as JSON
 * ({url, method, headers, body}) and the answer leaves as JSON ({status, url, headers, body}), the
 * same shape the Samsung service gives at /__tube/fetch.
 */
final class PluginFetch {
    private static final int LIMIT = 6 * 1024 * 1024;
    private static final int MOST_REDIRECTS = 5;
    private static final String AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

    private PluginFetch() {}

    private static boolean refused(String name) {
        String n = name.toLowerCase();
        return n.equals("host") || n.equals("content-length") || n.equals("connection")
                || n.equals("transfer-encoding") || n.startsWith("proxy-");
    }

    /** UTF-8, or Windows-1252 when the bytes are not valid UTF-8 (older subtitle files often are). */
    private static String text(byte[] raw) throws Exception {
        String utf8 = new String(raw, "UTF-8");
        return utf8.indexOf('\uFFFD') == -1 ? utf8 : new String(raw, "windows-1252");
    }

    static String run(String request) throws Exception {
        JSONObject ask = new JSONObject(request);
        String url = ask.getString("url");
        if (!url.startsWith("http://") && !url.startsWith("https://")) throw new Exception("only http and https");

        String method = ask.optString("method", "GET").toUpperCase();
        JSONObject headers = ask.optJSONObject("headers");
        String body = ask.isNull("body") ? null : ask.optString("body", null);

        for (int hop = 0; ; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setRequestMethod(method);
            c.setRequestProperty("Accept-Encoding", "identity");

            boolean agent = false;
            if (headers != null) {
                Iterator<String> names = headers.keys();
                while (names.hasNext()) {
                    String name = names.next();
                    if (refused(name)) continue;
                    if (name.equalsIgnoreCase("user-agent")) agent = true;
                    c.setRequestProperty(name, headers.getString(name));
                }
            }
            if (!agent) c.setRequestProperty("User-Agent", AGENT);

            if (body != null && !body.isEmpty() && !method.equals("GET") && !method.equals("HEAD")) {
                c.setDoOutput(true);
                OutputStream out = c.getOutputStream();
                out.write(body.getBytes("UTF-8"));
                out.close();
            }

            int status = c.getResponseCode();
            String location = c.getHeaderField("Location");

            if (status >= 300 && status < 400 && location != null && hop < MOST_REDIRECTS) {
                url = new URL(new URL(url), location).toString();
                if (status != 307 && status != 308) {
                    method = "GET";
                    body = null;
                }
                c.disconnect();
                continue;
            }

            InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            if (in != null) {
                byte[] buffer = new byte[16384];
                int n;
                while ((n = in.read(buffer)) > 0 && bytes.size() < LIMIT) bytes.write(buffer, 0, n);
                in.close();
            }

            JSONObject answerHeaders = new JSONObject();
            for (Map.Entry<String, List<String>> e : c.getHeaderFields().entrySet()) {
                if (e.getKey() == null) continue;
                answerHeaders.put(e.getKey(), new JSONArray(e.getValue()));
            }

            JSONObject answer = new JSONObject();
            answer.put("status", status);
            answer.put("url", url);
            answer.put("headers", answerHeaders);
            answer.put("body", bytes.size() >= LIMIT ? "" : text(bytes.toByteArray()));
            c.disconnect();
            return answer.toString();
        }
    }
}
