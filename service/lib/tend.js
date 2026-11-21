'use strict';

// What the service looks after on a timer, so that nothing it needs to work is left to a reinstall:
//  - that it is listening (see listener.js);
//  - the boot page the container opens, which is written once at start: if writing it failed, it is
//    written again, and if this set's address has changed since, it is written with the new one.

const create = (options) => {
    const { listener, cobalt, serviceAddress, note, every, moved } = options;

    const held = { address: null, ticks: 0 };

    // A failed preparation is tried again about once in this many looks, not on each of them: it
    // writes to the log every time.
    const RETRY_EVERY = every || 3;

    // A new address: connections made from the old one are let go, and the boot page names the new one.
    const follow = () => {
        const address = serviceAddress();
        const was = held.address;
        held.address = address;

        if (!was || was === address) return;

        note('address', `this set's address is now ${address}, it was ${was}`);

        try {
            if (moved) moved(was, address);
        } catch (error) {
            note('address', error);
        }

        if (!cobalt) return;
        note('cobalt', 'the boot page is written again');
        cobalt.refresh();
    };

    const tend = () => {
        held.ticks += 1;

        try {
            listener.check();
        } catch (error) {
            note('listen', error);
        }

        try {
            follow();
        } catch (error) {
            note('cobalt', error);
        }

        if (!cobalt) return;

        try {
            const status = cobalt.status();

            if (status.failed && held.ticks % RETRY_EVERY === 0) cobalt.prepare();
        } catch (error) {
            note('cobalt', error);
        }
    };

    return { tend };
};

module.exports = { create };
