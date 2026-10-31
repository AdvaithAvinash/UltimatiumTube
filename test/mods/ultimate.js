// UltimatiumTube Ultimate Settings: the way in, its three sections, the theme, speed to 15x.

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
import { check, withConfig, finish } from '../harness.js';

global.document = {
    querySelector: () => null, querySelectorAll: () => [], addEventListener: () => undefined,
    getElementById: () => null, createElement: () => ({}), head: null, documentElement: null
};

const shown = [];
global.window._yttv = { router: { instance: { resolveCommand: (command) => shown.push(command) } } };

const { configRead, configDefaults, configWrite } = await import('../../framework/runtime/config.js');
const { GROUPS, at } = await import('../../mods/settings/settingsModel.js');
const { sectionFor } = await import('../../mods/settings/settingRows.js');
const { openOptions } = await import('../../mods/settings/settingsOptions.js');
const { phoneSchema } = await import('../../mods/settings/phoneSchema.js');
const { themeCss, wallpaperOf, backdropOf, wallpaperOffNow, WALLPAPER_FILES, WALLPAPERS, start: startTheme } = await import('../../mods/theme/index.js');
const { speedLadder } = await import('../../mods/player/speed.js');
const { apiBase } = await import('../../mods/sponsorblock/segmentApi.js');
const { styled } = await import('../../mods/settings/settingComponents.js');

const modalOf = (command) => command.openPopupAction.popup.overlaySectionRenderer.overlay.overlayTwoPanelRenderer
    .actionPanel.overlayPanelRenderer;

const open = (path, index, update) => {
    shown.length = 0;
    openOptions({ path, index: index || 0, update: !!update });
    return modalOf(shown[0]);
};

const itemsOf = (modal) => modal.content.overlayPanelItemListRenderer.items.map((item) => item.compactLinkRenderer);

const titleOf = (link) => link.title.simpleText;

const indexOfGroup = (id) => GROUPS.findIndex((group) => group.id === id);
const indexOf_ = () => indexOfGroup('tube_customization');

const rowsOf = () => sectionFor().settingCategoryCollectionRenderer.items;

const rendererOf = (row) => row[Object.keys(row)[0]];

const commandsOf = (link) => link.serviceEndpoint.commandExecutorCommand.commands;

// --- the way in

check('the first row of the category is the Ultimate Settings, in the Ultimate style', () => {
    const first = rendererOf(rowsOf()[0]);

    assert.strictEqual(first.title.runs[0].text, 'UltimatiumTube Ultimate Settings');
    assert.strictEqual(first.tubeStyle, 'ultimate');
    assert.strictEqual(first.serviceEndpoint.customAction.parameters.path[0], 'ultimate');
});

check('it opens a list of the three sections', () => {
    const modal = open(['ultimate']);
    assert.deepStrictEqual(itemsOf(modal).map(titleOf), ['Customization', 'Ultimate Dev Options', 'AniUltimatium']);
    assert.strictEqual(modal.header.overlayPanelHeaderRenderer.title.simpleText, 'UltimatiumTube Ultimate Settings');
});

check('the sections are not also listed among the ordinary rows', () => {
    const titles = rowsOf().map((row) => rendererOf(row).title.runs[0].text);
    assert.ok(titles.indexOf('Wallpaper') === -1 && titles.indexOf('Reset everything') === -1);
});

check('each section button opens that section', () => {
    const buttons = itemsOf(open(['ultimate']));
    const path = commandsOf(buttons[0])[0].customAction.parameters.path;

    assert.strictEqual(GROUPS[path[0]].id, 'tube_customization');
});

// --- the blue glow, put on the row YouTube draws

check('a row marked ultimate gets the class on its outermost element, keeping the ones it had', () => {
    const tree = { type: 'div', props: { className: 'row focus' }, children: [] };
    styled(tree, 'ultimate');
    assert.strictEqual(tree.props.className, 'row focus tube-ultimate');
});

