'use strict';

// The settings page for a phone or computer. Opened from a LAN that may have no route to the
// internet, so nothing is fetched: one document, its own style and script. The script avoids
// backticks and ${} because the page is a template literal.

const page = () => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>UltimatiumTube settings</title>
<style>
:root { --bg:#0f0f0f; --card:#1b1b1b; --line:#303030; --text:#f1f1f1; --dim:#aaa; --accent:#3ea6ff; --bad:#ff6b6b; --ok:#4cd964; }
@media (prefers-color-scheme: light) { :root { --bg:#f6f6f6; --card:#fff; --line:#ddd; --text:#111; --dim:#666; --accent:#065fd4; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:16px/1.4 system-ui, sans-serif; }
header { position:sticky; top:0; z-index:2; background:var(--bg); border-bottom:1px solid var(--line); padding:12px 16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
h1 { font-size:18px; margin:0; flex:1 1 auto; }
#status { font-size:13px; padding:4px 10px; border-radius:99px; border:1px solid var(--line); color:var(--dim); }
#status.on { color:var(--ok); border-color:var(--ok); }
main { max-width:760px; margin:0 auto; padding:8px 16px 48px; }
#wait { padding:24px 0; color:var(--dim); }
details { background:var(--card); border:1px solid var(--line); border-radius:12px; margin:12px 0; }
summary { cursor:pointer; padding:14px 16px; font-weight:600; list-style:none; }
summary::-webkit-details-marker { display:none; }
summary::after { content:"+"; float:right; color:var(--dim); }
details[open] > summary::after { content:"\\2212"; }
.row { display:flex; gap:12px; align-items:center; justify-content:space-between; padding:12px 16px; border-top:1px solid var(--line); }
.row .t { flex:1 1 auto; min-width:0; }
.row small { display:block; color:var(--dim); font-size:13px; margin-top:2px; }
.stack { display:block; }
.stack .t { display:block; margin-bottom:8px; }
input[type=checkbox] { width:22px; height:22px; accent-color:var(--accent); flex:0 0 auto; }
select, textarea, button { font:inherit; color:var(--text); background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:8px 10px; }
select { max-width:55%; }
textarea { width:100%; min-height:96px; resize:vertical; }
button { cursor:pointer; }
button.go { background:var(--accent); border-color:var(--accent); color:#fff; }
.checks label { display:flex; gap:10px; align-items:center; padding:6px 0; }
.value { color:var(--dim); margin:0 0 8px; }
.tools { display:flex; gap:8px; flex-wrap:wrap; margin:16px 0; }
#note { min-height:1.4em; color:var(--dim); font-size:14px; }
footer { color:var(--dim); font-size:13px; padding-top:12px; }
a { color:var(--accent); }
</style>
</head>
<body>
<header>
<h1>UltimatiumTube</h1>
<span id="status">Looking for the TV&hellip;</span>
</header>
<main>
<div class="tools">
<button id="backup" type="button">Back up settings</button>
<button id="restore" type="button">Restore from a backup</button>
<input id="file" type="file" accept="application/json,.json" hidden>
</div>
<div id="note" role="status"></div>
<div id="wait">Open UltimatiumTube on the TV. The settings appear here a few seconds after it starts.</div>
<div id="groups"></div>
<footer>Changes reach the TV within a few seconds. <a href="/diag">Diagnostics</a></footer>
</main>
<script>
(function () {
  var data = { online: false, schema: null, config: {} };
  var drawn = '';
  var setters = {};
  var $ = function (id) { return document.getElementById(id); };

  function note(text) { $('note').textContent = text || ''; }

  function post(changes) {
    return fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tube': '1' },
      body: JSON.stringify({ changes: changes })
    }).then(function (res) {
      if (!res.ok) throw new Error('status ' + res.status);
      Object.keys(changes).forEach(function (key) { data.config[key] = changes[key]; });
      note('Saved.');
    }).catch(function (error) {
      note('Could not save (' + error.message + '). Is the TV on?');
    });
  }

  function save(key, value) { var one = {}; one[key] = value; return post(one); }

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (name) {
      if (name === 'text') node.textContent = attrs[name]; else node.setAttribute(name, attrs[name]);
    });
    (kids || []).forEach(function (kid) { node.appendChild(kid); });
    return node;
  }

  function title(item) {
    var kids = [el('span', { text: item.title })];
    if (item.summary) kids.push(el('small', { text: item.summary }));
    return el('span', { 'class': 't' }, kids);
  }

  function list(array) { return Array.isArray(array) ? array : []; }

  function control(item) {
    var key = item.key;

    if (item.kind === 'switch') {
      var box = el('input', { type: 'checkbox' });
      box.addEventListener('change', function () { save(key, box.checked); });
      setters[key] = function (v) { box.checked = !!v; };
      return el('label', { 'class': 'row' }, [title(item), box]);
    }

    if (item.kind === 'choice') {
      var select = el('select', {}, item.options.map(function (o, i) { return el('option', { value: String(i), text: o.label }); }));
      select.addEventListener('change', function () { save(key, item.options[Number(select.value)].value); });
      setters[key] = function (v) {
        var at = item.options.map(function (o) { return o.value; }).indexOf(v);
        select.value = String(at === -1 ? 0 : at);
      };
      return el('label', { 'class': 'row' }, [title(item), select]);
    }

    if (item.kind === 'flags') {
      var rows = item.options.map(function (o) {
        var c = el('input', { type: 'checkbox' });
        c.addEventListener('change', function () { save(o.key, c.checked); });
        setters[o.key] = function (v) { c.checked = !!v; };
        return el('label', {}, [c, el('span', { text: o.label })]);
      });
      return el('div', { 'class': 'row stack' }, [title(item), el('div', { 'class': 'checks' }, rows)]);
    }

    if (item.kind === 'set') {
      var boxes = item.options.map(function (o) {
        var c = el('input', { type: 'checkbox' });
        c.addEventListener('change', function () {
          var kept = list(data.config[key]).filter(function (v) { return v !== o.value; });
          var listed = item.invert ? !c.checked : c.checked;
          save(key, listed ? kept.concat([o.value]) : kept);
        });
        return { o: o, c: c, label: el('label', {}, [c, el('span', { text: o.label })]) };
      });
      setters[key] = function (v) {
        boxes.forEach(function (b) {
          var has = list(v).indexOf(b.o.value) !== -1;
          b.c.checked = item.invert ? !has : has;
        });
      };
      return el('div', { 'class': 'row stack' }, [title(item), el('div', { 'class': 'checks' }, boxes.map(function (b) { return b.label; }))]);
    }

    if (item.kind === 'words') {
      var area = el('textarea', { placeholder: 'One per line', spellcheck: 'false' });
      area.addEventListener('change', function () {
        save(key, area.value.split('\\n').map(function (s) { return s.trim(); }).filter(Boolean));
      });
      setters[key] = function (v) { area.value = list(v).join('\\n'); };
      return el('div', { 'class': 'row stack' }, [title(item), area]);
    }

    var value = el('p', { 'class': 'value', text: item.value || '' });
    var buttons = (item.actions || []).map(function (a) {
      var b = el('button', { type: 'button', text: a.label });
      b.addEventListener('click', function () {
        var changes = {};
        a.writes.forEach(function (w) { changes[w.key] = w.value; });
        post(changes);
      });
      return b;
    });
    return el('div', { 'class': 'row stack' }, [title(item), value].concat(buttons));
  }

  function draw() {
    setters = {};
    var host = $('groups');
    host.textContent = '';
    data.schema.forEach(function (group, i) {
      var inner = el('details', i === 0 ? { open: '' } : {}, [el('summary', { text: group.title })]);
      group.items.forEach(function (item) { inner.appendChild(control(item)); });
      host.appendChild(inner);
    });
  }

  function fill() {
    Object.keys(setters).forEach(function (key) { setters[key](data.config[key]); });
  }

  function render() {
    var on = data.online && data.schema;
    $('status').textContent = on ? 'TV connected' : 'Looking for the TV\\u2026';
    $('status').className = on ? 'on' : '';
    $('wait').style.display = on ? 'none' : '';
    if (!on) return;

    var shape = JSON.stringify(data.schema.map(function (g) { return [g.id, g.items.map(function (i) { return [i.key, i.value || '', (i.options || []).length]; })]; }));
    if (shape !== drawn) { drawn = shape; draw(); }
    if (!document.activeElement || document.activeElement.tagName !== 'TEXTAREA') fill();
  }

  function poll() {
    fetch('/api/settings', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      data = d; render();
    }).catch(function () { data.online = false; render(); });
  }

  $('backup').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(data.config, null, 2)], { type: 'application/json' });
    var link = el('a', { href: URL.createObjectURL(blob), download: 'ultimatiumtube-settings.json' });
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  });
  $('restore').addEventListener('click', function () { $('file').click(); });
  $('file').addEventListener('change', function () {
    var file = $('file').files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try { post(JSON.parse(reader.result)).then(poll); } catch (e) { note('That file is not a settings backup.'); }
    };
    reader.readAsText(file);
    $('file').value = '';
  });

  poll();
  setInterval(poll, 4000);
})();
</script>
</body>
</html>
`;

module.exports = { page };
