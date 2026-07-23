const FLUX_IMAGE_EDIT_MODEL = "@cf/black-forest-labs/flux-2-dev";
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
				result = await runFluxImageEdit(env, prompt, imageBytes, mimeType);
			} catch (err) {
				await releaseDailyEdit(env, quota.key);
				throw err;
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
