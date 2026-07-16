const { loadPrompt } = require('./promptLoader');
const { chatJSON, isEnabled } = require('./llm');

function emptyClassification(reason) {
  return {
    relevance: 0.5,
    company_match: 0.5,
    role_match: 0.5,
    stage_match: 0.5,
    content_useful: 0.5,
    reasons: [reason || 'LLM 不可用，使用中位分'],
    mismatched: [],
    pass: true,
    source: 'fallback',
  };
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function clampTextArray(arr, maxCount) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(item => String(item || '').trim().slice(0, 30))
    .filter(Boolean)
    .slice(0, maxCount);
}

function normalizeClassification(raw, fallbackReason) {
  if (!raw || typeof raw !== 'object') {
    return { ...emptyClassification(fallbackReason), source: 'fallback' };
  }

  const relevance = clamp01(raw.relevance);
  const company_match = clamp01(raw.company_match);
  const role_match = clamp01(raw.role_match);
  const stage_match = clamp01(raw.stage_match);
  const content_useful = clamp01(raw.content_useful);
  const reasons = clampTextArray(raw.reasons, 5);
  const mismatched = clampTextArray(raw.mismatched, 3);
  const pass = relevance >= 0.5;

  return {
    relevance,
    company_match,
    role_match,
    stage_match,
    content_useful,
    reasons: reasons.length ? reasons : [fallbackReason || 'LLM 返回为空理由'],
    mismatched,
    pass,
    source: 'llm',
  };
}

async function classify(content, goal, meta) {
  if (typeof goal !== 'string' || !goal.trim()) {
    throw new Error('goal must be a non-empty string');
  }

  if (typeof content !== 'string' || !content.trim()) {
    return emptyClassification('内容为空');
  }

  const cleanContent = content.trim().slice(0, 6000);
  const metaText = meta == null ? 'null' : JSON.stringify(meta);

  if (!isEnabled()) {
    return emptyClassification('LLM 不可用，使用中位分');
  }

  const prompt = loadPrompt('classifier', {
    goal: goal.trim().slice(0, 200),
    content: cleanContent,
    meta: metaText,
  });

  const raw = await chatJSON([
    { role: 'system', content: prompt },
    { role: 'user', content: JSON.stringify({ goal: goal.trim().slice(0, 200), content: cleanContent, meta }) },
  ], { temperature: 0.1, maxTokens: 800 });

  if (!raw) {
    return emptyClassification('LLM 返回为空或 JSON 解析失败');
  }

  return normalizeClassification(raw, 'LLM 返回为空或 JSON 解析失败');
}

module.exports = { classify };
