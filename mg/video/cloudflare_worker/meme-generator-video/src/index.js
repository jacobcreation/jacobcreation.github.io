/**
 * AI Video Generator - Cloudflare Worker
 * Uses Pixazo's free LTX Video text-to-video API.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'X-Video-Pipeline': 'pixazo-ltx-video',
};

const PIXAZO_GENERATE_URL = 'https://gateway.pixazo.ai/ltx-video/v1/text-to-video';
const PIXAZO_STATUS_URL = 'https://gateway.pixazo.ai/v2/requests/status';
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 36;

function getDailyKey(ip, dateStr) { return `daily_video:${ip}:${dateStr}`; }
function todayStr() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function secondsUntilMidnightUTC() {
  const now = Date.now();
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now) / 1000);
}

class ClientVisibleError extends Error {
  constructor(message, status = 500, code = 'provider_error', details = message) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function parseErrorMessage(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed.detail || parsed.message || parsed.error?.message || parsed.error || text;
  } catch { return text; }
}

async function requireJsonOk(response, label) {
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} failed: ${parseErrorMessage(text)}`);
  try { return JSON.parse(text); } catch { throw new Error(`${label} returned invalid JSON.`); }
}

function pixazoHeaders(apiKey) {
  return { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': apiKey };
}

async function generatePixazoVideo(prompt, apiKey) {
  if (!apiKey) throw new Error('Pixazo API key is missing from the Worker secrets.');

  const submitted = await requireJsonOk(await fetch(PIXAZO_GENERATE_URL, {
    method: 'POST', headers: pixazoHeaders(apiKey), body: JSON.stringify({ prompt }),
  }), 'Pixazo LTX generation');
  if (!submitted.request_id) throw new Error(`Pixazo returned no request_id: ${JSON.stringify(submitted).slice(0, 700)}`);

  let result = submitted;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (result.status === 'COMPLETED') break;
    if (result.status === 'ERROR') throw new Error(`Pixazo LTX generation failed: ${result.error || 'unknown provider error'}`);
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    result = await requireJsonOk(await fetch(`${PIXAZO_STATUS_URL}/${encodeURIComponent(submitted.request_id)}`, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    }), 'Pixazo LTX status check');
  }
  if (result.status !== 'COMPLETED') throw new ClientVisibleError('Pixazo LTX generation timed out. Please try again.', 504, 'pixazo_timeout');

  const mediaUrl = Array.isArray(result.output?.media_url) ? result.output.media_url[0] : result.output?.media_url;
  if (!mediaUrl) throw new Error(`Pixazo returned no video URL: ${JSON.stringify(result).slice(0, 700)}`);
  const videoResponse = await fetch(mediaUrl);
  if (!videoResponse.ok) throw new Error(`Pixazo video download failed with status ${videoResponse.status}.`);
  return videoResponse;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Only POST method allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });

    try {
      const { prompt } = await request.json();
      if (!prompt?.trim()) return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });

      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const date = todayStr();
      const key = getDailyKey(clientIP, date);
      const limit = parseInt(env.DAILY_LIMIT || '15', 10);
      let usage = 0;
      if (env.RATE_LIMIT) {
        const stored = await env.RATE_LIMIT.get(key);
        if (stored !== null) usage = parseInt(stored, 10);
        if (usage >= limit) return new Response(JSON.stringify({ error: `Daily limit reached (${limit} videos). Come back tomorrow!` }), {
          status: 429, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      const videoResponse = await generatePixazoVideo(prompt.trim().substring(0, 500), env.PIXAZO_API_KEY);
      if (env.RATE_LIMIT) ctx.waitUntil(env.RATE_LIMIT.put(key, String(usage + 1), { expirationTtl: secondsUntilMidnightUTC() }));
      return new Response(videoResponse.body, {
        headers: { 'Content-Type': videoResponse.headers.get('Content-Type') || 'video/mp4', ...CORS_HEADERS },
      });
    } catch (err) {
      console.error('Unhandled error:', err.message);
      const clientError = err instanceof ClientVisibleError ? err : new ClientVisibleError(err.message || String(err));
      return new Response(JSON.stringify({ error: clientError.message, code: clientError.code, details: clientError.details }), {
        status: clientError.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  },
};
