const { loadPrompt } = require('./promptLoader');
const { chatJSON, isEnabled } = require('./llm');

const VALID_STAGES = new Set(['实习', '校招', '社招', '未知']);
const VALID_ROUNDS = new Set(['一面', '二面', '三面', 'HR 面', '技术面', '综合面']);
const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

function emptyMeta(error) {
  return {
    company: '',
    role: '',
    stage: '未知',
    rounds: [],
    questions: [],
    topics: [],
    summary: '',
    quality_score: 0.0,
    ...(error ? { extractError: error } : {}),
  };
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.0;
  return Math.min(1, Math.max(0, n));
}

function normalizeQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return questions
    .map(item => {
      const question = String(item?.question || '').trim().slice(0, 500);
      const topic = String(item?.topic || '').trim().slice(0, 50);
      const difficulty = VALID_DIFFICULTIES.has(item?.difficulty) ? item.difficulty : 'medium';
      if (!question || !topic) return null;
      return { question, topic, difficulty };
    })
    .filter(Boolean)
    .slice(0, 30);
}

function normalizeTopics(topics) {
  if (!Array.isArray(topics)) return [];
  const seen = new Set();
  const out = [];
  for (const item of topics) {
    const topic = String(item || '').trim().slice(0, 20);
    if (!topic || seen.has(topic)) continue;
    seen.add(topic);
    out.push(topic);
    if (out.length >= 10) break;
  }
  return out;
}

function normalizeRounds(rounds) {
  if (!Array.isArray(rounds)) return [];
  const seen = new Set();
  const out = [];
  for (const item of rounds) {
    const round = String(item || '').trim();
    if (!VALID_ROUNDS.has(round) || seen.has(round)) continue;
    seen.add(round);
    out.push(round);
  }
  return out;
}

function normalizeMeta(raw) {
  if (!raw || typeof raw !== 'object') return emptyMeta('LLM 返回为空或格式无效');
  return {
    company: String(raw.company || '').trim().slice(0, 50),
    role: String(raw.role || '').trim().slice(0, 50),
    stage: VALID_STAGES.has(raw.stage) ? raw.stage : '未知',
    rounds: normalizeRounds(raw.rounds),
    questions: normalizeQuestions(raw.questions),
    topics: normalizeTopics(raw.topics),
    summary: String(raw.summary || '').trim().slice(0, 500),
    quality_score: clampScore(raw.quality_score),
  };
}

async function extract(content) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('content must be a non-empty string');
  }

  const cleanContent = content.trim().slice(0, 8000);
  if (!isEnabled()) {
    return emptyMeta('LLM 不可用');
  }

  const prompt = loadPrompt('extractor', { content: cleanContent });
  const raw = await chatJSON([
    { role: 'system', content: prompt },
    { role: 'user', content: cleanContent },
  ], { temperature: 0.15, maxTokens: 3000 });

  if (!raw) {
    return emptyMeta('LLM 返回为空或 JSON 解析失败');
  }

  return normalizeMeta(raw);
}

module.exports = { extract };
