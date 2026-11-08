'use strict';

const postmortem = require('./postmortem.js');

const ENDING = /^\S+ {2}((?:uncaught|exit|unhandled rejection|route): .*)$/;
const MOST = 5;

const endings = () => {
    const lines = postmortem.read().split('\n');
    const started = lines.map((line) => / {2}started: /.test(line)).lastIndexOf(true);

    return lines.slice(started + 1)
        .map((line) => ENDING.exec(line))
        .filter(Boolean)
        .map((match) => match[1])
        .slice(-MOST);
};

// When the service has started lately, from the log's own "started:" lines. A service the TV keeps
// ending and starting again answers for a few seconds at a time, which is enough for the boot screen
// to hand over and too little for the container to load YouTube.
const STARTED = /^(\S+) {2}started: /;
const RECENT = 10 * 60 * 1000;

const starts = (now) => postmortem.read().split('\n')
    .map((line) => STARTED.exec(line))
    .filter(Boolean)
    .map((match) => Date.parse(match[1]))
    .filter((at) => at > 0 && (now || Date.now()) - at < RECENT);

// Before this run notes anything.
const recall = () => endings().forEach((text) => postmortem.remember('previous', text));

module.exports = { recall, starts, RECENT };