check('a row with no props still gets it', () => {
    const tree = { type: 'div', children: [] };
    styled(tree, 'ultimate');
    assert.strictEqual(tree.props.className, 'tube-ultimate');
});

check('and only once', () => {
    const tree = { type: 'div', props: { className: 'a' }, children: [] };
    styled(tree, 'ultimate');
    styled(tree, 'ultimate');
    assert.strictEqual(tree.props.className, 'a tube-ultimate');
});

check('a row with no style, or a tree that is not one, is left alone', () => {
    const tree = { type: 'div', props: { className: 'a' }, children: [] };
    styled(tree, undefined);
    styled(null, 'ultimate');
    styled('text', 'ultimate');
    assert.strictEqual(tree.props.className, 'a');
});

// --- Customization

check('Customization offers a wallpaper switch, its picture, your own, dimming, colours and font', () => {
    const titles = itemsOf(open([indexOfGroup('tube_customization')])).map(titleOf);

    ['Wallpaper', 'Turn the wallpaper off now', 'Wallpaper picture', 'Your own wallpaper', 'Wallpaper dimming', 'Background colour', 'Accent colour', 'Font']
        .forEach((name) => assert.ok(titles.indexOf(name) !== -1, `${name} is missing from ${titles.join(', ')}`));
});

check('"Turn the wallpaper off now" is a button that does it, and needs nothing else to work', () => {
    const index = indexOf_();
    const links = itemsOf(open([index]));
    const off = links.find((link) => titleOf(link) === 'Turn the wallpaper off now');

    assert.ok(off, 'the button is missing');
    assert.strictEqual(commandsOf(off).length, 1);
    assert.strictEqual(commandsOf(off)[0].customAction.action, 'WALLPAPER_OFF');
});

check('the wallpaper is a switch of its own, the first of Customization, and off', () => {
    const index = indexOfGroup('tube_customization');
    const [first] = itemsOf(open([index]));

    assert.strictEqual(titleOf(first), 'Wallpaper');
    assert.strictEqual(first.secondaryIcon.iconType, 'CHECK_BOX_OUTLINE_BLANK');
    assert.strictEqual(commandsOf(first)[0].setClientSettingEndpoint.settingDatas[0].boolValue, true);
});

check('turning it on and off again is one press each, and the switch shows which it is', () => {
    const index = indexOfGroup('tube_customization');

    withConfig({ themeWallpaperOn: true }, () => {
        const [first] = itemsOf(open([index]));

        assert.strictEqual(first.secondaryIcon.iconType, 'CHECK_BOX');
        assert.strictEqual(commandsOf(first)[0].setClientSettingEndpoint.settingDatas[0].boolValue, false);
    });
});

check('the wallpaper picture list holds the built-in ones and "your own picture", and no "None"', () => {
    const index = indexOfGroup('tube_customization');
    const picture = GROUPS[index].items.findIndex((item) => item.key === 'themeWallpaper');
    const labels = itemsOf(open([index, picture])).map(titleOf);

    assert.strictEqual(labels[0], 'Blue flames');
    assert.ok(labels.indexOf('None') === -1, 'the list still has None: that is the switch now');

    assert.ok(labels.indexOf('Aurora') !== -1);
    assert.ok(labels.some((label) => label.indexOf('Your own picture') === 0));
});

// --- the theme

const reading = (settings) => (key) => (key in settings ? settings[key] : configDefaults()[key]);

check('the stylesheet of the stock look holds the glow of the Ultimate rows, and nothing else', () => {
    const css = themeCss(reading({}));

    assert.ok(css.indexOf('.tube-ultimate') !== -1);
    assert.ok(css.indexOf('background') === -1 && css.indexOf('font-family') === -1, css);
});

check('the wallpaper is never in the stylesheet, which a TV may not read again once it changes', () => {
    const css = themeCss(reading({ themeWallpaperOn: true, themeWallpaper: 'flames', themeBackground: 'navy' }));

    assert.ok(css.indexOf('url(') === -1 && css.indexOf('gradient') === -1 && css.indexOf('#0a1128') === -1, css);
});

