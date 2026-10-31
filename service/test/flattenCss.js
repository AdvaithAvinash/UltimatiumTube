'use strict';

const { flatten, split } = require('../lib/flattenCss.js');

const results = [];

// A check is a function: true passes, anything else is what it found instead. A plain value is the same.
const check = (label, run, detail) => {
    const answer = typeof run === 'function' ? run() : run;
    const ok = answer === true;

    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <- ${typeof answer === 'string' ? answer : detail || ''}`}`);
    results.push(ok);
};

const squash = (css) => css.replace(/\s+/g, ' ').trim();

const out = (css, overrides) => squash(flatten(css, overrides));

check('a variable is replaced by its value, and no var( is left', () => {
    const css = out(':root{--a:#111}.x{color:var(--a)}');
    return css === '.x{color:#111}' ? true : css;
}, null);

check('the definitions are gone, as a rule left empty by them', () => out(':root{--a:#111}.x{color:var(--a)}').indexOf('--a') === -1);

check('a variable may refer to another', () => out(':root{--a:var(--b);--b:red}.x{color:var(--a)}') === '.x{color:red}', out(':root{--a:var(--b);--b:red}.x{color:var(--a)}'));

check('a fallback is used for a variable nothing defines', () => out('.x{color:var(--nope, blue)}') === '.x{color:blue}', out('.x{color:var(--nope, blue)}'));

check('a variable with no value and no fallback is left alone', () => out('.x{color:var(--nope)}') === '.x{color:var(--nope)}');

check('a value is used inside another function', () => out(':root{--rgb:1,2,3}.x{background:rgba(var(--rgb),.5)}') === '.x{background:rgba(1,2,3,.5)}');

check('a calc() keeps its shape', () => out(':root{--n:4rem}.x{width:calc(100% - var(--n))}') === '.x{width:calc(100% - 4rem)}');

check('the Modern look\'s own values are used by its selectors only', () => {
    const css = out(':root{--bg:#000}body.ui-modern{--bg:#111}.a{color:var(--bg)}body.ui-modern .b{color:var(--bg)}');
    return css === '.a{color:#000} body.ui-modern .b{color:#111}' ? true : css;
}, null);

check('a variable a media query changes is written again inside that query, straight after the rule', () => {
    const css = out(':root{--cw:11rem}.card{width:var(--cw)}@media (max-width:820px){:root{--cw:9rem}}.other{top:0}');
    return css.indexOf('.card{width:11rem}@media (max-width:820px){.card{width:9rem}}') === 0
        && css.indexOf('.other{top:0}') > css.indexOf('.card{width:9rem}') ? true : css;
}, null);

check('a rule inside a media query uses what that query changes', () => {
    const css = out(':root{--w:1px}@media (max-width:820px){:root{--w:2px}.x{border:var(--w) solid}}');
    return css.indexOf('.x{border:2px solid}') !== -1 ? true : css;
}, null);

check('an animation may use a variable', () => out(':root{--c:#f0f}@keyframes k{0%{color:var(--c)}}') === '@keyframes k{0%{color:#f0f}}', out(':root{--c:#f0f}@keyframes k{0%{color:var(--c)}}'));

check('what the page sets from script wins over the stylesheet\'s own value', () => {
    const css = out(':root{--accent:red}.x{color:var(--accent)}', { '--accent': 'rgb(1, 2, 3)' });
    return css === '.x{color:rgb(1, 2, 3)}' ? true : css;
}, null);

check('braces in strings and comments do not break the structure', () => {
    const css = out('/* } { */ :root{--a:1px}.x::before{content:"}{";margin:var(--a)}.y{top:0}');
    return css === '.x::before{content:"}{";margin:1px} .y{top:0}' ? true : css;
}, null);

check('a statement such as @import is kept', () => out('@import url(a.css);:root{--a:1px}.x{top:var(--a)}').indexOf('@import url(a.css);') === 0);

check('a stylesheet with no variables comes out the same, apart from spacing', () => out('.a{color:red}.b{top:0}') === '.a{color:red} .b{top:0}' || out('.a{color:red}.b{top:0}'));

check('pieces: blocks and statements', () => {
    const pieces = split('@import "x";.a{b:c}@media print{.d{e:f}}');
    return pieces.length === 3 && pieces[0].body === null && pieces[1].body === 'b:c' && pieces[2].body === '.d{e:f}';
}, null);

// The real thing: Aniultimatium's own stylesheet, if it is bundled.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '..', 'aniultimatium', 'styles.css');

if (fs.existsSync(file)) {
    const css = fs.readFileSync(file, 'utf8');
    const flat = flatten(css);

    check('Aniultimatium\'s stylesheet has no var( left', flat.indexOf('var(') === -1, String((flat.match(/var\([^)]*\)/g) || []).slice(0, 3)));
    check('and no custom property either', !/(^|[;{\s])--[\w-]+\s*:/.test(flat));
    check('its card is 11.5rem wide, and 9rem on a small screen', flat.indexOf('.card{flex:none;width:11.5rem;') !== -1
        && /@media \(max-width:820px\)\s*\{\s*\.card\{flex:none;width:9rem;/.test(flat));
    check('its Modern navigation uses the Modern rail', /body\.ui-modern #nav\{[^}]*width:5\.8rem/.test(flat));
    check('it is not much bigger than it was', flat.length < css.length * 1.1, `${flat.length} from ${css.length}`);
    check('every rule it had is still there', (flat.match(/\{/g) || []).length >= (css.match(/\{/g) || []).length - 2);
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
