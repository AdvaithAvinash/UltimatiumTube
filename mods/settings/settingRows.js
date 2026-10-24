import { configRead } from '../../framework/index.js';
import { GROUPS, chosenLabel, chosenSummary } from './settingsModel.js';
import { optionsCommand, storeCommand } from './settingsOptions.js';
import { category, runs } from './settingsResponse.js';

const picture = (url) => ({ thumbnails: [{ url }] });

// Prefixed because the id is what the DOM claim matches on, and YouTube's own rows use ids of
// the same shape.
const idFor = (item) => `TUBE_${item.key || item.id}`;

const switchRow = (item) => ({
    settingBooleanRenderer: {
        title: runs(item.title),
        summary: runs(item.summary),
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
const openerRow = (item, path, label) => {
    const row = {
        title: runs(item.title),
        summary: runs(item.summary),
        serviceEndpoint: optionsCommand(path),
        tubeNote: item.note,
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
            ? openerRow(item, path, () => `${item.prefix}: ${chosenLabel(item)}`)
            : openerRow(item, path, () => chosenSummary(item));

const SECTION = 'ultimatiumtube';

// Every group's rows in one category, so all of UltimatiumTube sits under a single entry.
// The path is how the option panel finds an item again: which group, then which item within it.
const sectionFor = () => category(
    SECTION,
    'UltimatiumTube',
    GROUPS.reduce((rows, group, groupIndex) =>
        rows.concat(group.items.map((item, index) => rowFor(item, [groupIndex, index]))), [])
);

export { SECTION, sectionFor };
