// A television, as far as UltimatiumTube's service can tell, run on this machine: the widget unpacked
// and its service started from it, the platform's application API (the service's processes are its
// contexts; a kill ends one; auto-restart starts an ended one again), TWO copies of the service at
// once as some TVs run, the boot screen it writes opened in Chromium with Cobalt's user agent, and a
// stand-in for www.youtube.com. It checks that the container ends up on YouTube through the service,
// with the userscript in the page, while copies end and start, and that left alone nothing churns.
//
// This is how 1.8.2's failure (two copies ending each other; the app opened on a network error) shows
// up off the TV: it fails here, and 1.8.3 and later pass.
//
//   node test/tv/sim.cjs release/UltimatiumTubetizen5.5.wgt [node binary] [port]
//
// Needs Playwright with Chromium, openssl, and port 443 (root): the service asks for YouTube there.
'use strict';

const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fakeyt = require('./fakeyt.cjs');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const HERE = __dirname;
const WGT = path.resolve(process.argv[2] || 'release/UltimatiumTubetizen5.5.wgt'); const NODE = process.argv[3] || process.execPath; const PORT = Number(process.argv[4] || 18700);
const AGENT = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 8.0) AppleWebKit/537.36 (KHTML, like Gecko) 120.0.6099.5/8.0 TV Safari/537.36 Cobalt/25.lts.30.1034943-gold (unlike Gecko) v8/8.8.278.17-jit gles Evergreen-Full';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = []; const check = (label, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : '  <- ' + (detail || '')}`); results.push(!!ok); };
(async () => {
  const keys = fs.mkdtempSync(path.join(os.tmpdir(), 'tvkeys-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(keys, 'key.pem'), '-out', path.join(keys, 'cert.pem'), '-days', '2', '-subj', '/CN=www.youtube.com'], { stdio: 'ignore' });
  const youtube = await fakeyt.start(fs.readFileSync(path.join(keys, 'key.pem')), fs.readFileSync(path.join(keys, 'cert.pem')), path.join(keys, 'youtube.log'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvwgt-'));
  execFileSync('unzip', ['-q', WGT, '-d', dir]);
  const share = fs.mkdtempSync(path.join(os.tmpdir(), 'tvshare-'));
  const content = path.join(share, 'cobalt-content'); fs.mkdirSync(path.join(content, 'web'), { recursive: true });
  const env = Object.assign({}, process.env, { TUBE_PROXY_PORT: String(PORT), TUBE_SHARE: share, TUBE_LOG: path.join(share, 'service.log'), TUBE_COBALT_CONTENT: content, NODE_TLS_REJECT_UNAUTHORIZED: '0', TUBE_REACH_URL: 'https://www.youtube.com/generate_204' });
  const contexts = path.join(share, 'contexts'); fs.mkdirSync(contexts);
  env.SIM_CONTEXTS = contexts;
  const procs = []; const starts = { count: 0 };
  // auto-restart="true": a service process that ends is started again by the platform.
  const start = () => {
    starts.count += 1;
    const p = spawn(NODE, [path.join(HERE, 'runsvc.cjs'), dir], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    procs.push(p);
    p.on('exit', () => { if (!stopping.yes && !p.byUs) setTimeout(start, 500); });
    return p;
  };
  const stopping = { yes: false };
  // The TV runs two copies of the service.
  const first = start(); await sleep(1200); const second = start(); await sleep(3500);
  // The 5.5 widget opens a boot screen the service writes; the 5.0 one opens the service directly.
  const config = fs.readFileSync(path.join(dir, 'config.xml'), 'utf8');
  const withBoot = /--content=/.test(config);
  const boot = path.join(content, 'web', 'ultimatiumtube', 'boot.html');
  const opening = withBoot ? 'file://' + boot : `http://127.0.0.2:${PORT}/tv`;
  if (withBoot) check('the boot screen was written by the woken service', fs.existsSync(boot));
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ userAgent: AGENT, viewport: { width: 1920, height: 1080 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const run = async (label) => {
    try { await page.goto(opening); } catch (e) { check(`${label}: the service answered`, false, e.message.split('\n')[0]); return; }
    try { await page.waitForURL(/\/tv/, { timeout: 30000 }); } catch (e) { /* checked below */ }
    await sleep(2500);
    const url = page.url();
    const text = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 200) : '');
    const injected = await page.evaluate(() => Array.prototype.some.call(document.scripts, (s) => /userScript|__tube/.test(s.src + s.textContent.slice(0, 2000))));
    check(`${label}: the container is on the service's /tv`, /:\d+\/tv/.test(url), url + ' | ' + text.replace(/\s+/g, ' ').slice(0, 160));
    check(`${label}: YouTube's page came through the service`, /stand-in youtube tv/.test(text), text.slice(0, 120));
    check(`${label}: the userscript is in the page`, injected);
  };
  await run('two copies running');
  // The copy that holds the port ends; the other must take over by itself.
  first.byUs = true; first.kill('SIGKILL'); await sleep(7000);
  await run('after the serving copy ended');
  // And it is started again beside the other, as the platform does.
  const third = start(); await sleep(4000);
  await run('after it was started again');
  // A while of nothing happening: the copies must leave each other alone.
  const before = starts.count; await sleep(20000);
  check('left alone for 20s, no copy is ended and started again', starts.count === before, `${starts.count - before} restarts`);
  await run('after 20s more');
  const log = fs.readFileSync(path.join(share, 'service.log'), 'utf8');
  check('no copy gave up its port or ended the other', !/handoff|giving the port|ending another/.test(log));
  console.log('page errors:', JSON.stringify(errors.slice(0, 3)));
  console.log('log tail:\n' + log.split('\n').filter((l) => /listening|started|survived|uncaught|exit/.test(l)).slice(-8).join('\n'));
  stopping.yes = true; youtube.close(); await browser.close(); procs.forEach((p) => { try { p.kill('SIGKILL'); } catch (e) {} });
  const failed = results.filter((ok) => !ok).length; console.log(`\n${results.length - failed}/${results.length} checks passed.`); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
