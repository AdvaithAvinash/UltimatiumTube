// Answers YouTube reads with Response.json() go through JSON.parse, and so past every reader (the
// advert removal among them), as the answers it reads with JSON.parse always did.

import assert from 'assert';
import { check, finish } from '../harness.js';

class FakeResponse {
    constructor(text) { this.body = text; }
    text() { return Promise.resolve(this.body); }
    json() { return Promise.resolve(JSON.parse(this.body)); }
}
global.window = global.window || {};
window.Response = FakeResponse;
window.addEventListener = () => undefined;
window.JSON = JSON;
global.document = global.document || { addEventListener: () => undefined, querySelector: () => null };

const { onResponse, interceptJson } = await import('../../framework/index.js');

const seen = [];
onResponse('test adverts', ['adPlacements'], (r) => { seen.push(r.adPlacements.length); r.adPlacements = []; });
interceptJson();

const answer = await new FakeResponse('{"adPlacements":[1,2,3],"videoDetails":{}}').json();
check('a reader sees an answer read with Response.json()', () => assert.deepStrictEqual(seen, [3]));
check('and what it changes is what YouTube gets', () => assert.deepStrictEqual(answer.adPlacements, []));
const bad = await new FakeResponse('not json').json().then(() => 'parsed', () => 'failed');
check('a body that is not JSON still fails, as Response.json() does', () => assert.strictEqual(bad, 'failed'));

finish();
