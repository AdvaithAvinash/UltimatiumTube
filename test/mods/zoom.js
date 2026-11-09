import assert from 'assert';
import { check, withConfig, finish } from '../harness.js';

global.document = { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => undefined };
global.window = { innerWidth: 1920, innerHeight: 1080, addEventListener: () => undefined, localStorage: { getItem: () => null, setItem: () => undefined } };

const { apply, planFor, transformFor, fitOf } = await import('../../mods/player/zoom.js');

const video = (vw, vh, style, box) => ({
    videoWidth: vw, videoHeight: vh, offsetWidth: (box || [1920])[0], offsetHeight: (box || [1920, 1080])[1],
    style: Object.assign({}, style), getBoundingClientRect: () => ({ width: 0, height: 0, left: 0, top: 0 })
});

const SCREEN = { w: 1920, h: 1080 };
const full = { x: 0, y: 0, w: 1920, h: 1080 };
const band = { x: 0, y: 140, w: 1920, h: 800 };
const near = (a, b) => Math.abs(a - b) < 0.6;
// Where the plan puts the picture: its rect on the screen.
const lands = (plan, vw, vh, box) => {
    const inBox = Math.min(box.w / vw, box.h / vh);
    const cw = vw * inBox;
    const ch = vh * inBox;
    const ox = (box.w - cw) / 2;
    const oy = (box.h - ch) / 2;
    return { x: box.x + plan.tx + plan.sx * ox, y: box.y + plan.ty + plan.sy * oy, w: cw * plan.sx, h: ch * plan.sy };
};

check('Zoom to fill covers the screen when the player\'s box is the whole screen', () => {
    const r = lands(planFor('fill', 1920, 800, full, SCREEN), 1920, 800, full);
    assert.ok(near(r.h, 1080) && r.w >= 1920 && near(r.x + r.w / 2, 960) && near(r.y, 0), JSON.stringify(r));
});

check('and when the player\'s box is only the picture (a band across the middle): the case that did nothing before', () => {
    const r = lands(planFor('fill', 1920, 800, band, SCREEN), 1920, 800, band);
    assert.ok(near(r.h, 1080) && near(r.y, 0) && r.w >= 1920 && near(r.x + r.w / 2, 960), JSON.stringify(r));
});

check('Stretch fills exactly the screen from either box', () => {
    [full, band].forEach((box) => {
        const r = lands(planFor('stretch', 1920, 800, box, SCREEN), 1920, 800, box);
        assert.ok(near(r.x, 0) && near(r.y, 0) && near(r.w, 1920) && near(r.h, 1080), JSON.stringify(r));
    });
});

check('a fixed zoom enlarges the picture as it fits the screen, about the middle of the screen', () => {
    const r = lands(planFor('z133', 1280, 720, full, SCREEN), 1280, 720, full);
    assert.ok(near(r.w, 1920 * 1.33) && near(r.h, 1080 * 1.33) && near(r.x + r.w / 2, 960) && near(r.y + r.h / 2, 540), JSON.stringify(r));
});

check('Zoom to fill of a 16:9 video in a 16:9 box changes nothing (bars inside the picture need a fixed zoom)', () => {
    assert.strictEqual(planFor('fill', 1280, 720, full, SCREEN), null);
});

check('an engine that does not say the video\'s shape takes the box\'s shape', () => {
    const r = lands(planFor('fill', 0, 0, band, SCREEN), 1920, 800, band);
    assert.ok(near(r.h, 1080), JSON.stringify(r));
});

check('the transform is written plainly, and none for no change', () => {
    assert.strictEqual(transformFor({ tx: -10.4, ty: 3.6, sx: 1.33, sy: 1.33 }), 'translate(-10px, 4px) scale(1.33, 1.33)');
    assert.strictEqual(transformFor(null), 'none');
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
        assert.ok(/scale\(1\.33, 1\.33\)/.test(one.style.transform), one.style.transform);
        assert.strictEqual(one.style.transformOrigin, '0px 0px');
        assert.deepStrictEqual([one.style.width, one.style.height, one.style.left, one.style.top], ['1920px', '1080px', '0px', '0px']);
    });
});

check('it works before the video says its shape', () => {
    withConfig({ videoFit: 'z115' }, () => {
        const one = video(0, 0);
        apply(one);
        assert.ok(/scale\(1\.15, 1\.15\)/.test(one.style.transform), one.style.transform);
    });
});

check('going back to Original puts back what the player had', () => {
    const one = video(1920, 800, { transform: 'translateZ(0px)' });
    withConfig({ videoFit: 'fill' }, () => apply(one));
    assert.ok(/scale/.test(one.style.transform));
    withConfig({ videoFit: 'original' }, () => apply(one));
    assert.strictEqual(one.style.transform, 'translateZ(0px)');
});

check('a small player (a preview on a shelf, the mini player) is left alone', () => {
    withConfig({ videoFit: 'stretch' }, () => {
        const one = video(1920, 800, {}, [640, 360]);
        apply(one);
        assert.strictEqual(one.style.transform, 'none');
    });
});

check('an unknown value counts as Original', () => {
    assert.strictEqual(fitOf((key) => ({ videoFit: 'sideways' })[key]), 'original');
});

finish();
