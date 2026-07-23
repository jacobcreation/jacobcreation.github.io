/**
 * Cloudflare Worker — Moondream OCR Proxy
 *
 * Exposes:  POST /ocr   { image: "data:image/...;base64,...", prompt?: "..." }
 * Returns:  { text: "..." }
 */

const MODEL = "@cf/moondream/moondream3.1-9B-A2B";
const DEFAULT_OCR_PROMPT =
	"Extract all visible text from this image in any language or script. Preserve the original language, characters, line breaks, spacing, and reading order as much as possible. Do not translate, summarize, or explain. Return only the extracted text.";

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export default {
	async fetch(request, env) {
		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: CORS });
		}

		const url = new URL(request.url);

		if (request.method === "POST" && url.pathname === "/ocr") {
			try {
				const body = await request.json();
				const { image, prompt } = body;

				if (!image) {
					return json({ error: "Missing image field" }, 400);
				}

				if (!env.AI) {
					return json({ error: "Workers AI binding is not configured" }, 500);
				}

				const ocrPrompt = prompt || DEFAULT_OCR_PROMPT;
				const result = await runMoondreamOcr(env.AI, {
					image,
					prompt: ocrPrompt,
				});

				return json({ text: extractText(result) }, 200);
			} catch (e) {
				return json({ error: e.message }, 500);
			}
		}

		return json({ error: "Not found" }, 404);
	},
};

async function runMoondreamOcr(ai, { image, prompt }) {
	if (!/^data:image\/(?:png|jpe?g|webp);base64,/i.test(image)) {
		throw new Error("Image must be a PNG, JPG, or WEBP data URL");
	}

	return ai.run(MODEL, {
		messages: [
			{
				role: "user",
				content: [
					{ type: "text", text: prompt },
					{ type: "image_url", image_url: { url: image } },
				],
			},
		],
		max_tokens: 4096,
		temperature: 0.1,
	});
}

function extractText(result) {
	return (
		result?.answer ??
		result?.result?.answer ??
		result?.choices?.[0]?.message?.content ??
		result?.description ??
		result?.response ??
		result?.text ??
		result?.output ??
		""
	).trim();
}

function json(obj, status = 200) {
	return new Response(JSON.stringify(obj), {
		status,
		headers: { "Content-Type": "application/json", ...CORS },
	});
}
