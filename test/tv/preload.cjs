// Makes YouTube's hosts this machine, where a stand-in answers.
const dns = require('dns');
const real = dns.lookup;
dns.lookup = function (host, options, cb) {
  if (/(^|\.)(youtube\.com|googlevideo\.com|ytimg\.com|ggpht\.com|google\.com|gstatic\.com)$/.test(host)) {
    if (typeof options === 'function') { cb = options; options = {}; }
    if (options && options.all) return process.nextTick(() => cb(null, [{ address: '127.0.0.1', family: 4 }]));
    return process.nextTick(() => cb(null, '127.0.0.1', 4));
  }
  return real.apply(this, arguments);
};
