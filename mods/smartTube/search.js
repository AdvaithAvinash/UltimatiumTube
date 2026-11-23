// The SmartTube UI's own search: a keyboard on the screen, YouTube's suggestions as you type (from
// the address YouTube's own TV app asks, which answers at once), and the results as rows of cards.

const COLUMNS = 7;
const SPACE = ' ';
const DELETE = 'delete';
const CLEAR = 'clear';
const SEARCH = 'search';

const KEYBOARD = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('').concat([SPACE, DELETE, CLEAR, SEARCH]);

const labelOf = (key) => (key === SPACE ? 'space' : key === DELETE ? '⌫' : key === CLEAR ? 'clear' : key === SEARCH ? 'Search' : key);

const typed = (query, key) => {
    if (key === DELETE) return query.slice(0, -1);
    if (key === CLEAR) return '';
    if (key === SEARCH) return query;
    if (key === SPACE) return query && !/ $/.test(query) ? `${query} ` : query;
    return (query + key).slice(0, 120);
};

// The grid, moved about: answers the new place, or -1 to leave it that way.
const step = (at, code) => {
    const column = at % COLUMNS;
    if (code === 37) return column === 0 ? -1 : at - 1;
    if (code === 39) return column === COLUMNS - 1 || at === KEYBOARD.length - 1 ? -1 : at + 1;
    if (code === 38) return at - COLUMNS < 0 ? -1 : at - COLUMNS;
    if (code === 40) return at + COLUMNS >= KEYBOARD.length ? (Math.floor(at / COLUMNS) === Math.floor((KEYBOARD.length - 1) / COLUMNS) ? -1 : KEYBOARD.length - 1) : at + COLUMNS;
    return at;
};

// YouTube's suggestion answer: )]}' then [query, [[suggestion, ...], ...], ...].
const suggestionsOf = (text) => {
    try {
        const answer = JSON.parse(String(text || '').replace(/^\)\]\}'\s*/, ''));
        return (Array.isArray(answer) && Array.isArray(answer[1]) ? answer[1] : [])
            .map((one) => (Array.isArray(one) ? one[0] : one)).filter((one) => typeof one === 'string' && one).slice(0, 9);
    } catch (error) {
        return [];
    }
};

const suggestUrl = (query, language) => `/complete/search?client=youtube-lr&ds=yt&xhr=t&oe=utf-8&xssi=t&hl=${encodeURIComponent(language || 'en')}`
    + `&q=${encodeURIComponent(query)}`;

export { KEYBOARD, COLUMNS, SEARCH, labelOf, typed, step, suggestionsOf, suggestUrl };
