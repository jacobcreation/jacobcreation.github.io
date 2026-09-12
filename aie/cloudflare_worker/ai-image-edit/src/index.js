const FLUX_IMAGE_EDIT_MODEL = "@cf/black-forest-labs/flux-2-klein-9b";
const POLLINATIONS_API_BASE = "https://gen.pollinations.ai";
const POLLINATIONS_MODEL = "kontext";
const ACCOUNTS_API_BASE = "https://accounts-system.b4rjxr9lk.workers.dev";

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers":
		"Content-Type, Authorization, X-AIE-Client-ID",
};
const DAILY_LIMIT = 1;

export default {
	async fetch(request, env) {
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: CORS_HEADERS });
		}

		if (request.method !== "POST") {
			return new Response("Method not allowed", {
				status: 405,
				headers: { "Access-Control-Allow-Origin": "*" },
			});
		}

		try {
			if (
				!request.headers.get("Content-Type")?.includes("multipart/form-data")
			) {
				return jsonError("Missing image or prompt", 400);
			}

			const formData = await request.formData();
			const imageFile = formData.get("image");
			const prompt = formData.get("prompt");

			if (!imageFile || !prompt) {
				return jsonError("Missing image or prompt", 400);
			}

			const quota = await reserveDailyEdit(request, env);
			if (!quota.allowed) {
				return jsonError(
					"Daily image edit limit reached. Try again tomorrow.",
					429,
					{
						code: "daily_limit_reached",
						limit: DAILY_LIMIT,
						resetAt: quota.resetAt,
					},
				);
			}

			const imageBytes = await imageFile.arrayBuffer();
			const mimeType = imageFile.type || "image/png";
			let result;

			try {
				result = await runPollinationsImageEdit(
					env,
					prompt,
					imageBytes,
					mimeType,
				);
			} catch (err) {
				console.warn(
					"Pollinations image edit failed; using Cloudflare fallback.",
					err,
				);
				try {
					result = await runFluxImageEdit(env, prompt, imageBytes, mimeType);
				} catch (fallbackErr) {
					await releaseDailyEdit(env, quota.key);
					throw new Error(
						`Image edit providers failed. Pollinations: ${err.message}; Cloudflare: ${fallbackErr.message}`,
					);
				}
			}

			return json({
				data: [result],
				limit: DAILY_LIMIT,
				resetAt: quota.resetAt,
			});
		} catch (err) {
			return jsonError(`Internal error: ${err.message}`, 500);
		}
	},
};

