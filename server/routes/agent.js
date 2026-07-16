const express = require('express');
const router = express.Router();
const { createJob, getJob, listJobs, emitter } = require('../services/jobStore');
const { runJob } = require('../workflow/crawlRunner');
const planner = require('../agent/planner');
const extractor = require('../agent/extractor');
const classifier = require('../agent/classifier');
const { runSmartJob } = require('../workflow/smartCrawlRunner');
const { createAndRunEnrichJob } = require('../workflow/enrichRunner');
const { getPool, updatePostMeta, updatePostClassification, getPostsByUserNotes, createPractice, updatePracticeGrade, getPractice, listPractices, getRecentPractices } = require('../services/db');
const aggregator = require('../agent/aggregator');
const interviewer = require('../agent/interviewer');
const grader = require('../agent/grader');

router.post('/jobs', (req, res) => {
  const { keywords } = req.body;
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ success: false, error: 'keywords 必须是非空数组' });
  }
  const sanitized = keywords.map(k => String(k).slice(0, 200)).filter(Boolean).slice(0, 20);
  const job = createJob(sanitized);
  res.json({ success: true, data: job });
  setImmediate(() => {
    runJob(job.id, sanitized).catch(e => {
      const { updateJob } = require('../services/jobStore');
      updateJob(job.id, { status: 'failed', error: e.message });
    });
  });
});

router.post('/plan', async (req, res) => {
  try {
    const { goal } = req.body;
    if (typeof goal !== 'string' || !goal.trim()) {
      return res.status(400).json({ success: false, error: 'goal 必须是非空字符串' });
    }
    const result = await planner.plan(goal);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/smart-jobs', (req, res) => {
  const { goal, maxRounds = 3 } = req.body;
  if (typeof goal !== 'string' || !goal.trim()) {
    return res.status(400).json({ success: false, error: 'goal 必须是非空字符串' });
  }
  const rounds = parseInt(maxRounds, 10);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 5) {
    return res.status(400).json({ success: false, error: 'maxRounds 必须是 1-5 之间的整数' });
  }

  const job = createJob([]);
  res.json({ success: true, data: job });
  setImmediate(() => {
    runSmartJob(job.id, goal, { maxRounds: rounds }).catch(e => {
      const { updateJob } = require('../services/jobStore');
      updateJob(job.id, { status: 'failed', error: e.message });
    });
  });
});

