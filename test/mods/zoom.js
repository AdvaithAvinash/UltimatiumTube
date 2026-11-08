import assert from 'assert';
import { check, withConfig, finish } from '../harness.js';

global.document = { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => undefined };
global.window = { innerWidth: 1920, innerHeight: 1080, addEventListener: () => undefined, localStorage: { getItem: () => null, setItem: () => undefined } };

const { apply, scaleFor, transformFor, fitOf } = await import('../../mods/player/zoom.js');

const video = (vw, vh, style, box) => ({
    videoWidth: vw, videoHeight: vh, offsetWidth: (box || [1920])[0], offsetHeight: (box || [1920, 1080])[1],
    style: Object.assign({}, style), getBoundingClientRect: () => ({ width: 0, height: 0, left: 0, top: 0 })
});

check('a fixed zoom scales the picture by that much, whatever its shape', () => {
    assert.deepStrictEqual(scaleFor('z133', 1280, 720, 1920, 1080), { x: 1.33, y: 1.33 });
    assert.deepStrictEqual(scaleFor('z133', 0, 0, 1920, 1080), { x: 1.33, y: 1.33 });
});

check('Zoom to fill scales a wide film up until it covers the box', () => {
    // 2.4:1 in 16:9 is drawn 1920x800; it must grow 1080/800 = 1.35 to cover the height.
    const s = scaleFor('fill', 1920, 800, 1920, 1080);
    assert.ok(Math.abs(s.x - 1.35) < 1e-9 && Math.abs(s.y - 1.35) < 1e-9);
});

check('Zoom to fill of a 16:9 video in a 16:9 box changes nothing (bars inside the picture need a fixed zoom)', () => {
    assert.deepStrictEqual(scaleFor('fill', 1280, 720, 1920, 1080), { x: 1, y: 1 });
});

check('Stretch scales only the short way', () => {
    const s = scaleFor('stretch', 1920, 800, 1920, 1080);
    assert.ok(Math.abs(s.x - 1) < 1e-9 && Math.abs(s.y - 1.35) < 1e-9);
});

check('an engine that does not say the video\'s shape still gets the fixed zooms', () => {
    assert.deepStrictEqual(scaleFor('fill', 0, 0, 1920, 1080), { x: 1, y: 1 });
    assert.deepStrictEqual(scaleFor('z150', 0, 0, 1920, 1080), { x: 1.5, y: 1.5 });
});

check('the transform is written plainly, and none for no change', () => {
    assert.strictEqual(transformFor({ x: 1.33, y: 1.33 }), 'scale(1.33, 1.33)');
    assert.strictEqual(transformFor({ x: 1, y: 1 }), 'none');
});

check('Original leaves the stock player alone', () => {
    withConfig({ videoFit: 'original' }, () => {
        const one = video(1920, 800);
        apply(one);
        assert.deepStrictEqual(one.style, {});
    });
});

check('a zoom writes a transform about the middle, and leaves the player\'s size and place alone', () => {
    withConfig({ videoFit: 'z133' }, () => {
        const one = video(1280, 720, { width: '1920px', height: '1080px', left: '0px', top: '0px' });
        apply(one);
        assert.strictEqual(one.style.transform, 'scale(1.33, 1.33)');
        assert.strictEqual(one.style.transformOrigin, '50% 50%');
        assert.deepStrictEqual([one.style.width, one.style.height, one.style.left, one.style.top], ['1920px', '1080px', '0px', '0px']);
    });
});

check('it works before the video says its shape', () => {
    withConfig({ videoFit: 'z115' }, () => {
        const one = video(0, 0);
        apply(one);
        assert.strictEqual(one.style.transform, 'scale(1.15, 1.15)');
    });
});

check('going back to Original puts back what the player had', () => {
    const one = video(1920, 800, { transform: 'translateZ(0px)' });
    withConfig({ videoFit: 'fill' }, () => apply(one));
    assert.ok(/scale/.test(one.style.transform));
    withConfig({ videoFit: 'original' }, () => apply(one));
    assert.strictEqual(one.style.transform, 'translateZ(0px)');
});

check('a box smaller than the screen (a preview) is fitted inside its own box', () => {
    withConfig({ videoFit: 'stretch' }, () => {
        const one = video(1920, 800, {}, [640, 360]);
        apply(one);
        assert.strictEqual(one.style.transform, 'scale(1, 1.35)');
    });
});

check('an unknown value counts as Original', () => {
    assert.strictEqual(fitOf((key) => ({ videoFit: 'sideways' })[key]), 'original');
});

finish();