check('the Ultimate rows are blue, and glow', () => {
    const css = themeCss(reading({}));

    assert.ok(css.indexOf('color: #3ea6ff !important') !== -1);
    assert.ok(css.indexOf('@keyframes tubeGlow') !== -1 && css.indexOf('text-shadow') !== -1);
});

check('another accent recolours them', () => {
    assert.ok(themeCss(reading({ themeAccent: 'pink' })).indexOf('color: #f472b6 !important') !== -1);
});

check('a font is applied, an unknown one is not', () => {
    assert.ok(themeCss(reading({ themeFont: 'serif' })).indexOf('font-family: Georgia') !== -1);
    assert.ok(themeCss(reading({ themeFont: 'nonsense' })).indexOf('font-family') === -1);
});

check('custom rules come last, so they win', () => {
    const css = themeCss(reading({ themeAccent: 'red', customCss: 'body { zoom: 1.1 }' }));
    assert.ok(css.trim().endsWith('body { zoom: 1.1 }'));
});

// --- what the backdrop should be

check('with the switch off there is no wallpaper, whichever picture is chosen', () => {
    ['flames', 'ocean', 'custom', 'none', 'nonsense'].forEach((picture) => {
        const read = reading({ themeWallpaperOn: false, themeWallpaper: picture, themeWallpaperUrl: 'https://x.com/a.jpg' });

        assert.strictEqual(wallpaperOf(read), null, picture);
        assert.strictEqual(backdropOf(read), null, picture);
    });
});

check('a picture left as "none" by an earlier version is no wallpaper even with the switch on', () => {
    assert.strictEqual(wallpaperOf(reading({ themeWallpaperOn: true, themeWallpaper: 'none' })), null);
});

check('the blue flames wallpaper is the bundled picture', () => {
    assert.strictEqual(wallpaperOf(reading({ themeWallpaperOn: true, themeWallpaper: 'flames' })),
        'url("/__tube/wallpapers/blue-flames.jpg")');
});

check('every picture the preset list names is a file in wallpapers/', () => {
    Object.keys(WALLPAPER_FILES).forEach((id) => {
        assert.ok(fs.existsSync(path.join(root, 'wallpapers', WALLPAPER_FILES[id])), `${WALLPAPER_FILES[id]} is not in wallpapers/`);
        assert.ok(WALLPAPERS[id].indexOf(WALLPAPER_FILES[id]) !== -1);
    });
});

