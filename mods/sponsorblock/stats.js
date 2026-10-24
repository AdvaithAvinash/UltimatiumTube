import { configRead, configWrite } from '../../framework/index.js';

const tenth = (value) => Math.round(value * 10) / 10;

// A jump that goes nowhere, or backwards, saves nothing and is not counted.
const recordSkip = (seconds) => {
    if (!(seconds > 0)) return;

    configWrite('sponsorBlockSkipCount', (configRead('sponsorBlockSkipCount') || 0) + 1);
    configWrite('sponsorBlockSavedSeconds', tenth((configRead('sponsorBlockSavedSeconds') || 0) + seconds));
};

const reset = () => {
    configWrite('sponsorBlockSkipCount', 0);
    configWrite('sponsorBlockSavedSeconds', 0);
};

const worded = (seconds) => {
    const total = Math.round(seconds);
    if (total < 60) return `${total} s`;

    const minutes = Math.floor(total / 60);
    if (minutes < 60) return `${minutes} min`;

    const hours = Math.floor(minutes / 60);
    return `${hours} h ${minutes % 60} min`;
};

const summary = () => {
    const count = configRead('sponsorBlockSkipCount') || 0;
    if (!count) return 'Nothing skipped yet';

    return `${worded(configRead('sponsorBlockSavedSeconds') || 0)} saved, ${count} ${count === 1 ? 'skip' : 'skips'}`;
};

export { recordSkip, reset, summary, worded };
