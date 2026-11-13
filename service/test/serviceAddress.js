'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Where the address the page was last sent to is written down.
const SHARE = fs.mkdtempSync(path.join(os.tmpdir(), 'tube-address-'));
process.env.TUBE_SHARE = SHARE;

const results = [];

const check = (label, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  <- ${detail}`}`);
    results.push(!!ok);
};

const held = {
    now: 1000000,
    read: 0,
    interfaces: {
        lo: [{ address: '127.0.0.1', internal: true, family: 'IPv4' }],
        eth0: [
            { address: '192.168.1.29', internal: false, family: 'IPv4' },
            { address: 'fe80::1', internal: false, family: 'IPv6' }
        ]
    }
};

// The clock is ours, so the memo can be stepped over rather than waited out.
Date.now = () => held.now;

os.networkInterfaces = () => {
    held.read += 1;
    return held.interfaces;
};

const later = () => { held.now += 6000; };

const { lanAddresses, serviceAddress } = require('../lib/serviceAddress.js');

check('only this set\'s own IPv4 addresses are offered', lanAddresses().join() === '192.168.1.29',
    lanAddresses().join());

check('the page is sent to one of them', serviceAddress() === '192.168.1.29', serviceAddress());

const before = held.read;
Array.from({ length: 50 }).forEach(serviceAddress);

check('asking again within a few seconds does not read the interfaces again', held.read === before,
    `${held.read - before} extra reads`);

// node 18.0 to 18.3 give the family as a number rather than a string.
held.interfaces = { eth0: [{ address: '10.0.0.5', internal: false, family: 4 }] };
later();

check('a numbered family is read the same as a named one', serviceAddress() === '10.0.0.5', serviceAddress());

held.interfaces = { eth0: [{ address: '10.0.0.77', internal: false, family: 4 }] };
later();

check('a changed address is followed rather than remembered', serviceAddress() === '10.0.0.77',
    serviceAddress());

held.interfaces = {
    wan0: [{ address: '100.72.3.9', internal: false, family: 'IPv4' }],
    eth0: [{ address: '192.168.1.40', internal: false, family: 'IPv4' }],
    wlan0: [{ address: '172.20.0.8', internal: false, family: 'IPv4' }]
};
later();

check('a private address is offered before one the container would refuse', lanAddresses().join() === '192.168.1.40,172.20.0.8,100.72.3.9',
    lanAddresses().join());
check('and is the one the page is sent to', serviceAddress() === '192.168.1.40', serviceAddress());

held.interfaces = { lo: [{ address: '127.0.0.1', internal: true, family: 'IPv4' }] };
later();

check('off a television, with no address of its own, loopback is used',
    serviceAddress() === '127.0.0.1', serviceAddress());

// A set on both cable and Wi-Fi: the order its interfaces are listed in is not promised.
held.interfaces = {
    eth0: [{ address: '192.168.1.50', internal: false, family: 'IPv4' }],
    wlan0: [{ address: '192.168.1.51', internal: false, family: 'IPv4' }]
};
later();
check('with two private addresses the first is chosen', serviceAddress() === '192.168.1.50', serviceAddress());
check('and written down', fs.readFileSync(path.join(SHARE, 'address'), 'utf8') === '192.168.1.50',
    fs.readFileSync(path.join(SHARE, 'address'), 'utf8'));

held.interfaces = {
    wlan0: [{ address: '192.168.1.51', internal: false, family: 'IPv4' }],
    eth0: [{ address: '192.168.1.50', internal: false, family: 'IPv4' }]
};
later();
check('listed the other way round, the page stays at the address it was at (its sign-in is kept there)',
    serviceAddress() === '192.168.1.50', serviceAddress());
check('the other address is still offered', lanAddresses().join() === '192.168.1.50,192.168.1.51', lanAddresses().join());

// A restart of the service: the memo and the module are new, the written address is not.
delete require.cache[require.resolve('../lib/serviceAddress.js')];
const again = require('../lib/serviceAddress.js');
later();
check('after a restart the written address is kept too', again.serviceAddress() === '192.168.1.50', again.serviceAddress());

held.interfaces = { wlan0: [{ address: '192.168.1.51', internal: false, family: 'IPv4' }] };
later();
check('an address the set no longer has is let go', again.serviceAddress() === '192.168.1.51', again.serviceAddress());
check('and the new one written down', fs.readFileSync(path.join(SHARE, 'address'), 'utf8') === '192.168.1.51',
    fs.readFileSync(path.join(SHARE, 'address'), 'utf8'));

held.interfaces = { eth0: [{ address: '192.168.1.50', internal: false, family: 'IPv4' }], wlan0: [{ address: '192.168.1.51', internal: false, family: 'IPv4' }] };
later();
check('and kept when the cable comes back', again.serviceAddress() === '192.168.1.51', again.serviceAddress());

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