check('every preset is one image, with no colour or position among the layers', () => {
    Object.keys(WALLPAPERS).forEach((id) => {
        assert.ok(/^(url|linear-gradient|radial-gradient)\(/.test(WALLPAPERS[id]), id);
        assert.ok(WALLPAPERS[id].indexOf('no-repeat') === -1 && !/,\s*#[0-9a-f]{3,6}\s*$/i.test(WALLPAPERS[id]), id);
    });
});

check('it is dimmed by default, so white text stays readable on it', () => {
    assert.strictEqual(configDefaults().themeDim, 40);
    assert.strictEqual(backdropOf(reading({ themeWallpaperOn: true })).dim, 40);
});

check('your own picture is used only as a plain web address', () => {
    const own = (url) => wallpaperOf(reading({ themeWallpaperOn: true, themeWallpaper: 'custom', themeWallpaperUrl: url }));

    assert.strictEqual(own('https://example.com/a.jpg'), 'url("https://example.com/a.jpg")');
    assert.strictEqual(own('javascript:alert(1)'), null);
    assert.strictEqual(own('https://x.com/a.jpg"); } body { display: none'), null);
    assert.strictEqual(own(''), null);
});

check('a colour alone is the backdrop when there is no wallpaper, and the wallpaper wins over it', () => {
    assert.deepStrictEqual(backdropOf(reading({ themeBackground: 'navy' })), { kind: 'colour', colour: '#0a1128' });
    assert.strictEqual(backdropOf(reading({ themeBackground: 'navy', themeWallpaperOn: true, themeWallpaper: 'ocean' })).kind, 'wallpaper');
});

// --- painting it, and taking it off again

const stand = (own) => {
    const make = (name, style) => ({ name, style: Object.assign({}, style), parentNode: null });
    const html = make('html', { minHeight: '' });
    const body = make('body', { backgroundColor: 'rgb(15, 15, 15)' });
    const container = make('container', { backgroundColor: 'rgb(15, 15, 15)', color: 'white' });
    const sheets = [];
    const listeners = {};
    const reloads = [];

    const head = {
        appendChild: (element) => {
            element.parentNode = { removeChild: (gone) => sheets.splice(sheets.indexOf(gone), 1) };
            sheets.push(element);
        }
    };

    const behaviour = Object.assign({ redraws: true, layers: true }, own);

    global.document = {
        documentElement: html,
        body,
        head,
        getElementById: (id) => (id === 'container' ? container : sheets.find((element) => element.id === id) || null),
        querySelector: () => null,
        createElement: () => make('style', {})
    };

    global.window.location = { hash: '#/', reload: () => reloads.push(1) };
    global.window.addEventListener = (type, handler) => { listeners[type] = handler; };

    // What the engine says the page's background-image is: what was set, unless it does not redraw
    // or does not take two layers.
    const frozen = { value: 'none' };
    global.window.getComputedStyle = () => {
        const set = body.style.backgroundImage;

        // An engine that never redraws keeps reporting the first thing it was given.
        if (!behaviour.redraws) {
            if (!frozen.taken && set) {
                frozen.value = set;
                frozen.taken = true;
            }

            return { backgroundImage: frozen.value };
        }
        if (!set) return { backgroundImage: 'none' };
        if (!behaviour.layers && set.indexOf('),') !== -1 && set.indexOf('linear-gradient(rgba(') === 0) return { backgroundImage: 'none' };

        frozen.value = set;
        return { backgroundImage: set };
    };

    // The scheduler's interval, and the pause before a reload, are not waited for.
    global.setTimeout = (run) => { run(); return 0; };

    return { html, body, container, sheets, listeners, reloads, // What each element's style says, leaving out what is set to nothing, which is the same as not set.
        snapshot: () => JSON.stringify([html.style, body.style, container.style].map((style) => Object.keys(style)
            .filter((name) => style[name] !== '').sort().map((name) => [name, style[name]]))) };
};

const settle = (settings, run) => withConfig(settings, run);

check('turning the wallpaper on paints the page, and lets the app\'s own backdrop go', () => {
    const page = stand();
    startTheme();

    settle({ themeWallpaperOn: true, themeWallpaper: 'ocean', themeDim: 40 }, () => {});
    configWrite('themeWallpaperOn', true);
    configWrite('themeWallpaper', 'ocean');

    assert.ok(page.body.style.backgroundImage.indexOf('linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), linear-gradient(180deg, #02111f') === 0, page.body.style.backgroundImage);
    assert.strictEqual(page.html.style.backgroundImage, page.body.style.backgroundImage);
    assert.strictEqual(page.body.style.backgroundSize, 'cover');
    assert.strictEqual(page.body.style.backgroundColor, '#000000');
    assert.strictEqual(page.html.style.minHeight, '100vh');
    assert.strictEqual(page.container.style.backgroundColor, 'transparent');

    configWrite('themeWallpaperOn', false);
    configWrite('themeWallpaper', 'flames');
});

check('turning it off puts every style back exactly as the page had it', () => {
    const page = stand();
    const before = page.snapshot();
    startTheme();

    configWrite('themeWallpaperOn', true);
    assert.notStrictEqual(page.snapshot(), before, 'nothing was painted');

    configWrite('themeWallpaperOn', false);
    assert.strictEqual(page.snapshot(), before, 'what was painted is still there');
    assert.strictEqual(page.reloads.length, 0, 'the page was reloaded though it redrew');
});

check('on and off again, three times, leaves nothing behind', () => {
    const page = stand();
    const before = page.snapshot();
    startTheme();

    [1, 2, 3].forEach(() => {
        configWrite('themeWallpaperOn', true);
        configWrite('themeWallpaperOn', false);
    });

    assert.strictEqual(page.snapshot(), before);
});

check('another picture takes the place of the first, with no trace of it', () => {
    const page = stand();
    startTheme();

    configWrite('themeWallpaperOn', true);
    configWrite('themeWallpaper', 'ocean');
    configWrite('themeWallpaper', 'violet');

    assert.ok(page.body.style.backgroundImage.indexOf('#02111f') === -1 && page.body.style.backgroundImage.indexOf('#12002b') !== -1);

    configWrite('themeWallpaperOn', false);
    configWrite('themeWallpaper', 'flames');
});

check('a changed dimming is applied at once', () => {
    const page = stand();
    startTheme();

    configWrite('themeWallpaperOn', true);
    configWrite('themeDim', 80);
    assert.ok(page.body.style.backgroundImage.indexOf('rgba(0, 0, 0, 0.8)') !== -1);

    configWrite('themeDim', 0);
    assert.ok(page.body.style.backgroundImage.indexOf('rgba(') === -1, 'dimming 0 still has the shade');

    configWrite('themeWallpaperOn', false);
    configWrite('themeDim', 40);
});

check('an engine that takes one layer only gets the wallpaper without the dimming, not none', () => {
    const page = stand({ layers: false });
    startTheme();

    configWrite('themeWallpaperOn', true);
    assert.strictEqual(page.body.style.backgroundImage.indexOf('linear-gradient(rgba('), -1);
    assert.ok(page.body.style.backgroundImage.indexOf('url("/__tube/wallpapers/blue-flames.jpg")') === 0);

    configWrite('themeWallpaperOn', false);
});

check('if the engine still shows the wallpaper after it was switched off, the page is loaded again', () => {
    const page = stand({ redraws: false });
    startTheme();

    configWrite('themeWallpaperOn', true);
    assert.strictEqual(page.reloads.length, 0);

    // The engine keeps drawing what it drew: it never redraws.
    configWrite('themeWallpaperOn', false);
    assert.strictEqual(page.reloads.length, 1, 'the wallpaper was left on the screen');
});

check('a video clears the wallpaper, and the home page brings it back', () => {
    const page = stand();
    const before = page.snapshot();
    startTheme();

    configWrite('themeWallpaperOn', true);
    const painted = page.snapshot();

    global.window.location.hash = '#/watch?v=abc';
    page.listeners.hashchange();
    assert.strictEqual(page.snapshot(), before, 'still painted while a video plays');

    global.window.location.hash = '#/';
    page.listeners.hashchange();
    assert.strictEqual(page.snapshot(), painted, 'not painted again after the video');

    configWrite('themeWallpaperOn', false);
});

check('a plain background colour is painted the same way, and taken off the same way', () => {
    const page = stand();
    const before = page.snapshot();
    startTheme();

    configWrite('themeBackground', 'navy');
    assert.strictEqual(page.body.style.backgroundColor, '#0a1128');
    assert.strictEqual(page.container.style.backgroundColor, '#0a1128');

    configWrite('themeBackground', 'default');
    assert.strictEqual(page.snapshot(), before);
});

check('the stylesheet is a new element each time, the old one gone', () => {
    const page = stand();
    startTheme();

    configWrite('themeAccent', 'pink');
    configWrite('themeAccent', 'green');

    assert.strictEqual(page.sheets.length, 1);
    assert.ok(page.sheets[0].textContent.indexOf('#4ade80') !== -1);

    configWrite('themeAccent', 'blue');
});

check('"turn it off now" switches it off, paints it away and loads the page again', () => {
    const page = stand();
    const before = page.snapshot();
    startTheme();

    configWrite('themeWallpaperOn', true);

    // What the button does: the setting, then this.
    configWrite('themeWallpaperOn', false);
    wallpaperOffNow();

    assert.strictEqual(page.snapshot(), before);
    assert.strictEqual(page.reloads.length, 1);
});

check('starting with the wallpaper off leaves the page exactly as it was', () => {
    const page = stand();
    const before = page.snapshot();
    startTheme();

    assert.strictEqual(page.snapshot(), before);
});

check('starting with the wallpaper on paints it', () => {
    withConfig({ themeWallpaperOn: true }, () => {
        const page = stand();
        startTheme();

        assert.ok(page.body.style.backgroundImage.indexOf('blue-flames.jpg') !== -1);
        configWrite('themeWallpaperOn', false);
    });
});

// --- Ultimate Dev Options

check('the developer options hold the advanced settings', () => {
    const titles = itemsOf(open([indexOfGroup('tube_dev')])).map(titleOf);

    ['Phone settings page', 'Phone page refresh', 'SponsorBlock server', 'AniUltimatium app on this TV', 'Custom style rules', 'Version', 'Reset everything']
        .forEach((name) => assert.ok(titles.indexOf(name) !== -1, `${name} is missing from ${titles.join(', ')}`));
});

check('Reset everything writes every setting back to its default in one step', () => {
    const group = indexOfGroup('tube_dev');
    const at_ = GROUPS[group].items.findIndex((item) => item.key === 'tubeReset');
    const buttons = itemsOf(open([group, at_]));

    assert.strictEqual(buttons.length, 1);

    const datas = commandsOf(buttons[0])[0].setClientSettingEndpoint.settingDatas;
    assert.strictEqual(datas.length, Object.keys(configDefaults()).length);
    assert.ok(datas.some((data) => data.clientSettingEnum.item === 'enableAdBlock'));
});

check('a SponsorBlock server is used only as an https address, with /api added', () => {
    assert.strictEqual(apiBase(), 'https://sponsor.ajay.app/api');

    withConfig({ sponsorBlockServer: 'https://sb.example.org' }, () => assert.strictEqual(apiBase(), 'https://sb.example.org/api'));
    withConfig({ sponsorBlockServer: 'https://sb.example.org/api/' }, () => assert.strictEqual(apiBase(), 'https://sb.example.org/api'));
    withConfig({ sponsorBlockServer: 'http://sb.example.org' }, () => assert.strictEqual(apiBase(), 'https://sponsor.ajay.app/api'));
    withConfig({ sponsorBlockServer: 'javascript:1' }, () => assert.strictEqual(apiBase(), 'https://sponsor.ajay.app/api'));
});

check('text settings are typed on the phone and shown to it as text', () => {
    const find = (key) => phoneSchema().reduce((all, group) => all.concat(group.items), []).find((item) => item.key === key);

    assert.strictEqual(find('sponsorBlockServer').kind, 'text');
    assert.strictEqual(find('customCss').kind, 'text');
    assert.strictEqual(find('customCss').multiline, true);
    assert.strictEqual(find('themeWallpaperUrl').kind, 'text');
});

check('the phone page carries the new sections, and none of the buttons', () => {
    const titles = phoneSchema().map((group) => group.title);

    ['Customization', 'Ultimate Dev Options', 'AniUltimatium'].forEach((name) => assert.ok(titles.indexOf(name) !== -1, name));

    const keys = phoneSchema().reduce((all, group) => all.concat(group.items.map((item) => item.key)), []);
    assert.ok(keys.indexOf('openAniUltimatium') === -1);
});

// --- AniUltimatium

check('with the switch off there is the switch and nothing else, and no extra row', () => {
    const group = indexOfGroup('tube_aniultimatium');

    assert.deepStrictEqual(itemsOf(open([group])).map(titleOf), ['AniUltimatium']);

    const titles = rowsOf().map((row) => rendererOf(row).title.runs[0].text);
    assert.strictEqual(titles.filter((title) => title === 'AniUltimatium').length, 0);
});

check('the switch turns it on where it stands, and redraws the list', () => {
    const group = indexOfGroup('tube_aniultimatium');
    const [link] = itemsOf(open([group]));
    const [write, redraw] = commandsOf(link);

    assert.strictEqual(write.setClientSettingEndpoint.settingDatas[0].clientSettingEnum.item, 'enableAniUltimatium');
    assert.strictEqual(write.setClientSettingEndpoint.settingDatas[0].boolValue, true);
    assert.strictEqual(redraw.customAction.parameters.update, true);
});

check('with it on, the list gains "Open AniUltimatium", and the category a blue row', () => {
    withConfig({ enableAniUltimatium: true }, () => {
        const group = indexOfGroup('tube_aniultimatium');
        const links = itemsOf(open([group]));

        assert.deepStrictEqual(links.map(titleOf), ['AniUltimatium', 'Open AniUltimatium']);
        assert.strictEqual(commandsOf(links[1])[0].customAction.action, 'OPEN_ANIULTIMATIUM');

        const rows = rowsOf().map(rendererOf);
        const ani = rows.find((row) => row.title.runs[0].text === 'AniUltimatium');

        assert.ok(ani, 'the extra row is missing');
        assert.strictEqual(ani.tubeStyle, 'ultimate');
        assert.strictEqual(ani.serviceEndpoint.customAction.action, 'OPEN_ANIULTIMATIUM');
        assert.strictEqual(rows[1], ani, 'it is not directly under the Ultimate Settings row');
    });
});

// --- speed

check('the speed menu reaches 15x', () => {
    const ladder = speedLadder();

    assert.strictEqual(ladder[ladder.length - 1], 15);
    assert.ok(ladder.indexOf(0.25) !== -1 && ladder.indexOf(4) !== -1 && ladder.indexOf(5) !== -1 && ladder.indexOf(10) !== -1);
});

check('and is in order, with no speed twice', () => {
    const ladder = speedLadder();

    assert.deepStrictEqual(ladder, ladder.slice().sort((a, b) => a - b));
    assert.strictEqual(new Set(ladder).size, ladder.length);
});

check('the step setting sets the fine rungs', () => {
    withConfig({ speedSettingsIncrement: 0.5 }, () => {
        const ladder = speedLadder();
        assert.deepStrictEqual(ladder.slice(0, 3), [0.5, 1, 1.5]);
        assert.strictEqual(ladder[ladder.length - 1], 15);
    });
});

check('a default speed can be set to 15x in the settings, and is a choice of the Playback section', () => {
    const playback = indexOfGroup('tube_playback');
    const at_ = GROUPS[playback].items.findIndex((item) => item.key === 'defaultPlaybackSpeed');

    assert.ok(at_ !== -1, 'defaultPlaybackSpeed is not in Playback');

    const labels = itemsOf(open([playback, at_])).map(titleOf);
    assert.ok(labels.indexOf('15x') !== -1 && labels.indexOf('1x') !== -1);

    assert.strictEqual(at([playback, at_]).key, 'defaultPlaybackSpeed');
});

check('every setting these sections name is one the config knows', () => {
    const known = configDefaults();
    const buttons = ['themeReset', 'tubeVersion', 'tubeReset', 'openAniUltimatium', 'wallpaperOffNow'];

    GROUPS.filter((group) => group.ultimate).forEach((group) => group.items.forEach((item) => {
        if (buttons.indexOf(item.key) === -1) assert.ok(item.key in known, `${item.key} is not in the config`);
    }));
});

check('defaults leave YouTube as it is', () => {
    assert.strictEqual(configRead('themeWallpaperOn'), false);
    assert.strictEqual(configRead('enableAniUltimatium'), false);
    assert.strictEqual(configRead('defaultPlaybackSpeed'), 1);
    assert.strictEqual(configRead('customCss'), '');
    configWrite('customCss', '');
});

finish();
