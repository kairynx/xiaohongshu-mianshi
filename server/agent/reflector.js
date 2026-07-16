const { loadPrompt } = require('./promptLoader');
const { chatJSON, isEnabled } = require('./llm');

function truncateText(text, maxLen = 200) {
  return String(text || '').slice(0, maxLen);
}

function normalizeCollected(collected) {
  if (!Array.isArray(collected)) return [];
  const sorted = [...collected].sort((a, b) => (parseInt(b?.likes || 0) - parseInt(a?.likes || 0)));
  return sorted.slice(0, 20).map(item => ({
    title: truncateText(item.title, 120),
    content: truncateText(item.content, 200),
    likes: parseInt(item.likes || 0),
    collects: parseInt(item.collects || 0),
  }));
}

function normalizeNextKeywords(nextKeywords, triedKeywords) {
  const tried = new Set((Array.isArray(triedKeywords) ? triedKeywords : []).map(k => String(k).trim()));
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(nextKeywords) ? nextKeywords : []) {
    const keyword = String(item || '').trim().slice(0, 100);
    if (!keyword || seen.has(keyword) || tried.has(keyword)) continue;
    seen.add(keyword);
    out.push(keyword);
    if (out.length >= 5) break;
  }
  return out;
}

function fallbackReflect() {
  return {
    decision: 'stop',
    reason: 'LLM 不可用，本轮结束',
    nextKeywords: [],
    qualitySummary: 'LLM 不可用，本轮结束',
    source: 'fallback',
  };
}

function normalizeDecision(raw) {
  return raw === 'continue' ? 'continue' : 'stop';
}

async function reflect(context) {
  const { goal, triedKeywords, collected, round, maxRounds } = context || {};
  if (typeof goal !== 'string' || !goal.trim()) {
    throw new Error('goal must be a non-empty string');
  }

  const currentRound = Number(round);
  const totalRounds = Number(maxRounds);
  if (Number.isFinite(totalRounds) && Number.isFinite(currentRound) && currentRound >= totalRounds) {
    return fallbackReflect();
  }

  const normalizedCollected = normalizeCollected(collected);
  if (normalizedCollected.length >= 20) {
    return fallbackReflect();
  }

  if (!isEnabled()) {
    return fallbackReflect();
  }

  const prompt = loadPrompt('reflector', {
    goal: goal.trim().slice(0, 200),
    tried_keywords: JSON.stringify(Array.isArray(triedKeywords) ? triedKeywords : []),
    collected: JSON.stringify(normalizedCollected),
    round: String(round),
    max_rounds: String(maxRounds),
  });

  const messages = [
    { role: 'system', content: prompt },
    { role: 'user', content: goal.trim().slice(0, 200) },
  ];

  const raw = await chatJSON(messages, { temperature: 0.2 });
  if (!raw || typeof raw !== 'object') {
    return fallbackReflect();
  }

  const decision = normalizeDecision(raw.decision);
  const nextKeywords = decision === 'continue'
    ? normalizeNextKeywords(raw.next_keywords || raw.nextKeywords, triedKeywords)
    : [];
  const reason = typeof raw.reason === 'string' && raw.reason.trim()
    ? raw.reason.trim()
    : 'LLM 不可用，本轮结束';
  const qualitySummary = typeof raw.quality_summary === 'string' && raw.quality_summary.trim()
    ? raw.quality_summary.trim()
    : '';

  return {
    decision,
    reason,
    nextKeywords,
    qualitySummary,
    source: 'llm',
  };
}

module.exports = { reflect };
