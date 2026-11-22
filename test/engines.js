// What the Samsung app's own files may be written in: the loader runs first on every TV, Tizen 3's
// Chromium 47 included, so it is plain ES5; the 5.0 widget's script (built by npm run build) may use
// no syntax newer than ES2015.

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as acorn from 'acorn';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (name, ok, detail) => {
    results.push(ok);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  <- ${detail}`}`);
};

const parses = (file, ecmaVersion) => {
    try {
        acorn.parse(readFileSync(join(ROOT, file), 'utf8'), { ecmaVersion });
        return '';
    } catch (error) {
        return error.message;
    }
};

check('the loader is plain ES5, for Tizen 3 and up', parses('app/loader.js', 5) === '', parses('app/loader.js', 5));
['stremio/ui.js', 'stremio/core.js', 'stremio/grayjay.js'].forEach((file) => {
    check(`${file} is plain ES5`, parses(file, 5) === '', parses(file, 5));
});

const legacy = 'dist/userScript.legacy.js';
if (existsSync(join(ROOT, legacy))) {
    check('the Tizen 5-and-under script uses nothing newer than ES2015', parses(legacy, 2015) === '', parses(legacy, 2015));
} else {
    console.log('PASS  (the Tizen 5-and-under script is checked once npm run build has made it)');
    results.push(true);
}

const loader = readFileSync(join(ROOT, 'app/loader.js'), 'utf8');
check('the loader opens www.youtube.com/tv and puts our script before YouTube’s own',
    loader.indexOf("'https://www.youtube.com/tv'") !== -1 && /insertBefore\(ours, head\.firstChild\)/.test(loader));
check('it never asks the app’s service before YouTube shows', !/127\.0\.0\.1:8189\/(tv|__tube)/.test(loader));

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
