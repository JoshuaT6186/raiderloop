/**
 * RaiderLoop Cloud Functions — real Claude integration
 * -----------------------------------------------------------
 * Two callable functions:
 *   askRed          — real AI chat, grounded in real app data
 *   parseSchedule   — reads a schedule screenshot, returns structured classes
 *
 * SETUP (one time):
 *   1. firebase init functions   (choose JavaScript, or drop this
 *      file into an existing functions/ folder)
 *   2. npm install firebase-functions firebase-admin --save
 *      (inside the functions/ folder)
 *   3. firebase functions:secrets:set ANTHROPIC_API_KEY
 *      (paste your key from console.anthropic.com when prompted)
 *   4. firebase deploy --only functions
 *
 * Your project must be on the Blaze (pay-as-you-go) plan — the
 * free Spark plan can't make outbound network calls, which these
 * functions need to reach Anthropic's API.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const MODEL = 'claude-sonnet-4-6';

async function callClaude({ apiKey, system, messages, maxTokens }) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new HttpsError('internal', `Claude API error (${resp.status}): ${errText}`);
  }
  const data = await resp.json();
  return (data.content || []).map((b) => b.text || '').join('');
}

/* ============================================================
   ASK RED — real AI, grounded in real app data
   ------------------------------------------------------------
   The client sends the user's question PLUS a compact snapshot
   of real app state (their schedule, nearby buildings, today's
   events) as `context`. The system prompt instructs Claude to
   only answer from that context — never invent a building name,
   event time, or org detail that isn't actually in the app's
   real data. This is what keeps it from confidently making
   things up, which is the main risk with swapping canned
   responses for a real model.
   ============================================================ */
exports.askRed = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { question, context } = request.data || {};
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new HttpsError('invalid-argument', 'question is required');
  }

  const system = `You are Red, the assistant inside RaiderLoop, a Texas Tech University student app.

Only answer using the real data given to you below inside <context>. If something isn't in the context, say plainly that you don't have verified information on it — never invent a building name, event time, class, or organization detail that isn't actually there.

Keep answers short: 1-3 sentences, friendly, direct. You are not a general chatbot — you only help with things RaiderLoop actually knows about (this student's real schedule, real campus buildings, real events/orgs the app has loaded).

<context>
${context || 'No additional context was provided for this question.'}
</context>`;

  const text = await callClaude({
    apiKey: ANTHROPIC_API_KEY.value(),
    system,
    messages: [{ role: 'user', content: question }],
    maxTokens: 300,
  });

  return { text };
});

/* ============================================================
   PARSE SCHEDULE — real vision, structured output
   ------------------------------------------------------------
   Sends the screenshot to Claude with an explicit instruction to
   return ONLY JSON matching the app's real class shape (title,
   days as M/T/W/Th/F/Sa/Su codes, time, endTime, building name
   as written on screen). The client is responsible for matching
   that building name against the real 199-building list and
   letting the student confirm before saving — vision models can
   misread a screenshot, so this should never silently auto-save.
   ============================================================ */
exports.parseSchedule = onCall({ secrets: [ANTHROPIC_API_KEY], cors: true }, async (request) => {
  const { imageBase64, mediaType } = request.data || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new HttpsError('invalid-argument', 'imageBase64 is required');
  }

  const system = `Extract a class schedule from this screenshot of a university registration/schedule page.

Return ONLY valid JSON — no prose, no markdown code fences, nothing but the array itself. Each entry:
{
  "title": string,           // course code/name as shown, e.g. "CS 1412"
  "days": string[],          // only use these exact codes: "M","T","W","Th","F","Sa","Su"
  "time": string,             // start time like "9:00 AM"
  "endTime": string,          // end time like "9:50 AM"
  "building": string          // building name exactly as written on screen
}

If you can't confidently read a field, omit that whole entry rather than guessing. If the image isn't a schedule at all, return an empty array.`;

  const text = await callClaude({
    apiKey: ANTHROPIC_API_KEY.value(),
    system,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: 'Extract the schedule as JSON, per the format specified.' },
      ],
    }],
    maxTokens: 1200,
  });

  let classes;
  try {
    classes = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!Array.isArray(classes)) throw new Error('not an array');
  } catch (e) {
    throw new HttpsError('internal', "Couldn't read that as a schedule — try a clearer screenshot.");
  }

  return { classes };
});