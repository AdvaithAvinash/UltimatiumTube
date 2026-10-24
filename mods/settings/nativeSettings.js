import { configChangeEmitter, onResponse } from '../../framework/index.js';
import { sectionFor, SECTION } from './settingRows.js';
import { categoryOf } from './settingsResponse.js';
import { claimDrawnRows } from './claimDrawn.js';
import { redrawSettingRows } from './settingComponents.js';

// YouTube's own categories are left exactly as sent; ours is one more, at the very bottom.

// The settings response arrives more than once per session, and patching twice would double every row.
const alreadyPatched = (items) => items.some((item) => {
    const found = categoryOf(item);
    return found && found.categoryId === SECTION;
});

function PatchSettings(response) {
    if (!Array.isArray(response.items)) return;

    const items = response.items;
    if (!items.some(categoryOf)) return;
    if (alreadyPatched(items)) return;

    claimDrawnRows();

    items.push(sectionFor());
}

onResponse('settings', ['items'], PatchSettings);

const start = () => {
    configChangeEmitter.addEventListener('configChange', () => redrawSettingRows());
};

export { PatchSettings, start };
