import assert from 'assert';
import { check, withConfig, finish } from '../harness.js';

global.document = { querySelector: () => null, addEventListener: () => undefined };

const { apply, fitOf } = await import('../../mods/player/zoom.js');

const video = () => ({ style: { objectFit: '' } });

check('Original leaves the stock player alone', () => {
    withConfig({ videoFit: 'original' }, () => {
        const one = video();
        apply(one);
        assert.strictEqual(one.style.objectFit, '');
    });
});

check('Zoom to fill covers the screen and Stretch fills it', () => {
    withConfig({ videoFit: 'fill' }, () => { const a = video(); apply(a); assert.strictEqual(a.style.objectFit, 'cover'); });
    withConfig({ videoFit: 'stretch' }, () => { const b = video(); apply(b); assert.strictEqual(b.style.objectFit, 'fill'); });
});

check('going back to Original removes the fit again', () => {
    const one = video();
    withConfig({ videoFit: 'fill' }, () => apply(one));
    withConfig({ videoFit: 'original' }, () => apply(one));
    assert.strictEqual(one.style.objectFit, '');
});

check('an unknown value counts as Original', () => {
    withConfig({ videoFit: 'sideways' }, () => assert.strictEqual(fitOf((key) => ({ videoFit: 'sideways' })[key]), 'original'));
});

finish();
