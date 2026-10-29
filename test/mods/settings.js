import assert from 'assert';

global.window = { localStorage: { 'tube.settings': '{}' }, addEventListener: () => undefined };
global.document = { querySelectorAll: () => [] };

const { PatchSettings } = await import('../../mods/settings/nativeSettings.js');
const { GROUPS } = await import('../../mods/settings/settingsModel.js');

const results = [];

const check = (name, run) => {
    try {
        run();
        results.push(true);
        console.log(`PASS  ${name}`);
    } catch (failure) {
        results.push(false);
        console.log(`FAIL  ${name}\n      ${String(failure.message).split('\n').slice(0, 5).join('\n      ')}`);
    }
};

// The shapes YouTube sends, cut down to what the move actually reads.
const booleanRow = (title, settingItem) => ({
    settingBooleanRenderer: {
        title: { runs: [{ text: title }] },
        enableServiceEndpoint: {
            setClientSettingEndpoint: {
                settingDatas: [{ clientSettingEnum: { item: settingItem }, boolValue: true }]
            }
        }
    }
});

const actionRow = (title, itemId) => ({
    settingActionRenderer: { title: { runs: [{ text: title }] }, itemId }
});

const category = (categoryId, title, items) => ({
    settingCategoryCollectionRenderer: { categoryId, title: { runs: [{ text: title }] }, items }
});

const titleOf = (row) => {
    const title = row[Object.keys(row)[0]].title;
    return (title && (title.simpleText || (title.runs && title.runs[0].text))) || '?';
};

const rowsIn = (items, categoryId) => {
    const found = items
        .map((item) => item.settingCategoryCollectionRenderer)
        .filter(Boolean)
        .find((c) => c.categoryId === categoryId);

    if (!found) return null;

    return found.items.map(titleOf);
};

const response = () => ({
    items: [
        category('SETTING_CAT_TVHTML5_GENERAL', 'General', [
            booleanRow('Previews', 'ENABLE_PREVIEWS_WITH_SOUND'),
            booleanRow('Restricted mode', 'SAFETY_MODE'),
            actionRow('Autoplay next video', 'AUTONAV'),
            booleanRow('Something of theirs we do not touch', 'SOME_OTHER_FLAG')
        ]),
        category('SETTING_CAT_TVHTML5_ABOUT', 'About', [])
    ]
});

const categoryIds = (items) => items
    .map((item) => item.settingCategoryCollectionRenderer)
    .filter(Boolean)
    .map((c) => c.categoryId);

check('UltimatiumTube is one category, at the very bottom', () => {
    const r = response();
    PatchSettings(r);

    const ids = categoryIds(r.items);
    assert.deepStrictEqual(ids, ['SETTING_CAT_TVHTML5_GENERAL', 'SETTING_CAT_TVHTML5_ABOUT', 'ultimatiumtube'],
        `categories came out as ${JSON.stringify(ids)}`);

    const title = r.items[r.items.length - 1].settingCategoryCollectionRenderer.title.runs[0].text;
    assert.strictEqual(title, 'UltimatiumTube');
});

check('it lists the Ultimate Settings first, then every row of every other group', () => {
    const r = response();
    PatchSettings(r);

    const rows = rowsIn(r.items, 'ultimatiumtube');
    // The Ultimate sections sit behind the first row, not among the rest.
    const listed = GROUPS.filter((group) => !group.ultimate).reduce((count, group) => count + group.items.length, 0);
    assert.strictEqual(rows.length, listed + 1, `${rows.length} rows for ${listed} items and the way in`);
    assert.strictEqual(rows[0], 'UltimatiumTube Ultimate Settings');
    assert.strictEqual(rows[1], 'SponsorBlock');
});

check('YouTube’s own rows are left exactly as sent', () => {
    const r = response();
    PatchSettings(r);

    assert.deepStrictEqual(rowsIn(r.items, 'SETTING_CAT_TVHTML5_GENERAL'),
        ['Previews', 'Restricted mode', 'Autoplay next video', 'Something of theirs we do not touch']);
});

check('a second settings response is not patched twice', () => {
    const r = response();
    PatchSettings(r);
    PatchSettings(r);

    const ours = categoryIds(r.items).filter((id) => id === 'ultimatiumtube');
    assert.strictEqual(ours.length, 1);
});

const oursKeyed = (key) => GROUPS.some((group) => group.items.some((item) => item.key === key));

check('we ship no second previews switch of our own', () => {
    assert.ok(!oursKeyed('enablePreviews'), 'our duplicate previews switch is back');
});

check('we ship no long press toggle of our own', () => {
    assert.ok(!oursKeyed('enableLongPress'), 'the long press toggle is back');
});

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
