// Grayjay plugins: runs a plugin's script in the page and turns what it returns into what the Stremio
// page shows. Plain ES5 for the TV's engine; the plugin itself is whatever its author wrote.
//
// A plugin is written for a host where its requests block until the answer is there. A page cannot
// block on a request, so a plugin function is run, and the first time it asks for something not yet
// fetched it is stopped, the thing fetched, and the function run again from the start with every
// answer so far handed back in order. Plugins that depend on nothing but their requests give the
// same result however often they are run.
(function (root) {
  'use strict';

  var SX = root.SX || require('./core.js');
  var GJ = {};

  var NEED = { needMore: true };
  var MOST_ROUNDS = 40;

  // --- constants and classes a plugin expects to find

  var Type = {
    Source: { Dash: 'DASH', HLS: 'HLS', STATIC: 'STATIC', Static: 'STATIC' },
    Feed: { Videos: 'VIDEOS', Streams: 'STREAMS', Mixed: 'MIXED', Live: 'LIVE', Subscriptions: 'SUBSCRIPTIONS' },
    Order: { Chronological: 'CHRONOLOGICAL' },
    Date: { Today: 'TODAY', LastWeek: 'LAST_WEEK', LastMonth: 'LAST_MONTH', LastYear: 'LAST_YEAR' },
    Duration: { Short: 'SHORT', Medium: 'MEDIUM', Long: 'LONG' },
    Text: { Raw: 0, HTML: 1, Markup: 2 },
    Chapter: { NORMAL: 0, SKIPPABLE: 5, SKIP: 6, SKIPONCE: 7 },
    Comment: { ORDER: { Top: 'TOP', Newest: 'NEWEST' } }
  };

  var copy = function (target, from) {
    if (from && typeof from === 'object') Object.keys(from).forEach(function (k) { target[k] = from[k]; });
    return target;
  };

  var record = function (kind, extra) {
    var C = function (obj) { this.plugin_type = kind; copy(this, extra); copy(this, obj); };
    return C;
  };

  var classes = {
    PlatformVideo: record('PlatformVideo', { contentType: 1 }),
    PlatformVideoDetails: record('PlatformVideoDetails', { contentType: 1 }),
    PlatformChannel: record('PlatformChannel', { contentType: 2 }),
    PlatformPlaylist: record('PlatformPlaylist', { contentType: 4 }),
    PlatformNestedMedia: record('PlatformNestedMedia', { contentType: 11 }),
    PlatformPost: record('PlatformPost', { contentType: 2 }),
    VideoUrlSource: record('VideoUrlSource'),
    VideoUrlRangeSource: record('VideoUrlRangeSource'),
    AudioUrlSource: record('AudioUrlSource'),
    AudioUrlRangeSource: record('AudioUrlRangeSource'),
    HLSSource: record('HLSSource'),
    DashSource: record('DashSource'),
    DashManifestRawSource: record('DashManifestRawSource'),
    DashManifestRawAudioSource: record('DashManifestRawAudioSource'),
    Chapter: record('Chapter'),
    PlatformComment: record('Comment'),
    SubtitleUrl: record('SubtitleUrl')
  };

  classes.PlatformID = function (platform, id, pluginId, claimType) {
    this.platform = platform || ''; this.value = id; this.pluginId = pluginId; this.claimType = claimType || 0;
  };
  classes.Thumbnail = function (url, quality) { this.url = url; this.quality = quality || 0; };
  classes.Thumbnails = function (thumbnails) { this.sources = thumbnails || []; };
  classes.PlatformAuthorLink = function (id, name, url, thumbnail, subscribers) {
    this.id = id; this.name = name; this.url = url; this.thumbnail = thumbnail; this.subscribers = subscribers;
  };
  classes.RatingLikes = function (likes) { this.type = 1; this.likes = likes; };
  classes.RatingLikesDislikes = function (likes, dislikes) { this.type = 2; this.likes = likes; this.dislikes = dislikes; };
  classes.RatingScaler = function (value) { this.type = 3; this.value = value; };
  classes.VideoSourceDescriptor = function (sources) { this.plugin_type = 'MuxVideoSourceDescriptor'; this.isUnMuxed = false; this.videoSources = sources || []; };
  classes.UnMuxVideoSourceDescriptor = function (video, audio) {
    this.plugin_type = 'UnMuxVideoSourceDescriptor'; this.isUnMuxed = true; this.videoSources = video || []; this.audioSources = audio || [];
  };

  var Pager = function (results, hasMore, context) {
    this.plugin_type = 'Pager'; this.results = results || []; this.hasMore = !!hasMore; this.context = context || {};
  };
  Pager.prototype.hasMorePagers = function () { return this.hasMore; };
  Pager.prototype.nextPage = function () { return new Pager([], false); };
  classes.Pager = Pager;
  ['ContentPager', 'VideoPager', 'ChannelPager', 'PlaylistPager', 'CommentPager'].forEach(function (name) { classes[name] = Pager; });

  var Fault = function (type, message) { this.name = type; this.message = message || type; this.type = type; };
  Fault.prototype = Object.create(Error.prototype);
  classes.ScriptException = function (a, b) { return new Fault('ScriptException', b === undefined ? a : b); };
  ['ScriptLoginRequiredException', 'LoginRequiredException', 'CaptchaRequiredException', 'ScriptCaptchaRequiredException',
    'ScriptExecutionException', 'ScriptImplementationException', 'ScriptTimeoutException', 'UnavailableException',
    'ScriptUnavailableException', 'ScriptAgeException', 'ScriptCriticalException', 'ScriptNotFoundException',
    'ScriptBlockedException'].forEach(function (name) {
    classes[name] = function (a, b) { return new Fault(name, b === undefined ? a : b); };
  });

  // --- what a plugin may reach

  var hostOf = function (url) {
    var m = /^[a-z]+:\/\/([^\/?#:]+)/i.exec(String(url));
    return m ? m[1].toLowerCase() : '';
  };

  // allowUrls names the sites a plugin says it needs; "everywhere" is the plugin saying any.
  var allowed = function (plugin, url) {
    var list = plugin.config.allowUrls || [];
    if (list.indexOf('everywhere') !== -1) return true;
    var host = hostOf(url);
    return list.some(function (a) {
      a = String(a).toLowerCase().replace(/^\./, '');
      return host === a || host.slice(-(a.length + 1)) === '.' + a;
    });
  };

  var toResponse = function (answer) {
    var headers = {};
    Object.keys(answer.headers || {}).forEach(function (k) { headers[k.toLowerCase()] = [].concat(answer.headers[k]); });
    return { isOk: answer.status >= 200 && answer.status < 300, code: answer.status, url: answer.url, body: answer.body, headers: headers };
  };

  var failure = function (url, why) {
    return { isOk: false, code: 0, url: url, body: '', headers: {}, error: why };
  };

  GJ.fetchOne = function (plugin, r) {
    if (!allowed(plugin, r.url)) return Promise.resolve(failure(r.url, 'The plugin did not list this site in allowUrls'));
    return SX.rawFetch({ url: r.url, method: r.method, headers: r.headers || {}, body: r.body }).then(toResponse, function (e) {
      return failure(r.url, e.message);
    });
  };

  var httpFor = function (plugin) {
    var one = function (method, url, body, headers) {
      var answers = plugin.ask([{ method: method, url: url, headers: headers || {}, body: body }]);
      return answers[0];
    };

    var api = {
      GET: function (url, headers) { return one('GET', url, null, headers); },
      POST: function (url, body, headers) { return one('POST', url, body, headers); },
      request: function (method, url, headers) { return one(String(method).toUpperCase(), url, null, headers); },
      requestWithBody: function (method, url, body, headers) { return one(String(method).toUpperCase(), url, body, headers); },
      batch: function () {
        var list = [];
        var builder = {
          GET: function (url, headers) { list.push({ method: 'GET', url: url, headers: headers || {} }); return builder; },
          POST: function (url, body, headers) { list.push({ method: 'POST', url: url, headers: headers || {}, body: body }); return builder; },
          request: function (method, url, headers) { list.push({ method: String(method).toUpperCase(), url: url, headers: headers || {} }); return builder; },
          requestWithBody: function (method, url, body, headers) { list.push({ method: String(method).toUpperCase(), url: url, headers: headers || {}, body: body }); return builder; },
          execute: function () { return plugin.ask(list); }
        };
        return builder;
      },
      // Which client is used makes no difference here.
      getDefaultClient: function () { return api; },
      newClient: function () { return api; }
    };
    return api;
  };

  var utility = {
    toBase64: function (s) { return root.btoa ? root.btoa(unescape(encodeURIComponent(String(s)))) : Buffer.from(String(s)).toString('base64'); },
    fromBase64: function (s) { return root.atob ? decodeURIComponent(escape(root.atob(String(s)))) : Buffer.from(String(s), 'base64').toString(); },
    random: function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
    randomString: function (n) { var o = ''; while (o.length < n) o += Math.random().toString(36).slice(2); return o.slice(0, n); }
  };

  // --- loading

  var resolve = function (ref, base) {
    if (/^https?:\/\//i.test(ref)) return ref;
    var m = /^(https?:\/\/[^\/]+)(\/.*)?$/i.exec(base);
    var host = m[1], parts = (m[2] || '/').split('?')[0].split('/');
    if (ref.charAt(0) === '/') return host + ref;
    parts.pop();
    ref.split('/').forEach(function (p) {
      if (p === '..') parts.pop();
      else if (p !== '.' && p !== '') parts.push(p);
    });
    return host + parts.join('/');
  };
  GJ.resolve = resolve;

  var defaultsOf = function (config) {
    var out = {};
    (config.settings || []).forEach(function (s) { if (s && s.variable) out[s.variable] = s['default'] !== undefined ? s['default'] : null; });
    return out;
  };

  // Runs fn, and runs it again after fetching whatever it asked for that was not there yet.
  GJ.run = function (plugin, fn) {
    var turn = plugin.queue.then(function () {
      var cache = [];
      var rounds = 0;

      var attempt = function () {
        rounds += 1;
        if (rounds > MOST_ROUNDS) return Promise.reject(new Error('The plugin asked for too many things in a row'));

        var at = 0;
        plugin.needed = null;
        plugin.ask = function (list) {
          if (at < cache.length) { at += 1; return cache[at - 1]; }
          plugin.needed = list;
          throw NEED;
        };

        var out, error = null;
        try { out = fn(); } catch (e) { error = e; }

        // A plugin that caught the stop and went on has its result thrown away too.
        if (plugin.needed) {
          var list = plugin.needed;
          plugin.needed = null;
          return Promise.all(list.map(function (r) { return GJ.fetchOne(plugin, r); })).then(function (answers) {
            cache.push(answers);
            return attempt();
          });
        }

        if (error) return Promise.reject(error);
        return Promise.resolve(out);
      };

      return attempt();
    });

    plugin.queue = turn.then(function () { /* next */ }, function () { /* next */ });
    return turn;
  };

  // Names the plugin's script finds in scope. The page's own objects are hidden behind plain ones,
  // which stops a plugin reaching them by accident; it is not a sandbox, so only plugins that are
  // trusted should be added.
  var HIDDEN = ['window', 'document', 'localStorage', 'sessionStorage', 'XMLHttpRequest', 'fetch', 'location', 'top', 'parent',
    'self', 'globalThis', 'indexedDB', 'AniNative', 'SX', 'SXUI', 'XDomainRequest', 'WebSocket', 'importScripts'];

  GJ.load = function (configUrl) {
    return SX.json(configUrl, 15000).then(function (config) {
      if (!config || !config.scriptUrl || !config.name) throw new Error('not a Grayjay plugin');
      return SX.text(resolve(config.scriptUrl, configUrl)).then(function (script) {
        return GJ.make(config, script, configUrl);
      });
    });
  };

  GJ.make = function (config, script, configUrl) {
    var plugin = { url: configUrl, config: config, queue: Promise.resolve(), ask: null, needed: null, source: {}, ready: false };
    var settings = defaultsOf(config);

    var scope = copy({}, classes);
    scope.Type = Type;
    scope.source = plugin.source;
    scope.plugin = { config: config, settings: settings };
    scope.http = httpFor(plugin);
    scope.utility = utility;
    scope.log = function () { /* nothing to show it in */ };
    scope.bridge = {
      log: function () {}, toast: function () {}, throwTest: function () {}, isLoggedIn: function () { return false; },
      isFeatureEnabled: function () { return false; }, buildVersion: 1, buildFlavor: 'stable', sdkVersion: 1, setCookie: function () {}
    };
    scope.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {}, debug: function () {} };
    scope.setTimeout = root.setTimeout ? root.setTimeout.bind(root) : undefined;

    var names = Object.keys(scope).concat(HIDDEN.filter(function (h) { return !(h in scope); }));
    var values = names.map(function (n) { return scope[n]; });

    var Maker = Function;
    var factory = new Maker(names.join(','), script);
    factory.apply(undefined, values);

    return GJ.run(plugin, function () {
      if (plugin.source.enable) plugin.source.enable(config, settings, null);
    }).then(function () {
      plugin.ready = true;
      return plugin;
    });
  };

  // --- what the plugin returns, as the page uses it

  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  var dateText = function (seconds) {
    if (!seconds || seconds < 1) return '';
    var d = new Date(seconds * 1000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  };

  var countText = function (n) {
    if (!n && n !== 0) return '';
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  };

  var bestThumb = function (thumbs) {
    var list = thumbs && thumbs.sources ? thumbs.sources : SX.arr(thumbs);
    var best = null;
    list.forEach(function (t) { if (t && t.url && (!best || (t.quality || 0) >= (best.quality || 0))) best = t; });
    return best ? best.url : '';
  };
  GJ.bestThumb = bestThumb;

  // A video as the rows show it. Anything that is not a video (a channel, a post) is left out.
  GJ.preview = function (plugin, v) {
    if (!v || !v.url || v.contentType !== 1) return null;
    var author = v.author && v.author.name ? v.author.name : '';
    var thumb = bestThumb(v.thumbnails);
    return {
      id: String(v.url), type: 'gjvideo', name: String(v.name || ''), poster: thumb, background: thumb,
      description: '', year: dateText(v.uploadDate), rating: '', genres: author ? [author] : [],
      runtime: v.isLive ? 'LIVE' : (v.duration > 0 ? SX.format(v.duration) : ''),
      addon: plugin.url, plugin: plugin.url, url: String(v.url), author: author, views: countText(v.viewCount)
    };
  };

  GJ.page = function (plugin, pager) {
    var items = SX.arr(pager && pager.results).map(function (v) { return GJ.preview(plugin, v); }).filter(Boolean);
    return {
      items: items,
      more: pager && pager.hasMorePagers && pager.hasMorePagers()
        ? function () { return GJ.run(plugin, function () { return pager.nextPage(); }).then(function (next) { return GJ.page(plugin, next); }); }
        : null
    };
  };

  GJ.home = function (plugin) {
    if (!plugin.source.getHome) return Promise.resolve({ items: [], more: null });
    return GJ.run(plugin, function () { return plugin.source.getHome(); }).then(function (p) { return GJ.page(plugin, p); });
  };

  GJ.search = function (plugin, query) {
    if (!plugin.source.search) return Promise.resolve({ items: [], more: null });
    return GJ.run(plugin, function () { return plugin.source.search(query, null, null, []); }).then(function (p) { return GJ.page(plugin, p); });
  };

  // The full entry for a video, and what can be played from it.
  GJ.details = function (plugin, item) {
    return GJ.run(plugin, function () { return plugin.source.getContentDetails(item.url); }).then(function (d) {
      if (!d) throw new Error('The plugin returned nothing for this video');
      var author = d.author && d.author.name ? d.author.name : item.author;
      var rating = d.rating && d.rating.likes !== undefined ? countText(d.rating.likes) + ' likes' : '';
      return {
        id: item.id, type: 'gjvideo', name: d.name || item.name, poster: bestThumb(d.thumbnails) || item.poster,
        background: bestThumb(d.thumbnails) || item.background, description: String(d.description || ''),
        year: dateText(d.uploadDate) || item.year, rating: rating, genres: author ? [author] : [], runtime: d.isLive ? 'LIVE' : (d.duration > 0 ? SX.format(d.duration) : ''),
        addon: plugin.url, plugin: plugin.url, url: item.url, author: author, views: countText(d.viewCount), videos: [],
        sources: GJ.sources(plugin, d)
      };
    });
  };

  var sizeOf = function (s) { return s.height ? s.height + 'p' : (s.name || ''); };

  // The sources a TV page can play: a whole file or a playlist. A video kept apart from its sound
  // (what some sites give for the best quality) and DASH need a player this page does not have.
  GJ.sources = function (plugin, d) {
    var video = d.video || {};
    var out = [];
    var unmuxed = !!video.isUnMuxed;
    var name = plugin.config.name;
    var line = function (s) { return [s.container, s.codec, s.bitrate ? Math.round(s.bitrate / 1000) + ' kbps' : ''].filter(Boolean).join('  ·  '); };

    SX.arr(video.videoSources).forEach(function (s) {
      if (!s || !s.url) return;
      var type = s.plugin_type || '';
      var base = { addon: name, addonUrl: plugin.url, filename: '', size: 0, group: '', notWeb: false, infoHash: '', ytId: '', headers: s.requestModifier || null };

      if (type === 'HLSSource') out.push(copy({ kind: 'direct', url: s.url, name: s.name || 'HLS', detail: (s.name || 'HLS') + '\nHLS playlist' }, base));
      else if (type === 'DashSource' || type === 'DashManifestRawSource') out.push(copy({ kind: 'unknown', url: s.url, name: s.name || 'DASH', detail: 'DASH\nThis TV page cannot play DASH' }, base));
      else if (unmuxed) out.push(copy({ kind: 'unknown', url: s.url, name: sizeOf(s), detail: sizeOf(s) + (s.container ? ' ' + s.container : '') + '\nVideo only: its sound is a separate file' }, base));
      else out.push(copy({ kind: 'direct', url: s.url, name: sizeOf(s), detail: (s.name || sizeOf(s)) + '\n' + line(s), height: s.height || 0 }, base));
    });

    // Best picture first among the ones that play.
    return out.sort(function (a, b) { return (a.kind === 'direct' ? 0 : 1) - (b.kind === 'direct' ? 0 : 1) || (b.height || 0) - (a.height || 0); });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GJ;
  else root.GJ = GJ;
})(typeof window !== 'undefined' ? window : globalThis);
