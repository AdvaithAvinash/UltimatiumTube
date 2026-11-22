import { string } from 'rollup-plugin-string';
import terser from '@rollup/plugin-terser';
import getBabelOutputPlugin from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';

import { load, gitStamp } from './config.js';

const config = load();
const { version } = config;
const { commit, tree } = gitStamp();

const ENGINE = 'Chrome 63';
const ECMA = 2017;

// Tizen 3 to 5 carry an older web engine than Cobalt's; the 5.0 widget's script is written for it.
const LEGACY_ENGINE = 'Chrome 47';

const babel = (targets) => getBabelOutputPlugin({
    babelHelpers: 'bundled',
    presets: [['@babel/preset-env', { targets: targets || ENGINE }]]
});

const userScriptFor = (file, targets, ecma) => ({
    input: 'mods/index.js',
    output: {
        file,
        format: 'iife',
        banner: `/* tube ${version} */`
    },
    plugins: [
        json(),
        string({ include: '**/*.css' }),
        nodeResolve({ browser: true, preferBuiltins: false }),
        // Narrowed to node_modules: nothing under framework/ or mods/ is CommonJS.
        commonjs({ include: [/node_modules/] }),
        replace({
            preventAssignment: true,
            values: {
                __TUBE_DEV_TOOLS__: process.env.TUBE_DEV === '1' ? 'on' : 'off',
                __TUBE_VERSION__: version,
                __TUBE_COMMIT__: commit,
                __TUBE_TREE__: process.env.ROLLUP_WATCH === 'true' ? 'watch' : tree
            }
        }),
        babel(targets),
        terser({ ecma, mangle: true }),
        replace({
            preventAssignment: false,
            delimiters: ['', ''],
            values: { '\uFFFF': '\u0000' }
        })
    ]
});

const userScript = userScriptFor('dist/userScript.js', ENGINE, ECMA);
const legacyUserScript = userScriptFor('dist/userScript.legacy.js', LEGACY_ENGINE, 5);

// The boot screen's page, which the service writes into the container's content.
const bootScreen = {
    input: 'service/boot/index.js',
    output: { file: 'dist/bootScreen.js', format: 'iife' },
    plugins: [babel(), terser({ ecma: ECMA, mangle: true })]
};

export default [userScript, legacyUserScript, bootScreen];
