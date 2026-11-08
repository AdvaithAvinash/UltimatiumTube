// Runs a widget's service as the TV would: from the unpacked widget, woken by the platform, with the
// platform's application API (the processes of the service are its "contexts", and a kill ends one).
const path = require('path'); const fs = require('fs');
require('./preload.cjs');
const dir = process.argv[2]; const ctxDir = process.env.SIM_CONTEXTS;
const SERVICE = 'U1tmTube55.UltimatiumTubeService';
if (ctxDir) {
  fs.writeFileSync(path.join(ctxDir, String(process.pid)), SERVICE);
  const gone = () => { try { fs.unlinkSync(path.join(ctxDir, String(process.pid))); } catch (e) {} };
  process.on('exit', gone);
  global.tizen = { systeminfo: { getCapability: (key) => (/platform.version/.test(key) ? '8.0' : null) }, application: {
    getAppInfo: () => ({ id: 'U1tmTube55.UltimatiumTube', version: '1', name: 'UltimatiumTube' }),
    getCurrentApplication: () => ({ appInfo: { id: SERVICE }, contextId: String(process.pid) }),
    getAppsContext: (ok) => setTimeout(() => ok(fs.readdirSync(ctxDir).map((pid) => ({ id: pid, appId: fs.readFileSync(path.join(ctxDir, pid), 'utf8') }))), 10),
    kill: (id, ok, fail) => setTimeout(() => {
      try { process.kill(Number(id), 'SIGKILL'); fs.appendFileSync(path.join(ctxDir, '..', 'kills.log'), `${process.pid} killed ${id}\n`); ok && ok(); } catch (e) { fail && fail(e); }
    }, 10),
    getAppsInfo: (ok) => setTimeout(() => ok([]), 10),
    getAppMetaData: () => [],
    launch: (id, ok) => ok && ok()
  } };
}
const svc = require(path.join(dir, 'service/dist/index.js'));
setTimeout(() => { try { svc.onRequest(); } catch (e) { console.error('wake failed', e); } }, 1500);
