'use strict';

// What the service looks after on a timer, so that nothing it needs to work is left to a reinstall:
//  - that it is listening (see listener.js);
//  - the boot page the container opens, which is written once at start: if writing it failed, it is
//    written again, and if this set's address has changed since, it is written with the new one.

const create = (options) => {
    const { listener, cobalt, serviceAddress, note, every } = options;

    const held = { address: null, ticks: 0 };

    // A failed preparation is tried again about once in this many looks, not on each of them: it
    // writes to the log every time.
    const RETRY_EVERY = every || 3;

    const tend = () => {
        held.ticks += 1;

        try {
            listener.check();
        } catch (error) {
            note('listen', error);
        }

        if (!cobalt) return;

        try {
            const status = cobalt.status();

            if (status.failed && held.ticks % RETRY_EVERY === 0) cobalt.prepare();

            const address = serviceAddress();

            if (held.address && held.address !== address) {
                note('cobalt', `this set's address is now ${address}, it was ${held.address}; the boot page is written again`);
                cobalt.refresh();
            }

            held.address = address;
        } catch (error) {
            note('cobalt', error);
        }
    };

    return { tend };
};

module.exports = { create };
