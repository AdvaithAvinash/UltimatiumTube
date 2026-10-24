'use strict';

// The parts of the Android app that do not need Android, run on a plain JVM against a stand-in for
// the one framework class they touch. org.json is Android's own library, fetched from Maven Central.

const { execFileSync } = require('child_process');
const { existsSync, mkdirSync, readdirSync, rmSync } = require('fs');
const { join } = require('path');

const ui = require('./lib/report.js');
const { ROOT } = require('./lib/config.js');

const WORK = join(ROOT, '.package', 'android-test');
const JSON_JAR = join(ROOT, '.package', 'org.json.jar');
const JSON_URL = 'https://repo.maven.apache.org/maven2/org/json/json/20240303/json-20240303.jar';

const filesUnder = (directory) => readdirSync(directory, { withFileTypes: true }).reduce((all, entry) => (
    entry.isDirectory() ? all.concat(filesUnder(join(directory, entry.name)))
        : entry.name.endsWith('.java') ? all.concat(join(directory, entry.name)) : all
), []);

function main() {
    mkdirSync(join(ROOT, '.package'), { recursive: true });
    if (!existsSync(JSON_JAR)) execFileSync('curl', ['-fsSL', '-o', JSON_JAR, JSON_URL], { stdio: 'inherit' });

    rmSync(WORK, { recursive: true, force: true });
    mkdirSync(WORK, { recursive: true });

    // Only the files that touch no Android API but the stand-in.
    const sources = ['PageInjector.java', 'PhoneSettings.java', 'PhoneServer.java']
        .map((name) => join(ROOT, 'android', 'src', 'app', 'ultimatiumtube', 'tv', name))
        .concat(filesUnder(join(ROOT, 'android', 'test')));

    execFileSync('javac', ['-Xlint:-options', '-cp', JSON_JAR, '-d', WORK].concat(sources), { stdio: 'inherit' });
    execFileSync('java', ['-cp', `${WORK}:${JSON_JAR}`, 'app.ultimatiumtube.tv.Check'], { stdio: 'inherit' });
}

try {
    main();
} catch (err) {
    ui.crash(err);
}
