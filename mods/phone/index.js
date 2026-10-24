import { configAccepts, configSnapshot, configWrite, every } from '../../framework/index.js';

// The TV's own settings page is a remote control away from awkward; the phone page is the same
// settings with a keyboard. The two meet in the service: this side posts what it holds and takes
// back whatever the phone changed since.

const ROUTE = '/__tube/phone/sync';
const EVERY = 4000;

// A service that is not there (the stock engine, a browser) is asked far less often.
const GIVE_UP_AFTER = 3;
const RETRY_EVERY = 15;

const state = { seq: 0, address: '', schema: null, needSchema: true, failures: 0, ticks: 0 };

const phoneAddress = () => state.address;

const provideSchema = (describe) => {
    state.schema = describe;
};

const apply = (changes) => changes.forEach((change) => {
    if (configAccepts(change.key, change.value)) configWrite(change.key, change.value);
});

const body = () => {
    const sent = { seq: state.seq, config: configSnapshot() };
    if (state.needSchema && state.schema) sent.schema = state.schema();

    return JSON.stringify(sent);
};

// The Android app answers in-process; a Samsung TV answers over the container's proxy.
const nativeBridge = () => {
    const bridge = window.UltimatiumNative;
    return bridge && typeof bridge.phoneSync === 'function' ? bridge : null;
};

const exchange = (text) => {
    const bridge = nativeBridge();
    if (bridge) return new Promise((resolve) => resolve(JSON.parse(bridge.phoneSync(text))));

    return fetch(ROUTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tube': '1' },
        body: text
    }).then((response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        return response.json();
    });
};

const sync = () => exchange(body())
    .then((answer) => {
        state.failures = 0;
        state.needSchema = !!answer.needSchema;
        state.seq = answer.seq;
        state.address = answer.address || '';

        apply(answer.changes || []);
    })
    .catch(() => {
        state.failures += 1;
    });

const tick = () => {
    state.ticks += 1;

    if (state.failures >= GIVE_UP_AFTER && state.ticks % RETRY_EVERY !== 0) return;
    sync();
};

const start = () => {
    every('phone sync', EVERY, tick);
};

export { phoneAddress, provideSchema, start, apply };
