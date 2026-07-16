const { loadPrompt } = require('./promptLoader');
const { chatJSON, isEnabled } = require('./llm');

function emptyGrade(reason) {
  return {
    total_score: 50,
    dimension_scores: [{ dimension: '综合', score: 50, max: 100, comment: reason || '无法评分' }],
    strengths: [],
    improvements: [],
    missing_points: [],
    verdict: '暂时无法评分，请重试。',
    source: 'fallback',
    fallbackReason: reason || 'LLM 不可用',
  };
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const total_score = Math.min(100, Math.max(0, parseInt(raw.total_score, 10) || 50));

  const dimension_scores = (Array.isArray(raw.dimension_scores) ? raw.dimension_scores : [])
    .slice(0, 5)
    .map(d => ({
      dimension: String(d.dimension || '').trim().slice(0, 30),
      score: Math.min(d.max || 100, Math.max(0, parseInt(d.score, 10) || 0)),
      max: Math.max(1, parseInt(d.max, 10) || 100),
      comment: String(d.comment || '').trim().slice(0, 200),
    }))
    .filter(d => d.dimension);

  const strengths = (Array.isArray(raw.strengths) ? raw.strengths : [])
    .map(s => String(s || '').trim().slice(0, 150))
    .filter(Boolean)
    .slice(0, 5);

  const improvements = (Array.isArray(raw.improvements) ? raw.improvements : [])
    .map(s => String(s || '').trim().slice(0, 150))
    .filter(Boolean)
    .slice(0, 5);

  const missing_points = (Array.isArray(raw.missing_points) ? raw.missing_points : [])
    .map(s => String(s || '').trim().slice(0, 150))
    .filter(Boolean)
    .slice(0, 5);

  const verdict = String(raw.verdict || '').trim().slice(0, 100);

  if (dimension_scores.length === 0) return null;

  return {
    total_score,
    dimension_scores,
    strengths,
    improvements,
    missing_points,
    verdict,
    source: 'llm',
  };
}

async function grade(question, userAnswer, reference, criteria) {
  if (typeof question !== 'string' || !question.trim()) {
    return emptyGrade('题目不能为空');
  }
  if (typeof userAnswer !== 'string' || !userAnswer.trim()) {
    return emptyGrade('用户答案不能为空');
  }

  const cleanQuestion = question.trim().slice(0, 500);
  const cleanAnswer = userAnswer.trim().slice(0, 3000);
  const cleanReference = String(reference || '').trim().slice(0, 2000);
  const cleanCriteria = Array.isArray(criteria) ? JSON.stringify(criteria) : String(criteria || '');

  if (!isEnabled()) {
    return emptyGrade('LLM 不可用，使用默认中位分');
  }

  const prompt = loadPrompt('grader', {
    question: cleanQuestion,
    reference_answer: cleanReference || '暂无参考答案',
    scoring_criteria: cleanCriteria || '暂无评分标准',
    user_answer: cleanAnswer,
  });

  const raw = await chatJSON([
    { role: 'system', content: prompt },
    { role: 'user', content: JSON.stringify({ question: cleanQuestion, user_answer: cleanAnswer }) },
  ], { temperature: 0.1, maxTokens: 2000 });

  const result = normalize(raw);
  if (!result) return emptyGrade('LLM 评分失败');

  return result;
}

module.exports = { grade };
