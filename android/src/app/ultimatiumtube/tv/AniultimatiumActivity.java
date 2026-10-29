package app.ultimatiumtube.tv;

import android.app.Activity;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Aniultimatium mode: the Aniultimatium web app, bundled in assets/aniultimatium/ exactly as it is
 * in its own repository, in a full-screen WebView. Set up as Aniultimatium's own Android app sets
 * it up; Back goes to the web page first and leaves this screen, back to YouTube, only from its
 * home screen, through AniNative.exit().
 */
public class AniultimatiumActivity extends Activity {
    private static final String START_URL = "file:///android_asset/aniultimatium/index.html";
    private static final String BACK_SCRIPT = "(function(){var e=document.createEvent('Event');"
            + "e.initEvent('tizenhwkey',true,true);e.keyName='back';document.dispatchEvent(e);})()";

    private WebView web;
    private FrameLayout root;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;
    private WebChromeClient chrome;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        setContentView(root);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B0B12"));
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);

        // The page runs from file://, so every site it frames (the ad page, the players) is third
        // party, and the sponsor banner needs its cookie.
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // The page tells an app from a browser by this.
        s.setUserAgentString(s.getUserAgentString() + " AniUltimatiumTV/" + versionName() + " (AndroidTV)");

        web.addJavascriptInterface(new Bridge(), "AniNative");
        web.setWebViewClient(new AniClient());

        chrome = new WebChromeClient() {
            // window.open() and target=_blank from an embedded player: refused.
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture,
                    android.os.Message resultMsg) {
                notifyPopup("popup");
                return false;
            }

            // element.requestFullscreen()
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }

                customView = view;
                customCallback = callback;
                root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
            }

            @Override
            public void onHideCustomView() {
                if (customView == null) return;

                root.removeView(customView);
                customView = null;
                web.setVisibility(View.VISIBLE);

                if (customCallback != null) customCallback.onCustomViewHidden();
                customCallback = null;
                web.requestFocus();
            }

            @Override
            public Bitmap getDefaultVideoPoster() {
                return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.deny();
            }
        };
        web.setWebChromeClient(chrome);

        WebView.setWebContentsDebuggingEnabled(false);
        hideSystemBars();
        web.requestFocus();

        // After a web view crash the next load skips the opening animation (start.js reads
        // nointro=1), so a crash can never repeat in a loop.
        SharedPreferences sp = getSharedPreferences("aniu", MODE_PRIVATE);
        boolean recent = System.currentTimeMillis() - sp.getLong("gone", 0) < 90000;

        if (savedInstanceState != null && !recent) web.restoreState(savedInstanceState);
        else web.loadUrl(recent ? START_URL + "?nointro=1" : START_URL);
    }

    private final class AniClient extends WebViewClient {
        // Main frame only, and only to the bundled app: the top page never leaves it (ad
        // redirects). Pages inside the movie players may navigate freely. API 24 and later call
        // this form; before that nothing is blocked, as in Aniultimatium's own app.
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame()) return false;

            if (request.getUrl().toString().startsWith("file:///android_asset/")) return false;

            notifyPopup("redirect");
            return true;
        }

        // The web view process died (low memory): start again rather than crash. Android 8 and
        // later call this; the class it names is a stand-in at compile time only.
        public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
            getSharedPreferences("aniu", MODE_PRIVATE).edit().putLong("gone", System.currentTimeMillis()).apply();

            if (web != null) {
                root.removeView(web);
                web.destroy();
            }

            web = null;
            recreate();
            return true;
        }
    }

    private String versionName() {
        try {
            PackageInfo p = getPackageManager().getPackageInfo(getPackageName(), 0);
            return p.versionName;
        } catch (Exception e) {
            return "1";
        }
    }

    private void js(final String code) {
        if (web != null) {
            web.post(new Runnable() {
                @Override public void run() {
                    if (web != null) web.evaluateJavascript(code, null);
                }
            });
        }
    }

    private void notifyPopup(String kind) {
        js("window.EA_popup&&window.EA_popup('" + kind + "')");
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    /** Back goes to the page's own handler (it knows about menus, players and tabs); the page calls
     *  AniNative.exit() when there is nothing left to close. */
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (customView != null) {
                if (e.getAction() == KeyEvent.ACTION_UP && web != null) chrome.onHideCustomView();
                return true;
            }

            if (e.getAction() == KeyEvent.ACTION_UP) js(BACK_SCRIPT);
            return true;
        }

        // Game controller: B is Back.
        if (e.getKeyCode() == KeyEvent.KEYCODE_BUTTON_B) {
            if (e.getAction() == KeyEvent.ACTION_UP) js(BACK_SCRIPT);
            return true;
        }

        // Keys WebView does not hand to the page, sent as the codes the page already uses.
        int mapped = mapKey(e.getKeyCode());
        if (mapped != 0) {
            if (e.getAction() == KeyEvent.ACTION_DOWN) js("window.EA_key&&window.EA_key(" + mapped + ")");
            return true;
        }

        return super.dispatchKeyEvent(e);
    }

    /** Android key code to the key code the page knows (Samsung remote codes). 0 lets WebView handle it. */
    private static int mapKey(int k) {
        switch (k) {
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: return 10252;
            case KeyEvent.KEYCODE_MEDIA_PLAY: return 415;
            case KeyEvent.KEYCODE_MEDIA_PAUSE: return 19;
            case KeyEvent.KEYCODE_MEDIA_STOP: return 413;
            case KeyEvent.KEYCODE_MEDIA_REWIND: return 412;
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD: return 417;
            case KeyEvent.KEYCODE_MENU:
            case KeyEvent.KEYCODE_PROG_RED: return 403;
            case KeyEvent.KEYCODE_PROG_GREEN: return 404;
            case KeyEvent.KEYCODE_PROG_YELLOW: return 405;
            case KeyEvent.KEYCODE_PROG_BLUE: return 406;
            case KeyEvent.KEYCODE_INFO: return 457;
            case KeyEvent.KEYCODE_CHANNEL_UP:
            case KeyEvent.KEYCODE_PAGE_UP: return 427;
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
            case KeyEvent.KEYCODE_PAGE_DOWN: return 428;
            case KeyEvent.KEYCODE_BUTTON_A: return 13;
            default: return 0;
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    // Rotation, split screen and display changes are handled here (the manifest lists them), so
    // the page is never reloaded: it just gets resized.
    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        hideSystemBars();
        js("window.dispatchEvent(new Event('resize'))");
    }

    // Low-memory TV boxes: when the system asks apps to trim, the page drops its caches.
    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if (level >= TRIM_MEMORY_RUNNING_LOW) js("window.EA_trim&&window.EA_trim()");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    // Home or another app in front: stop the picture and sound.
    @Override
    protected void onStop() {
        super.onStop();
        js("var v=document.getElementById('video');if(v&&!v.paused)v.pause();");
    }

    @Override
    protected void onResume() {
        super.onResume();

        if (web != null) {
            web.onResume();
            web.requestFocus();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            root.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** What the web app can ask of the app. exit() closes this screen, which returns to YouTube. */
    private final class Bridge {
        @JavascriptInterface
        public String version() {
            return versionName();
        }

        @JavascriptInterface
        public int sdk() {
            return Build.VERSION.SDK_INT;
        }

        @JavascriptInterface
        public void exit() {
            runOnUiThread(new Runnable() {
                @Override public void run() { finish(); }
            });
        }
    }
}
