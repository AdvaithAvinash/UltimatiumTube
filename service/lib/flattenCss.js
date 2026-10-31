'use strict';

// A stylesheet with its custom properties filled in. The TV's YouTube engine has no var(), so a style
// written with it loses every declaration that uses one. Aniultimatium sets all of its variables in
// its own stylesheet (its defaults on :root, a few overridden for its Modern look and, for one, in a
// small-screen query), so they can be read there and written in place.
//
// Not touched: anything else in the stylesheet, including what this engine cannot do either.

const VARIABLE = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g;
const DECLARATION = /(^|;)\s*(--[\w-]+)\s*:\s*([^;]*)/g;

const RAW_AT_RULES = /^@(-\w+-)?(keyframes|font-face|page)/i;

// What matters to the structure of a stylesheet: comments and strings, which hide braces, and the
// braces and semicolons themselves.
const TOKEN = /\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[{};]/g;

const withoutComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');

// Splits a stylesheet into its top-level pieces: { head, body } for a block, { head, body: null } for
// a statement such as @import. A comment before a rule is not part of its selector.
const split = (css) => {
    const state = { depth: 0, start: 0, open: 0, pieces: [] };

    Array.from(css.matchAll(TOKEN)).forEach((match) => {
        const token = match[0];
        const at = match.index;

        if (token === '{') {
            if (state.depth === 0) state.open = at;
            state.depth += 1;
        } else if (token === '}') {
            state.depth -= 1;

            if (state.depth === 0) {
                state.pieces.push({ head: withoutComments(css.slice(state.start, state.open)), body: css.slice(state.open + 1, at) });
                state.start = at + 1;
            }
        } else if (token === ';' && state.depth === 0) {
            const head = withoutComments(css.slice(state.start, at + 1));

            if (head.trim().charAt(0) === '@') state.pieces.push({ head, body: null });
            state.start = at + 1;
        }
    });

    return state.pieces;
};

const declaredIn = (body) => Array.from(withoutComments(body).matchAll(DECLARATION))
    .reduce((found, match) => Object.assign({}, found, { [match[2]]: match[3].trim() }), {});

const merge = (...maps) => maps.reduce((all, map) => Object.assign({}, all, map), {});

// A value may refer to another variable; it is resolved to the end, and a loop is left unresolved.
const resolved = (env) => {
    const out = {};

    Object.keys(env).forEach((name) => {
        const settle = (value, depth) => (depth > 8 ? value : value.replace(VARIABLE, (whole, ref, fallback) => (
            Object.prototype.hasOwnProperty.call(env, ref) ? settle(env[ref], depth + 1) : (fallback || whole)
        )));

        out[name] = settle(env[name], 0);
    });

    return out;
};

const fill = (text, env) => text.replace(VARIABLE, (whole, name, fallback) => {
    if (Object.prototype.hasOwnProperty.call(env, name)) return env[name];
    return fallback === undefined ? whole : fallback.trim();
});

const usesVariable = (text) => text.indexOf('var(') !== -1;

// Where a variable is defined: on :root or html, or for the Modern look on body.ui-modern.
const isRoot = (head) => /^\s*(:root|html)\s*$/.test(head);
const isModern = (head) => /^\s*body\.ui-modern\s*$/.test(head);

const sameLook = (selector) => selector.indexOf('ui-modern') !== -1;

const withoutVariables = (body) => body.replace(/(^|;)\s*--[\w-]+\s*:[^;]*(;|$)/g, '$1').replace(/;\s*;/g, ';');

// `overrides` is for what the page sets from script: { '--accent': 'rgb(1, 2, 3)', ... }.
const flatten = (css, overrides) => {
    const pieces = split(css);
    const isMedia = (piece) => /^\s*@media/i.test(piece.head);

    const base = merge.apply(null, pieces.filter((piece) => piece.body !== null && isRoot(piece.head))
        .map((piece) => declaredIn(piece.body)).concat(overrides || {}));

    const modern = merge.apply(null, [{}].concat(pieces.filter((piece) => piece.body !== null && isModern(piece.head))
        .map((piece) => declaredIn(piece.body))));

    // Variables a media query changes, on :root inside it.
    const inMedia = (piece) => merge.apply(null, [{}].concat(split(piece.body)
        .filter((inner) => inner.body !== null && isRoot(inner.head)).map((inner) => declaredIn(inner.body))));

    const overridden = pieces.filter(isMedia).map((piece) => ({ head: piece.head, changes: inMedia(piece) }))
        .filter((entry) => Object.keys(entry.changes).length);

    const envFor = (selector, extra) => resolved(merge(base, sameLook(selector) ? modern : {}, extra || {}));

    const rule = (head, body, extra) => `${head}{${fill(withoutVariables(body), envFor(head, extra))}}`;

    const render = (piece) => {
        if (piece.body === null) return piece.head;
        if (isRoot(piece.head) || isModern(piece.head)) return '';
        // Animations and fonts are not selectors, but they may use a variable too.
        if (RAW_AT_RULES.test(piece.head.trim())) return `${piece.head}{${fill(piece.body, envFor(''))}}`;

        if (isMedia(piece)) {
            const inner = split(piece.body);
            const own = overridden.find((entry) => entry.head === piece.head);
            const changed = own ? own.changes : {};

            return `${piece.head}{${inner.map((one) => {
                if (one.body === null) return one.head;
                if (isRoot(one.head) || isModern(one.head)) return '';
                return rule(one.head, one.body, changed);
            }).join('')}}`;
        }

        const text = rule(piece.head, piece.body);

        // A rule using a variable a media query changes is written again inside that query, straight
        // after it, so the query still wins where it applies.
        const again = !usesVariable(piece.body) ? [] : overridden.filter((entry) => Object.keys(entry.changes)
            .some((name) => piece.body.indexOf(`var(${name}`) !== -1));

        return text + again.map((entry) => `${entry.head}{${rule(piece.head, piece.body, entry.changes)}}`).join('');
    };

    return pieces.map(render).join('\n');
};

module.exports = { flatten, split };
