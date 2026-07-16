const { loadPrompt } = require('./promptLoader');
const { chatJSON, isEnabled } = require('./llm');

const FALLBACK_QUESTIONS = [
  {
    question: '请描述一下 React 中 Virtual DOM 的工作原理，以及它为什么能提升性能？',
    topic: 'React',
    difficulty: 'medium',
  },
  {
    question: 'JavaScript 中闭包是什么？请举例说明闭包的实际应用场景。',
    topic: 'JS 基础',
    difficulty: 'easy',
  },
  {
    question: '请解释一下浏览器从输入 URL 到页面渲染的完整过程。',
    topic: '网络/浏览器',
    difficulty: 'medium',
  },
  {
    question: 'CSS 中 Flexbox 和 Grid 布局各有什么适用场景？请举例说明。',
    topic: 'CSS',
    difficulty: 'easy',
  },
  {
    question: '请描述一下前端性能优化的常见手段，至少列举 5 种。',
    topic: '性能优化',
    difficulty: 'medium',
  },
];

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const question = String(raw.question || '').trim().slice(0, 300);
  const topic = String(raw.topic || '').trim().slice(0, 50);
  const difficulty = ['easy', 'medium', 'hard'].includes(raw.difficulty) ? raw.difficulty : 'medium';
  const reference_answer = String(raw.reference_answer || '').trim().slice(0, 1500);
  const hints = (Array.isArray(raw.hints) ? raw.hints : [])
    .map(h => String(h || '').trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 3);

  const scoring_criteria = (Array.isArray(raw.scoring_criteria) ? raw.scoring_criteria : [])
    .slice(0, 5)
    .map(c => ({
      dimension: String(c.dimension || '').trim().slice(0, 30),
      description: String(c.description || '').trim().slice(0, 100),
      weight: Math.min(1, Math.max(0, Number(c.weight) || 0.2)),
    }))
    .filter(c => c.dimension);

  if (!question || !topic) return null;

  return {
    question,
    topic,
    difficulty,
    reference_answer,
    scoring_criteria: scoring_criteria.length > 0 ? scoring_criteria : [
      { dimension: '正确性', description: '回答是否正确', weight: 0.5 },
      { dimension: '完整性', description: '是否覆盖关键点', weight: 0.3 },
      { dimension: '表达', description: '表达是否清晰', weight: 0.2 },
    ],
    hints,
    source: 'llm',
  };
}

function getRandomFallback() {
  const q = FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)];
  return {
    ...q,
    reference_answer: '请参考相关技术文档和面试经验。',
    scoring_criteria: [
      { dimension: '正确性', description: '核心技术点是否正确', weight: 0.5 },
      { dimension: '完整性', description: '是否全面覆盖', weight: 0.3 },
      { dimension: '表达', description: '表达清晰度', weight: 0.2 },
    ],
    hints: ['先梳理核心概念', '再结合实际场景说明'],
    source: 'fallback',
    fallbackReason: 'LLM 不可用，从内置题库随机选题',
  };
}

async function generateQuestion(goal, topics, recentQuestions) {
  const cleanGoal = String(goal || '').trim().slice(0, 200);
  const topicsList = Array.isArray(topics) ? topics.map(String).filter(Boolean).slice(0, 20) : [];
  const recentList = Array.isArray(recentQuestions) ? recentQuestions.map(String).filter(Boolean).slice(0, 5) : [];

  if (!isEnabled()) {
    return getRandomFallback();
  }

  const prompt = loadPrompt('interviewer', {
    goal: cleanGoal || '前端开发',
    topics: JSON.stringify(topicsList),
    recent_questions: JSON.stringify(recentList),
  });

  const raw = await chatJSON([
    { role: 'system', content: prompt },
    { role: 'user', content: JSON.stringify({ goal: cleanGoal, topics: topicsList, recent_questions: recentList }) },
  ], { temperature: 0.4, maxTokens: 2500 });

  const result = normalize(raw);
  if (!result) return getRandomFallback();

  return result;
}

module.exports = { generateQuestion };
