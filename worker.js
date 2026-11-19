// ─────────────────────────────────────────────────
//  CareerBuddy AI — Cloudflare Worker Proxy (OPTIONAL)
//
//  careerbuddy.html no longer needs this: the chatbot
//  now runs fully in the browser. Only deploy this if
//  you later switch back to a live AI.
//
//  The API key is NOT stored in this file. Add it in
//  Cloudflare: Workers > your worker > Settings >
//  Variables and Secrets > add secret ANTHROPIC_API_KEY
//  (or run: npx wrangler secret put ANTHROPIC_API_KEY)
// ─────────────────────────────────────────────────

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Allow requests from anywhere (lock down to your site's URL later)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {

    // Preflight request browsers send first
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY secret is not set" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    try {
      const body = await request.json();

      const anthropicResponse = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      const data = await anthropicResponse.json();

      return new Response(JSON.stringify(data), {
        status: anthropicResponse.status,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
  }
}
