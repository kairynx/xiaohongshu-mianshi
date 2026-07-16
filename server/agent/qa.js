const { loadPrompt } = require('./promptLoader');
const { chatJSON, isEnabled } = require('./llm');
const { getPool, getPostsByUserNotes, rowToPost } = require('../services/db');

function emptyAnswer(reason, posts) {
  const fallbackSummary = (Array.isArray(posts) && posts.length > 0)
    ? `未启用 AI 回答（${reason}）。以下是检索到的 ${posts.length} 条相关面经：\n\n` +
      posts.map((p, i) => `- [${i + 1}] **${String(p.title || '').slice(0, 100)}** (ID: ${String(p.id || '').slice(0, 8)})`).join('\n')
    : `未找到相关面经（${reason}）`;

  return {
    answer: fallbackSummary,
    citations: (Array.isArray(posts) ? posts : []).slice(0, 5).map((p, i) => ({
      index: i + 1,
      postId: p.id,
      title: String(p.title || '').slice(0, 100),
    })),
    confidence: 0,
    related_topics: [],
    source: 'fallback',
    fallbackReason: reason,
  };
}

function normalize(raw, posts) {
  if (!raw || typeof raw !== 'object') return null;

  const answer = String(raw.answer || '').trim().slice(0, 3000);
  const confidence = Math.min(1, Math.max(0, Number(raw.confidence) || 0.5));

  const citations = (Array.isArray(raw.citations) ? raw.citations : [])
    .slice(0, 5)
    .map(c => ({
      index: parseInt(c.index, 10) || 0,
      postId: String(c.postId || '').trim(),
      title: String(c.title || '').trim().slice(0, 100),
    }))
    .filter(c => c.postId);

  const related_topics = (Array.isArray(raw.related_topics) ? raw.related_topics : [])
    .map(t => String(t || '').trim().slice(0, 30))
    .filter(Boolean)
    .slice(0, 5);

  if (!answer) return null;

  return { answer, citations, confidence, related_topics, source: 'llm' };
}

async function searchPosts(question, userId) {
  const pool = getPool();
  if (!pool) return [];

  const cleanQuestion = String(question || '').trim().slice(0, 500);
  if (!cleanQuestion) return [];

  const keywords = cleanQuestion
    .replace(/[？?！!，,。.；;：:、\s]+/g, ' ')
    .split(' ')
    .filter(w => w.length >= 1)
    .slice(0, 5);

  if (keywords.length === 0) return [];

  if (userId) {
    const userPosts = await getPostsByUserNotes(userId, { limit: 200 });
    if (userPosts.length === 0) return [];
    const lowerKw = keywords.map(k => k.toLowerCase());
    return userPosts
      .filter(p => {
        const text = ((p.title || '') + ' ' + (p.content || '')).toLowerCase();
        return lowerKw.some(kw => text.includes(kw));
      })
      .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
      .slice(0, 10);
  }

  const conditions = keywords.map(() => '(title LIKE ? OR content LIKE ?)').join(' OR ');
  const params = [];
  for (const kw of keywords) {
    params.push(`%${kw}%`, `%${kw}%`);
  }

  const [rows] = await pool.query(
    `SELECT * FROM posts WHERE ${conditions} ORDER BY relevance DESC, likes DESC LIMIT 10`,
    params
  );
  return rows.map(rowToPost);
}

function buildPostsSummary(posts) {
  return posts.map((p, i) => {
    const meta = p.meta || {};
    return {
      index: i + 1,
      id: p.id,
      title: String(p.title || '').slice(0, 100),
      summary: String(meta.summary || '').slice(0, 300),
      questions: (Array.isArray(meta.questions) ? meta.questions : []).slice(0, 5).map(q => ({
        question: String(q.question || '').slice(0, 150),
        topic: q.topic || '',
      })),
      topics: Array.isArray(meta.topics) ? meta.topics.slice(0, 5) : [],
      relevance: typeof p.relevance === 'number' ? p.relevance : null,
    };
  });
}

async function askQuestion(question, userId) {
  const cleanQuestion = String(question || '').trim().slice(0, 500);
  if (!cleanQuestion) {
    return emptyAnswer('问题不能为空', []);
  }

  const posts = await searchPosts(cleanQuestion, userId || null);

  if (posts.length === 0) {
    return emptyAnswer('未找到相关面经', []);
  }

  if (!isEnabled()) {
    return emptyAnswer('LLM 不可用', posts);
  }

  const postsSummary = buildPostsSummary(posts);
  const prompt = loadPrompt('qa', {
    question: cleanQuestion,
    retrieved_posts: JSON.stringify(postsSummary),
  });

  const raw = await chatJSON([
    { role: 'system', content: prompt },
    { role: 'user', content: cleanQuestion },
  ], { temperature: 0.2, maxTokens: 2500 });

  const result = normalize(raw, posts);
  if (!result) {
    return emptyAnswer('LLM 返回为空或解析失败', posts);
  }

  return result;
}

module.exports = { askQuestion };
