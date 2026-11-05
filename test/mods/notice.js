import assert from 'assert';
import { check, withConfig, finish } from '../harness.js';

global.document = { querySelector: () => null, addEventListener: () => undefined };

const { NOTICE } = await import('../../mods/notice/index.js');
const { configRead, configDefaults } = await import('../../framework/runtime/config.js');

check('the notice has not been seen on a fresh install', () => {
    assert.strictEqual(configDefaults().noticeSeen, '');
    assert.notStrictEqual(configRead('noticeSeen'), NOTICE);
});

check('a seen notice is remembered by its version', () => {
    withConfig({ noticeSeen: NOTICE }, () => assert.strictEqual(configRead('noticeSeen'), NOTICE));
});

finish();
