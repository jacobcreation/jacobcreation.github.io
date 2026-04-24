const DEFAULT_HTML =
`<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #1a1a2e;
      color: #eaf2ff;
    }
    h1 { font-size: 2.2rem; text-align: center; }
  </style>
</head>
<body>
  <h1>Hello, Sandbox! 🚀</h1>
</body>
</html>`;

export const files = {
  html: DEFAULT_HTML,
  css: `/* Your CSS here */\nbody { box-sizing: border-box; }`,
  js: `// Your JavaScript here\nconsole.log('Sandbox ready! 🎉');`,
};

let current = 'html';

export function getCurrentFile() { return current; }

export function initEditor() {
  const ta = document.getElementById('code');
  ta.value = files[current];
  updateLineNumbers();

  // Tab / Shift+Tab for indent
  ta.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: end, value: v } = ta;
      if (s !== end) {
        // Block indent/unindent
        const before = v.lastIndexOf('\n', s - 1) + 1;
        const block = v.substring(before, end);
        const lines = block.split('\n');
        const changed = e.shiftKey
          ? lines.map(l => l.startsWith('  ') ? l.slice(2) : l)
          : lines.map(l => '  ' + l);
        const text = changed.join('\n');
        ta.value = v.substring(0, before) + text + v.substring(end);
        ta.setSelectionRange(before, before + text.length);
      } else {
        ta.value = v.substring(0, s) + '  ' + v.substring(end);
        ta.setSelectionRange(s + 2, s + 2);
      }
      files[current] = ta.value;
      updateLineNumbers();
      return;
    }

    // Auto-close brackets / quotes
    const AUTO = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    if (AUTO[e.key] && !e.ctrlKey && !e.metaKey) {
      const { selectionStart: s, selectionEnd: end, value: v } = ta;
      if (s === end) {
        e.preventDefault();
        const close = AUTO[e.key];
        ta.value = v.substring(0, s) + e.key + close + v.substring(end);
        ta.setSelectionRange(s + 1, s + 1);
        files[current] = ta.value;
        return;
      }
    }

    // Skip over closing char if already there
    const CLOSERS = new Set([')', ']', '}', '"', "'", '`']);
    if (CLOSERS.has(e.key)) {
      const { selectionStart: s, selectionEnd: end, value: v } = ta;
      if (s === end && v[s] === e.key) {
        e.preventDefault();
        ta.setSelectionRange(s + 1, s + 1);
        return;
      }
    }

    // Backspace: delete pair
    if (e.key === 'Backspace') {
      const { selectionStart: s, selectionEnd: end, value: v } = ta;
      const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
      if (s === end && s > 0 && PAIRS[v[s - 1]] === v[s]) {
        e.preventDefault();
        ta.value = v.substring(0, s - 1) + v.substring(s + 1);
        ta.setSelectionRange(s - 1, s - 1);
        files[current] = ta.value;
        updateLineNumbers();
        return;
      }
    }

    // Enter inside brackets: add indented line
    if (e.key === 'Enter') {
      const { selectionStart: s, selectionEnd: end, value: v } = ta;
      if (s === end) {
        const OPEN_CLOSE = { '(': ')', '[': ']', '{': '}' };
        if (OPEN_CLOSE[v[s - 1]] === v[s]) {
          e.preventDefault();
          // Get current line indentation
          const lineStart = v.lastIndexOf('\n', s - 1) + 1;
          const indentMatch = v.substring(lineStart).match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1] : '';
          const newText = '\n' + indent + '  \n' + indent;
          ta.value = v.substring(0, s) + newText + v.substring(end);
          ta.setSelectionRange(s + indent.length + 3, s + indent.length + 3);
          files[current] = ta.value;
          updateLineNumbers();
          return;
        }
      }
    }
  });

  ta.addEventListener('input', () => {
    files[current] = ta.value;
    updateLineNumbers();
  });

  ta.addEventListener('scroll', syncScroll);

  document.querySelectorAll('#tabs button').forEach(btn =>
    btn.addEventListener('click', () => setFile(btn.dataset.file))
  );
}

export function setFile(name) {
  saveCurrentFile();
  current = name;
  const ta = document.getElementById('code');
  ta.value = files[name];
  document.querySelectorAll('#tabs button').forEach(b =>
    b.classList.toggle('active', b.dataset.file === name)
  );
  updateLineNumbers();
  ta.focus();
}

export function saveCurrentFile() {
  files[current] = document.getElementById('code').value;
}

export function updateLineNumbers() {
  const ta = document.getElementById('code');
  const ln = document.getElementById('lineNumbers');
  const count = (ta.value.match(/\n/g) || []).length + 1;
  // Sync font size
  ln.style.fontSize = ta.style.fontSize || '14px';
  ln.style.lineHeight = ta.style.lineHeight || '1.5';
  if (parseInt(ln.dataset.count) === count) { syncScroll(); return; }
  ln.dataset.count = count;
  ln.innerHTML = Array.from({ length: count }, (_, i) => `<div>${i + 1}</div>`).join('');
  syncScroll();
}

function syncScroll() {
  const ta = document.getElementById('code');
  document.getElementById('lineNumbers').scrollTop = ta.scrollTop;
}

// ── Formatter ────────────────────────────────────────────────────────────────
export function formatCode() {
  saveCurrentFile();
  const ta = document.getElementById('code');
  const lang = current;
  let code = ta.value;
  try {
    if      (lang === 'js')   code = fmtJs(code);
    else if (lang === 'css')  code = fmtCss(code);
    else if (lang === 'html') code = fmtHtml(code);
    ta.value = code;
    files[lang] = code;
    updateLineNumbers();
  } catch { /* silently ignore format errors */ }
}

function fmtJs(code) {
  let indent = 0;
  return code.split('\n')
    .map(raw => {
      const line = raw.trim();
      if (!line) return '';
      const opens  = (line.match(/[{[(]/g) || []).length;
      const closes = (line.match(/[}\])]/g) || []).length;
      if (line[0] === '}' || line[0] === ']' || line[0] === ')') indent = Math.max(0, indent - 1);
      const out = '  '.repeat(indent) + line;
      indent = Math.max(0, indent + opens - closes);
      return out;
    })
    .join('\n');
}

function fmtCss(code) {
  return code
    .replace(/\s*{\s*/g, ' {\n  ')
    .replace(/;\s*(?!\s*})/g, ';\n  ')
    .replace(/\s*}\s*/g, '\n}\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
function fmtHtml(code) {
  let out = '';
  let indent = 0;
  const tokens = code.split(/(<[^>]+?>|<!--[\s\S]*?-->)/g);
  for (const tok of tokens) {
    const t = tok.trim();
    if (!t) continue;
    if (t.startsWith('</')) {
      indent = Math.max(0, indent - 1);
      out += '  '.repeat(indent) + t + '\n';
    } else if (t.startsWith('<') && !t.startsWith('<!--')) {
      out += '  '.repeat(indent) + t + '\n';
      const tag = t.match(/^<(\w+)/)?.[1]?.toLowerCase();
      if (tag && !VOID_TAGS.has(tag) && !t.endsWith('/>')) indent++;
    } else {
      out += '  '.repeat(indent) + t + '\n';
    }
  }
  return out.trim();
}
