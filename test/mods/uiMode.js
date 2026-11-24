// Interface modes: UltimatiumTube, SmartTube UI and YT Dummy, each in one press, with your
// own setup kept and put back.

global.window = { location: { origin: 'http://192.168.1.5:8189' }, localStorage: {} };
global.document = { addEventListener: () => undefined };

const { writesFor, KEYS, PRESETS, SMARTTUBE, STOCK, ULTIMATIUMTUBE, MODES } = await import('../../mods/uiMode/index.js');
const { themeCss } = await import('../../mods/theme/index.js');
const { configDefaults } = await import('../../framework/index.js');

const results = [];
const check = (name, ok, detail) => {
    results.push(ok);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  <- ${detail}`}`);
};

const defaults = configDefaults();
const store = Object.assign({}, defaults, { themeWallpaperOn: true, themeAccent: 'pink', enableDeArrow: false, keyGreen: 'bookmark' });
const read = (key) => store[key];
const apply = (writes) => writes.forEach((w) => { store[w.key] = w.value; });

check('three modes are offered', MODES.map((m) => m[0]).join() === [ULTIMATIUMTUBE, SMARTTUBE, STOCK].join());
check('every setting a mode changes is a real setting', KEYS.every((key) => key in defaults), KEYS.filter((key) => !(key in defaults)).join());
check('and every preset value has the shape of that setting', Object.keys(PRESETS).every((mode) => Object.keys(PRESETS[mode])
    .every((key) => Array.isArray(PRESETS[mode][key]) === Array.isArray(defaults[key]) && typeof PRESETS[mode][key] === typeof defaults[key])));

apply(writesFor(STOCK, read, defaults));
check('YouTube as it comes: the mode is set', store.uiMode === STOCK);
check('no wallpaper, no colours of ours, no remote buttons of ours', store.themeWallpaperOn === false
    && store.themeBackground === 'default' && store.keyGreen === 'none');
check('adverts and sponsor segments still go, quietly', store.enableAdBlock === true && store.enableSponsorBlock === true
    && store.enableSponsorBlockToasts === false);
check('your own setup is kept', store.uiModeSaved.themeWallpaperOn === true && store.uiModeSaved.themeAccent === 'pink'
    && store.uiModeSaved.keyGreen === 'bookmark', JSON.stringify(store.uiModeSaved).slice(0, 120));

apply(writesFor(SMARTTUBE, read, defaults));
check('SmartTube UI: dark grey with red', store.uiMode === SMARTTUBE && store.themeBackground === 'graphite' && store.themeAccent === 'red');
check('segments skipped with a note, DeArrow and dislikes on', store.enableSponsorBlockToasts === true && store.enableDeArrow === true
    && store.enableReturnDislike === true);
check('a mode to another mode keeps the setup from UltimatiumTube mode', store.uiModeSaved.themeAccent === 'pink');

apply(writesFor(ULTIMATIUMTUBE, read, defaults));
check('back in UltimatiumTube mode your own setup is back exactly', store.uiMode === ULTIMATIUMTUBE
    && store.themeWallpaperOn === true && store.themeAccent === 'pink' && store.enableDeArrow === false && store.keyGreen === 'bookmark');

const before = JSON.stringify(store);
apply(writesFor(ULTIMATIUMTUBE, read, defaults));
check('choosing UltimatiumTube mode while in it changes nothing', JSON.stringify(store) === before);

check('YouTube\u2019s own screens are never recoloured by a mode (their buttons stay readable)',
    !/zylon-focus/.test(themeCss((key) => (key === 'uiMode' ? 'smarttube' : defaults[key]))));

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
