/**
 * Cloudflare Worker — NVIDIA NIM PaddleOCR Proxy
 * 
 * Exposes:  POST /ocr   { image: "data:image/...;base64,..." }
 * Returns:  { text: "..." }
 *
 * Set the secret via: wrangler secret put NVIDIA_API_KEY
 */

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "baidu/paddleocr";
const DEFAULT_OCR_PROMPT = "Extract all visible text from this image in any language or script. Preserve the original language, characters, line breaks, spacing, and reading order as much as possible. Do not translate, summarize, or explain. Return only the extracted text.";

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

        const ocrPrompt = prompt || DEFAULT_OCR_PROMPT;

        const payload = {
          model: MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: ocrPrompt },
                { type: "image_url", image_url: { url: image } },
              ],
            },
          ],
          max_tokens: 4096,
          temperature: 0.1,
        };

        const apiKey = env.NVIDIA_API_KEY;
        if (!apiKey) {
          return json({ error: "API key not configured" }, 500);
        }

        const resp = await fetch(NVIDIA_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          return json({ error: `NVIDIA API error: ${resp.status}`, details: errText }, resp.status);
        }

        const data = await resp.json();
        const text = data?.choices?.[0]?.message?.content ?? "";
        return json({ text }, 200);

      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
