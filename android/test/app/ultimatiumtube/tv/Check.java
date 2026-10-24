package app.ultimatiumtube.tv;

import android.content.res.AssetManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** The Android app's logic that does not need Android: the page injector, the settings meeting point and its server. */
public class Check {
    static int passed = 0;
    static int total = 0;

    static void check(String label, boolean ok) {
        total += 1;
        if (ok) passed += 1;
        System.out.println((ok ? "PASS  " : "FAIL  ") + label);
    }

    static String[] call(String method, String path, String body, boolean ours) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL("http://127.0.0.1:" + PhoneServer.PORT + path).openConnection();
        c.setRequestMethod(method);
        if (ours) c.setRequestProperty("X-Tube", "1");
        if (body != null) {
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            OutputStream out = c.getOutputStream();
            out.write(body.getBytes("UTF-8"));
            out.close();
        }

        int status = c.getResponseCode();
        InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[4096];
        int read;
        while ((read = in.read(chunk)) != -1) buffer.write(chunk, 0, read);
        return new String[] { String.valueOf(status), buffer.toString("UTF-8") };
    }

    public static void main(String[] args) throws Exception {
        // The injector.
        String page = "<!doctype html><html lang=\"en\"><HEAD data-x=\"1\"><title>t</title></head><body>b</body></html>";
        String out = PageInjector.inject(page, "var a = '</script>';");
        check("the script goes straight after the head tag", out.indexOf("<HEAD data-x=\"1\"><meta name=\"viewport\"") != -1);
        check("the page after it is untouched", out.endsWith("<title>t</title></head><body>b</body></html>"));
        check("a closing script tag inside the script cannot end it early", out.indexOf("var a = '<\\/script>';") != -1
                && out.split("</script>", -1).length == 3);
        check("the prelude comes first", out.indexOf("__ultimatiumKey") < out.indexOf("var a ="));
        check("a page with no head still gets it, in front", PageInjector.inject("<body>x</body>", "s").startsWith("<meta"));

        // The meeting point.
        PhoneSettings s = new PhoneSettings();
        String config = "{\"enableAdBlock\":true,\"blockedKeywords\":[],\"sponsorBlockMinDuration\":0}";
        check("before the page connects a change is refused", s.change("{\"changes\":{\"enableAdBlock\":false}}") == -1);

        JSONObject first = new JSONObject(s.sync("{\"seq\":0,\"config\":" + config + ",\"schema\":[{\"id\":\"g\"}]}", "http://x/settings"));
        check("the first sync has nothing for the page", first.getJSONArray("changes").length() == 0 && first.getLong("seq") == 0);
        check("and needs no schema again", !first.getBoolean("needSchema"));
        check("and gets the address", first.getString("address").equals("http://x/settings"));

        check("two good changes are taken", s.change("{\"changes\":{\"enableAdBlock\":false,\"blockedKeywords\":[\"spoiler\"]}}") == 2);
        check("a wrong shape, an unknown key are dropped and a good one kept",
                s.change("{\"changes\":{\"enableAdBlock\":\"no\",\"nonsense\":1,\"sponsorBlockMinDuration\":5}}") == 1);
        check("a body that is not changes takes nothing", s.change("{\"changes\":[]}") == 0 && s.change("not json") == 0);

        JSONObject second = new JSONObject(s.sync("{\"seq\":0,\"config\":" + config + "}", "a"));
        check("the page is given every change it has not seen", second.getJSONArray("changes").length() == 3);
        check("with the seq to remember", second.getLong("seq") == 3);

        JSONObject view = new JSONObject(s.read("a"));
        check("a stale snapshot does not undo them in the phone's view",
                !view.getJSONObject("config").getBoolean("enableAdBlock")
                        && view.getJSONObject("config").getJSONArray("blockedKeywords").getString(0).equals("spoiler"));
        check("the phone sees the page online", view.getBoolean("online") && view.getJSONArray("schema").length() == 1);

        check("a page that is up to date gets nothing",
                new JSONObject(s.sync("{\"seq\":3,\"config\":" + config + "}", "a")).getJSONArray("changes").length() == 0);
        check("garbage from the page is answered, not thrown", s.sync("garbage", "a").indexOf("changes") != -1);

        // The server, with the same meeting point behind it.
        AssetManager.page = "<!DOCTYPE html><html>phone</html>".getBytes("UTF-8");
        PhoneSettings live = new PhoneSettings();
        PhoneServer server = new PhoneServer(new AssetManager(), live);
        server.start();
        Thread.sleep(500);

        String[] r = call("GET", "/settings", null, false);
        check("the page is served", r[0].equals("200") && r[1].equals("<!DOCTYPE html><html>phone</html>"));
        r = call("GET", "/api/settings", null, false);
        check("before the page connects it is offline", new JSONObject(r[1]).getBoolean("online") == false);
        r = call("POST", "/api/settings", "{\"changes\":{\"enableAdBlock\":false}}", true);
        check("a change is refused until the page has connected", r[0].equals("409"));

        live.sync("{\"seq\":0,\"config\":" + config + ",\"schema\":[]}", "a");
        r = call("POST", "/api/settings", "{\"changes\":{\"enableAdBlock\":false}}", false);
        check("a post without the x-tube header is refused", r[0].equals("403"));
        r = call("POST", "/api/settings", "{\"changes\":{\"enableAdBlock\":false}}", true);
        check("with it, taken", r[0].equals("200") && new JSONObject(r[1]).getInt("taken") == 1);
        r = call("GET", "/api/settings", null, false);
        check("and seen", new JSONObject(r[1]).getJSONObject("config").getBoolean("enableAdBlock") == false);
        r = call("GET", "/nothing", null, false);
        check("anything else is not found", r[0].equals("404"));

        server.stop();
        System.out.println("\n" + passed + "/" + total + " checks passed.");
        System.exit(passed == total ? 0 : 1);
    }
}
