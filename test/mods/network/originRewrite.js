// Cobalt 20 cannot construct URL, so redirectUrl reads the host itself; these pin what it sends where.

const replaced = [];
const heard = {};
global.window = { location: { origin: 'http://127.0.0.2:8099', protocol: 'http:', replace: (to) => replaced.push(to) }, fetch: null };
global.document = { addEventListener: (type, fn) => { heard[type] = fn; } };
global.XMLHttpRequest = function XMLHttpRequest() {};
global.XMLHttpRequest.prototype.open = () => undefined;
global.HTMLScriptElement = function HTMLScriptElement() {};

const { redirectUrl, start } = await import('../../../mods/network/originRewrite.js');

const results = [];

const check = (name, ok, detail) => {
    results.push(ok);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  <- ${detail}`}`);
};

const is = (name, input, expected) => {
    const got = redirectUrl(input);
    check(name, got === expected, got);
};

const BYPASS = 'http://127.0.0.2:8099/cors-bypass/';

is('a googlevideo media host goes through the service',
    'https://rr2---sn-3u-nf0r.googlevideo.com/videoplayback?id=o-1&itag=558',
    `${BYPASS}https://rr2---sn-3u-nf0r.googlevideo.com/videoplayback?id=o-1&itag=558`);

is('a protocol-relative Google URL goes through as https',
    '//www.gstatic.com/ytlr/fonts/x.ttf', `${BYPASS}https://www.gstatic.com/ytlr/fonts/x.ttf`);

is('a port is kept', 'https://jnn-pa.googleapis.com:443/$rpc/x', `${BYPASS}https://jnn-pa.googleapis.com:443/$rpc/x`);

is('a mixed-case host is still recognised', 'https://RR1.GoogleVideo.com/x', `${BYPASS}https://RR1.GoogleVideo.com/x`);

is('youtube.com comes back to the page\'s own origin',
    'https://www.youtube.com/youtubei/v1/player?key=k#h', 'http://127.0.0.2:8099/youtubei/v1/player?key=k#h');

is('a bare youtube.com host keeps a path', 'https://www.youtube.com', 'http://127.0.0.2:8099/');

is('a relative URL is left alone', '/youtubei/v1/browse', '/youtubei/v1/browse');

is('a host that only ends like Google is left alone', 'https://notgooglevideo.com/x', 'https://notgooglevideo.com/x');

is('another host is left alone', 'https://sponsor.ajay.app/api/skipSegments', 'https://sponsor.ajay.app/api/skipSegments');

is('a blob is left alone', 'blob:1030e72d-c1d2', 'blob:1030e72d-c1d2');

check('nothing stays nothing', redirectUrl(undefined) === undefined && redirectUrl('') === '', 'changed');

// After a sign-in YouTube sends the page to https://www.youtube.com; the policy refuses it, and the
// page is loaded from the service instead.
start();
const refuse = (uri, directive) => heard.securitypolicyviolation({ blockedURI: uri, violatedDirective: directive });
refuse('https://www.youtube.com', "h5vcc-location-src 'self'");
check('a navigation to YouTube the policy refused is loaded from the service', replaced[0] === 'http://127.0.0.2:8099/tv', replaced[0]);
refuse('https://www.youtube.com/tv?x=1', "h5vcc-location-src 'self'");
check('with its path when the engine gives one', replaced[1] === 'http://127.0.0.2:8099/tv?x=1', replaced[1]);
refuse('https://ads.example', "h5vcc-location-src 'self'");
refuse('https://www.youtube.com', 'img-src');
check('anything else refused is left alone', replaced.length === 2, JSON.stringify(replaced));

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
