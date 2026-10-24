package app.ultimatiumtube.tv;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * The meeting point between the page's userscript and a phone's browser. The same rules as the
 * Tizen service's phoneSettings.js: the page posts the settings it holds every few seconds and takes
 * back whatever the phone changed; nothing outlives the app, because the settings live in the page.
 */
final class PhoneSettings {
    private static final long FRESH_MS = 15000;
    private static final int KEPT = 300;

    private long seq = 0;
    private final List<JSONObject> changes = new ArrayList<JSONObject>();
    private JSONObject config = null;
    private JSONArray schema = null;
    private long seen = 0;

    private static String kindOf(Object value) {
        if (value instanceof JSONArray) return "array";
        if (value instanceof JSONObject) return "object";
        if (value instanceof Boolean) return "boolean";
        if (value instanceof Number) return "number";
        if (value instanceof String) return "string";
        return "null";
    }

    // A value is taken only in the shape the page already holds.
    private boolean fits(String key, Object value) {
        return config != null && config.has(key) && kindOf(config.opt(key)).equals(kindOf(value));
    }

    private JSONArray pendingAfter(long held) throws JSONException {
        JSONArray out = new JSONArray();
        for (JSONObject change : changes) {
            if (change.getLong("seq") > held) out.put(change);
        }
        return out;
    }

    /** From the page: its settings in, the phone's changes since it last asked out. */
    synchronized String sync(String bodyText, String address) {
        try {
            JSONObject body = new JSONObject(bodyText);
            long held = body.optLong("seq", 0);

            JSONObject sent = body.optJSONObject("config");
            if (sent != null) {
                config = sent;
                // A stale snapshot must not undo what the phone changed since it was taken.
                for (JSONObject change : changes) {
                    if (change.getLong("seq") > held) config.put(change.getString("key"), change.get("value"));
                }
            }

            JSONArray newSchema = body.optJSONArray("schema");
            if (newSchema != null) schema = newSchema;
            seen = System.currentTimeMillis();

            JSONObject answer = new JSONObject();
            answer.put("seq", seq);
            answer.put("changes", pendingAfter(held));
            answer.put("needSchema", schema == null);
            answer.put("address", address);
            return answer.toString();
        } catch (JSONException e) {
            return "{\"seq\":0,\"changes\":[],\"needSchema\":true,\"address\":\"\"}";
        }
    }

    /** For the phone page. */
    synchronized String read(String address) {
        try {
            JSONObject out = new JSONObject();
            out.put("online", System.currentTimeMillis() - seen < FRESH_MS);
            out.put("schema", schema == null ? JSONObject.NULL : schema);
            out.put("config", config == null ? new JSONObject() : config);
            out.put("address", address);
            return out.toString();
        } catch (JSONException e) {
            return "{}";
        }
    }

    /** From the phone page. Returns the number of changes taken, or -1 when the page has not connected yet. */
    synchronized int change(String bodyText) {
        if (config == null) return -1;

        int taken = 0;
        try {
            JSONObject incoming = new JSONObject(bodyText).optJSONObject("changes");
            if (incoming == null) return 0;

            Iterator<String> keys = incoming.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                Object value = incoming.get(key);
                if (!fits(key, value)) continue;

                seq += 1;
                JSONObject change = new JSONObject();
                change.put("seq", seq);
                change.put("key", key);
                change.put("value", value);
                changes.add(change);
                config.put(key, value);
                taken += 1;
            }

            while (changes.size() > KEPT) changes.remove(0);
        } catch (JSONException e) {
            return taken;
        }

        return taken;
    }
}
