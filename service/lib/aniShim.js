'use strict';

// Placed in the page before Aniultimatium's own scripts. Aniultimatium is written for a widget that
// may call any address, in an engine with custom properties; here it is a page of this service, shown
// by an engine with neither. So, as the page runs:
//  - a request to another site (fetch, XMLHttpRequest) is made through the service's /cors-bypass/,
//    which answers with the access the page expects. Aniultimatium's own server is left alone;
//  - an image from another site, whether set by script (img.src, a style's background-image) or
//    written in markup, is fetched the same way, which also gets it past an engine that refuses
//    pictures its stylesheet or an http page asks for from elsewhere;
//  - when the page chooses its accent colour (a custom property, which this engine does not have),
//    the stylesheet is asked for again with that colour in it.
//
// Plain ES5, written out as the page will run it, and read as text (String.raw keeps its backslashes).

const SOURCE = String.raw`(function () {
  var origin = location.origin, via = origin + '/cors-bypass/';
  var own = /^https?:\/\/aniultimatium\.advaithavinash404\.workers\.dev(\/|$)/i;

  function route(u) {
    if (typeof u !== 'string' || !/^https?:\/\//i.test(u)) return u;
    if (u.indexOf(origin + '/') === 0 || u === origin || own.test(u)) return u;
    return via + u;
  }

  function routeCss(value) {
    return typeof value === 'string'
      ? value.replace(/url\(\s*(["']?)(https?:\/\/[^)"']+)\1\s*\)/g, function (all, quote, address) { return 'url(' + quote + route(address) + quote + ')'; })
      : value;
  }

  if (window.fetch) {
    var realFetch = window.fetch;
    window.fetch = function (input, init) {
      if (typeof input === 'string') input = route(input);
      else if (input && typeof input.url === 'string' && window.Request) {
        var routed = route(input.url);
        if (routed !== input.url) input = new Request(routed, input);
      }
      return realFetch.call(this, input, init);
    };
  }

  if (window.XMLHttpRequest) {
    var realOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, address) {
      var args = Array.prototype.slice.call(arguments);
      args[1] = route(String(address));
      return realOpen.apply(this, args);
    };
  }

  function wrapSetter(proto, name, change) {
    var descriptor = proto && Object.getOwnPropertyDescriptor(proto, name);
    if (!descriptor || !descriptor.set) return;
    Object.defineProperty(proto, name, {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set: function (value) { descriptor.set.call(this, change(String(value))); }
    });
  }

  wrapSetter(window.HTMLImageElement && HTMLImageElement.prototype, 'src', route);
  wrapSetter(window.CSSStyleDeclaration && CSSStyleDeclaration.prototype, 'backgroundImage', routeCss);

  // Pictures written as markup are found as they are added.
  function reroute(image) {
    var address = image.getAttribute('src');
    if (address && route(address) !== address) image.setAttribute('src', route(address));
  }

  if (window.MutationObserver && document.documentElement) {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.tagName === 'IMG') reroute(node);
          if (node.getElementsByTagName) {
            var inside = node.getElementsByTagName('img');
            for (var k = 0; k < inside.length; k++) reroute(inside[k]);
          }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  var style = window.CSSStyleDeclaration && CSSStyleDeclaration.prototype;
  if (style && style.setProperty) {
    var realSet = style.setProperty, last = '__DEFAULT_ACCENT__';
    style.setProperty = function (name, value) {
      try {
        var compact = String(value).replace(/\s+/g, '');
        if (name === '--accent-rgb' && compact !== last && /^\d{1,3},\d{1,3},\d{1,3}$/.test(compact)) {
          last = compact;
          var links = document.getElementsByTagName('link'), old = null;
          for (var i = 0; i < links.length; i++) {
            if (/styles\.css/.test(links[i].getAttribute('href') || '') && links[i].rel === 'stylesheet') { old = links[i]; break; }
          }
          if (old) {
            var fresh = document.createElement('link');
            fresh.rel = 'stylesheet';
            fresh.href = 'styles.css?accent=' + compact;
            fresh.onload = function () { if (old.parentNode) old.parentNode.removeChild(old); };
            old.parentNode.insertBefore(fresh, old.nextSibling);
          }
        }
        if ((name === 'background-image' || name === 'background') && typeof value === 'string') arguments[1] = routeCss(value);
      } catch (error) {}
      try { return realSet.apply(this, arguments); } catch (error) {}
      return undefined;
    };
  }
})();`;

const shim = (defaultAccent) => SOURCE.replace('__DEFAULT_ACCENT__', defaultAccent);

module.exports = { shim, SOURCE };
