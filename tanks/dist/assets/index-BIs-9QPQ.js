var Nt = Object.defineProperty;
var Ot = (s, e, t) =>
	e in s
		? Nt(s, e, { enumerable: !0, configurable: !0, writable: !0, value: t })
		: (s[e] = t);
var g = (s, e, t) => Ot(s, typeof e != "symbol" ? e + "" : e, t);
import {
	M as m,
	O as Ut,
	B as mt,
	F as et,
	S as ee,
	U as Ge,
	V as U,
	W as Me,
	H as Ce,
	N as Ft,
	C as wt,
	a as k,
	b as S,
	A as Le,
	c as K,
	d as Wt,
	e as Vt,
	P as Ht,
	f as Gt,
	g as qt,
	h as Qt,
	i as Yt,
	j as $t,
	k as Xt,
	D as Kt,
	l as gt,
	m as I,
	n as yt,
	R as xt,
	o as de,
	p as vt,
	q as Q,
	r as jt,
	s as bt,
	t as Zt,
	u as Jt,
	G as ce,
	v as Y,
	w as es,
	x as C,
	y as ts,
	z as ss,
	Q as os,
	E as is,
	I as ns,
} from "./three-CtsC3dh3.js";
(function () {
	const e = document.createElement("link").relList;
	if (e && e.supports && e.supports("modulepreload")) return;
	for (const i of document.querySelectorAll('link[rel="modulepreload"]')) o(i);
	new MutationObserver((i) => {
		for (const n of i)
			if (n.type === "childList")
				for (const r of n.addedNodes)
					r.tagName === "LINK" && r.rel === "modulepreload" && o(r);
	}).observe(document, { childList: !0, subtree: !0 });
	function t(i) {
		const n = {};
		return (
			i.integrity && (n.integrity = i.integrity),
			i.referrerPolicy && (n.referrerPolicy = i.referrerPolicy),
			i.crossOrigin === "use-credentials"
				? (n.credentials = "include")
				: i.crossOrigin === "anonymous"
					? (n.credentials = "omit")
					: (n.credentials = "same-origin"),
			n
		);
	}
	function o(i) {
		if (i.ep) return;
		i.ep = !0;
		const n = t(i);
		fetch(i.href, n);
	}
})();
(!globalThis.EventTarget || !globalThis.Event) &&
	console.error(`
  PartySocket requires a global 'EventTarget' class to be available!
  You can polyfill this global by adding this to your code before any partysocket imports: 
  
  \`\`\`
  import 'partysocket/event-target-polyfill';
  \`\`\`
  Please file an issue at https://github.com/partykit/partykit if you're still having trouble.
`);
var _t = class extends Event {
		constructor(e, t) {
			super("error", t);
			g(this, "message");
			g(this, "error");
			(this.message = e.message), (this.error = e);
		}
	},
	Tt = class extends Event {
		constructor(e = 1e3, t = "", o) {
			super("close", o);
			g(this, "code");
			g(this, "reason");
			g(this, "wasClean", !0);
			(this.code = e), (this.reason = t);
		}
	};
const Oe = { Event, ErrorEvent: _t, CloseEvent: Tt };
function rs(s, e) {
	if (!s) throw new Error(e);
}
function as(s) {
	return new s.constructor(s.type, s);
}
function ls(s) {
	return "data" in s
		? new MessageEvent(s.type, s)
		: "code" in s || "reason" in s
			? new Tt(s.code || 1999, s.reason || "unknown reason", s)
			: "error" in s
				? new _t(s.error, s)
				: new Event(s.type, s);
}
var pt;
const cs =
		typeof process < "u" &&
		typeof ((pt = process.versions) == null ? void 0 : pt.node) < "u",
	hs = typeof navigator < "u" && navigator.product === "ReactNative",
	be = cs || hs ? ls : as,
	j = {
		maxReconnectionDelay: 1e4,
		minReconnectionDelay: 1e3 + Math.random() * 4e3,
		minUptime: 5e3,
		reconnectionDelayGrowFactor: 1.3,
		connectionTimeout: 4e3,
		maxRetries: Number.POSITIVE_INFINITY,
		maxEnqueuedMessages: Number.POSITIVE_INFINITY,
	};
