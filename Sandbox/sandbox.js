import { files } from "./editor.js";

export const LIBRARIES = []; // Array of URL strings to inject

export function runSandbox() {
	const frame = document.getElementById("frame");
	const consoleEl = document.getElementById("console");
	consoleEl.innerHTML = "";

	const consoleShim = `
<script>
(function() {
  function serialize(val) {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'function') return val.toString();
    if (val instanceof Error) return val.stack || (val.name + ': ' + val.message);
    if (typeof val === 'object') {
      try { return JSON.stringify(val, null, 2); } catch(e) { return String(val); }
    }
    return String(val);
  }

  function send(type, args, extra) {
    parent.postMessage({ __console: true, type, args: args.map(serialize), extra: extra || null }, '*');
  }

  const _timers = {};
  const _counts = {};
  const _groups = [];

  const methods = {
    log:   (...a) => send('log', a),
    info:  (...a) => send('info', a),
    warn:  (...a) => send('warn', a),
    error: (...a) => send('error', a),
    debug: (...a) => send('debug', a),

    clear: () => send('clear', []),

    assert: (cond, ...a) => {
      if (!cond) send('error', ['Assertion failed:', ...a]);
    },

    dir:    (obj) => send('dir', [obj]),
    dirxml: (obj) => send('dir', [obj]),

    table: (data) => {
      try {
        const json = JSON.stringify(data, null, 2);
        send('table', [data], { json });
      } catch(e) {
        send('log', [String(data)]);
      }
    },

    group:          (...a) => { _groups.push(a[0] || 'group'); send('group', a); },
    groupCollapsed: (...a) => { _groups.push(a[0] || 'group'); send('groupCollapsed', a); },
    groupEnd:       () => { _groups.pop(); send('groupEnd', []); },

    count: (label = 'default') => {
      _counts[label] = (_counts[label] || 0) + 1;
      send('log', [label + ': ' + _counts[label]]);
    },
    countReset: (label = 'default') => {
      _counts[label] = 0;
      send('log', [label + ': 0']);
    },

    time: (label = 'default') => { _timers[label] = performance.now(); },
    timeLog: (label = 'default') => {
      const t = _timers[label];
      send('log', [label + ': ' + (t != null ? (performance.now() - t).toFixed(3) + 'ms' : 'no timer')]);
    },
    timeEnd: (label = 'default') => {
      const t = _timers[label];
      send('log', [label + ': ' + (t != null ? (t != null ? (performance.now() - t).toFixed(3) : 0) + 'ms' : 'no timer')]);
      delete _timers[label];
    },

    trace: (...a) => {
      const stack = new Error().stack || '';
      send('trace', [...a, stack]);
    },
  };

  Object.assign(console, methods);

  // Runtime errors
  window.onerror = function(msg, src, line, col, err) {
    send('error', [(err && err.stack) || (msg + (line ? ' (line ' + line + (col ? ':' + col : '') + ')' : ''))]);
    return true;
  };

  // Unhandled promise rejections
  window.onunhandledrejection = function(e) {
    const reason = e.reason;
    send('error', ['Unhandled Promise Rejection: ' + ((reason instanceof Error) ? (reason.stack || reason.message) : String(reason))]);
  };
})();
<\/script>`;

	let libsHtml = LIBRARIES.map((url) => {
		if (url.endsWith(".css")) return `<link rel="stylesheet" href="${url}">`;
		return `<script src="${url}"><\/script>`;
	}).join("\n");

	frame.srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${libsHtml}
<style>${files.css}</style>
</head>
<body>
${files.html}
${consoleShim}
<script>
try {
${files.js}
} catch (e) {
  console.error(e);
}
<\/script>
</body>
</html>`;
}
