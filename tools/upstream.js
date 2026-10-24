'use strict';

// UltimatiumTube began as a copy of YouTube for Tizen. YouTube changes without notice and that
// project fixes what breaks, so this lists what it has done since the commit this one last took
// from it. Nothing is merged for you: each change is read and brought over by hand, because the
// two have diverged (settings, SponsorBlock, ports) and a blind merge would undo that.

const ui = require('./lib/report.js');

const UPSTREAM = 'SushyDev/tizen-youtube';
// Move this forward after bringing changes over; docs/UPSTREAM.md says how.
const BASE = '02c4d8b4bacfa6f0f0efb518fbb588d6fcd60e0e';

const api = (path) => fetch(`https://api.github.com/repos/${UPSTREAM}/${path}`, {
    headers: Object.assign({ accept: 'application/vnd.github+json', 'user-agent': 'ultimatiumtube-upstream' },
        process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
}).then((res) => {
    if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${path}`);
    return res.json();
});

const line = (commit) => `- [\`${commit.sha.slice(0, 7)}\`](${commit.html_url}) ${commit.commit.message.split('\n')[0]}`;

const report = (compare) => {
    if (!compare.ahead_by) return `Nothing new upstream since \`${BASE.slice(0, 7)}\`.\n`;

    const files = (compare.files || []).map((file) => `- \`${file.filename}\` (${file.status})`);

    return [
        `${UPSTREAM} has **${compare.ahead_by}** commit${compare.ahead_by === 1 ? '' : 's'} since \`${BASE.slice(0, 7)}\`.`,
        '',
        '### Commits',
        ...compare.commits.slice(-50).map(line),
        '',
        `### Files changed (${files.length})`,
        ...files.slice(0, 80),
        '',
        `Diff: https://github.com/${UPSTREAM}/compare/${BASE.slice(0, 7)}...main`,
        ''
    ].join('\n');
};

api(`compare/${BASE}...main`)
    .then((compare) => process.stdout.write(report(compare)))
    .catch((err) => ui.crash(err));
