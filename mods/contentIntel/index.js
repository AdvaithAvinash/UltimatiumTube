import { GRID, PIVOT, SHELF, TILES, configRead, keepTile } from '../../framework/index.js';
import { normal } from '../channels/index.js';
import { detailsOf } from '../channelFilter/index.js';

// Content intelligence, by rules kept on this TV (nothing is sent anywhere):
//  - the same video twice in one answer, or a repost (the same title from another channel), shown once;
//  - clickbait titles hidden (shouting, "you won't believe", a row of !!! or emojis);
//  - your own rules: a word, "channel: name", or "regex: pattern" a line, each hiding what it matches.

const idOf = (item) => (item.tileRenderer && item.tileRenderer.contentId)
    || (item.lockupViewModel && item.lockupViewModel.contentId) || '';

// One answer is one run of the walk; what was seen is forgotten once it is over.
const seen = { ids: {}, titles: {}, armed: false };
const forgetSoon = () => {
    if (seen.armed) return;
    seen.armed = true;
    setTimeout(() => { seen.ids = {}; seen.titles = {}; seen.armed = false; }, 0);
};

// A title as it would be told apart from a repost of it.
const plainTitle = (title) => normal(title)
    .replace(/\((official|lyric|music|audio|video|hd|4k|full|re-?upload|reupload|remastered)[^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(official|video|lyrics?|hd|4k|re-?upload(ed)?|full)\b/g, ' ')
    .replace(/[^a-z0-9\u00c0-\u9fff]+/g, ' ')
    .trim();

const BAIT = /\b(you won'?t believe|shocking|gone wrong|gone sexual|insane|unbelievable|what happens next|must see|not clickbait|exposed|destroyed|emotional)\b/i;
const EMOJI = /[\u2600-\u27bf]|\ud83c[\udf00-\udfff]|\ud83d[\udc00-\ude4f\ude80-\udeff]|\ud83e[\udd00-\uddff]/g;

const isClickbait = (title) => {
    const text = String(title || '');
    const letters = text.replace(/[^A-Za-z]/g, '');
    const capitals = text.replace(/[^A-Z]/g, '').length;
    const shouting = letters.length >= 12 && capitals / letters.length > 0.7;
    const marks = /[!?]{3,}|\?!|!\?/.test(text);
    const emojis = (text.match(EMOJI) || []).length >= 3;
    return shouting || marks || emojis || BAIT.test(text);
};

// The rules as written on the phone, one to a line.
const rulesOf = (text) => String(text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const channel = /^channel\s*:\s*(.+)$/i.exec(line);
    if (channel) return { channel: normal(channel[1]) };
    const pattern = /^regex\s*:\s*(.+)$/i.exec(line);
    if (pattern) {
        try {
            return { regex: new RegExp(pattern[1], 'i') };
        } catch (error) {
            return null;
        }
    }
    return { word: normal(line) };
}).filter(Boolean);

const matchesRule = (rule, title, channel) => (rule.channel ? normal(channel) === rule.channel
    : rule.regex ? rule.regex.test(title)
        : !!rule.word && normal(title).indexOf(rule.word) !== -1);

// Whether a tile stays, given its id, title and channel and the settings.
const verdict = (id, title, channel, read) => {
    if (read('hideClickbait') && isClickbait(title)) return false;

    const rules = rulesOf(read('contentRules'));
    if (rules.some((rule) => matchesRule(rule, title, channel))) return false;

    if (!read('hideDuplicates')) return true;
    if (id) {
        if (seen.ids[id]) return false;
        seen.ids[id] = true;
    }
    const plain = plainTitle(title);
    if (plain.length >= 8) {
        if (seen.titles[plain] && seen.titles[plain] !== normal(channel)) return false;
        seen.titles[plain] = seen.titles[plain] || normal(channel);
    }
    return true;
};

keepTile('content intelligence', [SHELF, PIVOT, TILES, GRID], (item) => {
    if (!configRead('hideClickbait') && !configRead('hideDuplicates') && !String(configRead('contentRules') || '').trim()) return true;
    const details = detailsOf(item);
    if (!details) return true;
    forgetSoon();
    return verdict(idOf(item), details.title, details.channel, configRead);
});

export { isClickbait, plainTitle, rulesOf, verdict };
