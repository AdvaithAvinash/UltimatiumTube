package app.ultimatiumtube.tv;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.util.SparseIntArray;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * UltimatiumTube for Android TV: YouTube's own TV interface in a WebView, with the same userscript
 * the Samsung app runs (ad blocking, SponsorBlock and the rest) placed at the very top of the page
 * as it loads, so no proxy, no debugger and no download at launch is involved.
 */
public class MainActivity extends Activity {
    private static final String TAG = "UltimatiumTube";
    private static final String HOME = "https://www.youtube.com/tv";

    // A Samsung TV's own browser, which is what YouTube serves its TV application to and what the
    // userscript has been run against in a browser. Claiming to be Samsung's YouTube engine instead
    // would have the page expect functions that only that engine has.
    private static final String AGENT = "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36 "
            + "(KHTML, like Gecko) 94.0.4606.31/6.5 TV Safari/537.36";

    private static final long RETRY_MS = 5000;

    private static final long LONG_BACK_MS = 1200;

    // Android's keys, as the TV page knows them (the codes Cobalt reports on a Samsung TV).
    private static final SparseIntArray PAGE_KEYS = new SparseIntArray();
    static {
        PAGE_KEYS.put(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, 179);
        PAGE_KEYS.put(KeyEvent.KEYCODE_MEDIA_PLAY, 250);
        PAGE_KEYS.put(KeyEvent.KEYCODE_MEDIA_PAUSE, 19);
        PAGE_KEYS.put(KeyEvent.KEYCODE_MEDIA_STOP, 178);
        PAGE_KEYS.put(KeyEvent.KEYCODE_MEDIA_NEXT, 176);
        PAGE_KEYS.put(KeyEvent.KEYCODE_MEDIA_PREVIOUS, 177);
        PAGE_KEYS.put(KeyEvent.KEYCODE_MEDIA_REWIND, 227);
        PAGE_KEYS.put(KeyEvent.KEYCODE_MEDIA_FAST_FORWARD, 228);
        PAGE_KEYS.put(KeyEvent.KEYCODE_PROG_RED, 403);
        PAGE_KEYS.put(KeyEvent.KEYCODE_PROG_GREEN, 404);
        PAGE_KEYS.put(KeyEvent.KEYCODE_PROG_YELLOW, 405);
        PAGE_KEYS.put(KeyEvent.KEYCODE_PROG_BLUE, 406);
    }

    private WebView web;
    private String userScript = "";
    private final PhoneSettings phoneSettings = new PhoneSettings();
    private PhoneServer phoneServer;
    private long backDownAt = 0;
    private boolean backExited = false;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean trouble = false;
    private final Runnable retry = new Runnable() {
        @Override public void run() { reload(); }
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        userScript = readAsset("userScript.js");

        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(0xFF000000);
        setContentView(web);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(AGENT);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "UltimatiumNative");
        web.setWebViewClient(new TubeClient());
        web.setWebChromeClient(new TubeChrome());
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.requestFocus();

        phoneServer = new PhoneServer(getAssets(), phoneSettings);
        phoneServer.start();

