const { getPool, rowToPost, updatePostMeta, updatePostClassification } = require('../services/db');
const { getJob, updateJob, addStep, createJob } = require('../services/jobStore');
const extractor = require('../agent/extractor');
const classifier = require('../agent/classifier');

async function createAndRunEnrichJob(postIds, goal) {
  const job = createJob([], { type: 'enrich', payload: { postIds, goal } });
  setImmediate(() => {
    runEnrichJob(job.id, postIds, goal).catch(e => {
      updateJob(job.id, { status: 'failed', error: e.message });
    });
  });
  return job;
}

async function runEnrichJob(jobId, postIds, goal) {
  updateJob(jobId, { status: 'running' });
  const pool = getPool();
  if (!pool) {
    updateJob(jobId, { status: 'failed', error: 'MySQL not connected' });
    return;
  }

  const enrichedIds = [];
  const skippedIds = [];
  const failedIds = [];
  const total = Array.isArray(postIds) ? postIds.length : 0;

  try {
    for (let i = 0; i < total; i++) {
      const postId = postIds[i];
      const shortId = String(postId).slice(0, 8);
      addStep(jobId, { step: 'extract', message: `extract ${i + 1}/${total}: ${shortId}` });
      try {
        const [rows] = await pool.query('SELECT * FROM posts WHERE id = ?', [postId]);
        if (rows.length === 0) {
          addStep(jobId, { step: 'extract', message: `skip ${shortId}: post not found`, error: true });
          skippedIds.push(postId);
          continue;
        }

        const post = rowToPost(rows[0]);
        let meta = post.meta;
        const hasUsefulMeta = meta
          && typeof meta === 'object'
          && !meta.extractError
          && (meta.company || meta.role || (Array.isArray(meta.questions) && meta.questions.length > 0));

        if (!hasUsefulMeta) {
          meta = await extractor.extract(post.content || '');
          await updatePostMeta(postId, meta);
          addStep(jobId, { step: 'extract', message: `extract ${shortId} done` });
        } else {
          addStep(jobId, { step: 'extract', message: `skip extract ${shortId}: meta ready` });
        }

        if (typeof goal === 'string' && goal.trim()) {
          addStep(jobId, { step: 'classify', message: `classify ${i + 1}/${total}: ${shortId}` });
          const classification = await classifier.classify(post.content || '', goal, meta || post.meta || null);
          await updatePostClassification(postId, classification, goal);
          addStep(jobId, { step: 'classify', message: `classify ${shortId}: relevance=${classification.relevance.toFixed(2)}` });
        } else {
          addStep(jobId, { step: 'classify', message: `skip classify ${shortId} (no goal)` });
        }

        enrichedIds.push(postId);
      } catch (e) {
        failedIds.push(postId);
        addStep(jobId, { step: 'enrich', message: `${shortId} failed: ${e.message}`, error: true });
      }
    }

    updateJob(jobId, {
      status: 'done',
      result: {
        enriched: enrichedIds.length,
        skipped: skippedIds.length,
        failed: failedIds.length,
        total,
        enrichedIds,
        skippedIds,
        failedIds,
      },
    });
  } catch (e) {
    updateJob(jobId, { status: 'failed', error: e.message });
  }
}

module.exports = { createAndRunEnrichJob, runEnrichJob };
