/**
 * Cloudflare Worker — OCR.space OCR Proxy
 *
 * Exposes:  POST /ocr   { image: "data:image/...;base64,...", prompt?: "..." }
 * Requires the OCR_SPACE_API_KEY secret and returns: { text: "..." }
 */

const OCR_SPACE_URL = "https://api.ocr.space/parse/image";

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
				const { image } = body;

				if (!image) {
					return json({ error: "Missing image field" }, 400);
				}

				if (!env.OCR_SPACE_API_KEY) {
					return json({ error: "OCR.space API key is not configured" }, 500);
				}

				const result = await runOcrSpace(env.OCR_SPACE_API_KEY, {
					image,
				});

				return json({ text: extractText(result), engine: "ocr.space" }, 200);
			} catch (e) {
				return json(
					{ error: e instanceof Error ? e.message : "OCR request failed" },
					502,
				);
			}
		}

		return json({ error: "Not found" }, 404);
	},
};

async function runOcrSpace(apiKey, { image }) {
	if (!/^data:image\/(?:png|jpe?g|webp);base64,/i.test(image)) {
		throw new Error("Image must be a PNG, JPG, or WEBP data URL");
	}

	const form = new FormData();
	form.append("apikey", apiKey);
	form.append("base64Image", image);
	form.append("OCREngine", "2");
	form.append("isOverlayRequired", "false");
	form.append("detectOrientation", "true");
	form.append("scale", "true");

	const response = await fetch(OCR_SPACE_URL, {
		method: "POST",
		body: form,
	});
	const result = await response.json();

	if (!response.ok) {
		throw new Error(`OCR.space returned HTTP ${response.status}`);
	}
	if (result.IsErroredOnProcessing) {
		const errors = Array.isArray(result.ErrorMessage)
			? result.ErrorMessage.join(" ")
			: result.ErrorMessage || "OCR.space could not process the image";
		throw new Error(errors);
	}

	return result;
}

function extractText(result) {
	return (result?.ParsedResults ?? [])
		.map((parsed) => parsed?.ParsedText ?? "")
		.join("\n")
		.trim();
}

function json(obj, status = 200) {
	return new Response(JSON.stringify(obj), {
		status,
		headers: { "Content-Type": "application/json", ...CORS },
	});
}