async function runPollinationsImageEdit(env, prompt, imageBytes, mimeType) {
	if (!env.POLLINATIONS_API_KEY) {
		throw new Error("Pollinations API key is not configured.");
	}

	const form = new FormData();
	form.append(
		"image",
		new Blob([imageBytes], { type: mimeType }),
		"source-image",
	);
	form.append("prompt", String(prompt));
	form.append("model", env.POLLINATIONS_MODEL || POLLINATIONS_MODEL);

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 30_000);
	let response;
	try {
		response = await fetch(
			`${env.POLLINATIONS_API_BASE || POLLINATIONS_API_BASE}/v1/images/edits`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.POLLINATIONS_API_KEY}`,
				},
				body: form,
				signal: controller.signal,
			},
		);
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) {
		throw new Error(`Pollinations returned HTTP ${response.status}`);
	}

	const contentType = response.headers.get("content-type") || "";
	if (contentType.startsWith("image/")) {
		const outputBytes = await response.arrayBuffer();
		if (!outputBytes.byteLength)
			throw new Error("Pollinations returned an empty image.");
		return {
			b64_json: bytesToBase64(outputBytes),
			model: env.POLLINATIONS_MODEL || POLLINATIONS_MODEL,
			provider: "pollinations",
		};
	}

	const data = await response.json().catch(() => null);
	const item = data?.data?.[0];
	if (item?.b64_json) {
		return {
			b64_json: item.b64_json.replace(/^data:image\/\w+;base64,/, ""),
			model: env.POLLINATIONS_MODEL || POLLINATIONS_MODEL,
			provider: "pollinations",
		};
	}
	if (item?.url) {
		return {
			url: item.url,
			model: env.POLLINATIONS_MODEL || POLLINATIONS_MODEL,
			provider: "pollinations",
		};
	}

	throw new Error("Pollinations returned no usable image.");
}

async function reserveDailyEdit(request, env) {
	const resetAt = getNextUtcMidnight();

	if (!env.IMAGE_EDIT_DAILY_LIMIT) {
		return { allowed: true, resetAt };
	}

	const identity = await getUserIdentity(request, env);
	const day = new Date().toISOString().slice(0, 10);
	const key = `daily-edit:${day}:${identity}`;
	const current = Number.parseInt(
		(await env.IMAGE_EDIT_DAILY_LIMIT.get(key)) || "0",
		10,
	);

	if (current >= DAILY_LIMIT) {
		return { allowed: false, key, resetAt };
	}

	await env.IMAGE_EDIT_DAILY_LIMIT.put(key, String(current + 1), {
		expirationTtl: secondsUntil(resetAt) + 3600,
	});

	return { allowed: true, key, resetAt };
}

async function releaseDailyEdit(env, key) {
	if (env.IMAGE_EDIT_DAILY_LIMIT && key) {
		await env.IMAGE_EDIT_DAILY_LIMIT.delete(key);
	}
}

async function getUserIdentity(request, env) {
	const authHeader = request.headers.get("Authorization") || "";
	const clientId = request.headers.get("X-AIE-Client-ID") || "";
	const ip = request.headers.get("CF-Connecting-IP") || "";
	const userAgent = request.headers.get("User-Agent") || "";
	const accountId = authHeader ? await getAccountId(env, authHeader) : "";
	const rawIdentity =
		accountId || authHeader || clientId || `${ip}:${userAgent}` || "anonymous";
	return sha256(rawIdentity);
}

async function getAccountId(env, authHeader) {
	try {
		const accountBase = env.ACCOUNTS_API_BASE || ACCOUNTS_API_BASE;
		const response = await fetch(`${accountBase.replace(/\/$/, "")}/api/me`, {
			headers: {
				Accept: "application/json",
				Authorization: authHeader,
			},
		});
		const data = await response.json().catch(() => ({}));
		return response.ok && data.user?.id ? `account:${data.user.id}` : "";
	} catch {
		return "";
	}
}

async function runFluxImageEdit(env, prompt, imageBytes, mimeType) {
	if (!env.AI) {
		throw new Error("Workers AI binding is not configured.");
	}

	const form = new FormData();
	form.append("prompt", String(prompt));
	form.append(
		"input_image_0",
		new Blob([imageBytes], { type: mimeType }),
		"source-image",
	);
	form.append("width", "1024");
	form.append("height", "1024");
	form.append("steps", "25");

	const formResponse = new Response(form);
	const responseData = await env.AI.run(
		env.FLUX_IMAGE_EDIT_MODEL || FLUX_IMAGE_EDIT_MODEL,
		{
			multipart: {
				body: formResponse.body,
				contentType: formResponse.headers.get("content-type"),
			},
		},
	);

	const imageB64Output = responseData?.image;

	if (imageB64Output) {
		return {
			b64_json: imageB64Output.replace(/^data:image\/\w+;base64,/, ""),
			model: env.FLUX_IMAGE_EDIT_MODEL || FLUX_IMAGE_EDIT_MODEL,
			provider: "cloudflare-workers-ai",
		};
	}

	throw new Error(
		`Could not extract Flux image output: ${JSON.stringify(responseData).slice(0, 300)}`,
	);
}

function bytesToBase64(bytes) {
	let binary = "";
	for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json", ...CORS_HEADERS },
	});
}

function jsonError(message, status, extra = {}) {
	return json({ error: message, ...extra }, status);
}

function getNextUtcMidnight() {
	const now = new Date();
	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
	);
}

function secondsUntil(date) {
	return Math.max(60, Math.ceil((date.getTime() - Date.now()) / 1000));
}

async function sha256(value) {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}
