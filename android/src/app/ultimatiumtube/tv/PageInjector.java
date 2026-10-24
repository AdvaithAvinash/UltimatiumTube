package app.ultimatiumtube.tv;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Puts the userscript at the top of the TV page's head, where it runs before anything else does. */
final class PageInjector {
    private static final Pattern HEAD = Pattern.compile("<head[^>]*>", Pattern.CASE_INSENSITIVE);

    // Everything that happens before the userscript: the page is told it is not behind our proxy,
    // and a way for the app to press keys the way a TV remote does.
    static final String PRELUDE = "(function(){"
            + "window.__TUBE_NATIVE_PROXY_PATCHES__=false;"
            + "window.__ultimatiumKey=function(type,code){"
            + "var e=document.createEvent('Event');e.initEvent(type,true,true);"
            + "e.keyCode=code;e.which=code;e.charCode=0;"
            + "(document.activeElement||document.body||document).dispatchEvent(e);};"
            + "if(window.UltimatiumNative){window.close=function(){window.UltimatiumNative.exit();};}"
            + "})();";

    private PageInjector() { }

    static String inject(String html, String userScript) {
        // A script that contained the closing tag would end its own element early.
        String script = "<meta name=\"viewport\" content=\"width=1920\">"
                + "<script>" + PRELUDE + "</script>"
                + "<script>" + userScript.replace("</script", "<\\/script") + "</script>";

        Matcher head = HEAD.matcher(html);
        if (head.find()) return html.substring(0, head.end()) + script + html.substring(head.end());

        return script + html;
    }
}
