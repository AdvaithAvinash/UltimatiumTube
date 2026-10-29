package android.webkit;

/**
 * Compile-time stand-in. The app is built against an older Android than the one that added this
 * class; on a TV that has it, the real one is used and this file is not in the app.
 */
public abstract class RenderProcessGoneDetail {
    public abstract boolean didCrash();

    public abstract int rendererPriorityAtExit();
}
