import assert from 'assert';
import { check, withConfig, finish } from '../harness.js';

global.document = { querySelector: () => null, addEventListener: () => undefined };

const { apply, fitOf } = await import('../../mods/player/zoom.js');

const styled = () => {
    const values = {};
    const css = (name) => name.replace(/-([a-z])/g, (all, c) => c.toUpperCase());
    return new Proxy({ setProperty: (name, value) => { values[css(name)] = value; } }, {
        get: (t, key) => (key in t ? t[key] : values[key] || ''),
        set: (t, key, value) => { values[key] = value; return true; }
    });
};
const video = () => ({ style: styled() });

check('Original leaves the stock player alone', () => {
    withConfig({ videoFit: 'original' }, () => {
        const one = video();
        apply(one);
        assert.strictEqual(one.style.objectFit, '');
        assert.strictEqual(one.style.width, '');
    });
});

check('Zoom to fill makes the video the whole screen, not the picture inside the bars', () => {
    withConfig({ videoFit: 'fill' }, () => {
        const one = video();
        one.style.width = '1280px';
        apply(one);
        assert.strictEqual(one.style.width, '100vw');
        assert.strictEqual(one.style.height, '100vh');
        assert.strictEqual(one.style.position, 'fixed');
    });
    const two = video();
    two.style.width = '1280px';
    withConfig({ videoFit: 'fill' }, () => apply(two));
    withConfig({ videoFit: 'original' }, () => apply(two));
    assert.strictEqual(two.style.width, '1280px');
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
