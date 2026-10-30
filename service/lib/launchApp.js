'use strict';

// Starts another app installed on this TV. The YouTube engine this app runs in cannot show every
// web page (Aniultimatium's styles need more than it has), but the TV's own web engine can, and
// Aniultimatium's own app runs in that. The page here has no Tizen to call, so it asks the service.

const POST = '/__tube/launch';

// Tizen app ids: ten letters and digits, a dot, a name.
const APP_ID = /^[A-Za-z0-9]{10}\.[A-Za-z0-9_-]+$/;

const ANSWER_WITHIN = 5000;

const attach = (app) => app.post(POST, (req, res) => {
    // A page on another site can send a form post but not a custom header.
    if (!req.get('x-tube')) return res.status(403).json({ ok: false, reason: 'missing x-tube header' });

    const id = String(req.query.app || '');
    if (!APP_ID.test(id)) return res.status(400).json({ ok: false, reason: 'not an app id' });

    if (typeof tizen === 'undefined') return res.json({ ok: false, reason: 'not a television' });

    const answered = { done: false };
    const answer = (body) => {
        if (answered.done) return;
        answered.done = true;
        res.json(body);
    };

    // getAppInfo throws for an app that is not installed.
    try {
        tizen.application.getAppInfo(id);
    } catch (error) {
        return answer({ ok: false, reason: 'not installed' });
    }

    setTimeout(() => answer({ ok: false, reason: 'no answer' }), ANSWER_WITHIN);

    try {
        tizen.application.launch(id, () => answer({ ok: true }), (error) => answer({ ok: false, reason: String(error && error.message) }));
    } catch (error) {
        answer({ ok: false, reason: String(error && error.message) });
    }

    return undefined;
});

module.exports = { attach, APP_ID };
