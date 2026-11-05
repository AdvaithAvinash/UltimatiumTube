// The Stremio page: screens, remote control and the player. Plain ES5, for the TV's YouTube engine.
(function () {
  'use strict';

  var SX = window.SX;
  var D = document;
  var $ = function (id) { return D.getElementById(id); };
  var esc = function (s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var el = function (tag, cls, html) {
    var e = D.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  var cut = function (s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  var now = function () { return new Date().getTime(); };

  var TABS = [['home', 'Home'], ['movies', 'Movies'], ['series', 'Series'], ['search', 'Search'], ['library', 'Library'], ['addons', 'Addons']];
  var TYPE_NAMES = { movie: 'Movies', series: 'Series', tv: 'TV', channel: 'Channels', anime: 'Anime' };

  var SINGULAR = { movie: 'Movie', series: 'Series', tv: 'TV', channel: 'Channel', anime: 'Anime' };

  var S = {
    addons: [], phone: [], stack: [], focus: null, tab: 'home', loaded: false, heroTimer: 0,
    last: {}
  };

  // --- fitting the 1920 x 1080 page to the screen

  var fit = function () {
    var w = window.innerWidth || 1920, h = window.innerHeight || 1080;
    var k = Math.min(w / 1920, h / 1080);
    var app = $('app');
    app.style.transformOrigin = '0 0';
    app.style.webkitTransformOrigin = '0 0';
    app.style.transform = 'scale(' + k + ')';
    app.style.webkitTransform = 'scale(' + k + ')';
    app.style.left = Math.round((w - 1920 * k) / 2) + 'px';
    app.style.top = Math.round((h - 1080 * k) / 2) + 'px';
  };

  // --- leaving

  var leave = function () {
    try { if (window.AniNative && window.AniNative.exit) { window.AniNative.exit(); return; } } catch (e) { /* none */ }
    window.location.replace('/tv');
  };

  // --- messages

  var toastTimer = 0;
  var toast = function (text) {
    var t = $('toast');
    t.innerHTML = '<span>' + esc(text) + '</span>';
    t.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, 3200);
  };

  // --- images: set when wanted, not when built, so a long row does not ask for every picture

  var setImg = function (holder, url, cls) {
    if (!url) return;
    var img = holder.querySelector('img');
    if (!img) { img = D.createElement('img'); holder.appendChild(img); }
    if (img.getAttribute('data-u') === url) return;
    img.setAttribute('data-u', url);
    img.className = cls || '';
    img.onload = function () { img.className = (cls ? cls + ' ' : '') + 'show'; };
    img.onerror = function () { img.className = cls || ''; };
    img.src = SX.route(url);
  };

  // --- focus

  var visible = function (e) {
    for (var p = e; p && p !== D.body; p = p.parentNode) {
      if (p.className && /(^| )hidden( |$)/.test(p.className)) return false;
    }
    return true;
  };

  var area = function () {
    if ($('dialog').className.indexOf('open') !== -1) return $('dialog');
    var top = S.stack[S.stack.length - 1];
    return top ? top.root : D.body;
  };

  var focusables = function () {
    var list = [].slice.call(area().querySelectorAll('.f'));
    if (S.stack.length && S.stack[S.stack.length - 1].tabs && $('dialog').className.indexOf('open') === -1) {
      list = list.concat([].slice.call($('tabs').querySelectorAll('.f')));
    }
    return list.filter(visible);
  };

  var rectOf = function (e) { return e.getBoundingClientRect(); };

  var setFocus = function (e) {
    if (!e) return;
    if (S.focus && S.focus !== e) S.focus.className = S.focus.className.replace(/ ?\bon\b/g, '');
    S.focus = e;
    if (e.className.indexOf(' on') === -1 && !/(^| )on( |$)/.test(e.className)) e.className += ' on';
    var top = S.stack[S.stack.length - 1];
    if (top) top.focus = e;
    if (e.__reveal) e.__reveal(e);
    if (e.__focus) e.__focus(e);
  };

  var move = function (dir) {
    S.moved = true;
    var cur = S.focus;
    var list = focusables();
    if (!cur || list.indexOf(cur) === -1) { if (list.length) setFocus(list[0]); return; }

    var c = rectOf(cur), cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    var best = null, score = 1e12;

    list.forEach(function (e) {
      if (e === cur) return;
      var r = rectOf(e), x = r.left + r.width / 2, y = r.top + r.height / 2;
      var dx = x - cx, dy = y - cy, along, across;

      if (dir === 'right') { along = r.left - c.right + c.width * 0; if (dx <= 4) return; across = Math.abs(dy); along = dx; }
      else if (dir === 'left') { if (dx >= -4) return; across = Math.abs(dy); along = -dx; }
      else if (dir === 'down') { if (dy <= 4) return; across = Math.abs(dx); along = dy; }
      else { if (dy >= -4) return; across = Math.abs(dx); along = -dy; }

      // Mostly the one straight ahead; a long way off the line counts against it.
      var s = along + across * 3;
      if (s < score) { score = s; best = e; }
    });

    if (best) setFocus(best);
  };

  // Scroll a strip so the element is in view: x for a row of cards, y for a list.
  var shiftX = function (e, track, view) {
    var left = e.offsetLeft, right = left + e.offsetWidth;
    var x = track.__x || 0, width = view.offsetWidth, pad = 80;
    if (left - x < pad) x = left - pad;
    else if (right - x > width - pad) x = right - width + pad;
    x = Math.max(0, x);
    track.__x = x;
    track.style.transform = 'translateX(' + (-x) + 'px)';
    track.style.webkitTransform = 'translateX(' + (-x) + 'px)';
  };

  // A row of a home screen goes to the top of its area, so one row shows whole and the next peeks.
  var alignRow = function (row, inner) {
    inner.__y = row.offsetTop;
    inner.style.transform = 'translateY(' + (-row.offsetTop) + 'px)';
    inner.style.webkitTransform = 'translateY(' + (-row.offsetTop) + 'px)';
  };

  var shiftY = function (e, inner, view, keep) {
    var top = e.offsetTop, bottom = top + e.offsetHeight;
    var y = inner.__y || 0, height = view.offsetHeight;
    if (top - y < 0) y = top;
    else if (bottom - y > height - (keep || 0)) y = bottom - height + (keep || 0);
    y = Math.max(0, y);
    inner.__y = y;
    inner.style.transform = 'translateY(' + (-y) + 'px)';
    inner.style.webkitTransform = 'translateY(' + (-y) + 'px)';
  };

  // --- screens

  var addScreen = function (spec) {
    var root = el('div', 'screen');
    $('screens').appendChild(root);
    var top = S.stack[S.stack.length - 1];
    if (top) top.root.className += ' hidden';
    spec.root = root;
    S.stack.push(spec);
    $('tabs').className = spec.tabs ? '' : 'off';
    return spec;
  };

  var restore = function (spec) {
    spec.root.className = spec.root.className.replace(/ ?\bhidden\b/g, '');
    $('tabs').className = spec.tabs ? '' : 'off';
    markTabs(spec.tab);
    var again = spec.focus && visible(spec.focus) ? spec.focus : focusables()[0];
    setFocus(again);
  };

  var closeTop = function () {
    var gone = S.stack.pop();
    if (gone) {
      if (gone.close) gone.close();
      if (gone.root.parentNode) gone.root.parentNode.removeChild(gone.root);
    }
    if (S.stack.length) restore(S.stack[S.stack.length - 1]);
  };

  var back = function () {
    if ($('dialog').className.indexOf('open') !== -1) { closeDialog(); return; }
    if (playing()) { stopPlayer(); return; }

    if (S.stack.length > 1) { closeTop(); return; }
    if (S.tab !== 'home') { showTab('home'); return; }
    leave();
  };

  // --- tabs

  var buildTabs = function () {
    var bar = $('tabs');
    bar.innerHTML = '<div class="brand">Stremio</div>';
    TABS.forEach(function (t) {
      var b = el('div', 'tab f', t[1]);
      b.setAttribute('data-tab', t[0]);
      b.__ok = function () { showTab(t[0]); };
      bar.appendChild(b);
    });
  };

  var markTabs = function (name) {
    [].forEach.call($('tabs').querySelectorAll('.tab'), function (b) {
      var on = b.getAttribute('data-tab') === name;
      b.className = b.className.replace(/ ?\bcur\b/g, '') + (on ? ' cur' : '');
    });
  };

  var showTab = function (name) {
    // A tab replaces whatever is on the screen; the pages opened from it are closed.
    while (S.stack.length) {
      var g = S.stack.pop();
      if (g.close) g.close();
      if (g.root.parentNode) g.root.parentNode.removeChild(g.root);
    }
    S.tab = name;
    S.focus = null;
    S.moved = false;
    markTabs(name);

    var make = { home: homeTab, movies: homeTab, series: homeTab, search: searchTab, library: libraryTab, addons: addonsTab }[name];
    var spec = make(name);
    var first = spec.start ? spec.start() : null;
    setFocus(first || focusables()[0]);
  };

  // --- what was watched, and the library

  var progress = function () { return SX.store.get('prog', {}); };
  var saveProgress = function (key, entry) {
    var all = progress();
    all[key] = entry;
    // Only the most recent hundred are kept.
    var keys = Object.keys(all).sort(function (a, b) { return all[b].at - all[a].at; });
    keys.slice(100).forEach(function (k) { delete all[k]; });
    SX.store.set('prog', all);
  };
  var library = function () { return SX.store.get('lib', []); };
  var inLibrary = function (item) {
    return library().some(function (l) { return l.id === item.id && l.type === item.type; });
  };
  var toggleLibrary = function (item) {
    var list = library();
    var has = inLibrary(item);
    list = list.filter(function (l) { return !(l.id === item.id && l.type === item.type); });
    if (!has) list.unshift({ id: item.id, type: item.type, name: item.name, poster: item.poster, background: item.background, description: item.description, year: item.year, rating: item.rating, genres: item.genres, addon: item.addon });
    SX.store.set('lib', list);
    return !has;
  };

  // Unfinished things, newest first, one for each show.
  var continueList = function () {
    var all = progress(), seen = {};
    return Object.keys(all).map(function (k) { return all[k]; })
      .filter(function (p) { return p.d > 0 && p.t > 60 && p.t / p.d < 0.93; })
      .sort(function (a, b) { return b.at - a.at; })
      .filter(function (p) { var k = p.type + p.id; if (seen[k]) return false; seen[k] = 1; return true; })
      .slice(0, 20)
      .map(function (p) {
        return { id: p.id, type: p.type, name: p.name, poster: p.poster, background: p.background, description: p.description || '', year: p.year || '', rating: p.rating || '', genres: p.genres || [], addon: p.addon || '', fraction: p.t / p.d, label: p.label || '' };
      });
  };

  // --- cards and rows

  var makeCard = function (item) {
    var card = el('div', 'card f');
    var frac = item.fraction ? '<div class="bar"><i style="width:' + Math.round(item.fraction * 100) + '%"></i></div>' : '';
    var tag = item.rating && !item.fraction ? '<div class="tag">★ ' + esc(item.rating) + '</div>' : '';
    card.innerHTML = '<div class="cimg"><div class="noimg">' + esc(cut(item.name, 40)) + '</div>' + tag + frac + '</div>'
      + '<div class="ctitle">' + esc(item.name) + '</div>';
    card.__item = item;
    card.__ok = function () { openDetail(item); };
    return card;
  };

  var loadAround = function (track, index) {
    var cards = track.children;
    for (var i = Math.max(0, index - 3); i < Math.min(cards.length, index + 10); i += 1) {
      var c = cards[i];
      if (c.__item && c.__item.poster) setImg(c.querySelector('.cimg'), c.__item.poster);
    }
  };

  // A row of cards. `source` may add more when the end is reached.
  var makeRow = function (title, items, opts) {
    opts = opts || {};
    var row = el('div', 'row');
    row.innerHTML = '<div class="rowtitle">' + esc(title) + '</div><div class="rowview"><div class="track"></div></div>';
    var track = row.querySelector('.track'), view = row.querySelector('.rowview');
    var more = { next: opts.more || null, busy: false };

    var addCards = function (list) {
      list.forEach(function (item) {
        var c = makeCard(item);
        c.__reveal = function () {
          shiftX(c, track, view);
          loadAround(track, [].indexOf.call(track.children, c));
          if (opts.onReveal) opts.onReveal(row, c);
          if (more.next && !more.busy && track.children.length - [].indexOf.call(track.children, c) < 6) {
            more.busy = true;
            more.next().then(function (extra) {
              more.busy = false;
              if (!extra || !extra.length) more.next = null; else addCards(extra);
            }, function () { more.busy = false; more.next = null; });
          }
        };
        c.__focus = function () { if (opts.onFocus) opts.onFocus(item); };
        track.appendChild(c);
      });
    };

    addCards(items);
    loadAround(track, 0);
    row.__add = addCards;
    return row;
  };

  // --- the hero and the rows of a home screen

  var rowSpecs = function (kind) {
    var specs = [];
    S.addons.forEach(function (a) {
      if (!a.manifest) return;
      SX.homeCatalogs(a.manifest).forEach(function (c) {
        if ((kind === 'movies' && c.type !== 'movie') || (kind === 'series' && c.type !== 'series')) return;
        var name = c.name || c.id;
        var many = S.addons.filter(function (x) { return x.manifest && SX.homeCatalogs(x.manifest).length; }).length > 1;
        specs.push({ addon: a, catalog: c, title: name + ' · ' + (TYPE_NAMES[c.type] || c.type) + (many ? ' · ' + a.manifest.name : '') });
      });
    });
    return specs;
  };

  var homeTab = function (kind) {
    var spec = addScreen({ tabs: true, tab: kind });
    var root = spec.root;
    root.innerHTML = '<div class="bg"><img><img></div><div class="shade"></div>'
      + '<div class="hero"><h1></h1><div class="meta"></div><div class="desc"></div><div class="buttons"></div></div>'
      + '<div class="rowswrap"><div class="rows"></div></div>';

    var hero = { item: null, front: 0, timer: 0 };
    var imgs = root.querySelectorAll('.bg img');
    var rows = root.querySelector('.rows'), wrap = root.querySelector('.rowswrap');

    var play = el('div', 'btn main f', '▶  Play');
    var info = el('div', 'btn f', 'Details');
    play.__ok = function () { if (hero.item) openDetail(hero.item, true); };
    info.__ok = function () { if (hero.item) openDetail(hero.item); };
    root.querySelector('.buttons').appendChild(play);
    root.querySelector('.buttons').appendChild(info);

    var showHero = function (item) {
      if (!item || hero.item === item) return;
      hero.item = item;
      clearTimeout(hero.timer);
      hero.timer = setTimeout(function () {
        var h1 = root.querySelector('.hero h1');
        h1.textContent = item.name;
        var bits = [];
        if (item.rating) bits.push('<b>★ ' + esc(item.rating) + '</b>');
        if (item.year) bits.push(esc(item.year));
        if (item.runtime) bits.push(esc(item.runtime));
        bits.push('<span class="chip">' + esc(SINGULAR[item.type] || item.type || '') + '</span>');
        if (item.genres && item.genres.length) bits.push(esc(item.genres.slice(0, 3).join(' · ')));
        root.querySelector('.hero .meta').innerHTML = bits.join('&nbsp;&nbsp;');
        root.querySelector('.hero .desc').textContent = cut(item.description, 260);

        var url = item.background || item.poster;
        if (url) {
          var next = imgs[1 - hero.front];
          next.onload = function () {
            next.className = 'show';
            imgs[hero.front].className = '';
            hero.front = 1 - hero.front;
          };
          next.onerror = function () { /* keeps the one before */ };
          next.src = SX.route(url);
        }
      }, 220);
    };

    var holder = { rows: [] };

    var addRow = function (title, items, opts) {
      var row = makeRow(title, items, Object.assign({
        onFocus: showHero,
        onReveal: function (r) { alignRow(r, rows); }
      }, opts || {}));
      rows.appendChild(row);
      holder.rows.push(row);
      return row;
    };

    spec.start = function () {
      var recent = kind === 'home' ? continueList() : [];
      if (recent.length) addRow('Continue watching', recent);

      var specs = rowSpecs(kind);

      if (!specs.length && !recent.length) {
        rows.appendChild(el('div', 'empty', S.addons.length ? 'None of your addons has a catalog to show here.' : 'No addons yet. Open Addons to add one.'));
      }

      // A placeholder for each row, so they keep their order, and each is replaced as its catalog answers.
      specs.forEach(function (s) {
        var placeholder = el('div', 'row');
        placeholder.innerHTML = '<div class="rowtitle">' + esc(s.title) + '</div><div class="empty"><span class="spin"></span>Loading</div>';
        rows.appendChild(placeholder);
      });

      specs.forEach(function (s, i) {
        var placeholder = rows.children[(recent.length ? 1 : 0) + i];
        SX.catalog(s.addon, s.catalog, {}).then(function (items) {
          if (!placeholder.parentNode) return;
          if (!items.length) { placeholder.parentNode.removeChild(placeholder); return; }

          var paged = SX.pages(s.catalog);
          var skip = { n: items.length };
          var row = makeRow(s.title, items, {
            onFocus: showHero,
            onReveal: function (r) { alignRow(r, rows); },
            more: paged ? function () {
              return SX.catalog(s.addon, s.catalog, { skip: skip.n }).then(function (more) { skip.n += more.length; return more; });
            } : null
          });
          rows.replaceChild(row, placeholder);

          var first = row.querySelector('.card');
          if (first && !hero.item) { showHero(first.__item); if (!S.moved && S.stack[S.stack.length - 1] === spec) setFocus(first); }
        }, function () {
          if (placeholder.parentNode) placeholder.querySelector('.empty').innerHTML = 'Could not load this catalog.';
        });
      });

      var firstCard = rows.querySelector('.card');
      if (firstCard) { showHero(firstCard.__item); return firstCard; }
      return null;
    };

    spec.close = function () { clearTimeout(hero.timer); };
    return spec;
  };

  // --- detail

  var openDetail = function (item, autoPlay) {
    var spec = addScreen({ tabs: false });
    var root = spec.root;
    root.innerHTML = '<div class="bg"><img></div><div class="shade"></div><div class="msg"><span class="spin"></span>Loading</div>';
    setImg(root.querySelector('.bg'), item.background || item.poster);
    setFocus(null);

    SX.meta(S.addons, item).then(function (full) {
      if (S.stack.indexOf(spec) === -1) return;
      renderDetail(spec, full, autoPlay);
    });
  };

  var seasonsOf = function (videos) {
    var seen = {}, list = [];
    videos.forEach(function (v) { if (!seen[v.season]) { seen[v.season] = 1; list.push(v.season); } });
    // Specials (season 0) last.
    return list.sort(function (a, b) { return (a || 1e6) - (b || 1e6); });
  };

  var watchedFraction = function (type, id) {
    var p = progress()[SX.watchKey(type, id)];
    return p && p.d ? p.t / p.d : 0;
  };

  var resumeFor = function (full) {
    var all = progress(), best = null;
    Object.keys(all).forEach(function (k) {
      var p = all[k];
      if (p.type === full.type && p.id === full.id && (!best || p.at > best.at)) best = p;
    });
    return best && best.d && best.t > 60 && best.t / best.d < 0.93 ? best : null;
  };

  var renderDetail = function (spec, full, autoPlay) {
    var root = spec.root;
    var isSeries = full.type === 'series' && full.videos.length > 0;
    var seasons = isSeries ? seasonsOf(full.videos) : [];
    var resume = resumeFor(full);
    var bits = [];
    if (full.rating) bits.push('<b>★ ' + esc(full.rating) + '</b>');
    if (full.year) bits.push(esc(full.year));
    if (full.runtime) bits.push(esc(full.runtime));
    if (full.genres.length) bits.push(esc(full.genres.slice(0, 4).join(' · ')));

    var people = '';
    if (full.director && full.director.length) people += '<div class="people"><b>Director</b>&nbsp; ' + esc(full.director.slice(0, 3).join(', ')) + '</div>';
    if (full.cast && full.cast.length) people += '<div class="people"><b>Cast</b>&nbsp; ' + esc(full.cast.slice(0, 6).join(', ')) + '</div>';

    root.innerHTML = '<div class="bg"><img></div><div class="shade"></div>'
      + '<div class="dposter"></div>'
      + '<div class="dinfo"><h1>' + esc(full.name) + '</h1><div class="meta">' + bits.join('&nbsp;&nbsp;') + '</div>'
      + '<div class="desc">' + esc(cut(full.description, 400)) + '</div>' + people + '<div class="buttons"></div></div>'
      + (isSeries ? '<div class="seasons"><div class="strack"></div></div><div class="eplist"><div class="eps"></div></div>' : '');

    setImg(root.querySelector('.bg'), full.background || full.poster);
    setImg(root.querySelector('.dposter'), full.poster);
    if (isSeries) root.querySelector('.dinfo .desc').style.maxHeight = '80px';

    var buttons = root.querySelector('.buttons');
    var playBtn = null;

    var streamsFor = function (video) {
      var label = full.name + (video ? '  ·  S' + video.season + ' E' + video.episode + (video.title ? '  ' + video.title : '') : '');
      openStreams(full, video, label);
    };

    if (!isSeries) {
      playBtn = el('div', 'btn main f', resume ? '▶  Resume ' + SX.format(resume.t) : '▶  Play');
      playBtn.__ok = function () { streamsFor(null); };
    } else {
      var target = null;
      if (resume) target = full.videos.filter(function (v) { return v.id === resume.videoId; })[0] || null;
      if (!target) target = full.videos.filter(function (v) { return v.season > 0; })[0] || full.videos[0];
      playBtn = el('div', 'btn main f', resume && target ? '▶  Resume S' + target.season + ' E' + target.episode : '▶  Play S' + target.season + ' E' + target.episode);
      playBtn.__ok = function () { streamsFor(target); };
      spec.target = target;
    }
    buttons.appendChild(playBtn);

    var save = el('div', 'btn f', inLibrary(full) ? '✓  In library' : '+  Library');
    save.__ok = function () {
      var added = toggleLibrary(full);
      save.innerHTML = added ? '✓  In library' : '+  Library';
      toast(added ? 'Added to your library' : 'Removed from your library');
    };
    buttons.appendChild(save);

    if (isSeries) {
      var strack = root.querySelector('.strack'), sview = root.querySelector('.seasons');
      var eps = root.querySelector('.eps'), eview = root.querySelector('.eplist');
      var chosen = { season: target ? target.season : seasons[0] };

      var drawEpisodes = function () {
        eps.innerHTML = '';
        eps.__y = 0;
        eps.style.transform = 'translateY(0)';
        full.videos.filter(function (v) { return v.season === chosen.season; })
          .sort(function (a, b) { return a.episode - b.episode; })
          .forEach(function (v) {
            var f = watchedFraction(full.type, v.id);
            var row = el('div', 'ep f');
            row.innerHTML = '<div class="th"></div><div class="tx"><div class="t1">' + v.episode + '.  ' + esc(v.title || 'Episode ' + v.episode) + '</div>'
              + '<div class="t2">' + esc(cut(v.overview, 150)) + '</div></div>'
              + (f > 0.93 ? '<div class="seen">✓</div>' : '')
              + (f > 0 && f <= 0.93 ? '<div class="bar"><i style="width:' + Math.round(f * 100) + '%"></i></div>' : '');
            if (v.thumbnail) setImg(row.querySelector('.th'), v.thumbnail);
            row.__ok = function () { streamsFor(v); };
            row.__reveal = function () { shiftY(row, eps, eview, 0); };
            eps.appendChild(row);
          });
      };

      seasons.forEach(function (n) {
        var chip = el('div', 'chip2 f' + (n === chosen.season ? ' cur' : ''), n === 0 ? 'Specials' : 'Season ' + n);
        chip.__ok = function () {
          chosen.season = n;
          [].forEach.call(strack.children, function (c) { c.className = c.className.replace(/ ?\bcur\b/g, ''); });
          chip.className += ' cur';
          drawEpisodes();
        };
        chip.__reveal = function () { shiftX(chip, strack, sview); };
        strack.appendChild(chip);
      });
      drawEpisodes();
    }

    spec.focus = playBtn;
    setFocus(playBtn);
    if (autoPlay && !isSeries) playBtn.__ok();
  };

  // --- streams

  var openStreams = function (full, video, label) {
    var spec = addScreen({ tabs: false });
    var root = spec.root;
    var type = full.type, id = video ? video.id : full.id;

    root.innerHTML = '<div class="bg"><img></div><div class="shade flat"></div>'
      + '<div class="head"><h1>' + esc(label) + '</h1><div class="sub">Choose a stream</div></div>'
      + '<div class="slist"><div class="sinner"></div></div>';
    setImg(root.querySelector('.bg'), full.background || full.poster);

    var inner = root.querySelector('.sinner'), view = root.querySelector('.slist'), sub = root.querySelector('.sub');
    var all = [], answered = { n: 0 };
    var ctx = { full: full, video: video, label: label, type: type, id: id };

    var draw = function () {
      var keep = S.focus && inner.contains(S.focus) ? S.focus.__stream : null;
      inner.innerHTML = '';
      inner.__y = 0;
      inner.style.transform = 'translateY(0)';

      var sorted = SX.sortStreams(all);
      sorted.forEach(function (st) {
        var playable = st.kind === 'direct' || st.kind === 'youtube';
        var lines = st.detail.split('\n').filter(Boolean);
        var size = /[0-9] ?[GM]B/i.test(st.detail) ? '' : SX.sizeText(st.size);
        var kind = { direct: 'Play', youtube: 'Play on YouTube', torrent: 'Torrent: needs a debrid addon', external: 'Opens another app', unknown: 'Not playable' }[st.kind];
        var row = el('div', 's f' + (playable ? '' : ' no'));
        row.innerHTML = '<div class="addon">' + esc(cut(st.addon, 24)) + '<i>' + esc(cut(st.name, 28)) + '</i></div>'
          + '<div class="body"><div class="n">' + esc(cut(lines[0] || st.filename || st.name || 'Stream', 90)) + '</div>'
          + '<div class="d">' + esc(cut(lines.slice(1).join('  ·  ') + (size ? '  ·  ' + size : ''), 220)) + '</div></div>'
          + '<div class="kind">' + esc(kind) + '</div>';
        row.__stream = st;
        row.__reveal = function () { shiftY(row, inner, view, 0); };
        row.__ok = function () { chooseStream(ctx, st, sorted); };
        inner.appendChild(row);
      });

      if (!sorted.length) {
        inner.appendChild(el('div', 'note', answered.n < asked
          ? '<span class="spin"></span>Asking your addons'
          : asked === 0 ? 'None of your addons has streams for this. Add one in Addons (for example one that gives direct links through a debrid service).' : 'No streams found.'));
      }

      var rows = inner.querySelectorAll('.s');
      var again = keep ? [].filter.call(rows, function (r) { return r.__stream === keep; })[0] : null;
      var firstPlayable = [].filter.call(rows, function (r) { return r.className.indexOf(' no') === -1; })[0];
      var target = again || firstPlayable || rows[0] || null;
      if (target && (!S.focus || !visible(S.focus) || !spec.root.contains(S.focus) || !keep)) setFocus(target);
      sub.innerHTML = answered.n < asked ? 'Asking ' + (asked - answered.n) + ' of ' + asked + ' addons…' : (sorted.length + ' stream' + (sorted.length === 1 ? '' : 's'));
    };

    var asked = 0;
    var request = SX.streams(S.addons, type, id, function (addon, list) {
      answered.n += 1;
      all = all.concat(list);
      if (S.stack.indexOf(spec) !== -1) draw();
    });
    asked = request.asked;
    setFocus(null);
    draw();
    spec.close = function () { /* answers that arrive late find the screen gone */ };
    return spec;
  };

  var chooseStream = function (ctx, st, siblings) {
    if (st.kind === 'direct') { startPlayer(ctx, st, siblings); return; }

    if (st.kind === 'youtube') {
      var id = st.ytId;
      if (!SX.origin) { toast('YouTube streams open only on a Samsung TV'); return; }
      window.location.assign('/tv#/watch?v=' + encodeURIComponent(id));
      return;
    }

    if (st.kind === 'torrent') {
      toast('This is a torrent. Use an addon set up with a debrid service, which gives a direct link');
      return;
    }

    toast('This stream cannot be played here');
  };

  // --- search

  var KEYS = ['ABCDEFGH', 'IJKLMNOP', 'QRSTUVWX', 'YZ012345', '6789-\'.:'];

  var searchTab = function () {
    var spec = addScreen({ tabs: true, tab: 'search' });
    var root = spec.root;
    root.innerHTML = '<div class="bg"><div class="shade flat" style="position:absolute"></div></div>'
      + '<div class="skeys"><div class="query ph">Search movies and series</div></div>'
      + '<div class="results"><div class="rows"></div></div>';

    var query = root.querySelector('.query'), keys = root.querySelector('.skeys');
    var rows = root.querySelector('.rows'), wrap = root.querySelector('.results');
    var st = { q: '', timer: 0, token: 0 };

    var run = function () {
      st.token += 1;
      var mine = st.token;
      rows.innerHTML = '';
      rows.__y = 0;
      rows.style.transform = 'translateY(0)';
      if (!st.q) return;

      var asked = 0, got = 0;
      S.addons.forEach(function (a) {
        if (!a.manifest) return;
        SX.searchCatalogs(a.manifest).forEach(function (c) {
          asked += 1;
          SX.catalog(a, c, { search: st.q }).then(function (items) {
            got += 1;
            if (mine !== st.token || !items.length) return;
            var row = makeRow((TYPE_NAMES[c.type] || c.type) + ' · ' + a.manifest.name, items, {
              onReveal: function (r) { alignRow(r, rows); }
            });
            rows.appendChild(row);
          }, function () { got += 1; }).then(function () {
            if (mine === st.token && got === asked && !rows.children.length) rows.appendChild(el('div', 'empty', 'Nothing found for “' + esc(st.q) + '”'));
          });
        });
      });

      if (!asked) rows.appendChild(el('div', 'empty', 'None of your addons can search.'));
    };

    var update = function () {
      query.className = 'query' + (st.q ? '' : ' ph');
      query.textContent = st.q || 'Search movies and series';
      clearTimeout(st.timer);
      st.timer = setTimeout(run, 700);
    };

    var press = function (text) {
      if (text === 'back') st.q = st.q.slice(0, -1);
      else if (text === 'clear') st.q = '';
      else if (text === 'space') st.q = st.q && st.q.slice(-1) !== ' ' ? st.q + ' ' : st.q;
      else st.q += text.toLowerCase();
      update();
    };

    KEYS.forEach(function (line) {
      var r = el('div', 'krow');
      line.split('').forEach(function (ch) {
        var k = el('div', 'key f', esc(ch));
        k.__ok = function () { press(ch); };
        r.appendChild(k);
      });
      keys.appendChild(r);
    });
    var last = el('div', 'krow');
    [['Space', 'space'], ['⌫ Delete', 'back'], ['Clear', 'clear']].forEach(function (p) {
      var k = el('div', 'key wide f', p[0]);
      k.__ok = function () { press(p[1]); };
      last.appendChild(k);
    });
    keys.appendChild(last);

    spec.start = function () { return keys.querySelector('.key'); };
    spec.close = function () { clearTimeout(st.timer); };
    return spec;
  };

  // --- library

  var libraryTab = function () {
    var spec = addScreen({ tabs: true, tab: 'library' });
    var root = spec.root;
    root.innerHTML = '<div class="bg"><div class="shade flat" style="position:absolute"></div></div>'
      + '<div class="rowswrap" style="top:150px;height:930px"><div class="rows"></div></div>';
    var rows = root.querySelector('.rows'), wrap = root.querySelector('.rowswrap');

    var add = function (title, items) {
      if (!items.length) return;
      rows.appendChild(makeRow(title, items, { onReveal: function (r) { alignRow(r, rows); } }));
    };

    var recent = continueList(), saved = library();
    add('Continue watching', recent);
    add('Saved movies', saved.filter(function (x) { return x.type === 'movie'; }));
    add('Saved series', saved.filter(function (x) { return x.type === 'series'; }));
    add('Saved', saved.filter(function (x) { return x.type !== 'movie' && x.type !== 'series'; }));

    if (!rows.children.length) rows.appendChild(el('div', 'empty', 'Nothing here yet. Open a title and choose Library, or start watching something.'));

    spec.start = function () { return rows.querySelector('.card'); };
    return spec;
  };

  // --- dialogs

  var closeDialog = function () {
    var d = $('dialog');
    d.className = '';
    d.innerHTML = '';
    if (S.stack.length) {
      var top = S.stack[S.stack.length - 1];
      if (top.focus && visible(top.focus)) setFocus(top.focus);
    }
  };

  var openDialog = function (title, text, buttons, input) {
    var d = $('dialog');
    d.className = 'open';
    d.innerHTML = '<div class="box"><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>'
      + (input ? '<input type="text" id="dlgInput" placeholder="' + esc(input) + '">' : '') + '<div class="buttons"></div></div>';
    var holder = d.querySelector('.buttons');
    var first = null;

    if (input) {
      var field = $('dlgInput');
      var focusField = el('div', 'btn f', 'Type the address');
      focusField.__ok = function () { field.focus(); };
      holder.appendChild(focusField);
      first = focusField;
    }

    buttons.forEach(function (b, i) {
      var btn = el('div', 'btn f' + (i === 0 ? ' main' : ''), esc(b[0]));
      btn.__ok = function () {
        var typed = input ? $('dlgInput').value : '';
        closeDialog();
        b[1](typed);
      };
      holder.appendChild(btn);
      if (!first) first = btn;
    });
    setFocus(first);
  };

  // --- addons

  var addonsTab = function () {
    var spec = addScreen({ tabs: true, tab: 'addons' });
    var root = spec.root;
    root.innerHTML = '<div class="bg"><div class="shade flat" style="position:absolute"></div></div>'
      + '<div class="hint">Addons give this page its catalogs and streams. More can be listed in UltimatiumTube settings: Ultimate Settings, then Stremio. Use addons that give direct links; a TV cannot play torrents.</div>'
      + '<div class="alist"><div class="ainner"></div></div>';
    var inner = root.querySelector('.ainner'), view = root.querySelector('.alist');

    var draw = function () {
      inner.innerHTML = '';
      inner.__y = 0;
      inner.style.transform = 'translateY(0)';

      var add = el('div', 'a add f', '<div class="an">+  Add an addon</div>');
      add.__reveal = function () { shiftY(add, inner, view, 0); };
      add.__ok = function () {
        openDialog('Add an addon', 'Paste the address of the addon (stremio:// or https://). Easier on a phone: put it in UltimatiumTube settings.',
          [['Add', function (text) { addAddon(text); }], ['Cancel', function () { /* closed */ }]], 'https://.../manifest.json');
      };
      inner.appendChild(add);

      S.addons.forEach(function (a) {
        var m = a.manifest;
        var local = S.phone.indexOf(a.url) === -1;
        var row = el('div', 'a f' + (m ? '' : ' bad'));
        row.innerHTML = '<div class="an">' + esc(m ? m.name + (m.version ? '  ' + m.version : '') : 'Not reachable') + '</div>'
          + '<div class="ad">' + esc(m ? cut(m.description, 150) : (a.error || '')) + '</div>'
          + '<div class="au">' + esc(cut(a.url, 160)) + '</div>'
          + '<div class="ast">' + esc(m ? SX.arr(m.resources).map(function (r) { return r.name || r; }).join(' · ') : 'check the address') + '</div>';
        row.__reveal = function () { shiftY(row, inner, view, 0); };
        row.__ok = function () {
          if (!local) { openDialog(m ? m.name : 'Addon', 'This one is listed in UltimatiumTube settings. Change it there.', [['Close', function () { /* closed */ }]]); return; }
          openDialog(m ? m.name : 'Addon', 'Remove this addon from the page?', [['Remove', function () { removeAddon(a.url); }], ['Keep it', function () { /* closed */ }]]);
        };
        inner.appendChild(row);
      });
    };

    spec.redraw = draw;
    draw();
    spec.start = function () { return inner.querySelector('.f'); };
    return spec;
  };

  // --- the addons themselves

  var localList = function () { return SX.store.get('addons', null); };

  var refreshAddons = function () {
    var local = localList();
    if (local === null) { local = SX.DEFAULT_ADDONS.slice(); SX.store.set('addons', local); }
    var urls = S.phone.concat(local.filter(function (u) { return S.phone.indexOf(u) === -1; }));

    return SX.loadAddons(urls).then(function (list) {
      S.addons = list;
      return list;
    });
  };

  var addAddon = function (text) {
    var list = SX.parseList(text);
    if (!list.length) { toast('That is not an address'); return; }
    var local = (localList() || []).filter(function (u) { return list.indexOf(u) === -1; });
    SX.store.set('addons', local.concat(list));
    toast('Checking the addon…');
    refreshAddons().then(function (all) {
      var got = all.filter(function (a) { return a.url === list[0]; })[0];
      toast(got && got.manifest ? 'Added ' + got.manifest.name : 'Added, but it did not answer');
      if (S.tab === 'addons' && S.stack.length === 1) { S.stack[0].redraw(); setFocus(S.stack[0].root.querySelector('.f')); }
    });
  };

  var removeAddon = function (url) {
    SX.store.set('addons', (localList() || []).filter(function (u) { return u !== url; }));
    refreshAddons().then(function () {
      toast('Removed');
      if (S.tab === 'addons' && S.stack.length === 1) { S.stack[0].redraw(); setFocus(S.stack[0].root.querySelector('.f')); }
    });
  };

  // The addons listed in UltimatiumTube's settings. The service keeps them while the TV is running;
  // the Android app passes them in when it opens this page.
  var phoneAddons = function () {
    // The Android app hands the list over itself.
    try {
      if (window.AniNative && window.AniNative.addons) {
        var given = String(window.AniNative.addons() || '');
        SX.store.set('phone', given);
        return Promise.resolve(SX.parseList(given));
      }
    } catch (e) { /* asked below */ }

    var asks = [];
    if (SX.origin) asks.push('/api/settings');

    return Promise.all(asks.map(function (u) {
      return SX.json(u, 4000).then(function (r) { return r && r.config ? String(r.config.stremioAddons || '') : ''; }, function () { return null; });
    })).then(function (answers) {
      var got = answers.filter(function (a) { return a !== null; })[0];
      if (got !== undefined) { SX.store.set('phone', got); return SX.parseList(got); }
      // Not reachable now: what was listed last time is still wanted.
      return SX.parseList(SX.store.get('phone', ''));
    });
  };

  // --- the player

  var P = { open: false, video: null, hls: null, ctx: null, stream: null, siblings: null, hide: 0, save: 0, seek: null, seekTimer: 0, step: 0, lastSeek: 0, failed: false, ended: false, node: {} };

  var playing = function () { return P.open; };

  var showUi = function (stay) {
    if (!P.node.ui) return;
    P.node.ui.className = 'pui';
    clearTimeout(P.hide);
    if (!stay) P.hide = setTimeout(function () { if (P.video && !P.video.paused && !P.failed) P.node.ui.className = 'pui off'; }, 4200);
  };

  var drawBar = function () {
    var v = P.video;
    if (!v || !P.node.cur) return;
    var d = v.duration > 0 && isFinite(v.duration) ? v.duration : 0;
    var t = P.seek !== null ? P.seek : v.currentTime;
    var f = d ? Math.min(1, Math.max(0, t / d)) : 0;
    P.node.cur.style.width = (f * 1760) + 'px';
    P.node.dot.style.left = (f * 1760) + 'px';
    P.node.time.textContent = SX.format(t);
    P.node.dur.textContent = d ? SX.format(d) : '';
    var buffered = 0;
    try { if (v.buffered && v.buffered.length) buffered = v.buffered.end(v.buffered.length - 1); } catch (e) { /* none */ }
    P.node.buf.style.width = (d ? Math.min(1, buffered / d) * 1760 : 0) + 'px';
  };

  var saveNow = function () {
    var v = P.video, c = P.ctx;
    if (!v || !c || !(v.duration > 0) || !isFinite(v.duration)) return;
    var t = P.seek !== null ? P.seek : v.currentTime;
    var full = c.full, video = c.video;
    saveProgress(SX.watchKey(full.type, video ? video.id : full.id), {
      type: full.type, id: full.id, videoId: video ? video.id : full.id, t: t, d: v.duration, at: now(),
      name: full.name, poster: full.poster, background: full.background, description: full.description,
      year: full.year, rating: full.rating, genres: full.genres, addon: full.addon,
      label: video ? 'S' + video.season + ' E' + video.episode : ''
    });
  };

  var fail = function (text) {
    if (P.failed) return;
    P.failed = true;
    P.node.wait.className = 'pwait';
    P.node.err.className = 'perr on';
    P.node.err.innerHTML = '<b>This stream would not play.</b><br>' + esc(text) + '<br><br>Press Back to choose another.';
    showUi(true);
  };

  var attach = function (v, url) {
    var isHls = /\.m3u8(\?|#|$)/i.test(url);
    var native = v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl');

    if (isHls && !native && window.Hls && window.Hls.isSupported()) {
      P.hls = new window.Hls({
        // Everything it asks for goes by the same route as the rest of the page.
        xhrSetup: function (xhr, address) { xhr.open('GET', SX.route(address), true); }
      });
      P.hls.loadSource(url);
      P.hls.attachMedia(v);
      P.hls.on(window.Hls.Events.ERROR, function (event, data) {
        if (data && data.fatal) fail('The playlist could not be played (' + (data.details || 'error') + ').');
      });
      return;
    }

    v.src = url;
  };

  var startPlayer = function (ctx, st, siblings) {
    var box = $('player');
    box.innerHTML = '<video id="pv" autoplay></video>'
      + '<div class="pui"><div class="ptop"><div class="pt"></div><div class="ps"></div></div>'
      + '<div class="pstate"></div><div class="pwait on"><span class="spin"></span>Starting</div>'
      + '<div class="perr"></div>'
      + '<div class="pbot"><div class="pbar"><div class="pbuf"></div><div class="pcur"></div><div class="pdot"></div></div>'
      + '<div class="ptime">0:00</div><div class="pdur"></div></div></div>';
    box.className = 'open';

    var v = $('pv');
    P.open = true; P.video = v; P.ctx = ctx; P.stream = st; P.siblings = siblings;
    P.failed = false; P.ended = false; P.seek = null;
    P.node = { ui: box.querySelector('.pui'), wait: box.querySelector('.pwait'), err: box.querySelector('.perr'), state: box.querySelector('.pstate'),
      cur: box.querySelector('.pcur'), dot: box.querySelector('.pdot'), buf: box.querySelector('.pbuf'),
      time: box.querySelector('.ptime'), dur: box.querySelector('.pdur') };
    box.querySelector('.pt').textContent = ctx.label;
    box.querySelector('.ps').textContent = st.addon + (st.name ? '  ·  ' + st.name : '');

    var resume = progress()[SX.watchKey(ctx.full.type, ctx.video ? ctx.video.id : ctx.full.id)];
    var from = resume && resume.d && resume.t > 60 && resume.t / resume.d < 0.93 ? resume.t : 0;

    v.addEventListener('loadedmetadata', function () {
      if (from) { try { v.currentTime = from; } catch (e) { /* not yet */ } from = 0; }
      drawBar();
    });
    v.addEventListener('playing', function () { P.node.wait.className = 'pwait'; P.node.state.textContent = ''; showUi(); });
    v.addEventListener('waiting', function () { if (!P.failed) P.node.wait.className = 'pwait on'; });
    v.addEventListener('canplay', function () { P.node.wait.className = 'pwait'; });
    v.addEventListener('seeked', function () { drawBar(); });
    v.addEventListener('pause', function () { if (!P.ended) { P.node.state.textContent = '❚❚'; showUi(true); } });
    v.addEventListener('timeupdate', drawBar);
    v.addEventListener('ended', function () { P.ended = true; saveProgress(SX.watchKey(ctx.full.type, ctx.video ? ctx.video.id : ctx.full.id), { type: ctx.full.type, id: ctx.full.id, videoId: ctx.video ? ctx.video.id : ctx.full.id, t: v.duration, d: v.duration, at: now(), name: ctx.full.name, poster: ctx.full.poster }); next(); });
    v.addEventListener('error', function () {
      var code = v.error && v.error.code;
      fail(code === 4 ? 'This TV cannot play that kind of file.' : 'The stream could not be loaded' + (code ? ' (error ' + code + ')' : '') + '.');
    });

    attach(v, st.url);
    var p = v.play && v.play();
    if (p && p.catch) p.catch(function () { /* started by the autoplay attribute */ });

    clearInterval(P.save);
    P.save = setInterval(saveNow, 10000);
    showUi();
  };

  var stopPlayer = function () {
    if (!P.open) return;
    saveNow();
    clearInterval(P.save);
    clearTimeout(P.hide);
    clearTimeout(P.seekTimer);
    try { if (P.hls) { P.hls.destroy(); P.hls = null; } } catch (e) { P.hls = null; }
    try { if (P.video) { P.video.pause(); P.video.removeAttribute('src'); P.video.load(); } } catch (e) { /* gone */ }
    var box = $('player');
    box.className = '';
    box.innerHTML = '';
    P.open = false; P.video = null; P.seek = null;
    var top = S.stack[S.stack.length - 1];
    if (top && top.focus && visible(top.focus)) setFocus(top.focus);
  };

  // At the end of an episode, the next one is started with the same kind of stream if there is one.
  var next = function () {
    var c = P.ctx, st = P.stream;
    if (!c || !c.video) { stopPlayer(); return; }

    var same = c.full.videos.filter(function (v) { return v.season === c.video.season; }).sort(function (a, b) { return a.episode - b.episode; });
    var at = same.map(function (v) { return v.id; }).indexOf(c.video.id);
    var following = same[at + 1] || c.full.videos.filter(function (v) { return v.season === c.video.season + 1; }).sort(function (a, b) { return a.episode - b.episode; })[0];
    if (!following) { stopPlayer(); return; }

    var label = c.full.name + '  ·  S' + following.season + ' E' + following.episode + (following.title ? '  ' + following.title : '');
    toast('Up next: S' + following.season + ' E' + following.episode);
    P.node.wait.className = 'pwait on';

    var found = [], request = SX.streams(S.addons, c.type, following.id, function (a, list) { found = found.concat(list); });

    request.done.then(function () {
      if (!P.open || P.video === null) return;
      var sorted = SX.sortStreams(found).filter(function (s) { return s.kind === 'direct'; });
      var match = null;
      if (st.group) match = sorted.filter(function (s) { return s.group === st.group; })[0];
      if (!match) match = sorted.filter(function (s) { return s.addonUrl === st.addonUrl && s.name === st.name; })[0];

      if (match) {
        var ctx = { full: c.full, video: following, label: label, type: c.type, id: following.id };
        stopPlayer();
        startPlayer(ctx, match, sorted);
      } else {
        stopPlayer();
        closeTop();
        openStreams(c.full, following, label);
      }
    });
  };

  var seekBy = function (seconds) {
    var v = P.video;
    if (!v || !(v.duration > 0)) return;
    var t = now();
    // Pressing again soon goes further each time.
    P.step = t - P.lastSeek < 700 ? Math.min(P.step + 1, 8) : 0;
    P.lastSeek = t;
    var amount = seconds * (P.step < 3 ? 1 : P.step < 6 ? 3 : 6);
    P.seek = Math.max(0, Math.min(v.duration - 1, (P.seek !== null ? P.seek : v.currentTime) + amount));
    drawBar();
    showUi(true);
    clearTimeout(P.seekTimer);
    P.seekTimer = setTimeout(function () {
      var to = P.seek;
      P.seek = null;
      try { v.currentTime = to; } catch (e) { /* not seekable */ }
      showUi();
    }, 450);
  };

  var playerKey = function (code) {
    var v = P.video;
    if (!v) return;

    if (P.failed) return;
    if (code === 13 || code === 10252 || code === 415 || code === 19) {
      if (code === 19 || (code === 13 && !v.paused) || (code === 10252 && !v.paused)) v.pause(); else v.play();
      showUi(v.paused);
      return;
    }
    if (code === 37 || code === 412) { seekBy(-10); return; }
    if (code === 39 || code === 417) { seekBy(10); return; }
    if (code === 38 || code === 40) { showUi(); return; }
    if (code === 413) { stopPlayer(); }
  };

  // --- keys

  var isBack = function (code) { return code === 8 || code === 27 || code === 10009 || code === 461 || code === 4; };

  var key = function (code) {
    if (playing()) {
      if (isBack(code)) { back(); return true; }
      playerKey(code);
      return true;
    }

    if (isBack(code)) { back(); return true; }

    var dir = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' }[code];
    if (dir) { move(dir); return true; }

    if (code === 13 || code === 29443) {
      if (S.focus && visible(S.focus) && S.focus.__ok) S.focus.__ok(S.focus);
      return true;
    }
    return false;
  };

  // --- the start

  var started = false;

  var start = function () {
    if (started) return;
    started = true;
    fit();
    buildTabs();

    var msg = el('div', 'msg', '<span class="spin"></span>Loading your addons');
    $('screens').appendChild(msg);

    phoneAddons().then(function (list) {
      S.phone = list;
      return refreshAddons();
    }).then(function () {
      $('screens').removeChild(msg);
      S.loaded = true;
      showTab('home');
    }, function () {
      msg.innerHTML = 'Could not load the addons';
    });
  };

  window.addEventListener('resize', fit);
  D.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') {
      // The typed address: Enter and Back return to the buttons.
      if (e.keyCode === 13 || isBack(e.keyCode) || e.keyCode === 40) {
        e.target.blur();
        if (e.keyCode === 40 || e.keyCode === 13) { move('down'); }
        e.preventDefault();
        return;
      }
      if (e.keyCode !== 38) return;
    }
    if (key(e.keyCode)) e.preventDefault();
  });
  D.addEventListener('tizenhwkey', function (e) { if (e.keyName === 'back') back(); });

  // From the Android app, which hands over the keys the page does not get itself.
  window.EA_key = function (code) { key(code); };
  window.EA_popup = function () { /* nothing here opens windows */ };
  window.EA_trim = function () { SX.store.set('manifests', {}); };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();

  window.SXUI = { key: key, state: S, showTab: showTab };
})();
