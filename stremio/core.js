// Stremio addons: the protocol side of the Stremio page. No screen code here, so it is the part the
// tests run. Plain ES5, for the TV's YouTube engine, which is older than a browser.
(function (root) {
  'use strict';

  var SX = {};

  // --- small helpers

  SX.isString = function (v) { return typeof v === 'string'; };
  SX.arr = function (v) { return Object.prototype.toString.call(v) === '[object Array]' ? v : []; };

  SX.store = {
    get: function (key, fallback) {
      try {
        var raw = root.localStorage.getItem('sx_' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { root.localStorage.setItem('sx_' + key, JSON.stringify(value)); } catch (e) { /* full or blocked */ }
    }
  };

  // Another site's address, as this page may ask for it. On a page of the TV's service the engine
  // refuses what it is not allowed to ask for directly, so the service asks for it (see /cors-bypass/).
  SX.origin = (function () {
    var loc = root.location;
    return loc && /^https?:$/.test(loc.protocol) ? loc.origin : '';
  })();

  SX.route = function (url) {
    if (!SX.origin || !SX.isString(url) || !/^https?:\/\//i.test(url)) return url;
    if (url.indexOf(SX.origin + '/') === 0) return url;
    return SX.origin + '/cors-bypass/' + url;
  };

  // --- addon addresses

  // What a viewer pastes: stremio:// and a bare address are accepted; the manifest is what is kept.
  SX.manifestUrl = function (text) {
    var t = String(text || '').replace(/^\s+|\s+$/g, '');
    if (!t) return null;
    t = t.replace(/^stremio:\/\//i, 'https://');
    if (!/^https?:\/\/[^\s"'<>]+$/i.test(t)) return null;
    t = t.replace(/\/+$/, '');
    return /\/manifest\.json(\?.*)?$/i.test(t) ? t : t + '/manifest.json';
  };

  SX.baseOf = function (url) { return String(url).replace(/\/manifest\.json(\?.*)?$/i, ''); };

  // The lines of the settings entry, or of anything pasted: one address to a line, commas too.
  SX.parseList = function (text) {
    var seen = {};
    return String(text || '').split(/[\n\r,;]+/).map(SX.manifestUrl).filter(function (u) {
      if (!u || seen[u]) return false;
      seen[u] = true;
      return true;
    });
  };

  // --- requests

  SX.json = function (url, timeout) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      var done = false;
      var finish = function (fn, value) { if (!done) { done = true; fn(value); } };
      var timer = setTimeout(function () { finish(reject, new Error('timeout')); try { x.abort(); } catch (e) { /* gone */ } }, timeout || 15000);

      x.open('GET', SX.route(url), true);
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        clearTimeout(timer);
        if (x.status < 200 || x.status >= 300) return finish(reject, new Error('HTTP ' + x.status));
        try { finish(resolve, JSON.parse(x.responseText)); } catch (e) { finish(reject, new Error('not JSON')); }
      };
      x.onerror = function () { clearTimeout(timer); finish(reject, new Error('network')); };
      x.send();
    });
  };

  // A Grayjay plugin is added by the address of its configuration; a grayjay:// install link, with
  // the address after it, is accepted too. The address is kept as it is.
  SX.pluginUrl = function (text) {
    var t = String(text || '').replace(/^\s+|\s+$/g, '').replace(/^grayjay:\/\/plugin\//i, '');
    if (!/^https?:\/\/[^\s"'<>]+$/i.test(t)) return null;
    return t;
  };

  SX.parsePlugins = function (text) {
    var seen = {};
    return String(text || '').split(/[\n\r;]+/).map(SX.pluginUrl).filter(function (u) {
      if (!u || seen[u]) return false;
      seen[u] = true;
      return true;
    });
  };

  // --- requests with headers: a page may not set User-Agent, Cookie or Referer, and a plugin must,
  // so the service (or the Android app) makes those requests and hands back what came.

  var waiting = {}, serial = 0;

  root.__sxFetchDone = function (id, text) {
    var w = waiting[id];
    if (!w) return;
    delete waiting[id];
    try { w.resolve(JSON.parse(text)); } catch (e) { w.reject(new Error('bad answer')); }
  };

  // req: { url, method, headers, body }. Answers { status, url, headers: {name: [values]}, body }.
  SX.rawFetch = function (req) {
    var bridge = root.AniNative;
    if (bridge && bridge.fetch) {
      return new Promise(function (resolve, reject) {
        serial += 1;
        waiting[serial] = { resolve: resolve, reject: reject };
        try { bridge.fetch(serial, JSON.stringify(req)); } catch (e) { delete waiting[serial]; reject(e); }
      });
    }

    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      var timer = setTimeout(function () { reject(new Error('timeout')); try { x.abort(); } catch (e) { /* gone */ } }, 30000);

      x.open('POST', SX.origin + '/__tube/fetch', true);
      x.setRequestHeader('X-Tube', '1');
      x.setRequestHeader('Content-Type', 'application/json');
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        clearTimeout(timer);
        if (x.status !== 200) return reject(new Error('HTTP ' + x.status));
        try { resolve(JSON.parse(x.responseText)); } catch (e) { reject(new Error('bad answer')); }
      };
      x.onerror = function () { clearTimeout(timer); reject(new Error('network')); };
      x.send(JSON.stringify(req));
    });
  };

  SX.text = function (url) {
    return SX.rawFetch({ url: url, method: 'GET', headers: {} }).then(function (r) {
      if (r.status < 200 || r.status >= 300) throw new Error('HTTP ' + r.status);
      return r.body;
    });
  };

  // --- what an addon can do

  // resources: ["catalog", {"name":"stream","types":[...],"idPrefixes":[...]}]
  SX.resource = function (manifest, name) {
    var found = null;
    SX.arr(manifest && manifest.resources).forEach(function (r) {
      if (found) return;
      if (r === name) found = { name: name, types: manifest.types, idPrefixes: manifest.idPrefixes };
      else if (r && r.name === name) found = { name: name, types: r.types || manifest.types, idPrefixes: r.idPrefixes || manifest.idPrefixes };
    });
    return found;
  };

  SX.supports = function (manifest, name, type, id) {
    var r = SX.resource(manifest, name);
    if (!r) return false;
    var types = SX.arr(r.types);
    if (types.length && type && types.indexOf(type) === -1) return false;
    var prefixes = SX.arr(r.idPrefixes);
    if (prefixes.length && id) {
      return prefixes.some(function (p) { return String(id).indexOf(p) === 0; });
    }
    return true;
  };

  var required = function (catalog) {
    var extra = SX.arr(catalog.extra).some(function (e) { return e && e.isRequired; });
    return extra || SX.arr(catalog.extraRequired).length > 0;
  };

  var takes = function (catalog, name) {
    return SX.arr(catalog.extra).some(function (e) { return e && e.name === name; })
      || SX.arr(catalog.extraSupported).indexOf(name) !== -1;
  };

  // Catalogs that show with nothing asked of them; the rest (search, a required genre) do not.
  SX.homeCatalogs = function (manifest) {
    return SX.arr(manifest && manifest.catalogs).filter(function (c) {
      return c && c.id && c.type && !required(c);
    });
  };

  SX.searchCatalogs = function (manifest) {
    return SX.arr(manifest && manifest.catalogs).filter(function (c) {
      if (!c || !c.id || !c.type || !takes(c, 'search')) return false;
      return !SX.arr(c.extra).some(function (e) { return e && e.isRequired && e.name !== 'search'; });
    });
  };

  SX.pages = function (catalog) { return takes(catalog, 'skip'); };

  // --- addresses of requests

  SX.extraPath = function (extra) {
    var keys = Object.keys(extra || {}).filter(function (k) { return extra[k] !== undefined && extra[k] !== null && extra[k] !== ''; });
    return keys.length ? '/' + keys.map(function (k) { return k + '=' + encodeURIComponent(extra[k]); }).join('&') : '';
  };

  SX.url = function (addon, resource, type, id, extra) {
    return SX.baseOf(addon.url) + '/' + resource + '/' + encodeURIComponent(type) + '/' + encodeURIComponent(id)
      + SX.extraPath(extra) + '.json';
  };

  // --- the addons a viewer has

  var MANIFEST_AGE = 12 * 3600 * 1000;
  var DEFAULT_ADDONS = ['https://v3-cinemeta.strem.io/manifest.json'];
  SX.DEFAULT_ADDONS = DEFAULT_ADDONS;

  SX.cleanManifest = function (m) {
    if (!m || !SX.isString(m.id) || !SX.isString(m.name)) return null;
    return {
      id: m.id, name: m.name, version: m.version || '', description: m.description || '', logo: m.logo || '',
      resources: SX.arr(m.resources), types: SX.arr(m.types), idPrefixes: SX.arr(m.idPrefixes),
      catalogs: SX.arr(m.catalogs).filter(function (c) { return c && c.id && c.type; }).map(function (c) {
        return { id: c.id, type: c.type, name: c.name || '', extra: SX.arr(c.extra), extraRequired: SX.arr(c.extraRequired), extraSupported: SX.arr(c.extraSupported) };
      })
    };
  };

  // Every address given, with its manifest: kept 12 hours, asked for again after that, and the kept
  // one used when the addon does not answer. An address that never answered is left out.
  SX.loadAddons = function (urls) {
    var kept = SX.store.get('manifests', {});
    var now = new Date().getTime();

    return Promise.all(urls.map(function (url) {
      var have = kept[url];
      if (have && now - have.at < MANIFEST_AGE) return { url: url, manifest: have.manifest };

      return SX.json(url, 12000).then(function (raw) {
        var manifest = SX.cleanManifest(raw);
        if (!manifest) throw new Error('not an addon');
        kept[url] = { at: now, manifest: manifest };
        return { url: url, manifest: manifest };
      }).catch(function (error) {
        return have ? { url: url, manifest: have.manifest, stale: true } : { url: url, manifest: null, error: error.message };
      });
    })).then(function (all) {
      SX.store.set('manifests', kept);
      return all;
    });
  };

  // --- catalogs, meta and streams

  var thumb = function (m) { return m.poster || m.logo || ''; };

  SX.preview = function (m, addon) {
    return {
      id: String(m.id), type: m.type, name: m.name || '', poster: thumb(m), background: m.background || '',
      logo: m.logo || '', description: m.description || '', year: m.releaseInfo || m.year || '',
      rating: m.imdbRating || '', genres: SX.arr(m.genres), runtime: m.runtime || '', addon: addon ? addon.url : ''
    };
  };

  SX.catalog = function (addon, catalog, extra) {
    return SX.json(SX.url(addon, 'catalog', catalog.type, catalog.id, extra)).then(function (r) {
      return SX.arr(r && r.metas).filter(function (m) { return m && m.id && m.name; })
        .map(function (m) { m.type = m.type || catalog.type; return SX.preview(m, addon); });
    });
  };

  var withVideos = function (full) {
    full.videos = SX.arr(full.videos).filter(function (v) { return v && v.id; }).map(function (v) {
      return {
        id: String(v.id), season: Number(v.season) || 0, episode: Number(v.episode || v.number) || 0,
        title: v.title || v.name || '', overview: v.overview || v.description || '', thumbnail: v.thumbnail || '',
        released: v.released || ''
      };
    });
    return full;
  };

  // The full entry, from the first addon that knows the type and id; the catalog's own preview is
  // what is left when none does.
  SX.meta = function (addons, item) {
    var askers = addons.filter(function (a) { return a.manifest && SX.supports(a.manifest, 'meta', item.type, item.id); });
    // The addon the item came from first: it is the one that knows it best.
    askers.sort(function (a, b) { return (b.url === item.addon ? 1 : 0) - (a.url === item.addon ? 1 : 0); });

    var next = function (at) {
      if (at >= askers.length) return Promise.resolve(withVideos(Object.assign({}, item, { videos: [] })));

      return SX.json(SX.url(askers[at], 'meta', item.type, item.id)).then(function (r) {
        var m = r && r.meta;
        if (!m || !m.name) throw new Error('no meta');

        var full = Object.assign(SX.preview(m, askers[at]), {
          type: item.type, id: String(m.id || item.id), cast: SX.arr(m.cast), director: SX.arr(m.director),
          writer: SX.arr(m.writer), videos: m.videos, released: m.released || '', country: m.country || '',
          awards: m.awards || '', website: m.website || ''
        });
        if (!full.poster) full.poster = item.poster;
        if (!full.background) full.background = item.background;
        return withVideos(full);
      }).catch(function () { return next(at + 1); });
    };

    return next(0);
  };

  // How a stream can be played here. A direct address plays in the page; a YouTube id plays in
  // YouTube; a torrent hash cannot be played by a TV without a service that turns it into an address.
  SX.kind = function (s) {
    if (s.url && /^https?:\/\//i.test(s.url)) return 'direct';
    if (s.ytId) return 'youtube';
    if (s.infoHash) return 'torrent';
    if (s.externalUrl) return 'external';
    return 'unknown';
  };

  SX.stream = function (s, addon) {
    var hints = s.behaviorHints || {};
    var text = [s.title, s.description].filter(Boolean).join('\n');
    return {
      kind: SX.kind(s), url: s.url || '', ytId: s.ytId || '', infoHash: s.infoHash || '',
      name: String(s.name || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, ''),
      detail: text, addon: addon.manifest.name, addonUrl: addon.url,
      filename: hints.filename || '', size: hints.videoSize || 0, group: hints.bingeGroup || '',
      headers: hints.proxyHeaders && hints.proxyHeaders.request ? hints.proxyHeaders.request : null,
      notWeb: !!hints.notWebReady
    };
  };

  var RANK = { direct: 0, youtube: 1, torrent: 2, external: 3, unknown: 4 };

  SX.sortStreams = function (list) {
    return list.map(function (s, i) { return { s: s, i: i }; }).sort(function (a, b) {
      var d = RANK[a.s.kind] - RANK[b.s.kind];
      if (d) return d;
      // A stream built for a browser first: the others (an unusual container) may not play here.
      if (a.s.notWeb !== b.s.notWeb) return a.s.notWeb ? 1 : -1;
      return a.i - b.i;
    }).map(function (e) { return e.s; });
  };

  // Every addon that has streams for this, asked at once; each answer is handed over as it arrives.
  SX.streams = function (addons, type, id, onAddon) {
    var askers = addons.filter(function (a) { return a.manifest && SX.supports(a.manifest, 'stream', type, id); });

    return {
      asked: askers.length,
      done: Promise.all(askers.map(function (a) {
        return SX.json(SX.url(a, 'stream', type, id), 20000).then(function (r) {
          var list = SX.arr(r && r.streams).filter(function (s) { return s && typeof s === 'object'; })
            .map(function (s) { return SX.stream(s, a); });
          onAddon(a, list, null);
          return list;
        }).catch(function (e) { onAddon(a, [], e); return []; });
      }))
    };
  };

  // --- what was watched

  SX.watchKey = function (type, id) { return type + ':' + id; };

  SX.format = function (seconds) {
    var s = Math.max(0, Math.floor(seconds || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    var two = function (n) { return (n < 10 ? '0' : '') + n; };
    return (h ? h + ':' + two(m) : m) + ':' + two(r);
  };

  SX.sizeText = function (bytes) {
    if (!bytes) return '';
    var gb = bytes / 1073741824;
    return gb >= 1 ? gb.toFixed(2) + ' GB' : Math.round(bytes / 1048576) + ' MB';
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SX;
  else root.SX = SX;
})(typeof window !== 'undefined' ? window : globalThis);
