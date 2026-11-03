'use strict';

const { create } = require('../lib/tend.js');

const results = [];

const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

const fakes = (overrides) => {
    const calls = { check: 0, prepare: 0, refresh: 0, notes: [] };
    const world = Object.assign({ failed: null, address: '192.168.1.5', listenerThrows: false, statusThrows: false }, overrides);

    const tender = create({
        listener: { check: () => { calls.check += 1; if (world.listenerThrows) throw new Error('listener broke'); } },
        cobalt: overrides && overrides.noCobalt ? null : {
            status: () => { if (world.statusThrows) throw new Error('status broke'); return { failed: world.failed }; },
            prepare: () => { calls.prepare += 1; },
            refresh: () => { calls.refresh += 1; }
        },
        serviceAddress: () => world.address,
        note: (what, text) => calls.notes.push(`${what}: ${text instanceof Error ? text.message : text}`)
    });

    return { tender, calls, world };
};

const times = (n, run) => Array.from({ length: n }).forEach(run);

{
    const { tender, calls } = fakes();
    times(4, tender.tend);
    check('the listener is looked at on every tend', calls.check === 4);
    check('a preparation that has not failed is left alone', calls.prepare === 0);
}

{
    const { tender, calls } = fakes({ failed: 'EACCES' });
    times(9, tender.tend);
    check('a failed preparation is tried again, but only about one look in three', calls.prepare === 3, String(calls.prepare));
}

{
    const { tender, calls, world } = fakes();
    tender.tend();
    check('the first look only takes note of the address', calls.refresh === 0);

    tender.tend();
    check('the same address changes nothing', calls.refresh === 0);

    world.address = '192.168.1.77';
    tender.tend();
    check('a new address has the boot page written again', calls.refresh === 1);
    check('and says so', calls.notes.some((n) => n.indexOf('192.168.1.77') !== -1 && n.indexOf('192.168.1.5') !== -1), calls.notes.join('|'));

    tender.tend();
    check('once, not on every look after', calls.refresh === 1);
}

{
    const { tender, calls } = fakes({ listenerThrows: true });
    tender.tend();
    check('a listener that breaks is noted, and the rest is still looked after', calls.notes.some((n) => n === 'listen: listener broke') && calls.check === 1);
}

{
    const { tender, calls } = fakes({ statusThrows: true });
    tender.tend();
    check('a boot page that cannot be looked at is noted, not thrown', calls.notes.some((n) => n === 'cobalt: status broke'));
}

{
    const { tender, calls } = fakes({ noCobalt: true });
    tender.tend();
    check('with no container route there is only the listener to look after', calls.check === 1 && calls.notes.length === 0);
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
