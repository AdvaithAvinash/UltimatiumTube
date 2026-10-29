'use strict';

// Brings the bundled Aniultimatium web app up to date: copies public/ from the Aniultimatium repo
// (branch main) into aniultimatium/, leaving out what only the website needs, and records the
// commit it copied in aniultimatium/VERSION.txt. The copy is never edited here; if something has
// to change, it changes in the Aniultimatium repo and comes back through this script.
//
//   node tools/update_aniultimatium.js                 clones the repo into a temporary folder
//   node tools/update_aniultimatium.js <path-to-clone> uses a clone you already have

const { execFileSync } = require('child_process');
const {
    cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync
} = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const ui = require('./lib/report.js');
const { ROOT } = require('./lib/config.js');

const REPO = 'https://github.com/AdvaithAvinash/AniUltimatium';
const BUNDLE = join(ROOT, 'aniultimatium');

// The website-only files of Aniultimatium's own build_wgt.py and build_apk.py, plus its service
// worker and its Samsung manifest: this app has its own.
const WEB_ONLY = [
    'robots.txt', 'sitemap.xml', 'llms.txt', 'og.png', 'link.html', 'about.html', 'add.html',
    'adframe.html', 'vastrelay.html', 'sw.js', 'config.xml'
];

const skipped = (name) => WEB_ONLY.indexOf(name) !== -1 || name.indexOf('_t.') === 0;

const friendly = (message) => Object.assign(new Error(message), { isFriendly: true });

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const source = () => {
    if (process.argv[2]) return { path: process.argv[2], temporary: false };

    const path = join(mkdtempSync(join(tmpdir(), 'aniultimatium-')), 'repo');
    execFileSync('git', ['clone', '--depth', '1', '--branch', 'main', REPO, path], { stdio: 'inherit' });

    return { path, temporary: true };
};

const filesIn = (directory) => readdirSync(directory, { withFileTypes: true }).reduce((all, entry) => (
    entry.isDirectory() ? all.concat(filesIn(join(directory, entry.name)).map((name) => join(entry.name, name)))
        : all.concat(entry.name)
), []);

function main() {
    const from = source();

    try {
        const pub = join(from.path, 'public');
        if (!existsSync(join(pub, 'index.html'))) throw friendly(`${pub} has no index.html: not an Aniultimatium clone.`);

        const commit = git(['rev-parse', 'HEAD'], from.path);

        rmSync(BUNDLE, { recursive: true, force: true });
        mkdirSync(BUNDLE, { recursive: true });

        const copied = filesIn(pub).filter((name) => !skipped(name.split(/[\\/]/).pop()));
        copied.forEach((name) => {
            mkdirSync(join(BUNDLE, name, '..'), { recursive: true });
            cpSync(join(pub, name), join(BUNDLE, name));
        });

        writeFileSync(join(BUNDLE, 'VERSION.txt'), `${[
            `source ${REPO}`,
            'branch main',
            `commit ${commit}`,
            `files ${copied.length}`,
            `left out ${WEB_ONLY.join(' ')}`
        ].join('\n')}\n`);

        ui.ok('aniultimatium', `${copied.length} files · ${commit.slice(0, 7)} · ${(copied.reduce((sum, name) => sum + statSync(join(BUNDLE, name)).size, 0) / 1024).toFixed(0)}KB`);
    } finally {
        if (from.temporary) rmSync(join(from.path, '..'), { recursive: true, force: true });
    }
}

try {
    main();
} catch (err) {
    ui.crash(err);
}
