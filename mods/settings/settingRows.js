import { configRead } from '../../framework/index.js';
import { GROUPS, ULTIMATE_MENU, chosenLabel, chosenSummary } from './settingsModel.js';
import { actionCommand, optionsCommand, storeCommand } from './settingsOptions.js';
import { category, runs } from './settingsResponse.js';

const picture = (url) => ({ thumbnails: [{ url }] });

// Prefixed because the id is what the DOM claim matches on, and YouTube's own rows use ids of
// the same shape.
const idFor = (item) => `TUBE_${item.key || item.id}`;

// A summary may be worded at draw time, for rows that carry an address or a count.
const said = (text) => (typeof text === 'function' ? text() : text);

const switchRow = (item) => ({
    settingBooleanRenderer: {
        title: runs(item.title),
        summary: runs(said(item.summary)),
        enabled: configRead(item.key) === item.on,
        enableServiceEndpoint: storeCommand(item.key, item.on),
        disableServiceEndpoint: storeCommand(item.key, !item.on),
        tubeNote: item.note,
        trackingParams: 'null',
        itemId: idFor(item),
        thumbnail: picture(item.image)
    }
});

// A getter rather than a value: the row object outlives the choice, so the label is read at draw time.
const openerRow = (item, endpoint, label, style) => {
    const row = {
        title: runs(item.title),
        summary: runs(said(item.summary)),
        serviceEndpoint: endpoint,
        tubeNote: item.note,
        tubeStyle: style,
        trackingParams: 'null',
        itemId: idFor(item),
        thumbnail: picture(item.image),
        get actionLabel() { return runs(label()); }
    };

    return { settingActionRenderer: row };
};

const rowFor = (item, path) =>
    item.kind === 'switch' ? switchRow(item)
        : item.kind === 'choice'
            ? openerRow(item, optionsCommand(path), () => `${item.prefix}: ${chosenLabel(item)}`)
            : item.kind === 'panel'
                ? openerRow(item, optionsCommand(path), () => item.value())
                : openerRow(item, optionsCommand(path), () => chosenSummary(item));

const OPEN = () => 'Open';

// The way into Customization, Ultimate Dev Options and AniUltimatium. Blue and glowing, so it is
// found among YouTube's own rows.
const ultimateRow = () => openerRow(ULTIMATE_MENU, optionsCommand(['ultimate']), OPEN, 'ultimate');

// While AniUltimatium is switched on, one more row, in the same colour, opens it.
const aniRow = () => openerRow(
    { title: 'AniUltimatium', summary: 'Anime, movies and live TV, inside UltimatiumTube', image: ULTIMATE_MENU.image },
    actionCommand('OPEN_ANIULTIMATIUM'), OPEN, 'ultimate'
);

const SECTION = 'ultimatiumtube';

// Every group's rows in one category, so all of UltimatiumTube sits under a single entry. The
// Ultimate groups are not listed here: they are behind the first row.
// The path is how the option panel finds an item again: which group, then which item within it.
const sectionFor = () => category(
    SECTION,
    'UltimatiumTube',
    [ultimateRow()]
        .concat(configRead('enableAniUltimatium') ? [aniRow()] : [])
        .concat(GROUPS.reduce((rows, group, groupIndex) => (group.ultimate
            ? rows
            : rows.concat(group.items.map((item, index) => rowFor(item, [groupIndex, index])))), []))
);

export { SECTION, sectionFor };
