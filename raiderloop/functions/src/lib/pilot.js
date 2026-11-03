/**
 * Pilot's brain, shared by the app (askPilot) and Text Flyer (SMS).
 * Not a Cloud Function module.
 */
const C = require('../common');

const { HttpsError } = C;
const LIMITS = { pilotFree: 25, pilotPlus: 150 };

async function runPilot({ uid, question, context, history, channel = 'app' }) {
  if (!question || typeof question !== 'string' || !question.trim()) throw new HttpsError('invalid-argument', 'Ask a question first.');
  if (question.length > 600) throw new HttpsError('invalid-argument', 'That question is a bit long. Try a shorter one.');
  const plus = await C.isPlus(uid);
  await C.takeQuota(uid, 'pilot', plus ? LIMITS.pilotPlus : LIMITS.pilotFree,
    plus ? "You've reached today's question limit. It resets at midnight." : `That's all ${LIMITS.pilotFree} free questions for today — they reset at midnight, or Flyer Plus gives you ${LIMITS.pilotPlus} a day.`);

  const system = `You are Pilot, the assistant inside Flyer — an independent, student-built campus app (not affiliated with or endorsed by any university). You help a Texas Tech University student in Lubbock, TX.

First answer from the real data in <context>. If the answer isn't there but is a real-world fact a live search could find (deadlines, office hours, current events, policies), call search_web instead of guessing. If neither gives a verified answer, say so plainly and point to where they can check. Never invent a building, room, time, event, phone number, deadline, or organization detail.

For anything about safety or an emergency, tell them to call 911 first.

Keep answers short: 1-3 sentences, friendly, plain text (no markdown headings).

<context>
${String(context || '').slice(0, 24000)}
</context>${channel === 'sms' ? '\n\nThis reply goes out as a text message: keep it under 300 characters and plain.' : ''}`;

  const tools = [{
    name: 'search_web',
    description: 'Search the live web for current, real information not in the context — deadlines, current office holders, campus news, hours, or anything that could have changed recently.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'A short, specific search query.' } }, required: ['query'] },
  }];

  const prior = Array.isArray(history) ? history.slice(-6).filter((m) => m && m.text).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text).slice(0, 800) })) : [];
  // The API requires alternating roles starting with user.
  const msgs = [];
  for (const m of prior) { if (!msgs.length && m.role !== 'user') continue; if (msgs.length && msgs[msgs.length - 1].role === m.role) continue; msgs.push(m); }
  if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs.pop();
  msgs.push({ role: 'user', content: question });

  let data = await C.callClaude({ system, messages: msgs, maxTokens: 450, tools });
  const toolUse = (data.content || []).find((b) => b.type === 'tool_use');
  let sources = [];
  if (toolUse && toolUse.name === 'search_web') {
    const results = await C.tavilySearch({ query: `${toolUse.input.query} Texas Tech Lubbock`, maxResults: 4 });
    sources = (results.results || []).slice(0, 3).map((r) => ({ title: r.title, url: r.url }));
    const summary = (results.results || []).map((r) => `${r.title} (${r.url}): ${r.content}`.slice(0, 500)).join('\n\n') || 'No results found.';
    msgs.push({ role: 'assistant', content: data.content });
    msgs.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: summary }] });
    data = await C.callClaude({ system, messages: msgs, maxTokens: 450, tools });
  }
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
    || "I don't have verified information on that yet.";
  return { text, sources };
}



module.exports = { runPilot };