        hideSystemBars();
        web.loadUrl(addressFor(getIntent()));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        // A link sent to a running app opens in it rather than being dropped.
        if (intent != null && intent.getData() != null) web.loadUrl(addressFor(intent));
    }

    /** A YouTube link becomes the same place in the TV application; anything else opens its home. */
    private static String addressFor(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || data.getHost() == null) return HOME;

        String host = data.getHost();
        String video = null;

        if (host.equals("youtu.be") && data.getPathSegments().size() > 0) {
            video = data.getPathSegments().get(0);
        } else if (host.endsWith("youtube.com")) {
            video = data.getQueryParameter("v");
        }

        if (video == null || !video.matches("[A-Za-z0-9_-]{6,20}")) return HOME;
        return HOME + "#/watch?v=" + video;
    }

    private void reload() {
        handler.removeCallbacks(retry);
        trouble = false;
        web.loadUrl(addressFor(getIntent()));
    }

    /** What the viewer sees when YouTube cannot be reached: the reason, and that it is trying again. */
    private void showTrouble(String reason) {
        if (trouble) return;
        trouble = true;

        String safe = reason == null ? "" : reason.replace("&", "&amp;").replace("<", "&lt;");
        String page = "<html><body style=\"margin:0;background:#000;color:#ddd;font-family:sans-serif;"
                + "display:flex;align-items:center;justify-content:center;height:100vh;text-align:center\">"
                + "<div><h1 style=\"font-weight:400\">Can't reach YouTube</h1>"
                + "<p style=\"font-size:22px\">Trying again in a few seconds. Press OK to try now, Back to leave.</p>"
                + "<p style=\"font-size:18px;color:#888\">" + safe + "</p></div></body></html>";

        web.loadDataWithBaseURL("about:blank", page, "text/html", "utf-8", null);
        handler.removeCallbacks(retry);
        handler.postDelayed(retry, RETRY_MS);
    }

    private String readAsset(String name) {
        try {
            InputStream in = getAssets().open(name);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] chunk = new byte[16384];
            int read;
            while ((read = in.read(chunk)) != -1) out.write(chunk, 0, read);
            in.close();
            return out.toString("UTF-8");
        } catch (IOException e) {
            Log.e(TAG, "missing asset " + name, e);
            return "";
        }
    }

    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void press(String type, int code) {
        web.evaluateJavascript("window.__ultimatiumKey&&window.__ultimatiumKey('" + type + "'," + code + ")", null);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        boolean down = event.getAction() == KeyEvent.ACTION_DOWN;

        if (code == KeyEvent.KEYCODE_BACK) {
            long now = SystemClock.uptimeMillis();

            if (down) {
                if (event.getRepeatCount() == 0) {
                    backDownAt = now;
                    backExited = false;
                } else if (!backExited && now - backDownAt > LONG_BACK_MS) {
                    // Holding Back leaves the app, whatever the page is showing.
                    backExited = true;
                    finish();
                }
            } else if (!backExited && !event.isCanceled()) {
                if (trouble) {
                    finish();
                } else {
                    press("keydown", 27);
                    press("keyup", 27);
                }
            }

            return true;
        }

        if (trouble && down && (code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER)) {
            reload();
            return true;
        }

        int mapped = PAGE_KEYS.get(code, -1);
        if (mapped != -1) {
            if (down && event.getRepeatCount() == 0) press("keydown", mapped);
            if (!down) press("keyup", mapped);
            return true;
        }

        return super.dispatchKeyEvent(event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onStop() {
        // Leaving the app stops the picture and the sound, as the stock app does.
        web.evaluateJavascript("Array.prototype.forEach.call(document.querySelectorAll('video'),"
                + "function(v){try{v.pause();}catch(e){}})", null);
        CookieManager.getInstance().flush();
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(retry);
        if (phoneServer != null) phoneServer.stop();
        if (web != null) {
            web.removeJavascriptInterface("UltimatiumNative");
            ((ViewGroup) web.getParent()).removeView(web);
            web.destroy();
        }
        super.onDestroy();
    }

    /** What the page may ask of the app. */
    private final class Bridge {
        @JavascriptInterface
        public void exit() {
            runOnUiThread(new Runnable() {
                @Override public void run() { finish(); }
            });
        }

        @JavascriptInterface
        public String phoneSync(String body) {
            return phoneSettings.sync(body, PhoneServer.address());
        }
    }

    private final class TubeChrome extends WebChromeClient {
        @Override
        public void onPermissionRequest(PermissionRequest request) {
            request.deny();
        }

        // The default poster is a grey play triangle that flashes before the video.
        @Override
        public Bitmap getDefaultVideoPoster() {
            return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
        }
    }

    private static boolean ours(String host) {
        return host != null && (host.equals("youtube.com") || host.endsWith(".youtube.com")
                || host.equals("youtu.be") || host.endsWith(".google.com") || host.equals("google.com")
                || host.endsWith(".gstatic.com") || host.endsWith(".googleapis.com")
                || host.endsWith(".googlevideo.com") || host.endsWith(".ytimg.com"));
    }

    private final class TubeClient extends WebViewClient {
        // Navigation stays on YouTube and Google; a link anywhere else is dropped.
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Uri uri = Uri.parse(url);
            return !"https".equals(uri.getScheme()) || !ours(uri.getHost());
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            String why = String.valueOf(error.getDescription());

            // A load replaced by another is not a failure.
            if (request.isForMainFrame() && !why.contains("ERR_ABORTED")) {
                showTrouble(why + " (" + error.getErrorCode() + ")");
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (request.isForMainFrame() && response.getStatusCode() >= 400) {
                showTrouble("YouTube answered " + response.getStatusCode());
            }
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();

            // The userscript asks its Samsung service a few things; here nothing answers them, and
            // an unanswered request would show up as a failed one.
            if ("www.youtube.com".equals(uri.getHost()) && uri.getPath() != null
                    && uri.getPath().startsWith("/__tube/")) {
                return quiet(uri.getPath());
            }

            boolean tvPage = request.isForMainFrame() && "GET".equals(request.getMethod())
                    && "www.youtube.com".equals(uri.getHost()) && uri.getPath() != null
                    && uri.getPath().startsWith("/tv");

            return tvPage ? pageWithScript(request) : null;
        }
    }

    private WebResourceResponse quiet(String path) {
        String body = path.endsWith("/facts") ? "[]" : "";
        int status = path.endsWith("/facts") ? 200 : 204;

        return new WebResourceResponse("application/json", "utf-8", status, status == 200 ? "OK" : "No Content",
                new HashMap<String, String>(), new ByteArrayInputStream(body.getBytes()));
    }

    private static boolean sameSite(String url) {
        try {
            return "www.youtube.com".equals(new URL(url).getHost());
        } catch (IOException e) {
            return false;
        }
    }

    /**
     * The TV page, fetched here so the script can be put at the top of its head: a script that runs
     * first sees everything the page does. Anything unexpected falls back to a plain load.
     */
    private WebResourceResponse pageWithScript(WebResourceRequest request) {
        try {
            String current = request.getUrl().toString();

            for (int hop = 0; hop < 5; hop++) {
                HttpURLConnection connection = (HttpURLConnection) new URL(current).openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);

                for (Map.Entry<String, String> header : request.getRequestHeaders().entrySet()) {
                    String name = header.getKey();
                    // The connection asks for gzip itself and unpacks it; the others are set below.
                    if (name.equalsIgnoreCase("Accept-Encoding") || name.equalsIgnoreCase("Cookie")
                            || name.equalsIgnoreCase("Host") || name.equalsIgnoreCase("User-Agent")) continue;
                    connection.setRequestProperty(name, header.getValue());
                }

                connection.setRequestProperty("User-Agent", AGENT);
                String cookie = CookieManager.getInstance().getCookie(current);
                if (cookie != null) connection.setRequestProperty("Cookie", cookie);

                int code = connection.getResponseCode();

                // The name arrives in whatever case the server used.
                for (Map.Entry<String, List<String>> field : connection.getHeaderFields().entrySet()) {
                    if (field.getKey() == null || !field.getKey().equalsIgnoreCase("Set-Cookie")) continue;
                    for (String value : field.getValue()) CookieManager.getInstance().setCookie(current, value);
                }

                if (code >= 300 && code < 400) {
                    String location = connection.getHeaderField("Location");
                    if (location == null) return null;

                    current = new URL(new URL(current), location).toString();
                    if (!sameSite(current)) return null;
                    continue;
                }

                String type = connection.getContentType();
                if (type == null || !type.toLowerCase().startsWith("text/html")) return null;

                InputStream in = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
                if (in == null) return null;

                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] chunk = new byte[16384];
                int read;
                while ((read = in.read(chunk)) != -1) out.write(chunk, 0, read);
                in.close();

                String reason = connection.getResponseMessage();
                // No content-security-policy is passed on: it would refuse the script placed in the page.
                return new WebResourceResponse("text/html", "utf-8", code,
                        reason == null || reason.length() == 0 ? "OK" : reason,
                        new HashMap<String, String>(),
                        new ByteArrayInputStream(PageInjector.inject(out.toString("UTF-8"), userScript).getBytes("UTF-8")));
            }
        } catch (IOException e) {
            Log.w(TAG, "plain load, page not fetched here: " + e);
        }

        return null;
    }
}
