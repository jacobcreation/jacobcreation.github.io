// ── Starter Templates ────────────────────────────────────────────────────────
export const TEMPLATES = [
	{
		id: "blank",
		title: "Blank",
		emoji: "📄",
		desc: "Empty slate",
		html: "<!DOCTYPE html>\n<html>\n<head>\n  <style></style>\n</head>\n<body>\n\n</body>\n</html>",
		css: "",
		js: "",
	},
	{
		id: "hello",
		title: "Hello World",
		emoji: "👋",
		desc: "Classic starter",
		html: `<!DOCTYPE html>
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
    h1 { font-size: 2.5rem; }
  </style>
</head>
<body>
  <h1>Hello, World! 👋</h1>
</body>
</html>`,
		css: "",
		js: `console.log('Hello, World!');`,
	},
	{
		id: "counter",
		title: "Counter",
		emoji: "🔢",
		desc: "Click counter button",
		html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#1a1a2e; color:#eaf2ff; font-family:sans-serif; }
    #count { font-size:5rem; font-weight:bold; }
    button { margin-top:16px; padding:12px 32px; font-size:1.1rem; border-radius:999px; border:none; cursor:pointer; background:#4ea1ff; color:#fff; transition:transform 0.1s; }
    button:active { transform:scale(0.95); }
  </style>
</head>
<body>
  <div id="count">0</div>
  <button onclick="increment()">Click me!</button>
</body>
</html>`,
		css: "",
		js: `let n = 0;
function increment() {
  n++;
  document.getElementById('count').textContent = n;
  console.log('Count:', n);
}`,
	},
	{
		id: "clock",
		title: "Live Clock",
		emoji: "🕐",
		desc: "Real-time digital clock",
		html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; background:#0d1117; font-family:monospace; }
    #clock { font-size:4rem; color:#4ea1ff; text-shadow:0 0 30px rgba(78,161,255,0.5); letter-spacing:4px; }
  </style>
</head>
<body>
  <div id="clock">00:00:00</div>
</body>
</html>`,
		css: "",
		js: `function tick() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('clock').textContent =
    pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
}
tick();
setInterval(tick, 1000);`,
	},
	{
		id: "todo",
		title: "To-Do List",
		emoji: "✅",
		desc: "Add & check off tasks",
		html: `<!DOCTYPE html>
<html>
<head>
  <style>
    * { box-sizing:border-box; }
    body { font-family:sans-serif; background:#1a1a2e; color:#eaf2ff; padding:24px; max-width:400px; margin:0 auto; }
    h1 { margin-bottom:16px; }
    .row { display:flex; gap:8px; margin-bottom:16px; }
    input { flex:1; padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.08); color:#eaf2ff; font-size:1rem; outline:none; }
    button { padding:8px 16px; border-radius:8px; border:none; cursor:pointer; background:#4ea1ff; color:#fff; font-weight:bold; }
    li { display:flex; align-items:center; gap:8px; padding:8px; border-radius:8px; margin-bottom:6px; background:rgba(255,255,255,0.06); cursor:pointer; }
    li.done span { text-decoration:line-through; opacity:0.5; }
    .del { margin-left:auto; opacity:0.5; cursor:pointer; }
    .del:hover { opacity:1; color:#ff7070; }
  </style>
</head>
<body>
  <h1>📝 To-Do List</h1>
  <div class="row">
    <input id="inp" placeholder="Add a task…" onkeydown="if(e.key==='Enter')add()" />
    <button onclick="add()">Add</button>
  </div>
  <ul id="list"></ul>
</body>
</html>`,
		css: "",
		js: `function add() {
  const inp = document.getElementById('inp');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  const li = document.createElement('li');
  const span = document.createElement('span');
  span.textContent = text;
  li.onclick = () => li.classList.toggle('done');
  const del = document.createElement('span');
  del.className = 'del';
  del.textContent = '✕';
  del.onclick = e => { e.stopPropagation(); li.remove(); };
  li.appendChild(span);
  li.appendChild(del);
  document.getElementById('list').appendChild(li);
  console.log('Added:', text);
}`,
	},
	{
		id: "canvas",
		title: "Canvas Sketch",
		emoji: "🎨",
		desc: "Draw on a canvas",
		html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin:0; background:#111; display:flex; justify-content:center; align-items:center; height:100vh; }
    canvas { cursor:crosshair; border-radius:8px; }
    #toolbar { position:fixed; top:16px; left:50%; transform:translateX(-50%); display:flex; gap:8px; align-items:center; background:rgba(0,0,0,0.6); padding:8px 16px; border-radius:999px; }
    input[type=color] { border:none; background:none; cursor:pointer; width:32px; height:32px; border-radius:50%; }
    input[type=range] { width:80px; }
    label { color:#fff; font-size:12px; font-family:sans-serif; }
  </style>
</head>
<body>
  <div id="toolbar">
    <input type="color" id="color" value="#4ea1ff" />
    <label>Size</label>
    <input type="range" id="size" min="1" max="40" value="6" />
    <button onclick="clearCanvas()" style="padding:4px 10px;border-radius:999px;border:none;cursor:pointer;background:#ff7070;color:#fff;font-size:12px">Clear</button>
  </div>
  <canvas id="c"></canvas>
</body>
</html>`,
		css: "",
		js: `const c = document.getElementById('c');
const ctx = c.getContext('2d');
c.width = Math.min(window.innerWidth - 40, 700);
c.height = Math.min(window.innerHeight - 80, 500);
ctx.fillStyle = '#1a1a2e';
ctx.fillRect(0,0,c.width,c.height);

let drawing = false;
c.onmousedown = () => drawing = true;
c.onmouseup = c.onmouseleave = () => { drawing = false; ctx.beginPath(); };
c.onmousemove = e => {
  if (!drawing) return;
  const r = c.getBoundingClientRect();
  ctx.lineWidth = document.getElementById('size').value;
  ctx.strokeStyle = document.getElementById('color').value;
  ctx.lineCap = 'round';
  ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
};

function clearCanvas() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0,0,c.width,c.height);
  ctx.beginPath();
}`,
	},
	{
		id: "animation",
		title: "CSS Animation",
		emoji: "✨",
		desc: "Bouncing gradient balls",
		html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin:0; overflow:hidden; background:#0d1117; }
    .ball {
      position: absolute;
      border-radius: 50%;
      animation: float linear infinite;
    }
    @keyframes float {
      0%   { transform: translateY(100vh) scale(0); opacity:0; }
      10%  { opacity: 1; }
      90%  { opacity: 1; }
      100% { transform: translateY(-120px) scale(1); opacity:0; }
    }
  </style>
</head>
<body></body>
</html>`,
		css: "",
		js: `const colors = ['#4ea1ff','#ff2d2d','#ffd97d','#7de8c8','#b0a5ff'];
function spawn() {
  const ball = document.createElement('div');
  ball.className = 'ball';
  const size = 20 + Math.random() * 60;
  ball.style.cssText = [
    'width:' + size + 'px',
    'height:' + size + 'px',
    'left:' + Math.random() * 100 + 'vw',
    'background:' + colors[Math.floor(Math.random()*colors.length)],
    'animation-duration:' + (3 + Math.random() * 5) + 's',
    'filter: blur(' + Math.random() * 3 + 'px)',
    'opacity:0.7'
  ].join(';');
  document.body.appendChild(ball);
  setTimeout(() => ball.remove(), 8000);
}
setInterval(spawn, 300);
spawn();`,
	},
	{
		id: "api",
		title: "Fetch API",
		emoji: "🌐",
		desc: "Fetch data from an API",
		html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family:sans-serif; background:#1a1a2e; color:#eaf2ff; padding:24px; }
    h1 { margin-bottom:16px; }
    button { padding:10px 20px; border-radius:8px; border:none; cursor:pointer; background:#4ea1ff; color:#fff; font-size:1rem; }
    #out { margin-top:16px; background:rgba(0,0,0,0.3); padding:16px; border-radius:8px; line-height:1.6; min-height:60px; }
    img { border-radius:50%; width:80px; vertical-align:middle; margin-right:12px; }
  </style>
</head>
<body>
  <h1>🌐 Random User API</h1>
  <button onclick="fetchUser()">Get Random User</button>
  <div id="out">Click the button…</div>
</body>
</html>`,
		css: "",
		js: `async function fetchUser() {
  document.getElementById('out').textContent = 'Loading…';
  try {
    const res = await fetch('https://randomuser.me/api/');
    const data = await res.json();
    const u = data.results[0];
    document.getElementById('out').innerHTML =
      '<img src="' + u.picture.large + '" />' +
      '<strong>' + u.name.first + ' ' + u.name.last + '</strong><br>' +
      '📧 ' + u.email + '<br>' +
      '📍 ' + u.location.city + ', ' + u.location.country;
    console.log('Fetched user:', u.name.first, u.name.last);
  } catch(e) {
    document.getElementById('out').textContent = 'Error: ' + e.message;
    console.error(e);
  }
}`,
	},
];
