'use strict';

// Which address of this set the container is sent to; never its hostname, which the container
// cannot resolve even on a set where the service can.

const fs = require('fs');
const os = require('os');
const path = require('path');

// Held briefly: asked once per request and again per match in the page rewrites, but a new lease
// still has to be followed.
const FRESH_FOR = 5000;

const held = { at: 0, addresses: null };

// node 18.0 to 18.3 name the family 4.
const readAddresses = () => {
    const interfaces = os.networkInterfaces();

    return Object.keys(interfaces).reduce((all, device) => all.concat(interfaces[device]
        .filter((entry) => !entry.internal && (entry.family === 'IPv4' || entry.family === 4))
        .map((entry) => entry.address)), []);
};

// The container opens the app at this address over plain HTTP, which it allows only to a private
// range. A set with more than one interface may list a public or carrier-style address first, so
// the private ones come first; the rest follow in case nothing else answers.
const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

const privateFirst = (addresses) => addresses.filter((address) => PRIVATE.test(address))
    .concat(addresses.filter((address) => !PRIVATE.test(address)));

// The page the container opens lives at this address, and everything the page keeps (YouTube's
// sign-in among it) is kept under that address. A set on both cable and Wi-Fi may list its
// interfaces in a different order after a restart, which would send the page to the other address
// and leave all of that behind: signed out, settings gone. So the address the page was last sent to
// is written down and kept for as long as the set still has it.
const REMEMBERED = () => path.join(process.env.TUBE_SHARE || '/home/owner/share/ultimatiumtube', 'address');

const remembered = { read: false, address: null };

const recall = () => {
    if (!remembered.read) {
        remembered.read = true;
        try {
            remembered.address = fs.readFileSync(REMEMBERED(), 'utf8').trim() || null;
        } catch (error) {
            remembered.address = null;
        }
    }

    return remembered.address;
};

const remember = (address) => {
    if (!address || address === recall()) return;

    remembered.address = address;
    try {
        fs.writeFileSync(REMEMBERED(), address);
    } catch (error) {
        // Held for this run all the same.
    }
};

const stickTo = (addresses) => {
    const last = recall();

    if (last && PRIVATE.test(last) && addresses.indexOf(last) > 0) {
        return [last].concat(addresses.filter((address) => address !== last));
    }

    if (addresses[0] && PRIVATE.test(addresses[0])) remember(addresses[0]);
    return addresses;
};

const lanAddresses = () => {
    const now = Date.now();

    if (held.addresses && now - held.at < FRESH_FOR) return held.addresses;

    held.at = now;
    held.addresses = stickTo(privateFirst(readAddresses()));

    return held.addresses;
};

// Loopback only off a television, where nothing else is listening.
const serviceAddress = () => lanAddresses()[0] || '127.0.0.1';

module.exports = { lanAddresses, serviceAddress };
