const { plan } = require('../agent/planner');
const { reflect } = require('../agent/reflector');
const { crawlKeywords } = require('./crawlRunner');
const { updateJob, addStep } = require('../services/jobStore');
const { createAndRunEnrichJob } = require('./enrichRunner');

async function runSmartJob(jobId, goal, options = {}) {
  const maxRounds = Math.min(Math.max(parseInt(options.maxRounds || 3, 10), 1), 5);
  updateJob(jobId, { status: 'running' });

  try {
    const initialPlan = await plan(goal);
    addStep(jobId, { step: 'plan', message: '生成初始计划' });

    let keywords = Array.isArray(initialPlan.keywords) ? initialPlan.keywords : [];
    let triedKeywords = [];
    let totalCollected = 0;
    let finalDecision = 'stop';
    let rounds = 0;
    let allInsertedIds = [];

    for (let round = 1; round <= maxRounds; round++) {
      rounds = round;
      const roundKeywords = keywords.filter(Boolean).slice(0, 20);
      triedKeywords = [...new Set([...triedKeywords, ...roundKeywords])];
      addStep(jobId, { step: 'round', message: `开始第 ${round} 轮抓取，关键词：${JSON.stringify(roundKeywords)}` });

      let crawlResult = { saved: 0, total: 0, posts: [], detailResults: [], allFeeds: [], insertedIds: [] };
      try {
        crawlResult = await crawlKeywords(roundKeywords, {
          onStep: (step, message, error = false) => addStep(jobId, { step, message, error }),
        });
      } catch (e) {
        addStep(jobId, { step: 'round', message: `第 ${round} 轮抓取失败: ${e.message}`, error: true });
      }

      const collectedThisRound = Array.isArray(crawlResult.posts) ? crawlResult.posts : [];
      totalCollected += collectedThisRound.length;
      allInsertedIds = [...new Set([...allInsertedIds, ...(crawlResult.insertedIds || [])])];
      addStep(jobId, { step: 'round', message: `第 ${round} 轮抓到 ${collectedThisRound.length} 条，累计 ${totalCollected} 条` });

      let decisionResult;
      try {
        decisionResult = await reflect({
          goal,
          triedKeywords,
          collected: collectedThisRound,
          round,
          maxRounds,
        });
      } catch (e) {
        decisionResult = {
          decision: 'stop',
          reason: e.message,
          nextKeywords: [],
          qualitySummary: '',
          source: 'fallback',
        };
      }

      addStep(jobId, { step: 'reflect', message: `反思结果：${decisionResult.decision} - ${decisionResult.reason}` });
      finalDecision = decisionResult.decision;

      if (decisionResult.decision === 'stop' || round >= maxRounds) {
        break;
      }

      keywords = decisionResult.nextKeywords && decisionResult.nextKeywords.length > 0
        ? decisionResult.nextKeywords
        : initialPlan.keywords;
    }

    let enrichJobId = null;
    if (allInsertedIds.length > 0) {
      const enrichJob = await createAndRunEnrichJob(allInsertedIds, goal || null);
      enrichJobId = enrichJob.id;
      addStep(jobId, { step: 'enrich', message: `已创建 enrich Job: ${enrichJobId}` });
    }

    updateJob(jobId, {
      status: 'done',
      result: {
        rounds,
        totalCollected,
        finalDecision,
        insertedIds: allInsertedIds,
        enrichJobId,
      },
    });
  } catch (e) {
    updateJob(jobId, { status: 'failed', error: e.message });
  }
}

module.exports = { runSmartJob };
