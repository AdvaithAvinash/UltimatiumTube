'use strict';

// Keeps the service listening. It listens once, on this set's own address, and until now never looked
// again: an address that changed (standby, the router giving another lease, Wi-Fi coming back), a
// server that closed, or a port that was busy for a while all left a service that was running and
// answering nobody, until the TV was reinstalled to. This keeps trying, and looks every so often.

const create = (options) => {
    const { app, port, bind, addresses, note, noteRarely, setup, retryAfter, checkEvery, busy } = options;

    // What is listening now, and whether a try is under way.
    const current = { server: null, address: null, attempting: false, yielded: false };

    // Asked of whoever holds the port at most this many times in a row, and again only after a
    // success, so two instances cannot ask each other for ever.
    const asked = { count: 0 };
    const MOST_ASKS = 3;

    const listen = (found, index) => {
        if (current.yielded) return;

        const address = found[index];
        const serving = { yes: false };

        current.attempting = true;

        const server = app.listen(port, address, () => {
            serving.yes = true;
            current.server = server;
            current.address = address;
            current.attempting = false;

            asked.count = 0;
            note('listening', `${address}:${port}`);
            if (options.listening) options.listening(address);
        });

        if (setup) setup(server);

        // A later error once the port is ours would otherwise start a second server beside the one
        // already answering.
        server.on('error', (error) => {
            // Both widgets carry a service and install side by side.
            const why = error.code === 'EADDRINUSE'
                ? 'something already holds that port — the other Tube widget, or an older build of this '
                    + 'one, is the usual cause; only one of the two can serve the container'
                : String(error && error.message);

            noteRarely('listen', `${address}:${port} — ${why}`);
            if (serving.yes) return undefined;

            // Another instance of this service: it is asked to give the port up before anything else is tried.
            if (error.code === 'EADDRINUSE' && busy && asked.count < MOST_ASKS && !current.yielded) {
                asked.count += 1;
                return busy(address, (agreed) => setTimeout(() => listen(found, index), agreed ? 700 : 100));
            }

            const next = index + 1;
            if (next < found.length) return listen(found, next);

            // Exiting would only leave nothing answering; trying again may find it free.
            return setTimeout(() => listen(addresses(), 0), retryAfter);
        });

        // Closed from outside, or by the system: listen again, rather than stay deaf.
        server.on('close', () => {
            if (current.server !== server || current.yielded) return;

            current.server = null;
            current.address = null;
            noteRarely('listen', `${address}:${port} closed; listening again`);

            setTimeout(() => {
                if (!current.server && !current.attempting) listen(addresses(), 0);
            }, retryAfter);
        });
    };

    // Is what is listening still any use: still open, and, if it chose one address of the set, that
    // address still the set's.
    const check = () => {
        if (current.attempting || current.yielded) return;

        const server = current.server;
        if (!server) {
            listen(addresses(), 0);
            return;
        }

        const gone = !server.address()
            || (current.address !== bind && addresses().indexOf(current.address) === -1);
        if (!gone) return;

        noteRarely('listen', `${current.address}:${port} no longer answers; listening again`);

        current.server = null;
        current.address = null;

        try {
            server.close();
        } catch (error) {
            // Closing a server that is already gone says so; that is what was being found out.
        }

        listen(addresses(), 0);
    };

    // Gives the port to a newer instance, and does not listen again: the one that asked has it now.
    const yieldPort = () => {
        current.yielded = true;

        const server = current.server;
        current.server = null;
        current.address = null;

        try {
            if (server) server.close();
        } catch (error) {
            // Already closed.
        }

        // Kept alive, idle: a process that ended would be started again by the platform, and would
        // then ask for the port back.
        if (!current.hold) current.hold = setInterval(() => undefined, 3600000);
    };

    // With a `checkEvery`, it looks by itself, as well as when something else asks it to.
    const start = () => {
        listen(addresses(), 0);

        if (!checkEvery) return null;

        const timer = setInterval(check, checkEvery);
        // Never what keeps a process alive, in a test or anywhere.
        if (timer && timer.unref) timer.unref();

        return timer;
    };

    return { start, check, current, yieldPort };
};

module.exports = { create };