router.post('/extract/:postId', async (req, res) => {
  try {
    if (!getPool()) return res.status(503).json({ success: false, error: 'MySQL not connected' });
    const [rows] = await getPool().query('SELECT id, content FROM posts WHERE id = ?', [req.params.postId]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'post not found' });

    const meta = await extractor.extract(rows[0].content || '');
    const ok = await updatePostMeta(req.params.postId, meta);
    if (!ok) return res.status(404).json({ success: false, error: 'post not found' });

    res.json({ success: true, data: { postId: req.params.postId, meta } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/extract', async (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, error: 'content must be a non-empty string' });
    }
    const meta = await extractor.extract(content);
    res.json({ success: true, data: meta });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/classify', async (req, res) => {
  try {
    const { content, goal, meta } = req.body;
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, error: 'content must be a non-empty string' });
    }
    if (typeof goal !== 'string' || !goal.trim()) {
      return res.status(400).json({ success: false, error: 'goal must be a non-empty string' });
    }
    const classification = await classifier.classify(content, goal, meta || null);
    res.json({ success: true, data: classification });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/classify/:postId', async (req, res) => {
  try {
    const { goal } = req.body;
    if (typeof goal !== 'string' || !goal.trim()) {
      return res.status(400).json({ success: false, error: 'goal must be a non-empty string' });
    }
    if (!getPool()) return res.status(503).json({ success: false, error: 'MySQL not connected' });
    const [rows] = await getPool().query('SELECT id, content, meta FROM posts WHERE id = ?', [req.params.postId]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'post not found' });

    const post = rows[0];
    let postMeta = post.meta;
    if (typeof postMeta === 'string') {
      try { postMeta = JSON.parse(postMeta); } catch { postMeta = null; }
    }

    const classification = await classifier.classify(post.content || '', goal, postMeta || null);
    const ok = await updatePostClassification(req.params.postId, classification, goal);
    if (!ok) return res.status(404).json({ success: false, error: 'post not found' });

    res.json({ success: true, data: { postId: req.params.postId, classification, goal } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/enrich', async (req, res) => {
  try {
    const { postIds, goal = null } = req.body;
    if (!Array.isArray(postIds) || postIds.length === 0 || postIds.length > 100) {
      return res.status(400).json({ success: false, error: 'postIds 必须是非空数组，且最多 100 条' });
    }
    const sanitized = postIds.map(id => String(id).trim()).filter(Boolean).slice(0, 100);
    if (sanitized.length === 0) {
      return res.status(400).json({ success: false, error: 'postIds 必须是非空数组，且每项为字符串' });
    }

    const enrichJob = await createAndRunEnrichJob(sanitized, typeof goal === 'string' && goal.trim() ? goal.trim() : null);
    res.json({ success: true, data: enrichJob });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/aggregate', async (req, res) => {
  try {
    const { goal, source = 'starred', postIds } = req.body;
    if (typeof goal !== 'string' || !goal.trim()) {
      return res.status(400).json({ success: false, error: 'goal 必须是非空字符串' });
    }
    const userId = String(req.header('X-User-Id') || '').trim();
    if (!userId || userId.length < 2 || userId.length > 64) {
      return res.status(400).json({ success: false, error: 'invalid X-User-Id' });
    }

    let posts;
    if (source === 'starred') {
      posts = await getPostsByUserNotes(userId, { starredOnly: true, limit: 500 });
    } else if (source === 'notes') {
      posts = await getPostsByUserNotes(userId, { limit: 500 });
    } else if (source === 'all' && Array.isArray(postIds)) {
      if (!getPool()) {
        return res.status(503).json({ success: false, error: 'MySQL not connected' });
      }
      const ids = postIds.map(id => String(id).trim()).filter(Boolean).slice(0, 100);
      if (ids.length === 0) {
        posts = [];
      } else {
        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await getPool().query(
          `SELECT * FROM posts WHERE id IN (${placeholders})`,
          ids
        );
        posts = rows.map(require('../services/db').rowToPost);
      }
    } else {
      return res.status(400).json({ success: false, error: '无效的 source 参数' });
    }

    const result = await aggregator.aggregate(goal, posts);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/mock/new', async (req, res) => {
  try {
    const { goal, topics } = req.body;
    if (typeof goal !== 'string' || !goal.trim()) {
      return res.status(400).json({ success: false, error: 'goal 必须是非空字符串' });
    }
    const userId = String(req.header('X-User-Id') || '').trim();
    if (!userId || userId.length < 2 || userId.length > 64) {
      return res.status(400).json({ success: false, error: 'invalid X-User-Id' });
    }

    const recentQuestions = await getRecentPractices(userId, 5);
    const topicList = Array.isArray(topics) ? topics : [];
    const result = await interviewer.generateQuestion(goal, topicList, recentQuestions);

    const practice = await createPractice(userId, {
      question: result.question,
      reference_answer: result.reference_answer,
      topic: result.topic,
      difficulty: result.difficulty,
      scoring_criteria: result.scoring_criteria,
    });

    if (!practice) {
      return res.status(500).json({ success: false, error: '创建练习记录失败' });
    }

    res.json({
      success: true,
      data: {
        practiceId: practice.id,
        question: result.question,
        topic: result.topic,
        difficulty: result.difficulty,
        hints: result.hints || [],
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/mock/:practiceId/grade', async (req, res) => {
  try {
    const { user_answer } = req.body;
    if (typeof user_answer !== 'string' || !user_answer.trim()) {
      return res.status(400).json({ success: false, error: 'user_answer 必须是非空字符串' });
    }
    const practice = await getPractice(req.params.practiceId);
    if (!practice) {
      return res.status(404).json({ success: false, error: 'practice not found' });
    }

    const gradeResult = await grader.grade(
      practice.question,
      user_answer,
      practice.referenceAnswer,
      practice.scoringCriteria
    );

    await updatePracticeGrade(practice.id, gradeResult);

    res.json({
      success: true,
      data: {
        ...gradeResult,
        reference_answer: practice.referenceAnswer,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/mock/history', async (req, res) => {
  try {
    const userId = String(req.header('X-User-Id') || req.query.userId || '').trim();
    if (!userId || userId.length < 2 || userId.length > 64) {
      return res.status(400).json({ success: false, error: 'invalid userId' });
    }
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset, 10) : 0;
    const list = await listPractices(userId, { limit, offset });
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'job not found' });
  res.json({ success: true, data: job });
});

router.get('/jobs', (req, res) => {
  res.json({ success: true, data: listJobs() });
});

router.get('/jobs/:id/events', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'job not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'snapshot', job: getJob(req.params.id) })}\n\n`);

  const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 15000);

  const onUpdate = (id) => {
    if (id !== req.params.id) return;
    const updated = getJob(id);
    res.write(`data: ${JSON.stringify({ type: 'update', job: updated })}\n\n`);
    if (updated.status === 'done' || updated.status === 'failed') {
      clearInterval(keepAlive);
      emitter.off('update', onUpdate);
      res.end();
    }
  };

  emitter.on('update', onUpdate);

  req.on('close', () => {
    clearInterval(keepAlive);
    emitter.off('update', onUpdate);
  });
});

router.get('/health', async (req, res) => {
  const result = { llm: 'error', db: 'error', message: '' };
  try {
    const llm = require('../agent/llm');
    if (llm.isEnabled()) {
      const testResult = await llm.chat([{ role: 'user', content: 'hi' }], { maxTokens: 10 });
      result.llm = testResult !== null ? 'ok' : 'error';
    } else {
      result.llm = 'disabled';
    }
  } catch {
    result.llm = 'error';
  }
  try {
    const pool = getPool();
    if (pool) {
      await pool.query('SELECT 1');
      result.db = 'ok';
    } else {
      result.db = 'disabled';
    }
  } catch {
    result.db = 'error';
  }

  const allOk = result.llm === 'ok' && result.db === 'ok';
  result.message = allOk ? 'all systems operational' : 'some services degraded';
  res.json({ success: true, data: result });
});

module.exports = router;
