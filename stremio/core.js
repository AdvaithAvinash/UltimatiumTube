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
    return loc && /^https?:$/.test(loc.protocol) ? loc.protocol + '//' + loc.host : '';
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
    var bridge = root.StremioNative;
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

  // Covers for a title an addon gives none for: Cinemeta's own pictures, by the IMDb id (tt...).
  SX.cover = function (id, kind) {
    var tt = /^(tt\d+)/.exec(String(id || ''));
    return tt ? 'https://images.metahub.space/' + (kind || 'poster') + '/medium/' + tt[1] + '/img' : '';
  };

  SX.preview = function (m, addon) {
    return {
      id: String(m.id), type: m.type, name: m.name || '', poster: thumb(m) || SX.cover(m.id, 'poster'),
      background: m.background || SX.cover(m.id, 'background'),
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
        if (!full.poster) full.poster = item.poster || SX.cover(item.id, 'poster');
        if (!full.background) full.background = item.background || SX.cover(item.id, 'background');
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
      notWeb: !!hints.notWebReady,
      subtitles: SX.arr(s.subtitles).filter(function (t) { return t && /^https?:\/\//i.test(t.url || ''); }).map(function (t) {
        return { id: String(t.id || t.url), url: t.url, lang: t.lang || '', addon: addon.manifest.name };
      })
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

  // --- subtitles

  // [2-letter, 3-letter codes..., name]. Addons mostly give the 3-letter code.
  SX.LANGS = [
    ['en', 'eng', 'English'], ['es', 'spa', 'Spanish'], ['fr', 'fra', 'fre', 'French'], ['de', 'deu', 'ger', 'German'],
    ['it', 'ita', 'Italian'], ['pt', 'por', 'Portuguese'], ['pb', 'pob', 'Portuguese (Brazil)'], ['nl', 'nld', 'dut', 'Dutch'],
    ['sv', 'swe', 'Swedish'], ['no', 'nor', 'Norwegian'], ['da', 'dan', 'Danish'], ['fi', 'fin', 'Finnish'],
    ['pl', 'pol', 'Polish'], ['cs', 'ces', 'cze', 'Czech'], ['hu', 'hun', 'Hungarian'], ['ro', 'ron', 'rum', 'Romanian'],
    ['el', 'ell', 'gre', 'Greek'], ['tr', 'tur', 'Turkish'], ['ru', 'rus', 'Russian'], ['uk', 'ukr', 'Ukrainian'],
    ['ar', 'ara', 'Arabic'], ['he', 'heb', 'Hebrew'], ['hi', 'hin', 'Hindi'], ['ne', 'nep', 'Nepali'],
    ['ja', 'jpn', 'Japanese'], ['ko', 'kor', 'Korean'], ['zh', 'zho', 'chi', 'Chinese'], ['th', 'tha', 'Thai'],
    ['vi', 'vie', 'Vietnamese'], ['id', 'ind', 'Indonesian'], ['ms', 'msa', 'may', 'Malay'], ['fa', 'fas', 'per', 'Persian']
  ];

  // The entry for a code (any spelling), or null.
  SX.lang = function (code) {
    var c = String(code || '').toLowerCase().replace(/[-_].*$/, '');
    var found = null;
    SX.LANGS.forEach(function (l) {
      if (!found && l.slice(0, -1).indexOf(c) !== -1) found = l;
    });
    return found;
  };

  SX.langName = function (code) {
    var l = SX.lang(code);
    return l ? l[l.length - 1] : String(code || 'Unknown');
  };

  SX.sameLang = function (a, b) {
    var x = SX.lang(a), y = SX.lang(b);
    return !!x && x === y;
  };

  // The tracks every addon with subtitles has for this, each answer handed over as it arrives.
  SX.subtitles = function (addons, type, id, onAddon) {
    var askers = addons.filter(function (a) { return a.manifest && SX.supports(a.manifest, 'subtitles', type, id); });

    return Promise.all(askers.map(function (a) {
      return SX.json(SX.url(a, 'subtitles', type, id), 15000).then(function (r) {
        var list = SX.arr(r && r.subtitles).filter(function (t) { return t && /^https?:\/\//i.test(t.url || ''); }).map(function (t) {
          return { id: String(t.id || t.url), url: t.url, lang: t.lang || '', addon: a.manifest.name };
        });
        if (onAddon) onAddon(a, list);
        return list;
      }).catch(function () { return []; });
    })).then(function (all) { return all.reduce(function (sum, l) { return sum.concat(l); }, []); });
  };

  var clock = /(?:(\d+):)?(\d+):(\d+)[.,](\d{1,3})/;

  var seconds = function (m) {
    return (Number(m[1] || 0) * 3600) + (Number(m[2]) * 60) + Number(m[3]) + Number((m[4] + '00').slice(0, 3)) / 1000;
  };

  var plain = function (t) {
    return t.replace(/\{\\[^}]*\}/g, '').replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      .replace(/^\s+|\s+$/g, '');
  };

  // SRT or WebVTT text to [{s, e, t}] in time order.
  SX.parseSubs = function (text) {
    var blocks = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
    var cues = [];

    blocks.forEach(function (block) {
      var lines = block.split('\n');
      var at = -1;
      lines.forEach(function (l, i) { if (at === -1 && l.indexOf('-->') !== -1) at = i; });
      if (at === -1) return;

      var parts = lines[at].split('-->');
      var a = clock.exec(parts[0]), b = clock.exec(parts[1] || '');
      if (!a || !b) return;

      var body = plain(lines.slice(at + 1).join('\n'));
      if (body) cues.push({ s: seconds(a), e: seconds(b), t: body });
    });

    return cues.sort(function (x, y) { return x.s - y.s; });
  };

  // The cue showing at a time, or null. `from` is where the last one was, a place to start looking.
  SX.cueAt = function (cues, time, from) {
    var i = from >= 0 && from < cues.length && cues[from].s <= time ? from : 0;
    var found = -1;
    for (; i < cues.length && cues[i].s <= time; i += 1) {
      if (cues[i].e > time) found = i;
    }
    return found;
  };

  // --- picking a stream without asking

  SX.quality = function (st) {
    var t = (st.name + ' ' + st.detail + ' ' + st.filename).toLowerCase();
    if (/2160p?|\b4k\b|\buhd\b/.test(t)) return 2160;
    if (/1440p?/.test(t)) return 1440;
    if (/1080p?/.test(t)) return 1080;
    if (/720p?/.test(t)) return 720;
    if (/480p?/.test(t)) return 480;
    if (/360p?/.test(t)) return 360;
    return 0;
  };

  // The best playable stream not above a ceiling (0 = no ceiling), or null.
  SX.pick = function (streams, ceiling) {
    var best = null;
    streams.forEach(function (s) {
      if (s.kind !== 'direct' || s.notWeb) return;
      var q = SX.quality(s);
      if (ceiling && q > ceiling) return;
      if (!best || q > best.q) best = { s: s, q: q };
    });
    return best ? best.s : null;
  };

  // --- YouTube: a channel's newest videos (its public feed), as cards

  var unxml = function (t) {
    return String(t || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  };

  SX.parseFeed = function (xml, channel) {
    return String(xml || '').split('<entry>').slice(1).map(function (entry) {
      var pick = function (re) { var m = re.exec(entry); return m ? unxml(m[1]) : ''; };
      var id = pick(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      if (!id) return null;
      return {
        id: id, type: 'ytvideo', name: pick(/<title>([^<]*)<\/title>/), author: pick(/<name>([^<]*)<\/name>/) || channel || '',
        published: pick(/<published>([^<]+)<\/published>/),
        poster: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg', background: 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg',
        description: pick(/<media:description>([^<]*)<\/media:description>/)
      };
    }).filter(Boolean);
  };

  SX.channelFeed = function (channelId, name) {
    return SX.text('https://www.youtube.com/feeds/videos.xml?channel_id=' + encodeURIComponent(channelId))
      .then(function (xml) { return SX.parseFeed(xml, name); });
  };

  // Newest first, each video once, across many feeds.
  SX.mergeFeeds = function (lists) {
    var seen = {};
    return lists.reduce(function (all, l) { return all.concat(l); }, [])
      .filter(function (v) { if (seen[v.id]) return false; seen[v.id] = 1; return true; })
      .sort(function (a, b) { return a.published < b.published ? 1 : a.published > b.published ? -1 : 0; });
  };

  // "Name: word, word" a line: a smart playlist of the feed videos whose title has any of the words.
  SX.smartPlaylists = function (text) {
    return String(text || '').split(/\n+/).map(function (line) {
      var m = /^\s*([^:]+):\s*(.+)$/.exec(line);
      if (!m) return null;
      var words = m[2].split(',').map(function (w) { return w.trim().toLowerCase(); }).filter(Boolean);
      return words.length ? { name: m[1].trim(), words: words } : null;
    }).filter(Boolean);
  };

  SX.matchWords = function (videos, words) {
    return videos.filter(function (v) {
      var t = (v.name + ' ' + v.author).toLowerCase();
      return words.some(function (w) { return t.indexOf(w) !== -1; });
    });
  };

  SX.shuffle = function (list, random) {
    var r = random || Math.random;
    return list.map(function (v) { return { v: v, k: r() }; }).sort(function (a, b) { return a.k - b.k; }).map(function (e) { return e.v; });
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