let tt = !1;
var ds = class J extends EventTarget {
	constructor(t, o, i = {}) {
		super();
		g(this, "_ws");
		g(this, "_retryCount", -1);
		g(this, "_uptimeTimeout");
		g(this, "_connectTimeout");
		g(this, "_shouldReconnect", !0);
		g(this, "_connectLock", !1);
		g(this, "_binaryType", "blob");
		g(this, "_closeCalled", !1);
		g(this, "_messageQueue", []);
		g(this, "_debugLogger", console.log.bind(console));
		g(this, "_url");
		g(this, "_protocols");
		g(this, "_options");
		g(this, "onclose", null);
		g(this, "onerror", null);
		g(this, "onmessage", null);
		g(this, "onopen", null);
		g(this, "_handleOpen", (t) => {
			this._debug("open event");
			const { minUptime: o = j.minUptime } = this._options;
			clearTimeout(this._connectTimeout),
				(this._uptimeTimeout = setTimeout(() => this._acceptOpen(), o)),
				rs(this._ws, "WebSocket is not defined"),
				(this._ws.binaryType = this._binaryType),
				this._messageQueue.forEach((i) => {
					var n;
					(n = this._ws) == null || n.send(i);
				}),
				(this._messageQueue = []),
				this.onopen && this.onopen(t),
				this.dispatchEvent(be(t));
		});
		g(this, "_handleMessage", (t) => {
			this._debug("message event"),
				this.onmessage && this.onmessage(t),
				this.dispatchEvent(be(t));
		});
		g(this, "_handleError", (t) => {
			this._debug("error event", t.message),
				this._disconnect(void 0, t.message === "TIMEOUT" ? "timeout" : void 0),
				this.onerror && this.onerror(t),
				this._debug("exec error listeners"),
				this.dispatchEvent(be(t)),
				this._connect();
		});
		g(this, "_handleClose", (t) => {
			this._debug("close event"),
				this._clearTimeouts(),
				this._shouldReconnect && this._connect(),
				this.onclose && this.onclose(t),
				this.dispatchEvent(be(t));
		});
		(this._url = t),
			(this._protocols = o),
			(this._options = i),
			this._options.startClosed && (this._shouldReconnect = !1),
			this._options.debugLogger &&
				(this._debugLogger = this._options.debugLogger),
			this._connect();
	}
	static get CONNECTING() {
		return 0;
	}
	static get OPEN() {
		return 1;
	}
	static get CLOSING() {
		return 2;
	}
	static get CLOSED() {
		return 3;
	}
	get CONNECTING() {
		return J.CONNECTING;
	}
	get OPEN() {
		return J.OPEN;
	}
	get CLOSING() {
		return J.CLOSING;
	}
	get CLOSED() {
		return J.CLOSED;
	}
	get binaryType() {
		return this._ws ? this._ws.binaryType : this._binaryType;
	}
	set binaryType(t) {
		(this._binaryType = t), this._ws && (this._ws.binaryType = t);
	}
	get retryCount() {
		return Math.max(this._retryCount, 0);
	}
	get bufferedAmount() {
		return (
			this._messageQueue.reduce(
				(t, o) => (
					typeof o == "string"
						? (t += o.length)
						: o instanceof Blob
							? (t += o.size)
							: (t += o.byteLength),
					t
				),
				0,
			) + (this._ws ? this._ws.bufferedAmount : 0)
		);
	}
	get extensions() {
		return this._ws ? this._ws.extensions : "";
	}
	get protocol() {
		return this._ws ? this._ws.protocol : "";
	}
	get readyState() {
		return this._ws
			? this._ws.readyState
			: this._options.startClosed
				? J.CLOSED
				: J.CONNECTING;
	}
	get url() {
		return this._ws ? this._ws.url : "";
	}
	get shouldReconnect() {
		return this._shouldReconnect;
	}
	close(t = 1e3, o) {
		if (
			((this._closeCalled = !0),
			(this._shouldReconnect = !1),
			this._clearTimeouts(),
			!this._ws)
		) {
			this._debug("close enqueued: no ws instance");
			return;
		}
		if (this._ws.readyState === this.CLOSED) {
			this._debug("close: already closed");
			return;
		}
		this._ws.close(t, o);
	}
	reconnect(t, o) {
		(this._shouldReconnect = !0),
			(this._closeCalled = !1),
			(this._retryCount = -1),
			!this._ws || this._ws.readyState === this.CLOSED
				? this._connect()
				: (this._disconnect(t, o), this._connect());
	}
	send(t) {
		if (this._ws && this._ws.readyState === this.OPEN)
			this._debug("send", t), this._ws.send(t);
		else {
			const { maxEnqueuedMessages: o = j.maxEnqueuedMessages } = this._options;
			this._messageQueue.length < o &&
				(this._debug("enqueue", t), this._messageQueue.push(t));
		}
	}
	_debug(...t) {
		this._options.debug && this._debugLogger("RWS>", ...t);
	}
	_getNextDelay() {
		const {
			reconnectionDelayGrowFactor: t = j.reconnectionDelayGrowFactor,
			minReconnectionDelay: o = j.minReconnectionDelay,
			maxReconnectionDelay: i = j.maxReconnectionDelay,
		} = this._options;
		let n = 0;
		return (
			this._retryCount > 0 &&
				((n = o * t ** (this._retryCount - 1)), n > i && (n = i)),
			this._debug("next delay", n),
			n
		);
	}
	_wait() {
		return new Promise((t) => {
			setTimeout(t, this._getNextDelay());
		});
	}
	_getNextProtocols(t) {
		if (!t) return Promise.resolve(null);
		if (typeof t == "string" || Array.isArray(t)) return Promise.resolve(t);
		if (typeof t == "function") {
			const o = t();
			if (!o) return Promise.resolve(null);
			if (typeof o == "string" || Array.isArray(o)) return Promise.resolve(o);
			if (o.then) return o;
		}
		throw Error("Invalid protocols");
	}
	_getNextUrl(t) {
		if (typeof t == "string") return Promise.resolve(t);
		if (typeof t == "function") {
			const o = t();
			if (typeof o == "string") return Promise.resolve(o);
			if (o.then) return o;
		}
		throw Error("Invalid URL");
	}
	_connect() {
		if (this._connectLock || !this._shouldReconnect) return;
		this._connectLock = !0;
		const {
			maxRetries: t = j.maxRetries,
			connectionTimeout: o = j.connectionTimeout,
		} = this._options;
		if (this._retryCount >= t) {
			this._debug("max retries reached", this._retryCount, ">=", t),
				(this._connectLock = !1);
			return;
		}
		this._retryCount++,
			this._debug("connect", this._retryCount),
			this._removeListeners(),
			this._wait()
				.then(() =>
					Promise.all([
						this._getNextUrl(this._url),
						this._getNextProtocols(this._protocols || null),
					]),
				)
				.then(([i, n]) => {
					if (this._closeCalled) {
						this._connectLock = !1;
						return;
					}
					!this._options.WebSocket &&
						typeof WebSocket > "u" &&
						!tt &&
						(console.error(`‼️ No WebSocket implementation available. You should define options.WebSocket. 

For example, if you're using node.js, run \`npm install ws\`, and then in your code:

import PartySocket from 'partysocket';
import WS from 'ws';

const partysocket = new PartySocket({
  host: "127.0.0.1:1999",
  room: "test-room",
  WebSocket: WS
});

`),
						(tt = !0));
					const r = this._options.WebSocket || WebSocket;
					this._debug("connect", { url: i, protocols: n }),
						(this._ws = n ? new r(i, n) : new r(i)),
						(this._ws.binaryType = this._binaryType),
						(this._connectLock = !1),
						this._addListeners(),
						(this._connectTimeout = setTimeout(() => this._handleTimeout(), o));
				})
				.catch((i) => {
					(this._connectLock = !1),
						this._handleError(new Oe.ErrorEvent(Error(i.message), this));
				});
	}
	_handleTimeout() {
		this._debug("timeout event"),
			this._handleError(new Oe.ErrorEvent(Error("TIMEOUT"), this));
	}
	_disconnect(t = 1e3, o) {
		if ((this._clearTimeouts(), !!this._ws)) {
			this._removeListeners();
			try {
				(this._ws.readyState === this.OPEN ||
					this._ws.readyState === this.CONNECTING) &&
					this._ws.close(t, o),
					this._handleClose(new Oe.CloseEvent(t, o, this));
			} catch {}
		}
	}
	_acceptOpen() {
		this._debug("accept open"), (this._retryCount = 0);
	}
	_removeListeners() {
		this._ws &&
			(this._debug("removeListeners"),
			this._ws.removeEventListener("open", this._handleOpen),
			this._ws.removeEventListener("close", this._handleClose),
			this._ws.removeEventListener("message", this._handleMessage),
			this._ws.removeEventListener("error", this._handleError));
	}
	_addListeners() {
		this._ws &&
			(this._debug("addListeners"),
			this._ws.addEventListener("open", this._handleOpen),
			this._ws.addEventListener("close", this._handleClose),
			this._ws.addEventListener("message", this._handleMessage),
			this._ws.addEventListener("error", this._handleError));
	}
	_clearTimeouts() {
		clearTimeout(this._connectTimeout), clearTimeout(this._uptimeTimeout);
	}
};
const us = (s) => s[1] !== null && s[1] !== void 0;
function fs() {
	if (crypto != null && crypto.randomUUID) return crypto.randomUUID();
	let s = Date.now(),
		e =
			((performance == null ? void 0 : performance.now) &&
				performance.now() * 1e3) ||
			0;
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (t) {
		let o = Math.random() * 16;
		return (
			s > 0
				? ((o = ((s + o) % 16) | 0), (s = Math.floor(s / 16)))
				: ((o = ((e + o) % 16) | 0), (e = Math.floor(e / 16))),
			(t === "x" ? o : (o & 3) | 8).toString(16)
		);
	});
}
function St(s, e, t = {}) {
	const {
		host: o,
		path: i,
		protocol: n,
		room: r,
		party: l,
		basePath: a,
		prefix: h,
		query: d,
	} = s;
	let u = o.replace(/^(http|https|ws|wss):\/\//, "");
	if ((u.endsWith("/") && (u = u.slice(0, -1)), i != null && i.startsWith("/")))
		throw new Error("path must not start with a slash");
	const w = l ?? "main",
		y = i ? `/${i}` : "",
		v =
			n ||
			(u.startsWith("localhost:") ||
			u.startsWith("127.0.0.1:") ||
			u.startsWith("192.168.") ||
			u.startsWith("10.") ||
			(u.startsWith("172.") &&
				u.split(".")[1] >= "16" &&
				u.split(".")[1] <= "31") ||
			u.startsWith("[::ffff:7f00:1]:")
				? e
				: `${e}s`),
		D = `${v}://${u}/${a || `${h || "parties"}/${w}/${r}`}${y}`,
		L = (M = {}) =>
			`${D}?${new URLSearchParams([...Object.entries(t), ...Object.entries(M).filter(us)])}`,
		b = typeof d == "function" ? async () => L(await d()) : L(d);
	return {
		host: u,
		path: y,
		room: r,
		name: w,
		protocol: v,
		partyUrl: D,
		urlProvider: b,
	};
}
var ps = class extends ds {
	constructor(e) {
		var o, i;
		const t = st(e);
		super(t.urlProvider, t.protocols, t.socketOptions);
		g(this, "_pk");
		g(this, "_pkurl");
		g(this, "name");
		g(this, "room");
		g(this, "host");
		g(this, "path");
		g(this, "basePath");
		if (
			((this.partySocketOptions = e),
			this.setWSProperties(t),
			!e.startClosed && !this.room && !this.basePath)
		)
			throw (
				(this.close(),
				new Error(
					"Either room or basePath must be provided to connect. Use startClosed: true to create a socket and set them via updateProperties before calling reconnect().",
				))
			);
		e.disableNameValidation ||
			((o = e.party) != null &&
				o.includes("/") &&
				console.warn(
					`PartySocket: party name "${e.party}" contains forward slash which may cause routing issues. Consider using a name without forward slashes or set disableNameValidation: true to bypass this warning.`,
				),
			(i = e.room) != null &&
				i.includes("/") &&
				console.warn(
					`PartySocket: room name "${e.room}" contains forward slash which may cause routing issues. Consider using a name without forward slashes or set disableNameValidation: true to bypass this warning.`,
				));
	}
	updateProperties(e) {
		const t = st({
			...this.partySocketOptions,
			...e,
			host: e.host ?? this.host,
			room: e.room ?? this.room,
			path: e.path ?? this.path,
			basePath: e.basePath ?? this.basePath,
		});
		(this._url = t.urlProvider),
			(this._protocols = t.protocols),
			(this._options = t.socketOptions),
			this.setWSProperties(t);
	}
	setWSProperties(e) {
		const {
			_pk: t,
			_pkurl: o,
			name: i,
			room: n,
			host: r,
			path: l,
			basePath: a,
		} = e;
		(this._pk = t),
			(this._pkurl = o),
			(this.name = i),
			(this.room = n),
			(this.host = r),
			(this.path = l),
			(this.basePath = a);
	}
	reconnect(e, t) {
		if (!this.host)
			throw new Error(
				"The host must be set before connecting, use `updateProperties` method to set it or pass it to the constructor.",
			);
		if (!this.room && !this.basePath)
			throw new Error(
				"The room (or basePath) must be set before connecting, use `updateProperties` method to set it or pass it to the constructor.",
			);
		super.reconnect(e, t);
	}
	get id() {
		return this._pk;
	}
	get roomUrl() {
		return this._pkurl;
	}
	static async fetch(e, t) {
		const o = St(e, "http"),
			i =
				typeof o.urlProvider == "string"
					? o.urlProvider
					: await o.urlProvider();
		return (e.fetch ?? fetch)(i, t);
	}
};
function st(s) {
	const {
			id: e,
			host: t,
			path: o,
			party: i,
			room: n,
			protocol: r,
			query: l,
			protocols: a,
			...h
		} = s,
		d = e || fs(),
		u = St(s, "ws", { _pk: d });
	return {
		_pk: d,
		_pkurl: u.partyUrl,
		name: u.name,
		room: u.room,
		host: u.host,
		path: u.path,
		basePath: s.basePath,
		protocols: a,
		socketOptions: h,
		urlProvider: u.urlProvider,
	};
}
const Mt = {
	name: "CopyShader",
	uniforms: { tDiffuse: { value: null }, opacity: { value: 1 } },
	vertexShader: `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
	fragmentShader: `

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`,
};
class ge {
	constructor() {
		(this.isPass = !0),
			(this.enabled = !0),
			(this.needsSwap = !0),
			(this.clear = !1),
			(this.renderToScreen = !1);
	}
	setSize() {}
	render() {
		console.error("THREE.Pass: .render() must be implemented in derived pass.");
	}
	dispose() {}
}
const ms = new Ut(-1, 1, 1, -1, 0, 1);
class ws extends mt {
	constructor() {
		super(),
			this.setAttribute("position", new et([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)),
			this.setAttribute("uv", new et([0, 2, 0, 0, 2, 0], 2));
	}
}
const gs = new ws();
class Ct {
	constructor(e) {
		this._mesh = new m(gs, e);
	}
	dispose() {
		this._mesh.geometry.dispose();
	}
	render(e) {
		e.render(this._mesh, ms);
	}
	get material() {
		return this._mesh.material;
	}
	set material(e) {
		this._mesh.material = e;
	}
}
class ys extends ge {
	constructor(e, t) {
		super(),
			(this.textureID = t !== void 0 ? t : "tDiffuse"),
			e instanceof ee
				? ((this.uniforms = e.uniforms), (this.material = e))
				: e &&
					((this.uniforms = Ge.clone(e.uniforms)),
					(this.material = new ee({
						name: e.name !== void 0 ? e.name : "unspecified",
						defines: Object.assign({}, e.defines),
						uniforms: this.uniforms,
						vertexShader: e.vertexShader,
						fragmentShader: e.fragmentShader,
					}))),
			(this.fsQuad = new Ct(this.material));
	}
	render(e, t, o) {
		this.uniforms[this.textureID] &&
			(this.uniforms[this.textureID].value = o.texture),
			(this.fsQuad.material = this.material),
			this.renderToScreen
				? (e.setRenderTarget(null), this.fsQuad.render(e))
				: (e.setRenderTarget(t),
					this.clear &&
						e.clear(e.autoClearColor, e.autoClearDepth, e.autoClearStencil),
					this.fsQuad.render(e));
	}
	dispose() {
		this.material.dispose(), this.fsQuad.dispose();
	}
}
class ot extends ge {
	constructor(e, t) {
		super(),
			(this.scene = e),
			(this.camera = t),
			(this.clear = !0),
			(this.needsSwap = !1),
			(this.inverse = !1);
	}
	render(e, t, o) {
		const i = e.getContext(),
			n = e.state;
		n.buffers.color.setMask(!1),
			n.buffers.depth.setMask(!1),
			n.buffers.color.setLocked(!0),
			n.buffers.depth.setLocked(!0);
		let r, l;
		this.inverse ? ((r = 0), (l = 1)) : ((r = 1), (l = 0)),
			n.buffers.stencil.setTest(!0),
			n.buffers.stencil.setOp(i.REPLACE, i.REPLACE, i.REPLACE),
			n.buffers.stencil.setFunc(i.ALWAYS, r, 4294967295),
			n.buffers.stencil.setClear(l),
			n.buffers.stencil.setLocked(!0),
			e.setRenderTarget(o),
			this.clear && e.clear(),
			e.render(this.scene, this.camera),
			e.setRenderTarget(t),
			this.clear && e.clear(),
			e.render(this.scene, this.camera),
			n.buffers.color.setLocked(!1),
			n.buffers.depth.setLocked(!1),
			n.buffers.color.setMask(!0),
			n.buffers.depth.setMask(!0),
			n.buffers.stencil.setLocked(!1),
			n.buffers.stencil.setFunc(i.EQUAL, 1, 4294967295),
			n.buffers.stencil.setOp(i.KEEP, i.KEEP, i.KEEP),
			n.buffers.stencil.setLocked(!0);
	}
}
class xs extends ge {
	constructor() {
		super(), (this.needsSwap = !1);
	}
	render(e) {
		e.state.buffers.stencil.setLocked(!1), e.state.buffers.stencil.setTest(!1);
	}
}
class vs {
	constructor(e, t) {
		if (
			((this.renderer = e),
			(this._pixelRatio = e.getPixelRatio()),
			t === void 0)
		) {
			const o = e.getSize(new U());
			(this._width = o.width),
				(this._height = o.height),
				(t = new Me(
					this._width * this._pixelRatio,
					this._height * this._pixelRatio,
					{ type: Ce },
				)),
				(t.texture.name = "EffectComposer.rt1");
		} else (this._width = t.width), (this._height = t.height);
		(this.renderTarget1 = t),
			(this.renderTarget2 = t.clone()),
			(this.renderTarget2.texture.name = "EffectComposer.rt2"),
			(this.writeBuffer = this.renderTarget1),
			(this.readBuffer = this.renderTarget2),
			(this.renderToScreen = !0),
			(this.passes = []),
			(this.copyPass = new ys(Mt)),
			(this.copyPass.material.blending = Ft),
			(this.clock = new wt());
	}
	swapBuffers() {
		const e = this.readBuffer;
		(this.readBuffer = this.writeBuffer), (this.writeBuffer = e);
	}
	addPass(e) {
		this.passes.push(e),
			e.setSize(
				this._width * this._pixelRatio,
				this._height * this._pixelRatio,
			);
	}
	insertPass(e, t) {
		this.passes.splice(t, 0, e),
			e.setSize(
				this._width * this._pixelRatio,
				this._height * this._pixelRatio,
			);
	}
	removePass(e) {
		const t = this.passes.indexOf(e);
		t !== -1 && this.passes.splice(t, 1);
	}
	isLastEnabledPass(e) {
		for (let t = e + 1; t < this.passes.length; t++)
			if (this.passes[t].enabled) return !1;
		return !0;
	}
	render(e) {
		e === void 0 && (e = this.clock.getDelta());
		const t = this.renderer.getRenderTarget();
		let o = !1;
		for (let i = 0, n = this.passes.length; i < n; i++) {
			const r = this.passes[i];
			if (r.enabled !== !1) {
				if (
					((r.renderToScreen =
						this.renderToScreen && this.isLastEnabledPass(i)),
					r.render(this.renderer, this.writeBuffer, this.readBuffer, e, o),
					r.needsSwap)
				) {
					if (o) {
						const l = this.renderer.getContext(),
							a = this.renderer.state.buffers.stencil;
						a.setFunc(l.NOTEQUAL, 1, 4294967295),
							this.copyPass.render(
								this.renderer,
								this.writeBuffer,
								this.readBuffer,
								e,
							),
							a.setFunc(l.EQUAL, 1, 4294967295);
					}
					this.swapBuffers();
				}
				ot !== void 0 &&
					(r instanceof ot ? (o = !0) : r instanceof xs && (o = !1));
			}
		}
		this.renderer.setRenderTarget(t);
	}
	reset(e) {
		if (e === void 0) {
			const t = this.renderer.getSize(new U());
			(this._pixelRatio = this.renderer.getPixelRatio()),
				(this._width = t.width),
				(this._height = t.height),
				(e = this.renderTarget1.clone()),
				e.setSize(
					this._width * this._pixelRatio,
					this._height * this._pixelRatio,
				);
		}
		this.renderTarget1.dispose(),
			this.renderTarget2.dispose(),
			(this.renderTarget1 = e),
			(this.renderTarget2 = e.clone()),
			(this.writeBuffer = this.renderTarget1),
			(this.readBuffer = this.renderTarget2);
	}
	setSize(e, t) {
		(this._width = e), (this._height = t);
		const o = this._width * this._pixelRatio,
			i = this._height * this._pixelRatio;
		this.renderTarget1.setSize(o, i), this.renderTarget2.setSize(o, i);
		for (let n = 0; n < this.passes.length; n++) this.passes[n].setSize(o, i);
	}
	setPixelRatio(e) {
		(this._pixelRatio = e), this.setSize(this._width, this._height);
	}
	dispose() {
		this.renderTarget1.dispose(),
			this.renderTarget2.dispose(),
			this.copyPass.dispose();
	}
}
class bs extends ge {
	constructor(e, t, o = null, i = null, n = null) {
		super(),
			(this.scene = e),
			(this.camera = t),
			(this.overrideMaterial = o),
			(this.clearColor = i),
			(this.clearAlpha = n),
			(this.clear = !0),
			(this.clearDepth = !1),
			(this.needsSwap = !1),
			(this._oldClearColor = new k());
	}
	render(e, t, o) {
		const i = e.autoClear;
		e.autoClear = !1;
		let n, r;
		this.overrideMaterial !== null &&
			((r = this.scene.overrideMaterial),
			(this.scene.overrideMaterial = this.overrideMaterial)),
			this.clearColor !== null &&
				(e.getClearColor(this._oldClearColor),
				e.setClearColor(this.clearColor)),
			this.clearAlpha !== null &&
				((n = e.getClearAlpha()), e.setClearAlpha(this.clearAlpha)),
			this.clearDepth == !0 && e.clearDepth(),
			e.setRenderTarget(this.renderToScreen ? null : o),
			this.clear === !0 &&
				e.clear(e.autoClearColor, e.autoClearDepth, e.autoClearStencil),
			e.render(this.scene, this.camera),
			this.clearColor !== null && e.setClearColor(this._oldClearColor),
			this.clearAlpha !== null && e.setClearAlpha(n),
			this.overrideMaterial !== null && (this.scene.overrideMaterial = r),
			(e.autoClear = i);
	}
}
const _s = {
	uniforms: {
		tDiffuse: { value: null },
		luminosityThreshold: { value: 1 },
		smoothWidth: { value: 1 },
		defaultColor: { value: new k(0) },
		defaultOpacity: { value: 0 },
	},
	vertexShader: `

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
	fragmentShader: `

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			vec3 luma = vec3( 0.299, 0.587, 0.114 );

			float v = dot( texel.xyz, luma );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`,
};
class he extends ge {
	constructor(e, t, o, i) {
		super(),
			(this.strength = t !== void 0 ? t : 1),
			(this.radius = o),
			(this.threshold = i),
			(this.resolution = e !== void 0 ? new U(e.x, e.y) : new U(256, 256)),
			(this.clearColor = new k(0, 0, 0)),
			(this.renderTargetsHorizontal = []),
			(this.renderTargetsVertical = []),
			(this.nMips = 5);
		let n = Math.round(this.resolution.x / 2),
			r = Math.round(this.resolution.y / 2);
		(this.renderTargetBright = new Me(n, r, { type: Ce })),
			(this.renderTargetBright.texture.name = "UnrealBloomPass.bright"),
			(this.renderTargetBright.texture.generateMipmaps = !1);
		for (let u = 0; u < this.nMips; u++) {
			const w = new Me(n, r, { type: Ce });
			(w.texture.name = "UnrealBloomPass.h" + u),
				(w.texture.generateMipmaps = !1),
				this.renderTargetsHorizontal.push(w);
			const y = new Me(n, r, { type: Ce });
			(y.texture.name = "UnrealBloomPass.v" + u),
				(y.texture.generateMipmaps = !1),
				this.renderTargetsVertical.push(y),
				(n = Math.round(n / 2)),
				(r = Math.round(r / 2));
		}
		const l = _s;
		(this.highPassUniforms = Ge.clone(l.uniforms)),
			(this.highPassUniforms.luminosityThreshold.value = i),
			(this.highPassUniforms.smoothWidth.value = 0.01),
			(this.materialHighPassFilter = new ee({
				uniforms: this.highPassUniforms,
				vertexShader: l.vertexShader,
				fragmentShader: l.fragmentShader,
			})),
			(this.separableBlurMaterials = []);
		const a = [3, 5, 7, 9, 11];
		(n = Math.round(this.resolution.x / 2)),
			(r = Math.round(this.resolution.y / 2));
		for (let u = 0; u < this.nMips; u++)
			this.separableBlurMaterials.push(this.getSeperableBlurMaterial(a[u])),
				(this.separableBlurMaterials[u].uniforms.invSize.value = new U(
					1 / n,
					1 / r,
				)),
				(n = Math.round(n / 2)),
				(r = Math.round(r / 2));
		(this.compositeMaterial = this.getCompositeMaterial(this.nMips)),
			(this.compositeMaterial.uniforms.blurTexture1.value =
				this.renderTargetsVertical[0].texture),
			(this.compositeMaterial.uniforms.blurTexture2.value =
				this.renderTargetsVertical[1].texture),
			(this.compositeMaterial.uniforms.blurTexture3.value =
				this.renderTargetsVertical[2].texture),
			(this.compositeMaterial.uniforms.blurTexture4.value =
				this.renderTargetsVertical[3].texture),
			(this.compositeMaterial.uniforms.blurTexture5.value =
				this.renderTargetsVertical[4].texture),
			(this.compositeMaterial.uniforms.bloomStrength.value = t),
			(this.compositeMaterial.uniforms.bloomRadius.value = 0.1);
		const h = [1, 0.8, 0.6, 0.4, 0.2];
		(this.compositeMaterial.uniforms.bloomFactors.value = h),
			(this.bloomTintColors = [
				new S(1, 1, 1),
				new S(1, 1, 1),
				new S(1, 1, 1),
				new S(1, 1, 1),
				new S(1, 1, 1),
			]),
			(this.compositeMaterial.uniforms.bloomTintColors.value =
				this.bloomTintColors);
		const d = Mt;
		(this.copyUniforms = Ge.clone(d.uniforms)),
			(this.blendMaterial = new ee({
				uniforms: this.copyUniforms,
				vertexShader: d.vertexShader,
				fragmentShader: d.fragmentShader,
				blending: Le,
				depthTest: !1,
				depthWrite: !1,
				transparent: !0,
			})),
			(this.enabled = !0),
			(this.needsSwap = !1),
			(this._oldClearColor = new k()),
			(this.oldClearAlpha = 1),
			(this.basic = new K()),
			(this.fsQuad = new Ct(null));
	}
	dispose() {
		for (let e = 0; e < this.renderTargetsHorizontal.length; e++)
			this.renderTargetsHorizontal[e].dispose();
		for (let e = 0; e < this.renderTargetsVertical.length; e++)
			this.renderTargetsVertical[e].dispose();
		this.renderTargetBright.dispose();
		for (let e = 0; e < this.separableBlurMaterials.length; e++)
			this.separableBlurMaterials[e].dispose();
		this.compositeMaterial.dispose(),
			this.blendMaterial.dispose(),
			this.basic.dispose(),
			this.fsQuad.dispose();
	}
	setSize(e, t) {
		let o = Math.round(e / 2),
			i = Math.round(t / 2);
		this.renderTargetBright.setSize(o, i);
		for (let n = 0; n < this.nMips; n++)
			this.renderTargetsHorizontal[n].setSize(o, i),
				this.renderTargetsVertical[n].setSize(o, i),
				(this.separableBlurMaterials[n].uniforms.invSize.value = new U(
					1 / o,
					1 / i,
				)),
				(o = Math.round(o / 2)),
				(i = Math.round(i / 2));
	}
	render(e, t, o, i, n) {
		e.getClearColor(this._oldClearColor),
			(this.oldClearAlpha = e.getClearAlpha());
		const r = e.autoClear;
		(e.autoClear = !1),
			e.setClearColor(this.clearColor, 0),
			n && e.state.buffers.stencil.setTest(!1),
			this.renderToScreen &&
				((this.fsQuad.material = this.basic),
				(this.basic.map = o.texture),
				e.setRenderTarget(null),
				e.clear(),
				this.fsQuad.render(e)),
			(this.highPassUniforms.tDiffuse.value = o.texture),
			(this.highPassUniforms.luminosityThreshold.value = this.threshold),
			(this.fsQuad.material = this.materialHighPassFilter),
			e.setRenderTarget(this.renderTargetBright),
			e.clear(),
			this.fsQuad.render(e);
		let l = this.renderTargetBright;
		for (let a = 0; a < this.nMips; a++)
			(this.fsQuad.material = this.separableBlurMaterials[a]),
				(this.separableBlurMaterials[a].uniforms.colorTexture.value =
					l.texture),
				(this.separableBlurMaterials[a].uniforms.direction.value =
					he.BlurDirectionX),
				e.setRenderTarget(this.renderTargetsHorizontal[a]),
				e.clear(),
				this.fsQuad.render(e),
				(this.separableBlurMaterials[a].uniforms.colorTexture.value =
					this.renderTargetsHorizontal[a].texture),
				(this.separableBlurMaterials[a].uniforms.direction.value =
					he.BlurDirectionY),
				e.setRenderTarget(this.renderTargetsVertical[a]),
				e.clear(),
				this.fsQuad.render(e),
				(l = this.renderTargetsVertical[a]);
		(this.fsQuad.material = this.compositeMaterial),
			(this.compositeMaterial.uniforms.bloomStrength.value = this.strength),
			(this.compositeMaterial.uniforms.bloomRadius.value = this.radius),
			(this.compositeMaterial.uniforms.bloomTintColors.value =
				this.bloomTintColors),
			e.setRenderTarget(this.renderTargetsHorizontal[0]),
			e.clear(),
			this.fsQuad.render(e),
			(this.fsQuad.material = this.blendMaterial),
			(this.copyUniforms.tDiffuse.value =
				this.renderTargetsHorizontal[0].texture),
			n && e.state.buffers.stencil.setTest(!0),
			this.renderToScreen
				? (e.setRenderTarget(null), this.fsQuad.render(e))
				: (e.setRenderTarget(o), this.fsQuad.render(e)),
			e.setClearColor(this._oldClearColor, this.oldClearAlpha),
			(e.autoClear = r);
	}
	getSeperableBlurMaterial(e) {
		const t = [];
		for (let o = 0; o < e; o++)
			t.push((0.39894 * Math.exp((-0.5 * o * o) / (e * e))) / e);
		return new ee({
			defines: { KERNEL_RADIUS: e },
			uniforms: {
				colorTexture: { value: null },
				invSize: { value: new U(0.5, 0.5) },
				direction: { value: new U(0.5, 0.5) },
				gaussianCoefficients: { value: t },
			},
			vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
			fragmentShader: `#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`,
		});
	}
	getCompositeMaterial(e) {
		return new ee({
			defines: { NUM_MIPS: e },
			uniforms: {
				blurTexture1: { value: null },
				blurTexture2: { value: null },
				blurTexture3: { value: null },
				blurTexture4: { value: null },
				blurTexture5: { value: null },
				bloomStrength: { value: 1 },
				bloomFactors: { value: null },
				bloomTintColors: { value: null },
				bloomRadius: { value: 0 },
			},
			vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
			fragmentShader: `varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`,
		});
	}
}
he.BlurDirectionX = new U(1, 0);
he.BlurDirectionY = new U(0, 1);
const p = {
		players: {},
		myId: null,
		coins: 0,
		health: 100,
		dead: !1,
		team: null,
		teamScores: { red: 0, blue: 0 },
		spells: { dash: 0, shield: 0, blast: 0, teleport: 0 },
		dashEndTime: 0,
	},
	z = {
		w: !1,
		a: !1,
		s: !1,
		d: !1,
		ArrowUp: !1,
		ArrowLeft: !1,
		ArrowDown: !1,
		ArrowRight: !1,
		space: !1,
	},
	te = { drive: { active: !1, pointerId: null, x: 0, y: 0 }, fire: !1 },
	O = {},
	$ = {},
	Ts = new wt();
let Ue = 0,
	P = null,
	c = null,
	X = [],
	pe = [],
	E = 0,
	N = 0;
const Ss = 40,
	Ms = 25,
	qe = 18,
	Cs = 45,
	_e = 2.15,
	Te = 1.32,
	Et = 0.62,
	Pt = new S(0, 1, 0),
	Es = 6.5,
	Ps = 9.5,
	Ds = 12,
	Ls = 0.08,
	T = 64,
	it = 24,
	le = 3,
	me = {},
	Pe = [],
	Fe = new S(),
	V = {
		sand: new k(13350027),
		grassLow: new k(8890474),
		grassHigh: new k(5796673),
		rock: new k(8156524),
		snow: new k(16054267),
	};
function Qe(s, e) {
	return 1 - Math.exp(-s * e);
}
function Ie(s, e = new S()) {
	return e.set(-Math.sin(s), 0, -Math.cos(s));
}
function Is(s, e = new S()) {
	return e.set(Math.cos(s), 0, -Math.sin(s));
}
function _(s, e, t = 17) {
	const o = Math.sin(s * 127.1 + e * 311.7 + t) * 43758.5453;
	return o - Math.floor(o);
}
function Ee(s, e) {
	const t = Math.floor(s),
		o = Math.floor(e),
		i = s - t,
		n = e - o,
		r = i * i * (3 - 2 * i),
		l = n * n * (3 - 2 * n);
	return (
		_(t, o) * (1 - r) * (1 - l) +
		_(t + 1, o) * r * (1 - l) +
		_(t, o + 1) * (1 - r) * l +
		_(t + 1, o + 1) * r * l
	);
}
function G(s, e) {
	let t = Ee(s * 0.008, e * 0.008) * 18;
	(t += Ee(s * 0.025, e * 0.025) * 6), (t += Ee(s * 0.07, e * 0.07) * 1.5);
	const o = Math.sqrt(s * s + e * e),
		i = Math.max(0, 1 - o / 40);
	return t * (1 - i * i);
}
const x = new Wt(),
	Dt = 13231611;
x.background = new k(Dt);
x.fog = new Vt(Dt, 90, 340);
const B = new Ht(75, window.innerWidth / window.innerHeight, 0.1, 1e3),
	F = new Gt({ antialias: !0 });
F.setSize(window.innerWidth, window.innerHeight);
F.setPixelRatio(Math.min(window.devicePixelRatio, 2));
F.outputColorSpace = qt;
F.shadowMap.enabled = !0;
F.shadowMap.type = Qt;
F.toneMapping = Yt;
F.toneMappingExposure = 1.08;
document.body.appendChild(F.domElement);
const Rs = new bs(x, B),
	Re = new he(new U(window.innerWidth, window.innerHeight), 1.2, 0.45, 0.88);
Re.threshold = 0.35;
Re.strength = 0.22;
Re.radius = 0.55;
const ze = new vs(F);
ze.addPass(Rs);
ze.addPass(Re);
const We = new ts(),
	we = new U(),
	nt = document.getElementById("drive-stick"),
	Ve = document.getElementById("drive-stick-knob"),
	zs = document.getElementById("fire-btn"),
	ks = document.getElementById("dash-btn"),
	Bs = document.getElementById("shield-btn"),
	As = document.getElementById("blast-btn"),
	Ns = new $t(16777215, 0.42);
x.add(Ns);
const Os = new Xt(15333119, 3879975, 0.9);
x.add(Os);
const W = new Kt(16773322, 1.8);
W.position.set(-120, 170, -90);
W.castShadow = !0;
W.shadow.mapSize.width = 4096;
W.shadow.mapSize.height = 4096;
W.shadow.camera.left = -180;
W.shadow.camera.right = 180;
W.shadow.camera.top = 180;
W.shadow.camera.bottom = -180;
W.shadow.bias = -18e-5;
x.add(W);
const Lt = new gt(6936063, 0.28, 220);
Lt.position.set(0, 45, 0);
x.add(Lt);
const Us = new I({
		vertexColors: !0,
		roughness: 0.94,
		metalness: 0.03,
		flatShading: !1,
	}),
	ke = new yt(
		(() => {
			const s = document.createElement("canvas");
			(s.width = 64), (s.height = 64);
			const e = s.getContext("2d");
			return (
				(e.strokeStyle = "#00d2d3"),
				(e.lineWidth = 1),
				e.strokeRect(0, 0, 64, 64),
				s
			);
		})(),
	);
ke.wrapS = xt;
ke.wrapT = xt;
ke.repeat.set(T / 4, T / 4);
const Fs = new yt(
	(() => {
		const s = document.createElement("canvas");
		(s.width = 128), (s.height = 128);
		const e = s.getContext("2d"),
			t = e.createRadialGradient(64, 64, 8, 64, 64, 60);
		return (
			t.addColorStop(0, "rgba(0, 0, 0, 0.34)"),
			t.addColorStop(0.55, "rgba(0, 0, 0, 0.16)"),
			t.addColorStop(1, "rgba(0, 0, 0, 0)"),
			(e.fillStyle = t),
			e.fillRect(0, 0, 128, 128),
			s
		);
	})(),
);
function Ws() {
	const s = new de(720, 48, 24),
		e = new ee({
			side: jt,
			depthWrite: !1,
			uniforms: {
				topColor: { value: new k(4889576) },
				horizonColor: { value: new k(16046508) },
				bottomColor: { value: new k(15135999) },
				sunDirection: { value: new S(-0.48, 0.77, -0.42).normalize() },
				sunColor: { value: new k(16773060) },
			},
			vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
			fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 horizonColor;
            uniform vec3 bottomColor;
            uniform vec3 sunDirection;
            uniform vec3 sunColor;
            varying vec3 vWorldPosition;

            void main() {
                vec3 dir = normalize(vWorldPosition);
                float horizonBand = pow(1.0 - abs(dir.y), 3.0);
                float topMix = smoothstep(-0.18, 0.82, dir.y);
                vec3 sky = mix(bottomColor, topColor, topMix);
                sky = mix(sky, horizonColor, horizonBand * 0.95);

                float sunGlow = pow(max(dot(dir, normalize(sunDirection)), 0.0), 28.0);
                float sunCore = pow(max(dot(dir, normalize(sunDirection)), 0.0), 180.0);
                sky += sunColor * (sunGlow * 0.32 + sunCore * 0.48);

                gl_FragColor = vec4(sky, 1.0);
            }
        `,
		});
	return new m(s, e);
}
const Vs = Ws();
x.add(Vs);
const It = new m(
	new de(18, 24, 24),
	new K({
		color: 16773563,
		transparent: !0,
		opacity: 0.18,
		blending: Le,
		depthWrite: !1,
	}),
);
It.position.copy(W.position).setLength(285);
x.add(It);
function Hs(s, e, t, o = new k()) {
	s < 1.2
		? o.lerpColors(V.sand, V.grassLow, Q.clamp(s / 1.2, 0, 1))
		: s < 9
			? o.lerpColors(V.grassLow, V.grassHigh, Q.clamp((s - 1.2) / 7.8, 0, 1))
			: s < 16
				? o.lerpColors(V.grassHigh, V.rock, Q.clamp((s - 9) / 7, 0, 1))
				: o.lerpColors(V.rock, V.snow, Q.clamp((s - 16) / 5, 0, 1)),
		e < 0.86 && s > 3 && o.lerp(V.rock, Q.clamp((0.86 - e) * 2.4, 0, 0.85)),
		s > 15.5 && o.lerp(V.snow, Q.clamp((s - 15.5) / 4, 0, 0.75));
	const i = (t - 0.5) * 0.14 + (e - 0.75) * 0.08;
	return o.offsetHSL(0.01 * (t - 0.5), 0.02, i), o;
}
function Gs(s) {
	const e = new I({ color: 8288108, roughness: 0.98, metalness: 0.02 }),
		t = new ce(),
		o = 2 + Math.floor(_(s, s * 0.31, 918) * 3);
	for (let i = 0; i < o; i++) {
		const n = 0.8 + _(s, i, 533) * 1.6,
			r = new m(new ns(n, 0), e);
		r.position.set(
			(_(s, i, 672) - 0.5) * 2.8,
			n * 0.55,
			(_(s, i, 111) - 0.5) * 2.8,
		),
			r.rotation.set(
				_(s, i, 773) * Math.PI,
				_(s, i, 174) * Math.PI,
				_(s, i, 991) * Math.PI,
			),
			r.scale.set(
				1 + _(s, i, 381) * 0.7,
				0.65 + _(s, i, 274) * 0.5,
				0.9 + _(s, i, 845) * 0.5,
			),
			(r.castShadow = !0),
			(r.receiveShadow = !0),
			t.add(r);
	}
	return t;
}
function qs(s, e) {
	const t = `${s}_${e}`;
	if (me[t]) return;
	const o = new ce();
	o.userData.buildingData = [];
	const i = new vt(T, T, it, it),
		n = i.attributes.position,
		r = [];
	for (let v = 0; v < n.count; v++) {
		const D = n.getX(v),
			L = n.getY(v),
			b = s * T + D,
			M = e * T + L,
			R = G(b, M);
		n.setZ(v, R), r.push(R);
	}
	i.computeVertexNormals();
	const l = new Float32Array(n.count * 3),
		a = i.attributes.normal,
		h = new k();
	for (let v = 0; v < n.count; v++) {
		const D = n.getX(v),
			L = n.getY(v),
			b = s * T + D,
			M = e * T + L,
			R = Ee(b * 0.05, M * 0.05),
			q = Hs(r[v], a.getY(v), R, h);
		(l[v * 3] = q.r), (l[v * 3 + 1] = q.g), (l[v * 3 + 2] = q.b);
	}
	i.setAttribute("color", new bt(l, 3));
	const d = new m(i, Us);
	(d.rotation.x = -Math.PI / 2), (d.receiveShadow = !0), Pe.push(d), o.add(d);
	const u = i.clone(),
		w = new K({ map: ke, transparent: !0, opacity: 0.045, blending: Le }),
		y = new m(u, w);
	if (
		((y.position.z = 0.05),
		d.add(y),
		(Math.abs(s) > 1 || Math.abs(e) > 1) && _(s, e, 1234) > 0.85)
	) {
		const v = (_(s, e, 567) - 0.5) * (T * 0.6),
			D = (_(s, e, 890) - 0.5) * (T * 0.6),
			L = 8 + _(s, e, 111) * 10,
			b = 8 + _(s, e, 222) * 10,
			M = { x: s * T + v, z: e * T + D, width: L, depth: b },
			R = Qs(M);
		o.add(R), X.push(M), o.userData.buildingData.push(M);
	}
	if ((Math.abs(s) > 1 || Math.abs(e) > 1) && _(s, e, 7342) > 0.58) {
		const v = Gs(s * 97 + e * 131),
			D = (_(s, e, 847) - 0.5) * T * 0.7,
			L = (_(s, e, 921) - 0.5) * T * 0.7,
			b = s * T + D,
			M = e * T + L;
		v.position.set(D, G(b, M), L), o.add(v);
	}
	o.position.set(s * T, 0, e * T), x.add(o), (me[t] = o);
}
function Qs(s) {
	const e = G(s.x, s.z),
		t = 14 + _(s.x * 0.11, s.z * 0.11, 906) * 18,
		o = new C(s.width, t, s.depth),
		i = new I({ color: 7238269, roughness: 0.76, metalness: 0.28 }),
		n = new m(o, i);
	n.position.set(
		s.x - Math.round(s.x / T) * T,
		e + t / 2,
		s.z - Math.round(s.z / T) * T,
	),
		(n.castShadow = !0),
		(n.receiveShadow = !0);
	const r = new I({
		color: 14020607,
		emissive: 6924543,
		emissiveIntensity: 0.75,
		roughness: 0.2,
		metalness: 0.45,
	});
	for (let a = 0; a < Math.floor(t / 4); a++)
		for (let h = -1; h <= 1; h += 2) {
			const d = new C(1.5, 2, 0.1),
				u = new m(d, r);
			u.position.set(h * (s.width / 3), -t / 2 + 4 + a * 5, s.depth / 2 + 0.1),
				n.add(u);
		}
	const l = new m(
		new C(s.width * 0.92, 0.6, s.depth * 0.92),
		new I({ color: 10988726, roughness: 0.55, metalness: 0.25 }),
	);
	return (l.position.y = t / 2 + 0.2), (l.castShadow = !0), n.add(l), n;
}
function Rt(s, e) {
	var i;
	const t = Math.round(s / T),
		o = Math.round(e / T);
	for (let n = -le; n <= le; n++)
		for (let r = -le; r <= le; r++) qs(t + n, o + r);
	for (const n of Object.keys(me)) {
		const [r, l] = n.split("_").map(Number);
		if (Math.abs(r - t) > le + 1 || Math.abs(l - o) > le + 1) {
			const a = me[n];
			if ((i = a.userData.buildingData) != null && i.length)
				for (const h of a.userData.buildingData) {
					const d = X.indexOf(h);
					d !== -1 && X.splice(d, 1);
				}
			a.traverse((h) => {
				const d = Pe.indexOf(h);
				d !== -1 && Pe.splice(d, 1);
			}),
				x.remove(a),
				a.traverse((h) => {
					h.geometry && h.geometry.dispose(),
						h.material &&
							(Array.isArray(h.material)
								? h.material.forEach((d) => d.dispose())
								: h.material.dispose());
				}),
				a.geometry && a.geometry.dispose(),
				a.material && a.material.dispose(),
				delete me[n];
		}
	}
}
Rt(0, 0);
const Xe = new m(new vt(2e3, 2e3), new K({ visible: !1 }));
Xe.rotation.x = -Math.PI / 2;
x.add(Xe);
class Ys {
	constructor(e = 200) {
		(this.count = e),
			(this.geometry = new mt()),
			(this.positions = new Float32Array(e * 3)),
			(this.velocities = new Float32Array(e * 3)),
			(this.lifetimes = new Float32Array(e)),
			this.geometry.setAttribute("position", new bt(this.positions, 3)),
			(this.material = new Zt({
				color: 16777215,
				size: 0.25,
				transparent: !0,
				opacity: 1,
				blending: Le,
			})),
			(this.points = new Jt(this.geometry, this.material)),
			x.add(this.points),
			(this.active = !1);
	}
	explode(e, t = 16729344) {
		for (let o = 0; o < this.count; o++) {
			const i = o * 3;
			(this.positions[i] = e.x),
				(this.positions[i + 1] = e.y),
				(this.positions[i + 2] = e.z);
			const n = 0.1 + Math.random() * 0.5,
				r = Math.random() * Math.PI * 2,
				l = Math.random() * Math.PI;
			(this.velocities[i] = n * Math.sin(l) * Math.cos(r)),
				(this.velocities[i + 1] = n * Math.cos(l)),
				(this.velocities[i + 2] = n * Math.sin(l) * Math.sin(r)),
				(this.lifetimes[o] = 0.5 + Math.random() * 1);
		}
		this.material.color.setHex(t),
			(this.active = !0),
			(this.material.opacity = 1);
	}
	update(e) {
		if (!this.active) return;
		let t = !0;
		for (let o = 0; o < this.count; o++)
			if (this.lifetimes[o] > 0) {
				t = !1;
				const i = o * 3;
				(this.positions[i] += this.velocities[i] * e * 60),
					(this.positions[i + 1] += this.velocities[i + 1] * e * 60),
					(this.positions[i + 2] += this.velocities[i + 2] * e * 60),
					(this.lifetimes[o] -= e),
					(this.velocities[i + 1] -= 0.005 * e * 60);
			}
		(this.geometry.attributes.position.needsUpdate = !0),
			(this.material.opacity = Math.max(0, this.material.opacity - e * 0.8)),
			t && (this.active = !1);
	}
}
const zt = new Ys();
class $s {
	constructor() {
		this.audioContext = null;
	}
	init() {
		this.audioContext ||
			(this.audioContext = new (
				window.AudioContext || window.webkitAudioContext
			)());
	}
	playExplosion() {
		this.init(),
			this.audioContext.state === "suspended" && this.audioContext.resume();
		const e = this.audioContext.createOscillator(),
			t = this.audioContext.createGain();
		e.connect(t),
			t.connect(this.audioContext.destination),
			e.frequency.setValueAtTime(200, this.audioContext.currentTime),
			e.frequency.exponentialRampToValueAtTime(
				50,
				this.audioContext.currentTime + 0.5,
			),
			t.gain.setValueAtTime(0.3, this.audioContext.currentTime),
			t.gain.exponentialRampToValueAtTime(
				0.01,
				this.audioContext.currentTime + 0.5,
			),
			e.start(),
			e.stop(this.audioContext.currentTime + 0.5);
	}
	playShoot() {
		this.init(),
			this.audioContext.state === "suspended" && this.audioContext.resume();
		const e = this.audioContext.createOscillator(),
			t = this.audioContext.createGain();
		e.connect(t),
			t.connect(this.audioContext.destination),
			e.frequency.setValueAtTime(800, this.audioContext.currentTime),
			e.frequency.exponentialRampToValueAtTime(
				400,
				this.audioContext.currentTime + 0.1,
			),
			t.gain.setValueAtTime(0.2, this.audioContext.currentTime),
			t.gain.exponentialRampToValueAtTime(
				0.01,
				this.audioContext.currentTime + 0.1,
			),
			e.start(),
			e.stop(this.audioContext.currentTime + 0.1);
	}
	playTeleport() {
		this.init(),
			this.audioContext.state === "suspended" && this.audioContext.resume();
		const e = this.audioContext.createOscillator(),
			t = this.audioContext.createGain();
		e.connect(t),
			t.connect(this.audioContext.destination),
			e.frequency.setValueAtTime(1e3, this.audioContext.currentTime),
			e.frequency.exponentialRampToValueAtTime(
				2e3,
				this.audioContext.currentTime + 0.2,
			),
			t.gain.setValueAtTime(0.2, this.audioContext.currentTime),
			t.gain.exponentialRampToValueAtTime(
				0.01,
				this.audioContext.currentTime + 0.2,
			),
			e.start(),
			e.stop(this.audioContext.currentTime + 0.2);
	}
}
const Ke = new $s();
function He() {
	(we.x = 0), (we.y = 0);
}
function rt(s, e, t) {
	if (!s) return;
	const o = 32;
	s.style.transform = `translate(calc(-50% + ${e * o}px), calc(-50% + ${t * o}px))`;
}
function Xs() {
	if (!nt || !Ve) return;
	const s = nt.querySelector(".touch-stick-base"),
		e = te.drive;
	function t(i, n) {
		const r = s.getBoundingClientRect(),
			l = r.left + r.width / 2,
			a = r.top + r.height / 2,
			h = r.width * 0.34;
		let d = i - l,
			u = n - a;
		const w = Math.hypot(d, u);
		if (w > h) {
			const y = h / w;
			(d *= y), (u *= y);
		}
		(e.x = d / h), (e.y = u / h), rt(Ve, e.x, e.y);
	}
	function o() {
		(e.active = !1), (e.pointerId = null), (e.x = 0), (e.y = 0), rt(Ve, 0, 0);
	}
	s.addEventListener("pointerdown", (i) => {
		i.preventDefault(),
			(e.active = !0),
			(e.pointerId = i.pointerId),
			s.setPointerCapture(i.pointerId),
			t(i.clientX, i.clientY);
	}),
		s.addEventListener("pointermove", (i) => {
			!e.active ||
				i.pointerId !== e.pointerId ||
				(i.preventDefault(), t(i.clientX, i.clientY));
		}),
		s.addEventListener("pointerup", (i) => {
			i.pointerId === e.pointerId && o();
		}),
		s.addEventListener("pointercancel", (i) => {
			i.pointerId === e.pointerId && o();
		});
}
function Se(s, e, t = null) {
	if (!s) return;
	const o = () => {
		s.classList.remove("is-active"), t == null || t();
	};
	s.addEventListener("pointerdown", (i) => {
		i.preventDefault(),
			s.classList.add("is-active"),
			s.setPointerCapture(i.pointerId),
			e();
	}),
		s.addEventListener("pointerup", o),
		s.addEventListener("pointercancel", o),
		s.addEventListener("lostpointercapture", o);
}
function at() {
	if (c && P && P.readyState === 1) {
		let s = E + Math.PI,
			e = c.position.x,
			t = c.position.z;
		if (c.userData.turret) {
			c.updateMatrixWorld(!0);
			const o = new S(0, 0.1, -4.3);
			o.applyMatrix4(c.userData.turret.matrixWorld), (e = o.x), (t = o.z);
			const i = new S(0, 0, -1);
			i.transformDirection(c.userData.turret.matrixWorld),
				(s = Math.atan2(i.x, i.z));
		}
		P.send(JSON.stringify({ type: "shoot", x: e, y: 1.8, z: t, ry: s })),
			Js(new S(e, 2.2, t)),
			Ke.playShoot();
	}
}
function Ye(s = 4881471) {
	const e = new ce(),
		t = new ce();
	(t.position.y = Et), e.add(t);
	const o = new I({
			color: 5331046,
			roughness: 0.22,
			metalness: 0.88,
			envMapIntensity: 1,
		}),
		i = new I({ color: 1579810, roughness: 0.34, metalness: 0.72 }),
		n = new I({
			color: s,
			emissive: s,
			emissiveIntensity: 2.7,
			roughness: 0.3,
			metalness: 0.15,
		}),
		r = new I({ color: 592656, roughness: 0.72, metalness: 0.38 }),
		l = new I({ color: 2764858, roughness: 0.12, metalness: 0.96 }),
		a = new m(
			new ss(2.65, 24),
			new K({
				map: Fs,
				color: 0,
				transparent: !0,
				opacity: 0.38,
				depthWrite: !1,
			}),
		);
	(a.rotation.x = -Math.PI / 2), (a.position.y = 0.04), e.add(a);
	const h = new C(0.64, 0.78, 4.35);
	[-1.1, 1.1].forEach((ae) => {
		const A = new m(h, r);
		A.position.set(ae, 0.35, 0), (A.castShadow = !0), t.add(A);
		const At = new C(0.06, 0.12, 4.05),
			Je = new m(At, n);
		Je.position.set(ae > 0 ? 0.28 : -0.28, 0.4, 0), A.add(Je);
		for (let Ne = -1.55; Ne <= 1.55; Ne += 0.78) {
			const ve = new m(new Y(0.28, 0.28, 0.18, 18), o);
			(ve.rotation.z = Math.PI / 2),
				ve.position.set(0, -0.08, Ne),
				(ve.castShadow = !0),
				A.add(ve);
		}
	});
	const d = new C(2, 0.6, 3.6),
		u = new m(d, i);
	(u.position.y = 0.85), (u.castShadow = !0), t.add(u);
	const w = new m(new C(1.92, 0.55, 1.1), i);
	w.position.set(0, 1.02, -1.25),
		(w.rotation.x = -0.34),
		(w.castShadow = !0),
		t.add(w);
	const y = new m(new C(1.82, 0.18, 1.2), o);
	y.position.set(0, 1.18, 1.05), (y.castShadow = !0), t.add(y);
	const v = new C(0.12, 0.38, 3.85);
	[-1.42, 1.42].forEach((ae) => {
		const A = new m(v, i);
		A.position.set(ae, 0.82, 0), (A.castShadow = !0), t.add(A);
	});
	const D = new C(0.4, 0.1, 0.1);
	[-0.7, 0.7].forEach((ae) => {
		const A = new m(D, n);
		A.position.set(ae, 0.95, -1.85), t.add(A);
	});
	const L = new C(1.72, 0.62, 1.95),
		b = new m(L, i);
	b.position.set(0, 0, 0), (b.castShadow = !0);
	const M = new C(1.76, 0.06, 1.98),
		R = new m(M, n);
	(R.position.y = 0.1), b.add(R);
	const q = new m(new Y(0.55, 0.7, 0.3, 18), o);
	q.position.set(0, 0.34, -0.05), (q.castShadow = !0), b.add(q);
	const Be = new Y(0.11, 0.14, 3.5, 16),
		oe = new m(Be, l);
	(oe.rotation.x = Math.PI / 2),
		oe.position.set(0, 0.12, -2.58),
		(oe.castShadow = !0),
		b.add(oe);
	const ue = new m(new Y(0.18, 0.2, 0.7, 14), o);
	(ue.rotation.x = Math.PI / 2), ue.position.set(0, 0.12, -1.1), b.add(ue);
	const je = new Y(0.14, 0.12, 0.4, 12),
		ie = new m(je, l);
	(ie.rotation.x = Math.PI / 2), ie.position.set(0, 0.12, -4.28), b.add(ie);
	const ye = new Y(0.15, 0.15, 0.05, 12),
		ne = new m(ye, n);
	(ne.rotation.x = Math.PI / 2), ne.position.set(0, 0.12, -4.48), b.add(ne);
	const re = new m(new C(1.05, 0.4, 0.72), o);
	re.position.set(0, 0.03, 1.1), (re.castShadow = !0), b.add(re);
	const Ae = new m(new Y(0.02, 0.02, 1.1, 8), o);
	Ae.position.set(-0.52, 0.75, 0.68), (Ae.castShadow = !0), b.add(Ae);
	const Ze = new m(new de(0.07, 10, 10), n);
	Ze.position.set(-0.52, 1.33, 0.68), b.add(Ze);
	const xe = new ce();
	return (
		xe.add(b),
		xe.position.set(0, 1.5, -0.05),
		t.add(xe),
		(e.userData.visualRoot = t),
		(e.userData.shadow = a),
		(e.userData.surfaceNormal = new S(0, 1, 0)),
		(e.userData.surfaceForward = new S(0, 0, -1)),
		(e.userData.terrainReady = !1),
		(e.userData.turret = xe),
		e
	);
}
function Ks(s) {
	const e = G(s.x, s.z),
		t = 12 + _(s.x * 0.17, s.z * 0.17, 1411) * 8,
		o = new C(s.width, t, s.depth),
		i = new I({ color: 7764870, roughness: 0.88, metalness: 0.08 }),
		n = new m(o, i);
	n.position.set(s.x, e + t / 2, s.z),
		(n.castShadow = !0),
		(n.receiveShadow = !0);
	const r = new I({
			color: 13298943,
			emissive: 4027340,
			emissiveIntensity: 0.45,
			roughness: 0.18,
			metalness: 0.42,
			transparent: !0,
			opacity: 0.8,
		}),
		l = Math.floor(t / 2);
	for (let h = 0; h < l; h++)
		for (let d = -1; d <= 1; d += 2) {
			const u = new C(0.4, 0.5, 0.05),
				w = new m(u, r);
			w.position.set(d * 1, -t / 2 + 1.2 + h * 2, s.depth / 2 + 0.01), n.add(w);
			const y = new m(u, r);
			y.position.set(d * 1, -t / 2 + 1.2 + h * 2, -s.depth / 2 - 0.01),
				(y.rotation.y = Math.PI),
				n.add(y);
		}
	const a = new m(
		new C(s.width * 0.9, 0.45, s.depth * 0.9),
		new I({ color: 11383741, roughness: 0.5, metalness: 0.2 }),
	);
	(a.position.y = t / 2 + 0.18),
		(a.castShadow = !0),
		n.add(a),
		x.add(n),
		X.push(s);
}
function js(s, e) {
	const t = G(s, e),
		o = new I({ color: 6111267, roughness: 0.95 }),
		i = new I({
			color: 3235119,
			roughness: 0.92,
			emissive: 1057808,
			emissiveIntensity: 0.18,
		}),
		n = new ce(),
		r = new m(new Y(0.18, 0.22, 1.6, 7), o);
	(r.position.y = 0.8),
		n.add(r),
		[2.4, 1.7, 1.1].forEach((a, h) => {
			const d = new m(new es(a, 1.5, 8), i);
			(d.position.y = 1.4 + h * 1.1), n.add(d);
		}),
		n.position.set(s, t, e),
		(n.rotation.y = _(s * 0.11, e * 0.11, 310) * Math.PI * 2);
	const l = 0.75 + _(s * 0.07, e * 0.07, 622) * 0.6;
	n.scale.setScalar(l), (n.castShadow = !0), x.add(n);
}
(function () {
	const e = (t) => {
		const o = Math.sin(t) * 43758.5453;
		return o - Math.floor(o);
	};
	for (let t = 0; t < 160; t++) {
		const o = e(t * 7.13) * Math.PI * 2,
			i = 30 + e(t * 3.77) * 80,
			n = Math.cos(o) * i,
			r = Math.sin(o) * i,
			l = G(n, r);
		l > 0.5 && l < 10 && js(n, r);
	}
})();
function Zs(s, e) {
	const t = G(s, e),
		o = new C(2, 2, 2),
		i = new I({ color: 9127187, roughness: 0.8 }),
		n = new m(o, i);
	n.position.set(s, t + 1, e),
		(n.castShadow = !0),
		(n.receiveShadow = !0),
		x.add(n),
		pe.push(n);
}
(function () {
	const e = [
		[10, 10],
		[-10, -10],
		[20, -5],
		[-15, 15],
		[0, 25],
		[25, 0],
	];
	for (const [t, o] of e) Zs(t, o);
})();
function Js(s) {
	const e = new de(0.8, 8, 8),
		t = new K({ color: 65535, transparent: !0, opacity: 1 }),
		o = new m(e, t);
	o.position.copy(s), x.add(o);
	const i = new gt(65535, 5, 15);
	i.position.copy(s), x.add(i);
	let n = 0;
	const r = () => {
		(n += 0.15),
			(o.material.opacity = Math.max(0, 1 - n * 4)),
			o.scale.setScalar(1 + n * 6),
			(i.intensity = Math.max(0, 5 * (1 - n * 4))),
			n < 0.5
				? requestAnimationFrame(r)
				: (x.remove(o),
					x.remove(i),
					o.geometry.dispose(),
					o.material.dispose());
	};
	requestAnimationFrame(r);
}
function lt(s) {
	zt.explode(s), Ke.playExplosion();
}
function ct() {
	const s = document.getElementById("shop-modal");
	s && s.classList.toggle("hidden");
}
function fe(s) {
	P &&
		P.readyState === 1 &&
		P.send(JSON.stringify({ type: "buy_spell", spell: s }));
}
function kt() {
	const s = document.getElementById("buy-dash"),
		e = document.getElementById("buy-shield"),
		t = document.getElementById("buy-blast"),
		o = document.getElementById("buy-teleport");
	s && (s.innerText = `Dash x${p.spells.dash} (50 Coins) [Q]`),
		e && (e.innerText = `Shield x${p.spells.shield} (100 Coins) [E]`),
		t && (t.innerText = `Big Blast x${p.spells.blast} (150 Coins) [F]`),
		o && (o.innerText = `Teleport x${p.spells.teleport} (200 Coins) [R]`);
}
function eo() {
	const s = document.getElementById("leaderboard-list");
	if (!s) return;
	const e = Object.values(p.players).filter((t) => !t.dead);
	e.sort((t, o) => o.kills - t.kills),
		(s.innerHTML = e
			.slice(0, 5)
			.map(
				(t) =>
					`<div class="leaderboard-item"><span>${t.name || "Player"}</span><span>${t.kills || 0}</span></div>`,
			)
			.join(""));
}
function ht() {
	const s = document.getElementById("death-screen");
	s && s.classList.remove("hidden");
}
function $e() {
	const s = document.getElementById("death-screen");
	s && s.classList.add("hidden");
}
function dt() {
	const s = document.getElementById("red-score"),
		e = document.getElementById("blue-score");
	s && (s.innerText = p.teamScores.red), e && (e.innerText = p.teamScores.blue);
}
function ut(s, e) {
	const t = Ye(e.color);
	t.position.set(e.x, 0, e.z),
		(t.userData = {
			...t.userData,
			targetPosition: new S(e.x, 0, e.z),
			targetRotationY: e.ry,
			yaw: e.ry,
		}),
		se(t, e.ry, 1 / 60, !0),
		(O[s] = t),
		x.add(t);
}
function Z(s) {
	if (p.spells[s] > 0 && P && P.readyState === 1) {
		p.spells[s]--, kt();
		let e = {};
		if (s === "blast" && c) {
			let t = E + Math.PI,
				o = c.position.x,
				i = c.position.z;
			if (c.userData.turret) {
				c.updateMatrixWorld(!0);
				const n = new S(0, 0.1, -4.3);
				n.applyMatrix4(c.userData.turret.matrixWorld), (o = n.x), (i = n.z);
				const r = new S(0, 0, -1);
				r.transformDirection(c.userData.turret.matrixWorld),
					(t = Math.atan2(r.x, r.z));
			}
			e = { x: o, y: 1.8, z: i, ry: t };
		}
		if (s === "teleport" && c) {
			const t = Ie(E);
			let o = c.position.x + t.x * 25,
				i = c.position.z + t.z * 25;
			(e = { x: o, z: i }), Ke.playTeleport();
		}
		P.send(JSON.stringify({ type: "cast_spell", spell: s, ...e }));
	}
}
document.addEventListener("DOMContentLoaded", () => {
	window.addEventListener("keydown", (a) => {
		const h = a.key.toLowerCase();
		z.hasOwnProperty(h) && (z[h] = !0),
			z.hasOwnProperty(a.key) && (z[a.key] = !0),
			h === "b" && ct(),
			h === "q" && Z("dash"),
			h === "e" && Z("shield"),
			h === "f" && Z("blast"),
			h === "r" && Z("teleport");
	}),
		window.addEventListener("keyup", (a) => {
			const h = a.key.toLowerCase();
			z.hasOwnProperty(h) && (z[h] = !1),
				z.hasOwnProperty(a.key) && (z[a.key] = !1);
		}),
		window.addEventListener("resize", () => {
			(B.aspect = window.innerWidth / window.innerHeight),
				B.updateProjectionMatrix(),
				F.setSize(window.innerWidth, window.innerHeight),
				F.setPixelRatio(Math.min(window.devicePixelRatio, 2)),
				ze.setSize(window.innerWidth, window.innerHeight),
				He();
		});
	const s = document.getElementById("close-shop");
	s &&
		s.addEventListener("pointerdown", (a) => {
			a.preventDefault(), ct();
		});
	const e = document.getElementById("buy-dash"),
		t = document.getElementById("buy-shield"),
		o = document.getElementById("buy-blast"),
		i = document.getElementById("buy-teleport");
	e &&
		e.addEventListener("pointerdown", (a) => {
			a.preventDefault(), fe("dash");
		}),
		t &&
			t.addEventListener("pointerdown", (a) => {
				a.preventDefault(), fe("shield");
			}),
		o &&
			o.addEventListener("pointerdown", (a) => {
				a.preventDefault(), fe("blast");
			}),
		i &&
			i.addEventListener("pointerdown", (a) => {
				a.preventDefault(), fe("teleport");
			}),
		window.addEventListener("mousemove", (a) => {
			(we.x = (a.clientX / window.innerWidth) * 2 - 1),
				(we.y = -(a.clientY / window.innerHeight) * 2 + 1);
		}),
		window.addEventListener("mousedown", (a) => {
			a.button === 0 && at();
		});
	const n = document.getElementById("respawn-btn");
	n &&
		n.addEventListener("pointerdown", (a) => {
			a.preventDefault(),
				console.log("Respawn button pressed"),
				P &&
					P.readyState === 1 &&
					(P.send(JSON.stringify({ type: "respawn" })), $e());
		});
	const r = document.getElementById("quit-btn");
	r &&
		r.addEventListener("pointerdown", (a) => {
			a.preventDefault(), (window.location.href = "../index.html");
		}),
		Xs(),
		Se(
			zs,
			() => {
				(te.fire = !0), He(), at();
			},
			() => {
				te.fire = !1;
			},
		),
		Se(ks, () => Z("dash")),
		Se(Bs, () => Z("shield")),
		Se(As, () => Z("blast"));
	const l = document.getElementById("buy-teleport");
	l &&
		l.addEventListener("pointerdown", (a) => {
			a.preventDefault(), fe("teleport");
		}),
		He(),
		Bt(),
		no();
});
function to(s, e) {
	const t = e.isBlast ? 1 : 0.3,
		o = new de(t, 8, 8),
		i = e.isBlast ? 16697943 : e.team === "red" ? 16729943 : 5546239,
		n = new I({ color: i, emissive: i, emissiveIntensity: 3 }),
		r = new m(o, n);
	r.position.set(e.x, e.y, e.z);
	const l = new C(t * 0.8, t * 0.8, 3),
		a = new K({ color: i, transparent: !0, opacity: 0.4 }),
		h = new m(l, a);
	(h.position.z = 1.5),
		r.add(h),
		(r.rotation.y = e.ry),
		(r.userData = {
			vx: Math.sin(e.ry) * (e.isBlast ? 8 : 10),
			vz: Math.cos(e.ry) * (e.isBlast ? 8 : 10),
			team: e.team,
		}),
		x.add(r),
		($[s] = r);
}
function so(s, e) {
	const t = s.position.x,
		o = s.position.z,
		i = Ie(e),
		n = Is(e);
	function r(ie, ye) {
		const ne = t + i.x * ie + n.x * ye,
			re = o + i.z * ie + n.z * ye;
		return new S(ne, G(ne, re), re);
	}
	const l = r(_e, -Te),
		a = r(_e, Te),
		h = r(-_e, -Te),
		d = r(-_e, Te),
		u = r(0, 0),
		w = l.clone().add(a).multiplyScalar(0.5),
		y = h.clone().add(d).multiplyScalar(0.5),
		v = l.clone().add(h).multiplyScalar(0.5),
		D = a.clone().add(d).multiplyScalar(0.5),
		L = w.sub(y).normalize(),
		b = D.sub(v).normalize(),
		M = new S().crossVectors(b, L).normalize();
	M.y < 0 && M.multiplyScalar(-1), M.lerp(Pt, Ls).normalize();
	const R = i.clone().projectOnPlane(M);
	R.lengthSq() < 1e-5 && R.copy(i), R.normalize();
	const q = new S().crossVectors(R, M).normalize(),
		Be = R.clone().multiplyScalar(-1),
		oe = new os().setFromRotationMatrix(new is().makeBasis(q, M, Be)),
		ue = (l.y + a.y + h.y + d.y) / 4;
	return { height: Math.max(u.y, ue), normal: M, forward: R, quaternion: oe };
}
function se(s, e, t, o = !1) {
	const i = s.userData.visualRoot || s,
		n = so(s, e),
		r = o || !s.userData.terrainReady ? 1 : Qe(Ds, t);
	if (
		((s.position.y = Q.lerp(s.position.y, n.height, r)),
		(i.position.y = Et),
		r >= 1
			? i.quaternion.copy(n.quaternion)
			: i.quaternion.slerp(n.quaternion, r),
		s.userData.surfaceNormal || (s.userData.surfaceNormal = new S()),
		s.userData.surfaceForward || (s.userData.surfaceForward = new S()),
		s.userData.surfaceNormal.copy(n.normal),
		s.userData.surfaceForward.copy(n.forward),
		(s.userData.yaw = e),
		(s.userData.terrainReady = !0),
		s.userData.shadow)
	) {
		const l = Math.min(0.22, (Math.abs(s.userData.speed || 0) / qe) * 0.22);
		s.userData.shadow.scale.setScalar(1.02 + l);
	}
}
function oo(s) {
	if (!c) return;
	const e = c.userData.surfaceNormal || Pt,
		t = c.userData.surfaceForward || Ie(E),
		o = new S().crossVectors(t, e).normalize(),
		i = c.position
			.clone()
			.addScaledVector(e, 6.2)
			.addScaledVector(t, -13.5)
			.addScaledVector(o, 0.4),
		n = c.position.clone().addScaledVector(e, 2.2).addScaledVector(t, 8.5);
	i.y = Math.max(i.y, G(i.x, i.z) + 4.5);
	const r = Qe(Es, s),
		l = Qe(Ps, s);
	B.userData.followReady
		? (B.position.lerp(i, r), Fe.lerp(n, l))
		: (B.position.copy(i), Fe.copy(n), (B.userData.followReady = !0)),
		B.up.lerp(e, r).normalize(),
		B.lookAt(Fe);
}
function Bt() {
	requestAnimationFrame(Bt);
	const s = Ts.getDelta();
	if (c && !p.dead) {
		const e = Date.now() < p.dashEndTime,
			t = 2.5 * s,
			o = te.drive.y < -0.12,
			i = te.drive.y > 0.12,
			n = te.drive.x < -0.12,
			r = te.drive.x > 0.12;
		let l = 0;
		z.w || z.arrowup || o
			? (l = e ? Cs : qe)
			: (z.s || z.arrowdown || i) && (l = -qe),
			N < l
				? (N = Math.min(l, N + Ss * s))
				: N > l && (N = Math.max(l, N - Ms * s)),
			(c.userData.speed = N);
		let a = Math.abs(N) > 0.1;
		const h = c.position.clone();
		if (a) {
			const d = Ie(E);
			(c.position.x += d.x * N * s), (c.position.z += d.z * N * s);
		}
		if (a) {
			let d = !1;
			const u = 1.8;
			for (const w of X)
				if (
					c.position.x > w.x - w.width / 2 - u &&
					c.position.x < w.x + w.width / 2 + u &&
					c.position.z > w.z - w.depth / 2 - u &&
					c.position.z < w.z + w.depth / 2 + u
				) {
					d = !0;
					break;
				}
			d && (c.position.copy(h), (N *= -0.5));
		}
		if (
			((z.a || z.arrowleft || n) && ((E += t), (a = !0)),
			(z.d || z.arrowright || r) && ((E -= t), (a = !0)),
			se(c, E, s),
			c.updateMatrixWorld(!0),
			oo(s),
			c.userData.turret)
		) {
			We.setFromCamera(we, B);
			let d = We.intersectObjects(Pe, !1);
			if ((d.length === 0 && (d = We.intersectObject(Xe)), d.length > 0)) {
				const u = d[0].point,
					w = u.x - c.position.x,
					y = u.z - c.position.z,
					D = Math.atan2(w, y) + Math.PI - E,
					L = c.userData.turret.rotation.y,
					b = D - L,
					M = Math.atan2(Math.sin(b), Math.cos(b));
				c.userData.turret.rotation.y += M * 0.18;
			}
		}
		(Ue += s),
			a &&
				P &&
				P.readyState === 1 &&
				Ue > 0.05 &&
				(P.send(
					JSON.stringify({
						type: "move",
						x: c.position.x,
						y: c.position.y,
						z: c.position.z,
						ry: E,
					}),
				),
				(Ue = 0));
	}
	for (const e in O) {
		const t = O[e];
		if (t.userData.targetPosition) {
			(t.position.x = Q.lerp(t.position.x, t.userData.targetPosition.x, 0.3)),
				(t.position.z = Q.lerp(t.position.z, t.userData.targetPosition.z, 0.3)),
				t.userData.yaw === void 0 &&
					(t.userData.yaw = t.userData.targetRotationY);
			const o = t.userData.targetRotationY - t.userData.yaw,
				i = Math.atan2(Math.sin(o), Math.cos(o));
			(t.userData.yaw += i * 0.3),
				(t.userData.speed =
					t.userData.targetPosition.distanceTo(t.position) * 12),
				se(t, t.userData.yaw, s);
		}
	}
	for (const [e, t] of Object.entries($)) {
		(t.position.x += t.userData.vx * s), (t.position.z += t.userData.vz * s);
		const o = G(t.position.x, t.position.z);
		t.position.y = o + 1.2;
		for (let i = pe.length - 1; i >= 0; i--) {
			const n = pe[i],
				r = t.position.x - n.position.x,
				l = t.position.z - n.position.z;
			if (Math.sqrt(r * r + l * l) < 1.8) {
				x.remove(n), pe.splice(i, 1), lt(t.position), x.remove(t), delete $[e];
				break;
			}
		}
		if ($[e]) {
			for (const i of X)
				if (
					t.position.x > i.x - i.width / 2 - 0.5 &&
					t.position.x < i.x + i.width / 2 + 0.5 &&
					t.position.z > i.z - i.depth / 2 - 0.5 &&
					t.position.z < i.z + i.depth / 2 + 0.5
				) {
					lt(t.position), x.remove(t), delete $[e];
					break;
				}
		}
	}
	c && Rt(c.position.x, c.position.z), io(), zt.update(s), ze.render();
}
const De = document.getElementById("minimap"),
	f = De ? De.getContext("2d") : null,
	ft = 1.2,
	H = 90;
function io() {
	if (!f || !c) return;
	const s = De.width,
		e = De.height,
		t = s / 2,
		o = e / 2;
	f.clearRect(0, 0, s, e),
		f.save(),
		f.beginPath(),
		f.arc(t, o, s / 2, 0, Math.PI * 2),
		f.clip();
	const i = f.createRadialGradient(t, o, 12, t, o, s / 2);
	i.addColorStop(0, "rgba(14, 34, 58, 0.96)"),
		i.addColorStop(0.65, "rgba(8, 18, 30, 0.94)"),
		i.addColorStop(1, "rgba(4, 8, 14, 0.96)"),
		(f.fillStyle = i),
		f.fillRect(0, 0, s, e),
		(f.strokeStyle = "rgba(125, 231, 255, 0.14)"),
		(f.lineWidth = 1);
	for (const h of [s * 0.18, s * 0.34, s * 0.48])
		f.beginPath(), f.arc(t, o, h, 0, Math.PI * 2), f.stroke();
	f.beginPath(),
		f.moveTo(t, 0),
		f.lineTo(t, e),
		f.moveTo(0, o),
		f.lineTo(s, o),
		(f.strokeStyle = "rgba(255, 255, 255, 0.06)"),
		f.stroke();
	const n = t + (-c.position.x / ft) * (s / H / 2),
		r = o + (-c.position.z / ft) * (e / H / 2);
	f.beginPath(),
		f.arc(n, r, 3, 0, Math.PI * 2),
		(f.fillStyle = "rgba(255,255,255,0.15)"),
		f.fill();
	const l = (h) => t + ((h - c.position.x) / H) * s,
		a = (h) => o + ((h - c.position.z) / H) * e;
	f.fillStyle = "rgba(125, 231, 255, 0.18)";
	for (const h of X) {
		if (Math.abs(h.x - c.position.x) > H || Math.abs(h.z - c.position.z) > H)
			continue;
		const d = l(h.x),
			u = a(h.z),
			w = Math.max(3, (h.width / H) * s),
			y = Math.max(3, (h.depth / H) * e);
		f.fillRect(d - w / 2, u - y / 2, w, y);
	}
	f.fillStyle = "rgba(255, 214, 115, 0.86)";
	for (const h of pe)
		Math.abs(h.position.x - c.position.x) > H ||
			Math.abs(h.position.z - c.position.z) > H ||
			f.fillRect(l(h.position.x) - 2, a(h.position.z) - 2, 4, 4);
	for (const [h, d] of Object.entries(p.players)) {
		if (h === p.myId || d.dead) continue;
		const u = l(d.x),
			w = a(d.z),
			y = d.team === p.team;
		f.beginPath(),
			f.arc(u, w, 5, 0, Math.PI * 2),
			(f.fillStyle = y
				? p.team === "red"
					? "#ff6b6b"
					: "#54a0ff"
				: p.team === "red"
					? "#54a0ff"
					: "#ff6b6b"),
			f.fill(),
			(f.strokeStyle = "#fff"),
			(f.lineWidth = 1),
			f.stroke();
	}
	f.save(),
		f.translate(t, o),
		f.rotate(E),
		f.beginPath(),
		f.moveTo(0, -9),
		f.lineTo(6, 7),
		f.lineTo(-6, 7),
		f.closePath(),
		(f.fillStyle = "#ffffff"),
		f.fill(),
		(f.strokeStyle = "rgba(125, 231, 255, 0.45)"),
		(f.lineWidth = 1),
		f.stroke(),
		f.restore(),
		f.restore();
}
function no() {
	const s = "tanks-backend.jacobcreation.partykit.dev",
		e = setTimeout(() => {
			const t = document.querySelector("#loading-overlay p");
			t &&
				!p.myId &&
				((t.innerText = "SERVER IS SLEEPING, WAKING IT UP..."),
				(t.style.color = "#feca57"));
		}, 5e3);
	try {
		(P = new ps({ host: s, room: "global-arena" })),
			P.addEventListener("message", (t) => {
				const o = JSON.parse(t.data);
				if (o.type === "init") {
					clearTimeout(e);
					const i = document.getElementById("match-status");
					if (
						(i &&
							((i.innerText = "Connected!"),
							(i.style.color = "#1dd1a1"),
							setTimeout(() => i.classList.add("hidden"), 2e3)),
						(p.myId = o.id),
						(p.team = o.team),
						o.teamScores && ((p.teamScores = o.teamScores), dt()),
						o.buildings && X.length === 0)
					)
						for (const n of o.buildings) Ks(n);
					if (!c) {
						const n = o.state[o.id];
						(c = Ye(o.myColor)),
							c.position.set(n.x, 0, n.z),
							(E = n.ry),
							se(c, E, 1 / 60, !0),
							(B.userData.followReady = !1),
							c.traverse((a) => {
								a.isMesh && (a.visible = !0);
							}),
							x.add(c),
							n.dead
								? ((p.dead = !0), ht(), (c.visible = !1))
								: ((p.dead = !1), $e(), (c.visible = !0));
						const r = document.getElementById("loading-overlay");
						r &&
							(r.classList.add("fade-out"),
							setTimeout(() => (r.style.display = "none"), 1e3));
						const l = document.getElementById("match-status");
						l &&
							((l.innerText = `YOU ARE ON ${o.team.toUpperCase()} TEAM`),
							(l.style.color = o.team === "red" ? "#ff4757" : "#54a0ff"),
							l.classList.remove("hidden"));
					}
					for (const [n, r] of Object.entries(o.state))
						n !== p.myId && !O[n] && ut(n, r);
				} else if (o.type === "update") {
					if (o.players[p.myId]) {
						const i = o.players[p.myId];
						if (i.health < p.health) {
							const l = document.getElementById("health-bar");
							l &&
								(l.style.background =
									"linear-gradient(90deg, #ff6b6b, #ee5253)"),
								setTimeout(() => {
									l &&
										(l.style.background =
											"linear-gradient(90deg, #1dd1a1, #10ac84)");
								}, 500);
						}
						i.health === 100 &&
							p.health <= 0 &&
							c &&
							(c.position.set(i.x, 0, i.z),
							(E = i.ry),
							se(c, E, 1 / 60, !0),
							(B.userData.followReady = !1)),
							(p.health = i.health),
							(p.coins = i.coins),
							o.teamScores && ((p.teamScores = o.teamScores), dt()),
							i.dead !== p.dead &&
								((p.dead = i.dead),
								p.dead
									? (ht(), c && (c.visible = !1))
									: ($e(),
										c &&
											(c.position.set(i.x, 0, i.z),
											(E = i.ry),
											se(c, E, 1 / 60, !0),
											(B.userData.followReady = !1),
											(c.visible = !0),
											(N = 0)))),
							i.spells &&
								((p.spells = {
									dash: i.spells.dash || 0,
									shield: i.spells.shield || 0,
									blast: i.spells.blast || 0,
									teleport: i.spells.teleport || 0,
								}),
								kt());
						const n = document.getElementById("health-bar"),
							r = document.getElementById("coin-count");
						n && (n.style.width = Math.max(0, p.health) + "%"),
							r && (r.innerText = p.coins);
					}
					for (const [i, n] of Object.entries(o.players))
						(p.players[i] = n),
							i !== p.myId &&
								(O[i]
									? (O[i].userData.targetPosition.set(n.x, 0, n.z),
										(O[i].userData.targetRotationY = n.ry),
										(O[i].visible = !n.dead))
									: n.dead || ut(i, n));
					if ((eo(), o.removedProjectiles))
						for (const i of o.removedProjectiles)
							$[i] && (x.remove($[i]), delete $[i]);
				} else if (o.type === "spawn_projectile") to(o.id, o.proj);
				else if (o.type === "remove")
					O[o.id] && (x.remove(O[o.id]), delete O[o.id]);
				else if (o.type === "spell_effect") {
					const i = o.id === p.myId ? c : O[o.id];
					if (i) {
						if (o.spell === "dash" && o.id === p.myId)
							p.dashEndTime = Date.now() + 1e3;
						else if (o.spell === "shield") {
							const n = new de(2.5, 16, 16),
								r = new K({
									color: 4774907,
									transparent: !0,
									opacity: 0.4,
									wireframe: !0,
								}),
								l = new m(n, r);
							i.add(l),
								setTimeout(() => {
									i.remove(l);
								}, 5e3);
						}
					}
				}
			}),
			P.addEventListener("open", () => {
				console.log("Connected to PartyKit server");
			});
	} catch (t) {
		console.warn("PartySocket library not loaded yet or failed to connect.", t),
			c ||
				((c = Ye(16752627)),
				se(c, E, 1 / 60, !0),
				(B.userData.followReady = !1),
				c.traverse((o) => {
					o.isMesh && (o.visible = !1);
				}),
				x.add(c));
	}
}
