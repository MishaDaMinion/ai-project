// ─────────────────────────────────────────────────
//  CareerBuddy AI — Cloudflare Worker Proxy
//
//  careerbuddy.html sends the chat here; this worker
//  adds the API key and calls Claude. Paste this
//  worker's URL into WORKER_URL in careerbuddy.html.
//
//  The API key is NOT stored in this file. Add it in
//  Cloudflare: Workers > your worker > Settings >
//  Variables and Secrets > add secret ANTHROPIC_API_KEY
//  (type "Secret", not "Text", then click Deploy)
// ─────────────────────────────────────────────────

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-5-5";

// Allow requests from anywhere (lock down to your site's URL later)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const SYSTEM_PROMPT = `You are CareerBuddy, a warm, upbeat career guide for high school students.
Help them explore careers, majors, colleges, classes, extracurriculars and skills.
Keep replies short and friendly (usually under 150 words), use **bold** for key terms,
an emoji or two is fine, and end with a question that keeps them thinking.
Be honest when you're unsure, and suggest talking to a school counselor for big decisions.

When numbers would genuinely help (salaries, job growth, comparisons), you may add ONE chart
at the very end of your reply in exactly this format, with 3-6 items:
\`\`\`chart
{"type":"bar","title":"Short title","labels":["A","B","C"],"values":[10,20,30]}
\`\`\`
"type" can be "bar" or "doughnut". Values must be plain numbers. Otherwise, don't include a chart.`;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "ANTHROPIC_API_KEY secret is not set on this worker" }, 500);
    }

    try {
      const body = await request.json();

      // Only accept plain user/assistant text turns, and cap the size
      const messages = (Array.isArray(body.messages) ? body.messages : [])
        .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
      while (messages.length && messages[0].role !== "user") messages.shift();
      if (!messages.length) return json({ error: "No user message" }, 400);

      let system = SYSTEM_PROMPT;
      if (typeof body.userName === "string" && body.userName) system += `\n\nThe student's name is ${body.userName.slice(0, 50)}.`;
      if (typeof body.profile === "string" && body.profile) system += `\n\n${body.profile.slice(0, 1500)}`;

      const anthropicResponse = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-beta":    "server-side-fallback-2026-07-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          output_config: { effort: "low" },
          fallbacks: "default",
          system,
          messages,
        }),
      });

      const data = await anthropicResponse.json();

      if (!anthropicResponse.ok) {
        return json({ error: data?.error?.message || "Anthropic API error" }, anthropicResponse.status);
      }
      if (data.stop_reason === "refusal") {
        return json({ text: "I can't help with that one, but I'd love to talk careers, majors, or school! 💕" });
      }

      const text = (data.content || [])
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("")
        .trim();

      return json({ text: text || "Hmm, I blanked for a sec. Could you ask that again? 💭" });

    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
}
