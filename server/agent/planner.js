const { loadPrompt } = require('./promptLoader');
const { chatJSON, isEnabled } = require('./llm');

const VALID_STRATEGIES = new Set(['focused', 'broad', 'mixed']);

const COMPANY_MAP = [
  ['字节跳动', '字节'],
  ['阿里巴巴', '阿里'],
  ['拼多多', '拼多多'],
  ['小红书', '小红书'],
  ['腾讯', '腾讯'],
  ['美团', '美团'],
  ['京东', '京东'],
  ['百度', '百度'],
  ['网易', '网易'],
  ['快手', '快手'],
  ['滴滴', '滴滴'],
  ['华为', '华为'],
  ['OPPO', 'OPPO'],
  ['vivo', 'vivo'],
  ['小米', '小米'],
];

const ROLE_MAP = [
  ['前端开发', '前端'],
  ['前端', '前端'],
  ['后端开发', '后端'],
  ['后端', '后端'],
  ['测试开发', '测开'],
  ['测开', '测开'],
  ['移动端开发', '移动端'],
  ['移动端', '移动端'],
  ['产品经理', '产品'],
  ['产品', '产品'],
  ['算法工程师', '算法'],
  ['算法', '算法'],
  ['数据分析', '数据'],
  ['数据', '数据'],
];

const STAGE_WORDS = ['实习', '校招', '社招', '一面', '二面', '终面', '面经', '面试'];

function sanitizeGoal(goal) {
  if (typeof goal !== 'string' || !goal.trim()) {
    throw new Error('goal must be a non-empty string');
  }
  return goal.trim().slice(0, 200);
}

function normalizeKeywords(keywords) {
  if (!Array.isArray(keywords)) return [];
  const seen = new Set();
  const normalized = [];

  for (const item of keywords) {
    const keyword = String(item || '').trim().slice(0, 100);
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    normalized.push(keyword);
    if (normalized.length >= 15) break;
  }

  return normalized;
}

function applyDictionary(text, dict) {
  let out = String(text || '');
  for (const [from, to] of dict) {
    out = out.split(from).join(to);
  }
  return out;
}

function extractGoalContext(goal) {
  const cleanGoal = sanitizeGoal(goal);
  const companyGoal = applyDictionary(cleanGoal, COMPANY_MAP);
  const roleGoal = applyDictionary(cleanGoal, ROLE_MAP);

  const company = COMPANY_MAP.map(([, to]) => to).find(token => companyGoal.includes(token)) || '';
  const role = ROLE_MAP.map(([, to]) => to).find(token => roleGoal.includes(token)) || '';
  const stage = STAGE_WORDS.find(token => cleanGoal.includes(token)) || '';

  return {
    goal: cleanGoal,
    company,
    role,
    stage,
  };
}

function tokenizeGoal(goal) {
  let text = applyDictionary(goal, COMPANY_MAP);
  text = applyDictionary(text, ROLE_MAP);

  const tokens = text.split(/\s+/).map(s => s.trim()).filter(Boolean);
  return tokens.length > 0 ? tokens : [String(goal || '').trim()];
}

function containsToken(goal, tokenList) {
  return tokenList.find(token => String(goal).includes(token)) || '';
}

function makeKeyword(parts) {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 15);
}

function normalizeKeywordShape(keyword) {
  let text = String(keyword || '').trim();
  if (!text) return '';

  text = applyDictionary(text, COMPANY_MAP);
  text = applyDictionary(text, ROLE_MAP);
  text = text.replace(/[，,。./|、]+/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();

  const parts = text.split(' ').filter(Boolean).slice(0, 3);
  if (parts.length === 0) return '';

  let out = parts.join(' ');
  if (out.length > 15) {
    if (parts.length >= 3) out = `${parts[0]} ${parts[1]}`.trim();
    if (out.length > 15) out = parts[0].slice(0, 15);
  }

  return out.slice(0, 15);
}

function isValidOutputKeyword(keyword) {
  const text = String(keyword || '').trim();
  if (!text || text.length > 15) return false;
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts.length > 3) return false;
  if (parts.length > 1 && !text.includes(' ')) return false;
  return true;
}

function fallbackPlan(goal) {
  const normalizedGoal = sanitizeGoal(goal);
  const tokens = tokenizeGoal(normalizedGoal);
  const company = containsToken(applyDictionary(normalizedGoal, COMPANY_MAP), COMPANY_MAP.map(([, to]) => to));
  const role = containsToken(applyDictionary(normalizedGoal, ROLE_MAP), ROLE_MAP.map(([, to]) => to));
  const stage = containsToken(normalizedGoal, STAGE_WORDS);

  let candidates = [];
  if (company && role) {
    candidates = [
      makeKeyword([company, role]),
      makeKeyword([company, '面经']),
      makeKeyword([company, role, '面经']),
      makeKeyword([role, '面经']),
      makeKeyword([company, '一面']),
    ];
  } else if (company) {
    candidates = [
      makeKeyword([company, '面经']),
      makeKeyword([company, '面试']),
      makeKeyword([company, '一面']),
      makeKeyword([company, '校招']),
    ];
  } else if (role) {
    candidates = [
      makeKeyword([role, '面经']),
      makeKeyword([role, '面试']),
      makeKeyword([role, '实习']),
      makeKeyword([role, '一面']),
    ];
  } else {
    const base = normalizedGoal.slice(0, 8);
    candidates = [base, makeKeyword([base, '面经'])];
  }

  if (stage && candidates.length < 5) {
    candidates.push(makeKeyword([company || role || tokens[0], stage]));
  }

  return {
    keywords: normalizeKeywords(candidates),
    reasoning: 'LLM 不可用，使用启发式规则从目标中提取关键词',
    strategy: 'focused',
    source: 'fallback',
  };
}

function normalizePlan(raw, ctx) {
  if (!raw || typeof raw !== 'object') return null;

  const keywords = normalizeKeywords((raw.keywords || []).map(normalizeKeywordShape).filter(Boolean));
  const reasoning = typeof raw.reasoning === 'string' && raw.reasoning.trim()
    ? raw.reasoning.trim()
    : '';
  const strategy = VALID_STRATEGIES.has(raw.strategy) ? raw.strategy : '';

  if (keywords.length === 0 || !reasoning || !strategy) return null;
  if (!keywords.every(isValidOutputKeyword)) return null;

  if (ctx.company) {
    const companyHits = keywords.filter(keyword => keyword.includes(ctx.company)).length;
    if (companyHits / keywords.length < 0.6) return null;
  }

  if (ctx.role) {
    const roleHits = keywords.filter(keyword => keyword.includes(ctx.role)).length;
    if (roleHits / keywords.length < 0.4) return null;
  }

  return {
    keywords,
    reasoning,
    strategy,
    source: 'llm',
  };
}

async function plan(goal) {
  const cleanGoal = sanitizeGoal(goal);

  if (!isEnabled()) {
    return fallbackPlan(cleanGoal);
  }

  const ctx = extractGoalContext(cleanGoal);
  const prompt = loadPrompt('planner', ctx);
  const messages = [
    { role: 'system', content: prompt },
    { role: 'user', content: JSON.stringify(ctx) },
  ];

  const raw = await chatJSON(messages, { temperature: 0.5 });
  const normalized = normalizePlan(raw, ctx);

  return normalized || fallbackPlan(cleanGoal);
}

module.exports = { plan };
