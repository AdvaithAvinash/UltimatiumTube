import { GROUPS } from './settingsModel.js';

const said = (text) => (typeof text === 'function' ? text() : text);

const optionsOf = (item) => (item.options || []).map((option) => ({
    label: option.label, value: option.value, key: option.key
}));

// What the phone page draws, in the same words the TV uses. Written out as plain data because it
// is sent as JSON; anything that is a function on the TV is called here.
const describe = (item) => {
    const base = { key: item.key || item.id, title: item.title, summary: said(item.summary) };

    if (item.kind === 'switch') return Object.assign(base, { kind: 'switch', on: item.on });
    if (item.kind === 'choice') return Object.assign(base, { kind: 'choice', options: optionsOf(item) });
    if (item.kind === 'flags') return Object.assign(base, { kind: 'flags', options: optionsOf(item) });

    if (item.kind === 'set' && item.phone === 'words') return Object.assign(base, { kind: 'words' });
    if (item.kind === 'set') return Object.assign(base, { kind: 'set', invert: item.invert, options: optionsOf(item) });

    if (item.kind === 'panel' && item.phone === 'words') return Object.assign(base, { kind: 'words' });

    return Object.assign(base, {
        kind: 'panel',
        value: item.value(),
        actions: (item.options || []).filter((option) => option.writes && option.writes.length)
    });
};

const phoneSchema = () => GROUPS
    // The row that tells the viewer to use the phone has nothing to say on the phone.
    .map((group) => ({
        id: group.id,
        title: group.title,
        items: group.items.filter((item) => item.key !== 'phoneSettings').map(describe)
    }))
    .filter((group) => group.items.length);

export { phoneSchema };
