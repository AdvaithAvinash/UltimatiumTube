'use strict';

// The Android TV app, built without Gradle: javac, dx, aapt, zipalign and apksigner, all of which
// Debian and Ubuntu package (apt install aapt apksigner dalvik-exchange zipalign libandroid-23-java).

const { execFileSync } = require('child_process');
const {
    existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync, cpSync
} = require('fs');
const { homedir } = require('os');
const { join, dirname } = require('path');
const { randomBytes } = require('crypto');

const ui = require('./lib/report.js');
const { load, ROOT } = require('./lib/config.js');
const paths = require('./lib/paths.js');

const APK = 'release/UltimatiumTube.apk';
const STAGING = join(ROOT, '.package', 'apk');

const friendly = (message) => Object.assign(new Error(message), { isFriendly: true });

const onPath = (name) => {
    try {
        return execFileSync('which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (e) {
        return null;
    }
};

const firstThat = (candidates) => candidates.filter(Boolean).find((candidate) => existsSync(candidate));

const androidJar = () => {
    const home = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    const platforms = home && existsSync(join(home, 'platforms')) ? readdirSync(join(home, 'platforms')).sort().reverse() : [];

    return firstThat([process.env.ANDROID_JAR]
        .concat(platforms.map((platform) => join(home, 'platforms', platform, 'android.jar')))
        .concat('/usr/lib/android-sdk/platforms/android-23/android.jar'));
};

const tools = () => {
    const found = {
        aapt: onPath('aapt'),
        zipalign: onPath('zipalign'),
        apksigner: onPath('apksigner'),
        javac: onPath('javac'),
        keytool: onPath('keytool'),
        dx: firstThat([onPath('dx'), '/usr/lib/android-sdk/build-tools/debian/dx']),
        jar: androidJar()
    };

    const missing = Object.keys(found).filter((name) => !found[name]);
    if (missing.length) {
        throw friendly(`Missing: ${missing.join(', ')}.\n`
            + '  On Debian or Ubuntu: apt install aapt apksigner dalvik-exchange zipalign libandroid-23-java openjdk-17-jdk-headless\n'
            + '  Elsewhere, set ANDROID_JAR to an android.jar, and put aapt, zipalign, apksigner and dx on the PATH.');
    }

    return found;
};

const run = (command, args, options) => execFileSync(command, args, Object.assign({ stdio: 'pipe', encoding: 'utf8' }, options));

const filesUnder = (directory, suffix) => readdirSync(directory, { withFileTypes: true }).reduce((all, entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return all.concat(filesUnder(path, suffix));
    return path.endsWith(suffix) ? all.concat(path) : all;
}, []);

// 1.2.3 becomes 10203, so each release is above the one before it.
const versionCodeOf = (version) => {
    const [major, minor, patch] = version.split(/[.-]/).map((part) => Number(part) || 0);
    return major * 10000 + minor * 100 + patch;
};

// Kept outside the repository: whoever holds it can sign updates the TV will accept.
const signingKey = (tool) => {
    const keystore = process.env.ULTIMATIUMTUBE_KEYSTORE || join(homedir(), '.ultimatiumtube', 'release.keystore');
    const passFile = `${keystore}.pass`;

    if (!existsSync(keystore)) {
        mkdirSync(dirname(keystore), { recursive: true });
        const password = process.env.ULTIMATIUMTUBE_KEYPASS || randomBytes(18).toString('hex');

        run(tool, ['-genkeypair', '-keystore', keystore, '-alias', 'ultimatiumtube', '-keyalg', 'RSA',
            '-keysize', '2048', '-validity', '36500', '-storepass', password, '-keypass', password,
            '-dname', 'CN=UltimatiumTube, O=UltimatiumTube']);
        writeFileSync(passFile, password, { mode: 0o600 });
    }

    const password = process.env.ULTIMATIUMTUBE_KEYPASS
        || (existsSync(passFile) ? readFileSync(passFile, 'utf8').trim() : null);
    if (!password) throw friendly(`${keystore} has no password beside it. Set ULTIMATIUMTUBE_KEYPASS.`);

    return { keystore, password };
};

const stage = (config) => {
    const userScript = join(ROOT, paths.BUNDLE);
    if (!existsSync(userScript)) throw friendly(`${paths.BUNDLE} is missing. Run \`npm run build\` first.`);

    rmSync(STAGING, { recursive: true, force: true });
    ['classes', 'assets', 'res'].forEach((name) => mkdirSync(join(STAGING, name), { recursive: true }));

    cpSync(join(ROOT, 'android', 'res'), join(STAGING, 'res'), { recursive: true });
    copyFileSync(userScript, join(STAGING, 'assets', 'userScript.js'));

    // The phone's settings page is the one the Tizen service serves.
    writeFileSync(join(STAGING, 'assets', 'phone.html'), require('../service/lib/phonePage.js').page());

    const manifest = readFileSync(join(ROOT, 'android', 'AndroidManifest.xml'), 'utf8')
        .replace('@VERSION_CODE@', String(versionCodeOf(config.version)))
        .replace('@VERSION_NAME@', config.version);
    writeFileSync(join(STAGING, 'AndroidManifest.xml'), manifest);
};

// The icons come from the logo in app/icon.png, sized for a launcher and for the TV home row.
const checkIcons = () => ['icon.png', 'banner.png'].forEach((name) => {
    if (!existsSync(join(ROOT, 'android', 'res', 'drawable', name))) {
        throw friendly(`android/res/drawable/${name} is missing.`);
    }
});

function build(config) {
    const t = tools();
    checkIcons();
    stage(config);

    const classes = join(STAGING, 'classes');
    const sources = filesUnder(join(ROOT, 'android', 'src'), '.java');

    // Source level 8 and no lambdas: dx reads the class files as they are.
    run(t.javac, ['-source', '8', '-target', '8', '-Xlint:-options', '-bootclasspath', t.jar,
        '-d', classes].concat(sources));
    ui.ok('java', `${sources.length} files`);

    run(t.dx, ['--dex', '--min-sdk-version=21', `--output=${join(STAGING, 'classes.dex')}`, classes]);
    ui.ok('dex', `${(statSync(join(STAGING, 'classes.dex')).size / 1024).toFixed(0)}KB`);

    const unsigned = join(STAGING, 'unsigned.apk');
    run(t.aapt, ['package', '-f', '-M', join(STAGING, 'AndroidManifest.xml'), '-S', join(STAGING, 'res'),
        '-A', join(STAGING, 'assets'), '-I', t.jar, '-F', unsigned, '--min-sdk-version', '21',
        '--target-sdk-version', '29']);
    run(t.aapt, ['add', unsigned, 'classes.dex'], { cwd: STAGING });
    ui.ok('package', 'resources, assets and code');

    const aligned = join(STAGING, 'aligned.apk');
    run(t.zipalign, ['-f', '-p', '4', unsigned, aligned]);

    const key = signingKey(t.keytool);
    const out = join(ROOT, APK);
    mkdirSync(dirname(out), { recursive: true });

    run(t.apksigner, ['sign', '--ks', key.keystore, '--ks-key-alias', 'ultimatiumtube', '--ks-pass', `pass:${key.password}`,
        '--key-pass', `pass:${key.password}`, '--min-sdk-version', '21', '--out', out, aligned]);

    const verdict = run(t.apksigner, ['verify', '--verbose', '--print-certs', out]);
    if (!/Verified using v2 scheme[^\n]*true/.test(verdict)) throw friendly(`The signed app did not verify:\n${verdict}`);

    ui.ok('signed', `v2 verified, key ${key.keystore}`);
    return out;
}

function main() {
    const config = load();

    ui.heading('android', `v${config.version}`);
    ui.note(ui.style.dim('  building first...'));
    execFileSync('node', [join(__dirname, 'build.js')], { cwd: ROOT, stdio: 'inherit' });

    ui.group('app');
    const out = build(config);
    rmSync(STAGING, { recursive: true, force: true });

    ui.ok('UltimatiumTube.apk', `${(statSync(out).size / 1024 / 1024).toFixed(2)}MB · ${APK}`);
    ui.blank();
}

try {
    main();
} catch (err) {
    ui.crash(err);
}
