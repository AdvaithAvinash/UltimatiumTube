import assert from 'assert';
import { check, withConfig, finish } from '../harness.js';

global.document = { querySelector: () => null, addEventListener: () => undefined };
global.window = { innerWidth: 1920, innerHeight: 1080, addEventListener: () => undefined, localStorage: { getItem: () => null, setItem: () => undefined } };

const { apply, boxFor, fitOf } = await import('../../mods/player/zoom.js');

const video = (vw, vh, style) => ({ videoWidth: vw, videoHeight: vh, style: Object.assign({}, style) });
const px = (v) => parseFloat(v);

check('Zoom makes the picture cover the screen: a wide film gets a box wider than the screen', () => {
    // 2.4:1 on 16:9: the picture must be as tall as the screen, so the box is 2592 wide, centred.
    const box = boxFor('fill', 1920, 800, 1920, 1080);
    assert.deepStrictEqual([box.width, box.height, box.left, box.top], [2592, 1080, -336, 0]);
    assert.strictEqual(box.scaleX, 1);
});

check('Zoom of a tall picture gets a box taller than the screen', () => {
    const box = boxFor('fill', 1440, 1080, 1920, 1080);
    assert.deepStrictEqual([box.width, box.height, box.top], [1920, 1440, -180]);
});

check('a picture already the screen\'s shape is left the same size', () => {
    const box = boxFor('fill', 1280, 720, 1920, 1080);
    assert.deepStrictEqual([box.width, box.height, box.left, box.top], [1920, 1080, 0, 0]);
});

check('Stretch makes the box the screen and scales the picture in it up to the screen', () => {
    const box = boxFor('stretch', 1920, 800, 1920, 1080);
    assert.deepStrictEqual([box.width, box.height, box.left, box.top], [1920, 1080, 0, 0]);
    // The engine keeps the picture whole in the box: 1920 x 800. It must grow 1080/800 down, 1 across.
    assert.ok(Math.abs(box.scaleX - 1) < 1e-9);
    assert.ok(Math.abs(box.scaleY - 1.35) < 1e-9);
});

check('Original leaves the stock player alone', () => {
    withConfig({ videoFit: 'original' }, () => {
        const one = video(1920, 800);
        apply(one);
        assert.deepStrictEqual(one.style, {});
    });
});

check('Zoom writes the box onto the video element', () => {
    withConfig({ videoFit: 'fill' }, () => {
        const one = video(1920, 800, { width: '1920px', height: '800px' });
        apply(one);
        assert.strictEqual(one.style.position, 'fixed');
        assert.strictEqual(px(one.style.width), 2592);
        assert.strictEqual(px(one.style.height), 1080);
        assert.strictEqual(px(one.style.left), -336);
        assert.strictEqual(one.style.transform, 'none');
    });
});

check('Stretch writes a scale', () => {
    withConfig({ videoFit: 'stretch' }, () => {
        const one = video(1920, 800);
        apply(one);
        assert.strictEqual(one.style.transform, 'scale(1, 1.35)');
        assert.strictEqual(px(one.style.width), 1920);
    });
});

check('nothing is done before the video has said its shape', () => {
    withConfig({ videoFit: 'fill' }, () => {
        const one = video(0, 0);
        apply(one);
        assert.deepStrictEqual(one.style, {});
    });
});

check('it is written again when the player has put its own size back, and Original restores it all', () => {
    const one = video(1920, 800, { width: '1920px', height: '800px', left: '0px' });
    withConfig({ videoFit: 'fill' }, () => {
        apply(one);
        one.style.width = '1920px';
        apply(one);
        assert.strictEqual(px(one.style.width), 2592);
    });
    withConfig({ videoFit: 'original' }, () => apply(one));
    assert.strictEqual(one.style.width, '1920px');
    assert.strictEqual(one.style.height, '800px');
    assert.strictEqual(one.style.position, '');
});

check('the screen\'s size is read when it is applied', () => {
    global.window.innerWidth = 1280;
    global.window.innerHeight = 720;
    withConfig({ videoFit: 'fill' }, () => {
        const one = video(1920, 800);
        apply(one);
        assert.strictEqual(px(one.style.height), 720);
        assert.strictEqual(px(one.style.width), 1728);
    });
    global.window.innerWidth = 1920;
    global.window.innerHeight = 1080;
});

check('an unknown value counts as Original', () => {
    assert.strictEqual(fitOf((key) => ({ videoFit: 'sideways' })[key]), 'original');
});

finish();
