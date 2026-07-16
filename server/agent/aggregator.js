const { loadPrompt } = require('./promptLoader');
const { chatJSON, isEnabled } = require('./llm');

function emptyAggregation(reason) {
  return {
    topics_ranking: [],
    learning_path: [],
    weak_areas: [],
    summary: reason || '暂无数据',
    source: 'fallback',
  };
}

function heuristicAggregate(goal, posts) {
  const topicCount = new Map();
  for (const post of posts) {
    const meta = post.meta || {};
    const questions = Array.isArray(meta.questions) ? meta.questions : [];
    const topics = Array.isArray(meta.topics) ? meta.topics : [];

    for (const q of questions) {
      const t = String(q.topic || '').trim();
      if (!t) continue;
      topicCount.set(t, (topicCount.get(t) || 0) + 1);
    }
    for (const t of topics) {
      const key = String(t).trim();
      if (!key) continue;
      topicCount.set(key, (topicCount.get(key) || 0) + 1);
    }
  }

  const sorted = [...topicCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  const topics_ranking = sorted.map(([topic, count]) => ({
    topic,
    count,
    difficulty: 'medium',
    importance: count >= 5 ? 'high' : count >= 2 ? 'medium' : 'low',
  }));

  const learning_path = sorted.slice(0, 10).map(([topic], i) => ({
    order: i + 1,
    topic,
    reason: `出现 ${topicCount.get(topic)} 次，建议优先掌握`,
  }));

  const weak_areas = sorted
    .filter(([, count]) => count <= 1)
    .slice(0, 5)
    .map(([topic]) => topic);

  return {
    topics_ranking,
    learning_path,
    weak_areas,
    summary: `共分析了 ${posts.length} 条面经，提取到 ${sorted.length} 个知识点。高频方向：${sorted.slice(0, 3).map(([t]) => t).join('、') || '暂无'}。`,
    source: 'heuristic',
  };
}

function buildPostsMeta(posts) {
  return posts.map(p => {
    const meta = p.meta || {};
    return {
      id: p.id,
      title: String(p.title || '').slice(0, 100),
      relevance: typeof p.relevance === 'number' ? p.relevance : null,
      quality_score: meta.quality_score,
      questions: (Array.isArray(meta.questions) ? meta.questions : []).slice(0, 10).map(q => ({
        question: String(q.question || '').slice(0, 100),
        topic: q.topic || '',
        difficulty: q.difficulty || 'medium',
      })),
      topics: Array.isArray(meta.topics) ? meta.topics : [],
    };
  });
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return emptyAggregation('LLM 返回为空');

  const topics_ranking = (Array.isArray(raw.topics_ranking) ? raw.topics_ranking : [])
    .slice(0, 20)
    .map(item => ({
      topic: String(item.topic || '').trim().slice(0, 50),
      count: Math.max(0, parseInt(item.count, 10) || 0),
      difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : 'medium',
      importance: ['high', 'medium', 'low'].includes(item.importance) ? item.importance : 'medium',
    }))
    .filter(item => item.topic);

  const learning_path = (Array.isArray(raw.learning_path) ? raw.learning_path : [])
    .slice(0, 10)
    .map((item, i) => ({
      order: parseInt(item.order, 10) || i + 1,
      topic: String(item.topic || '').trim().slice(0, 50),
      reason: String(item.reason || '').trim().slice(0, 200),
    }))
    .filter(item => item.topic);

  const weak_areas = (Array.isArray(raw.weak_areas) ? raw.weak_areas : [])
    .map(item => String(item || '').trim().slice(0, 50))
    .filter(Boolean)
    .slice(0, 5);

  const summary = String(raw.summary || '').trim().slice(0, 200);

  return {
    topics_ranking,
    learning_path,
    weak_areas,
    summary,
    source: 'llm',
  };
}

async function aggregate(goal, posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return emptyAggregation('暂无面经数据');
  }

  const cleanGoal = String(goal || '').trim().slice(0, 200);

  let sortedPosts = [...posts];
  sortedPosts.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  if (sortedPosts.length > 30) {
    sortedPosts = sortedPosts.slice(0, 30);
  }

  if (!isEnabled()) {
    return heuristicAggregate(cleanGoal, sortedPosts);
  }

  const postsMeta = buildPostsMeta(sortedPosts);
  const prompt = loadPrompt('aggregator', {
    goal: cleanGoal || '通用',
    posts_meta: JSON.stringify(postsMeta),
  });

  const raw = await chatJSON([
    { role: 'system', content: prompt },
    { role: 'user', content: JSON.stringify({ goal: cleanGoal, posts_count: postsMeta.length }) },
  ], { temperature: 0.2, maxTokens: 3000 });

  if (!raw) {
    return heuristicAggregate(cleanGoal, sortedPosts);
  }

  const result = normalize(raw);
  return result;
}

module.exports = { aggregate };
