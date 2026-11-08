import { configRead, onRequest } from '../../framework/index.js';

// Smart search: a search typed (or spoken) as a sentence, such as "find videos explaining how OLED
// TVs work in simple terms", is turned into the words that find it ("how OLED TVs work explained
// simply"). It is a set of rules on this TV, not an AI service: nothing is sent anywhere else.

const OPENERS = [
    /^(please\s+)?(can|could|would)\s+you\s+/i,
    /^(please\s+)?(find|show|search( for)?|look( for| up)?|get|give|play|recommend)(\s+me)?\s+/i,
    /^i\s+(want|would like|need)\s+(to\s+(watch|see|find|learn)\s+)?/i,
    /^(some|any|a few|good|the best)\s+/i,
    /^(videos?|clips?|tutorials?|content|something|stuff)\s+(that|which|who)?\s*/i,
    /^(explaining|explains|about|on|of|showing|that explain|which explain|teaching( me)?|covering)\s+/i
];

const PLAIN = /\b(in\s+simple\s+terms|simply|in\s+an?\s+easy\s+way|easily|eli5|like\s+i'?m\s+five)\b/gi;
const FILLER = /\b(please|thanks|thank you|really|actually|basically|kind of|sort of)\b/gi;

const looksLikeASentence = (text) => text.split(/\s+/).length >= 5
    || OPENERS.some((opener) => opener.test(text));

const smarten = (query) => {
    const original = String(query || '').trim();
    if (!original || !looksLikeASentence(original)) return original;

    const plainly = PLAIN.test(original);
    PLAIN.lastIndex = 0;

    const rest = OPENERS.reduce((text, opener) => text.replace(opener, ''), original
        .replace(/[?.!]+$/, '')
        .replace(PLAIN, ' ')
        .replace(FILLER, ' '))
        .replace(/\s+/g, ' ')
        .trim();

    // A second pass, since openers come in any order ("show me some videos about ...").
    const cleaner = OPENERS.reduce((text, opener) => text.replace(opener, ''), rest).trim();
    const words = cleaner || original;

    return plainly ? `${words} explained simply` : words;
};

onRequest('smart search', ['query'], (body) => {
    // Only an innertube request (it carries a context) is a search; anything else with a query is left.
    if (!configRead('enableSmartSearch') || typeof body.query !== 'string' || !body.context) return body;

    const better = smarten(body.query);
    return better === body.query ? body : Object.assign({}, body, { query: better });
});

export { smarten };
